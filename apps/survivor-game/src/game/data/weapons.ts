import { WeaponType, type WeaponFamily } from '../types';

export const WEAPON_DATA: Record<WeaponType, {
  name: string;
  icon: string;
  desc: string;
  family: WeaponFamily;
  baseDamage: number;
  baseCooldown: number;
  baseSpeed: number;
  baseArea: number;
  baseCount: number;
  basePierce: number;
  baseDuration: number;
  baseKnockback: number;
  perLevel: {
    damage?: number;
    cooldown?: number;
    speed?: number;
    area?: number;
    count?: number;
    pierce?: number;
    duration?: number;
    knockback?: number;
    growthLabel?: string;
  };
  maxLevel?: number;
}> = {
  [WeaponType.WHIP]: {
    name: '鞭子',
    icon: '🪄',
    desc: '每升1级多一节鞭身，最高8级',
    family: 'swing',
    baseDamage: 15,
    baseCooldown: 1.5,
    baseSpeed: 0,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 0.5,
    baseKnockback: 50,
    perLevel: { damage: 5, count: 0, growthLabel: '鞭身+1' },
    maxLevel: 8,
  },
  [WeaponType.MAGIC_WAND]: {
    name: '魔法弹',
    icon: '✦',
    desc: '向最近敌人发射魔法弹',
    family: 'projectile',
    baseDamage: 10,
    baseCooldown: 1.2,
    baseSpeed: 400,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 0,
    baseDuration: 2,
    baseKnockback: 30,
    perLevel: { damage: 5, count: 1, speed: 30 },
    maxLevel: 8,
  },
  [WeaponType.BIBLE]: {
    name: '圣经',
    icon: '📖',
    desc: '环绕玩家旋转的圣书',
    family: 'orbit',
    baseDamage: 18,
    baseCooldown: 8,
    baseSpeed: 200,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 4,
    baseKnockback: 60,
    perLevel: { damage: 7, count: 1, duration: 0.5, area: 0.1, cooldown: -0.15 },
    maxLevel: 8,
  },
  [WeaponType.GARLIC]: {
    name: '大蒜',
    icon: '🧄',
    desc: '持续伤害周围的敌人',
    family: 'aura',
    baseDamage: 5,
    baseCooldown: 0.5,
    baseSpeed: 0,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 999,
    baseKnockback: 20,
    perLevel: { damage: 2, area: 0.15 },
    maxLevel: 8,
  },
  [WeaponType.FIRE_WAND]: {
    name: '火焰弹',
    icon: '🔥',
    desc: '发射爆炸的火球',
    family: 'projectile',
    baseDamage: 25,
    baseCooldown: 2.0,
    baseSpeed: 300,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 0,
    baseDuration: 2,
    baseKnockback: 80,
    perLevel: { damage: 10, area: 0.2, count: 1 },
    maxLevel: 8,
  },
  [WeaponType.HOLY_WATER]: {
    name: '圣水',
    icon: '💧',
    desc: '在敌人位置降下伤害区域',
    family: 'zone',
    baseDamage: 10,
    baseCooldown: 5,
    baseSpeed: 0,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 3,
    baseKnockback: 0,
    perLevel: { damage: 5, count: 1, area: 0.15, duration: 0.5 },
    maxLevel: 8,
  },
  [WeaponType.LIGHTNING]: {
    name: '闪电',
    icon: '⚡',
    desc: '随机打击屏幕内敌人',
    family: 'strike',
    baseDamage: 30,
    baseCooldown: 3,
    baseSpeed: 0,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 1,
    baseDuration: 0.1,
    baseKnockback: 100,
    perLevel: { damage: 8, count: 1, cooldown: -0.15 },
    maxLevel: 8,
  },
  [WeaponType.AXE]: {
    name: '斧头',
    icon: '🪓',
    desc: '抛向天空的高伤害飞斧',
    family: 'projectile',
    baseDamage: 35,
    baseCooldown: 3,
    baseSpeed: 250,
    baseArea: 1.2,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 2.5,
    baseKnockback: 70,
    perLevel: { damage: 12, count: 1, area: 0.15 },
    maxLevel: 8,
  },
  [WeaponType.RUNE_LANCE]: {
    name: '符文枪',
    icon: '⟡',
    desc: '朝最近敌人发射高速贯穿枪芒',
    family: 'projectile',
    baseDamage: 18,
    baseCooldown: 1.65,
    baseSpeed: 560,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 4,
    baseDuration: 1.15,
    baseKnockback: 45,
    perLevel: { damage: 4, speed: 15, pierce: 1, cooldown: -0.04 },
    maxLevel: 8,
  },
  [WeaponType.MOON_BLADE]: {
    name: '月轮刃',
    icon: '☾',
    desc: '发射多枚旋转穿透月刃',
    family: 'projectile',
    baseDamage: 12,
    baseCooldown: 2.4,
    baseSpeed: 360,
    baseArea: 1.0,
    baseCount: 2,
    basePierce: 2,
    baseDuration: 1.7,
    baseKnockback: 35,
    perLevel: { damage: 3, count: 1, pierce: 1, area: 0.05 },
    maxLevel: 8,
  },
};
