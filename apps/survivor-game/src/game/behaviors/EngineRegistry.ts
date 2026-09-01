import {
  Registry,
  assertStableId,
  type ReadonlyRegistry,
} from '../../content/registry/Registry';
import type { WeaponBehaviorHandler } from './weapon/WeaponBehavior';
import type {
  CastOriginPrimitive,
  CollisionBehaviorPrimitive,
  EmissionSchedulePrimitive,
  EmissionPatternPrimitive,
  HitEffectPrimitive,
  ProjectileLifecyclePrimitive,
  ProjectileMotionPrimitive,
  ProjectileParticlePrimitive,
  ProjectileRenderPrimitive,
  TargetingPrimitive,
  TrustedWeaponModifierHandler,
  WeaponDeliveryPrimitive,
  WeaponFeedbackPrimitive,
  WeaponTriggerPrimitive,
} from '../recipes/weapon/WeaponRuntimePlan';

export interface EnginePluginApi {
  readonly weaponBehaviors: Registry<WeaponBehaviorHandler>;
  readonly weaponTriggers: Registry<WeaponTriggerPrimitive>;
  readonly weaponDeliveries: Registry<WeaponDeliveryPrimitive>;
  readonly targetingStrategies: Registry<TargetingPrimitive>;
  readonly castOrigins: Registry<CastOriginPrimitive>;
  readonly emissionSchedules: Registry<EmissionSchedulePrimitive>;
  readonly emissionPatterns: Registry<EmissionPatternPrimitive>;
  readonly projectileMotions: Registry<ProjectileMotionPrimitive>;
  readonly collisionBehaviors: Registry<CollisionBehaviorPrimitive>;
  readonly hitEffects: Registry<HitEffectPrimitive>;
  readonly projectileLifecycles: Registry<ProjectileLifecyclePrimitive>;
  readonly projectileRenderers: Registry<ProjectileRenderPrimitive>;
  readonly projectileParticleEffects: Registry<ProjectileParticlePrimitive>;
  readonly weaponFeedbackEffects: Registry<WeaponFeedbackPrimitive>;
  readonly weaponModifiers: Registry<TrustedWeaponModifierHandler>;
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

export function buildEngineRegistrySnapshot(
  plugins: readonly EnginePlugin[]
): EngineRegistrySnapshot {
  const pluginIds = new Set<string>();
  const weaponBehaviors = new Registry<WeaponBehaviorHandler>('weapon behaviors');
  const weaponTriggers = new Registry<WeaponTriggerPrimitive>('weapon triggers');
  const weaponDeliveries = new Registry<WeaponDeliveryPrimitive>('weapon deliveries');
  const targetingStrategies = new Registry<TargetingPrimitive>('targeting strategies');
  const castOrigins = new Registry<CastOriginPrimitive>('cast origins');
  const emissionSchedules = new Registry<EmissionSchedulePrimitive>('emission schedules');
  const emissionPatterns = new Registry<EmissionPatternPrimitive>('emission patterns');
  const projectileMotions = new Registry<ProjectileMotionPrimitive>('projectile motions');
  const collisionBehaviors = new Registry<CollisionBehaviorPrimitive>('collision behaviors');
  const hitEffects = new Registry<HitEffectPrimitive>('hit effects');
  const projectileLifecycles = new Registry<ProjectileLifecyclePrimitive>('projectile lifecycles');
  const projectileRenderers = new Registry<ProjectileRenderPrimitive>('projectile renderers');
  const projectileParticleEffects = new Registry<ProjectileParticlePrimitive>('projectile particle effects');
  const weaponFeedbackEffects = new Registry<WeaponFeedbackPrimitive>('weapon feedback effects');
  const weaponModifiers = new Registry<TrustedWeaponModifierHandler>('weapon modifiers');
  const api: EnginePluginApi = Object.freeze({
    weaponBehaviors,
    weaponTriggers,
    weaponDeliveries,
    targetingStrategies,
    castOrigins,
    emissionSchedules,
    emissionPatterns,
    projectileMotions,
    collisionBehaviors,
    hitEffects,
    projectileLifecycles,
    projectileRenderers,
    projectileParticleEffects,
    weaponFeedbackEffects,
    weaponModifiers,
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
    weaponDeliveries: weaponDeliveries.freeze(),
    targetingStrategies: targetingStrategies.freeze(),
    castOrigins: castOrigins.freeze(),
    emissionSchedules: emissionSchedules.freeze(),
    emissionPatterns: emissionPatterns.freeze(),
    projectileMotions: projectileMotions.freeze(),
    collisionBehaviors: collisionBehaviors.freeze(),
    hitEffects: hitEffects.freeze(),
    projectileLifecycles: projectileLifecycles.freeze(),
    projectileRenderers: projectileRenderers.freeze(),
    projectileParticleEffects: projectileParticleEffects.freeze(),
    weaponFeedbackEffects: weaponFeedbackEffects.freeze(),
    weaponModifiers: weaponModifiers.freeze(),
  });
}
