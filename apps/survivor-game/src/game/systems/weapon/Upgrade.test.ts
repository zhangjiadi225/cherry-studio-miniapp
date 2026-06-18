import { afterEach, describe, expect, it, vi } from 'vitest';
import { WEAPON_DATA } from '../../constants';
import { WeaponType } from '../../types';
import { createPlayer } from '../player/Player';
import { createWeapon } from './Weapon';
import { generateUpgradeOptions } from './Upgrade';

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

  it('does not offer upgrades for max-level weapons', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.level = WEAPON_DATA[WeaponType.MAGIC_WAND].maxLevel;
    player.weapons.push(weapon);

    const options = generateUpgradeOptions(player, 6, false);

    expect(options.some((option) =>
      option.type === 'weapon' &&
      option.weaponType === WeaponType.MAGIC_WAND &&
      option.title.includes(`Lv${weapon.level + 1}`)
    )).toBe(false);
  });

  it('falls back to healing when every upgrade is maxed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    for (const type of Object.values(WeaponType)) {
      const weapon = createWeapon(type);
      weapon.level = WEAPON_DATA[type].maxLevel;
      player.weapons.push(weapon);
    }
    player.passives = [
      { type: 'might', level: 5 },
      { type: 'speed', level: 5 },
      { type: 'max_hp', level: 5 },
      { type: 'armor', level: 5 },
      { type: 'cooldown', level: 5 },
      { type: 'area', level: 5 },
      { type: 'pickup_range', level: 5 },
      { type: 'regen', level: 5 },
      { type: 'luck', level: 5 },
      { type: 'magnet', level: 1 },
      { type: 'curse', level: 5 },
      { type: 'revive', level: 1 },
    ];

    const options = generateUpgradeOptions(player, 4, false);

    expect(options).toHaveLength(1);
    expect(options[0].type).toBe('heal');
  });
});
