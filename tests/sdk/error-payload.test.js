import { describe, expect, it } from 'vitest';
import { clipPayload } from '../../skills/moonforge-implement/assets/moonforge-sdk/error-payload.js';
import { boom, collector, ctx, err, items, useErrorQueueFixture } from './error-queue-helpers.js';

useErrorQueueFixture();

// The collector validates every string field with zod; a number where a string
// is expected (or an out-of-enum value) 400s every report from that player.
describe('error payload coercion to the collector schema', () => {
  it('stringifies numeric game state set by the game', async () => {
    const f = collector();
    ctx.setGameState({ levelId: 3, sceneName: 7, gameMode: 1 });
    await err.captureException(boom());
    await err.flush();
    expect(items(f)[0].gameState).toMatchObject({ levelId: '3', sceneName: '7', gameMode: '1' });
  });

  it('stringifies a numeric user id', async () => {
    const f = collector();
    err.setUser(12345);
    await err.captureException(boom());
    await err.flush();
    expect(items(f)[0].userId).toBe('12345');
  });

  it('replaces an out-of-enum errorCategory with the default', async () => {
    const f = collector();
    await err.captureException(boom(), { category: 'oops' });
    await err.flush();
    expect(items(f)[0].errorCategory).toBe('handled');
  });

  it('keeps valid errorCategory values', async () => {
    const f = collector();
    await err.captureException(boom(), { category: 'unhandled' });
    await err.flush();
    expect(items(f)[0].errorCategory).toBe('unhandled');
  });

  it('coerces network request fields supplied by the game', async () => {
    const f = collector();
    await err.captureNetworkError('https://api.g.example/x', { method: 7, statusCode: '503', durationMs: -5 });
    await err.flush();
    const { networkRequest } = items(f)[0];
    expect(networkRequest).toMatchObject({ method: '7', statusCode: 503 });
    expect(networkRequest).not.toHaveProperty('durationMs');
  });

  it('coerces every other string field and validates enums (unit)', () => {
    const out = clipPayload({
      errorType: 'weird', errorCategory: 'oops', errorLevel: 'loud',
      message: 42, exceptionClass: 9, appVersion: 2, buildNumber: 17, userId: 5, rawStackTrace: 1,
      device: { platform: 'web', osVersion: 10, deviceModel: 11, manufacturer: 12, cpuArchitecture: 13 },
      network: { type: 'wifi', carrier: 14, effectiveType: 15 },
      frames: [{ function: 1, filename: 2, module: 3, package: 4, lineno: 5.5, colno: -1 }],
      breadcrumbs: [{ type: 'user', level: 'info', message: 6, category: 7, timestamp: 1.5 }],
      timestamp: 1700000000.7,
    });
    expect(out).toMatchObject({
      errorType: 'custom', errorCategory: 'handled', errorLevel: 'error',
      message: '42', exceptionClass: '9', appVersion: '2', buildNumber: '17', userId: '5', rawStackTrace: '1',
      device: { osVersion: '10', deviceModel: '11', manufacturer: '12', cpuArchitecture: '13' },
      network: { carrier: '14', effectiveType: '15' },
      breadcrumbs: [{ message: '6', category: '7', timestamp: 1 }],
      timestamp: 1700000000,
    });
    expect(out.frames[0]).toEqual({ function: '1', filename: '2', module: '3', package: '4' });
  });
});
