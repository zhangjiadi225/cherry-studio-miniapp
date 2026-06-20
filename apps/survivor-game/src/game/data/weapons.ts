import {
  WeaponType,
  type WeaponBehavior,
  type WeaponDisplayMode,
  type WeaponFamily,
  type WeaponMetadata,
  type WeaponTag,
} from '../types';

export const WEAPON_TAG_LABELS: Record<WeaponTag, string> = {
  melee: '近战',
  ranged: '远程',
  piercing: '穿透',
};

export const WEAPON_DISPLAY_LABELS: Record<WeaponDisplayMode, string> = {
  none: '',
  stowed: '收纳展示',
  orbit: '环绕展示',
  aura_source: '光环源',
  relic: '圣物挂件',
  body_mark: '身体印记',
};

export const WEAPON_BEHAVIOR_LABELS: Record<WeaponBehavior, string> = {
  persistent_melee: '常驻近战',
  cleave_melee: '扇形近战',
  focus_cast: '法器施放',
  true_projectile: '投掷弹体',
  line_piercer: '线性贯穿',
  orbit_summon: '环绕召唤',
  damage_aura: '范围光环',
  area_control: '区域控制',
  body_enhancement: '身体强化',
};

export function getWeaponMetadataLabel(metadata: WeaponMetadata): string {
  const labels = [WEAPON_BEHAVIOR_LABELS[metadata.behavior], ...metadata.tags.map((tag) => WEAPON_TAG_LABELS[tag])];
  const displayLabel = WEAPON_DISPLAY_LABELS[metadata.displayMode];
  if (displayLabel) labels.unshift(displayLabel);
  return labels.join(' · ');
}

export const WEAPON_DATA: Record<WeaponType, {
  name: string;
  icon: string;
  desc: string;
  family: WeaponFamily;
  metadata: WeaponMetadata;
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
    metadata: { behavior: 'persistent_melee', displayMode: 'stowed', displayPriority: 100, tags: ['melee', 'piercing'] },
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
    name: '魔法法器',
    icon: '✦',
    desc: '角色旁的法器自动向最近敌人施放魔法弹',
    family: 'projectile',
    metadata: { behavior: 'focus_cast', displayMode: 'relic', displayPriority: 66, tags: ['ranged'] },
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
    metadata: { behavior: 'orbit_summon', displayMode: 'orbit', displayPriority: 80, tags: ['melee', 'piercing'] },
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
    metadata: { behavior: 'damage_aura', displayMode: 'aura_source', displayPriority: 70, tags: ['melee'] },
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
    name: '火焰法器',
    icon: '🔥',
    desc: '角色旁的火焰法器自动点燃目标方向',
    family: 'projectile',
    metadata: { behavior: 'focus_cast', displayMode: 'relic', displayPriority: 64, tags: ['ranged'] },
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
    metadata: { behavior: 'area_control', displayMode: 'relic', displayPriority: 60, tags: ['ranged'] },
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
    metadata: { behavior: 'body_enhancement', displayMode: 'body_mark', displayPriority: 90, tags: ['ranged'] },
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
    name: '长柄斧',
    icon: '🪓',
    desc: '朝目标方向挥出120度长柄斧横扫，并斩落范围内敌方弹幕',
    family: 'swing',
    metadata: { behavior: 'cleave_melee', displayMode: 'stowed', displayPriority: 76, tags: ['melee', 'piercing'] },
    baseDamage: 32,
    baseCooldown: 2.2,
    baseSpeed: 0,
    baseArea: 1.0,
    baseCount: 1,
    basePierce: 999,
    baseDuration: 0.24,
    baseKnockback: 105,
    perLevel: { damage: 9, area: 0.07, cooldown: -0.04 },
    maxLevel: 8,
  },
  [WeaponType.RUNE_LANCE]: {
    name: '符文枪',
    icon: '⟡',
    desc: '从角色旁的符文枪架刺出高速贯穿枪芒',
    family: 'projectile',
    metadata: { behavior: 'line_piercer', displayMode: 'relic', displayPriority: 58, tags: ['ranged', 'piercing'] },
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
    desc: '月刃常驻环绕角色，发动时释放旋转穿透刃',
    family: 'projectile',
    metadata: { behavior: 'orbit_summon', displayMode: 'orbit', displayPriority: 62, tags: ['ranged', 'piercing'] },
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
