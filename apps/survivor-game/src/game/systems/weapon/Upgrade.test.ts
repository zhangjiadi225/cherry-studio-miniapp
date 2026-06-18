import { afterEach, describe, expect, it, vi } from 'vitest';
import { PASSIVE_DATA } from '../../constants';
import { SupplyType, WeaponType } from '../../types';
import { createPlayer } from '../player/Player';
import { createWeapon } from './Weapon';
import { applyUpgrade, generateUpgradeOptions } from './Upgrade';

describe('generateUpgradeOptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not return duplicate option identities in one roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));

    const options = generateUpgradeOptions(player, 6, false);
    const keys = options.map((option) =>
      `${option.type}:${option.weaponType ?? ''}:${option.passiveType ?? ''}:${option.modifierType ?? ''}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps offering weapon upgrades after the old level cap band', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.level = 12;
    player.weapons.push(weapon);

    const options = generateUpgradeOptions(player, 6, false);

    expect(options.some((option) =>
      option.type === 'weapon' &&
      option.weaponType === WeaponType.MAGIC_WAND &&
      option.title.includes(`Lv${weapon.level + 1}`)
    )).toBe(true);
  });

  it('does not exhaust the shop while owned weapons can keep scaling', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    for (const type of Object.values(WeaponType)) {
      const weapon = createWeapon(type);
      weapon.level = 30;
      player.weapons.push(weapon);
    }
    player.passives = Object.entries(PASSIVE_DATA).map(([type, data]) => ({
      type: type as keyof typeof PASSIVE_DATA,
      level: data.maxLevel,
    }));

    const options = generateUpgradeOptions(player, 4, false);

    expect(options.some((option) => option.type === 'weapon')).toBe(true);
    expect(options.every((option) => option.type !== 'heal')).toBe(true);
  });

  it('offers a field ration when the player is badly hurt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    player.level = 5;
    player.hp = 40;

    const options = generateUpgradeOptions(player, 4, false);

    expect(options.some((option) =>
      option.type === 'supply' &&
      option.supplyType === SupplyType.FIELD_RATION
    )).toBe(true);
  });

  it('applies supply effects immediately', () => {
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    player.hp = 40;

    applyUpgrade(player, {
      title: '战地口粮',
      description: '',
      icon: '✚',
      type: 'supply',
      supplyType: SupplyType.FIELD_RATION,
      cost: 9,
      isMaxed: false,
    });

    expect(player.hp).toBe(85);
  });
});
