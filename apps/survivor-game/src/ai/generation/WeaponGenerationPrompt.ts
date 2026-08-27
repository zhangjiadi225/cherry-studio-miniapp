import { WeaponType } from '../../game/types';
import { WEAPON_DATA } from '../../game/data/weapons';
import type { WeaponCapabilityCatalogV1 } from '../../game/recipes/weapon/WeaponRuntimePlan';
import type { AiMessage } from '../AiGateway';

export const WEAPON_GENERATION_PROMPT_VERSION = 'weapon.v4';

function compactCatalog(catalog: WeaponCapabilityCatalogV1) {
  return {
    catalogVersion: catalog.catalogVersion,
    primitives: catalog.primitives.map((primitive) => ({
      id: primitive.id,
      kind: primitive.kind,
      name: primitive.name,
      description: primitive.description,
      parameterSchema: primitive.parameterSchema,
      compatibility: primitive.compatibility,
      budget: primitive.budget,
    })),
    modifiers: catalog.modifiers
      .map((modifier) => ({
        id: modifier.id,
        phase: modifier.phase,
        name: modifier.name,
        description: modifier.description,
        maxStacks: modifier.maxStacks,
        compatibleFamilies: modifier.compatibleFamilies,
        conflictsWith: modifier.conflictsWith,
      })),
  };
}

export function createWeaponGenerationMessages(
  userIntent: string,
  catalog: WeaponCapabilityCatalogV1
): readonly AiMessage[] {
  const sample = WEAPON_DATA[WeaponType.MAGIC_WAND];
  if (!sample.recipe) throw new Error('Built-in weapon sample is missing its runtime recipe');

  const example = {
    proposalVersion: 1,
    name: sample.name,
    description: sample.desc,
    recipe: sample.recipe,
    progression: {
      maxLevel: sample.maxLevel,
      perLevel: {
        damage: sample.perLevel.damage,
        cooldown: sample.perLevel.cooldown,
        projectileSpeed: sample.perLevel.speed,
      },
    },
    balance: {
      budgetTier: 2,
      intendedRole: 'single-target',
    },
  };

  const system = [
    'You design one declarative weapon for Night Survivor.',
    'Return exactly one JSON object and no explanation or Markdown.',
    'Use only fields shown by the output contract and only registered IDs from the capability catalog.',
    'Respect compatibility requires/conflictsWith and never place a conflicting modifier in allowedIds.',
    'When pairing beam or arc renderers with segment or sector collision, keep their geometry parameters aligned.',
    'Never output code, expressions, URLs, HTML, SVG, CSS, shaders, module paths, app-owned content IDs, timestamps, pack status, or host information.',
    'The game deterministically validates every number, reference, balance limit, and performance limit.',
  ].join(' ');
  const user = JSON.stringify({
    task: 'weapon',
    promptVersion: WEAPON_GENERATION_PROMPT_VERSION,
    userIntent,
    outputContract: {
      proposalVersion: 1,
      name: 'string 1..32',
      description: 'string 1..180',
      recipe: {
        recipeVersion: 1,
        delivery: 'legacy "projectile" or a delivery PrimitiveRef',
        trigger: 'PrimitiveRef',
        targeting: 'PrimitiveRef',
        emission: {
          emitterId: 'builtin.emitter.projectile',
          schedule: 'emission-schedule PrimitiveRef?',
          origin: 'PrimitiveRef',
          count: 'integer',
          burstCount: 'integer 1..8 matching schedule',
          burstInterval: 'number matching schedule; 0 for single or >=0.03 for burst',
          pattern: 'PrimitiveRef',
        },
        feedback: 'feedback PrimitiveRef[]?',
        projectile: {
          damage: 'number', radius: 'number', speed: 'number', lifetime: 'number',
          pierce: 'integer', knockback: 'number', motion: 'PrimitiveRef',
          collision: 'PrimitiveRef', hitEffects: 'PrimitiveRef[]', lifecycle: 'PrimitiveRef[]',
          visual: {
            body: 'PrimitiveRef',
            palette: { primary: '#RRGGBB', secondary: '#RRGGBB?', accent: '#RRGGBB?' },
            scale: 'number', opacity: 'number', glow: 'bounded object?',
            layers: 'PrimitiveRef[]', trail: 'PrimitiveRef?',
            emitters: 'particle PrimitiveRef[]?',
          },
        },
        modifierPolicy: { allowedIds: 'registered modifier ID[]', deniedIds: 'registered modifier ID[]' },
      },
      progression: {
        maxLevel: 'integer 1..8',
        perLevel: 'only damage,cooldown,projectileSpeed,projectileRadius,count,pierce,lifetime,knockback',
      },
      balance: {
        budgetTier: 'integer 1..5',
        intendedRole: 'single-target|area|control|defense|hybrid',
      },
      PrimitiveRef: { primitiveId: 'registered ID', params: 'closed JSON object matching its parameterSchema' },
    },
    capabilityCatalog: compactCatalog(catalog),
    balancePolicy: {
      baseBoundedDpsLimit: 'damage * maximum hit-effect multiplier * direct projectile rate * bounded periodic ticks/targets <= 45 * budgetTier',
      maxBoundedDpsLimit: 'same bound at max level and all allowed modifiers at max stacks <= 150 * budgetTier',
      maximumEffectiveProjectilesPerCast: 64,
      maximumTheoreticalConcurrentProjectiles: 420,
      maximumDerivedProjectilesPerCast: 96,
      maximumDamageMultiplierPerHit: 64,
      maximumParticleEffects: 4,
      maximumParticlesPerSecond: 320,
      maximumTheoreticalConcurrentParticles: 480,
      particleEffects: 'visual only; they never add damage, control, drops, or child projectiles',
      lifecycle: 'bounded registered lifecycle handlers only; generated children are included in budgets',
      delivery: 'family is derived from delivery; combine delivery, origin, motion and collision coherently',
      feedback: 'audio/camera/particle feedback is presentation-only and cannot change combat state',
      damageEffect: 'hitEffects must include builtin.effect.damage exactly once',
    },
    validRuntimeExample: example,
  });
  return Object.freeze([
    Object.freeze({ role: 'system', content: system }),
    Object.freeze({ role: 'user', content: user }),
  ]);
}
