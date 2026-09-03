import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetchOk } from '../setup.js';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';
import * as a from '../../skills/moonforge-implement/assets/moonforge-sdk/analytics.js';

function lastBody(fetchMock) { return JSON.parse(fetchMock.mock.calls.at(-1)[1].body); }

// markIdentified() so trackEvent/trackScreenView deliver immediately in these
// tests, which are about envelope shape, not the pre-identify buffer -
// that behavior has its own dedicated tests in core.test.js.
beforeEach(() => { core.resetAll(); core.init({ gameId: 'g-1', appVersion: '3.1.4' }); core.markIdentified(); });

describe('analytics', () => {
  it('trackEvent posts an event envelope with auto fields + merged user props', async () => {
    const f = mockFetchOk();
    a.setUserProperty('plan', 'pro');
    await a.trackEvent('level_start', { level: 3 });
    const b = lastBody(f);
    expect(b.type).toBe('event');
    expect(b.payload).toMatchObject({ game: 'g-1', name: 'level_start', appVersion: '3.1.4' });
    expect(b.payload.data).toMatchObject({ plan: 'pro', level: 3 });
  });

  it('trackScreenView emits screen_view', async () => {
    const f = mockFetchOk();
    await a.trackScreenView('MainMenu');
    const b = lastBody(f);
    expect(b.payload.name).toBe('screen_view');
    expect(b.payload.data.screen_name).toBe('MainMenu');
  });

  it('identify posts an identify envelope and sets distinct id', async () => {
    const f = mockFetchOk();
    await a.identify('user-42', { tier: 'gold' });
    const b = lastBody(f);
    expect(b.type).toBe('identify');
    expect(b.payload).toMatchObject({ game: 'g-1', id: 'user-42', data: { tier: 'gold' }, appVersion: '3.1.4' });
    expect(core.getDistinctId()).toBe('user-42');
  });

  it('identify sends alias linking the anonymous id to the real one, before identify', async () => {
    const f = mockFetchOk();
    const anonId = core.getDistinctId();
    await a.identify('user-42', { tier: 'gold' });
    expect(f.mock.calls.length).toBe(2);
    const bodies = f.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].type).toBe('alias');
    expect(bodies[0].payload).toMatchObject({ game: 'g-1', id: 'user-42', previous_id: anonId });
    expect(bodies[1].type).toBe('identify');
  });

  it('does not re-alias on a subsequent identify (a normal login, not a new person)', async () => {
    const f = mockFetchOk();
    await a.identify('user-42', {});
    await a.identify('user-42', { plan: 'pro' }); // e.g. re-identify after a page reload
    const aliasCount = f.mock.calls.filter((c) => JSON.parse(c[1].body).type === 'alias').length;
    expect(aliasCount).toBe(1);
    expect(core.hasAliased()).toBe(true);
  });

  it('resetAll clears the aliased flag so a new anonymous id can be aliased again', async () => {
    const f = mockFetchOk();
    await a.identify('user-42', {});
    expect(core.hasAliased()).toBe(true);

    core.resetAll(); // e.g. logout on a shared device
    expect(core.hasAliased()).toBe(false);
    const anonId2 = core.getDistinctId();
    await a.identify('user-99', {});
    const aliases = f.mock.calls.map((c) => JSON.parse(c[1].body)).filter((b) => b.type === 'alias');
    expect(aliases.length).toBe(2);
    expect(aliases[1].payload).toMatchObject({ id: 'user-99', previous_id: anonId2 });
  });

  it('no-ops with a warning when not initialized', async () => {
    core.resetAll();
    // not calling init
    const warn = (await import('vitest')).vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Re-import a fresh module state is not needed; core.isReady() is false after resetAll without init
    core.init({});                    // invalid -> not ready
    await a.trackEvent('x');
    expect(warn).toHaveBeenCalled();
  });
});

// Locked revenue/economy catalog: same names/schemas across every game.
// Ported from pr-10's telemetry-helpers.test.js.
describe('locked revenue/economy helpers', () => {
  it('trackEconomyTransaction uses economy_transaction with the flat input/output schema', async () => {
    const f = mockFetchOk();
    a.trackEconomyTransaction({
      reason: 'upgrade_weapon',
      inputs: [{ type: 'gold', before: 500, after: 200 }],
      outputs: [{ type: 'weapon_t7', before: 0, after: 1 }],
    });
    await Promise.resolve();
    const b = lastBody(f);
    expect(b.payload.name).toBe('economy_transaction');
    expect(b.payload.data).toMatchObject({
      reason: 'upgrade_weapon',
      input_1_type: 'gold', input_1_before: 500, input_1_after: 200,
      output_1_type: 'weapon_t7', output_1_before: 0, output_1_after: 1,
    });
  });

  it('trackIapInitiated/trackIapCompleted use the locked iap_* names', async () => {
    const f = mockFetchOk();
    a.trackIapInitiated({ product_id: 'gems_100', price: 4.99, currency: 'USD', store: 'web' });
    a.trackIapCompleted({ product_id: 'gems_100', price: 4.99, currency: 'USD', transaction_id: 'tx-1', store: 'web' });
    await Promise.resolve();
    const bodies = f.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].payload.name).toBe('iap_initiated');
    expect(bodies[1].payload.name).toBe('iap_completed');
    expect(bodies[1].payload.data).toMatchObject({ transaction_id: 'tx-1', store: 'web' });
  });

  it('trackEconomyTransaction warns and keeps the first 3 slots when given more', async () => {
    const f = mockFetchOk();
    const warn = (await import('vitest')).vi.spyOn(console, 'warn').mockImplementation(() => {});
    a.trackEconomyTransaction({
      reason: 'open_bundle',
      outputs: [1, 2, 3, 4, 5].map((n) => ({ type: `item_${n}`, before: 0, after: 1 })),
    });
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only 3 slots'));
    const d = lastBody(f).payload.data;
    expect(d.output_3_type).toBe('item_3');
    expect(d.output_4_type).toBeUndefined();
    warn.mockRestore();
  });

  it('locked iap/tutorial/account helpers forward extra properties', async () => {
    const f = mockFetchOk();
    a.trackIapInitiated({ product_id: 'p1', price: 1, currency: 'USD', promo: 'launch' });
    a.trackTutorialComplete({ outcome: 'completed', tutorial_id: 'onboarding_v2' });
    a.trackAccountCreated({ signup_method: 'email', ab_bucket: 'B' });
    await Promise.resolve();
    const bodies = f.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].payload.data).toMatchObject({ product_id: 'p1', promo: 'launch' });
    expect(bodies[1].payload.data).toMatchObject({ outcome: 'completed', tutorial_id: 'onboarding_v2' });
    expect(bodies[2].payload.data).toMatchObject({ signup_method: 'email', ab_bucket: 'B' });
  });

  it('trackAdStarted/trackAdCompleted/trackAdImpression use the locked ad_* names', async () => {
    const f = mockFetchOk();
    a.trackAdStarted({ ad_type: 'rewarded', placement: 'level_end' });
    a.trackAdCompleted({ ad_type: 'rewarded', placement: 'level_end', watched_fraction: 1, rewarded: true });
    a.trackAdImpression({ ad_type: 'banner', placement: 'home' });
    await Promise.resolve();
    const names = f.mock.calls.map((c) => JSON.parse(c[1].body).payload.name);
    expect(names).toEqual(['ad_started', 'ad_completed', 'ad_impression']);
  });
});

describe('tutorial_start / tutorial_complete', () => {
  it('trackTutorialStart/trackTutorialComplete send the locked names, outcome optional', async () => {
    const f = mockFetchOk();
    a.trackTutorialStart();
    a.trackTutorialComplete({ outcome: 'skipped' });
    await Promise.resolve();
    const bodies = f.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].payload.name).toBe('tutorial_start');
    expect(bodies[1].payload.name).toBe('tutorial_complete');
    expect(bodies[1].payload.data.outcome).toBe('skipped');
  });
});

describe('account_created', () => {
  it('trackAccountCreated sends signup_method (required) and provider (optional)', async () => {
    const f = mockFetchOk();
    a.trackAccountCreated({ signup_method: 'social', provider: 'google' });
    await Promise.resolve();
    const b = lastBody(f);
    expect(b.payload.name).toBe('account_created');
    expect(b.payload.data).toMatchObject({ signup_method: 'social', provider: 'google' });
  });

  it('omits provider when not given, rather than sending it empty', async () => {
    const f = mockFetchOk();
    a.trackAccountCreated({ signup_method: 'email' });
    await Promise.resolve();
    const b = lastBody(f);
    expect(b.payload.data).toEqual({ signup_method: 'email' });
  });
});
