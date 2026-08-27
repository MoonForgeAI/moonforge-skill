import { beforeEach, describe, expect, it, vi } from 'vitest';

async function freshCapture() {
  vi.resetModules();
  return import('../../skills/moonforge-implement/assets/moonforge-sdk/context-capture.js');
}

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  vi.stubGlobal('location', { search: '', pathname: '/', hash: '' });
});

describe('context-capture', () => {
  it('collects timezone without permissions', async () => {
    const mod = await freshCapture();
    expect(mod.getTimezone()).toBeTruthy();
    const ctx = mod.collectClientContext();
    expect(ctx.timezone).toBeTruthy();
  });

  it('parses UTM from URL and persists first-touch', async () => {
    vi.stubGlobal('location', { search: '?utm_source=newsletter&utm_campaign=launch', pathname: '/' });
    const mod = await freshCapture();
    const first = mod.collectAttribution();
    expect(first.utm_source).toBe('newsletter');
    expect(first.utm_campaign).toBe('launch');
    expect(first.attr_touch).toBe('last');

    vi.stubGlobal('location', { search: '', pathname: '/' });
    const second = mod.collectAttribution();
    expect(second.first_utm_source).toBe('newsletter');
    expect(second.first_utm_campaign).toBe('launch');
  });
});
