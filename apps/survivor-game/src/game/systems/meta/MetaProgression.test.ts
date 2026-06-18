import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenericModifierType } from '../../types';
import {
  areModifierCardsUnlocked,
  canBuyMetaUpgrade,
  calculateSoulFireReward,
  createDefaultMetaState,
  getUnlockedModifierTypes,
  loadMetaState,
  META_UPGRADES,
  type MetaUpgradeId,
} from './MetaProgression';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('calculateSoulFireReward', () => {
  it('grants a small guaranteed settlement reward for short failed runs', () => {
    expect(calculateSoulFireReward({ time: 25, kills: 3, level: 1 })).toBeGreaterThanOrEqual(4);
  });

  it('uses run completion percentage instead of in-run shard balance', () => {
    const threeMinuteReward = calculateSoulFireReward({ time: 180, kills: 200, level: 8 });
    const victoryReward = calculateSoulFireReward({ time: 900, kills: 1200, level: 28 });

    expect(threeMinuteReward).toBe(15);
    expect(victoryReward).toBe(70);
  });
});

describe('meta star chart', () => {
  it('starts from the center star core before branch nodes can be bought', () => {
    const meta = createDefaultMetaState();
    const starCore = META_UPGRADES.find((node) => node.id === 'star_core')!;
    const split = META_UPGRADES.find((node) => node.id === 'projectile_split')!;

    expect(canBuyMetaUpgrade({ ...meta, soulFire: 99 }, starCore)).toBe(true);
    expect(canBuyMetaUpgrade({ ...meta, soulFire: 99 }, split)).toBe(false);
  });

  it('unlocks only the modifiers granted by lit star nodes', () => {
    const meta = {
      ...createDefaultMetaState(),
      unlockedUpgrades: ['star_core', 'ranged_path', 'projectile_velocity', 'multi_shot'] as MetaUpgradeId[],
    };

    expect(areModifierCardsUnlocked(meta)).toBe(true);
    expect(getUnlockedModifierTypes(meta)).toEqual([
      GenericModifierType.VELOCITY_RUNE,
      GenericModifierType.DOUBLE_CAST,
    ]);
  });

  it('does not migrate removed legacy upgrade ids into the star chart', () => {
    const store = new Map<string, string>([
      ['survivor_meta_v1', JSON.stringify({ soulFire: 20, unlockedUpgrades: ['module_cards'] })],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });

    const meta = loadMetaState();

    expect(meta.unlockedUpgrades).toEqual([]);
    expect(areModifierCardsUnlocked(meta)).toBe(false);
  });
});
