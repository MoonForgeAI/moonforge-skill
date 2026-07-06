import { beforeEach, describe, expect, it, vi } from 'vitest';

async function fresh() {
  vi.resetModules();
  return import('../../skills/moonforge-implement/assets/moonforge-sdk/index.js');
}

beforeEach(() => { try { localStorage.clear(); } catch {} });

describe('index wiring', () => {
  it('init tracks session_start and exposes globals', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ cache: 't' }) }));
    vi.stubGlobal('fetch', f);
    const sdk = await fresh();
    sdk.MoonForgeAnalytics.init({ gameId: 'g-1' });
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
    await Promise.resolve(); await Promise.resolve();
    const hitErrors = f.mock.calls.some((c) => String(c[0]).endsWith('/api/errors'));
    expect(hitErrors).toBe(true);
  });

  it('MoonForgeErrorTracker exposes game-state setters', async () => {
    const sdk = await fresh();
    expect(typeof sdk.MoonForgeErrorTracker.setGameState).toBe('function');
    expect(typeof sdk.MoonForgeErrorTracker.setGameStateData).toBe('function');
  });
});
