import { describe, expect, it } from 'vitest';
import { getDifficultyParams } from './difficulty';

describe('getDifficultyParams', () => {
  it('clamps negative elapsed time to the opening curve', () => {
    expect(getDifficultyParams(-10)).toMatchObject({
      difficulty: 0,
      enemyHpMultiplier: 1,
      enemySpeedMultiplier: 0.98,
      spawnInterval: 1.8,
      waveBaseCount: 2,
      activeEnemyCap: 18,
      eliteChance: 0.005,
    });
  });

  it('interpolates pressure between checkpoints instead of stepping abruptly', () => {
    const params = getDifficultyParams(90);

    expect(params.difficulty).toBe(3);
    expect(params.spawnInterval).toBeCloseTo(1.4);
    expect(params.enemyHpMultiplier).toBeCloseTo(1.09);
    expect(params.enemySpeedMultiplier).toBeCloseTo(1.03);
    expect(params.waveBaseCount).toBe(3);
    expect(params.activeEnemyCap).toBe(39);
    expect(params.eliteChance).toBeCloseTo(0.02);
  });

  it('ramps into late-game pressure without exceeding the final curve', () => {
    expect(getDifficultyParams(600)).toMatchObject({
      waveBaseCount: 9,
      activeEnemyCap: 190,
    });
    expect(getDifficultyParams(1200)).toMatchObject({
      waveBaseCount: 13,
      activeEnemyCap: 300,
    });
  });
});
