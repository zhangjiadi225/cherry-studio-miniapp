import { afterEach, describe, expect, it, vi } from 'vitest';
import { PASSIVE_DATA, UPGRADE_RARITY_DATA, WEAPON_DATA } from '../../constants';
import { GenericModifierType, SupplyType, WeaponType } from '../../types';
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
      `${option.type}:${option.weaponType ?? ''}:${option.passiveType ?? ''}:${option.modifierType ?? ''}:${option.supplyType ?? ''}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stops offering weapon upgrades at max level', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.level = WEAPON_DATA[WeaponType.MAGIC_WAND].maxLevel!;
    player.weapons.push(weapon);

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.some((option) =>
      option.type === 'weapon' &&
      option.weaponType === WeaponType.MAGIC_WAND
    )).toBe(false);
  });

  it('falls back to heal when the whole build is maxed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    for (const type of Object.values(WeaponType)) {
      const weapon = createWeapon(type);
      weapon.level = WEAPON_DATA[type].maxLevel!;
      player.weapons.push(weapon);
    }
    player.passives = Object.entries(PASSIVE_DATA).map(([type, data]) => ({
      type: type as keyof typeof PASSIVE_DATA,
      level: data.maxLevel,
    }));

    const options = generateUpgradeOptions(player, 4, false);

    expect(options).toHaveLength(1);
    expect(options[0].type).toBe('heal');
  });

  it('scales late-run upgrade costs with the XP curve', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    player.level = 28;
    player.xpToNext = 4135;
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.level = 7;
    player.weapons.push(weapon);

    const options = generateUpgradeOptions(player, 6, false);
    const magicWandUpgrade = options.find((option) =>
      option.type === 'weapon' && option.weaponType === WeaponType.MAGIC_WAND
    );

    expect(magicWandUpgrade?.cost).toBeGreaterThan(700);
  });

  it('assigns higher rarity and price to stronger weapon levels', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const earlyPlayer = createPlayer();
    const earlyWeapon = createWeapon(WeaponType.MAGIC_WAND);
    earlyWeapon.level = 2;
    earlyPlayer.weapons.push(earlyWeapon);

    const latePlayer = createPlayer();
    const lateWeapon = createWeapon(WeaponType.MAGIC_WAND);
    lateWeapon.level = 7;
    latePlayer.weapons.push(lateWeapon);

    const earlyOption = generateUpgradeOptions(earlyPlayer, 40, false).find((option) =>
      option.type === 'weapon' && option.weaponType === WeaponType.MAGIC_WAND
    );
    const lateOption = generateUpgradeOptions(latePlayer, 40, false).find((option) =>
      option.type === 'weapon' && option.weaponType === WeaponType.MAGIC_WAND
    );

    expect(earlyOption?.rarity).toBe('common');
    expect(lateOption?.rarity).toBe('legendary');
    expect(lateOption!.cost).toBeGreaterThan(earlyOption!.cost);
    expect(UPGRADE_RARITY_DATA[lateOption!.rarity].costMultiplier)
      .toBeGreaterThan(UPGRADE_RARITY_DATA[earlyOption!.rarity].costMultiplier);
  });

  it('offers a field ration when the player is badly hurt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    player.level = 5;
    player.hp = 40;

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.some((option) =>
      option.type === 'supply' &&
      option.supplyType === SupplyType.FIELD_RATION
    )).toBe(true);
  });

  it('does not guarantee field ration when the player is hurt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    player.level = 5;
    player.hp = 40;

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.some((option) =>
      option.type === 'supply' &&
      option.supplyType === SupplyType.FIELD_RATION
    )).toBe(false);
  });

  it('gates passive attribute cards by chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.some((option) => option.type === 'passive')).toBe(false);
  });

  it('uses luck when rolling optional supply cards', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    player.level = 5;
    player.luck = 1.5;

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.some((option) => option.type === 'supply')).toBe(true);
  });

  it('limits modifier cards to the star-chart unlocked modifier pool', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.level = 5;
    player.weapons.push(weapon);

    const options = generateUpgradeOptions(player, 40, true, [GenericModifierType.SPLIT_CORE]);

    const modifierOptions = options.filter((option) => option.type === 'modifier');
    expect(modifierOptions.length).toBeGreaterThan(0);
    expect(modifierOptions.every((option) => option.modifierType === GenericModifierType.SPLIT_CORE)).toBe(true);
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
      rarity: 'uncommon',
      cost: 9,
      isMaxed: false,
    });

    expect(player.hp).toBe(85);
  });
});
