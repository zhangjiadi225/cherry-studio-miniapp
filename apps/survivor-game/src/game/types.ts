export interface Vec2 {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  shakeX: number;
  shakeY: number;
  shakeDuration: number;
  shakeIntensity: number;
}

export interface Player {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  invTime: number;
  invDuration: number;
  level: number;
  xp: number;
  xpToNext: number;
  pickupRange: number;
  basePickupRange: number;
  might: number;
  area: number;
  cooldownReduction: number;
  armor: number;
  regen: number;
  regenTimer: number;
  luck: number;
  curse: number;
  currentZone: MapZone;
  weapons: Weapon[];
  passives: PassiveUpgrade[];
  animTimer: number;
  facingLeft: boolean;
}

export interface Weapon {
  type: WeaponType;
  level: number;
  cooldown: number;
  timer: number;
  damage: number;
  speed: number;
  area: number;
  count: number;
  pierce: number;
  duration: number;
  knockback: number;
}

export interface PassiveUpgrade {
  type: PassiveType;
  level: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  type: EnemyType;
  isElite: boolean;
  isBoss: boolean;
  knockbackX: number;
  knockbackY: number;
  hitFlash: number;
  animTimer: number;
  xpValue: number;
  contactCooldown: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  maxLife: number;
  pierce: number;
  pierceCount: number;
  type: WeaponType;
  hitEnemies: Set<number>;
  knockback: number;
  gravY?: number;
  animTimer: number;
  orbitAngle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  originX?: number;
  originY?: number;
  count?: number;
  segScale?: number;
  lightningSeed?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  alpha: number;
  rotation?: number;
  rotSpeed?: number;
  type?: 'circle' | 'square' | 'star' | 'spark';
  trail?: boolean;
  glow?: boolean;
  glowRadius?: number;
  glowColor?: string;
}

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  vy: number;
  color: string;
  size: number;
}

export interface XPGem {
  x: number;
  y: number;
  value: number;
  radius: number;
  magnetized: boolean;
  life: number;
  animTimer: number;
  type: 'small' | 'medium' | 'large';
}

export interface UpgradeOption {
  title: string;
  description: string;
  icon: string;
  type: 'weapon' | 'passive';
  weaponType?: WeaponType;
  passiveType?: PassiveType;
  isMaxed: boolean;
}

export interface ScreenShake {
  x: number;
  y: number;
  duration: number;
  intensity: number;
}

export const WeaponType = {
  WHIP: 'whip',
  MAGIC_WAND: 'magic_wand',
  BIBLE: 'bible',
  GARLIC: 'garlic',
  FIRE_WAND: 'fire_wand',
  HOLY_WATER: 'holy_water',
  LIGHTNING: 'lightning',
  AXE: 'axe',
} as const;
export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

export const PassiveType = {
  MIGHT: 'might',
  SPEED: 'speed',
  MAX_HP: 'max_hp',
  ARMOR: 'armor',
  COOLDOWN: 'cooldown',
  AREA: 'area',
  PICKUP_RANGE: 'pickup_range',
  REGEN: 'regen',
  LUCK: 'luck',
  MAGNET: 'magnet',
  CURSE: 'curse',
  REVIVE: 'revive',
} as const;
export type PassiveType = typeof PassiveType[keyof typeof PassiveType];

export const EnemyType = {
  ZOMBIE: 'zombie',
  BAT: 'bat',
  SKELETON: 'skeleton',
  GHOST: 'ghost',
  MUMMY: 'mummy',
  DEMON: 'demon',
  WRAITH: 'wraith',
} as const;
export type EnemyType = typeof EnemyType[keyof typeof EnemyType];

export type MapZone = 'shadow' | 'blood' | 'bone' | 'storm';

export interface MapObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'tombstone' | 'bone_wall' | 'blood_pool' | 'magic_circle';
  hp: number;
  maxHp: number;
  radius: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'upgrading' | 'gameover';

export interface GameCamera extends Camera {}
