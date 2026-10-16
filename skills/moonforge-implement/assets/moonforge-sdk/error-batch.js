// MoonForge Web SDK — pure batch planning for error-queue.js.
import { debugLog } from './core.js';
import { slimItem, toBatchItem } from './error-payload.js';

/** Collector accepts up to 50 per batch; 20 keeps request bodies modest. */
export const MAX_BATCH = 20;
/** Size cap for ordinary requests, so a few huge stack traces cannot make one body hit a proxy limit. */
export const MAX_BATCH_BYTES = 256000;
/** Browsers cap in-flight keepalive bodies at 64KB in total; stay under it. */
export const KEEPALIVE_BUDGET_BYTES = 60000;
const ENVELOPE_OVERHEAD_BYTES = 200;

function jsonBytes(value) {
  const s = JSON.stringify(value);
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(s).length : s.length;
}

/** Wire item plus its size, or null if the entry cannot be serialised at all. */
function sized(entry) {
  try {
    const item = toBatchItem(entry);
    return { item, size: jsonBytes(item) };
  } catch (e) {
    debugLog('unsendable error report dropped', e);
    return null;
  }
}

/** Fits one item under `limit`, slimming it (no raw stack/breadcrumbs) if needed; null when it never can. */
function fit(built, limit) {
  if (!built) return null;
  if (built.size <= limit) return built;
  const item = slimItem(built.item);
  const size = jsonBytes(item);
  return size <= limit ? { item, size } : null;
}

/**
 * Plans the next request from the head of `queue` without changing it.
 * A batch holds entries of one game only, at most MAX_BATCH of them, under a
 * byte budget (KEEPALIVE_BUDGET_BYTES at page teardown, else MAX_BATCH_BYTES);
 * a `solo` entry (from a split rejected batch) always travels alone.
 * @param {ReadonlyArray<object>} queue
 * @param {{ keepalive: boolean }} opts
 * @returns {{ game: string|undefined, entries: object[], items: object[], bytes: number, consumed: number, unsendable: object[] }}
 *   `consumed` = how many head entries the plan uses up (sent or unsendable).
 */
export function planBatch(queue, { keepalive }) {
  const budget = keepalive ? KEEPALIVE_BUDGET_BYTES : MAX_BATCH_BYTES;
  const limit = budget - ENVELOPE_OVERHEAD_BYTES;
  const plan = { game: undefined, entries: [], items: [], bytes: ENVELOPE_OVERHEAD_BYTES, consumed: 0, unsendable: [] };
  for (const entry of queue) {
    const game = entry.payload?.game;
    if (plan.entries.length && (plan.entries.length >= MAX_BATCH || game !== plan.game || entry.solo || plan.entries[0].solo)) break;
    const fitted = fit(sized(entry), limit);
    if (!fitted) { plan.unsendable.push(entry); plan.consumed += 1; continue; }
    if (plan.entries.length && plan.bytes + fitted.size > budget) break;
    plan.game = game;
    plan.entries.push(entry);
    plan.items.push(fitted.item);
    plan.bytes += fitted.size + 1;
    plan.consumed += 1;
  }
  return plan;
}
