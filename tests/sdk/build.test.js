import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const OUT = 'skills/moonforge-implement/assets/moonforge-sdk/moonforge.global.js';

describe('global build', () => {
  it('produces an import/export-free bundle exposing working globals', () => {
    execFileSync('node', ['scripts/build-sdk.mjs'], { stdio: 'pipe' });
    const src = readFileSync(OUT, 'utf8');
    // No ES-module syntax survives in the bundle.
    expect(src).not.toMatch(/^\s*import[\s{]/m);
    expect(src).not.toMatch(/^\s*export[\s{]/m);
    expect(src).toContain('/api/send');
    expect(src).toContain('/api/errors');
    // Executing the bundle attaches working globals (proves the bundle is valid).
    delete globalThis.MoonForgeAnalytics;
    delete globalThis.MoonForgeErrorTracker;
    new Function(src)();
    expect(typeof globalThis.MoonForgeAnalytics.init).toBe('function');
    expect(typeof globalThis.MoonForgeAnalytics.trackEvent).toBe('function');
    expect(typeof globalThis.MoonForgeErrorTracker.captureException).toBe('function');
    expect(typeof globalThis.MoonForgeErrorTracker.setGameState).toBe('function');
  });
});
