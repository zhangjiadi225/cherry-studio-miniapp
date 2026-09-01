import { afterEach, describe, expect, it } from 'vitest';
import { getDifficultyParams } from '../../data/difficulty';
import { RUN_DIFFICULTY_PRESETS } from '../../data/runDifficulties';
import { EnemyType, type Enemy } from '../../types';
import { getAvailableEnemyTypes, resetEnemyIds } from './Enemy';
import { getEnemySpawnWeights, getRangedPressureWeightShare, Spawner } from './Spawner';
import { SeededRandom } from '../../kernel/Random';
import { createPlayer } from '../player/Player';

afterEach(() => resetEnemyIds());

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

  it('repeats spawn rules for the same run seed', () => {
    const firstSpawner = new Spawner(new SeededRandom(20260828));
    const secondSpawner = new Spawner(new SeededRandom(20260828));
    const firstEnemies: Enemy[] = [];
    const secondEnemies: Enemy[] = [];
    const player = createPlayer();
    const runDifficulty = RUN_DIFFICULTY_PRESETS.hard;

    resetEnemyIds();
    firstSpawner.update(firstEnemies, player, 120, 4, 2, 1, runDifficulty);
    const firstSnapshot = firstEnemies.map(snapshotEnemySpawn);
    resetEnemyIds();
    secondSpawner.update(secondEnemies, player, 120, 4, 2, 1, runDifficulty);

    expect(firstSnapshot).toEqual(secondEnemies.map(snapshotEnemySpawn));
  });
});

function snapshotEnemySpawn(enemy: Enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    x: enemy.x,
    y: enemy.y,
    isElite: enemy.isElite,
    attackCooldown: enemy.attackCooldown,
    animTimer: enemy.animTimer,
    traitCooldown: enemy.traitCooldown,
  };
}
