import type { MapZone } from './types';

export { COLORS, ZONE_COLORS } from './data/colors';
export { ENEMY_DATA } from './data/enemies';
export { GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK } from './data/modifiers';
export { PASSIVE_DATA } from './data/passives';
export { SUPPLY_DATA } from './data/supplies';
export { WEAPON_DATA } from './data/weapons';

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
export const PLAYER_ANIM_SPEED = 8;

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

// ===== Screen Shake =====
export const SHAKE_HIT_DURATION = 0.1;
export const SHAKE_HIT_INTENSITY = 3;
export const SHAKE_BOSS_DURATION = 0.3;
export const SHAKE_BOSS_INTENSITY = 6;

// ===== Obstacle Config =====
export const OBSTACLE_CELL_SIZE = 200;
export const OBSTACLE_HP = 10;
export const BLOOD_POOL_SLOW = 0.5;
export const BLOOD_POOL_RADIUS = 40;

// ===== Combat =====
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
export const ENEMY_FALLBACK_HP_DIFFICULTY_STEP = 0.03;
export const ENEMY_FALLBACK_SPEED_DIFFICULTY_STEP = 0.009;
export const ENEMY_KNOCKBACK_DECAY = 0.01;
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
  blood: { name: '鲜血渴望', desc: '击杀回血 3%', icon: '🩸' },
  bone: { name: '白骨护盾', desc: '护甲 +2', icon: '🦴' },
  storm: { name: '风暴疾行', desc: '移速 +15%', icon: '⚡' },
};

// ===== Magic Circle =====
export const MAGIC_CIRCLE_HEAL_RATE = 5;
export const MAGIC_CIRCLE_RADIUS = 30;

// ===== Arena =====
export const ARENA_HALF = ARENA_SIZE / 2;
