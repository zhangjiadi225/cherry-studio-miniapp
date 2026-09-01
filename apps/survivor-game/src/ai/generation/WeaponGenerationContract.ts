import type { WeaponBalanceV1 } from '../../content/schema/ContentPack';
import { CoreAdvancedWeaponPrimitiveId } from '../../game/behaviors/weapon/CoreAdvancedWeaponPrimitives';
import { CoreProjectileParticlePrimitiveId } from '../../game/behaviors/weapon/CoreProjectileParticlePrimitives';
import { CoreWeaponPrimitiveId } from '../../game/behaviors/weapon/CoreProjectilePrimitives';
import type { WeaponFamily } from '../../game/types';
import type {
  WeaponCapabilityCatalogV1,
  WeaponPrimitiveDescriptorV1,
} from '../../game/recipes/weapon/WeaponRuntimePlan';

export const GENERATABLE_WEAPON_FAMILIES = [
  'projectile', 'zone', 'aura', 'strike', 'swing',
] as const satisfies readonly WeaponFamily[];

export type GeneratableWeaponFamily = typeof GENERATABLE_WEAPON_FAMILIES[number];

export interface WeaponGenerationPlanV1 {
  readonly planVersion: 1;
  readonly family: GeneratableWeaponFamily;
  readonly intendedRole: WeaponBalanceV1['intendedRole'];
  readonly primitiveIds: readonly string[];
}

const FAMILY_DELIVERY_IDS: Readonly<Record<GeneratableWeaponFamily, string>> = Object.freeze({
  projectile: CoreAdvancedWeaponPrimitiveId.DELIVERY_PROJECTILE,
  zone: CoreAdvancedWeaponPrimitiveId.DELIVERY_ZONE,
  aura: CoreAdvancedWeaponPrimitiveId.DELIVERY_AURA,
  strike: CoreAdvancedWeaponPrimitiveId.DELIVERY_STRIKE,
  swing: CoreAdvancedWeaponPrimitiveId.DELIVERY_SWING,
});

const COMMON_GENERATION_IDS = Object.freeze([
  CoreWeaponPrimitiveId.TRIGGER_COOLDOWN,
  CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE,
  CoreWeaponPrimitiveId.TARGET_NEAREST,
  CoreWeaponPrimitiveId.PATTERN_SINGLE,
  CoreWeaponPrimitiveId.EFFECT_DAMAGE,
  CoreWeaponPrimitiveId.RENDER_CIRCLE,
]);

const FAMILY_PROFILE_IDS: Readonly<Record<GeneratableWeaponFamily, readonly string[]>> = Object.freeze({
  projectile: Object.freeze([
    CoreAdvancedWeaponPrimitiveId.DELIVERY_PROJECTILE,
    CoreWeaponPrimitiveId.ORIGIN_FOCUS_RELIC,
    CoreWeaponPrimitiveId.ORIGIN_PLAYER,
    CoreWeaponPrimitiveId.MOTION_STRAIGHT,
    CoreWeaponPrimitiveId.COLLISION_STANDARD,
    CoreWeaponPrimitiveId.TARGET_FACING,
    CoreWeaponPrimitiveId.PATTERN_FAN,
    CoreWeaponPrimitiveId.RENDER_RING,
    CoreWeaponPrimitiveId.EFFECT_KNOCKBACK,
  ]),
  zone: Object.freeze([
    CoreAdvancedWeaponPrimitiveId.DELIVERY_ZONE,
    CoreWeaponPrimitiveId.ORIGIN_TARGET_GROUND,
    CoreWeaponPrimitiveId.MOTION_STATIONARY,
    CoreAdvancedWeaponPrimitiveId.COLLISION_AREA_PERIODIC,
    CoreAdvancedWeaponPrimitiveId.TARGET_CLUSTER,
    CoreWeaponPrimitiveId.PATTERN_RING,
    CoreWeaponPrimitiveId.RENDER_RING,
    CoreAdvancedWeaponPrimitiveId.EFFECT_SLOW,
    CoreAdvancedWeaponPrimitiveId.EFFECT_AREA_DAMAGE,
    CoreProjectileParticlePrimitiveId.SHOCKWAVE,
  ]),
  aura: Object.freeze([
    CoreAdvancedWeaponPrimitiveId.DELIVERY_AURA,
    CoreWeaponPrimitiveId.ORIGIN_PLAYER,
    CoreWeaponPrimitiveId.MOTION_STATIONARY,
    CoreAdvancedWeaponPrimitiveId.COLLISION_AREA_PERIODIC,
    CoreWeaponPrimitiveId.PATTERN_RING,
    CoreWeaponPrimitiveId.RENDER_RING,
    CoreAdvancedWeaponPrimitiveId.EFFECT_SLOW,
    CoreWeaponPrimitiveId.EFFECT_KNOCKBACK,
  ]),
  strike: Object.freeze([
    CoreAdvancedWeaponPrimitiveId.DELIVERY_STRIKE,
    CoreWeaponPrimitiveId.ORIGIN_TARGET_GROUND,
    CoreWeaponPrimitiveId.MOTION_STATIONARY,
    CoreWeaponPrimitiveId.COLLISION_STANDARD,
    CoreAdvancedWeaponPrimitiveId.TARGET_RANDOM_SEEDED,
    CoreAdvancedWeaponPrimitiveId.TARGET_LOWEST_HP,
    CoreAdvancedWeaponPrimitiveId.TARGET_CLUSTER,
    CoreWeaponPrimitiveId.RENDER_RING,
    CoreAdvancedWeaponPrimitiveId.EFFECT_AREA_DAMAGE,
    CoreProjectileParticlePrimitiveId.TELEGRAPH,
    CoreProjectileParticlePrimitiveId.SHOCKWAVE,
    CoreAdvancedWeaponPrimitiveId.CAMERA_IMPULSE,
  ]),
  swing: Object.freeze([
    CoreAdvancedWeaponPrimitiveId.DELIVERY_SWING,
    CoreWeaponPrimitiveId.ORIGIN_PLAYER,
    CoreWeaponPrimitiveId.MOTION_STATIONARY,
    CoreWeaponPrimitiveId.COLLISION_SECTOR,
    CoreWeaponPrimitiveId.TARGET_FACING,
    CoreWeaponPrimitiveId.PATTERN_FAN,
    CoreWeaponPrimitiveId.RENDER_ARC,
    CoreWeaponPrimitiveId.EFFECT_KNOCKBACK,
    CoreAdvancedWeaponPrimitiveId.EFFECT_SLOW,
    CoreProjectileParticlePrimitiveId.HIT_BURST,
    CoreAdvancedWeaponPrimitiveId.CAMERA_IMPULSE,
  ]),
});

const INTENT_PRIMITIVES: readonly {
  readonly terms: readonly string[];
  readonly primitiveId: string;
}[] = Object.freeze([
  { terms: ['蓄力', '充能', 'charge'], primitiveId: CoreAdvancedWeaponPrimitiveId.TRIGGER_CHARGE },
  { terms: ['连发', '三连', 'burst'], primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_BURST },
  { terms: ['螺旋', 'spiral'], primitiveId: CoreAdvancedWeaponPrimitiveId.PATTERN_SPIRAL },
  { terms: ['追踪', '制导', 'homing'], primitiveId: CoreAdvancedWeaponPrimitiveId.MOTION_HOMING },
  { terms: ['加速', 'accelerat'], primitiveId: CoreAdvancedWeaponPrimitiveId.MOTION_ACCELERATING },
  { terms: ['回旋', '返回', 'boomerang', 'return'], primitiveId: CoreAdvancedWeaponPrimitiveId.MOTION_RETURN },
  { terms: ['命中分裂', '击中分裂', 'split on hit'], primitiveId: CoreAdvancedWeaponPrimitiveId.LIFECYCLE_SPLIT_ON_HIT },
  { terms: ['消失分裂', '到期分裂', 'split on expire'], primitiveId: CoreAdvancedWeaponPrimitiveId.LIFECYCLE_SPLIT_ON_EXPIRE },
  { terms: ['弹跳', 'bounce'], primitiveId: CoreAdvancedWeaponPrimitiveId.LIFECYCLE_BOUNCE },
  { terms: ['减速', '冰冻', 'slow'], primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_SLOW },
  { terms: ['灼烧', '燃烧', 'burn'], primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_BURN },
  { terms: ['连锁', 'chain'], primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_CHAIN },
  { terms: ['范围伤害', '爆炸伤害', 'area damage'], primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_AREA_DAMAGE },
  { terms: ['最低生命', '残血', 'lowest hp'], primitiveId: CoreAdvancedWeaponPrimitiveId.TARGET_LOWEST_HP },
  { terms: ['随机目标', 'random target'], primitiveId: CoreAdvancedWeaponPrimitiveId.TARGET_RANDOM_SEEDED },
  { terms: ['敌群', '聚集', 'cluster'], primitiveId: CoreAdvancedWeaponPrimitiveId.TARGET_CLUSTER },
  { terms: ['墙面反弹', '反弹墙', 'wall bounce'], primitiveId: CoreAdvancedWeaponPrimitiveId.COLLISION_WALL_BOUNCE },
  { terms: ['地形阻挡', '撞墙消失', 'terrain'], primitiveId: CoreAdvancedWeaponPrimitiveId.COLLISION_TERRAIN_STOP },
  { terms: ['预警', '落点提示', 'telegraph'], primitiveId: CoreProjectileParticlePrimitiveId.TELEGRAPH },
  { terms: ['冲击波', 'shockwave'], primitiveId: CoreProjectileParticlePrimitiveId.SHOCKWAVE },
  { terms: ['音效', '声音', 'audio'], primitiveId: CoreAdvancedWeaponPrimitiveId.AUDIO_CUE },
  { terms: ['震屏', '镜头震动', 'camera'], primitiveId: CoreAdvancedWeaponPrimitiveId.CAMERA_IMPULSE },
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inferFamily(intent: string): GeneratableWeaponFamily {
  const normalized = intent.toLowerCase();
  if (['光环', '环绕自身', '贴身范围', 'aura'].some((term) => normalized.includes(term))) return 'aura';
  if (['落雷', '陨石', '延迟打击', '天降', 'strike'].some((term) => normalized.includes(term))) return 'strike';
  if (['挥击', '近战', '刀光', '剑气斩', 'melee', 'swing'].some((term) => normalized.includes(term))) return 'swing';
  if (['地面区域', '陷阱', '持续区域', '毒池', 'zone'].some((term) => normalized.includes(term))) return 'zone';
  return 'projectile';
}

function inferIntendedRole(intent: string): WeaponBalanceV1['intendedRole'] {
  const normalized = intent.toLowerCase();
  if (['防御', '护盾', '保护', 'defense'].some((term) => normalized.includes(term))) return 'defense';
  if (['控制', '减速', '冰冻', '击退', 'control'].some((term) => normalized.includes(term))) return 'control';
  if (['范围', '群体', '爆炸', '区域', 'area', 'aoe'].some((term) => normalized.includes(term))) return 'area';
  if (['单体', '首领', 'boss', 'single target'].some((term) => normalized.includes(term))) return 'single-target';
  return 'hybrid';
}

function inferPrimitiveIds(intent: string, knownIds: ReadonlySet<string>): string[] {
  const normalized = intent.toLowerCase();
  return INTENT_PRIMITIVES
    .filter((candidate) =>
      knownIds.has(candidate.primitiveId) &&
      candidate.terms.some((term) => normalized.includes(term))
    )
    .map((candidate) => candidate.primitiveId);
}

export function createFallbackWeaponGenerationPlan(
  userIntent: string,
  catalog: WeaponCapabilityCatalogV1
): WeaponGenerationPlanV1 {
  const knownIds = new Set(catalog.primitives.map((primitive) => primitive.id));
  return Object.freeze({
    planVersion: 1,
    family: inferFamily(userIntent),
    intendedRole: inferIntendedRole(userIntent),
    primitiveIds: Object.freeze(inferPrimitiveIds(userIntent, knownIds).slice(0, 12)),
  });
}

export function resolveWeaponGenerationPlan(
  input: unknown,
  userIntent: string,
  catalog: WeaponCapabilityCatalogV1
): WeaponGenerationPlanV1 {
  const fallback = createFallbackWeaponGenerationPlan(userIntent, catalog);
  if (!isRecord(input)) return fallback;

  const knownIds = new Set(catalog.primitives.map((primitive) => primitive.id));
  const family = typeof input.family === 'string' &&
    GENERATABLE_WEAPON_FAMILIES.includes(input.family as GeneratableWeaponFamily)
    ? input.family as GeneratableWeaponFamily
    : fallback.family;
  const intendedRoles: readonly WeaponBalanceV1['intendedRole'][] = [
    'single-target', 'area', 'control', 'defense', 'hybrid',
  ];
  const intendedRole = typeof input.intendedRole === 'string' &&
    intendedRoles.includes(input.intendedRole as WeaponBalanceV1['intendedRole'])
    ? input.intendedRole as WeaponBalanceV1['intendedRole']
    : fallback.intendedRole;
  const proposedIds = Array.isArray(input.primitiveIds)
    ? input.primitiveIds.filter((id): id is string => typeof id === 'string' && knownIds.has(id))
    : [];
  const primitiveIds = [...new Set([...proposedIds, ...fallback.primitiveIds])].slice(0, 12);

  return Object.freeze({
    planVersion: 1,
    family,
    intendedRole,
    primitiveIds: Object.freeze(primitiveIds),
  });
}

export function getWeaponFamilyDeliveryId(family: GeneratableWeaponFamily): string {
  return FAMILY_DELIVERY_IDS[family];
}

function addDescriptorWithRequirements(
  id: string,
  descriptors: ReadonlyMap<string, WeaponPrimitiveDescriptorV1>,
  selected: Map<string, WeaponPrimitiveDescriptorV1>
): void {
  const descriptor = descriptors.get(id);
  if (!descriptor || selected.has(id)) return;
  const conflict = descriptor.compatibility.conflictsWith.find((candidate) => selected.has(candidate));
  if (conflict) return;
  selected.set(id, descriptor);
  for (const requiredId of descriptor.compatibility.requires) {
    addDescriptorWithRequirements(requiredId, descriptors, selected);
  }
}

export function selectWeaponGenerationCatalog(
  catalog: WeaponCapabilityCatalogV1,
  plan: WeaponGenerationPlanV1
): WeaponCapabilityCatalogV1 {
  const descriptors = new Map(catalog.primitives.map((primitive) => [primitive.id, primitive]));
  const selected = new Map<string, WeaponPrimitiveDescriptorV1>();
  for (const id of [...COMMON_GENERATION_IDS, ...FAMILY_PROFILE_IDS[plan.family]]) {
    addDescriptorWithRequirements(id, descriptors, selected);
  }

  const fixedProfileIds = new Set(FAMILY_PROFILE_IDS[plan.family]);
  const fixedKinds = plan.family === 'projectile'
    ? new Set<string>(['delivery'])
    : new Set<string>(['delivery', 'cast-origin', 'projectile-motion', 'collision']);
  for (const id of plan.primitiveIds) {
    const descriptor = descriptors.get(id);
    if (!descriptor) continue;
    if (fixedKinds.has(descriptor.kind) && !fixedProfileIds.has(id)) continue;
    addDescriptorWithRequirements(id, descriptors, selected);
  }

  const selectedIds = new Set(selected.keys());
  const modifiers = catalog.modifiers.filter((modifier) =>
    modifier.compatibleFamilies.includes(plan.family) &&
    !modifier.conflictsWith.some((id) => selectedIds.has(id))
  );
  return Object.freeze({
    catalogVersion: 1,
    primitives: Object.freeze([...selected.values()].sort((left, right) => left.id.localeCompare(right.id))),
    modifiers: Object.freeze(modifiers),
  });
}

function ref(primitiveId: string, params: Record<string, unknown> = {}) {
  return { primitiveId, params };
}

function normalizeRef(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return { ...value };
}

function normalizeRefArray(value: unknown): unknown {
  return Array.isArray(value) ? value.map(normalizeRef) : value;
}

export function normalizeWeaponGenerationDraft(
  input: unknown,
  plan: WeaponGenerationPlanV1
): unknown {
  if (!isRecord(input)) return input;
  const recipe = isRecord(input.recipe) ? input.recipe : {};
  const emission = isRecord(recipe.emission) ? recipe.emission : {};
  const projectile = isRecord(recipe.projectile) ? recipe.projectile : {};
  const visual = isRecord(projectile.visual) ? projectile.visual : {};
  const schedule = emission.schedule === undefined && typeof emission.burstCount === 'number'
    ? emission.burstCount === 1
      ? ref(CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE)
      : ref(CoreAdvancedWeaponPrimitiveId.EMISSION_BURST, {
          burstCount: emission.burstCount,
          burstInterval: emission.burstInterval,
        })
    : normalizeRef(emission.schedule);
  const scheduleRecord = isRecord(schedule) ? schedule : {};
  const scheduleParams = isRecord(scheduleRecord.params) ? scheduleRecord.params : {};
  let burstCount = emission.burstCount;
  let burstInterval = emission.burstInterval;
  if (scheduleRecord.primitiveId === CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE) {
    burstCount = 1;
    burstInterval = 0;
  } else if (scheduleRecord.primitiveId === CoreAdvancedWeaponPrimitiveId.EMISSION_BURST) {
    burstCount = scheduleParams.burstCount;
    burstInterval = scheduleParams.burstInterval;
  }

  return {
    ...input,
    proposalVersion: 1,
    recipe: {
      ...recipe,
      recipeVersion: 1,
      delivery: ref(FAMILY_DELIVERY_IDS[plan.family]),
      trigger: normalizeRef(recipe.trigger),
      targeting: normalizeRef(recipe.targeting),
      emission: {
        ...emission,
        emitterId: 'builtin.emitter.projectile',
        schedule,
        origin: normalizeRef(emission.origin),
        burstCount,
        burstInterval,
        pattern: normalizeRef(emission.pattern),
      },
      projectile: {
        ...projectile,
        motion: normalizeRef(projectile.motion),
        collision: normalizeRef(projectile.collision),
        hitEffects: normalizeRefArray(projectile.hitEffects),
        lifecycle: normalizeRefArray(projectile.lifecycle),
        visual: {
          ...visual,
          body: normalizeRef(visual.body),
          layers: normalizeRefArray(visual.layers),
          ...(visual.trail === undefined ? {} : { trail: normalizeRef(visual.trail) }),
          ...(visual.particles === undefined ? {} : { particles: normalizeRef(visual.particles) }),
          ...(visual.emitters === undefined ? {} : { emitters: normalizeRefArray(visual.emitters) }),
        },
      },
      ...(recipe.feedback === undefined ? {} : { feedback: normalizeRefArray(recipe.feedback) }),
    },
  };
}

export function createCompactWeaponRepairDraft(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const {
    proposalVersion: _proposalVersion,
    recipe: rawRecipe,
    ...proposal
  } = input;
  if (!isRecord(rawRecipe)) return input;
  const {
    recipeVersion: _recipeVersion,
    delivery: _delivery,
    emission: rawEmission,
    ...recipe
  } = rawRecipe;
  if (!isRecord(rawEmission)) return { ...proposal, recipe };
  const {
    emitterId: _emitterId,
    burstCount: _burstCount,
    burstInterval: _burstInterval,
    ...emission
  } = rawEmission;
  return {
    ...proposal,
    recipe: { ...recipe, emission },
  };
}
