import { assertStableId, type ReadonlyRegistry } from '../../../content/registry/Registry';
import {
  WeaponPrimitiveParameterError,
  type CastOriginPrimitive,
  type CollisionBehaviorPrimitive,
  type EmissionPatternPrimitive,
  type HitEffectPrimitive,
  type ProjectileLifecyclePrimitive,
  type ProjectileMotionPrimitive,
  type ProjectileRenderPrimitive,
  type ResolvedProjectileRenderPrimitive,
  type TargetingPrimitive,
  type TrustedWeaponModifierHandler,
  type WeaponCapabilityCatalogV1,
  type WeaponPrimitiveDescriptorV1,
  type WeaponRuntimePlan,
  type WeaponTriggerPrimitive,
} from './WeaponRuntimePlan';
import type {
  PrimitiveRefV1,
  ProjectileVisualRecipeV1,
  ProjectileWeaponRecipeV1,
  TrustedWeaponPlanAdjustment,
  WeaponRecipeNumericStat,
} from './WeaponRecipe';

const MAX_DIRECT_PROJECTILES_PER_CAST = 64;
const MAX_THEORETICAL_CONCURRENT_PROJECTILES = 420;
const MAX_HIT_EFFECTS = 8;
const MAX_LIFECYCLE_EFFECTS = 6;
const MAX_RENDER_LAYERS = 8;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

export type WeaponRecipeCompileErrorCode =
  | 'INVALID_RECIPE'
  | 'UNKNOWN_PRIMITIVE'
  | 'UNKNOWN_PRIMITIVE_PARAM'
  | 'MISSING_PRIMITIVE_PARAM'
  | 'INVALID_PRIMITIVE_PARAM'
  | 'PROJECTILES_PER_CAST_EXCEEDED'
  | 'PROJECTILE_CONCURRENCY_EXCEEDED'
  | 'RUNTIME_PLAN_UNRESOLVED';

export class WeaponRecipeCompileError extends Error {
  constructor(
    readonly code: WeaponRecipeCompileErrorCode,
    readonly path: string,
    message: string
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'WeaponRecipeCompileError';
  }
}

export interface WeaponRecipeCompilerRegistries {
  readonly weaponTriggers: ReadonlyRegistry<WeaponTriggerPrimitive>;
  readonly targetingStrategies: ReadonlyRegistry<TargetingPrimitive>;
  readonly castOrigins: ReadonlyRegistry<CastOriginPrimitive>;
  readonly emissionPatterns: ReadonlyRegistry<EmissionPatternPrimitive>;
  readonly projectileMotions: ReadonlyRegistry<ProjectileMotionPrimitive>;
  readonly collisionBehaviors: ReadonlyRegistry<CollisionBehaviorPrimitive>;
  readonly hitEffects: ReadonlyRegistry<HitEffectPrimitive>;
  readonly projectileLifecycles: ReadonlyRegistry<ProjectileLifecyclePrimitive>;
  readonly projectileRenderers: ReadonlyRegistry<ProjectileRenderPrimitive>;
  readonly weaponModifiers: ReadonlyRegistry<TrustedWeaponModifierHandler>;
}

export interface WeaponRecipeRuntimeStats {
  readonly damage?: number;
  readonly cooldown?: number;
  readonly speed?: number;
  readonly radius?: number;
  readonly count?: number;
  readonly pierce?: number;
  readonly lifetime?: number;
  readonly knockback?: number;
}

export interface CompileWeaponRecipeOptions {
  readonly stats?: WeaponRecipeRuntimeStats;
  readonly adjustments?: readonly TrustedWeaponPlanAdjustment[];
  readonly castMultiplier?: number;
}

type MutableRecipeStats = Record<WeaponRecipeNumericStat, number>;

function fail(path: string, message: string): never {
  throw new WeaponRecipeCompileError('INVALID_RECIPE', path, message);
}

function assertFiniteInRange(
  value: number,
  path: string,
  min: number,
  max: number,
  integer = false
): number {
  if (!Number.isFinite(value)) fail(path, 'expected a finite number');
  if (integer && !Number.isInteger(value)) fail(path, 'expected an integer');
  if (value < min || value > max) fail(path, `expected ${min}..${max}`);
  return value;
}

function assertColor(value: string, path: string): string {
  if (!HEX_COLOR_PATTERN.test(value)) fail(path, 'expected #RRGGBB or #RRGGBBAA');
  return value;
}

function resolvePrimitive<T>(
  registry: ReadonlyRegistry<{ compile(params: PrimitiveRefV1['params'], path: string): T }>,
  ref: PrimitiveRefV1,
  path: string
): T {
  assertStableId(ref.primitiveId);
  const primitive = registry.get(ref.primitiveId);
  if (!primitive) {
    throw new WeaponRecipeCompileError(
      'UNKNOWN_PRIMITIVE',
      `${path}.primitiveId`,
      `unknown primitive "${ref.primitiveId}"`
    );
  }
  try {
    return primitive.compile(ref.params, `${path}.params`);
  } catch (error) {
    if (error instanceof WeaponPrimitiveParameterError) {
      throw new WeaponRecipeCompileError(error.code, error.path, error.message);
    }
    throw error;
  }
}

function collectStats(
  recipe: ProjectileWeaponRecipeV1,
  options: CompileWeaponRecipeOptions,
  recipeCooldown: number
): MutableRecipeStats {
  const stats: MutableRecipeStats = {
    damage: options.stats?.damage ?? recipe.projectile.damage,
    cooldown: options.stats?.cooldown ?? recipeCooldown,
    speed: options.stats?.speed ?? recipe.projectile.speed,
    radius: options.stats?.radius ?? recipe.projectile.radius,
    count: options.stats?.count ?? recipe.emission.count,
    pierce: options.stats?.pierce ?? recipe.projectile.pierce,
    lifetime: options.stats?.lifetime ?? recipe.projectile.lifetime,
    knockback: options.stats?.knockback ?? recipe.projectile.knockback,
  };

  for (const adjustment of options.adjustments ?? []) {
    if (!Number.isFinite(adjustment.value)) {
      fail('adjustments', `non-finite ${adjustment.stat} adjustment`);
    }
    if (adjustment.operation === 'add') {
      stats[adjustment.stat] += adjustment.value;
    } else {
      stats[adjustment.stat] *= adjustment.value;
    }
  }
  return stats;
}

function compileVisual(
  recipe: ProjectileVisualRecipeV1,
  registries: WeaponRecipeCompilerRegistries
) {
  assertColor(recipe.palette.primary, 'projectile.visual.palette.primary');
  if (recipe.palette.secondary) {
    assertColor(recipe.palette.secondary, 'projectile.visual.palette.secondary');
  }
  if (recipe.palette.accent) {
    assertColor(recipe.palette.accent, 'projectile.visual.palette.accent');
  }
  assertFiniteInRange(recipe.scale, 'projectile.visual.scale', 0.25, 4);
  assertFiniteInRange(recipe.opacity, 'projectile.visual.opacity', 0, 1);
  if (recipe.layers.length > MAX_RENDER_LAYERS) {
    fail('projectile.visual.layers', `maximum ${MAX_RENDER_LAYERS} layers`);
  }

  if (recipe.glow) {
    assertColor(recipe.glow.color, 'projectile.visual.glow.color');
    assertFiniteInRange(recipe.glow.radiusScale, 'projectile.visual.glow.radiusScale', 0.1, 8);
    assertFiniteInRange(recipe.glow.intensity, 'projectile.visual.glow.intensity', 0, 1);
  }

  const resolveRender = (ref: PrimitiveRefV1, path: string): ResolvedProjectileRenderPrimitive =>
    resolvePrimitive(registries.projectileRenderers, ref, path);

  const layers = recipe.layers.map((ref, index) =>
    resolveRender(ref, `projectile.visual.layers[${index}]`)
  );

  return Object.freeze({
    body: resolveRender(recipe.body, 'projectile.visual.body'),
    palette: Object.freeze({ ...recipe.palette }),
    scale: recipe.scale,
    opacity: recipe.opacity,
    glow: recipe.glow ? Object.freeze({ ...recipe.glow }) : undefined,
    layers: Object.freeze(layers),
    trail: recipe.trail
      ? resolveRender(recipe.trail, 'projectile.visual.trail')
      : undefined,
    particles: recipe.particles
      ? resolveRender(recipe.particles, 'projectile.visual.particles')
      : undefined,
  });
}

export function compileProjectileWeaponRecipe(
  definitionId: string,
  recipe: ProjectileWeaponRecipeV1,
  registries: WeaponRecipeCompilerRegistries,
  options: CompileWeaponRecipeOptions = {}
): WeaponRuntimePlan {
  assertStableId(definitionId);
  if (recipe.recipeVersion !== 1) fail('recipeVersion', 'only version 1 is supported');
  if (recipe.delivery !== 'projectile') fail('delivery', 'only projectile delivery is supported');
  if (recipe.emission.emitterId !== 'builtin.emitter.projectile') {
    fail('emission.emitterId', 'unsupported emitter');
  }

  assertFiniteInRange(recipe.projectile.damage, 'projectile.damage', 0, 100000);
  assertFiniteInRange(recipe.projectile.speed, 'projectile.speed', 0, 2400);
  assertFiniteInRange(recipe.projectile.radius, 'projectile.radius', 1, 128);
  assertFiniteInRange(recipe.emission.count, 'emission.count', 1, 64, true);
  assertFiniteInRange(recipe.projectile.pierce, 'projectile.pierce', 0, 999, true);
  assertFiniteInRange(recipe.projectile.lifetime, 'projectile.lifetime', 0.05, 30);
  assertFiniteInRange(recipe.projectile.knockback, 'projectile.knockback', 0, 1200);
  const baseTrigger = resolvePrimitive(registries.weaponTriggers, recipe.trigger, 'trigger');
  const stats = collectStats(recipe, options, baseTrigger.cooldown);
  assertFiniteInRange(stats.cooldown, 'trigger.params.cooldown', 0.2, 60);
  assertFiniteInRange(stats.damage, 'projectile.damage', 0, 100000);
  assertFiniteInRange(stats.speed, 'projectile.speed', 0, 2400);
  assertFiniteInRange(stats.radius, 'projectile.radius', 1, 128);
  assertFiniteInRange(stats.count, 'emission.count', 1, 64, true);
  assertFiniteInRange(stats.pierce, 'projectile.pierce', 0, 999, true);
  assertFiniteInRange(stats.lifetime, 'projectile.lifetime', 0.05, 30);
  assertFiniteInRange(stats.knockback, 'projectile.knockback', 0, 1200);
  assertFiniteInRange(recipe.emission.burstCount, 'emission.burstCount', 1, 8, true);
  assertFiniteInRange(recipe.emission.burstInterval, 'emission.burstInterval', 0, 5);
  if (recipe.emission.burstCount !== 1 || recipe.emission.burstInterval !== 0) {
    throw new WeaponRecipeCompileError(
      'RUNTIME_PLAN_UNRESOLVED',
      'emission',
      'burst scheduling is not implemented in the current runtime slice'
    );
  }

  if (recipe.projectile.hitEffects.length > MAX_HIT_EFFECTS) {
    fail('projectile.hitEffects', `maximum ${MAX_HIT_EFFECTS} effects`);
  }
  if (recipe.projectile.lifecycle.length > MAX_LIFECYCLE_EFFECTS) {
    fail('projectile.lifecycle', `maximum ${MAX_LIFECYCLE_EFFECTS} effects`);
  }

  const trigger = stats.cooldown === baseTrigger.cooldown
    ? baseTrigger
    : resolvePrimitive(
        registries.weaponTriggers,
        {
          ...recipe.trigger,
          params: Object.freeze({ ...recipe.trigger.params, cooldown: stats.cooldown }),
        },
        'trigger'
      );
  const targeting = resolvePrimitive(registries.targetingStrategies, recipe.targeting, 'targeting');
  const origin = resolvePrimitive(registries.castOrigins, recipe.emission.origin, 'emission.origin');
  const pattern = resolvePrimitive(registries.emissionPatterns, recipe.emission.pattern, 'emission.pattern');
  const motion = resolvePrimitive(registries.projectileMotions, recipe.projectile.motion, 'projectile.motion');
  const collision = resolvePrimitive(
    registries.collisionBehaviors,
    recipe.projectile.collision,
    'projectile.collision'
  );
  const hitEffects = recipe.projectile.hitEffects.map((ref, index) =>
    resolvePrimitive(registries.hitEffects, ref, `projectile.hitEffects[${index}]`)
  );
  const lifecycle = recipe.projectile.lifecycle.map((ref, index) =>
    resolvePrimitive(registries.projectileLifecycles, ref, `projectile.lifecycle[${index}]`)
  );
  const visual = compileVisual(recipe.projectile.visual, registries);

  const castMultiplier = assertFiniteInRange(
    options.castMultiplier ?? 1,
    'modifiers.castMultiplier',
    1,
    16,
    true
  );
  const directProjectilesPerCast = stats.count * recipe.emission.burstCount * castMultiplier;
  if (directProjectilesPerCast > MAX_DIRECT_PROJECTILES_PER_CAST) {
    throw new WeaponRecipeCompileError(
      'PROJECTILES_PER_CAST_EXCEEDED',
      'emission',
      `${directProjectilesPerCast} exceeds ${MAX_DIRECT_PROJECTILES_PER_CAST}`
    );
  }
  const directProjectilesPerSecond = directProjectilesPerCast / stats.cooldown;
  const theoreticalConcurrentProjectiles = Math.ceil(directProjectilesPerSecond * stats.lifetime);
  if (theoreticalConcurrentProjectiles > MAX_THEORETICAL_CONCURRENT_PROJECTILES) {
    throw new WeaponRecipeCompileError(
      'PROJECTILE_CONCURRENCY_EXCEEDED',
      'projectile.lifetime',
      `${theoreticalConcurrentProjectiles} exceeds ${MAX_THEORETICAL_CONCURRENT_PROJECTILES}`
    );
  }

  const allowedModifierIds = new Set(recipe.modifierPolicy.allowedIds);
  const deniedModifierIds = new Set(recipe.modifierPolicy.deniedIds);
  if (allowedModifierIds.size !== recipe.modifierPolicy.allowedIds.length) {
    fail('modifierPolicy.allowedIds', 'duplicate modifier ID');
  }
  if (deniedModifierIds.size !== recipe.modifierPolicy.deniedIds.length) {
    fail('modifierPolicy.deniedIds', 'duplicate modifier ID');
  }
  for (const id of [...recipe.modifierPolicy.allowedIds, ...recipe.modifierPolicy.deniedIds]) {
    assertStableId(id);
    const handler = registries.weaponModifiers.get(id);
    if (!handler) {
      throw new WeaponRecipeCompileError(
        'UNKNOWN_PRIMITIVE',
        'modifierPolicy',
        `unknown modifier "${id}"`
      );
    }
    if (!handler.descriptor.compatibleFamilies.includes('projectile')) {
      fail('modifierPolicy', `modifier "${id}" is incompatible with projectile weapons`);
    }
    if (allowedModifierIds.has(id) && deniedModifierIds.has(id)) {
      fail('modifierPolicy', `modifier "${id}" cannot be both allowed and denied`);
    }
  }

  const plan: WeaponRuntimePlan = {
    definitionId,
    trigger,
    targeting,
    emission: Object.freeze({
      emitterId: recipe.emission.emitterId,
      origin,
      count: stats.count,
      burstCount: recipe.emission.burstCount,
      burstInterval: recipe.emission.burstInterval,
      pattern,
    }),
    projectile: Object.freeze({
      damage: stats.damage,
      radius: stats.radius,
      speed: stats.speed,
      lifetime: stats.lifetime,
      pierce: stats.pierce,
      knockback: stats.knockback,
      motion,
      collision,
      hitEffects: Object.freeze(hitEffects),
      lifecycle: Object.freeze(lifecycle),
      visual,
    }),
    modifierPolicy: Object.freeze({
      allowedIds: Object.freeze([...recipe.modifierPolicy.allowedIds]),
      deniedIds: Object.freeze([...recipe.modifierPolicy.deniedIds]),
    }),
    budget: Object.freeze({
      directProjectilesPerCast,
      directProjectilesPerSecond,
      theoreticalConcurrentProjectiles,
      estimatedCostPerSecond: directProjectilesPerSecond * (1 + hitEffects.length * 0.25),
    }),
  };

  return Object.freeze(plan);
}

function collectDescriptors(
  registries: WeaponRecipeCompilerRegistries
): WeaponPrimitiveDescriptorV1[] {
  return [
    ...registries.weaponTriggers.values(),
    ...registries.targetingStrategies.values(),
    ...registries.castOrigins.values(),
    ...registries.emissionPatterns.values(),
    ...registries.projectileMotions.values(),
    ...registries.collisionBehaviors.values(),
    ...registries.hitEffects.values(),
    ...registries.projectileLifecycles.values(),
    ...registries.projectileRenderers.values(),
  ]
    .map((primitive) => primitive.descriptor)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function createWeaponCapabilityCatalog(
  registries: WeaponRecipeCompilerRegistries
): WeaponCapabilityCatalogV1 {
  const primitives = collectDescriptors(registries);
  const modifiers = registries.weaponModifiers.values()
    .map((handler) => handler.descriptor)
    .sort((left, right) => left.id.localeCompare(right.id));
  return Object.freeze({
    catalogVersion: 1,
    primitives: Object.freeze(primitives),
    modifiers: Object.freeze(modifiers),
  });
}
