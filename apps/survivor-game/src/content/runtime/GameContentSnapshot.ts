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
import type { WeaponBehaviorHandler } from '../../game/behaviors/weapon/WeaponBehavior';
import { Registry, type ReadonlyRegistry } from '../registry/Registry';

export const BUILTIN_CONTENT_PACK_ID = 'builtin.core';
export const GAME_CONTENT_SNAPSHOT_VERSION = 1;

export interface ResolvedWeaponDefinition extends WeaponData {
  readonly id: string;
  readonly legacyType: WeaponType;
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
  readonly weapons: ReadonlyRegistry<ResolvedWeaponDefinition>;
  readonly enemies: ReadonlyRegistry<ResolvedEnemyDefinition>;
  getWeaponByType(type: WeaponType): ResolvedWeaponDefinition;
  getEnemyByType(type: EnemyType): ResolvedEnemyDefinition;
}

export interface StoredContentLibraryInput {
  readonly packs: readonly unknown[];
  readonly enabledPackIds: readonly string[];
}

function freezeWeaponDefinition(
  type: WeaponType,
  source: WeaponData
): ResolvedWeaponDefinition {
  const metadata: WeaponMetadata = {
    ...source.metadata,
    tags: [...source.metadata.tags],
  };
  Object.freeze(metadata.tags);
  Object.freeze(metadata);

  const definition: ResolvedWeaponDefinition = {
    ...source,
    id: getBuiltinWeaponContentId(type),
    legacyType: type,
    metadata,
    perLevel: Object.freeze({ ...source.perLevel }),
  };
  return Object.freeze(definition);
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
  if (storedLibrary.enabledPackIds.length > 0) {
    throw new Error(
      `Stored content activation is not supported yet (${storedLibrary.enabledPackIds.length} enabled, ${storedLibrary.packs.length} stored)`
    );
  }

  const engine = createCoreEngineRegistrySnapshot();
  const weaponBehaviors = engine.weaponBehaviors;
  const weapons = new Registry<ResolvedWeaponDefinition>('weapon definitions');
  const enemies = new Registry<ResolvedEnemyDefinition>('enemy definitions');

  for (const [type, source] of Object.entries(WEAPON_DATA) as [WeaponType, WeaponData][]) {
    weaponBehaviors.require(source.behaviorId);
    const definition = freezeWeaponDefinition(type, source);
    weapons.register(definition.id, definition);
  }

  for (const [type, source] of Object.entries(ENEMY_DATA) as [EnemyType, EnemyData][]) {
    const definition = freezeEnemyDefinition(type, source);
    enemies.register(definition.id, definition);
  }

  const frozenWeapons = weapons.freeze();
  const frozenEnemies = enemies.freeze();
  return Object.freeze({
    snapshotVersion: GAME_CONTENT_SNAPSHOT_VERSION,
    packIds: Object.freeze([BUILTIN_CONTENT_PACK_ID]),
    enginePluginIds: engine.pluginIds,
    weaponBehaviors,
    weapons: frozenWeapons,
    enemies: frozenEnemies,
    getWeaponByType: (type: WeaponType) =>
      frozenWeapons.require(getBuiltinWeaponContentId(type)),
    getEnemyByType: (type: EnemyType) =>
      frozenEnemies.require(getBuiltinEnemyContentId(type)),
  });
}
