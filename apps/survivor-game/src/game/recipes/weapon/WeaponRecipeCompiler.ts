import { assertStableId, type ReadonlyRegistry } from '../../../content/registry/Registry';
import {
  WeaponPrimitiveParameterError,
  type CastOriginPrimitive,
  type CollisionBehaviorPrimitive,
  type EmissionSchedulePrimitive,
  type EmissionPatternPrimitive,
  type HitEffectPrimitive,
  type ProjectileLifecyclePrimitive,
  type ProjectileMotionPrimitive,
  type ProjectileParticlePrimitive,
  type ProjectileRenderPrimitive,
  type ResolvedProjectileRenderPrimitive,
  type TargetingPrimitive,
  type TrustedWeaponModifierHandler,
  type WeaponCapabilityCatalogV1,
  type WeaponDeliveryPrimitive,
  type WeaponFeedbackPrimitive,
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
import { CoreAdvancedWeaponPrimitiveId } from '../../behaviors/weapon/CoreAdvancedWeaponPrimitives';

const MAX_DIRECT_PROJECTILES_PER_CAST = 64;
const MAX_THEORETICAL_CONCURRENT_PROJECTILES = 420;
const MAX_HIT_EFFECTS = 8;
const MAX_LIFECYCLE_EFFECTS = 6;
const MAX_RENDER_LAYERS = 8;
const MAX_PARTICLE_EFFECTS = 4;
const MAX_FEEDBACK_EFFECTS = 6;
const MAX_DERIVED_PROJECTILES_PER_CAST = 96;
const MAX_DAMAGE_MULTIPLIER_PER_HIT = 64;
const MAX_PARTICLES_PER_SECOND = 320;
const MAX_THEORETICAL_CONCURRENT_PARTICLES = 480;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

function hashStableString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type WeaponRecipeCompileErrorCode =
  | 'INVALID_RECIPE'
  | 'UNKNOWN_PRIMITIVE'
  | 'UNKNOWN_PRIMITIVE_PARAM'
  | 'MISSING_PRIMITIVE_PARAM'
  | 'INVALID_PRIMITIVE_PARAM'
  | 'INCOMPATIBLE_PRIMITIVES'
  | 'PROJECTILES_PER_CAST_EXCEEDED'
  | 'PROJECTILE_CONCURRENCY_EXCEEDED'
  | 'PARTICLE_BUDGET_EXCEEDED'
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
  readonly weaponDeliveries: ReadonlyRegistry<WeaponDeliveryPrimitive>;
  readonly targetingStrategies: ReadonlyRegistry<TargetingPrimitive>;
  readonly castOrigins: ReadonlyRegistry<CastOriginPrimitive>;
  readonly emissionSchedules: ReadonlyRegistry<EmissionSchedulePrimitive>;
  readonly emissionPatterns: ReadonlyRegistry<EmissionPatternPrimitive>;
  readonly projectileMotions: ReadonlyRegistry<ProjectileMotionPrimitive>;
  readonly collisionBehaviors: ReadonlyRegistry<CollisionBehaviorPrimitive>;
  readonly hitEffects: ReadonlyRegistry<HitEffectPrimitive>;
  readonly projectileLifecycles: ReadonlyRegistry<ProjectileLifecyclePrimitive>;
  readonly projectileRenderers: ReadonlyRegistry<ProjectileRenderPrimitive>;
  readonly projectileParticleEffects: ReadonlyRegistry<ProjectileParticlePrimitive>;
  readonly weaponFeedbackEffects: ReadonlyRegistry<WeaponFeedbackPrimitive>;
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
  if ((recipe.emitters?.length ?? 0) > MAX_PARTICLE_EFFECTS) {
    fail('projectile.visual.emitters', `maximum ${MAX_PARTICLE_EFFECTS} effects`);
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
  const emitters = (recipe.emitters ?? []).map((ref, index) =>
    resolvePrimitive(
      registries.projectileParticleEffects,
      ref,
      `projectile.visual.emitters[${index}]`
    )
  );
  if (emitters.filter((effect) => effect.event === 'trail').length > 1) {
    fail('projectile.visual.emitters', 'maximum one trail particle effect');
  }

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
    emitters: Object.freeze(emitters),
  });
}

function collectRecipePrimitiveIds(recipe: ProjectileWeaponRecipeV1): ReadonlySet<string> {
  const refs = [
    ...(recipe.delivery === 'projectile' ? [] : [recipe.delivery]),
    recipe.trigger,
    recipe.targeting,
    ...(recipe.emission.schedule ? [recipe.emission.schedule] : []),
    recipe.emission.origin,
    recipe.emission.pattern,
    recipe.projectile.motion,
    recipe.projectile.collision,
    ...recipe.projectile.hitEffects,
    ...recipe.projectile.lifecycle,
    recipe.projectile.visual.body,
    ...recipe.projectile.visual.layers,
    ...(recipe.projectile.visual.trail ? [recipe.projectile.visual.trail] : []),
    ...(recipe.projectile.visual.particles ? [recipe.projectile.visual.particles] : []),
    ...(recipe.projectile.visual.emitters ?? []),
    ...(recipe.feedback ?? []),
  ];
  const ids = new Set(refs.map((ref) => ref.primitiveId));
  if (recipe.delivery === 'projectile') {
    ids.add(CoreAdvancedWeaponPrimitiveId.DELIVERY_PROJECTILE);
  }
  return ids;
}

function getDeliveryRef(recipe: ProjectileWeaponRecipeV1): PrimitiveRefV1 {
  return recipe.delivery === 'projectile'
    ? Object.freeze({
        primitiveId: CoreAdvancedWeaponPrimitiveId.DELIVERY_PROJECTILE,
        params: Object.freeze({}),
      })
    : recipe.delivery;
}

function getScheduleRef(recipe: ProjectileWeaponRecipeV1): PrimitiveRefV1 {
  if (recipe.emission.schedule) return recipe.emission.schedule;
  return recipe.emission.burstCount === 1
    ? Object.freeze({
        primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE,
        params: Object.freeze({}),
      })
    : Object.freeze({
        primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_BURST,
        params: Object.freeze({
          burstCount: recipe.emission.burstCount,
          burstInterval: recipe.emission.burstInterval,
        }),
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
  const delivery = resolvePrimitive(registries.weaponDeliveries, getDeliveryRef(recipe), 'delivery');
  if (delivery.activationDelay >= stats.lifetime) {
    fail('delivery', 'activation delay must be shorter than projectile lifetime');
  }
  const schedule = resolvePrimitive(registries.emissionSchedules, getScheduleRef(recipe), 'emission.schedule');
  if (
    schedule.burstCount !== recipe.emission.burstCount ||
    schedule.burstInterval !== recipe.emission.burstInterval
  ) {
    fail('emission.schedule', 'schedule params must match burstCount and burstInterval');
  }
  if (schedule.burstCount === 1 && schedule.burstInterval !== 0) {
    fail('emission.burstInterval', 'single emission requires burstInterval 0');
  }
  if (schedule.burstCount > 1 && schedule.burstInterval < 0.03) {
    fail('emission.burstInterval', 'burst emission requires interval >= 0.03');
  }
  const castCycleDuration = stats.cooldown + baseTrigger.chargeDuration;
  if ((schedule.burstCount - 1) * schedule.burstInterval >= castCycleDuration) {
    fail('emission', 'burst duration must be shorter than the trigger cycle');
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
  if (
    lifecycle.some((effect) =>
      effect.primitiveId === CoreAdvancedWeaponPrimitiveId.LIFECYCLE_BOUNCE
    ) && stats.pierce !== 0
  ) {
    fail('projectile.pierce', 'lifecycle bounce requires pierce 0');
  }
  if (collision.repeatHitInterval > 0 && stats.pierce !== 0) {
    fail('projectile.pierce', 'periodic collision requires pierce 0');
  }
  const visual = compileVisual(recipe.projectile.visual, registries);
  if ((recipe.feedback?.length ?? 0) > MAX_FEEDBACK_EFFECTS) {
    fail('feedback', `maximum ${MAX_FEEDBACK_EFFECTS} effects`);
  }
  const feedback = (recipe.feedback ?? []).map((ref, index) =>
    resolvePrimitive(registries.weaponFeedbackEffects, ref, `feedback[${index}]`)
  );
  if (feedback.some((effect) => effect.event === 'charge') && trigger.chargeDuration === 0) {
    fail('feedback', 'charge feedback requires a charge trigger');
  }

  const castMultiplier = assertFiniteInRange(
    options.castMultiplier ?? 1,
    'modifiers.castMultiplier',
    1,
    16,
    true
  );
  const directProjectilesPerCast = stats.count * schedule.burstCount * castMultiplier;
  if (directProjectilesPerCast > MAX_DIRECT_PROJECTILES_PER_CAST) {
    throw new WeaponRecipeCompileError(
      'PROJECTILES_PER_CAST_EXCEEDED',
      'emission',
      `${directProjectilesPerCast} exceeds ${MAX_DIRECT_PROJECTILES_PER_CAST}`
    );
  }
  let maximumDerivedProjectilesPerCast = 0;
  const lifecycleBranchingFactor = lifecycle.reduce(
    (total, effect) => total + effect.maximumChildren,
    0
  );
  const lifecycleMaximumDepth = lifecycle.reduce(
    (maximum, effect) => Math.max(maximum, effect.maximumDepth),
    0
  );
  let generationSize = directProjectilesPerCast;
  for (let depth = 0; depth < lifecycleMaximumDepth; depth++) {
    generationSize *= lifecycleBranchingFactor;
    maximumDerivedProjectilesPerCast += generationSize;
    if (maximumDerivedProjectilesPerCast > MAX_DERIVED_PROJECTILES_PER_CAST) break;
  }
  if (maximumDerivedProjectilesPerCast > MAX_DERIVED_PROJECTILES_PER_CAST) {
    throw new WeaponRecipeCompileError(
      'PROJECTILES_PER_CAST_EXCEEDED',
      'projectile.lifecycle',
      `${maximumDerivedProjectilesPerCast} derived projectiles exceed ${MAX_DERIVED_PROJECTILES_PER_CAST}`
    );
  }
  const maximumDamageMultiplierPerHit = hitEffects.reduce(
    (total, effect) => total + effect.maximumDamageMultiplier,
    0
  );
  if (maximumDamageMultiplierPerHit > MAX_DAMAGE_MULTIPLIER_PER_HIT) {
    fail(
      'projectile.hitEffects',
      `${maximumDamageMultiplierPerHit} damage multiplier exceeds ${MAX_DAMAGE_MULTIPLIER_PER_HIT}`
    );
  }
  const directProjectilesPerSecond = directProjectilesPerCast / castCycleDuration;
  const allProjectilesPerSecond =
    (directProjectilesPerCast + maximumDerivedProjectilesPerCast) / castCycleDuration;
  const theoreticalConcurrentProjectiles = Math.ceil(allProjectilesPerSecond * stats.lifetime);
  if (theoreticalConcurrentProjectiles > MAX_THEORETICAL_CONCURRENT_PROJECTILES) {
    throw new WeaponRecipeCompileError(
      'PROJECTILE_CONCURRENCY_EXCEEDED',
      'projectile.lifetime',
      `${theoreticalConcurrentProjectiles} exceeds ${MAX_THEORETICAL_CONCURRENT_PROJECTILES}`
    );
  }
  let estimatedParticlesPerSecond = 0;
  let theoreticalConcurrentParticles = 0;
  const maximumHitEventsPerProjectile = collision.repeatHitInterval > 0
    ? Math.min(8, Math.ceil(stats.lifetime / collision.repeatHitInterval)) *
      collision.maximumTargetsPerTick
    : stats.pierce + 1;
  for (const effect of visual.emitters) {
    let emissionsPerSecond: number;
    switch (effect.event) {
      case 'spawn':
        emissionsPerSecond = allProjectilesPerSecond;
        break;
      case 'trail':
        emissionsPerSecond = theoreticalConcurrentProjectiles / effect.emissionInterval;
        break;
      case 'hit':
      case 'kill':
        emissionsPerSecond = allProjectilesPerSecond * maximumHitEventsPerProjectile;
        break;
      case 'expire':
        emissionsPerSecond = allProjectilesPerSecond;
        break;
    }
    const particlesPerSecond = emissionsPerSecond * effect.particlesPerEmission;
    estimatedParticlesPerSecond += particlesPerSecond;
    theoreticalConcurrentParticles += Math.ceil(
      particlesPerSecond * effect.maxParticleLifetime
    );
  }
  if (
    estimatedParticlesPerSecond > MAX_PARTICLES_PER_SECOND ||
    theoreticalConcurrentParticles > MAX_THEORETICAL_CONCURRENT_PARTICLES
  ) {
    throw new WeaponRecipeCompileError(
      'PARTICLE_BUDGET_EXCEEDED',
      'projectile.visual.emitters',
      `${estimatedParticlesPerSecond.toFixed(1)} particles/s and ` +
        `${theoreticalConcurrentParticles} concurrent exceed ` +
      `${MAX_PARTICLES_PER_SECOND}/s or ${MAX_THEORETICAL_CONCURRENT_PARTICLES} concurrent`
    );
  }
  const estimatedFeedbackCostPerSecond = feedback.reduce((total, effect) => {
    let eventRate: number;
    switch (effect.event) {
      case 'charge':
      case 'cast':
        eventRate = 1 / castCycleDuration;
        break;
      case 'hit':
      case 'kill':
        eventRate = allProjectilesPerSecond * maximumHitEventsPerProjectile;
        break;
      case 'expire':
        eventRate = allProjectilesPerSecond;
        break;
    }
    return total + eventRate * effect.estimatedCost;
  }, 0);

  const allowedModifierIds = new Set(recipe.modifierPolicy.allowedIds);
  const deniedModifierIds = new Set(recipe.modifierPolicy.deniedIds);
  const recipePrimitiveIds = collectRecipePrimitiveIds(recipe);
  const primitiveDescriptors = collectDescriptors(registries);
  for (const primitive of primitiveDescriptors) {
    if (!recipePrimitiveIds.has(primitive.id)) continue;
    const missing = primitive.compatibility.requires.find((id) => !recipePrimitiveIds.has(id));
    if (missing) {
      throw new WeaponRecipeCompileError(
        'INCOMPATIBLE_PRIMITIVES',
        'recipe',
        `primitive "${primitive.id}" requires "${missing}"`
      );
    }
    const conflict = primitive.compatibility.conflictsWith.find((id) => recipePrimitiveIds.has(id));
    if (conflict) {
      throw new WeaponRecipeCompileError(
        'INCOMPATIBLE_PRIMITIVES',
        'recipe',
        `primitive "${primitive.id}" conflicts with "${conflict}"`
      );
    }
  }
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
    if (!handler.descriptor.compatibleFamilies.includes(delivery.family)) {
      fail('modifierPolicy', `modifier "${id}" is incompatible with ${delivery.family} weapons`);
    }
    const conflictingPrimitiveId = handler.descriptor.conflictsWith.find((primitiveId) =>
      recipePrimitiveIds.has(primitiveId)
    );
    if (allowedModifierIds.has(id) && conflictingPrimitiveId) {
      throw new WeaponRecipeCompileError(
        'INCOMPATIBLE_PRIMITIVES',
        'modifierPolicy.allowedIds',
        `modifier "${id}" conflicts with "${conflictingPrimitiveId}"`
      );
    }
    if (allowedModifierIds.has(id) && deniedModifierIds.has(id)) {
      fail('modifierPolicy', `modifier "${id}" cannot be both allowed and denied`);
    }
  }

  const plan: WeaponRuntimePlan = {
    definitionId,
    definitionHash: hashStableString(definitionId),
    delivery,
    trigger,
    targeting,
    emission: Object.freeze({
      emitterId: recipe.emission.emitterId,
      schedule,
      origin,
      count: stats.count,
      burstCount: recipe.emission.burstCount,
      burstInterval: recipe.emission.burstInterval,
      pattern,
    }),
    feedback: Object.freeze(feedback),
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
      estimatedParticlesPerSecond,
      theoreticalConcurrentParticles,
      maximumDerivedProjectilesPerCast,
      maximumDamageMultiplierPerHit,
      estimatedCostPerSecond:
        directProjectilesPerSecond * (1 + hitEffects.length * 0.25) +
        estimatedParticlesPerSecond * 0.05 +
        estimatedFeedbackCostPerSecond,
    }),
  };

  return Object.freeze(plan);
}

function collectDescriptors(
  registries: WeaponRecipeCompilerRegistries
): WeaponPrimitiveDescriptorV1[] {
  return [
    ...registries.weaponTriggers.values(),
    ...registries.weaponDeliveries.values(),
    ...registries.targetingStrategies.values(),
    ...registries.castOrigins.values(),
    ...registries.emissionSchedules.values(),
    ...registries.emissionPatterns.values(),
    ...registries.projectileMotions.values(),
    ...registries.collisionBehaviors.values(),
    ...registries.hitEffects.values(),
    ...registries.projectileLifecycles.values(),
    ...registries.projectileRenderers.values(),
    ...registries.projectileParticleEffects.values(),
    ...registries.weaponFeedbackEffects.values(),
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
