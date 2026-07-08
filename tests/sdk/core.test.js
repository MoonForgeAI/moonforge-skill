import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetchOk } from '../setup.js';
import * as core from '../../skills/moonforge-implement/assets/moonforge-sdk/core.js';

beforeEach(() => { core.resetAll(); core.init({ gameId: 'g-1', debug: false }); });

describe('core', () => {
  it('init requires gameId and normalizes endpoint', () => {
    core.resetAll();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    core.init({});               // missing gameId
    expect(core.isReady()).toBe(false);
    expect(warn).toHaveBeenCalled();
    core.init({ gameId: 'g-1', apiEndpoint: 'https://collector.moonforge.co/' });
    expect(core.getConfig().apiEndpoint).toBe('https://collector.moonforge.co');
  });

  it('persists a distinct id and a session id', () => {
    const d1 = core.getDistinctId();
    expect(d1).toMatch(/[0-9a-f-]{36}/);
    expect(core.getDistinctId()).toBe(d1);          // stable
    expect(core.getSessionId()).toMatch(/[0-9a-f-]{36}/);
  });

  it('collectAutoFields includes required analytics fields', () => {
    const f = core.collectAutoFields();
    expect(f).toMatchObject({ game: 'g-1' });
    expect(f).toHaveProperty('url'); expect(f).toHaveProperty('title');
    expect(f).toHaveProperty('screen'); expect(f).toHaveProperty('language');
    expect(f).toHaveProperty('hostname'); expect(typeof f.timestamp).toBe('number');
    expect(f.id).toBe(core.getDistinctId());
    // Collector's analytics pipeline 500s on millisecond timestamps — must be unix SECONDS.
    expect(f.timestamp).toBeLessThan(1e11);
    expect(f.timestamp).toBeGreaterThan(1e9);
  });

  it('postEvent uses fetch(keepalive), captures + replays the cache token', async () => {
    const fetchMock = mockFetchOk('tok_abc');
    await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'x' } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true, method: 'POST' });
    await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'y' } });
    expect(fetchMock.mock.calls[1][1].headers['x-moonforge-cache']).toBe('tok_abc');
  });

  it('postEvent uses sendBeacon when beacon:true', async () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...globalThis.navigator, sendBeacon: beacon });
    await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'session_end' } }, { beacon: true });
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it('user properties update immutably', () => {
    core.setUserProp('a', 1); core.setUserProp('b', 2);
    expect(core.getUserProps()).toEqual({ a: 1, b: 2 });
    core.removeUserProp('a');
    expect(core.getUserProps()).toEqual({ b: 2 });
    core.clearUserProps();
    expect(core.getUserProps()).toEqual({});
  });
});
