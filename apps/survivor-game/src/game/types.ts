import type { ProjectileWeaponRecipeV1, TrustedWeaponPlanAdjustment } from './recipes/weapon/WeaponRecipe';
import type { WeaponRuntimePlan } from './recipes/weapon/WeaponRuntimePlan';

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

export interface PerformanceStats {
  fps: number;
  updateMs: number;
  renderMs: number;
  frameMs: number;
  simulationSteps: number;
  droppedSimulationMs: number;
  movementMs: number;
  enemiesMs: number;
  weaponsMs: number;
  combatMs: number;
  effectsMs: number;
  runSeed: number;
  enemies: number;
  projectiles: number;
  enemyProjectiles: number;
  particles: number;
  damageNumbers: number;
  xpGems: number;
  enemyCapFrames: number;
  projectileCapFrames: number;
  enemyProjectileCapFrames: number;
  particleCapFrames: number;
  damageNumberCapFrames: number;
  spatialBuckets: number;
  spatialBucketCapacity: number;
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
  weapons: Weapon[];
  passives: PassiveUpgrade[];
}

export interface Weapon {
  type: WeaponType;
  definitionId: string;
  sourcePackId: string;
  generated: boolean;
  name: string;
  icon: string;
  description: string;
  behaviorId: string;
  family: WeaponFamily;
  metadata: WeaponMetadata;
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
  useLegacyProjectileSprite: boolean;
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
  evolutions: Partial<Record<WeaponEvolutionTier, WeaponEvolutionId>>;
  recipe?: ProjectileWeaponRecipeV1;
  recipeEvolutionAdjustments?: Partial<
    Record<WeaponEvolutionId, readonly TrustedWeaponPlanAdjustment[]>
  >;
  runtimePlan?: WeaponRuntimePlan;
  runtimePlanSourceState?: {
    readonly level: number;
    readonly damage: number;
    readonly cooldown: number;
    readonly speed: number;
    readonly area: number;
    readonly count: number;
    readonly pierce: number;
    readonly duration: number;
    readonly knockback: number;
    readonly modifierMask: number;
    readonly modifierCount: number;
    readonly evolution4?: WeaponEvolutionId;
    readonly evolution8?: WeaponEvolutionId;
  };
  castSequence?: number;
  chargeRemaining?: number;
  pendingBurstRemaining?: number;
  pendingBurstTimer?: number;
  pendingBurstDamage?: number;
  purchaseValue?: number;
}

export interface PassiveUpgrade {
  type: PassiveType;
  level: number;
  purchaseValue?: number;
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
  isEmpowered: boolean;
  trait: EnemyTrait;
  traitCooldown: number;
  traitWindup: number;
  traitDuration: number;
  traitDirX: number;
  traitDirY: number;
  slowMultiplier: number;
  slowRemaining: number;
  burnDamagePerSecond: number;
  burnRemaining: number;
  burnTickTimer: number;
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

  chainDone?: boolean;
  pulseDone?: boolean;
  reflectRemaining?: number;
  gravY?: number;
  animTimer: number;
  orbitAngle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitFollowPlayer?: boolean;
  originX?: number;
  originY?: number;
  count?: number;
  segScale?: number;
  lightningSeed?: number;
  beamLength?: number;
  arcAngle?: number;
  headingAngle?: number;
  visualEffectSequence?: number;
  visualTrailTimer?: number;
  evolutionIds?: WeaponEvolutionId[];
  runtimePlan?: WeaponRuntimePlan;
  useLegacyProjectileSprite?: boolean;
  previousX?: number;
  previousY?: number;
  activationRemaining?: number;
  deliveryOffsetX?: number;
  deliveryOffsetY?: number;
  motionAge?: number;
  returnPhase?: boolean;
  visualSpawnPending?: boolean;
  hitCooldowns?: Map<number, number>;
  lifecycleTriggerCounts?: Map<string, number>;
  lifecycleDepth?: number;
  lifecycleSuppressed?: boolean;
  mapBounceCount?: number;
  collisionHitsThisFrame?: number;
}

export type WeaponAudioCue = 'charge' | 'cast' | 'impact' | 'burst' | 'pulse';

export type WeaponFeedbackSignal =
  | {
      readonly kind: 'audio';
      readonly cue: WeaponAudioCue;
      readonly intensity: number;
    }
  | {
      readonly kind: 'camera';
      readonly duration: number;
      readonly intensity: number;
    };

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
  endX?: number;
  endY?: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  alpha: number;
  rotation?: number;
  rotSpeed?: number;
  type?: 'circle' | 'square' | 'star' | 'spark' | 'beam' | 'crescent';
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
  type: 'weapon' | 'weapon_evolution' | 'passive' | 'heal' | 'modifier' | 'supply';
  weaponType?: WeaponType;
  weaponDefinitionId?: string;
  evolutionId?: WeaponEvolutionId;
  passiveType?: PassiveType;
  modifierType?: GenericModifierType;
  supplyType?: SupplyType;
  rarity: UpgradeRarity;
  cost: number;
  isMaxed: boolean;
  purchased?: boolean;
}

export interface SellableCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'weapon' | 'passive';
  weaponType?: WeaponType;
  weaponDefinitionId?: string;
  passiveType?: PassiveType;
  level: number;
  refund: number;
  sellable: boolean;
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
  RUNE_LANCE: 'rune_lance',
  MOON_BLADE: 'moon_blade',
} as const;
export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

export type WeaponEvolutionTier = 4 | 8;
export const WeaponEvolutionId = {
  WHIP_LONG: 'whip_long',
  WHIP_QUICK: 'whip_quick',
  WHIP_RING: 'whip_ring',
  WHIP_RAZOR: 'whip_razor',
  MAGIC_TWIN: 'magic_twin',
  MAGIC_PIERCER: 'magic_piercer',
  MAGIC_VOLLEY: 'magic_volley',
  MAGIC_FOCUS: 'magic_focus',
  BIBLE_TOME: 'bible_tome',
  BIBLE_ORBIT: 'bible_orbit',
  BIBLE_SANCTUARY: 'bible_sanctuary',
  BIBLE_REQUIEM: 'bible_requiem',
  GARLIC_MIASMA: 'garlic_miasma',
  GARLIC_THORNS: 'garlic_thorns',
  GARLIC_CENSER: 'garlic_censer',
  GARLIC_WARD: 'garlic_ward',
  FIRE_POOL: 'fire_pool',
  FIRE_BURST: 'fire_burst',
  FIRE_STORM: 'fire_storm',
  FIRE_BRAND: 'fire_brand',
  HOLY_TIDE: 'holy_tide',
  HOLY_BASIN: 'holy_basin',
  HOLY_DELUGE: 'holy_deluge',
  HOLY_SCOUR: 'holy_scour',
  LIGHTNING_ROD: 'lightning_rod',
  LIGHTNING_FIELD: 'lightning_field',
  LIGHTNING_TEMPEST: 'lightning_tempest',
  LIGHTNING_JUDGMENT: 'lightning_judgment',
  AXE_BREAKER: 'axe_breaker',
  AXE_BULWARK: 'axe_bulwark',
  AXE_EXECUTIONER: 'axe_executioner',
  AXE_GUARD: 'axe_guard',
  RUNE_PIERCER: 'rune_piercer',
  RUNE_FAN: 'rune_fan',
  RUNE_FOCUS: 'rune_focus',
  RUNE_ARRAY: 'rune_array',
  MOON_TWIN: 'moon_twin',
  MOON_REACH: 'moon_reach',
  MOON_RING: 'moon_ring',
  MOON_REND: 'moon_rend',
} as const;
export type WeaponEvolutionId = typeof WeaponEvolutionId[keyof typeof WeaponEvolutionId];

export interface WeaponEvolutionChoice {
  id: WeaponEvolutionId;
  weaponType: WeaponType;
  tier: WeaponEvolutionTier;
  name: string;
  icon: string;
  desc: string;
  rarity: UpgradeRarity;
}

export type WeaponFamily = 'projectile' | 'strike' | 'aura' | 'orbit' | 'zone' | 'swing';
export type WeaponTag = 'melee' | 'ranged' | 'piercing';
export type WeaponDisplayMode = 'none' | 'stowed' | 'orbit' | 'aura_source' | 'relic' | 'body_mark';
export type WeaponBehavior =
  | 'persistent_melee'
  | 'cleave_melee'
  | 'focus_cast'
  | 'true_projectile'
  | 'line_piercer'
  | 'orbit_summon'
  | 'damage_aura'
  | 'area_control'
  | 'body_enhancement';

export interface WeaponMetadata {
  behavior: WeaponBehavior;
  displayMode: WeaponDisplayMode;
  displayPriority: number;
  tags: WeaponTag[];
}

export const GenericModifierType = {
  DOUBLE_CAST: 'double_cast',
  SPLIT_CORE: 'split_core',
  REFLECTION_PRISM: 'reflection_prism',
  CHAIN_CONDUCTOR: 'chain_conductor',
  IMPACT_PULSE: 'impact_pulse',
  REPULSION_FIELD: 'repulsion_field',
  VELOCITY_RUNE: 'velocity_rune',
  ORBITAL_CORE: 'orbital_core',
  DEATH_BURST: 'death_burst',
} as const;
export type GenericModifierType = typeof GenericModifierType[keyof typeof GenericModifierType];

export type ModifierTrigger = 'onFire' | 'onHit' | 'onKill' | 'onTick';
export type ModifierEffect =
  | 'extraCast'
  | 'split'
  | 'reflect'
  | 'chain'
  | 'pulse'
  | 'knockback'
  | 'projectileSpeed'
  | 'projectileOrbit'
  | 'deathExplosion';

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
export type ModifierAudioCue = 'rush' | 'echo' | 'crack' | 'chain' | 'pulse' | 'push' | 'burst';

export interface GenericModifierVisual {
  glyph: string;
  color: string;
  accent: string;
  glow: string;
  layer: ModifierVisualLayer;
  particle: 'circle' | 'square' | 'star' | 'spark' | 'beam' | 'crescent';
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

export type EnemyTrait =
  | 'none'
  | 'dash'
  | 'shield'
  | 'phase'
  | 'split'
  | 'burstCaster'
  | 'charge'
  | 'shadowCaster';

export interface EnemyEnhancement {
  unlockAfter: number;
  name: string;
  desc: string;
  trait: EnemyTrait;
  hpMult?: number;
  speedMult?: number;
  damageMult?: number;
}

export interface MapObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'tombstone' | 'bone_wall';
  variant: number;
  rotation: number;
  landmark?: boolean;
  hp: number;
  maxHp: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'upgrading' | 'gameover';

export interface GameCamera extends Camera {}
