import { describe, expect, it, vi } from 'vitest';
import { GAME, UUID_RE, batches, boom, collector, core, err, items, queue, tick, useErrorQueueFixture } from './error-queue-helpers.js';

useErrorQueueFixture();

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

describe('error queue: cap persistence and repeat payloads', () => {
  it('keeps the per-session report count across a page reload in the same session', async () => {
    core.init({ gameId: GAME, appVersion: '2.1.0', buildNumber: '42', maxErrorReportsPerSession: 2 });
    const f = collector();
    await err.captureException(boom('a'));
    await err.captureException(boom('b'));
    await err.flush();
    queue._resetErrorQueue(); // in-memory state gone, as after a reload; storage + session id survive
    await err.captureException(boom('c'));
    await err.flush();
    expect(items(f).map((i) => i.message)).toEqual(['a', 'b']);
    expect(queue.getErrorQueueStats()).toMatchObject({ distinctReported: 2, suppressed: 1 });
  });

  it('still keeps the count when localStorage refuses access', async () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, clear() {} });
    core.init({ gameId: GAME, appVersion: '2.1.0', buildNumber: '42', maxErrorReportsPerSession: 1 });
    const f = collector();
    await err.captureException(boom('a'));
    await err.flush();
    queue._resetErrorQueue();
    await err.captureException(boom('b'));
    await err.flush();
    expect(items(f).map((i) => i.message)).toEqual(['a']);
  });

  it('repeat count reports carry neither breadcrumbs nor the raw stack trace', async () => {
    const f = collector();
    err.addBreadcrumb('crumb');
    await err.captureException(boom());
    await err.flush();
    await err.captureException(boom());
    await err.flush();
    const repeat = items(f)[1];
    expect(repeat.tags.mf_repeat).toBe('true');
    expect(repeat.breadcrumbs).toBeUndefined();
    expect(repeat.rawStackTrace).toBeUndefined();
    expect(repeat.frames.length).toBeGreaterThan(0);
  });
});

