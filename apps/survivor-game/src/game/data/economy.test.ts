import { describe, expect, it } from 'vitest';
import { ENEMY_DATA } from './enemies';
import { getDifficultyParams } from './difficulty';
import { getExpectedShardReward } from './economy';
import { ELITE_XP_MULT } from '../constants';
import { EnemyType } from '../types';

function getEnemyWeight(type: EnemyType, elapsed: number): number {
  const data = ENEMY_DATA[type];
  const timeSinceUnlock = elapsed - data.spawnAfter;
  let weight = Math.max(1, 10 - timeSinceUnlock / 30);

  if (type === EnemyType.ZOMBIE || type === EnemyType.BAT) {
    weight *= Math.max(0.3, 1 - elapsed / 600);
  }
  if (type === EnemyType.DEMON || type === EnemyType.WRAITH) {
    weight *= Math.min(3, elapsed / 300);
  }

  return weight;
}

function getExpectedWaveValue(elapsed: number, eliteChance: number): { xp: number; shards: number } {
  const available = Object.values(EnemyType).filter((type) => ENEMY_DATA[type].spawnAfter <= elapsed);
  const weights = available.map((type) => getEnemyWeight(type, elapsed));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let xp = 0;
  let shards = 0;
  for (let i = 0; i < available.length; i++) {
    const type = available[i];
    const share = weights[i] / totalWeight;
    xp += share * ENEMY_DATA[type].xpValue * (1 + eliteChance * (ELITE_XP_MULT - 1));
    shards += share * (
      (1 - eliteChance) * getExpectedShardReward(type, false) +
      eliteChance * getExpectedShardReward(type, true)
    );
  }

  return { xp, shards };
}

function simulateInstantClear(duration: number): { xp: number; shards: number; spawns: number } {
  let spawnTimer = 0;
  let xp = 0;
  let shards = 0;
  let spawns = 0;

  for (let elapsed = 1; elapsed <= duration; elapsed++) {
      const difficulty = getDifficultyParams(elapsed);
      spawnTimer += 1;
      while (spawnTimer >= difficulty.spawnInterval) {
        spawnTimer -= difficulty.spawnInterval;
        const wave = getExpectedWaveValue(elapsed, difficulty.eliteChance);
        xp += difficulty.waveBaseCount * wave.xp;
      shards += difficulty.waveBaseCount * wave.shards;
      spawns += difficulty.waveBaseCount;
    }
  }

  return { xp, shards, spawns };
}

describe('run economy', () => {
  it('uses one in-run shard faucet for both leveling and shop spend', () => {
    expect(getExpectedShardReward(EnemyType.ZOMBIE)).toBe(1);
    expect(getExpectedShardReward(EnemyType.ZOMBIE, true)).toBe(5);
    expect(getExpectedShardReward(EnemyType.DEMON, false, true)).toBe(250);
  });

  it('keeps the first three minutes playable without a separate currency bottleneck', () => {
    const threeMinutes = simulateInstantClear(180);

    expect(threeMinutes.spawns).toBe(384);
    expect(threeMinutes.xp).toBeGreaterThan(900);
    expect(threeMinutes.shards).toBeCloseTo(threeMinutes.xp);
  });
});
