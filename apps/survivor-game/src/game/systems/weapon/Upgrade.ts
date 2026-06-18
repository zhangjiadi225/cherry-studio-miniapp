import { Player, UpgradeOption, WeaponType, PassiveType, Weapon, GenericModifierType } from '../../types';
import {
  SHOP_OPTION_COUNT, SHOP_MAX_OPTION_COUNT, SHOP_LEVELS_PER_EXTRA_OPTION,
  SHOP_REROLL_BASE_COST, SHOP_REROLL_COST_STEP,
  WEAPON_DATA, PASSIVE_DATA, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK
} from '../../constants';
import { createWeapon, upgradeWeapon } from './Weapon';
import { applyPassive, getPassiveLevel } from '../player/Player';
import { shuffleArray } from '../../utils/math';

export function generateUpgradeOptions(player: Player, count: number = getShopOptionCount(player)): UpgradeOption[] {
  const allOptions: UpgradeOption[] = [];

  for (const w of player.weapons) {
    const data = WEAPON_DATA[w.type];
    if (w.level < data.maxLevel) {
      allOptions.push({
        title: `${data.name} Lv${w.level + 1}`,
        description: getWeaponUpgradeDesc(w),
        icon: data.icon,
        type: 'weapon',
        weaponType: w.type,
        cost: getWeaponUpgradeCost(player, w),
        isMaxed: false,
      });
    }
  }

  if (player.weapons.length < 6) {
    const ownedTypes = new Set(player.weapons.map(w => w.type));
    for (const [type, data] of Object.entries(WEAPON_DATA)) {
      if (!ownedTypes.has(type as WeaponType)) {
        allOptions.push({
          title: `${data.name} (新!)`,
          description: data.desc,
          icon: data.icon,
          type: 'weapon',
          weaponType: type as WeaponType,
          cost: getNewWeaponCost(player),
          isMaxed: false,
        });
      }
    }
  }

  for (const [type, data] of Object.entries(PASSIVE_DATA)) {
    const currentLevel = getPassiveLevel(player, type as PassiveType);
    if (currentLevel < data.maxLevel) {
      allOptions.push({
        title: `${data.name} Lv${currentLevel + 1}`,
        description: data.desc,
        icon: data.icon,
        type: 'passive',
        passiveType: type as PassiveType,
        cost: getPassiveCost(player, currentLevel),
        isMaxed: false,
      });
    }
  }

  shuffleArray(allOptions);

  const weaponUpgrades = allOptions.filter(o => o.type === 'weapon' && player.weapons.some(w => w.type === o.weaponType));
  const newWeapons = allOptions.filter(o => o.type === 'weapon' && !player.weapons.some(w => w.type === o.weaponType));
  const passives = allOptions.filter(o => o.type === 'passive');

  const result: UpgradeOption[] = [];

  if (weaponUpgrades.length > 0) result.push(weaponUpgrades.shift()!);
  if (weaponUpgrades.length > 0 && Math.random() < 0.5) result.push(weaponUpgrades.shift()!);
  if (newWeapons.length > 0 && player.weapons.length < 3) result.push(newWeapons.shift()!);

  const remaining = [...weaponUpgrades, ...newWeapons, ...passives];
  shuffleArray(remaining);
  while (result.length < count && remaining.length > 0) {
    result.push(remaining.shift()!);
  }

  const modifierOption = rollModifierOption(player);
  if (modifierOption) {
    if (result.length < count) {
      result.push(modifierOption);
    } else if (result.length > 1) {
      result[result.length - 1] = modifierOption;
    }
  }

  if (result.length === 0) {
    result.push({
      title: '恢复生命',
      description: '恢复30%最大生命值',
      icon: '❤️‍🩹',
      type: 'heal',
      cost: getHealCost(player),
      isMaxed: true,
    });
  }

  return result.slice(0, count);
}

function getWeaponUpgradeCost(player: Player, weapon: Weapon): number {
  return 6 + (weapon.level + 1) * 2 + Math.floor(player.level / 3);
}

function getNewWeaponCost(player: Player): number {
  return 8 + player.weapons.length * 3 + Math.floor(player.level / 2);
}

function getPassiveCost(player: Player, currentLevel: number): number {
  return 5 + (currentLevel + 1) * 2 + Math.floor(player.level / 4);
}

function getHealCost(player: Player): number {
  return 6 + Math.floor(player.level / 2);
}

export function getShopOptionCount(player: Player): number {
  const extraOptions = Math.floor(Math.max(0, player.level - 1) / SHOP_LEVELS_PER_EXTRA_OPTION);
  return Math.min(SHOP_MAX_OPTION_COUNT, SHOP_OPTION_COUNT + extraOptions);
}

export function getRerollCost(paidRerollsThisRound: number): number {
  return SHOP_REROLL_BASE_COST + Math.max(0, paidRerollsThisRound) * SHOP_REROLL_COST_STEP;
}

export function applyUpgrade(player: Player, option: UpgradeOption) {
  if (option.type === 'weapon' && option.weaponType) {
    const existing = player.weapons.find(w => w.type === option.weaponType);
    if (existing) {
      upgradeWeapon(existing);
    } else {
      player.weapons.push(createWeapon(option.weaponType));
    }
  } else if (option.type === 'modifier' && option.weaponType && option.modifierType) {
    const weapon = player.weapons.find(w => w.type === option.weaponType);
    if (weapon && !weapon.modifiers.includes(option.modifierType)) {
      weapon.modifiers.push(option.modifierType);
      weapon.modifierMask |= GENERIC_MODIFIER_MASK[option.modifierType];
    }
  } else if (option.type === 'passive' && option.passiveType) {
    applyPassive(player, option.passiveType);
  } else {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.3);
  }
}

function getWeaponUpgradeDesc(w: Weapon): string {
  const d = WEAPON_DATA[w.type];
  const p = d.perLevel;
  const parts: string[] = [];
  if (p.damage) parts.push(`伤害+${p.damage}`);
  if (p.count) parts.push(`数量+${p.count}`);
  if (p.area) parts.push(`范围+${Math.round(p.area * 100)}%`);
  if (p.pierce) parts.push(`穿透+${p.pierce}`);
  if (p.duration) parts.push(`持续+${p.duration}s`);
  if (p.speed) parts.push(`速度+${p.speed}`);
  if (p.cooldown && p.cooldown < 0) parts.push(`冷却${p.cooldown}s`);
  if (p.growthLabel) parts.push(p.growthLabel);
  return parts.join(' ');
}

function rollModifierOption(player: Player): UpgradeOption | undefined {
  if (Math.random() >= 0.4) return undefined;

  const options: UpgradeOption[] = [];
  for (const weapon of player.weapons) {
    const weaponData = WEAPON_DATA[weapon.type];
    for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
      if (weapon.level < modifier.unlockLevel) continue;
      if (!modifier.compatibleFamilies.includes(weapon.family)) continue;
      if (weapon.modifiers.filter(m => m === modifier.id).length >= modifier.maxStacks) continue;

      options.push({
        title: `${modifier.name} · ${weaponData.name}`,
        description: modifier.desc,
        icon: modifier.icon,
        type: 'modifier',
        weaponType: weapon.type,
        modifierType: modifier.id,
        cost: getModifierCost(weapon, modifier.id),
        isMaxed: false,
      });
    }
  }

  if (options.length === 0) return undefined;
  shuffleArray(options);
  return options[0];
}

function getModifierCost(weapon: Weapon, modifierType: GenericModifierType): number {
  const modifier = GENERIC_MODIFIER_DATA[modifierType];
  return 12 + weapon.level * 3 + modifier.priceTier * 4;
}
