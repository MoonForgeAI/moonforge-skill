import { afterEach, beforeEach, vi } from 'vitest';

// The SDK stashes re-entrancy guards on globalThis (see index.js). These
// must not leak between tests, or later tests silently inherit state (e.g.
// a session span left "active") from an earlier test and the suite becomes
// order-dependent.
function resetSdkGlobals() {
  delete globalThis.__mfSessionActive;
  delete globalThis.__mfFetchWrapped;
  delete globalThis.__mfSessionEnded;
}

beforeEach(() => {
  resetSdkGlobals();
});

// Reset localStorage and mocks between tests.
afterEach(() => {
  try { globalThis.localStorage?.clear(); } catch { /* ignore */ }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetSdkGlobals();
});

// Helper: a fetch mock that echoes a cache token, importable by tests.
export function mockFetchOk(cache = 'tok_1') {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ cache, sessionId: 's', visitId: 'v' }),
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
