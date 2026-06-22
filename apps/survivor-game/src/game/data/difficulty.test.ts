import { describe, expect, it } from 'vitest';
import { getDifficultyParams } from './difficulty';
import { RUN_DIFFICULTY_PRESETS } from './runDifficulties';

describe('getDifficultyParams', () => {
  it('clamps negative elapsed time to the opening curve', () => {
    expect(getDifficultyParams(-10)).toMatchObject({
      difficulty: 0,
      enemyHpMultiplier: 1,
      enemySpeedMultiplier: 0.98,
      enemyDamageMultiplier: 1,
      spawnInterval: 1.8,
      waveBaseCount: 2,
      activeEnemyCap: 18,
      eliteChance: 0.005,
      complexEnemyWeightMultiplier: 1,
      endlessCycle: 0,
    });
  });

  it('interpolates pressure between checkpoints instead of stepping abruptly', () => {
    const params = getDifficultyParams(90);

    expect(params.difficulty).toBe(3);
    expect(params.spawnInterval).toBeCloseTo(1.4);
    expect(params.enemyHpMultiplier).toBeCloseTo(1.09);
    expect(params.enemySpeedMultiplier).toBeCloseTo(1.03);
    expect(params.enemyDamageMultiplier).toBeCloseTo(1);
    expect(params.waveBaseCount).toBe(3);
    expect(params.activeEnemyCap).toBe(39);
    expect(params.eliteChance).toBeCloseTo(0.02);
    expect(params.complexEnemyWeightMultiplier).toBeCloseTo(1);
  });

	  it('ramps into late-game pressure without exceeding the final curve', () => {
	    expect(getDifficultyParams(600)).toMatchObject({
	      waveBaseCount: 7,
	      activeEnemyCap: 155,
	    });
	    expect(getDifficultyParams(1200)).toMatchObject({
	      waveBaseCount: 9,
	      activeEnemyCap: 220,
	    });
	  });

  it('scales enemy pressure by run difficulty preset', () => {
    const hard = getDifficultyParams(300, RUN_DIFFICULTY_PRESETS.hard);
    const easy = getDifficultyParams(300, RUN_DIFFICULTY_PRESETS.easy);
    const nightmare = getDifficultyParams(300, RUN_DIFFICULTY_PRESETS.nightmare);

    expect(easy.spawnInterval).toBeGreaterThan(hard.spawnInterval);
    expect(easy.waveBaseCount).toBeLessThan(hard.waveBaseCount);
    expect(easy.activeEnemyCap).toBeLessThan(hard.activeEnemyCap);
    expect(nightmare.spawnInterval).toBeLessThan(hard.spawnInterval);
    expect(nightmare.waveBaseCount).toBeGreaterThan(hard.waveBaseCount);
    expect(nightmare.activeEnemyCap).toBeGreaterThan(hard.activeEnemyCap);
  });

	  it('uses a nightmare clear curve that favors pressure over damage spikes', () => {
	    const params = getDifficultyParams(720, RUN_DIFFICULTY_PRESETS.nightmare);

	    expect(params.enemyHpMultiplier).toBeCloseTo(2.18);
	    expect(params.enemyDamageMultiplier).toBeCloseTo(1.15);
	    expect(params.spawnInterval).toBeCloseTo(0.68);
	    expect(params.waveBaseCount).toBe(9);
	    expect(params.activeEnemyCap).toBe(220);
	    expect(params.eliteChance).toBeCloseTo(0.135);
	    expect(params.complexEnemyWeightMultiplier).toBeCloseTo(1.75);
	    expect(params.endlessCycle).toBe(0);
	  });

  it('projects nightmare endless scaling without relying on one-shot damage', () => {
    const clear = getDifficultyParams(720, RUN_DIFFICULTY_PRESETS.nightmare);
    const endless = getDifficultyParams(900, RUN_DIFFICULTY_PRESETS.nightmare);

    expect(endless.endlessCycle).toBe(2);
	    expect(endless.enemyHpMultiplier).toBeGreaterThan(clear.enemyHpMultiplier);
	    expect(endless.spawnInterval).toBeLessThan(clear.spawnInterval);
	    expect(endless.waveBaseCount).toBeGreaterThan(clear.waveBaseCount);
	    expect(endless.complexEnemyWeightMultiplier).toBeGreaterThan(clear.complexEnemyWeightMultiplier);
	    expect(endless.enemyDamageMultiplier).toBeCloseTo(1.21);
	    expect(endless.enemyDamageMultiplier).toBeLessThanOrEqual(RUN_DIFFICULTY_PRESETS.nightmare.endless!.damageCap);
	  });
});
