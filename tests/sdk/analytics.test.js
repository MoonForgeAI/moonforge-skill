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
