import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';
import * as ctx from '../../skills/moonforge-implement/assets/moonforge-sdk/context.js';
import * as err from '../../skills/moonforge-implement/assets/moonforge-sdk/errors.js';
import * as queue from '../../skills/moonforge-implement/assets/moonforge-sdk/error-queue.js';

const GAME = '0b8f4c1e-7d6a-4a51-9b2c-3e5f6a7b8c9d';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Collector stub: `respond(n)` returns {status, body} for the n-th call (0-based). */
function collector(respond = () => ({ status: 200, body: { status: 'accepted' } })) {
  const f = vi.fn(async (url, init) => {
    const { status, body } = respond(f.mock.calls.length - 1, url, init);
    return { ok: status >= 200 && status < 300, status, json: async () => body ?? {} };
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const batches = (f) => f.mock.calls.map((c) => JSON.parse(c[1].body));
const items = (f) => batches(f).flatMap((b) => b.errors);
const tick = async (ms) => { await vi.advanceTimersByTimeAsync(ms); };

function boom(msg = 'boom', line = 10) {
  const e = new TypeError(msg);
  e.stack = `TypeError: ${msg}\n    at load (https://g.example/app.js:${line}:5)`;
  return e;
}

beforeEach(() => {
  vi.useFakeTimers();
  core.resetAll();
  ctx.clearGameState();
  err.clearBreadcrumbs();
  err.clearUser();
  queue._resetErrorQueue();
  core.init({ gameId: GAME, appVersion: '2.1.0', buildNumber: '42' });
});
afterEach(() => { queue._resetErrorQueue(); vi.useRealTimers(); });

describe('error queue: batch transport', () => {
  it('does not send immediately; flushes to /api/errors/batch after 5s in the collector batch shape', async () => {
    const f = collector();
    err.addBreadcrumb('opened shop');
    await err.captureException(boom());
    expect(f).not.toHaveBeenCalled();

    await tick(5000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe('https://collector.moonforge.co/api/errors/batch');
    expect(f.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const [b] = batches(f);
    expect(b.type).toBe('error_batch');
    expect(b.game).toBe(GAME);
    expect(b.errors).toHaveLength(1);
    const item = b.errors[0];
    expect(item).not.toHaveProperty('game'); // batch items omit game - it lives on the batch
    expect(item.clientErrorId).toMatch(UUID_RE);
    expect(item).toMatchObject({ errorType: 'exception', exceptionClass: 'TypeError', message: 'boom', appVersion: '2.1.0' });
    expect(item.breadcrumbs.map((x) => x.message)).toEqual(['opened shop']);
    expect(item.tags.mf_occurrences).toBe('1');
  });

  it('flushes immediately once 20 reports are queued, and never sends more than 20 per batch', async () => {
    const f = collector();
    for (let i = 0; i < 19; i++) await err.captureException(boom(`e${i}`));
    expect(f).not.toHaveBeenCalled();
    await err.captureException(boom('e19'));
    await tick(0);
    expect(f).toHaveBeenCalledTimes(1);
    expect(batches(f)[0].errors).toHaveLength(20);

    for (let i = 0; i < 45; i++) await err.captureException(boom(`f${i}`));
    await err.flush();
    await tick(20000);
    expect(batches(f).every((b) => b.errors.length <= 20)).toBe(true);
    expect(items(f)).toHaveLength(65);
  });

  it('flush() drains the queue on demand', async () => {
    const f = collector();
    await err.captureMessage('hello');
    expect(await err.flush()).toBe(true);
    expect(items(f)).toHaveLength(1);
  });
});

describe('error queue: dedupe by fingerprint', () => {
  it('merges repeats of a still-queued report into its count, keeping breadcrumbs only on the first', async () => {
    const f = collector();
    err.addBreadcrumb('crumb');
    for (let i = 0; i < 3; i++) await err.captureException(boom());
    await tick(5000);
    const sent = items(f);
    expect(sent).toHaveLength(1);
    expect(sent[0].tags.mf_occurrences).toBe('3');
    expect(sent[0].breadcrumbs).toHaveLength(1);
  });

  it('reports repeats after the first send as a count-only report without breadcrumbs', async () => {
    const f = collector();
    err.addBreadcrumb('crumb');
    await err.captureException(boom());
    await tick(5000);
    expect(items(f)).toHaveLength(1);

    for (let i = 0; i < 4; i++) await err.captureException(boom());
    await tick(60000);
    const sent = items(f);
    expect(sent).toHaveLength(2);
    const repeat = sent[1];
    expect(repeat.breadcrumbs ?? []).toHaveLength(0);
    expect(repeat.tags).toMatchObject({ mf_occurrences: '4', mf_repeat: 'true' });
    expect(repeat.clientErrorId).not.toBe(sent[0].clientErrorId);
  });

  it('groups network errors by method + path + status, ignoring the query string', async () => {
    const f = collector();
    await err.captureNetworkError('https://api.g.example/save?t=1', { method: 'POST', statusCode: 503 });
    await err.captureNetworkError('https://api.g.example/save?t=2', { method: 'POST', statusCode: 503 });
    await err.captureNetworkError('https://api.g.example/save?t=3', { method: 'POST', statusCode: 500 });
    await tick(5000);
    const sent = items(f);
    expect(sent).toHaveLength(2);
    expect(sent[0].tags.mf_occurrences).toBe('2');
    expect(sent[1].tags.mf_occurrences).toBe('1');
  });
});

describe('error queue: per-session cap', () => {
  it('sends at most maxErrorReportsPerSession distinct reports; past it, only counts are kept', async () => {
    core.init({ gameId: GAME, appVersion: '2.1.0', buildNumber: '42', maxErrorReportsPerSession: 3 });
    const f = collector();
    for (let i = 0; i < 5; i++) await err.captureException(boom(`e${i}`));
    await err.captureException(boom('e4')); // repeat of an over-cap fingerprint
    await tick(5000);
    expect(items(f)).toHaveLength(3);
    expect(queue.getErrorQueueStats()).toMatchObject({ distinctReported: 3, suppressed: 3 });
  });

  it('defaults the cap to 100', async () => {
    const f = collector();
    for (let i = 0; i < 120; i++) await err.captureException(boom(`e${i}`));
    await err.flush();
    await tick(60000);
    expect(items(f)).toHaveLength(100);
  });

  it('stops remembering new fingerprints past 1000 per session, so unique-message floods cannot grow memory', async () => {
    collector();
    for (let i = 0; i < 1005; i++) await err.captureMessage(`unique ${i}`);
    expect(queue.getErrorQueueStats()).toMatchObject({ distinctReported: 100, suppressed: 905 });
    await err.captureMessage('unique 1004'); // never tracked: still only suppressed, no report
    expect(queue.getErrorQueueStats()).toMatchObject({ distinctReported: 100, suppressed: 906 });
  });

  it('starts a fresh budget when the SDK session rotates', async () => {
    core.init({ gameId: GAME, appVersion: '2.1.0', buildNumber: '42', maxErrorReportsPerSession: 1 });
    const f = collector();
    await err.captureException(boom('a'));
    await err.captureException(boom('b'));
    core.resetSession();
    await err.captureException(boom('b'));
    await tick(5000);
    expect(items(f).map((i) => i.message)).toEqual(['a', 'b']);
  });
});

describe('error queue: 429 backoff and bounds', () => {
  it('pauses all sending until retryAfterMs elapses, then resends the rejected batch', async () => {
    const f = collector((n) => (n === 0
      ? { status: 429, body: { error: 'Rate limit exceeded', reason: 'game', retryAfterMs: 30000 } }
      : { status: 200 }));
    await err.captureException(boom('a'));
    await tick(5000);
    expect(f).toHaveBeenCalledTimes(1);

    await err.captureException(boom('b'));
    await err.flush(); // explicit flush must also respect the pause
    await tick(20000);
    expect(f).toHaveBeenCalledTimes(1);

    await tick(15000);
    expect(f).toHaveBeenCalledTimes(2);
    expect(batches(f)[1].errors.map((i) => i.message).sort()).toEqual(['a', 'b']);
  });

  it('defaults the pause to 60s when the 429 body carries no retryAfterMs', async () => {
    const f = collector((n) => (n === 0 ? { status: 429, body: {} } : { status: 200 }));
    await err.captureException(boom('a'));
    await tick(5000);
    await tick(55000);
    expect(f).toHaveBeenCalledTimes(1);
    await tick(10000);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('bounds the queue at 200 entries, dropping the oldest and counting them', async () => {
    core.init({ gameId: GAME, appVersion: '2.1.0', buildNumber: '42', maxErrorReportsPerSession: 1000 });
    const f = collector((n) => (n === 0 ? { status: 429, body: { retryAfterMs: 600000 } } : { status: 200 }));
    await err.captureException(boom('first'));
    await tick(5000); // 429 -> paused for 10 minutes, 'first' requeued
    for (let i = 0; i < 250; i++) await err.captureException(boom(`e${i}`));
    const stats = queue.getErrorQueueStats();
    expect(stats.queued).toBe(200);
    expect(stats.dropped).toBe(51);
    await tick(700000);
    const sent = f.mock.calls.slice(1).flatMap((c) => JSON.parse(c[1].body).errors); // after the 429'd request
    expect(sent).toHaveLength(200);
    expect(sent.map((i) => i.message)).not.toContain('first');
    expect(sent.at(-1).message).toBe('e249');
  });

  it('drops a batch the collector rejects as invalid (400) instead of retrying it', async () => {
    const f = collector((n) => (n === 0 ? { status: 400, body: { error: 'Invalid request body' } } : { status: 200 }));
    await err.captureException(boom('a'));
    await tick(5000);
    await tick(120000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(queue.getErrorQueueStats().rejected).toBe(1);
  });

  it('retries after a transport failure, and the capture call never throws', async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', f);
    await expect(err.captureException(boom('a'))).resolves.toBe(true);
    await tick(5000);
    await tick(60000);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[1][1].body).errors[0].message).toBe('a');
  });
});

describe('error queue: page lifecycle', () => {
  it('flushes with keepalive on pagehide', async () => {
    queue.installErrorQueueLifecycle();
    const f = collector();
    await err.captureException(boom('a'));
    globalThis.dispatchEvent(new Event('pagehide'));
    await tick(0);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1].keepalive).toBe(true);
  });

  it('flushes with keepalive when the page becomes hidden, including pending repeat counts', async () => {
    queue.installErrorQueueLifecycle();
    let vis = 'visible';
    Object.defineProperty(globalThis.document, 'visibilityState', { configurable: true, get: () => vis });
    const f = collector();
    await err.captureException(boom('a'));
    await tick(5000);
    await err.captureException(boom('a')); // repeat, normally held up to 60s
    vis = 'hidden';
    globalThis.dispatchEvent(new Event('visibilitychange'));
    await tick(0);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][1].keepalive).toBe(true);
    expect(batches(f)[1].errors[0].tags).toMatchObject({ mf_occurrences: '1', mf_repeat: 'true' });
  });

  it('keeps each keepalive request under the 64KB keepalive budget', async () => {
    queue.installErrorQueueLifecycle();
    const f = collector();
    for (let i = 0; i < 5; i++) {
      const e = boom(`big${i}`);
      e.stack = `${e.stack}\n${'x'.repeat(40000)}`;
      // The last report also carries ~50KB of breadcrumbs: it only fits once slimmed.
      if (i === 4) for (let j = 0; j < 50; j++) err.addBreadcrumb('b'.repeat(1000));
      await err.captureException(e);
    }
    globalThis.dispatchEvent(new Event('pagehide'));
    await tick(0);
    expect(f.mock.calls.length).toBeGreaterThan(1);
    for (const c of f.mock.calls) {
      expect(c[1].keepalive).toBe(true);
      expect(c[1].body.length).toBeLessThanOrEqual(60000);
    }
    expect(items(f).map((i) => i.message).sort()).toEqual(['big0', 'big1', 'big2', 'big3', 'big4']);
    const slimmed = items(f).find((i) => i.message === 'big4');
    expect(slimmed.breadcrumbs).toBeUndefined();
    expect(slimmed.rawStackTrace).toBeUndefined();
    expect(slimmed.frames.length).toBeGreaterThan(0);
  });
});

describe('error queue: payload limits', () => {
  it('clips fields to the collector schema limits so one oversized report cannot fail a batch', async () => {
    const f = collector();
    err.setUser('u-1', { note: 'n'.repeat(500) });
    await err.captureNetworkError(`https://api.g.example/${'p'.repeat(3000)}`, { method: 'PROPFIND-LONG', statusCode: 503 });
    await tick(5000);
    const [item] = items(f);
    expect(item.tags.note.length).toBeLessThanOrEqual(200);
    expect(item.networkRequest.url.length).toBeLessThanOrEqual(2000);
    expect(item.networkRequest.method.length).toBeLessThanOrEqual(10);
  });
});

describe('error queue: review hardening', () => {
  it('still dedupes when localStorage refuses access (private mode / sandboxed iframe)', async () => {
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, clear() {} };
    vi.stubGlobal('localStorage', blocked);
    const f = collector();
    for (let i = 0; i < 5; i++) await err.captureException(boom());
    await tick(5000);
    expect(items(f)).toHaveLength(1);
    expect(items(f)[0].tags.mf_occurrences).toBe('5');
  });

  it('caps non-keepalive request bodies by size as well as count', async () => {
    const f = collector();
    for (let i = 0; i < 10; i++) {
      const e = boom(`big${i}`);
      e.stack = `${e.stack}\n${'x'.repeat(45000)}`;
      await err.captureException(e);
    }
    await err.flush();
    expect(items(f)).toHaveLength(10);
    for (const c of f.mock.calls) expect(c[1].body.length).toBeLessThanOrEqual(queue.MAX_BATCH_BYTES);
  });

  it('splits a batch the collector rejects (400) so one bad item cannot discard the rest', async () => {
    const f = collector((_n, _u, init) => {
      const body = JSON.parse(init.body);
      return body.errors.some((i) => i.message === 'bad') ? { status: 400, body: { error: 'Invalid request body' } } : { status: 200 };
    });
    await err.captureException(boom('ok1'));
    await err.captureException(boom('bad'));
    await err.captureException(boom('ok2'));
    await err.flush();
    await tick(30000);
    const accepted = f.mock.calls
      .filter((c) => !JSON.parse(c[1].body).errors.some((i) => i.message === 'bad'))
      .flatMap((c) => JSON.parse(c[1].body).errors.map((i) => i.message));
    expect(accepted.sort()).toEqual(['ok1', 'ok2']);
    expect(queue.getErrorQueueStats().rejected).toBe(1);
  });

  it('retries a 408 instead of dropping it', async () => {
    const f = collector((n) => (n === 0 ? { status: 408 } : { status: 200 }));
    await err.captureException(boom('a'));
    await tick(5000);
    await tick(30000);
    expect(f).toHaveBeenCalledTimes(2);
    expect(queue.getErrorQueueStats().rejected).toBe(0);
  });

  it('uses keepalive for ordinary batches that fit the budget, so a send in flight survives unload', async () => {
    const f = collector();
    await err.captureException(boom('a'));
    await tick(5000);
    expect(f.mock.calls[0][1].keepalive).toBe(true);
  });

  it('still sends at page teardown during a transport-failure backoff, but not during a 429 pause', async () => {
    queue.installErrorQueueLifecycle();
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', f);
    await err.captureException(boom('a'));
    await tick(5000); // fails -> backoff
    globalThis.dispatchEvent(new Event('pagehide'));
    await tick(0);
    expect(f).toHaveBeenCalledTimes(2);

    queue._resetErrorQueue();
    queue.installErrorQueueLifecycle();
    const g = collector((n) => (n === 0 ? { status: 429, body: { retryAfterMs: 120000 } } : { status: 200 }));
    await err.captureException(boom('b'));
    await tick(5000);
    globalThis.dispatchEvent(new Event('pagehide'));
    await tick(0);
    expect(g).toHaveBeenCalledTimes(1);
  });

  it('sends a full first report again if the original was dropped before delivery', async () => {
    const f = collector((n) => (n < 6 ? { status: 503 } : { status: 200 }));
    err.addBreadcrumb('crumb');
    await err.captureException(boom('a'));
    await err.flush();
    await tick(10 * 60 * 1000); // retries exhausted -> dropped
    expect(queue.getErrorQueueStats().dropped).toBe(1);
    await err.captureException(boom('a'));
    await err.flush();
    await tick(10 * 60 * 1000);
    const last = items(f).at(-1);
    expect(last.tags.mf_repeat).toBeUndefined();
    expect(last.breadcrumbs).toHaveLength(1);
  });

  it('sends queued reports under the game they were captured for, even after re-init with another game', async () => {
    const OTHER = '1c9e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
    const f = collector();
    await err.captureException(boom('a'));
    core.init({ gameId: OTHER, appVersion: '2.1.0', buildNumber: '42' });
    await err.captureException(boom('b'));
    await err.flush();
    const byGame = Object.fromEntries(batches(f).map((b) => [b.game, b.errors.map((i) => i.message)]));
    expect(byGame).toEqual({ [GAME]: ['a'], [OTHER]: ['b'] });
  });
});
