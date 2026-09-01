import { GENERIC_MODIFIER_DATA } from '../../data/modifiers';
import { GenericModifierType, type ModifierEffect } from '../../types';
import type { EnginePlugin } from '../EngineRegistry';
import type {
  TrustedWeaponModifierHandler,
  WeaponModifierPhase,
} from '../../recipes/weapon/WeaponRuntimePlan';
import type { TrustedWeaponPlanAdjustment } from '../../recipes/weapon/WeaponRecipe';

export const CoreWeaponModifierId: Readonly<Record<GenericModifierType, string>> = Object.freeze({
  [GenericModifierType.DOUBLE_CAST]: 'builtin.modifier.double-cast',
  [GenericModifierType.SPLIT_CORE]: 'builtin.modifier.double-shot',
  [GenericModifierType.REFLECTION_PRISM]: 'builtin.modifier.reflection-prism',
  [GenericModifierType.CHAIN_CONDUCTOR]: 'builtin.modifier.chain-conductor',
  [GenericModifierType.IMPACT_PULSE]: 'builtin.modifier.impact-pulse',
  [GenericModifierType.REPULSION_FIELD]: 'builtin.modifier.repulsion-field',
  [GenericModifierType.VELOCITY_RUNE]: 'builtin.modifier.velocity-rune',
  [GenericModifierType.ORBITAL_CORE]: 'builtin.modifier.orbital-core',
  [GenericModifierType.DEATH_BURST]: 'builtin.modifier.death-burst',
});

const MODIFIER_PHASE: Record<ModifierEffect, WeaponModifierPhase> = {
  extraCast: 'emission-structural',
  split: 'emission-structural',
  reflect: 'lifecycle',
  chain: 'hit-effect',
  pulse: 'hit-effect',
  knockback: 'hit-effect',
  projectileSpeed: 'stat-multiplicative',
  projectileOrbit: 'projectile-structural',
  deathExplosion: 'lifecycle',
};

const EMPTY_ADJUSTMENTS = Object.freeze([]) as readonly TrustedWeaponPlanAdjustment[];

function getAdjustments(
  type: GenericModifierType,
  stacks: number
): readonly TrustedWeaponPlanAdjustment[] {
  if (stacks <= 0) return EMPTY_ADJUSTMENTS;
  switch (type) {
    case GenericModifierType.SPLIT_CORE:
      return Object.freeze([Object.freeze({
        operation: 'multiply' as const,
        stat: 'count' as const,
        value: 2 ** stacks,
      })]);
    case GenericModifierType.VELOCITY_RUNE:
      return Object.freeze([Object.freeze({
        operation: 'multiply' as const,
        stat: 'speed' as const,
        value: 1.28 ** stacks,
      })]);
    default:
      return EMPTY_ADJUSTMENTS;
  }
}

export const CORE_WEAPON_MODIFIER_PLUGIN: EnginePlugin = Object.freeze<EnginePlugin>({
  id: 'builtin.plugin.weapon-modifiers',
  version: '1.0.0',
  register(api) {
    for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
      const stableId = CoreWeaponModifierId[modifier.id];
      const handler: TrustedWeaponModifierHandler = Object.freeze<TrustedWeaponModifierHandler>({
        legacyType: modifier.id,
        descriptor: Object.freeze({
          id: stableId,
          version: '1.0.0',
          phase: MODIFIER_PHASE[modifier.effect],
          name: modifier.name,
          description: modifier.desc,
          maxStacks: modifier.maxStacks,
          compatibleFamilies: Object.freeze([...modifier.compatibleFamilies]),
          conflictsWith: modifier.id === GenericModifierType.ORBITAL_CORE
            ? Object.freeze(['builtin.motion.orbit-player'])
            : Object.freeze([]),
          estimatedCostPerStack: modifier.priceTier,
        }),
        getAdjustments(stacks) {
          return getAdjustments(modifier.id, stacks);
        },
        getCastMultiplier(stacks) {
          return modifier.id === GenericModifierType.DOUBLE_CAST ? 2 ** stacks : 1;
        },
      });
      api.weaponModifiers.register(stableId, handler);
    }
  },
});

export function getCoreWeaponModifierId(type: GenericModifierType): string {
  return CoreWeaponModifierId[type];
}
