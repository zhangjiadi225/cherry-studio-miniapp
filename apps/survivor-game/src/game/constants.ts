import type { UpgradeRarity } from './types';

export { COLORS } from './data/colors';
export { ENEMY_DATA } from './data/enemies';
export { GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK } from './data/modifiers';
export { PASSIVE_DATA } from './data/passives';
export { SUPPLY_DATA } from './data/supplies';
export { WEAPON_DATA, STARTING_WEAPON_TYPES, getWeaponMetadataLabel } from './data/weapons';

// ===== Game =====
export const GAME_DURATION = 9 * 60; // 9 minutes
export const ARENA_SIZE = 4800;
export const MAP_GRID_SIZE = 31.2;
export const CAMERA_ZOOM = 1.55;
export const DIFFICULTY_INTERVAL = 30; // seconds
export const DIFFICULTY_STEP = 0.03;
export const SPAWN_INTERVAL_BASE = 1.5; // seconds
export const SPAWN_INTERVAL_MIN = 0.25;
export const SPAWN_DISTANCE = 600;
export const BOSS_TIMES = [180, 360]; // 3min, 6min
export const MAX_ENEMIES = 520;
export const MAX_ACTIVE_PLAYER_PROJECTILES = 420;
export const MAX_ACTIVE_ENEMY_PROJECTILES = 180;
export const MAX_ACTIVE_PARTICLES = 800;
export const MAX_ACTIVE_DAMAGE_NUMBERS = 220;
export const MAX_PARTICLE_EMISSIONS_PER_FRAME = 96;
export const MAX_PARTICLE_RENDER_COST = 900;
export const MAX_CANVAS_DPR = 1.5;
export const SIMULATION_STEP_SECONDS = 1 / 60;
export const MAX_SIMULATION_STEPS_PER_FRAME = 5;
export const MAX_SIMULATION_FRAME_DELTA = 0.25;

// ===== Player =====
export const PLAYER_RADIUS = 14;
export const PLAYER_VISUAL_SCALE = 1.5;
export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_SPEED = 200;
export const PLAYER_BASE_PICKUP_RANGE = 60;
export const PLAYER_WEAPON_SLOT_LIMIT = 3;
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
export const SHOP_WEAPON_XP_SURCHARGE = 0.18;
export const SHOP_NEW_WEAPON_XP_SURCHARGE = 0.14;
export const SHOP_PASSIVE_XP_SURCHARGE = 0.12;
export const SHOP_HEAL_XP_SURCHARGE = 0.08;
export const SHOP_PASSIVE_OPTION_CHANCE = 0.35;
export const SHOP_FIELD_RATION_OPTION_CHANCE = 0.3;
export const SHOP_SELL_REFUND_RATE = 0.8;

export const UPGRADE_RARITY_DATA: Record<UpgradeRarity, {
  label: string;
  color: string;
  darkColor: string;
  costMultiplier: number;
}> = {
  common: {
    label: '白色',
    color: '#f4f7fb',
    darkColor: '#687284',
    costMultiplier: 1,
  },
  uncommon: {
    label: '绿色',
    color: '#76e89a',
    darkColor: '#1f6f46',
    costMultiplier: 1.18,
  },
  rare: {
    label: '蓝色',
    color: '#6fb7ff',
    darkColor: '#245a96',
    costMultiplier: 1.38,
  },
  epic: {
    label: '紫色',
    color: '#c78dff',
    darkColor: '#6d3ca0',
    costMultiplier: 1.65,
  },
  legendary: {
    label: '金色',
    color: '#ffd166',
    darkColor: '#9a6a10',
    costMultiplier: 2.05,
  },
};

// ===== Screen Shake =====
export const SHAKE_HIT_DURATION = 0.1;
export const SHAKE_HIT_INTENSITY = 3;
export const SHAKE_BOSS_DURATION = 0.3;
export const SHAKE_BOSS_INTENSITY = 6;

// ===== Obstacle Config =====
export const OBSTACLE_CELL_SIZE = 240;
export const OBSTACLE_HP = 10;

// ===== Combat =====
export const CONTACT_COOLDOWN = 0.5;
export const FIND_ENEMY_RANGE = 800;
export const LIGHTNING_RANGE = 600;
export const HOLY_WATER_RANGE = 500;

// ===== Elite / Boss multipliers =====
export const ELITE_RADIUS_MULT = 1.5;
export const ELITE_SPEED_MULT = 0.8;
export const ELITE_STAT_MULT = 3;
export const ELITE_DAMAGE_MULT = 1.35;
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

// ===== Arena =====
export const ARENA_HALF = ARENA_SIZE / 2;
