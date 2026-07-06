import { afterEach, vi } from 'vitest';

// Reset localStorage and mocks between tests.
afterEach(() => {
  try { globalThis.localStorage?.clear(); } catch { /* ignore */ }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
