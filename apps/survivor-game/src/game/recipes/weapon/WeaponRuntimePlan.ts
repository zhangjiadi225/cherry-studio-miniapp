import type {
  Enemy,
  GenericModifierType,
  Particle,
  Player,
  Projectile,
  WeaponFamily,
} from '../../types';
import type { EnemyQuery } from '../../systems/enemy/EnemyQuery';
import type {
  PrimitiveParamsV1,
  TrustedWeaponPlanAdjustment,
} from './WeaponRecipe';

export type WeaponPrimitiveKind =
  | 'trigger'
  | 'delivery'
  | 'targeting'
  | 'cast-origin'
  | 'emission-schedule'
  | 'emission-pattern'
  | 'projectile-motion'
  | 'collision'
  | 'hit-effect'
  | 'lifecycle'
  | 'render'
  | 'particle'
  | 'feedback';

export type WeaponPrimitiveParameterErrorCode =
  | 'UNKNOWN_PRIMITIVE_PARAM'
  | 'MISSING_PRIMITIVE_PARAM'
  | 'INVALID_PRIMITIVE_PARAM';

export class WeaponPrimitiveParameterError extends Error {
  constructor(
    readonly code: WeaponPrimitiveParameterErrorCode,
    readonly path: string,
    message: string
  ) {
    super(message);
    this.name = 'WeaponPrimitiveParameterError';
  }
}

export interface PrimitiveParameterSchemaV1 {
  readonly schemaId: string;
  readonly allowedKeys: readonly string[];
  readonly requiredKeys: readonly string[];
  readonly numericBounds: Readonly<Record<string, { readonly min: number; readonly max: number }>>;
  readonly enumValues: Readonly<Record<string, readonly string[]>>;
  readonly booleanKeys: readonly string[];
}

export interface WeaponPrimitiveDescriptorV1 {
  readonly id: string;
  readonly version: string;
  readonly kind: WeaponPrimitiveKind;
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: PrimitiveParameterSchemaV1;
  readonly compatibility: {
    readonly requires: readonly string[];
    readonly conflictsWith: readonly string[];
    readonly tags: readonly string[];
  };
  readonly budget: {
    readonly category: 'constant' | 'per-projectile' | 'per-hit' | 'area-query';
    readonly baseCost: number;
    readonly variableCosts: readonly string[];
  };
}

export interface WeaponPrimitive<TResolved> {
  readonly descriptor: WeaponPrimitiveDescriptorV1;
  compile(params: PrimitiveParamsV1, path: string): TResolved;
}

export interface ResolvedWeaponTrigger {
  readonly primitiveId: string;
  readonly cooldown: number;
  readonly chargeDuration: number;
}

export interface ResolvedWeaponDelivery {
  readonly primitiveId: string;
  readonly family: WeaponFamily;
  readonly activationDelay: number;
  initialize(projectile: Projectile, player: Player): void;
  update(projectile: Projectile, dt: number, player?: Player): boolean | void;
  canCollide(projectile: Projectile): boolean;
}

export interface ResolvedEmissionSchedule {
  readonly primitiveId: string;
  readonly burstCount: number;
  readonly burstInterval: number;
}

export interface ResolvedTargeting {
  readonly primitiveId: string;
  readonly fallback: 'forward' | 'radial';
  select(
    player: Player,
    enemyQuery: EnemyQuery,
    count: number,
    output: Enemy[],
    castSeed: number
  ): number;
}

export interface ResolvedCastOrigin {
  readonly primitiveId: string;
  resolve(
    player: Player,
    index: number,
    total: number,
    output: { x: number; y: number },
    target?: Enemy,
    fallbackAngle?: number
  ): void;
}

export interface ResolvedEmissionPattern {
  readonly primitiveId: string;
  resolveAngle(baseAngle: number, index: number, total: number): number;
}

export interface ResolvedProjectileMotion {
  readonly primitiveId: string;
  update(
    projectile: Projectile,
    dt: number,
    player?: Player,
    enemyQuery?: EnemyQuery
  ): boolean | void;
}

export interface ResolvedCollisionBehavior {
  readonly primitiveId: string;
  readonly stopOnMap: boolean;
  readonly mapResponse: 'pass' | 'expire' | 'bounce';
  readonly repeatHitInterval: number;
  readonly maximumTargetsPerTick: number;
  getLookupRadius(projectile: Projectile): number;
  overlaps(projectile: Projectile, enemy: Enemy): boolean;
  handleMapCollision(projectile: Projectile): boolean;
}

export interface ProjectileHitEffectContext {
  readonly projectile: Projectile;
  readonly enemy: Enemy;
  dealDamage(scale: number): boolean;
  applyKnockback(scale: number): void;
  applySlow(speedMultiplier: number, duration: number): void;
  applyBurn(damagePerSecondScale: number, duration: number): void;
  dealAreaDamage(radius: number, damageScale: number, maxTargets: number): void;
  dealChainDamage(range: number, damageScale: number, maxTargets: number): void;
}

export interface ResolvedHitEffect {
  readonly primitiveId: string;
  readonly maximumDamageMultiplier: number;
  readonly maximumExtraTargets: number;
  apply(context: ProjectileHitEffectContext): void;
}

export type ProjectileLifecycleEvent = 'hit' | 'expire';

export interface ProjectileLifecycleContext {
  readonly projectile: Projectile;
  readonly enemy?: Enemy;
  readonly event: ProjectileLifecycleEvent;
  readonly triggerCount: number;
  setTriggerCount(value: number): void;
  spawnChild(
    angle: number,
    damageScale: number,
    speedScale: number,
    lifetimeScale: number,
    inheritLifecycle: boolean
  ): boolean;
  redirect(angle: number, speedScale: number): void;
  preserveProjectile(): void;
}

export interface ResolvedProjectileLifecycle {
  readonly primitiveId: string;
  readonly event: ProjectileLifecycleEvent;
  readonly maximumChildren: number;
  readonly maximumDepth: number;
  handle(context: ProjectileLifecycleContext): void;
}

export interface ProjectileRenderPrimitiveContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly projectile: Projectile;
  readonly palette: {
    readonly primary: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
  readonly lifeAlpha: number;
  readonly recipeScale: number;
  readonly recipeOpacity: number;
}

export interface ResolvedProjectileRenderPrimitive {
  readonly primitiveId: string;
  draw(context: ProjectileRenderPrimitiveContext): void;
}

export type ProjectileParticleEvent = 'spawn' | 'trail' | 'hit' | 'kill' | 'expire';

export interface ProjectileParticleEffectContext {
  readonly particles: Particle[];
  readonly projectile: Projectile;
  readonly x: number;
  readonly y: number;
  readonly dt: number;
  readonly seed: number;
  readonly palette: {
    readonly primary: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
}

export interface ResolvedProjectileParticleEffect {
  readonly primitiveId: string;
  readonly event: ProjectileParticleEvent;
  readonly emissionInterval: number;
  readonly particlesPerEmission: number;
  readonly maxParticleLifetime: number;
  emit(context: ProjectileParticleEffectContext): void;
}

export type WeaponFeedbackEvent = 'charge' | 'cast' | 'hit' | 'kill' | 'expire';

export interface WeaponFeedbackContext {
  readonly definitionId: string;
  readonly event: WeaponFeedbackEvent;
  readonly x: number;
  readonly y: number;
}

export interface ResolvedWeaponFeedbackEffect {
  readonly primitiveId: string;
  readonly event: WeaponFeedbackEvent;
  readonly estimatedCost: number;
  emit(context: WeaponFeedbackContext): void;
}

export interface ResolvedProjectileVisual {
  readonly body: ResolvedProjectileRenderPrimitive;
  readonly palette: {
    readonly primary: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
  readonly scale: number;
  readonly opacity: number;
  readonly glow?: {
    readonly color: string;
    readonly radiusScale: number;
    readonly intensity: number;
  };
  readonly layers: readonly ResolvedProjectileRenderPrimitive[];
  readonly trail?: ResolvedProjectileRenderPrimitive;
  readonly particles?: ResolvedProjectileRenderPrimitive;
  readonly emitters: readonly ResolvedProjectileParticleEffect[];
}

export interface ResolvedWeaponBudget {
  readonly directProjectilesPerCast: number;
  readonly directProjectilesPerSecond: number;
  readonly theoreticalConcurrentProjectiles: number;
  readonly estimatedParticlesPerSecond: number;
  readonly theoreticalConcurrentParticles: number;
  readonly maximumDerivedProjectilesPerCast: number;
  readonly maximumDamageMultiplierPerHit: number;
  readonly estimatedCostPerSecond: number;
}

export interface WeaponRuntimePlan {
  readonly definitionId: string;
  readonly delivery: ResolvedWeaponDelivery;
  readonly trigger: ResolvedWeaponTrigger;
  readonly targeting: ResolvedTargeting;
  readonly emission: {
    readonly emitterId: 'builtin.emitter.projectile';
    readonly schedule: ResolvedEmissionSchedule;
    readonly origin: ResolvedCastOrigin;
    readonly count: number;
    readonly burstCount: number;
    readonly burstInterval: number;
    readonly pattern: ResolvedEmissionPattern;
  };
  readonly feedback: readonly ResolvedWeaponFeedbackEffect[];
  readonly projectile: {
    readonly damage: number;
    readonly radius: number;
    readonly speed: number;
    readonly lifetime: number;
    readonly pierce: number;
    readonly knockback: number;
    readonly motion: ResolvedProjectileMotion;
    readonly collision: ResolvedCollisionBehavior;
    readonly hitEffects: readonly ResolvedHitEffect[];
    readonly lifecycle: readonly ResolvedProjectileLifecycle[];
    readonly visual: ResolvedProjectileVisual;
  };
  readonly modifierPolicy: {
    readonly allowedIds: readonly string[];
    readonly deniedIds: readonly string[];
  };
  readonly budget: ResolvedWeaponBudget;
}

export type WeaponTriggerPrimitive = WeaponPrimitive<ResolvedWeaponTrigger>;
export type WeaponDeliveryPrimitive = WeaponPrimitive<ResolvedWeaponDelivery>;
export type TargetingPrimitive = WeaponPrimitive<ResolvedTargeting>;
export type CastOriginPrimitive = WeaponPrimitive<ResolvedCastOrigin>;
export type EmissionSchedulePrimitive = WeaponPrimitive<ResolvedEmissionSchedule>;
export type EmissionPatternPrimitive = WeaponPrimitive<ResolvedEmissionPattern>;
export type ProjectileMotionPrimitive = WeaponPrimitive<ResolvedProjectileMotion>;
export type CollisionBehaviorPrimitive = WeaponPrimitive<ResolvedCollisionBehavior>;
export type HitEffectPrimitive = WeaponPrimitive<ResolvedHitEffect>;
export type ProjectileLifecyclePrimitive = WeaponPrimitive<ResolvedProjectileLifecycle>;
export type ProjectileRenderPrimitive = WeaponPrimitive<ResolvedProjectileRenderPrimitive>;
export type ProjectileParticlePrimitive = WeaponPrimitive<ResolvedProjectileParticleEffect>;
export type WeaponFeedbackPrimitive = WeaponPrimitive<ResolvedWeaponFeedbackEffect>;

export type WeaponModifierPhase =
  | 'stat-additive'
  | 'stat-multiplicative'
  | 'emission-structural'
  | 'projectile-structural'
  | 'hit-effect'
  | 'lifecycle';

export interface WeaponModifierDescriptorV1 {
  readonly id: string;
  readonly version: string;
  readonly phase: WeaponModifierPhase;
  readonly name: string;
  readonly description: string;
  readonly maxStacks: number;
  readonly compatibleFamilies: readonly WeaponFamily[];
  readonly conflictsWith: readonly string[];
  readonly estimatedCostPerStack: number;
}

export interface TrustedWeaponModifierHandler {
  readonly descriptor: WeaponModifierDescriptorV1;
  readonly legacyType: GenericModifierType;
  getAdjustments(stacks: number): readonly TrustedWeaponPlanAdjustment[];
  getCastMultiplier(stacks: number): number;
}

export interface WeaponCapabilityCatalogV1 {
  readonly catalogVersion: 1;
  readonly primitives: readonly WeaponPrimitiveDescriptorV1[];
  readonly modifiers: readonly WeaponModifierDescriptorV1[];
}
