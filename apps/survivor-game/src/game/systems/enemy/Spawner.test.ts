import { describe, expect, it } from 'vitest';
import { getDifficultyParams } from '../../data/difficulty';
import { RUN_DIFFICULTY_PRESETS } from '../../data/runDifficulties';
import { EnemyType } from '../../types';
import { getAvailableEnemyTypes } from './Enemy';
import { getEnemySpawnWeights, getRangedPressureWeightShare } from './Spawner';

describe('enemy spawn weights', () => {
  it('decays newly unlocked enemies from their effective difficulty unlock time', () => {
    const runDifficulty = RUN_DIFFICULTY_PRESETS.nightmare;
    const elapsed = 60;
    const params = getDifficultyParams(elapsed, runDifficulty);

    const weights = getEnemySpawnWeights([EnemyType.CULTIST], elapsed, params, runDifficulty);

    expect(weights[0]).toBeCloseTo(9.95);
  });

  it('caps late nightmare ranged pressure instead of letting wraiths dominate waves', () => {
    const runDifficulty = RUN_DIFFICULTY_PRESETS.nightmare;
    const elapsed = 420;
    const params = getDifficultyParams(elapsed, runDifficulty);
    const available = getAvailableEnemyTypes(elapsed, params.difficulty, runDifficulty);
    const weights = getEnemySpawnWeights(available, elapsed, params, runDifficulty);
    const rangedShare = getRangedPressureWeightShare(available, weights, elapsed, runDifficulty);

    expect(rangedShare).toBeLessThanOrEqual(runDifficulty.rangedEnemyWeightCap + 0.001);
  });
});
