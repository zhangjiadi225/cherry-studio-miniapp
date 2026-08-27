import {
  Registry,
  assertStableId,
  type ReadonlyRegistry,
} from '../../content/registry/Registry';
import type { WeaponBehaviorHandler } from './weapon/WeaponBehavior';
import type {
  CastOriginPrimitive,
  CollisionBehaviorPrimitive,
  EmissionPatternPrimitive,
  HitEffectPrimitive,
  ProjectileLifecyclePrimitive,
  ProjectileMotionPrimitive,
  ProjectileRenderPrimitive,
  TargetingPrimitive,
  WeaponTriggerPrimitive,
} from '../recipes/weapon/WeaponRuntimePlan';

export interface EnginePluginApi {
  readonly weaponBehaviors: Registry<WeaponBehaviorHandler>;
  readonly weaponTriggers: Registry<WeaponTriggerPrimitive>;
  readonly targetingStrategies: Registry<TargetingPrimitive>;
  readonly castOrigins: Registry<CastOriginPrimitive>;
  readonly emissionPatterns: Registry<EmissionPatternPrimitive>;
  readonly projectileMotions: Registry<ProjectileMotionPrimitive>;
  readonly collisionBehaviors: Registry<CollisionBehaviorPrimitive>;
  readonly hitEffects: Registry<HitEffectPrimitive>;
  readonly projectileLifecycles: Registry<ProjectileLifecyclePrimitive>;
  readonly projectileRenderers: Registry<ProjectileRenderPrimitive>;
}

export interface EnginePlugin {
  readonly id: string;
  readonly version: string;
  register(api: EnginePluginApi): void;
}

export interface EngineRegistrySnapshot {
  readonly pluginIds: readonly string[];
  readonly weaponBehaviors: ReadonlyRegistry<WeaponBehaviorHandler>;
  readonly weaponTriggers: ReadonlyRegistry<WeaponTriggerPrimitive>;
  readonly targetingStrategies: ReadonlyRegistry<TargetingPrimitive>;
  readonly castOrigins: ReadonlyRegistry<CastOriginPrimitive>;
  readonly emissionPatterns: ReadonlyRegistry<EmissionPatternPrimitive>;
  readonly projectileMotions: ReadonlyRegistry<ProjectileMotionPrimitive>;
  readonly collisionBehaviors: ReadonlyRegistry<CollisionBehaviorPrimitive>;
  readonly hitEffects: ReadonlyRegistry<HitEffectPrimitive>;
  readonly projectileLifecycles: ReadonlyRegistry<ProjectileLifecyclePrimitive>;
  readonly projectileRenderers: ReadonlyRegistry<ProjectileRenderPrimitive>;
}

export function buildEngineRegistrySnapshot(
  plugins: readonly EnginePlugin[]
): EngineRegistrySnapshot {
  const pluginIds = new Set<string>();
  const weaponBehaviors = new Registry<WeaponBehaviorHandler>('weapon behaviors');
  const weaponTriggers = new Registry<WeaponTriggerPrimitive>('weapon triggers');
  const targetingStrategies = new Registry<TargetingPrimitive>('targeting strategies');
  const castOrigins = new Registry<CastOriginPrimitive>('cast origins');
  const emissionPatterns = new Registry<EmissionPatternPrimitive>('emission patterns');
  const projectileMotions = new Registry<ProjectileMotionPrimitive>('projectile motions');
  const collisionBehaviors = new Registry<CollisionBehaviorPrimitive>('collision behaviors');
  const hitEffects = new Registry<HitEffectPrimitive>('hit effects');
  const projectileLifecycles = new Registry<ProjectileLifecyclePrimitive>('projectile lifecycles');
  const projectileRenderers = new Registry<ProjectileRenderPrimitive>('projectile renderers');
  const api: EnginePluginApi = Object.freeze({
    weaponBehaviors,
    weaponTriggers,
    targetingStrategies,
    castOrigins,
    emissionPatterns,
    projectileMotions,
    collisionBehaviors,
    hitEffects,
    projectileLifecycles,
    projectileRenderers,
  });

  for (const plugin of plugins) {
    assertStableId(plugin.id);
    if (pluginIds.has(plugin.id)) {
      throw new Error(`Duplicate engine plugin ID: ${plugin.id}`);
    }
    pluginIds.add(plugin.id);
    plugin.register(api);
  }

  return Object.freeze({
    pluginIds: Object.freeze([...pluginIds]),
    weaponBehaviors: weaponBehaviors.freeze(),
    weaponTriggers: weaponTriggers.freeze(),
    targetingStrategies: targetingStrategies.freeze(),
    castOrigins: castOrigins.freeze(),
    emissionPatterns: emissionPatterns.freeze(),
    projectileMotions: projectileMotions.freeze(),
    collisionBehaviors: collisionBehaviors.freeze(),
    hitEffects: hitEffects.freeze(),
    projectileLifecycles: projectileLifecycles.freeze(),
    projectileRenderers: projectileRenderers.freeze(),
  });
}
