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

  it('collectAutoFields carries the query string in url - the collector parses utm_*/click-IDs from it', () => {
    vi.stubGlobal('location', { pathname: '/play', search: '?utm_source=test123', hash: '#stage-2' });
    expect(core.collectAutoFields().url).toBe('/play?utm_source=test123#stage-2');
  });

  it('collectAutoFields carries appVersion from init, with no fabricated default', () => {
    expect(core.collectAutoFields().appVersion).toBeUndefined(); // no appVersion passed in beforeEach

    core.init({ gameId: 'g-1', appVersion: '2.3.1' });
    expect(core.collectAutoFields()).toMatchObject({ appVersion: '2.3.1' });
  });

  it('postEvent uses fetch(keepalive), captures + replays the cache token', async () => {
    core.markIdentified(); // this test is about delivery, not the pre-identify buffer
    const fetchMock = mockFetchOk('tok_abc');
    await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'x' } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true, method: 'POST' });
    await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'y' } });
    expect(fetchMock.mock.calls[1][1].headers['x-moonforge-cache']).toBe('tok_abc');
  });

  describe('pre-identify buffering', () => {
    beforeEach(() => { core.resetBuffering(); });

    it('holds events until identify, then rewrites them to the real id and flushes', async () => {
      const fetchMock = mockFetchOk();
      await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'level_start' } });
      expect(fetchMock).not.toHaveBeenCalled(); // buffered, not sent yet

      core.setDistinctId('real-user-1');
      core.markIdentified();
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.payload.name).toBe('level_start');
      expect(body.payload.id).toBe('real-user-1'); // rewritten from whatever anon id it had
    });

    it('flushes anonymously after the grace period if identify never comes', async () => {
      vi.useFakeTimers();
      try {
        const fetchMock = mockFetchOk();
        const anonId = core.getDistinctId();
        await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'level_start' } });
        expect(fetchMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(10000); // IDENTIFY_GRACE_MS

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.payload.id).toBe(anonId); // never identified -> sent under the anonymous id
      } finally {
        vi.useRealTimers();
      }
    });

    it('identify and alias are never buffered, even before identify has resolved', async () => {
      const fetchMock = mockFetchOk();
      await core.postEvent({ type: 'identify', payload: { game: 'g-1', id: 'real-user-1' } });
      await core.postEvent({ type: 'alias', payload: { game: 'g-1', id: 'real-user-1', previous_id: 'anon-1' } });
      expect(fetchMock).toHaveBeenCalledTimes(2); // both sent immediately, not queued
    });
  });

  describe('isFirstOpen', () => {
    it('is true before any distinct_id exists, and false forever after', () => {
      localStorage.clear(); // the outer beforeEach's resetAll() already assigns one
      expect(core.isFirstOpen()).toBe(true);
      core.getDistinctId(); // creates one, as a side effect
      expect(core.isFirstOpen()).toBe(false);
    });
  });

  describe('checkAppUpdate', () => {
    it('establishes the baseline silently on a device with no stored version yet - that is first_open\'s moment, not this one', () => {
      core.init({ gameId: 'g-1', appVersion: '1.0.0' }); // a configured appVersion, but nothing stored yet
      expect(core.checkAppUpdate()).toBeUndefined();
    });

    it('fires (returns the previous version) only when a stored version differs from the current one', () => {
      core.init({ gameId: 'g-1', appVersion: '1.0.0' });
      core.checkAppUpdate(); // establishes baseline: 1.0.0
      core.init({ gameId: 'g-1', appVersion: '1.0.0' });
      expect(core.checkAppUpdate()).toBeUndefined(); // unchanged -> no fire

      core.init({ gameId: 'g-1', appVersion: '1.1.0' });
      expect(core.checkAppUpdate()).toBe('1.0.0'); // changed -> fires once
      expect(core.checkAppUpdate()).toBeUndefined(); // baseline now updated -> quiet again
    });

    it('does nothing without a configured appVersion, rather than comparing against an empty string', () => {
      core.init({ gameId: 'g-1' }); // no appVersion
      expect(core.checkAppUpdate()).toBeUndefined();
    });
  });

  describe('prepareSessionStart (session chaining)', () => {
    it('has no previous_session_id on a brand-new session', () => {
      const data = core.prepareSessionStart();
      expect(data.session_id).toBeTruthy();
      expect(data).not.toHaveProperty('previous_session_id');
    });

    it('chains to the prior session_id after the inactivity timeout, not before', () => {
      const first = core.prepareSessionStart();

      const second = core.prepareSessionStart(); // called again immediately -> same session
      expect(second.session_id).toBe(first.session_id);
      expect(second).not.toHaveProperty('previous_session_id');

      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(31 * 60 * 1000); // past SESSION_TIMEOUT_MS
        const third = core.prepareSessionStart();
        expect(third.session_id).not.toBe(first.session_id);
        expect(third.previous_session_id).toBe(first.session_id);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('falls back to fetch when sendBeacon returns false', async () => {
    const fetchMock = mockFetchOk();
    const beacon = vi.fn(() => false); // e.g. beacon queue full
    vi.stubGlobal('navigator', { ...globalThis.navigator, sendBeacon: beacon });
    const ok = await core.postEvent({ type: 'event', payload: { game: 'g-1', name: 'session_end' } }, { beacon: true });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // soft failure -> fetch fallback
    expect(ok).toBe(true);
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
