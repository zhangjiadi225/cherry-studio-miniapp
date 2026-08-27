import { assertStableId } from '../registry/Registry';
import {
  CONTENT_PACK_SCHEMA_VERSION,
  WEAPON_PROPOSAL_VERSION,
  type ContentPackV1,
  type WeaponBalanceV1,
  type WeaponBlueprintV1,
  type WeaponGenerationProposalV1,
  type WeaponProgressionV1,
} from './ContentPack';
import type {
  JsonValueV1,
  PrimitiveParamsV1,
  PrimitiveRefV1,
  ProjectileVisualRecipeV1,
  ProjectileWeaponRecipeV1,
} from '../../game/recipes/weapon/WeaponRecipe';
import {
  compileProjectileWeaponRecipe,
  type WeaponRecipeCompilerRegistries,
  type WeaponRecipeRuntimeStats,
} from '../../game/recipes/weapon/WeaponRecipeCompiler';
import { CoreWeaponPrimitiveId } from '../../game/behaviors/weapon/CoreProjectilePrimitives';
import { APP_VERSION } from '../../application/AppVersion';

export type ContentValidationErrorCode =
  | 'INVALID_TYPE'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_VALUE'
  | 'INVALID_ID'
  | 'INVALID_REFERENCE'
  | 'UNSUPPORTED_CONTENT'
  | 'WEAPON_BUDGET_EXCEEDED'
  | 'RECIPE_COMPILE_FAILED';

export interface ContentValidationIssue {
  readonly code: ContentValidationErrorCode;
  readonly path: string;
  readonly message: string;
}

export type ContentValidationResult<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly ContentValidationIssue[] };

class ValidationFailure extends Error {
  constructor(readonly issue: ContentValidationIssue) {
    super(issue.message);
    this.name = 'ValidationFailure';
  }
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RESERVED_TEXT_PATTERN = /<\/?(?:script|style|svg|iframe)|javascript:|data:/i;
const PROPOSAL_KEYS = ['proposalVersion', 'name', 'description', 'recipe', 'progression', 'balance'] as const;
const RECIPE_KEYS = [
  'recipeVersion', 'delivery', 'trigger', 'targeting', 'emission', 'projectile', 'feedback',
  'modifierPolicy',
] as const;

function compareSemver(left: string, right: string): number {
  const parse = (value: string) => {
    const [core, prerelease] = value.split('-', 2);
    const [major, minor, patch] = core.split('.').map(Number);
    return { major, minor, patch, prerelease };
  };
  const a = parse(left);
  const b = parse(right);
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return a.prerelease.localeCompare(b.prerelease, 'en', { numeric: true });
}

function issue(code: ContentValidationErrorCode, path: string, message: string): never {
  throw new ValidationFailure({ code, path, message });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issue('INVALID_TYPE', path, 'expected object');
  }
  return value as Record<string, unknown>;
}

function closedRecord(value: unknown, path: string, allowedKeys: readonly string[]): Record<string, unknown> {
  const result = record(value, path);
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) issue('UNKNOWN_FIELD', `${path}.${key}`, `unknown field "${key}"`);
  }
  return result;
}

function required(value: Record<string, unknown>, key: string, path: string): unknown {
  if (!(key in value)) issue('MISSING_FIELD', `${path}.${key}`, `missing field "${key}"`);
  return value[key];
}

function stringValue(value: unknown, path: string, minLength: number, maxLength: number): string {
  if (typeof value !== 'string') issue('INVALID_TYPE', path, 'expected string');
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    issue('INVALID_VALUE', path, `expected ${minLength}..${maxLength} characters`);
  }
  if (RESERVED_TEXT_PATTERN.test(normalized)) {
    issue('INVALID_VALUE', path, 'executable or embedded markup is not allowed');
  }
  return normalized;
}

function numberValue(
  value: unknown,
  path: string,
  min: number,
  max: number,
  integer = false
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issue('INVALID_TYPE', path, 'expected finite number');
  }
  if (integer && !Number.isInteger(value)) issue('INVALID_VALUE', path, 'expected integer');
  if (value < min || value > max) issue('INVALID_VALUE', path, `expected ${min}..${max}`);
  return value;
}

function enumValue<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issue('INVALID_VALUE', path, `expected ${allowed.join('|')}`);
  }
  return value as T;
}

function arrayValue(value: unknown, path: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) issue('INVALID_TYPE', path, 'expected array');
  if (value.length > maxLength) issue('INVALID_VALUE', path, `maximum ${maxLength} items`);
  return value;
}

function emptyArray(value: unknown, path: string): [] {
  const result = arrayValue(value, path, 0);
  if (result.length !== 0) issue('UNSUPPORTED_CONTENT', path, 'only weapon content is supported');
  return [];
}

function stableId(value: unknown, path: string): string {
  const id = stringValue(value, path, 1, 120);
  try {
    assertStableId(id);
  } catch {
    issue('INVALID_ID', path, 'invalid stable ID');
  }
  return id;
}

function jsonValue(value: unknown, path: string, depth = 0): JsonValueV1 {
  if (depth > 8) issue('INVALID_VALUE', path, 'JSON nesting is too deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) issue('INVALID_VALUE', path, 'expected finite number');
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 32) issue('INVALID_VALUE', path, 'maximum 32 array items');
    return value.map((item, index) => jsonValue(item, `${path}[${index}]`, depth + 1));
  }
  const source = record(value, path);
  const entries = Object.entries(source);
  if (entries.length > 32) issue('INVALID_VALUE', path, 'maximum 32 object fields');
  return Object.fromEntries(entries.map(([key, child]) => {
    if (key.length === 0 || key.length > 64) issue('INVALID_VALUE', `${path}.${key}`, 'invalid key length');
    return [key, jsonValue(child, `${path}.${key}`, depth + 1)];
  }));
}

function primitiveRef(value: unknown, path: string): PrimitiveRefV1 {
  const source = closedRecord(value, path, ['primitiveId', 'params']);
  const paramsValue = jsonValue(required(source, 'params', path), `${path}.params`);
  if (typeof paramsValue !== 'object' || paramsValue === null || Array.isArray(paramsValue)) {
    issue('INVALID_TYPE', `${path}.params`, 'expected object');
  }
  return {
    primitiveId: stableId(required(source, 'primitiveId', path), `${path}.primitiveId`),
    params: paramsValue as PrimitiveParamsV1,
  };
}

function optionalPrimitiveRef(value: unknown, path: string): PrimitiveRefV1 | undefined {
  return value === undefined ? undefined : primitiveRef(value, path);
}

function visualRecipe(value: unknown, path: string): ProjectileVisualRecipeV1 {
  const source = closedRecord(value, path, [
    'body', 'palette', 'scale', 'opacity', 'glow', 'layers', 'trail', 'particles', 'emitters',
  ]);
  const palette = closedRecord(required(source, 'palette', path), `${path}.palette`, ['primary', 'secondary', 'accent']);
  const layers = arrayValue(required(source, 'layers', path), `${path}.layers`, 8);
  const emitters = source.emitters === undefined
    ? []
    : arrayValue(source.emitters, `${path}.emitters`, 4);
  let glow: ProjectileVisualRecipeV1['glow'];
  if (source.glow !== undefined) {
    const rawGlow = closedRecord(source.glow, `${path}.glow`, ['color', 'radiusScale', 'intensity']);
    glow = {
      color: stringValue(required(rawGlow, 'color', `${path}.glow`), `${path}.glow.color`, 4, 9),
      radiusScale: numberValue(required(rawGlow, 'radiusScale', `${path}.glow`), `${path}.glow.radiusScale`, 0.1, 8),
      intensity: numberValue(required(rawGlow, 'intensity', `${path}.glow`), `${path}.glow.intensity`, 0, 1),
    };
  }
  return {
    body: primitiveRef(required(source, 'body', path), `${path}.body`),
    palette: {
      primary: stringValue(required(palette, 'primary', `${path}.palette`), `${path}.palette.primary`, 4, 9),
      ...(palette.secondary === undefined ? {} : {
        secondary: stringValue(palette.secondary, `${path}.palette.secondary`, 4, 9),
      }),
      ...(palette.accent === undefined ? {} : {
        accent: stringValue(palette.accent, `${path}.palette.accent`, 4, 9),
      }),
    },
    scale: numberValue(required(source, 'scale', path), `${path}.scale`, 0.25, 4),
    opacity: numberValue(required(source, 'opacity', path), `${path}.opacity`, 0, 1),
    ...(glow ? { glow } : {}),
    layers: layers.map((item, index) => primitiveRef(item, `${path}.layers[${index}]`)),
    ...(source.trail === undefined ? {} : { trail: optionalPrimitiveRef(source.trail, `${path}.trail`) }),
    ...(source.particles === undefined ? {} : { particles: optionalPrimitiveRef(source.particles, `${path}.particles`) }),
    ...(source.emitters === undefined ? {} : {
      emitters: emitters.map((item, index) => primitiveRef(item, `${path}.emitters[${index}]`)),
    }),
  };
}

function weaponRecipe(value: unknown, path: string): ProjectileWeaponRecipeV1 {
  const source = closedRecord(value, path, RECIPE_KEYS);
  const emission = closedRecord(required(source, 'emission', path), `${path}.emission`, [
    'emitterId', 'schedule', 'origin', 'count', 'burstCount', 'burstInterval', 'pattern',
  ]);
  const projectile = closedRecord(required(source, 'projectile', path), `${path}.projectile`, [
    'damage', 'radius', 'speed', 'lifetime', 'pierce', 'knockback', 'motion', 'collision',
    'hitEffects', 'lifecycle', 'visual',
  ]);
  const modifierPolicy = closedRecord(required(source, 'modifierPolicy', path), `${path}.modifierPolicy`, [
    'allowedIds', 'deniedIds',
  ]);
  const hitEffects = arrayValue(required(projectile, 'hitEffects', `${path}.projectile`), `${path}.projectile.hitEffects`, 8);
  const lifecycle = arrayValue(required(projectile, 'lifecycle', `${path}.projectile`), `${path}.projectile.lifecycle`, 6);
  const allowedIds = arrayValue(required(modifierPolicy, 'allowedIds', `${path}.modifierPolicy`), `${path}.modifierPolicy.allowedIds`, 16);
  const deniedIds = arrayValue(required(modifierPolicy, 'deniedIds', `${path}.modifierPolicy`), `${path}.modifierPolicy.deniedIds`, 16);
  const feedback = source.feedback === undefined
    ? []
    : arrayValue(source.feedback, `${path}.feedback`, 6);

  const parsedHitEffects = hitEffects.map((item, index) =>
    primitiveRef(item, `${path}.projectile.hitEffects[${index}]`)
  );
  const damageEffectCount = parsedHitEffects.filter((ref) =>
    ref.primitiveId === CoreWeaponPrimitiveId.EFFECT_DAMAGE
  ).length;
  if (damageEffectCount !== 1) {
    issue(
      'INVALID_VALUE',
      `${path}.projectile.hitEffects`,
      `expected exactly one ${CoreWeaponPrimitiveId.EFFECT_DAMAGE} effect`
    );
  }
  const damageScale = parsedHitEffects.find((ref) =>
    ref.primitiveId === CoreWeaponPrimitiveId.EFFECT_DAMAGE
  )?.params.damageScale;
  if (damageScale === 0) {
    issue('INVALID_VALUE', `${path}.projectile.hitEffects`, 'damageScale must be greater than zero');
  }

  const rawDelivery = required(source, 'delivery', path);
  const delivery = rawDelivery === 'projectile'
    ? 'projectile' as const
    : primitiveRef(rawDelivery, `${path}.delivery`);

  return {
    recipeVersion: numberValue(required(source, 'recipeVersion', path), `${path}.recipeVersion`, 1, 1, true) as 1,
    delivery,
    trigger: primitiveRef(required(source, 'trigger', path), `${path}.trigger`),
    targeting: primitiveRef(required(source, 'targeting', path), `${path}.targeting`),
    emission: {
      emitterId: enumValue(required(emission, 'emitterId', `${path}.emission`), `${path}.emission.emitterId`, ['builtin.emitter.projectile'] as const),
      ...(emission.schedule === undefined ? {} : {
        schedule: primitiveRef(emission.schedule, `${path}.emission.schedule`),
      }),
      origin: primitiveRef(required(emission, 'origin', `${path}.emission`), `${path}.emission.origin`),
      count: numberValue(required(emission, 'count', `${path}.emission`), `${path}.emission.count`, 1, 64, true),
      burstCount: numberValue(required(emission, 'burstCount', `${path}.emission`), `${path}.emission.burstCount`, 1, 8, true),
      burstInterval: numberValue(required(emission, 'burstInterval', `${path}.emission`), `${path}.emission.burstInterval`, 0, 5),
      pattern: primitiveRef(required(emission, 'pattern', `${path}.emission`), `${path}.emission.pattern`),
    },
    projectile: {
      damage: numberValue(required(projectile, 'damage', `${path}.projectile`), `${path}.projectile.damage`, 1, 100000),
      radius: numberValue(required(projectile, 'radius', `${path}.projectile`), `${path}.projectile.radius`, 1, 128),
      speed: numberValue(required(projectile, 'speed', `${path}.projectile`), `${path}.projectile.speed`, 0, 2400),
      lifetime: numberValue(required(projectile, 'lifetime', `${path}.projectile`), `${path}.projectile.lifetime`, 0.05, 30),
      pierce: numberValue(required(projectile, 'pierce', `${path}.projectile`), `${path}.projectile.pierce`, 0, 999, true),
      knockback: numberValue(required(projectile, 'knockback', `${path}.projectile`), `${path}.projectile.knockback`, 0, 1200),
      motion: primitiveRef(required(projectile, 'motion', `${path}.projectile`), `${path}.projectile.motion`),
      collision: primitiveRef(required(projectile, 'collision', `${path}.projectile`), `${path}.projectile.collision`),
      hitEffects: parsedHitEffects,
      lifecycle: lifecycle.map((item, index) => primitiveRef(item, `${path}.projectile.lifecycle[${index}]`)),
      visual: visualRecipe(required(projectile, 'visual', `${path}.projectile`), `${path}.projectile.visual`),
    },
    ...(source.feedback === undefined ? {} : {
      feedback: feedback.map((item, index) => primitiveRef(item, `${path}.feedback[${index}]`)),
    }),
    modifierPolicy: {
      allowedIds: allowedIds.map((id, index) => stableId(id, `${path}.modifierPolicy.allowedIds[${index}]`)),
      deniedIds: deniedIds.map((id, index) => stableId(id, `${path}.modifierPolicy.deniedIds[${index}]`)),
    },
  };
}

function progression(value: unknown, path: string): WeaponProgressionV1 {
  const source = closedRecord(value, path, ['maxLevel', 'perLevel']);
  const perLevel = closedRecord(required(source, 'perLevel', path), `${path}.perLevel`, [
    'damage', 'cooldown', 'projectileSpeed', 'projectileRadius', 'count', 'pierce', 'lifetime', 'knockback',
  ]);
  const optionalNumber = (key: keyof WeaponProgressionV1['perLevel'], min: number, max: number, integer = false) =>
    perLevel[key] === undefined ? undefined : numberValue(perLevel[key], `${path}.perLevel.${key}`, min, max, integer);
  const damage = optionalNumber('damage', 0, 5000);
  const cooldown = optionalNumber('cooldown', -10, 0);
  const projectileSpeed = optionalNumber('projectileSpeed', 0, 1200);
  const projectileRadius = optionalNumber('projectileRadius', 0, 64);
  const count = optionalNumber('count', 0, 16, true);
  const pierce = optionalNumber('pierce', 0, 64, true);
  const lifetime = optionalNumber('lifetime', 0, 10);
  const knockback = optionalNumber('knockback', 0, 600);
  const hasMeaningfulGrowth = [
    damage, cooldown, projectileSpeed, projectileRadius, count, pierce, lifetime, knockback,
  ].some((value) => value !== undefined && value !== 0);
  const maxLevel = numberValue(required(source, 'maxLevel', path), `${path}.maxLevel`, 1, 8, true);
  if (maxLevel > 1 && !hasMeaningfulGrowth) {
    issue('INVALID_VALUE', `${path}.perLevel`, 'multi-level weapon requires at least one non-zero growth value');
  }
  return {
    maxLevel,
    perLevel: {
      ...(damage === undefined ? {} : { damage }),
      ...(cooldown === undefined ? {} : { cooldown }),
      ...(projectileSpeed === undefined ? {} : { projectileSpeed }),
      ...(projectileRadius === undefined ? {} : { projectileRadius }),
      ...(count === undefined ? {} : { count }),
      ...(pierce === undefined ? {} : { pierce }),
      ...(lifetime === undefined ? {} : { lifetime }),
      ...(knockback === undefined ? {} : { knockback }),
    },
  };
}

function balance(value: unknown, path: string): WeaponBalanceV1 {
  const source = closedRecord(value, path, ['budgetTier', 'intendedRole']);
  return {
    budgetTier: numberValue(required(source, 'budgetTier', path), `${path}.budgetTier`, 1, 5, true) as WeaponBalanceV1['budgetTier'],
    intendedRole: enumValue(required(source, 'intendedRole', path), `${path}.intendedRole`, [
      'single-target', 'area', 'control', 'defense', 'hybrid',
    ] as const),
  };
}

function proposal(value: unknown, path: string): WeaponGenerationProposalV1 {
  const source = closedRecord(value, path, PROPOSAL_KEYS);
  return {
    proposalVersion: numberValue(required(source, 'proposalVersion', path), `${path}.proposalVersion`, 1, 1, true) as 1,
    name: stringValue(required(source, 'name', path), `${path}.name`, 1, 32),
    description: stringValue(required(source, 'description', path), `${path}.description`, 1, 180),
    recipe: weaponRecipe(required(source, 'recipe', path), `${path}.recipe`),
    progression: progression(required(source, 'progression', path), `${path}.progression`),
    balance: balance(required(source, 'balance', path), `${path}.balance`),
  };
}

function maxLevelStats(value: WeaponGenerationProposalV1): WeaponRecipeRuntimeStats {
  const levels = Math.max(0, value.progression.maxLevel - 1);
  const growth = value.progression.perLevel;
  return {
    damage: value.recipe.projectile.damage + (growth.damage ?? 0) * levels,
    cooldown: Math.max(0.2, Number(value.recipe.trigger.params.cooldown) + (growth.cooldown ?? 0) * levels),
    speed: value.recipe.projectile.speed + (growth.projectileSpeed ?? 0) * levels,
    radius: value.recipe.projectile.radius + (growth.projectileRadius ?? 0) * levels,
    count: value.recipe.emission.count + (growth.count ?? 0) * levels,
    pierce: value.recipe.projectile.pierce + (growth.pierce ?? 0) * levels,
    lifetime: value.recipe.projectile.lifetime + (growth.lifetime ?? 0) * levels,
    knockback: value.recipe.projectile.knockback + (growth.knockback ?? 0) * levels,
  };
}

function validateCompiledProposal(
  value: WeaponGenerationProposalV1,
  definitionId: string,
  registries: WeaponRecipeCompilerRegistries
): void {
  try {
    const basePlan = compileProjectileWeaponRecipe(definitionId, value.recipe, registries);
    const phaseOrder = [
      'stat-additive', 'stat-multiplicative', 'emission-structural',
      'projectile-structural', 'hit-effect', 'lifecycle',
    ] as const;
    const worstHandlers = value.recipe.modifierPolicy.allowedIds
      .map((id) => registries.weaponModifiers.require(id))
      .sort((left, right) => {
        const phaseDelta = phaseOrder.indexOf(left.descriptor.phase) -
          phaseOrder.indexOf(right.descriptor.phase);
        return phaseDelta || left.descriptor.id.localeCompare(right.descriptor.id);
      });
    const maxPlan = compileProjectileWeaponRecipe(definitionId, value.recipe, registries, {
      stats: maxLevelStats(value),
      adjustments: worstHandlers.flatMap((handler) =>
        handler.getAdjustments(handler.descriptor.maxStacks)
      ),
      castMultiplier: worstHandlers.reduce(
        (total, handler) =>
          total * handler.getCastMultiplier(handler.descriptor.maxStacks),
        1
      ),
    });
    const tier = value.balance.budgetTier;
    const periodicHitMultiplier = (plan: typeof basePlan) => plan.projectile.collision.repeatHitInterval > 0
      ? Math.min(8, Math.ceil(plan.projectile.lifetime / plan.projectile.collision.repeatHitInterval)) *
        plan.projectile.collision.maximumTargetsPerTick
      : 1;
    const baseDps = basePlan.projectile.damage * basePlan.budget.maximumDamageMultiplierPerHit *
      basePlan.budget.directProjectilesPerSecond * periodicHitMultiplier(basePlan);
    const maxDps = maxPlan.projectile.damage * maxPlan.budget.maximumDamageMultiplierPerHit *
      maxPlan.budget.directProjectilesPerSecond * periodicHitMultiplier(maxPlan);
    const baseLimit = 45 * tier;
    const maxLimit = 150 * tier;
    if (baseDps > baseLimit) {
      issue('WEAPON_BUDGET_EXCEEDED', 'recipe', `base bounded DPS ${baseDps.toFixed(1)} exceeds ${baseLimit}`);
    }
    if (maxDps > maxLimit) {
      issue('WEAPON_BUDGET_EXCEEDED', 'progression', `max-level bounded DPS ${maxDps.toFixed(1)} exceeds ${maxLimit}`);
    }
  } catch (error) {
    if (error instanceof ValidationFailure) throw error;
    const message = error instanceof Error ? error.message : String(error);
    issue('RECIPE_COMPILE_FAILED', 'recipe', message);
  }
}

function resultOf<T>(operation: () => T): ContentValidationResult<T> {
  try {
    return { ok: true, value: operation(), issues: [] };
  } catch (error) {
    if (error instanceof ValidationFailure) return { ok: false, issues: [error.issue] };
    return {
      ok: false,
      issues: [{ code: 'INVALID_VALUE', path: '$', message: error instanceof Error ? error.message : String(error) }],
    };
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function validateWeaponGenerationProposal(
  input: unknown,
  registries: WeaponRecipeCompilerRegistries,
  provisionalDefinitionId = 'ai.preview/weapon/main'
): ContentValidationResult<WeaponGenerationProposalV1> {
  return resultOf(() => {
    const value = proposal(input, '$');
    validateCompiledProposal(value, provisionalDefinitionId, registries);
    return deepFreeze(value);
  });
}

function weaponBlueprint(value: unknown, path: string, packId: string): WeaponBlueprintV1 {
  const source = closedRecord(value, path, [...PROPOSAL_KEYS, 'id', 'family']);
  const id = stableId(required(source, 'id', path), `${path}.id`);
  if (!id.startsWith(`${packId}/weapon/`)) {
    issue('INVALID_ID', `${path}.id`, 'weapon ID must belong to its pack namespace');
  }
  const parsedProposal = proposal(Object.fromEntries(PROPOSAL_KEYS.map((key) => [key, required(source, key, path)])), path);
  return {
    ...parsedProposal,
    id,
    family: enumValue(required(source, 'family', path), `${path}.family`, [
      'projectile', 'strike', 'aura', 'orbit', 'zone', 'swing',
    ] as const),
  };
}

export function validateContentPack(
  input: unknown,
  registries: WeaponRecipeCompilerRegistries
): ContentValidationResult<ContentPackV1> {
  return resultOf(() => {
    const source = closedRecord(input, '$', [
      'schemaVersion', 'id', 'version', 'source', 'status', 'metadata', 'engineCompatibility',
      'weapons', 'enemies', 'attackProfiles', 'behaviorGraphs', 'provenance',
    ]);
    const packId = stableId(required(source, 'id', '$'), '$.id');
    if (!packId.startsWith('ai.')) issue('INVALID_ID', '$.id', 'AI pack ID must start with ai.');
    const metadata = closedRecord(required(source, 'metadata', '$'), '$.metadata', [
      'name', 'description', 'createdAt', 'updatedAt', 'tags',
    ]);
    const compatibility = closedRecord(required(source, 'engineCompatibility', '$'), '$.engineCompatibility', ['min', 'maxExclusive']);
    const provenance = closedRecord(required(source, 'provenance', '$'), '$.provenance', [
      'task', 'modelSlot', 'promptVersion', 'requestId', 'acceptedAt',
    ]);
    const rawWeapons = arrayValue(required(source, 'weapons', '$'), '$.weapons', 1);
    if (rawWeapons.length !== 1) {
      issue('INVALID_VALUE', '$.weapons', 'first version requires exactly one weapon');
    }
    const weapons = rawWeapons.map((item, index) => weaponBlueprint(item, `$.weapons[${index}]`, packId));
    const seenIds = new Set<string>();
    for (const weapon of weapons) {
      if (seenIds.has(weapon.id)) issue('INVALID_ID', '$.weapons', `duplicate weapon ID ${weapon.id}`);
      seenIds.add(weapon.id);
      validateCompiledProposal(weapon, weapon.id, registries);
      const compiled = compileProjectileWeaponRecipe(weapon.id, weapon.recipe, registries);
      if (weapon.family !== compiled.delivery.family) {
        issue(
          'INVALID_VALUE',
          '$.weapons',
          `weapon family ${weapon.family} does not match delivery family ${compiled.delivery.family}`
        );
      }
    }
    const tags = arrayValue(required(metadata, 'tags', '$.metadata'), '$.metadata.tags', 12)
      .map((tag, index) => stringValue(tag, `$.metadata.tags[${index}]`, 1, 32));
    const version = stringValue(required(source, 'version', '$'), '$.version', 5, 40);
    if (!SEMVER_PATTERN.test(version)) issue('INVALID_VALUE', '$.version', 'expected SemVer');
    const min = stringValue(required(compatibility, 'min', '$.engineCompatibility'), '$.engineCompatibility.min', 5, 40);
    if (!SEMVER_PATTERN.test(min)) issue('INVALID_VALUE', '$.engineCompatibility.min', 'expected SemVer');
    if (compareSemver(APP_VERSION, min) < 0) {
      issue('UNSUPPORTED_CONTENT', '$.engineCompatibility.min', `requires engine ${min} or newer`);
    }
    let maxExclusive: string | undefined;
    if (compatibility.maxExclusive !== undefined) {
      maxExclusive = stringValue(compatibility.maxExclusive, '$.engineCompatibility.maxExclusive', 5, 40);
      if (!SEMVER_PATTERN.test(maxExclusive)) issue('INVALID_VALUE', '$.engineCompatibility.maxExclusive', 'expected SemVer');
      if (compareSemver(APP_VERSION, maxExclusive) >= 0) {
        issue('UNSUPPORTED_CONTENT', '$.engineCompatibility.maxExclusive', `requires engine older than ${maxExclusive}`);
      }
    }
    const createdAt = stringValue(required(metadata, 'createdAt', '$.metadata'), '$.metadata.createdAt', 20, 30);
    const updatedAt = stringValue(required(metadata, 'updatedAt', '$.metadata'), '$.metadata.updatedAt', 20, 30);
    const acceptedAt = stringValue(required(provenance, 'acceptedAt', '$.provenance'), '$.provenance.acceptedAt', 20, 30);
    const requestId = stableId(required(provenance, 'requestId', '$.provenance'), '$.provenance.requestId');
    if (packId !== `ai.${requestId}`) {
      issue('INVALID_ID', '$.id', 'AI pack ID must be derived from its requestId');
    }
    for (const [path, timestamp] of [
      ['$.metadata.createdAt', createdAt], ['$.metadata.updatedAt', updatedAt], ['$.provenance.acceptedAt', acceptedAt],
    ] as const) {
      if (!ISO_DATE_PATTERN.test(timestamp)) issue('INVALID_VALUE', path, 'expected ISO 8601 UTC timestamp');
    }

    const pack: ContentPackV1 = {
      schemaVersion: numberValue(required(source, 'schemaVersion', '$'), '$.schemaVersion', CONTENT_PACK_SCHEMA_VERSION, CONTENT_PACK_SCHEMA_VERSION, true) as 1,
      id: packId,
      version,
      source: enumValue(required(source, 'source', '$'), '$.source', ['ai'] as const),
      status: enumValue(required(source, 'status', '$'), '$.status', ['accepted', 'disabled', 'archived'] as const),
      metadata: {
        name: stringValue(required(metadata, 'name', '$.metadata'), '$.metadata.name', 1, 64),
        description: stringValue(required(metadata, 'description', '$.metadata'), '$.metadata.description', 1, 240),
        createdAt,
        updatedAt,
        tags,
      },
      engineCompatibility: { min, ...(maxExclusive ? { maxExclusive } : {}) },
      weapons,
      enemies: emptyArray(required(source, 'enemies', '$'), '$.enemies'),
      attackProfiles: emptyArray(required(source, 'attackProfiles', '$'), '$.attackProfiles'),
      behaviorGraphs: emptyArray(required(source, 'behaviorGraphs', '$'), '$.behaviorGraphs'),
      provenance: {
        task: enumValue(required(provenance, 'task', '$.provenance'), '$.provenance.task', ['weapon'] as const),
        modelSlot: enumValue(required(provenance, 'modelSlot', '$.provenance'), '$.provenance.modelSlot', ['default'] as const),
        promptVersion: stringValue(required(provenance, 'promptVersion', '$.provenance'), '$.provenance.promptVersion', 1, 80),
        requestId,
        acceptedAt,
      },
    };
    if (pack.schemaVersion !== CONTENT_PACK_SCHEMA_VERSION || WEAPON_PROPOSAL_VERSION !== 1) {
      issue('UNSUPPORTED_CONTENT', '$.schemaVersion', 'unsupported content version');
    }
    return deepFreeze(pack);
  });
}
