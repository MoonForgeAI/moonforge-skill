import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';
import * as ctx from '../../skills/moonforge-implement/assets/moonforge-sdk/context.js';
import * as err from '../../skills/moonforge-implement/assets/moonforge-sdk/errors.js';

function lastBody(f) { return JSON.parse(f.mock.calls.at(-1)[1].body); }
function mockErr() { const f = vi.fn(async () => ({ ok: true, status: 200 })); vi.stubGlobal('fetch', f); return f; }

beforeEach(() => { core.resetAll(); ctx.clearGameState(); err.clearBreadcrumbs(); err.clearUser(); core.init({ gameId: 'g-1', appVersion: '2.1.0', buildNumber: '42' }); });

describe('errors', () => {
  it('captureException posts the required error envelope', async () => {
    const f = mockErr();
    ctx.setGameState({ sceneName: 'Arena' });
    err.setUser('u-9', { email: 'a@b.co' });
    await err.captureException(new TypeError('boom'), { tags: { area: 'inventory' } });
    const b = lastBody(f);
    expect(b.type).toBe('error');
    expect(b.payload).toMatchObject({
      game: 'g-1', errorType: 'exception', errorCategory: 'handled', errorLevel: 'error',
      message: 'boom', exceptionClass: 'TypeError', appVersion: '2.1.0', buildNumber: '42', userId: 'u-9',
    });
    expect(b.payload.device.platform).toBe('web');
    expect(Array.isArray(b.payload.frames)).toBe(true);
    expect(b.payload.gameState).toMatchObject({ sceneName: 'Arena' });
    expect(b.payload.tags).toMatchObject({ email: 'a@b.co', area: 'inventory' });
  });

  it('captureMessage uses errorType custom', async () => {
    const f = mockErr();
    await err.captureMessage('heads up', { level: 'warning' });
    const b = lastBody(f);
    expect(b.payload).toMatchObject({ errorType: 'custom', errorCategory: 'handled', errorLevel: 'warning', message: 'heads up' });
  });

  it('captureNetworkError uses errorType network + networkRequest', async () => {
    const f = mockErr();
    await err.captureNetworkError('https://api.x/y', { method: 'POST', statusCode: 500, durationMs: 120 });
    const b = lastBody(f);
    expect(b.payload.errorType).toBe('network');
    expect(b.payload.networkRequest).toMatchObject({ url: 'https://api.x/y', method: 'POST', statusCode: 500, durationMs: 120 });
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
    expect(typeof JSON.parse(f.mock.calls.at(-1)[1].body).payload.message).toBe('string');
  });

  it('parses Firefox/Safari style stack frames', async () => {
    const f = mockErr();
    const e = new Error('x');
    e.stack = 'x@https://game.example/app.js:10:5\n@https://game.example/app.js:20:1';
    await err.captureException(e);
    const frames = JSON.parse(f.mock.calls.at(-1)[1].body).payload.frames;
    expect(frames.length).toBe(2);
    expect(frames[0]).toMatchObject({ function: 'x', filename: 'https://game.example/app.js', lineno: 10, colno: 5 });
    expect(frames[1].function).toBe('<anonymous>');
  });
});
