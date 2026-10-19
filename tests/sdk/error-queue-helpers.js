// Shared fixtures for the error-queue test files.
import { afterEach, beforeEach, vi } from 'vitest';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';
import * as ctx from '../../skills/moonforge-implement/assets/moonforge-sdk/context.js';
import * as err from '../../skills/moonforge-implement/assets/moonforge-sdk/errors.js';
import * as queue from '../../skills/moonforge-implement/assets/moonforge-sdk/error-queue.js';

export { core, ctx, err, queue };
export const GAME = '0b8f4c1e-7d6a-4a51-9b2c-3e5f6a7b8c9d';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Collector stub: `respond(n, url, init)` returns {status, body} for the n-th call (0-based). */
export function collector(respond = () => ({ status: 200, body: { status: 'accepted' } })) {
  const f = vi.fn(async (url, init) => {
    const { status, body } = respond(f.mock.calls.length - 1, url, init);
    return { ok: status >= 200 && status < 300, status, json: async () => body ?? {} };
  });
  vi.stubGlobal('fetch', f);
  return f;
}
export const batches = (f) => f.mock.calls.map((c) => JSON.parse(c[1].body));
export const items = (f) => batches(f).flatMap((b) => b.errors);
export const tick = async (ms) => { await vi.advanceTimersByTimeAsync(ms); };

export function boom(msg = 'boom', line = 10) {
  const e = new TypeError(msg);
  e.stack = `TypeError: ${msg}\n    at load (https://g.example/app.js:${line}:5)`;
  return e;
}

/** Registers the per-test reset: fake timers, fresh SDK state, initialised for GAME. */
export function useErrorQueueFixture() {
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
}
