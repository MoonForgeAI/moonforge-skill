import { describe, expect, it, vi } from 'vitest';
import { GAME, batches, boom, collector, core, err, items, queue, tick, useErrorQueueFixture } from './error-queue-helpers.js';

useErrorQueueFixture();

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

  it('keeps the TOTAL of all keepalive requests at teardown within one shared budget, leaving the rest queued', async () => {
    queue.installErrorQueueLifecycle();
    const f = collector();
    for (let i = 0; i < 5; i++) {
      const e = boom(`big${i}`);
      e.stack = `${e.stack}\n${'x'.repeat(25000)}`;
      await err.captureException(e);
    }
    globalThis.dispatchEvent(new Event('pagehide'));
    await tick(0);
    const keepalive = f.mock.calls.filter((c) => c[1].keepalive);
    expect(keepalive.length).toBeGreaterThan(0);
    const total = keepalive.reduce((n, c) => n + new TextEncoder().encode(c[1].body).length, 0);
    expect(total).toBeLessThanOrEqual(queue.KEEPALIVE_BUDGET_BYTES);
    expect(items(f).length).toBeLessThan(5);
    expect(queue.getErrorQueueStats().queued).toBe(5 - items(f).length);
  });

  it('slims a report that alone exceeds the keepalive budget instead of losing it', async () => {
    queue.installErrorQueueLifecycle();
    const f = collector();
    const e = boom('huge');
    e.stack = `${e.stack}\n${'x'.repeat(40000)}`;
    for (let j = 0; j < 50; j++) err.addBreadcrumb('b'.repeat(1000));
    await err.captureException(e);
    globalThis.dispatchEvent(new Event('pagehide'));
    await tick(0);
    const [item] = items(f);
    expect(item.message).toBe('huge');
    expect(item.breadcrumbs).toBeUndefined();
    expect(item.rawStackTrace).toBeUndefined();
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

  it('on a 400 naming specific items, drops only those and resends the rest once', async () => {
    const f = collector((_n, _u, init) => {
      const { errors } = JSON.parse(init.body);
      const bad = errors.map((e, i) => (e.message === 'bad' ? i : -1)).filter((i) => i >= 0);
      return bad.length
        ? { status: 400, body: { error: 'Invalid request body', details: bad.map((i) => ({ path: `errors.${i}.message`, message: 'x' })) } }
        : { status: 200 };
    });
    await err.captureException(boom('ok1'));
    await err.captureException(boom('bad'));
    await err.captureException(boom('ok2'));
    await err.flush();
    await tick(30000);
    expect(f).toHaveBeenCalledTimes(2); // the rejected batch, then the survivors - no per-item fan-out
    expect(batches(f)[1].errors.map((i) => i.message)).toEqual(['ok1', 'ok2']);
    expect(queue.getErrorQueueStats()).toMatchObject({ rejected: 1, queued: 0 });
  });

  it('on a request-wide 400 (unknown game), drops the whole batch without resending or splitting', async () => {
    const f = collector(() => ({ status: 400, body: { error: 'Game not found' } }));
    for (const m of ['a', 'b', 'c']) await err.captureException(boom(m));
    await err.flush();
    await tick(120000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(queue.getErrorQueueStats()).toMatchObject({ rejected: 3, queued: 0 });
  });

  it('on a 400 where every item is named (e.g. missing appVersion), sends nothing more', async () => {
    const f = collector((_n, _u, init) => {
      const { errors } = JSON.parse(init.body);
      return { status: 400, body: { error: 'Invalid request body', details: errors.map((_e, i) => ({ path: `errors.${i}.appVersion`, message: 'Required' })) } };
    });
    for (const m of ['a', 'b']) await err.captureException(boom(m));
    await err.flush();
    await tick(120000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(queue.getErrorQueueStats().rejected).toBe(2);
  });

  it('splits a 413 (body too large) into single reports', async () => {
    const f = collector((_n, _u, init) => (JSON.parse(init.body).errors.length > 1 ? { status: 413 } : { status: 200 }));
    for (const m of ['a', 'b']) await err.captureException(boom(m));
    await err.flush();
    await tick(30000);
    expect(items(f).slice(2).map((i) => i.message)).toEqual(['a', 'b']);
  });

  it('retries a 408 instead of dropping it', async () => {
    const f = collector((n) => (n === 0 ? { status: 408 } : { status: 200 }));
    await err.captureException(boom('a'));
    await tick(5000);
    await tick(30000);
    expect(f).toHaveBeenCalledTimes(2);
    expect(queue.getErrorQueueStats().rejected).toBe(0);
  });

  it('sends ordinary flushes without keepalive, keeping the shared keepalive budget for teardown', async () => {
    const f = collector();
    await err.captureException(boom('a'));
    await tick(5000);
    expect(f.mock.calls[0][1].keepalive).toBe(false);
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
