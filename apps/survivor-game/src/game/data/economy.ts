import { EnemyType, type Enemy } from '../types';
import { ENEMY_DATA } from './enemies';

const NORMAL_GOLD_DROP_CHANCE = 0.06;
const GOLD_DROP_CHANCE_PER_LUCK = 0.02;
const MAX_NORMAL_GOLD_DROP_CHANCE = 0.16;
const ELITE_GOLD_BONUS = 4;
const BOSS_GOLD_REWARD = 30;

function getGoldDropChance(luck: number): number {
  return Math.min(
    MAX_NORMAL_GOLD_DROP_CHANCE,
    NORMAL_GOLD_DROP_CHANCE + Math.max(0, luck - 1) * GOLD_DROP_CHANCE_PER_LUCK
  );
}

export function getBaseGoldValue(enemyType: EnemyType): number {
  const xpValue = ENEMY_DATA[enemyType].xpValue;
  if (xpValue >= 10) return 3;
  if (xpValue >= 5) return 2;
  return 1;
}

export function getExpectedGoldReward(enemyType: EnemyType, isElite = false, isBoss = false, luck = 1): number {
  if (isBoss) return BOSS_GOLD_REWARD;
  const base = getBaseGoldValue(enemyType);
  if (isElite) return ELITE_GOLD_BONUS + base;
  return getGoldDropChance(luck) * base;
}

export function rollEnemyGoldReward(enemy: Enemy, luck: number, random: () => number = Math.random): number {
  if (enemy.isBoss) return BOSS_GOLD_REWARD;
  const base = getBaseGoldValue(enemy.type);
  if (enemy.isElite) return ELITE_GOLD_BONUS + base;
  return random() < getGoldDropChance(luck) ? base : 0;
}
