import {
  Player, UpgradeOption, WeaponType, PassiveType, Weapon, GenericModifierType, SupplyType,
  type UpgradeRarity,
} from '../../types';
import {
  SHOP_OPTION_COUNT, SHOP_MAX_OPTION_COUNT, SHOP_LEVELS_PER_EXTRA_OPTION,
  SHOP_REROLL_BASE_COST, SHOP_REROLL_COST_STEP,
  SHOP_WEAPON_XP_SURCHARGE, SHOP_NEW_WEAPON_XP_SURCHARGE,
  SHOP_PASSIVE_XP_SURCHARGE, SHOP_HEAL_XP_SURCHARGE,
  SHOP_PASSIVE_OPTION_CHANCE, SHOP_FIELD_RATION_OPTION_CHANCE,
  WEAPON_DATA, PASSIVE_DATA, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK,
  XP_BASE, UPGRADE_RARITY_DATA
} from '../../constants';
import { SUPPLY_DATA, getSupplyCost } from '../../data/supplies';
import { createWeapon, upgradeWeapon } from './Weapon';
import { applyPassive, getPassiveLevel } from '../player/Player';
import { shuffleArray } from '../../utils/math';

export function generateUpgradeOptions(
  player: Player,
  count: number = getShopOptionCount(player),
  includeModifiers: boolean = true,
  modifierPool: GenericModifierType[] = Object.values(GenericModifierType)
): UpgradeOption[] {
  const allOptions: UpgradeOption[] = [];

  for (const w of player.weapons) {
    const data = WEAPON_DATA[w.type];
    if (data.maxLevel === undefined || w.level < data.maxLevel) {
      const nextLevel = w.level + 1;
      const rarity = getWeaponLevelRarity(nextLevel);
      allOptions.push({
        title: `${data.name} Lv${nextLevel}`,
        description: getWeaponUpgradeDesc(w),
        icon: data.icon,
        type: 'weapon',
        weaponType: w.type,
        rarity,
        cost: applyRarityCost(getWeaponUpgradeBaseCost(player, w), rarity),
        isMaxed: false,
      });
    }
  }

  if (player.weapons.length < 6) {
    const ownedTypes = new Set(player.weapons.map(w => w.type));
    const rarity = getNewWeaponRarity(player);
    for (const [type, data] of Object.entries(WEAPON_DATA)) {
      if (!ownedTypes.has(type as WeaponType)) {
        allOptions.push({
          title: `${data.name} (新!)`,
          description: data.desc,
          icon: data.icon,
          type: 'weapon',
          weaponType: type as WeaponType,
          rarity,
          cost: applyRarityCost(getNewWeaponBaseCost(player), rarity),
          isMaxed: false,
        });
      }
    }
  }

  for (const [type, data] of Object.entries(PASSIVE_DATA)) {
    const currentLevel = getPassiveLevel(player, type as PassiveType);
    if (Math.random() >= SHOP_PASSIVE_OPTION_CHANCE) continue;
    if (currentLevel < data.maxLevel) {
      const nextLevel = currentLevel + 1;
      const rarity = getPassiveLevelRarity(nextLevel, data.maxLevel);
      allOptions.push({
        title: `${data.name} Lv${nextLevel}`,
        description: data.desc,
        icon: data.icon,
        type: 'passive',
        passiveType: type as PassiveType,
        rarity,
        cost: applyRarityCost(getPassiveBaseCost(player, currentLevel), rarity),
        isMaxed: false,
      });
    }
  }

  if (includeModifiers) {
    allOptions.push(...getModifierOptions(player, modifierPool));
  }
  allOptions.push(...getSupplyOptions(player));

  shuffleArray(allOptions);

  if (allOptions.length === 0) {
    allOptions.push({
      title: '恢复生命',
      description: '恢复30%最大生命值',
      icon: '❤️‍🩹',
      type: 'heal',
      rarity: 'common',
      cost: applyRarityCost(getHealBaseCost(player), 'common'),
      isMaxed: true,
    });
  }

  return allOptions.slice(0, count);
}

function getWeaponUpgradeBaseCost(player: Player, weapon: Weapon): number {
  return 6 + (weapon.level + 1) * 2 + getProgressionSurcharge(player, SHOP_WEAPON_XP_SURCHARGE);
}

function getNewWeaponBaseCost(player: Player): number {
  return 8 + player.weapons.length * 3 + getProgressionSurcharge(player, SHOP_NEW_WEAPON_XP_SURCHARGE);
}

function getPassiveBaseCost(player: Player, currentLevel: number): number {
  return 5 + (currentLevel + 1) * 2 + getProgressionSurcharge(player, SHOP_PASSIVE_XP_SURCHARGE);
}

function getHealBaseCost(player: Player): number {
  return 6 + getProgressionSurcharge(player, SHOP_HEAL_XP_SURCHARGE);
}

function getProgressionSurcharge(player: Player, ratio: number): number {
  return Math.floor(Math.max(0, player.xpToNext - XP_BASE) * ratio);
}

function applyRarityCost(baseCost: number, rarity: UpgradeRarity): number {
  return Math.max(1, Math.round(baseCost * UPGRADE_RARITY_DATA[rarity].costMultiplier));
}

function getWeaponLevelRarity(nextLevel: number): UpgradeRarity {
  if (nextLevel >= 8) return 'legendary';
  if (nextLevel >= 7) return 'epic';
  if (nextLevel >= 6) return 'rare';
  if (nextLevel >= 4) return 'uncommon';
  return 'common';
}

function getNewWeaponRarity(player: Player): UpgradeRarity {
  if (player.weapons.length >= 5) return 'legendary';
  if (player.weapons.length >= 3) return 'epic';
  return 'rare';
}

function getPassiveLevelRarity(nextLevel: number, maxLevel: number): UpgradeRarity {
  if (maxLevel <= 1) return 'epic';
  if (nextLevel >= maxLevel) return 'epic';
  if (nextLevel >= 4) return 'rare';
  if (nextLevel >= 3) return 'uncommon';
  return 'common';
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
    const modifier = GENERIC_MODIFIER_DATA[option.modifierType];
    const stackCount = weapon?.modifiers.filter(m => m === option.modifierType).length ?? 0;
    if (weapon && stackCount < modifier.maxStacks) {
      weapon.modifiers.push(option.modifierType);
      weapon.modifierMask |= GENERIC_MODIFIER_MASK[option.modifierType];
    }
  } else if (option.type === 'supply' && option.supplyType) {
    applySupply(player, option.supplyType);
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

function getModifierOptions(player: Player, modifierPool: GenericModifierType[]): UpgradeOption[] {
  if (modifierPool.length === 0) return [];
  const options: UpgradeOption[] = [];

  for (const weapon of player.weapons) {
    const weaponData = WEAPON_DATA[weapon.type];
    for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
      if (!modifierPool.includes(modifier.id)) continue;
      if (weapon.level < modifier.unlockLevel) continue;
      if (!modifier.compatibleFamilies.includes(weapon.family)) continue;
      if (weapon.modifiers.filter(m => m === modifier.id).length >= modifier.maxStacks) continue;
      const rarity = getModifierRarity(modifier.priceTier);

      options.push({
        title: `${modifier.name} · ${weaponData.name}`,
        description: modifier.desc,
        icon: modifier.icon,
        type: 'modifier',
        weaponType: weapon.type,
        modifierType: modifier.id,
        rarity,
        cost: applyRarityCost(getModifierBaseCost(weapon, modifier.id), rarity),
        isMaxed: false,
      });
    }
  }

  return options;
}

function getModifierBaseCost(weapon: Weapon, modifierType: GenericModifierType): number {
  const modifier = GENERIC_MODIFIER_DATA[modifierType];
  return 12 + weapon.level * 3 + modifier.priceTier * 4;
}

function getModifierRarity(priceTier: number): UpgradeRarity {
  if (priceTier >= 4) return 'legendary';
  if (priceTier >= 3) return 'epic';
  if (priceTier >= 2) return 'rare';
  return 'uncommon';
}

function getSupplyOptions(player: Player): UpgradeOption[] {
  const options: UpgradeOption[] = [];

  if (player.hp <= player.maxHp * 0.65 && Math.random() < SHOP_FIELD_RATION_OPTION_CHANCE) {
    options.push(createSupplyOption(SupplyType.FIELD_RATION, player.level));
  }

  if (player.level >= 4) {
    const supplyChance = Math.min(0.85, 0.35 * player.luck);
    if (Math.random() < supplyChance) {
      options.push(createSupplyOption(SupplyType.OVERCLOCK, player.level));
    }
    if (Math.random() < supplyChance) {
      options.push(createSupplyOption(SupplyType.AEGIS_CHARM, player.level));
    }
  }

  return options;
}

function createSupplyOption(type: SupplyType, playerLevel: number): UpgradeOption {
  const data = SUPPLY_DATA[type];
  const rarity = getSupplyRarity(type);
  return {
    title: data.name,
    description: data.desc,
    icon: data.icon,
    type: 'supply',
    supplyType: type,
    rarity,
    cost: applyRarityCost(getSupplyCost(type, playerLevel), rarity),
    isMaxed: false,
  };
}

function getSupplyRarity(type: SupplyType): UpgradeRarity {
  if (type === SupplyType.OVERCLOCK) return 'epic';
  if (type === SupplyType.AEGIS_CHARM) return 'rare';
  return 'uncommon';
}

function applySupply(player: Player, type: SupplyType) {
  switch (type) {
    case SupplyType.FIELD_RATION:
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.45);
      break;
    case SupplyType.AEGIS_CHARM:
      player.invTime = Math.max(player.invTime, 3);
      break;
    case SupplyType.OVERCLOCK:
      for (const weapon of player.weapons) {
        weapon.timer = Math.max(weapon.timer, weapon.cooldown);
      }
      break;
  }
}
