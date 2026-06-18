import { describe, expect, it } from 'vitest';
import { calculateSoulFireReward } from './MetaProgression';

describe('calculateSoulFireReward', () => {
  it('grants a small guaranteed settlement reward for short failed runs', () => {
    expect(calculateSoulFireReward({ time: 25, kills: 3, level: 1 })).toBeGreaterThanOrEqual(4);
  });

  it('uses run completion percentage instead of in-run shard balance', () => {
    const threeMinuteReward = calculateSoulFireReward({ time: 180, kills: 200, level: 8 });
    const victoryReward = calculateSoulFireReward({ time: 900, kills: 1200, level: 28 });

    expect(threeMinuteReward).toBe(15);
    expect(victoryReward).toBe(70);
  });
});
