import { beforeEach, describe, expect, it, vi } from 'vitest';

async function fresh() {
  vi.resetModules();
  return import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
}

/** Stubs fetch and returns the mock, for tests that just need to inspect what got sent. */
function mockInit() {
  const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  vi.stubGlobal('fetch', f);
  return f;
}

beforeEach(() => { try { localStorage.clear(); } catch {} });

describe('index wiring', () => {
  it('init tracks session_start and exposes globals', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ cache: 't' }) }));
    vi.stubGlobal('fetch', f);
    const sdk = await fresh();
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1' });
    // session_start is held in the pre-identify buffer until identified -
    // release it, the same as a game would once its login round trip resolves.
    sdk.MoonForgeAnalytics.markIdentified();
    await Promise.resolve();
    const names = f.mock.calls.map((c) => JSON.parse(c[1].body).payload.name);
    expect(names).toContain('session_start');
    expect(globalThis.MoonForgeAnalytics).toBe(sdk.MoonForgeAnalytics);
    expect(globalThis.MoonForgeErrorTracker).toBe(sdk.MoonForgeErrorTracker);
  });

  it('auto-captures an unhandled error event', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal('fetch', f);
    const sdk = await fresh();
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1' });
    globalThis.dispatchEvent(new ErrorEvent('error', { error: new Error('kaboom'), message: 'kaboom' }));
    await sdk.MoonForgeErrorTracker.flush();
    const hitErrors = f.mock.calls.some((c) => String(c[0]).endsWith('/api/errors/batch'));
    expect(hitErrors).toBe(true);
  });

  it('MoonForgeErrorTracker exposes game-state setters', async () => {
    const sdk = await fresh();
    expect(typeof sdk.MoonForgeErrorTracker.setGameState).toBe('function');
    expect(typeof sdk.MoonForgeErrorTracker.setGameStateData).toBe('function');
  });

  it('fetch interceptor reads the URL from a URL object (not undefined)', async () => {
    vi.resetModules();
    const bodies = [];
    const orig = vi.fn(async (input, init) => {
      const u = typeof input === 'string' ? input : (input?.href ?? input?.url ?? String(input));
      const isErrors = u.endsWith('/api/errors/batch');
      if (isErrors) bodies.push(JSON.parse(init.body));
      return { ok: isErrors, status: isErrors ? 200 : 500, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', orig);
    const sdk = await import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1', trackNetworkErrors: true });
    await globalThis.fetch(new URL('https://api.game.example/data'));
    await sdk.MoonForgeErrorTracker.flush();
    expect(bodies.length).toBe(1);
    expect(bodies[0].errors[0].networkRequest.url).toBe('https://api.game.example/data');
  });

  it('session_end re-arms: hidden fires end, returning visible re-starts, pagehide ends again', async () => {
    vi.resetModules();
    const bodies = [];
    const f = vi.fn(async (_u, init) => { bodies.push(JSON.parse(init.body).payload.name); return { ok: true, status: 200, json: async () => ({}) }; });
    vi.stubGlobal('fetch', f);
    // jsdom visibilityState is 'visible' by default; make it controllable
    let vis = 'visible';
    Object.defineProperty(globalThis.document, 'visibilityState', { configurable: true, get: () => vis });
    const sdk = await import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1' });
    // Release the pre-identify buffer so session events send immediately,
    // same as any other test exercising session lifecycle end-to-end.
    sdk.MoonForgeAnalytics.markIdentified();
    await Promise.resolve();
    vis = 'hidden'; globalThis.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    vis = 'visible'; globalThis.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    globalThis.dispatchEvent(new Event('pagehide')); await Promise.resolve();
    const starts = bodies.filter((n) => n === 'session_start').length;
    const ends = bodies.filter((n) => n === 'session_end').length;
    expect(starts).toBe(2);   // init + re-visible
    expect(ends).toBe(2);     // hidden + pagehide
  });

  it('first_open fires once on a device\'s first-ever init, never again after', async () => {
    const f = mockInit();
    const sdk = await fresh();
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1', appVersion: '1.0.0' });
    sdk.MoonForgeAnalytics.markIdentified();
    await Promise.resolve();
    const namesFirstInit = f.mock.calls.map((c) => JSON.parse(c[1].body).payload.name);
    expect(namesFirstInit).toContain('first_open');
    expect(namesFirstInit.filter((n) => n === 'first_open').length).toBe(1);

    // Same device, a later launch (module re-imported, but localStorage - and
    // so the distinct_id - persists): must not fire again.
    f.mockClear();
    vi.resetModules();
    const sdk2 = await import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
    sdk2.MoonForgeAnalytics.init({ gameId: 'g-1', appVersion: '1.0.0' });
    sdk2.MoonForgeAnalytics.markIdentified();
    await Promise.resolve();
    const namesSecondInit = f.mock.calls.map((c) => JSON.parse(c[1].body).payload.name);
    expect(namesSecondInit).not.toContain('first_open');
  });

  it('app_update fires on a later init with a different appVersion, not on the first-ever one', async () => {
    const f = mockInit();
    const sdk = await fresh();
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1', appVersion: '1.0.0' });
    sdk.MoonForgeAnalytics.markIdentified();
    await Promise.resolve();
    const namesFirstInit = f.mock.calls.map((c) => JSON.parse(c[1].body).payload.name);
    expect(namesFirstInit).not.toContain('app_update'); // first-ever launch -> first_open's moment, not this one

    f.mockClear();
    vi.resetModules();
    const sdk2 = await import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
    sdk2.MoonForgeAnalytics.init({ gameId: 'g-1', appVersion: '1.1.0' }); // version changed
    sdk2.MoonForgeAnalytics.markIdentified();
    await Promise.resolve();
    const bodies = f.mock.calls.map((c) => JSON.parse(c[1].body));
    const update = bodies.find((b) => b.payload.name === 'app_update');
    expect(update).toBeTruthy();
    expect(update.payload.data.previous_version).toBe('1.0.0');
  });

  describe('fetch interceptor thresholds', () => {
    /** Game API answers with `status`; the collector always 200s. Returns the network reports sent. */
    async function run(status, opts = {}, input = 'https://api.game.example/save?x=1') {
      vi.resetModules();
      delete globalThis.__mfFetchWrapped; // each run installs a fresh interceptor
      const reports = [];
      vi.stubGlobal('fetch', vi.fn(async (u, init) => {
        const url = typeof u === 'string' ? u : (u?.href ?? u?.url);
        if (url.endsWith('/api/errors/batch')) {
          reports.push(...JSON.parse(init.body).errors);
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (status instanceof Error) throw status;
        return { ok: status < 400, status, json: async () => ({}) };
      }));
      const sdk = await import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
      sdk.MoonForgeAnalytics.init({ gameId: 'g-1', trackNetworkErrors: true, ...opts });
      try { await globalThis.fetch(input, { method: 'POST' }); } catch { /* rethrown to the game, by design */ }
      await sdk.MoonForgeErrorTracker.flush();
      return reports.filter((r) => r.errorType === 'network');
    }

    it('does not report 4xx responses by default', async () => {
      expect(await run(404)).toHaveLength(0);
      expect(await run(429)).toHaveLength(0);
    });

    it('reports 5xx responses by default', async () => {
      const [r] = await run(503);
      expect(r.networkRequest).toMatchObject({ method: 'POST', statusCode: 503 });
    });

    it('honours networkErrorMinStatus', async () => {
      expect(await run(404, { networkErrorMinStatus: 400 })).toHaveLength(1);
      expect(await run(503, { networkErrorMinStatus: 600 })).toHaveLength(0);
    });

    it('reports a fetch that throws, and still rethrows it to the game', async () => {
      const reports = await run(new TypeError('Failed to fetch'));
      expect(reports).toHaveLength(1);
      expect(reports[0].message).toContain('Failed to fetch');
    });

    it('does not report a request the game aborted itself', async () => {
      const abort = new Error('The operation was aborted.');
      abort.name = 'AbortError';
      expect(await run(abort)).toHaveLength(0);
    });

    it('never intercepts calls to the collector apiEndpoint', async () => {
      expect(await run(500, {}, 'https://collector.moonforge.co/api/send')).toHaveLength(0);
    });
  });

  it('MoonForgeErrorTracker exposes queue stats for diagnostics', async () => {
    const sdk = await fresh();
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1' });
    expect(sdk.MoonForgeErrorTracker.getStats()).toMatchObject({ queued: 0, dropped: 0, suppressed: 0 });
  });
});
