import {
  ENEMY_DATA,
  getBuiltinEnemyContentId,
  type EnemyData,
} from '../../game/data/enemies';
import {
  getBuiltinWeaponContentId,
  WEAPON_DATA,
  type WeaponData,
} from '../../game/data/weapons';
import { createCoreEngineRegistrySnapshot } from '../../game/systems/weapon/Weapon';
import type { EnemyType, WeaponMetadata, WeaponType } from '../../game/types';
import {
  CoreWeaponBehaviorId,
  type WeaponBehaviorHandler,
} from '../../game/behaviors/weapon/WeaponBehavior';
import {
  compileProjectileWeaponRecipe,
  createWeaponCapabilityCatalog,
} from '../../game/recipes/weapon/WeaponRecipeCompiler';
import type {
  WeaponCapabilityCatalogV1,
  WeaponRuntimePlan,
} from '../../game/recipes/weapon/WeaponRuntimePlan';
import { Registry, type ReadonlyRegistry } from '../registry/Registry';
import { validateContentPack } from '../schema/ContentPackValidator';
import {
  MAX_ENABLED_GENERATED_WEAPON_PACKS,
  type ContentPackV1,
  type WeaponBlueprintV1,
} from '../schema/ContentPack';

export const BUILTIN_CONTENT_PACK_ID = 'builtin.core';
export const GAME_CONTENT_SNAPSHOT_VERSION = 1;

export interface ResolvedWeaponDefinition extends WeaponData {
  readonly id: string;
  readonly legacyType: WeaponType;
  readonly sourcePackId: string;
  readonly generated: boolean;
  readonly useLegacyProjectileSprite: boolean;
  readonly runtimePlan?: WeaponRuntimePlan;
}

export interface ResolvedEnemyDefinition extends EnemyData {
  readonly id: string;
  readonly legacyType: EnemyType;
}

export interface GameContentSnapshot {
  readonly snapshotVersion: typeof GAME_CONTENT_SNAPSHOT_VERSION;
  readonly packIds: readonly string[];
  readonly enginePluginIds: readonly string[];
  readonly weaponBehaviors: ReadonlyRegistry<WeaponBehaviorHandler>;
  readonly weaponCapabilityCatalog: WeaponCapabilityCatalogV1;
  readonly weapons: ReadonlyRegistry<ResolvedWeaponDefinition>;
  readonly startingWeapons: readonly ResolvedWeaponDefinition[];
  readonly enemies: ReadonlyRegistry<ResolvedEnemyDefinition>;
  getWeaponById(id: string): ResolvedWeaponDefinition;
  getWeaponByType(type: WeaponType): ResolvedWeaponDefinition;
  getEnemyByType(type: EnemyType): ResolvedEnemyDefinition;
}

export interface StoredContentLibraryInput {
  readonly packs: readonly unknown[];
  readonly enabledPackIds: readonly string[];
}

function freezeWeaponDefinition(
  type: WeaponType,
  source: WeaponData,
  runtimePlan?: WeaponRuntimePlan,
  options: {
    readonly id?: string;
    readonly sourcePackId?: string;
    readonly generated?: boolean;
    readonly useLegacyProjectileSprite?: boolean;
  } = {}
): ResolvedWeaponDefinition {
  const metadata: WeaponMetadata = {
    ...source.metadata,
    tags: [...source.metadata.tags],
  };
  Object.freeze(metadata.tags);
  Object.freeze(metadata);

  const definition: ResolvedWeaponDefinition = {
    ...source,
    id: options.id ?? getBuiltinWeaponContentId(type),
    legacyType: type,
    sourcePackId: options.sourcePackId ?? BUILTIN_CONTENT_PACK_ID,
    generated: options.generated ?? false,
    useLegacyProjectileSprite: options.useLegacyProjectileSprite ?? type === 'magic_wand',
    runtimePlan,
    metadata,
    perLevel: Object.freeze({ ...source.perLevel }),
  };
  return Object.freeze(definition);
}

function getGeneratedWeaponPerLevel(
  blueprint: WeaponBlueprintV1
): WeaponData['perLevel'] {
  const growth = blueprint.progression.perLevel;
  const radius = blueprint.recipe.projectile.radius;
  return {
    ...(growth.damage === undefined ? {} : { damage: growth.damage }),
    ...(growth.cooldown === undefined ? {} : { cooldown: growth.cooldown }),
    ...(growth.projectileSpeed === undefined ? {} : { speed: growth.projectileSpeed }),
    ...(growth.projectileRadius === undefined ? {} : {
      area: radius > 0 ? growth.projectileRadius / radius : 0,
    }),
    ...(growth.count === undefined ? {} : { count: growth.count }),
    ...(growth.pierce === undefined ? {} : { pierce: growth.pierce }),
    ...(growth.lifetime === undefined ? {} : { duration: growth.lifetime }),
    ...(growth.knockback === undefined ? {} : { knockback: growth.knockback }),
  };
}

function createGeneratedWeaponDefinition(
  pack: ContentPackV1,
  blueprint: WeaponBlueprintV1,
  engine: ReturnType<typeof createCoreEngineRegistrySnapshot>
): ResolvedWeaponDefinition {
  const recipe = blueprint.recipe;
  const cooldown = Number(recipe.trigger.params.cooldown);
  const source: WeaponData = {
    name: blueprint.name,
    icon: '✦',
    desc: blueprint.description,
    family: 'projectile',
    behaviorId: CoreWeaponBehaviorId.PROJECTILE_RECIPE,
    recipe,
    metadata: {
      behavior: 'focus_cast',
      displayMode: 'none',
      displayPriority: 65,
      tags: ['ranged'],
    },
    baseDamage: recipe.projectile.damage,
    baseCooldown: cooldown,
    baseSpeed: recipe.projectile.speed,
    baseArea: 1,
    baseCount: recipe.emission.count,
    basePierce: recipe.projectile.pierce,
    baseDuration: recipe.projectile.lifetime,
    baseKnockback: recipe.projectile.knockback,
    perLevel: getGeneratedWeaponPerLevel(blueprint),
    maxLevel: blueprint.progression.maxLevel,
  };
  const runtimePlan = compileProjectileWeaponRecipe(blueprint.id, recipe, engine);
  return freezeWeaponDefinition('magic_wand', source, runtimePlan, {
    id: blueprint.id,
    sourcePackId: pack.id,
    generated: true,
    useLegacyProjectileSprite: false,
  });
}

function freezeEnemyDefinition(
  type: EnemyType,
  source: EnemyData
): ResolvedEnemyDefinition {
  const definition: ResolvedEnemyDefinition = {
    ...source,
    id: getBuiltinEnemyContentId(type),
    legacyType: type,
    enhancement: source.enhancement
      ? Object.freeze({ ...source.enhancement })
      : undefined,
  };
  return Object.freeze(definition);
}

export function createBuiltinGameContentSnapshot(
  storedLibrary: StoredContentLibraryInput = { packs: [], enabledPackIds: [] }
): GameContentSnapshot {
  if (storedLibrary.enabledPackIds.length > MAX_ENABLED_GENERATED_WEAPON_PACKS) {
    throw new Error(
      `Enabled ContentPack limit exceeded (${storedLibrary.enabledPackIds.length}/${MAX_ENABLED_GENERATED_WEAPON_PACKS})`
    );
  }
  const engine = createCoreEngineRegistrySnapshot();
  const weaponBehaviors = engine.weaponBehaviors;
  const weaponCapabilityCatalog = createWeaponCapabilityCatalog(engine);
  const weapons = new Registry<ResolvedWeaponDefinition>('weapon definitions');
  const enemies = new Registry<ResolvedEnemyDefinition>('enemy definitions');

  for (const [type, source] of Object.entries(WEAPON_DATA) as [WeaponType, WeaponData][]) {
    weaponBehaviors.require(source.behaviorId);
    const definitionId = getBuiltinWeaponContentId(type);
    const runtimePlan = source.recipe
      ? compileProjectileWeaponRecipe(definitionId, source.recipe, engine)
      : undefined;
    const definition = freezeWeaponDefinition(type, source, runtimePlan);
    weapons.register(definition.id, definition);
  }

  const storedPacks = new Map<string, ContentPackV1>();
  for (const rawPack of storedLibrary.packs) {
    const validation = validateContentPack(rawPack, engine);
    if (!validation.ok) continue;
    if (storedPacks.has(validation.value.id)) {
      throw new Error(`Duplicate stored ContentPack ID: ${validation.value.id}`);
    }
    storedPacks.set(validation.value.id, validation.value);
  }

  const enabledPackIds: string[] = [];
  for (const packId of storedLibrary.enabledPackIds) {
    if (enabledPackIds.includes(packId)) {
      throw new Error(`Duplicate enabled ContentPack ID: ${packId}`);
    }
    const pack = storedPacks.get(packId);
    if (!pack) throw new Error(`Enabled ContentPack is missing or invalid: ${packId}`);
    if (pack.status !== 'accepted') {
      throw new Error(`Enabled ContentPack is not accepted: ${packId}`);
    }
    enabledPackIds.push(pack.id);
    for (const blueprint of pack.weapons) {
      const definition = createGeneratedWeaponDefinition(pack, blueprint, engine);
      weapons.register(definition.id, definition);
    }
  }

  for (const [type, source] of Object.entries(ENEMY_DATA) as [EnemyType, EnemyData][]) {
    const definition = freezeEnemyDefinition(type, source);
    enemies.register(definition.id, definition);
  }

  const frozenWeapons = weapons.freeze();
  const frozenEnemies = enemies.freeze();
  const startingWeapons = Object.freeze([...frozenWeapons.values()]);
  return Object.freeze({
    snapshotVersion: GAME_CONTENT_SNAPSHOT_VERSION,
    packIds: Object.freeze([BUILTIN_CONTENT_PACK_ID, ...enabledPackIds]),
    enginePluginIds: engine.pluginIds,
    weaponBehaviors,
    weaponCapabilityCatalog,
    weapons: frozenWeapons,
    startingWeapons,
    enemies: frozenEnemies,
    getWeaponById: (id: string) => frozenWeapons.require(id),
    getWeaponByType: (type: WeaponType) =>
      frozenWeapons.require(getBuiltinWeaponContentId(type)),
    getEnemyByType: (type: EnemyType) =>
      frozenEnemies.require(getBuiltinEnemyContentId(type)),
  });
}
