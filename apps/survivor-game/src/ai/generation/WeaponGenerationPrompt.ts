import type { ContentValidationIssue } from '../../content/schema/ContentPackValidator';
import { CoreAdvancedWeaponPrimitiveId } from '../../game/behaviors/weapon/CoreAdvancedWeaponPrimitives';
import { WEAPON_DATA } from '../../game/data/weapons';
import type { WeaponCapabilityCatalogV1 } from '../../game/recipes/weapon/WeaponRuntimePlan';
import { WeaponType } from '../../game/types';
import type { AiMessage } from '../AiGateway';
import {
  createFallbackWeaponGenerationPlan,
  getWeaponFamilyDeliveryId,
  type WeaponGenerationPlanV1,
} from './WeaponGenerationContract';

export const WEAPON_PLANNING_PROMPT_VERSION = 'weapon-plan.v1';
export const WEAPON_GENERATION_PROMPT_VERSION = 'weapon.v5';
export const WEAPON_REPAIR_PROMPT_VERSION = 'weapon-repair.v1';

function createRuntimeDraftExample() {
  const sample = WEAPON_DATA[WeaponType.MAGIC_WAND];
  if (!sample.recipe) throw new Error('Built-in weapon sample is missing its runtime recipe');
  const {
    recipeVersion: _recipeVersion,
    delivery: _delivery,
    emission,
    ...recipe
  } = sample.recipe;
  const {
    emitterId: _emitterId,
    burstCount: _burstCount,
    burstInterval: _burstInterval,
    ...draftEmission
  } = emission;
  const schedule = emission.schedule ?? (
    emission.burstCount === 1
      ? { primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE, params: {} }
      : {
          primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_BURST,
          params: {
            burstCount: emission.burstCount,
            burstInterval: emission.burstInterval,
          },
        }
  );
  return {
    name: sample.name,
    description: sample.desc,
    recipe: { ...recipe, emission: { ...draftEmission, schedule } },
    progression: {
      maxLevel: sample.maxLevel,
      perLevel: {
        damage: sample.perLevel.damage,
        cooldown: sample.perLevel.cooldown,
        projectileSpeed: sample.perLevel.speed,
      },
    },
    balance: { budgetTier: 2, intendedRole: 'single-target' },
  };
}

function compactPlanningCatalog(catalog: WeaponCapabilityCatalogV1) {
  return {
    catalogVersion: catalog.catalogVersion,
    primitives: catalog.primitives.map((primitive) => ({
      id: primitive.id,
      kind: primitive.kind,
      name: primitive.name,
      description: primitive.description,
      tags: primitive.compatibility.tags,
    })),
  };
}

function compactCatalog(catalog: WeaponCapabilityCatalogV1) {
  return {
    catalogVersion: catalog.catalogVersion,
    primitives: catalog.primitives.map((primitive) => ({
      id: primitive.id,
      kind: primitive.kind,
      name: primitive.name,
      description: primitive.description,
      params: {
        allowedKeys: primitive.parameterSchema.allowedKeys,
        requiredKeys: primitive.parameterSchema.requiredKeys,
        numericBounds: primitive.parameterSchema.numericBounds,
        enumValues: primitive.parameterSchema.enumValues,
        booleanKeys: primitive.parameterSchema.booleanKeys,
      },
      requires: primitive.compatibility.requires,
      conflictsWith: primitive.compatibility.conflictsWith,
      tags: primitive.compatibility.tags,
      budget: primitive.budget,
    })),
    modifiers: catalog.modifiers.map((modifier) => ({
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

function compactOutputContract() {
  return {
    name: 'string 1..32',
    description: 'string 1..180',
    recipe: {
      trigger: 'PrimitiveRef',
      targeting: 'PrimitiveRef',
      emission: {
        schedule: 'emission-schedule PrimitiveRef',
        origin: 'cast-origin PrimitiveRef',
        count: 'integer 1..64',
        pattern: 'emission-pattern PrimitiveRef',
      },
      projectile: {
        damage: 'number 1..100000',
        radius: 'number 1..128',
        speed: 'number 0..2400',
        lifetime: 'number 0.05..30',
        pierce: 'integer 0..999',
        knockback: 'number 0..1200',
        motion: 'projectile-motion PrimitiveRef',
        collision: 'collision PrimitiveRef',
        hitEffects: 'hit-effect PrimitiveRef[]; exactly one builtin.effect.damage',
        lifecycle: 'lifecycle PrimitiveRef[]',
        visual: {
          body: 'render PrimitiveRef',
          palette: { primary: '#RRGGBB', secondary: '#RRGGBB?', accent: '#RRGGBB?' },
          scale: 'number 0.25..4',
          opacity: 'number 0..1',
          glow: { color: '#RRGGBB', radiusScale: 'number 0.1..8', intensity: 'number 0..1' },
          layers: 'render PrimitiveRef[]',
          trail: 'render PrimitiveRef?',
          emitters: 'particle PrimitiveRef[]?',
        },
      },
      feedback: 'feedback PrimitiveRef[]?',
      modifierPolicy: {
        allowedIds: 'compatible modifier ID[]; prefer [] or at most two IDs',
        deniedIds: 'compatible modifier ID[]; usually []',
      },
    },
    progression: {
      maxLevel: 'integer 1..8',
      perLevel: 'closed object using only damage,cooldown,projectileSpeed,projectileRadius,count,pierce,lifetime,knockback',
    },
    balance: {
      budgetTier: 'integer 1..5',
      intendedRole: 'single-target|area|control|defense|hybrid',
    },
    PrimitiveRef: {
      primitiveId: 'one ID from capabilityCatalog of the required kind',
      params: 'closed JSON object matching that primitive params contract',
    },
  };
}

function generationSystemMessage(): string {
  return [
    'You design one declarative weapon draft for Night Survivor.',
    'Return exactly one JSON object and no explanation or Markdown.',
    'Use only fields shown by outputContract and only IDs from capabilityCatalog.',
    'The app injects proposalVersion, recipeVersion, delivery, emitterId, burstCount and burstInterval; never output those fields.',
    'Respect requires/conflictsWith and keep renderer geometry equal to matching segment or sector collision geometry.',
    'Use conservative numbers. Prefer no modifiers because every allowed modifier is budgeted at maximum stacks.',
    'Never output code, expressions, URLs, HTML, SVG, CSS, shaders, module paths, timestamps or host information.',
    'Keep the response below 12000 characters.',
  ].join(' ');
}

export function createWeaponPlanningMessages(
  userIntent: string,
  catalog: WeaponCapabilityCatalogV1
): readonly AiMessage[] {
  const fallbackPlan = createFallbackWeaponGenerationPlan(userIntent, catalog);
  const system = [
    'Route one Night Survivor weapon request to a small declarative capability subset.',
    'Return exactly one JSON object and no explanation or Markdown.',
    'Select one supported family and at most 12 primitive IDs that materially implement the request.',
    'Do not choose IDs merely for variety. Do not output parameters or combat numbers.',
  ].join(' ');
  const user = JSON.stringify({
    task: 'weapon-plan',
    promptVersion: WEAPON_PLANNING_PROMPT_VERSION,
    userIntent,
    outputContract: {
      planVersion: 1,
      family: 'projectile|zone|aura|strike|swing',
      intendedRole: 'single-target|area|control|defense|hybrid',
      primitiveIds: 'unique registered primitive ID[]; maximum 12',
    },
    capabilityCatalog: compactPlanningCatalog(catalog),
    fallbackPlan,
  });
  return Object.freeze([
    Object.freeze({ role: 'system', content: system }),
    Object.freeze({ role: 'user', content: user }),
  ]);
}

export function createWeaponGenerationMessages(
  userIntent: string,
  catalog: WeaponCapabilityCatalogV1,
  plan: WeaponGenerationPlanV1
): readonly AiMessage[] {
  const example = createRuntimeDraftExample();
  const deliveryId = getWeaponFamilyDeliveryId(plan.family);
  const requiredPrimitiveIds = catalog.primitives.find((primitive) =>
    primitive.id === deliveryId
  )?.compatibility.requires ?? [];
  const user = JSON.stringify({
    task: 'weapon',
    promptVersion: WEAPON_GENERATION_PROMPT_VERSION,
    userIntent,
    plan,
    familyProfile: {
      deliveryId,
      requiredPrimitiveIds,
      note: 'The app owns delivery; the recipe must contain all required IDs through the appropriate fields.',
    },
    appInjectedFields: [
      'proposalVersion', 'recipe.recipeVersion', 'recipe.delivery',
      'recipe.emission.emitterId', 'recipe.emission.burstCount', 'recipe.emission.burstInterval',
    ],
    outputContract: compactOutputContract(),
    capabilityCatalog: compactCatalog(catalog),
    balancePolicy: {
      baseBoundedDpsLimit: 'damage * total hit multiplier * projectile rate * periodic target bound <= 45 * budgetTier',
      maxBoundedDpsLimit: 'same bound at max level and every allowed modifier at max stacks <= 150 * budgetTier',
      maximumEffectiveProjectilesPerCast: 64,
      maximumTheoreticalConcurrentProjectiles: 420,
      maximumDerivedProjectilesPerCast: 96,
      maximumDamageMultiplierPerHit: 64,
      maximumParticlesPerSecond: 320,
      maximumTheoreticalConcurrentParticles: 480,
      damageEffect: 'hitEffects contains builtin.effect.damage exactly once with damageScale > 0',
      periodicCollision: 'requires pierce 0 and conservative tickInterval/maxTargetsPerTick',
      lifecycleBounce: 'requires pierce 0',
    },
    runtimeShapeExample: {
      family: 'projectile',
      note: 'This is a field-shape example projected from a real built-in recipe. Use the selected familyProfile instead of copying its family-specific primitive choices.',
      draft: example,
    },
  });
  return Object.freeze([
    Object.freeze({ role: 'system', content: generationSystemMessage() }),
    Object.freeze({ role: 'user', content: user }),
  ]);
}

export function createWeaponRepairMessages(
  userIntent: string,
  invalidDraft: unknown,
  issues: readonly ContentValidationIssue[],
  catalog: WeaponCapabilityCatalogV1,
  plan: WeaponGenerationPlanV1
): readonly AiMessage[] {
  const system = [
    'Repair one invalid Night Survivor weapon draft without redesigning its identity.',
    'Return exactly one corrected JSON object and no explanation or Markdown.',
    'Fix every reported path and also re-check the complete output contract.',
    'Use only allowed primitive and modifier IDs. Use conservative numbers when an issue reports a budget excess.',
    'The app injects proposalVersion, recipeVersion, delivery, emitterId, burstCount and burstInterval; omit them.',
  ].join(' ');
  const user = JSON.stringify({
    task: 'weapon-repair',
    promptVersion: WEAPON_REPAIR_PROMPT_VERSION,
    userIntent,
    plan,
    validationIssues: issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    })),
    invalidDraft,
    outputContract: compactOutputContract(),
    capabilityCatalog: compactCatalog(catalog),
    runtimeShapeExample: {
      family: 'projectile',
      note: 'Use only as a field-shape reference; preserve the selected plan family and required primitives.',
      draft: createRuntimeDraftExample(),
    },
  });
  return Object.freeze([
    Object.freeze({ role: 'system', content: system }),
    Object.freeze({ role: 'user', content: user }),
  ]);
}
