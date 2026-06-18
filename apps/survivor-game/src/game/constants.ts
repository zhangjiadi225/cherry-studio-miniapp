import { WeaponType, PassiveType, EnemyType, MapZone, GenericModifierType, GenericModifierData, WeaponFamily } from './types';

// ===== Game =====
export const GAME_DURATION = 15 * 60; // 15 minutes
export const ARENA_SIZE = 6000;
export const DIFFICULTY_INTERVAL = 30; // seconds
export const DIFFICULTY_STEP = 0.03;
export const SPAWN_INTERVAL_BASE = 1.5; // seconds
export const SPAWN_INTERVAL_MIN = 0.25;
export const SPAWN_DISTANCE = 600;
export const BOSS_TIMES = [300, 600]; // 5min, 10min
export const MAX_ENEMIES = 800;

// ===== Player =====
export const PLAYER_RADIUS = 14;
export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_SPEED = 200;
export const PLAYER_BASE_PICKUP_RANGE = 60;
export const PLAYER_INV_DURATION = 0.8;
export const PLAYER_REGEN_INTERVAL = 1;

// ===== XP / Level =====
export const XP_BASE = 10;
export const XP_GROWTH = 1.25;
export const XP_SMALL = 1;
export const XP_MEDIUM = 5;
export const XP_LARGE = 10;
export const XP_MAGNET_SPEED = 600;
export const GEM_LIFETIME = 60;
export const GEM_ATTRACT_RANGE = 20;

// ===== Upgrade Shop =====
export const SHOP_OPTION_COUNT = 4;
export const SHOP_MAX_OPTION_COUNT = 6;
export const SHOP_LEVELS_PER_EXTRA_OPTION = 5;
export const SHOP_REROLL_BASE_COST = 10;
export const SHOP_REROLL_COST_STEP = 10;

// ===== Weapon Stats =====
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
  maxLevel: number;
}> = {
  [WeaponType.WHIP]: {
    name: '鞭子',
    icon: '🪄',
    desc: '每升1级多一节鞭身，无限成长',
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
    maxLevel: 99,
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
    baseDamage: 15,
    baseCooldown: 8,
    baseSpeed: 200,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 4,
    baseKnockback: 60,
    perLevel: { damage: 5, count: 1, duration: 0.5, area: 0.1 },
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
    perLevel: { damage: 10, count: 1, cooldown: -0.3 },
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
};

// ===== Generic Modifier Cards =====
export const GENERIC_MODIFIER_DATA: Record<GenericModifierType, GenericModifierData> = {
  [GenericModifierType.DOUBLE_CAST]: {
    id: GenericModifierType.DOUBLE_CAST,
    name: '双重施放',
    icon: '✦✦',
    desc: '每次发动额外生成1次弱化攻击，伤害为65%',
    compatibleFamilies: ['projectile', 'strike', 'zone'],
    trigger: 'onFire',
    effect: 'extraCast',
    maxStacks: 1,
    priceTier: 2,
    unlockLevel: 3,
  },
  [GenericModifierType.SPLIT_CORE]: {
    id: GenericModifierType.SPLIT_CORE,
    name: '分裂核心',
    icon: '✧',
    desc: '飞行投射物首次命中后分裂出2个小投射物，伤害为40%',
    compatibleFamilies: ['projectile'],
    trigger: 'onHit',
    effect: 'split',
    maxStacks: 1,
    priceTier: 2,
    unlockLevel: 3,
  },
  [GenericModifierType.CHAIN_CONDUCTOR]: {
    id: GenericModifierType.CHAIN_CONDUCTOR,
    name: '连锁导体',
    icon: '↯',
    desc: '命中后跳向附近1个敌人，造成55%伤害',
    compatibleFamilies: ['projectile', 'strike', 'swing'],
    trigger: 'onHit',
    effect: 'chain',
    maxStacks: 1,
    priceTier: 2,
    unlockLevel: 3,
  },
  [GenericModifierType.IMPACT_PULSE]: {
    id: GenericModifierType.IMPACT_PULSE,
    name: '冲击脉冲',
    icon: '◎',
    desc: '命中点产生小范围冲击，造成35%伤害',
    compatibleFamilies: ['projectile', 'strike', 'zone', 'swing'],
    trigger: 'onHit',
    effect: 'pulse',
    maxStacks: 1,
    priceTier: 1,
    unlockLevel: 3,
  },
  [GenericModifierType.REPULSION_FIELD]: {
    id: GenericModifierType.REPULSION_FIELD,
    name: '排斥力场',
    icon: '⟲',
    desc: '命中时额外击退敌人，提升控场',
    compatibleFamilies: ['aura', 'orbit', 'zone', 'swing'],
    trigger: 'onHit',
    effect: 'knockback',
    maxStacks: 1,
    priceTier: 1,
    unlockLevel: 3,
  },
};

export const GENERIC_MODIFIER_MASK: Record<GenericModifierType, number> = {
  [GenericModifierType.DOUBLE_CAST]: 1 << 0,
  [GenericModifierType.SPLIT_CORE]: 1 << 1,
  [GenericModifierType.CHAIN_CONDUCTOR]: 1 << 2,
  [GenericModifierType.IMPACT_PULSE]: 1 << 3,
  [GenericModifierType.REPULSION_FIELD]: 1 << 4,
};

// ===== Passive Stats =====
export const PASSIVE_DATA: Record<PassiveType, {
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  perLevel: Record<string, number>;
}> = {
  [PassiveType.MIGHT]: {
    name: '力量',
    icon: '💪',
    desc: '伤害 +10%',
    maxLevel: 5,
    perLevel: { might: 0.1 },
  },
  [PassiveType.SPEED]: {
    name: '速度',
    icon: '👟',
    desc: '移动速度 +10%',
    maxLevel: 5,
    perLevel: { speed: 0.1 },
  },
  [PassiveType.MAX_HP]: {
    name: '生命上限',
    icon: '❤️',
    desc: '最大生命 +20',
    maxLevel: 5,
    perLevel: { maxHp: 20 },
  },
  [PassiveType.ARMOR]: {
    name: '护甲',
    icon: '🛡️',
    desc: '减伤 +1',
    maxLevel: 5,
    perLevel: { armor: 1 },
  },
  [PassiveType.COOLDOWN]: {
    name: '冷却缩减',
    icon: '⏱️',
    desc: '冷却时间 -5%',
    maxLevel: 5,
    perLevel: { cooldown: 0.05 },
  },
  [PassiveType.AREA]: {
    name: '攻击范围',
    icon: '🔄',
    desc: '攻击范围 +10%',
    maxLevel: 5,
    perLevel: { area: 0.1 },
  },
  [PassiveType.PICKUP_RANGE]: {
    name: '拾取范围',
    icon: '🧲',
    desc: '拾取范围 +20%',
    maxLevel: 5,
    perLevel: { pickup: 0.2 },
  },
  [PassiveType.REGEN]: {
    name: '恢复',
    icon: '💚',
    desc: '每秒恢复 +0.5 HP',
    maxLevel: 5,
    perLevel: { regen: 0.5 },
  },
  [PassiveType.LUCK]: {
    name: '幸运',
    icon: '🍀',
    desc: '增加稀有掉落',
    maxLevel: 5,
    perLevel: { luck: 0.1 },
  },
  [PassiveType.MAGNET]: {
    name: '磁铁',
    icon: '🧲',
    desc: '经验自动吸取',
    maxLevel: 1,
    perLevel: { magnet: 1 },
  },
  [PassiveType.CURSE]: {
    name: '诅咒',
    icon: '💀',
    desc: '敌人更强但经验更多',
    maxLevel: 5,
    perLevel: { curse: 0.1 },
  },
  [PassiveType.REVIVE]: {
    name: '复活',
    icon: '👼',
    desc: '死亡后复活一次',
    maxLevel: 1,
    perLevel: { revive: 1 },
  },
};

// ===== Enemy Stats =====
export const ENEMY_DATA: Record<EnemyType, {
  name: string;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  radius: number;
  xpValue: number;
  color: string;
  spawnAfter: number; // seconds
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

// ===== Colors =====
export const COLORS = {
  bg: '#0a0a1a',
  ground1: '#111128',
  ground2: '#0d0d22',
  groundLine: '#1a1a35',
  playerBody: '#4a9eff',
  playerOutline: '#2d7ad6',
  playerGlow: 'rgba(74,158,255,0.3)',
  hpBar: '#ff4444',
  hpBarBg: '#333333',
  xpBar: '#44ff44',
  xpBarBg: '#333333',
  gemSmall: '#44ddff',
  gemMedium: '#44ff88',
  gemLarge: '#ffdd44',
  uiBg: 'rgba(0,0,0,0.75)',
  uiBorder: '#444',
  uiText: '#ffffff',
  uiDim: '#888888',
  danger: '#ff4444',
  warning: '#ffaa44',
  heal: '#44ff88',
  
  // Weapon colors
  magicWand: '#64b4ff',
  fireWand: '#ff7800',
  axe: '#b4783c',
  lightning: '#ffff64',
  whip: '#c89664',
  bible: '#ffffc8',
  holyWater: '#6496ff',
  garlic: '#c8c864',
  
  // Effect colors
  critical: '#ff8844',
  elite: '#ffd700',
  boss: '#ff4444',
  levelUp: '#ffd700',
  revive: '#ffd700',
};

// ===== Screen Shake =====
export const SHAKE_HIT_DURATION = 0.1;
export const SHAKE_HIT_INTENSITY = 3;
export const SHAKE_BOSS_DURATION = 0.3;
export const SHAKE_BOSS_INTENSITY = 6;

// ===== Zone Colors =====
export const ZONE_COLORS: Record<MapZone, { line: string; dot: string; accent: string; particle: string }> = {
  shadow: { line: '#1a1a45', dot: '#4a4a8a', accent: '#6a4aff', particle: '#7a6aff' },
  blood:  { line: '#451a1a', dot: '#8a4a4a', accent: '#ff4a4a', particle: '#ff6a6a' },
  bone:   { line: '#3a3a1a', dot: '#8a8a4a', accent: '#cccc66', particle: '#dddd88' },
  storm:  { line: '#1a3a2a', dot: '#4a8a5a', accent: '#66ff88', particle: '#88ffaa' },
};

// ===== Obstacle Config =====
export const OBSTACLE_CELL_SIZE = 200;
export const OBSTACLE_HP = 10;
export const BLOOD_POOL_SLOW = 0.5;
export const BLOOD_POOL_RADIUS = 40;

// ===== Combat (extracted from scattered magic numbers) =====
export const CONTACT_COOLDOWN = 0.5;
export const HEALTH_DROP_CHANCE = 0.03;
export const HEALTH_DROP_AMOUNT = 20;
export const FIND_ENEMY_RANGE = 800;
export const LIGHTNING_RANGE = 600;
export const HOLY_WATER_RANGE = 500;

// ===== Elite / Boss multipliers =====
export const ELITE_RADIUS_MULT = 1.5;
export const ELITE_SPEED_MULT = 0.8;
export const ELITE_STAT_MULT = 3;
export const ELITE_XP_MULT = 5;
export const ELITE_BASE_CHANCE = 0.02;
export const ELITE_DIFF_CHANCE = 0.005;
export const BOSS_HP_MULT = 5;
export const BOSS_DMG_MULT = 2;
export const BOSS_XP_MULT = 10;
export const BOSS_MINION_COUNT = 20;

// ===== Zone Buffs =====
export const ZONE_BUFFS: Record<MapZone, {
  name: string;
  desc: string;
  icon: string;
}> = {
  shadow: { name: '暗影之力', desc: '伤害 +10%', icon: '🔮' },
  blood:  { name: '鲜血渴望', desc: '击杀回血 3%', icon: '🩸' },
  bone:   { name: '白骨护盾', desc: '护甲 +2',      icon: '🦴' },
  storm:  { name: '风暴疾行', desc: '移速 +15%',    icon: '⚡' },
};

// ===== Magic Circle =====
export const MAGIC_CIRCLE_HEAL_RATE = 5;   // HP per second
export const MAGIC_CIRCLE_RADIUS = 30;

// ===== Arena =====
export const ARENA_HALF = ARENA_SIZE / 2;
