import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetchOk } from '../setup.js';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';
import * as a from '../../skills/moonforge-implement/assets/moonforge-sdk/analytics.js';

function lastBody(fetchMock) { return JSON.parse(fetchMock.mock.calls.at(-1)[1].body); }

beforeEach(() => { core.resetAll(); core.init({ gameId: 'g-1' }); });

describe('analytics', () => {
  it('trackEvent posts an event envelope with auto fields + merged user props', async () => {
    const f = mockFetchOk();
    a.setUserProperty('plan', 'pro');
    await a.trackEvent('level_start', { level: 3 });
    const b = lastBody(f);
    expect(b.type).toBe('event');
    expect(b.payload).toMatchObject({ game: 'g-1', name: 'level_start' });
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
    expect(b.payload).toMatchObject({ game: 'g-1', id: 'user-42', data: { tier: 'gold' } });
    expect(core.getDistinctId()).toBe('user-42');
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
