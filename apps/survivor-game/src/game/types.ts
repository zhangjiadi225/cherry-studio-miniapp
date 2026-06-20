export interface Vec2 {
  x: number;
  y: number;
}

export interface TouchJoystickState {
  active: boolean;
  startX: number;
  startY: number;
  knobX: number;
  knobY: number;
  dirX: number;
  dirY: number;
  distance: number;
  maxRadius: number;
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

export interface PlayerMovement {
  x: number;
  y: number;
  speed: number;
  baseSpeed: number;
  animTimer: number;
  facingLeft: boolean;
}

export interface PlayerCombatStats {
  radius: number;
  hp: number;
  maxHp: number;
  invTime: number;
  invDuration: number;
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
}

export interface Player extends PlayerMovement, PlayerCombatStats {
  level: number;
  xp: number;
  xpToNext: number;
  shards: number;
  skinId: string;
  currentZone: MapZone;
  weapons: Weapon[];
  passives: PassiveUpgrade[];
}

export interface Weapon {
  type: WeaponType;
  family: WeaponFamily;
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
  modifiers: GenericModifierType[];
  modifierMask: number;
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
  attackCooldown: number;
  attackWindup: number;
  attackPatternIndex: number;
  pendingAttackPattern: number;
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
  modifierMask: number;
  splitDone?: boolean;
  chainDone?: boolean;
  pulseDone?: boolean;
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

export type EnemyProjectileKind = 'cultist_bolt' | 'demon_fire' | 'wraith_orb';

export interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  maxLife: number;
  sourceType: EnemyType;
  sourceId: number;
  kind: EnemyProjectileKind;
  color: string;
  glowColor: string;
  animTimer: number;
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

export type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface UpgradeOption {
  title: string;
  description: string;
  icon: string;
  type: 'weapon' | 'passive' | 'heal' | 'modifier' | 'supply';
  weaponType?: WeaponType;
  passiveType?: PassiveType;
  modifierType?: GenericModifierType;
  supplyType?: SupplyType;
  rarity: UpgradeRarity;
  cost: number;
  isMaxed: boolean;
  purchased?: boolean;
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

export type WeaponFamily = 'projectile' | 'strike' | 'aura' | 'orbit' | 'zone' | 'swing';

export const GenericModifierType = {
  DOUBLE_CAST: 'double_cast',
  SPLIT_CORE: 'split_core',
  CHAIN_CONDUCTOR: 'chain_conductor',
  IMPACT_PULSE: 'impact_pulse',
  REPULSION_FIELD: 'repulsion_field',
  VELOCITY_RUNE: 'velocity_rune',
  DEATH_BURST: 'death_burst',
  LIGHTNING_BURST: 'lightning_burst',
  CHAIN_BURST: 'chain_burst',
} as const;
export type GenericModifierType = typeof GenericModifierType[keyof typeof GenericModifierType];

export type ModifierTrigger = 'onFire' | 'onHit' | 'onKill' | 'onTick';
export type ModifierEffect =
  | 'extraCast'
  | 'split'
  | 'chain'
  | 'pulse'
  | 'knockback'
  | 'projectileSpeed'
  | 'deathExplosion'
  | 'lightningExplosion'
  | 'chainExplosion';

export const SupplyType = {
  FIELD_RATION: 'field_ration',
  AEGIS_CHARM: 'aegis_charm',
  OVERCLOCK: 'overclock',
} as const;
export type SupplyType = typeof SupplyType[keyof typeof SupplyType];

export interface GenericModifierData {
  id: GenericModifierType;
  name: string;
  icon: string;
  desc: string;
  compatibleFamilies: WeaponFamily[];
  trigger: ModifierTrigger;
  effect: ModifierEffect;
  maxStacks: number;
  priceTier: number;
  unlockLevel: number;
  visual: GenericModifierVisual;
}

export type ModifierVisualLayer = 'cast' | 'trail' | 'hit' | 'control' | 'kill';
export type ModifierAudioCue = 'rush' | 'echo' | 'crack' | 'chain' | 'pulse' | 'push' | 'burst' | 'thunder' | 'cascade';

export interface GenericModifierVisual {
  glyph: string;
  color: string;
  accent: string;
  glow: string;
  layer: ModifierVisualLayer;
  particle: 'circle' | 'square' | 'star' | 'spark';
  audio: ModifierAudioCue;
}

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
  CULTIST: 'cultist',
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
