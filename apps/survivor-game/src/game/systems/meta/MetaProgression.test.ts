import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenericModifierType } from '../../types';
import { RUN_DIFFICULTY_PRESETS } from '../../data/runDifficulties';
import {
  areModifierCardsUnlocked,
  applyRunReward,
  canBuyMetaUpgrade,
  calculateSoulFireReward,
  createDefaultMetaState,
  getInitialShards,
  hasOpeningCardDraft,
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
    const victoryReward = calculateSoulFireReward({ time: 540, kills: 1200, level: 28 });

    expect(threeMinuteReward).toBe(19);
    expect(victoryReward).toBe(70);
  });

  it('scales final soul fire payout by run difficulty', () => {
    const easyVictory = calculateSoulFireReward({ time: 420, kills: 1200, level: 28 }, RUN_DIFFICULTY_PRESETS.easy);
    const hardVictory = calculateSoulFireReward({ time: 540, kills: 1200, level: 28 }, RUN_DIFFICULTY_PRESETS.hard);
    const nightmareVictory = calculateSoulFireReward({ time: 720, kills: 1200, level: 28 }, RUN_DIFFICULTY_PRESETS.nightmare);

    expect(easyVictory).toBeLessThan(hardVictory);
    expect(nightmareVictory).toBeGreaterThan(hardVictory);
  });
});

describe('applyRunReward', () => {
  it('can settle only endless reward delta without counting a second run', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    const meta = createDefaultMetaState();
    const firstReward = calculateSoulFireReward(
      { time: 720, kills: 800, level: 20 },
      RUN_DIFFICULTY_PRESETS.nightmare
    );

    const afterClear = applyRunReward(
      meta,
      { time: 720, kills: 800, level: 20 },
      RUN_DIFFICULTY_PRESETS.nightmare
    );
    const afterEndless = applyRunReward(
      afterClear,
      { time: 900, kills: 1200, level: 28 },
      RUN_DIFFICULTY_PRESETS.nightmare,
      { previousSoulFireReward: firstReward, countRun: false }
    );

    expect(afterClear.runs).toBe(1);
    expect(afterEndless.runs).toBe(1);
    expect(afterEndless.soulFire - afterClear.soulFire).toBe(
      calculateSoulFireReward({ time: 900, kills: 1200, level: 28 }, RUN_DIFFICULTY_PRESETS.nightmare) - firstReward
    );
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
      unlockedUpgrades: ['star_core', 'ranged_path', 'projectile_velocity', 'multi_shot', 'orbital_core'] as MetaUpgradeId[],
    };

    expect(areModifierCardsUnlocked(meta)).toBe(true);
    expect(getUnlockedModifierTypes(meta)).toEqual([
      GenericModifierType.VELOCITY_RUNE,
      GenericModifierType.DOUBLE_CAST,
      GenericModifierType.ORBITAL_CORE,
    ]);
  });

  it('places orbital core behind the ranged projectile path', () => {
    const orbitalCore = META_UPGRADES.find((node) => node.id === 'orbital_core')!;

    expect(orbitalCore.grantsModifier).toBe(GenericModifierType.ORBITAL_CORE);
    expect(orbitalCore.requires).toEqual(['projectile_velocity', 'mechanism_path']);
    expect(canBuyMetaUpgrade({ ...createDefaultMetaState(), soulFire: 99 }, orbitalCore)).toBe(false);
  });

  it('uses cross-branch prerequisites for advanced star routes', () => {
    const mechanismPath = META_UPGRADES.find((node) => node.id === 'mechanism_path')!;
    const upgradeIds = META_UPGRADES.map((node) => node.id as string);

    expect(mechanismPath.requires).toEqual(['ranged_path', 'damage_path']);
    expect(upgradeIds).not.toContain('chain_burst');
    expect(upgradeIds).not.toContain('lightning_burst');
  });

  it('unlocks start-run mechanisms without granting permanent player stats', () => {
    const meta = {
      ...createDefaultMetaState(),
      unlockedUpgrades: [
        'star_core',
        'paid_reroll',
        'opening_gold',
        'opening_choice',
      ] as MetaUpgradeId[],
    };
    const openingChoice = META_UPGRADES.find((node) => node.id === 'opening_choice')!;
    const firstShopSlot = META_UPGRADES.find((node) => node.id === 'shop_slot_1')!;

    expect(getInitialShards(meta)).toBe(50);
    expect(hasOpeningCardDraft(meta)).toBe(true);
    expect(openingChoice.requires).toEqual(['opening_gold']);
    expect(firstShopSlot.requires).toEqual(['opening_choice']);
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
    expect(meta.selectedDifficulty).toBe('hard');
    expect(areModifierCardsUnlocked(meta)).toBe(false);
  });
});
