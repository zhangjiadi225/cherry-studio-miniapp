import { ELITE_XP_MULT, BOSS_XP_MULT } from '../constants';
import { EnemyType, type Enemy } from '../types';
import { ENEMY_DATA } from './enemies';

export function getExpectedShardReward(enemyType: EnemyType, isElite = false, isBoss = false): number {
  let value = ENEMY_DATA[enemyType].xpValue;
  if (isElite || isBoss) value *= ELITE_XP_MULT;
  if (isBoss) value *= BOSS_XP_MULT;
  return value;
}

export function getEnemyShardReward(enemy: Enemy): number {
  return enemy.xpValue;
}
