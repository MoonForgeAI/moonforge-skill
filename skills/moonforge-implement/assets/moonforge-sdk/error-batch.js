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
 * A batch holds entries of one game only, at most MAX_BATCH of them, within
 * `budget` bytes; a `solo` entry (from a split 413) always travels alone.
 * At page teardown (`keepalive`) the caller passes what is left of the
 * browser's shared keepalive allowance, so the plan may be empty when the
 * next report does not fit - it then stays queued.
 * @param {ReadonlyArray<object>} queue
 * @param {{ keepalive: boolean, budget?: number }} opts
 * @returns {{ game: string|undefined, entries: object[], items: object[], bytes: number, consumed: number, unsendable: object[] }}
 *   `consumed` = how many head entries the plan uses up (sent or unsendable);
 *   `unsendable` = entries that could never fit any request.
 */
export function planBatch(queue, { keepalive, budget }) {
  const ceiling = keepalive ? KEEPALIVE_BUDGET_BYTES : MAX_BATCH_BYTES;
  const allowance = Math.min(budget ?? ceiling, ceiling);
  const plan = { game: undefined, entries: [], items: [], bytes: ENVELOPE_OVERHEAD_BYTES, consumed: 0, unsendable: [] };
  for (const entry of queue) {
    const game = entry.payload?.game;
    if (plan.entries.length && (plan.entries.length >= MAX_BATCH || game !== plan.game || entry.solo || plan.entries[0].solo)) break;
    const fitted = fit(sized(entry), ceiling - ENVELOPE_OVERHEAD_BYTES);
    if (!fitted) { plan.unsendable.push(entry); plan.consumed += 1; continue; }
    if (plan.bytes + fitted.size > allowance) break;
    plan.game = game;
    plan.entries.push(entry);
    plan.items.push(fitted.item);
    plan.bytes += fitted.size + 1;
    plan.consumed += 1;
  }
  return plan;
}
