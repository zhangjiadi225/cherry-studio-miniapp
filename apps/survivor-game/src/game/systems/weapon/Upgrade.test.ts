import { afterEach, describe, expect, it, vi } from 'vitest';
import { PASSIVE_DATA, PLAYER_WEAPON_SLOT_LIMIT, WEAPON_DATA } from '../../constants';
import { GenericModifierType, PassiveType, SupplyType, WeaponEvolutionId, WeaponType } from '../../types';
import { WEAPON_EVOLUTIONS_BY_WEAPON } from '../../data/weaponEvolutions';
import { createPlayer } from '../player/Player';
import { createWeapon, upgradeWeapon } from './Weapon';
import { applyUpgrade, generateUpgradeOptions, getSellableCards, sellOwnedCard } from './Upgrade';

function weaponAtLevel(type: WeaponType, level: number) {
  const weapon = createWeapon(type);
  while (weapon.level < level) upgradeWeapon(weapon);
  return weapon;
}

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
      `${option.type}:${option.weaponType ?? ''}:${option.evolutionId ?? ''}:${option.passiveType ?? ''}:${option.modifierType ?? ''}:${option.supplyType ?? ''}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps shop rolls structured around build choices', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.FIRE_WAND);
    weapon.level = 4;
    player.weapons.push(weapon);
    player.level = 5;
    player.hp = 40;

    const options = generateUpgradeOptions(player, 4, true, [GenericModifierType.SPLIT_CORE]);

    expect(options.some((option) => option.type === 'weapon' && option.weaponType === WeaponType.FIRE_WAND)).toBe(true);
    expect(options.some((option) => option.type === 'weapon_evolution' && option.weaponType === WeaponType.FIRE_WAND)).toBe(true);
    expect(options.some((option) => option.type === 'modifier' && option.modifierType === GenericModifierType.SPLIT_CORE)).toBe(true);
    expect(options.some((option) => option.type === 'supply' || option.type === 'passive')).toBe(true);
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

	  it('limits new weapon cards to the three weapon slots', () => {
	    vi.spyOn(Math, 'random').mockReturnValue(0.42);
	    const player = createPlayer();
	    player.weapons.push(
	      createWeapon(WeaponType.MAGIC_WAND),
	      createWeapon(WeaponType.FIRE_WAND),
	      createWeapon(WeaponType.BIBLE)
	    );

	    const options = generateUpgradeOptions(player, 40, false);
	    const ownedTypes = new Set(player.weapons.map((weapon) => weapon.type));
	    const newWeaponOptions = options.filter((option) =>
	      option.type === 'weapon' &&
	      option.weaponType &&
	      !ownedTypes.has(option.weaponType)
	    );

	    expect(player.weapons).toHaveLength(PLAYER_WEAPON_SLOT_LIMIT);
	    expect(newWeaponOptions).toHaveLength(0);
	    expect(applyUpgrade(player, {
	      title: '大蒜',
	      description: '',
	      icon: '',
	      type: 'weapon',
	      weaponType: WeaponType.GARLIC,
	      rarity: 'rare',
	      cost: 10,
	      isMaxed: false,
	    })).toBe(false);
	    expect(player.weapons).toHaveLength(PLAYER_WEAPON_SLOT_LIMIT);
	  });

  it('falls back to heal when the whole build is maxed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    for (const type of Object.values(WeaponType)) {
      const weapon = createWeapon(type);
      weapon.level = WEAPON_DATA[type].maxLevel!;
      for (const choice of WEAPON_EVOLUTIONS_BY_WEAPON[type]) {
        if (weapon.evolutions[choice.tier] === undefined) {
          weapon.evolutions[choice.tier] = choice.id;
        }
      }
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

  it('offers and applies one weapon evolution per tier', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.FIRE_WAND);
    weapon.level = 4;
    player.weapons.push(weapon);

    const option = generateUpgradeOptions(player, 40, false).find((item) =>
      item.type === 'weapon_evolution' &&
      item.weaponType === WeaponType.FIRE_WAND
    );

    expect(option?.evolutionId).toBeDefined();

    applyUpgrade(player, option!);

    expect(weapon.evolutions[4]).toBe(option!.evolutionId);
    expect(generateUpgradeOptions(player, 40, false).some((item) =>
      item.type === 'weapon_evolution' &&
      item.weaponType === WeaponType.FIRE_WAND
    )).toBe(false);
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

  it('values ordinary weapon level cards by stat delta instead of level number', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const earlyPlayer = createPlayer();
    const earlyWeapon = weaponAtLevel(WeaponType.MAGIC_WAND, 2);
    earlyPlayer.weapons.push(earlyWeapon);

    const latePlayer = createPlayer();
    const lateWeapon = weaponAtLevel(WeaponType.MAGIC_WAND, 7);
    latePlayer.weapons.push(lateWeapon);

    const earlyOption = generateUpgradeOptions(earlyPlayer, 40, false).find((option) =>
      option.type === 'weapon' && option.weaponType === WeaponType.MAGIC_WAND
    );
    const lateOption = generateUpgradeOptions(latePlayer, 40, false).find((option) =>
      option.type === 'weapon' && option.weaponType === WeaponType.MAGIC_WAND
    );

    expect(['common', 'uncommon']).toContain(earlyOption?.rarity);
    expect(['common', 'uncommon']).toContain(lateOption?.rarity);
    expect(lateOption!.cost).toBeGreaterThan(earlyOption!.cost);
  });

  it('prices multiplier modifier cards above small utility modifiers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    player.weapons.push(weaponAtLevel(WeaponType.MAGIC_WAND, 3));

    const options = generateUpgradeOptions(player, 40, true, [
      GenericModifierType.SPLIT_CORE,
      GenericModifierType.DOUBLE_CAST,
      GenericModifierType.VELOCITY_RUNE,
    ]);

    expect(options.find((option) => option.modifierType === GenericModifierType.SPLIT_CORE)?.rarity).toBe('legendary');
    expect(options.find((option) => option.modifierType === GenericModifierType.DOUBLE_CAST)?.rarity).toBe('legendary');
    expect(options.find((option) => option.modifierType === GenericModifierType.VELOCITY_RUNE)?.rarity).toBe('uncommon');
  });

  it('raises reflection prism rarity as the stack gets stronger', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    const weapon = weaponAtLevel(WeaponType.MAGIC_WAND, 5);
    player.weapons.push(weapon);

    const first = generateUpgradeOptions(player, 40, true, [GenericModifierType.REFLECTION_PRISM])
      .find((option) => option.modifierType === GenericModifierType.REFLECTION_PRISM);
    weapon.modifiers.push(GenericModifierType.REFLECTION_PRISM);
    const second = generateUpgradeOptions(player, 40, true, [GenericModifierType.REFLECTION_PRISM])
      .find((option) => option.modifierType === GenericModifierType.REFLECTION_PRISM);
    weapon.modifiers.push(GenericModifierType.REFLECTION_PRISM);
    const third = generateUpgradeOptions(player, 40, true, [GenericModifierType.REFLECTION_PRISM])
      .find((option) => option.modifierType === GenericModifierType.REFLECTION_PRISM);

    expect(first?.rarity).toBe('rare');
    expect(second?.rarity).toBe('epic');
    expect(third?.rarity).toBe('legendary');
  });

  it('prices weapon evolutions by their actual shape power', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const player = createPlayer();
    const weapon = weaponAtLevel(WeaponType.FIRE_WAND, 8);
    player.weapons.push(weapon);

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.find((option) => option.evolutionId === WeaponEvolutionId.FIRE_POOL)?.rarity).toBe('rare');
    expect(options.find((option) => option.evolutionId === WeaponEvolutionId.FIRE_BURST)?.rarity).toBe('epic');
    expect(options.find((option) => option.evolutionId === WeaponEvolutionId.FIRE_STORM)?.rarity).toBe('legendary');
    expect(options.find((option) => option.evolutionId === WeaponEvolutionId.FIRE_BRAND)?.rarity).toBe('epic');
  });

  it('keeps passive rarity tied to global strength and mechanics', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.find((option) => option.passiveType === PassiveType.SPEED)?.rarity).toBe('uncommon');
    expect(options.find((option) => option.passiveType === PassiveType.MIGHT)?.rarity).toBe('rare');
    expect(options.find((option) => option.passiveType === PassiveType.CURSE)?.rarity).toBe('epic');
    expect(options.find((option) => option.passiveType === PassiveType.REVIVE)?.rarity).toBe('legendary');
  });

  it('prices one-shot supply cards by current combat value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const player = createPlayer();
    player.level = 5;
    player.luck = 2;
    player.hp = 25;
    player.weapons.push(
      createWeapon(WeaponType.MAGIC_WAND),
      createWeapon(WeaponType.FIRE_WAND),
      createWeapon(WeaponType.BIBLE),
      createWeapon(WeaponType.HOLY_WATER),
      createWeapon(WeaponType.LIGHTNING)
    );

    const options = generateUpgradeOptions(player, 40, false);

    expect(options.find((option) => option.supplyType === SupplyType.FIELD_RATION)?.rarity).toBe('rare');
    expect(options.find((option) => option.supplyType === SupplyType.AEGIS_CHARM)?.rarity).toBe('epic');
    expect(options.find((option) => option.supplyType === SupplyType.OVERCLOCK)?.rarity).toBe('legendary');
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

	  it('allows stackable modifier cards up to their max stacks', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.level = 5;
    player.weapons.push(weapon);

    const option = {
      title: '反射棱镜 · 魔法弹',
      description: '',
      icon: '◇↝',
      type: 'modifier' as const,
      weaponType: WeaponType.MAGIC_WAND,
      modifierType: GenericModifierType.REFLECTION_PRISM,
      rarity: 'rare' as const,
      cost: 1,
      isMaxed: false,
    };

    applyUpgrade(player, option);
    applyUpgrade(player, option);
    applyUpgrade(player, option);
    applyUpgrade(player, option);

	    expect(weapon.modifiers.filter((m) => m === GenericModifierType.REFLECTION_PRISM)).toHaveLength(3);
	  });

	  it('refunds eighty percent of invested card value when selling owned cards', () => {
	    const player = createPlayer();
	    const magicWand = createWeapon(WeaponType.MAGIC_WAND);
	    magicWand.purchaseValue = 50;
	    const bible = createWeapon(WeaponType.BIBLE);
	    bible.purchaseValue = 10;
	    player.weapons.push(magicWand, bible);
	    player.passives.push({ type: PassiveType.SPEED, level: 2, purchaseValue: 30 });
	    player.shards = 1;

	    const cards = getSellableCards(player);

	    expect(cards.find((card) => card.id === 'weapon:magic_wand')?.refund).toBe(40);
	    expect(cards.find((card) => card.id === 'passive:speed')?.refund).toBe(24);

	    expect(sellOwnedCard(player, 'weapon:magic_wand')?.refund).toBe(40);
	    expect(player.shards).toBe(41);
	    expect(player.weapons.map((weapon) => weapon.type)).toEqual([WeaponType.BIBLE]);

	    expect(sellOwnedCard(player, 'weapon:bible')).toBeUndefined();
	    expect(player.weapons).toHaveLength(1);
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
