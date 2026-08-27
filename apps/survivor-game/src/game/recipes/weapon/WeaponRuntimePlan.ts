import type { Enemy, Player, Projectile } from '../../types';
import type { EnemyQuery } from '../../systems/enemy/EnemyQuery';
import type { PrimitiveParamsV1 } from './WeaponRecipe';

export type WeaponPrimitiveKind =
  | 'trigger'
  | 'targeting'
  | 'cast-origin'
  | 'emission-pattern'
  | 'projectile-motion'
  | 'collision'
  | 'hit-effect'
  | 'lifecycle'
  | 'render';

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
}

export interface ResolvedTargeting {
  readonly primitiveId: string;
  readonly fallback: 'forward' | 'radial';
  select(
    player: Player,
    enemyQuery: EnemyQuery,
    count: number,
    output: Enemy[]
  ): number;
}

export interface ResolvedCastOrigin {
  readonly primitiveId: string;
  resolve(player: Player, index: number, total: number, output: { x: number; y: number }): void;
}

export interface ResolvedEmissionPattern {
  readonly primitiveId: string;
  resolveAngle(baseAngle: number, index: number, total: number): number;
}

export interface ResolvedProjectileMotion {
  readonly primitiveId: string;
  update(projectile: Projectile, dt: number, player?: Player): void;
}

export interface ResolvedCollisionBehavior {
  readonly primitiveId: string;
  readonly stopOnMap: boolean;
  getLookupRadius(projectile: Projectile): number;
  overlaps(projectile: Projectile, enemy: Enemy): boolean;
}

export interface ProjectileHitEffectContext {
  readonly projectile: Projectile;
  readonly enemy: Enemy;
  dealDamage(scale: number): boolean;
  applyKnockback(scale: number): void;
}

export interface ResolvedHitEffect {
  readonly primitiveId: string;
  apply(context: ProjectileHitEffectContext): void;
}

export interface ResolvedProjectileLifecycle {
  readonly primitiveId: string;
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
}

export interface ResolvedWeaponBudget {
  readonly directProjectilesPerCast: number;
  readonly directProjectilesPerSecond: number;
  readonly theoreticalConcurrentProjectiles: number;
  readonly estimatedCostPerSecond: number;
}

export interface WeaponRuntimePlan {
  readonly definitionId: string;
  readonly trigger: ResolvedWeaponTrigger;
  readonly targeting: ResolvedTargeting;
  readonly emission: {
    readonly emitterId: 'builtin.emitter.projectile';
    readonly origin: ResolvedCastOrigin;
    readonly count: number;
    readonly burstCount: number;
    readonly burstInterval: number;
    readonly pattern: ResolvedEmissionPattern;
  };
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
export type TargetingPrimitive = WeaponPrimitive<ResolvedTargeting>;
export type CastOriginPrimitive = WeaponPrimitive<ResolvedCastOrigin>;
export type EmissionPatternPrimitive = WeaponPrimitive<ResolvedEmissionPattern>;
export type ProjectileMotionPrimitive = WeaponPrimitive<ResolvedProjectileMotion>;
export type CollisionBehaviorPrimitive = WeaponPrimitive<ResolvedCollisionBehavior>;
export type HitEffectPrimitive = WeaponPrimitive<ResolvedHitEffect>;
export type ProjectileLifecyclePrimitive = WeaponPrimitive<ResolvedProjectileLifecycle>;
export type ProjectileRenderPrimitive = WeaponPrimitive<ResolvedProjectileRenderPrimitive>;

export interface WeaponCapabilityCatalogV1 {
  readonly catalogVersion: 1;
  readonly primitives: readonly WeaponPrimitiveDescriptorV1[];
}
