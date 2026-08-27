import { beforeEach, describe, expect, it, vi } from 'vitest';

async function freshAnalytics() {
  vi.resetModules();
  const core = await import('../../skills/moonforge-implement/assets/moonforge-sdk/core.js');
  const analytics = await import('../../skills/moonforge-implement/assets/moonforge-sdk/analytics.js');
  return { core, analytics };
}

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

describe('locked event helpers', () => {
  it('trackEconomyTransaction uses economy_transaction with flat schema', async () => {
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_u, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({}) };
    }));
    const { core, analytics } = await freshAnalytics();
    core.init({ gameId: '550e8400-e29b-41d4-a716-446655440000', appVersion: '1.0.0' });
    core.markIdentified();
    analytics.trackEconomyTransaction({
      reason: 'upgrade_weapon',
      inputs: [{ type: 'gold', before: 500, after: 200 }],
      outputs: [{ type: 'weapon_t7', before: 0, after: 1 }],
    });
    await Promise.resolve();
    const evt = bodies.find((b) => b.payload.name === 'economy_transaction');
    expect(evt.payload.data.reason).toBe('upgrade_weapon');
    expect(evt.payload.data.input_1_type).toBe('gold');
    expect(evt.payload.data.output_1_after).toBe(1);
  });

  it('trackIapCompleted uses locked iap_completed name', async () => {
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_u, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({}) };
    }));
    const { core, analytics } = await freshAnalytics();
    core.init({ gameId: '550e8400-e29b-41d4-a716-446655440000', appVersion: '1.0.0' });
    core.markIdentified();
    analytics.trackIapCompleted({
      product_id: 'gems_100', price: 4.99, currency: 'USD', transaction_id: 'tx-1', store: 'web',
    });
    await Promise.resolve();
    const evt = bodies.find((b) => b.payload.name === 'iap_completed');
    expect(evt.payload.data.transaction_id).toBe('tx-1');
    expect(evt.payload.data.store).toBe('web');
  });
});

describe('session_start client context', () => {
  it('includes timezone on session_start', async () => {
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_u, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({}) };
    }));
    vi.stubGlobal('location', { search: '?utm_source=test', pathname: '/', hash: '' });
    const { core, analytics } = await freshAnalytics();
    core.init({ gameId: '550e8400-e29b-41d4-a716-446655440000', appVersion: '1.0.0' });
    core.markIdentified();
    analytics.trackSessionStart();
    await Promise.resolve();
    const evt = bodies.find((b) => b.payload.name === 'session_start');
    expect(evt.payload.data.session_id).toBeTruthy();
    expect(evt.payload.data.timezone).toBeTruthy();
    expect(evt.payload.data.utm_source).toBe('test');
  });
});
