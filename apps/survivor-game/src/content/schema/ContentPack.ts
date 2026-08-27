import type { ProjectileWeaponRecipeV1 } from '../../game/recipes/weapon/WeaponRecipe';

export const CONTENT_PACK_SCHEMA_VERSION = 1;
export const WEAPON_PROPOSAL_VERSION = 1;
export const MAX_ENABLED_GENERATED_WEAPON_PACKS = 6;

export type ContentPackStatusV1 = 'accepted' | 'disabled' | 'archived';

export interface WeaponProgressionV1 {
  readonly maxLevel: number;
  readonly perLevel: {
    readonly damage?: number;
    readonly cooldown?: number;
    readonly projectileSpeed?: number;
    readonly projectileRadius?: number;
    readonly count?: number;
    readonly pierce?: number;
    readonly lifetime?: number;
    readonly knockback?: number;
  };
}

export interface WeaponBalanceV1 {
  readonly budgetTier: 1 | 2 | 3 | 4 | 5;
  readonly intendedRole: 'single-target' | 'area' | 'control' | 'defense' | 'hybrid';
}

export interface WeaponGenerationProposalV1 {
  readonly proposalVersion: typeof WEAPON_PROPOSAL_VERSION;
  readonly name: string;
  readonly description: string;
  readonly recipe: ProjectileWeaponRecipeV1;
  readonly progression: WeaponProgressionV1;
  readonly balance: WeaponBalanceV1;
}

export interface WeaponBlueprintV1 extends WeaponGenerationProposalV1 {
  readonly id: string;
  readonly family: 'projectile';
}

export interface AiProvenanceV1 {
  readonly task: 'weapon';
  readonly modelSlot: 'default';
  readonly promptVersion: string;
  readonly requestId: string;
  readonly acceptedAt: string;
}

export interface ContentPackV1 {
  readonly schemaVersion: typeof CONTENT_PACK_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly source: 'ai';
  readonly status: ContentPackStatusV1;
  readonly metadata: {
    readonly name: string;
    readonly description: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly tags: readonly string[];
  };
  readonly engineCompatibility: {
    readonly min: string;
    readonly maxExclusive?: string;
  };
  readonly weapons: readonly WeaponBlueprintV1[];
  readonly enemies: readonly [];
  readonly attackProfiles: readonly [];
  readonly behaviorGraphs: readonly [];
  readonly provenance: AiProvenanceV1;
}

export interface CreateAcceptedWeaponPackOptions {
  readonly packId: string;
  readonly requestId: string;
  readonly promptVersion: string;
  readonly acceptedAt: string;
  readonly engineVersion: string;
}

export function createAcceptedWeaponPack(
  proposal: WeaponGenerationProposalV1,
  options: CreateAcceptedWeaponPackOptions
): ContentPackV1 {
  const weaponId = `${options.packId}/weapon/main`;
  const pack: ContentPackV1 = {
    schemaVersion: CONTENT_PACK_SCHEMA_VERSION,
    id: options.packId,
    version: '1.0.0',
    source: 'ai',
    status: 'accepted',
    metadata: {
      name: proposal.name,
      description: proposal.description,
      createdAt: options.acceptedAt,
      updatedAt: options.acceptedAt,
      tags: ['weapon', proposal.balance.intendedRole],
    },
    engineCompatibility: {
      min: options.engineVersion,
    },
    weapons: [{
      ...proposal,
      id: weaponId,
      family: 'projectile',
    }],
    enemies: [],
    attackProfiles: [],
    behaviorGraphs: [],
    provenance: {
      task: 'weapon',
      modelSlot: 'default',
      promptVersion: options.promptVersion,
      requestId: options.requestId,
      acceptedAt: options.acceptedAt,
    },
  };
  return deepFreeze(pack);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
