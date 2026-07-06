import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ctx from '../../skills/moonforge-implement/assets/moonforge-sdk/context.js';

beforeEach(() => ctx.clearGameState());

describe('context', () => {
  it('device context has required non-empty platform/osVersion/deviceModel', () => {
    const d = ctx.getDeviceContext();
    expect(d.platform).toBe('web');
    expect(typeof d.osVersion).toBe('string'); expect(d.osVersion.length).toBeGreaterThan(0);
    expect(typeof d.deviceModel).toBe('string'); expect(d.deviceModel.length).toBeGreaterThan(0);
  });

  it('game state merges immutably and supports custom data', () => {
    ctx.setGameState({ sceneName: 'Arena', gameMode: 'Ranked' });
    ctx.setGameState({ levelId: '5' });          // merge, not replace
    ctx.setGameStateData('score', 1200);
    expect(ctx.getGameState()).toMatchObject({ sceneName: 'Arena', gameMode: 'Ranked', levelId: '5', customData: { score: 1200 } });
  });

  it('network context maps a known connection type', () => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, connection: { type: 'wifi', effectiveType: '4g' } });
    expect(ctx.getNetworkContext()).toEqual({ type: 'wifi', effectiveType: '4g' });
  });
});
