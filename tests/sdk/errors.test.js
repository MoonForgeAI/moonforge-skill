import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';
import * as ctx from '../../skills/moonforge-implement/assets/moonforge-sdk/context.js';
import * as err from '../../skills/moonforge-implement/assets/moonforge-sdk/errors.js';
import { _resetErrorQueue } from '../../skills/moonforge-implement/assets/moonforge-sdk/error-queue.js';

// Reports are queued and batched; flush, then return the newest item sent.
async function lastItem(f) {
  await err.flush();
  const b = JSON.parse(f.mock.calls.at(-1)[1].body);
  expect(f.mock.calls.at(-1)[0]).toMatch(/\/api\/errors\/batch$/);
  expect(b.type).toBe('error_batch');
  return b.errors.at(-1);
}
function mockErr() { const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })); vi.stubGlobal('fetch', f); return f; }

beforeEach(() => { core.resetAll(); ctx.clearGameState(); err.clearBreadcrumbs(); err.clearUser(); _resetErrorQueue(); core.init({ gameId: 'g-1', appVersion: '2.1.0', buildNumber: '42' }); });

describe('errors', () => {
  it('captureException posts the required error envelope', async () => {
    const f = mockErr();
    ctx.setGameState({ sceneName: 'Arena' });
    err.setUser('u-9', { email: 'a@b.co' });
    await err.captureException(new TypeError('boom'), { tags: { area: 'inventory' } });
    const item = await lastItem(f);
    expect(item).toMatchObject({
      errorType: 'exception', errorCategory: 'handled', errorLevel: 'error',
      message: 'boom', exceptionClass: 'TypeError', appVersion: '2.1.0', buildNumber: '42', userId: 'u-9',
    });
    expect(item.device.platform).toBe('web');
    expect(Array.isArray(item.frames)).toBe(true);
    expect(item.gameState).toMatchObject({ sceneName: 'Arena' });
    expect(item.tags).toMatchObject({ email: 'a@b.co', area: 'inventory' });
  });

  it('captureMessage uses errorType custom', async () => {
    const f = mockErr();
    await err.captureMessage('heads up', { level: 'warning' });
    const item = await lastItem(f);
    expect(item).toMatchObject({ errorType: 'custom', errorCategory: 'handled', errorLevel: 'warning', message: 'heads up' });
  });

  it('captureNetworkError uses errorType network + networkRequest', async () => {
    const f = mockErr();
    await err.captureNetworkError('https://api.x/y', { method: 'POST', statusCode: 500, durationMs: 120 });
    const item = await lastItem(f);
    expect(item.errorType).toBe('network');
    expect(item.networkRequest).toMatchObject({ url: 'https://api.x/y', method: 'POST', statusCode: 500, durationMs: 120 });
  });

  it('breadcrumb ring buffer caps at 50', () => {
    for (let i = 0; i < 60; i++) err.addBreadcrumb(`b${i}`);
    const bc = err.getBreadcrumbs();
    expect(bc.length).toBe(50);
    expect(bc[0].message).toBe('b10');
  });

  it('captureNetworkError coerces a non-string errorMessage without throwing', async () => {
    const f = mockErr();
    const r = await err.captureNetworkError('https://x/y', { method: 'GET', errorMessage: 12345 });
    expect(r).toBe(true);
    expect(typeof (await lastItem(f)).message).toBe('string');
  });

  it('parses Firefox/Safari style stack frames', async () => {
    const f = mockErr();
    const e = new Error('x');
    e.stack = 'x@https://game.example/app.js:10:5\n@https://game.example/app.js:20:1';
    await err.captureException(e);
    const { frames } = await lastItem(f);
    expect(frames.length).toBe(2);
    expect(frames[0]).toMatchObject({ function: 'x', filename: 'https://game.example/app.js', lineno: 10, colno: 5 });
    expect(frames[1].function).toBe('<anonymous>');
  });

  it('capture calls before init warn and return undefined instead of throwing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    core.resetAll();
    core.init({});
    expect(err.captureException(new Error('x'))).toBeUndefined();
  });

  it('a capture that cannot be serialised never throws into the game', async () => {
    mockErr();
    const weird = { toString() { throw new Error('nope'); } };
    await expect(err.captureException(weird)).resolves.toBe(false);
  });
});
