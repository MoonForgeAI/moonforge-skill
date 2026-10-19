// MoonForge Web SDK — error report queue: dedupe, per-session cap, batching, backoff.
//
// Why this exists: sending one POST per error let a single looping failure in a
// game produce millions of reports a day, which the collector then had to
// 429. Reports are now:
//   - deduplicated per session by fingerprint (first occurrence carries the
//     breadcrumbs; repeats only add to a count),
//   - capped per session (maxErrorReportsPerSession; past it, counts only),
//   - batched to POST /api/errors/batch every 5s or at 20 queued,
//   - paused on 429 for the collector's retryAfterMs,
//   - held in a bounded queue that drops the oldest when full.
// Nothing here may throw into the host game.
import { DEFAULT_MAX_ERROR_REPORTS_PER_SESSION, debugLog, getConfig, newUuid, postErrorBatch, readStored, writeStored } from './core.js';
import { KEEPALIVE_BUDGET_BYTES, planBatch } from './error-batch.js';

export { MAX_BATCH, MAX_BATCH_BYTES, KEEPALIVE_BUDGET_BYTES } from './error-batch.js';
export const FLUSH_INTERVAL_MS = 5000;
export const FLUSH_AT = 20;
export const MAX_QUEUE = 200;
/** Repeats of an already-sent fingerprint are reported at most this often (and on page hide). */
export const REPEAT_REPORT_INTERVAL_MS = 60000;
/** Bound on fingerprints remembered per session, so unique-message floods cannot grow memory. */
export const MAX_TRACKED_FINGERPRINTS = 1000;
export const DEFAULT_RETRY_AFTER_MS = 60000;
/** Transport failures (network/5xx/408) retry with backoff; an entry is retired after this many. */
export const MAX_SEND_ATTEMPTS = 6;
const MIN_PAUSE_MS = 1000;
const MAX_PAUSE_MS = 60 * 60 * 1000;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

const EMPTY_STATS = Object.freeze({ sent: 0, dropped: 0, suppressed: 0, rejected: 0 });

/**
 * The per-session report count is persisted (localStorage, or core's in-page
 * fallback when storage is blocked) so a reload within the same SDK session
 * cannot reset the cap. Fingerprint dedupe state is in memory only: after a
 * reload the next occurrence of an error is reported in full again, within
 * the same persisted budget.
 */
const REPORT_COUNT_KEY = 'mf_error_reports';

function loadReportCount(sessionId) {
  try {
    const saved = JSON.parse(readStored(REPORT_COUNT_KEY) ?? 'null');
    return saved && saved.sessionId === sessionId && Number.isInteger(saved.count) && saved.count >= 0 ? saved.count : 0;
  } catch { return 0; }
}

function freshSession(id) {
  return { id, records: new Map(), distinctReported: id === null ? 0 : loadReportCount(id) };
}

/** Replaces the session's report count and persists it. */
function setDistinctReported(count) {
  session = { ...session, distinctReported: count };
  if (session.id !== null) writeStored(REPORT_COUNT_KEY, JSON.stringify({ sessionId: session.id, count }));
}

let session = freshSession(null);
let queue = [];
let stats = EMPTY_STATS;
let rateLimitedUntil = 0; // set by a 429: the collector asked us to stop; honoured even at page teardown
let backoffUntil = 0;     // set by transport failures: local backoff; page teardown still tries once
let failureStreak = 0;
let timer = null;
let inFlight = null;
let lifecycle = null;

function bump(key, n = 1) { stats = { ...stats, [key]: stats[key] + n }; }
function pausedUntil() { return Math.max(rateLimitedUntil, backoffUntil); }
function isPaused() { return Date.now() < pausedUntil(); }
function isRateLimited() { return Date.now() < rateLimitedUntil; }
function reportCap() { return getConfig()?.maxErrorReportsPerSession ?? DEFAULT_MAX_ERROR_REPORTS_PER_SESSION; }

function newEntry(fingerprint, payload, count, repeat) {
  return { id: newUuid(), fingerprint, payload, count, repeat, attempts: 0 };
}

/**
 * Entries that will never be sent. A dropped *first* report frees its slot,
 * so the fingerprint's next occurrence goes out as a full report again rather
 * than as a count for a report the collector never received.
 */
function discard(entries) {
  if (!entries.length) return;
  bump('dropped', entries.length);
  for (const e of entries) {
    const rec = session.records.get(e.fingerprint);
    if (!e.repeat && rec && rec.queuedId === e.id) {
      session.records.delete(e.fingerprint);
      setDistinctReported(Math.max(0, session.distinctReported - 1));
    }
  }
}

/** Keeps the newest MAX_QUEUE entries, discarding the oldest. */
function bounded(list) {
  const overflow = list.length - MAX_QUEUE;
  if (overflow <= 0) return list;
  discard(list.slice(0, overflow));
  return list.slice(overflow);
}

function scheduleFlush(delayMs) {
  if (timer || typeof setTimeout !== 'function') return;
  const wait = Math.max(delayMs, pausedUntil() - Date.now());
  timer = setTimeout(() => { timer = null; void flushErrors(); }, wait);
  if (timer && typeof timer.unref === 'function') timer.unref();
}

function enqueue(entry) {
  queue = bounded([...queue, entry]);
  if (queue.length >= FLUSH_AT && !isPaused() && !inFlight) void flushErrors();
  else scheduleFlush(FLUSH_INTERVAL_MS);
}

function incrementQueued(entryId) {
  if (!queue.some((e) => e.id === entryId)) return false;
  queue = queue.map((e) => (e.id === entryId ? { ...e, count: e.count + 1 } : e));
  return true;
}

/** Turns held repeat counts into count-only queue entries (all of them when `force`). */
function promoteRepeats(now, force) {
  for (const [fp, rec] of session.records) {
    if (rec.pending > 0 && rec.lastPayload && (force || now - rec.lastReportAt >= REPEAT_REPORT_INTERVAL_MS)) {
      const entry = newEntry(fp, rec.lastPayload, rec.pending, true);
      session.records.set(fp, { ...rec, pending: 0, lastPayload: null, queuedId: entry.id, lastReportAt: now });
      queue = bounded([...queue, entry]);
    }
  }
}

function hasPendingRepeats() {
  for (const rec of session.records.values()) if (rec.pending > 0) return true;
  return false;
}

/** A new SDK session gets a fresh budget; the old session's held counts are queued first. */
function rollSession(sessionId) {
  if (session.id === sessionId) return;
  if (session.id !== null) promoteRepeats(Date.now(), true);
  session = freshSession(sessionId);
}

function recordFirst(fp, payload) {
  const now = Date.now();
  if (session.records.size >= MAX_TRACKED_FINGERPRINTS) { bump('suppressed'); return false; }
  if (session.distinctReported >= reportCap()) {
    session.records.set(fp, { reported: false, queuedId: null, pending: 0, lastPayload: null, lastReportAt: now });
    bump('suppressed');
    return false;
  }
  const entry = newEntry(fp, payload, 1, false);
  setDistinctReported(session.distinctReported + 1);
  session.records.set(fp, { reported: true, queuedId: entry.id, pending: 0, lastPayload: null, lastReportAt: now });
  enqueue(entry);
  return true;
}

function recordRepeat(fp, rec, payload) {
  if (!rec.reported) { bump('suppressed'); return false; }
  if (rec.queuedId && incrementQueued(rec.queuedId)) return true;
  // Count-only reports need neither the breadcrumb trail nor the raw stack (frames remain).
  const { breadcrumbs: _crumbs, rawStackTrace: _raw, ...countPayload } = payload;
  session.records.set(fp, { ...rec, queuedId: null, pending: rec.pending + 1, lastPayload: countPayload });
  scheduleFlush(FLUSH_INTERVAL_MS);
  return true;
}

/**
 * Records one error occurrence.
 * @param {string} fingerprint dedupe key (error-fingerprint.js)
 * @param {object} payload single-error payload including `game`, `sessionId` and `breadcrumbs`
 * @returns {boolean} true when the occurrence will reach the collector (as a report or a count)
 */
export function recordError(fingerprint, payload) {
  try {
    rollSession(payload?.sessionId ?? null);
    const rec = session.records.get(fingerprint);
    return rec ? recordRepeat(fingerprint, rec, payload) : recordFirst(fingerprint, payload);
  } catch (e) {
    debugLog('error queue failure', e);
    return false;
  }
}

/** Removes the next planned batch from the head of the queue. */
function takeBatch(keepalive, budget) {
  const plan = planBatch(queue, { keepalive, budget });
  queue = queue.slice(plan.consumed);
  discard(plan.unsendable);
  return plan;
}

function pauseFor(ms, rateLimited) {
  const until = Date.now() + Math.min(Math.max(ms, MIN_PAUSE_MS), MAX_PAUSE_MS);
  if (rateLimited) rateLimitedUntil = Math.max(rateLimitedUntil, until);
  else backoffUntil = Math.max(backoffUntil, until);
  debugLog('error sending paused until', until, rateLimited ? '(429)' : '(backoff)');
}

/** Puts a batch back at the head of the queue; `countAttempt` retires entries after MAX_SEND_ATTEMPTS. */
function requeue(entries, { countAttempt = false, solo = false } = {}) {
  const updated = entries.map((e) => ({ ...e, attempts: e.attempts + (countAttempt ? 1 : 0), solo: e.solo || solo }));
  discard(updated.filter((e) => e.attempts >= MAX_SEND_ATTEMPTS));
  queue = bounded([...updated.filter((e) => e.attempts < MAX_SEND_ATTEMPTS), ...queue]);
}

function isRetryable(status) { return status === 0 || status === 408 || status === 425 || status >= 500; }

/**
 * Indices of the items a 400 names (`errors.<i>.…`), or null when the
 * rejection is request-wide (unknown game, envelope error, unparseable body) -
 * then nothing in the batch can succeed by resending.
 */
function rejectedIndices(rejection, count) {
  const paths = rejection?.paths ?? [];
  if (!paths.length) return null;
  const indices = new Set();
  for (const path of paths) {
    const m = /^errors\.(\d+)(\.|$)/.exec(path);
    if (!m || Number(m[1]) >= count) return null;
    indices.add(Number(m[1]));
  }
  return indices;
}

/** A 400: drop the items it names and resend the others once more; drop everything if request-wide. */
function handleRejection(entries, rejection) {
  const bad = rejectedIndices(rejection, entries.length);
  const survivors = bad ? entries.filter((_e, i) => !bad.has(i)) : [];
  bump('rejected', entries.length - survivors.length);
  debugLog('error batch rejected (400)', rejection?.error, rejection?.paths);
  // Counted as an attempt, so a collector that keeps refusing cannot loop us.
  if (survivors.length) requeue(survivors, { countAttempt: true });
  return 'rejected';
}

/** @returns {Promise<'sent'|'split'|'rejected'|'paused'|'failed'>} */
async function sendBatch(plan, teardown) {
  const { entries, items } = plan;
  // Only teardown sends use keepalive: browsers cap the TOTAL of in-flight
  // keepalive bodies (~64KB), and that allowance is reserved for pagehide.
  const res = await postErrorBatch({ type: 'error_batch', game: plan.game, errors: items }, { keepalive: teardown });
  if (res.ok) { failureStreak = 0; bump('sent', items.length); return 'sent'; }
  if (res.status === 429) {
    pauseFor(res.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS, true);
    requeue(entries);
    return 'paused';
  }
  if (isRetryable(res.status)) {
    failureStreak += 1;
    pauseFor(Math.min(BASE_BACKOFF_MS * 2 ** (failureStreak - 1), MAX_BACKOFF_MS), false);
    requeue(entries, { countAttempt: true });
    return 'failed';
  }
  if (res.status === 400) return handleRejection(entries, res.rejection);
  if (res.status === 413 && entries.length > 1) {
    requeue(entries, { solo: true }); // body too large: resend each report on its own
    return 'split';
  }
  bump('rejected', items.length);
  debugLog('error batch rejected', res.status);
  return 'rejected';
}

async function sendBatches(maxBatches) {
  for (let i = 0; i < maxBatches && queue.length && !isPaused(); i++) {
    const plan = takeBatch(false);
    if (!plan.items.length) continue;
    const outcome = await sendBatch(plan, false);
    if (outcome === 'paused' || outcome === 'failed') return false;
  }
  return queue.length === 0;
}

/**
 * Page teardown: plan requests up front within ONE shared keepalive allowance
 * (browsers cap the total of in-flight keepalive bodies), fire them together -
 * the page may freeze at any await - and leave whatever does not fit queued.
 */
async function sendForTeardown() {
  if (isRateLimited()) return false;
  const plans = [];
  let remaining = KEEPALIVE_BUDGET_BYTES;
  while (queue.length) {
    const plan = takeBatch(true, remaining);
    if (!plan.items.length) {
      if (!plan.consumed) break; // the next report does not fit what is left
      continue;
    }
    plans.push(plan);
    remaining -= plan.bytes;
  }
  const outcomes = await Promise.all(plans.map((p) => sendBatch(p, true)));
  return queue.length === 0 && outcomes.every((o) => o === 'sent' || o === 'rejected');
}

function afterFlush() {
  if (queue.length || hasPendingRepeats()) scheduleFlush(FLUSH_INTERVAL_MS);
}

/**
 * Sends queued reports. Timer/threshold flushes send one batch; `drain` sends
 * every batch and queues all held repeat counts; `keepalive` (page teardown)
 * does the same with keepalive requests sized under the browser's budget.
 * Respects a 429 pause always, and transport backoff except at teardown.
 * Never rejects.
 * @param {{ keepalive?: boolean, drain?: boolean }} [opts]
 * @returns {Promise<boolean>} true when nothing is left queued
 */
export async function flushErrors({ keepalive = false, drain = false } = {}) {
  try {
    if (!getConfig()) return false;
    promoteRepeats(Date.now(), keepalive || drain);
    if (keepalive) return await sendForTeardown();
    while (inFlight) await inFlight;
    inFlight = sendBatches(drain ? Infinity : 1);
    try { return await inFlight; } finally { inFlight = null; afterFlush(); }
  } catch (e) {
    debugLog('error flush failed', e);
    return false;
  }
}

/** Flushes with keepalive when the page is hidden or torn down. Idempotent. */
export function installErrorQueueLifecycle() {
  if (lifecycle || typeof globalThis.addEventListener !== 'function') return;
  const onPageHide = () => { void flushErrors({ keepalive: true }); };
  const onVisibility = () => { if (globalThis.document?.visibilityState === 'hidden') onPageHide(); };
  globalThis.addEventListener('pagehide', onPageHide);
  globalThis.addEventListener('visibilitychange', onVisibility);
  lifecycle = { onPageHide, onVisibility };
}

/** Diagnostics snapshot. */
export function getErrorQueueStats() {
  return { ...stats, queued: queue.length, distinctReported: session.distinctReported, paused: isPaused(), pausedUntil: pausedUntil() };
}

/** Test seam: clears all queue state, timers and listeners. */
export function _resetErrorQueue() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (lifecycle && typeof globalThis.removeEventListener === 'function') {
    globalThis.removeEventListener('pagehide', lifecycle.onPageHide);
    globalThis.removeEventListener('visibilitychange', lifecycle.onVisibility);
  }
  lifecycle = null;
  session = freshSession(null);
  queue = [];
  stats = EMPTY_STATS;
  rateLimitedUntil = 0;
  backoffUntil = 0;
  failureStreak = 0;
  inFlight = null;
}
