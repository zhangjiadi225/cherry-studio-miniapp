import { EnemyType } from '../types';

export const ENEMY_DATA: Record<EnemyType, {
  name: string;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  radius: number;
  xpValue: number;
  color: string;
  spawnAfter: number;
}> = {
  [EnemyType.ZOMBIE]: {
    name: '僵尸',
    baseHp: 20,
    baseSpeed: 60,
    baseDamage: 8,
    radius: 12,
    xpValue: 1,
    color: '#6b8e23',
    spawnAfter: 0,
  },
  [EnemyType.BAT]: {
    name: '蝙蝠',
    baseHp: 10,
    baseSpeed: 120,
    baseDamage: 5,
    radius: 8,
    xpValue: 1,
    color: '#8b4513',
    spawnAfter: 0,
  },
  [EnemyType.SKELETON]: {
    name: '骷髅',
    baseHp: 35,
    baseSpeed: 80,
    baseDamage: 12,
    radius: 12,
    xpValue: 2,
    color: '#d4c5a9',
    spawnAfter: 30,
  },
  [EnemyType.GHOST]: {
    name: '幽灵',
    baseHp: 25,
    baseSpeed: 90,
    baseDamage: 10,
    radius: 14,
    xpValue: 3,
    color: '#b0c4de',
    spawnAfter: 60,
  },
  [EnemyType.MUMMY]: {
    name: '木乃伊',
    baseHp: 80,
    baseSpeed: 45,
    baseDamage: 15,
    radius: 16,
    xpValue: 5,
    color: '#deb887',
    spawnAfter: 120,
  },
  [EnemyType.DEMON]: {
    name: '恶魔',
    baseHp: 60,
    baseSpeed: 100,
    baseDamage: 20,
    radius: 14,
    xpValue: 5,
    color: '#dc143c',
    spawnAfter: 180,
  },
  [EnemyType.WRAITH]: {
    name: '亡灵',
    baseHp: 150,
    baseSpeed: 70,
    baseDamage: 25,
    radius: 18,
    xpValue: 10,
    color: '#4a0e4e',
    spawnAfter: 300,
  },
};
