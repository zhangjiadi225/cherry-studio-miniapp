import { GenericModifierType, WeaponEvolutionId } from '../types';
import { CoreWeaponPrimitiveId } from '../behaviors/weapon/CoreProjectilePrimitives';
import { CoreWeaponModifierId } from '../behaviors/weapon/CoreWeaponModifiers';
import type {
  ProjectileWeaponRecipeV1,
  TrustedWeaponPlanAdjustment,
} from '../recipes/weapon/WeaponRecipe';
import { freezeProjectileWeaponRecipe } from '../recipes/weapon/WeaponRecipe';

export const MAGIC_WAND_RECIPE = freezeProjectileWeaponRecipe({
  recipeVersion: 1,
  delivery: 'projectile',
  trigger: {
    primitiveId: CoreWeaponPrimitiveId.TRIGGER_COOLDOWN,
    params: { cooldown: 1.2 },
  },
  targeting: {
    primitiveId: CoreWeaponPrimitiveId.TARGET_NEAREST,
    params: { range: 800, fallback: 'radial' },
  },
  emission: {
    emitterId: 'builtin.emitter.projectile',
    origin: {
      primitiveId: CoreWeaponPrimitiveId.ORIGIN_FOCUS_RELIC,
      params: {},
    },
    count: 1,
    burstCount: 1,
    burstInterval: 0,
    pattern: {
      primitiveId: CoreWeaponPrimitiveId.PATTERN_SINGLE,
      params: {},
    },
  },
  projectile: {
    damage: 10,
    radius: 8,
    speed: 400,
    lifetime: 2,
    pierce: 0,
    knockback: 30,
    motion: {
      primitiveId: CoreWeaponPrimitiveId.MOTION_STRAIGHT,
      params: {},
    },
    collision: {
      primitiveId: CoreWeaponPrimitiveId.COLLISION_STANDARD,
      params: { stopOnMap: true },
    },
    hitEffects: [
      {
        primitiveId: CoreWeaponPrimitiveId.EFFECT_DAMAGE,
        params: { damageScale: 1 },
      },
      {
        primitiveId: CoreWeaponPrimitiveId.EFFECT_KNOCKBACK,
        params: { knockbackScale: 1 },
      },
    ],
    lifecycle: [],
    visual: {
      body: {
        primitiveId: CoreWeaponPrimitiveId.RENDER_CIRCLE,
        params: { colorSlot: 'primary', radiusScale: 1, opacityScale: 1 },
      },
      palette: {
        primary: '#64b4ff',
        secondary: '#c8e6ff',
        accent: '#ffffff',
      },
      scale: 1,
      opacity: 1,
      glow: {
        color: '#64b4ff',
        radiusScale: 2.5,
        intensity: 0.2,
      },
      layers: [
        {
          primitiveId: CoreWeaponPrimitiveId.RENDER_CIRCLE,
          params: { colorSlot: 'secondary', radiusScale: 0.5, opacityScale: 1 },
        },
      ],
      trail: {
        primitiveId: CoreWeaponPrimitiveId.RENDER_CIRCLE,
        params: {
          colorSlot: 'primary',
          radiusScale: 0.8,
          opacityScale: 0.3,
          velocityOffsetSeconds: -0.02,
        },
      },
    },
  },
  modifierPolicy: {
    allowedIds: [
      CoreWeaponModifierId[GenericModifierType.DOUBLE_CAST],
      CoreWeaponModifierId[GenericModifierType.SPLIT_CORE],
      CoreWeaponModifierId[GenericModifierType.REFLECTION_PRISM],
      CoreWeaponModifierId[GenericModifierType.CHAIN_CONDUCTOR],
      CoreWeaponModifierId[GenericModifierType.IMPACT_PULSE],
      CoreWeaponModifierId[GenericModifierType.VELOCITY_RUNE],
      CoreWeaponModifierId[GenericModifierType.ORBITAL_CORE],
      CoreWeaponModifierId[GenericModifierType.DEATH_BURST],
    ],
    deniedIds: [],
  },
} as const satisfies ProjectileWeaponRecipeV1);

export const MAGIC_WAND_RECIPE_EVOLUTION_ADJUSTMENTS: Partial<
  Record<WeaponEvolutionId, readonly TrustedWeaponPlanAdjustment[]>
> = Object.freeze({
  [WeaponEvolutionId.MAGIC_TWIN]: Object.freeze([
    Object.freeze({ operation: 'add', stat: 'count', value: 1 }),
  ]),
  [WeaponEvolutionId.MAGIC_PIERCER]: Object.freeze([
    Object.freeze({ operation: 'add', stat: 'pierce', value: 2 }),
    Object.freeze({ operation: 'multiply', stat: 'radius', value: 1.12 }),
  ]),
  [WeaponEvolutionId.MAGIC_VOLLEY]: Object.freeze([
    Object.freeze({ operation: 'add', stat: 'count', value: 2 }),
  ]),
  [WeaponEvolutionId.MAGIC_FOCUS]: Object.freeze([
    Object.freeze({ operation: 'multiply', stat: 'damage', value: 1.22 }),
    Object.freeze({ operation: 'multiply', stat: 'speed', value: 1.18 }),
    Object.freeze({ operation: 'multiply', stat: 'radius', value: 1.08 }),
    Object.freeze({ operation: 'add', stat: 'pierce', value: 1 }),
  ]),
});
