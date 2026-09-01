import {
  Player, UpgradeOption, SellableCard, WeaponType, PassiveType, Weapon, GenericModifierType, SupplyType,
  type UpgradeRarity,
} from '../../types';
import {
  SHOP_OPTION_COUNT, SHOP_MAX_OPTION_COUNT, SHOP_LEVELS_PER_EXTRA_OPTION,
  SHOP_REROLL_BASE_COST, SHOP_REROLL_COST_STEP,
  SHOP_WEAPON_XP_SURCHARGE, SHOP_NEW_WEAPON_XP_SURCHARGE,
  SHOP_PASSIVE_XP_SURCHARGE, SHOP_HEAL_XP_SURCHARGE,
  SHOP_PASSIVE_OPTION_CHANCE, SHOP_FIELD_RATION_OPTION_CHANCE,
  WEAPON_DATA, PASSIVE_DATA, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK,
  XP_BASE, UPGRADE_RARITY_DATA, PLAYER_WEAPON_SLOT_LIMIT, SHOP_SELL_REFUND_RATE
} from '../../constants';
import { SUPPLY_DATA, getSupplyCost } from '../../data/supplies';
import { applyWeaponEvolution, getAvailableWeaponEvolutionChoices } from '../../data/weaponEvolutions';
import { getBuiltinWeaponContentId } from '../../data/weapons';
import {
  getModifierQuality,
  getNewWeaponQuality,
  getPassiveQuality,
  getSupplyQuality,
  getWeaponEvolutionQuality,
  getWeaponLevelQuality,
} from '../../data/cardQuality';
import {
  canApplyModifierToWeapon,
  createWeapon,
  rebuildWeaponRuntimePlan,
  upgradeWeapon,
} from './Weapon';
import { applyPassive, getPassiveLevel, removePassive } from '../player/Player';
import { shuffleArray } from '../../utils/math';
import { SYSTEM_RANDOM, type RandomSource } from '../../kernel/Random';

export function generateUpgradeOptions(
  player: Player,
  count: number = getShopOptionCount(player),
  includeModifiers: boolean = true,
  modifierPool: GenericModifierType[] = Object.values(GenericModifierType),
  random: RandomSource = SYSTEM_RANDOM
): UpgradeOption[] {
  const weaponLevelOptions = getWeaponLevelOptions(player);
  const evolutionOptions = getWeaponEvolutionOptions(player);
  const newWeaponOptions = getNewWeaponOptions(player);
  const passiveOptions = getPassiveOptions(player, random);
  const modifierOptions = includeModifiers ? getModifierOptions(player, modifierPool) : [];
  const supplyOptions = getSupplyOptions(player, random);
  const options: UpgradeOption[] = [];
  const usedKeys = new Set<string>();

  pushRandomOption(options, weaponLevelOptions, usedKeys, count, random);
  pushRandomOption(options, evolutionOptions.length > 0 ? evolutionOptions : newWeaponOptions, usedKeys, count, random);
  pushRandomOption(options, modifierOptions, usedKeys, count, random);
  pushRandomOption(options, [...supplyOptions, ...passiveOptions], usedKeys, count, random);

  const leftovers = [
    ...weaponLevelOptions,
    ...evolutionOptions,
    ...newWeaponOptions,
    ...modifierOptions,
    ...supplyOptions,
    ...passiveOptions,
  ];
  shuffleArray(leftovers, random);
  for (const option of leftovers) {
    if (options.length >= count) break;
    pushUniqueOption(options, option, usedKeys);
  }

  if (options.length === 0) {
    options.push({
      title: '恢复生命',
      description: '恢复30%最大生命值',
      icon: '❤️‍🩹',
      type: 'heal',
      rarity: 'common',
      cost: applyRarityCost(getHealBaseCost(player), 'common'),
      isMaxed: true,
    });
  }

  return options.slice(0, count);
}

function getWeaponLevelOptions(player: Player): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  for (const w of player.weapons) {
    if (w.maxLevel !== undefined && w.level >= w.maxLevel) continue;
    const nextLevel = w.level + 1;
    const rarity = getWeaponLevelQuality(w).rarity;
    options.push({
      title: `${w.name} Lv${nextLevel}`,
      description: getWeaponUpgradeDesc(w),
      icon: w.icon,
      type: 'weapon',
      weaponType: w.type,
      weaponDefinitionId: w.definitionId,
      rarity,
      cost: applyRarityCost(getWeaponUpgradeBaseCost(player, w), rarity),
      isMaxed: false,
    });
  }
  return options;
}

function getWeaponEvolutionOptions(player: Player): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  for (const weapon of player.weapons) {
    if (weapon.generated || weapon.definitionId !== getBuiltinWeaponContentId(weapon.type)) continue;
    for (const choice of getAvailableWeaponEvolutionChoices(weapon)) {
      const rarity = getWeaponEvolutionQuality(choice).rarity;
      options.push({
        title: `${weapon.name} · ${choice.name}`,
        description: choice.desc,
        icon: choice.icon,
        type: 'weapon_evolution',
        weaponType: weapon.type,
        weaponDefinitionId: weapon.definitionId,
        evolutionId: choice.id,
        rarity,
        cost: applyRarityCost(getWeaponEvolutionBaseCost(player, weapon, choice.tier), rarity),
        isMaxed: false,
      });
    }
  }
  return options;
}

function getNewWeaponOptions(player: Player): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  if (player.weapons.length >= PLAYER_WEAPON_SLOT_LIMIT) return options;

  const ownedDefinitionIds = new Set(player.weapons.map(w => w.definitionId));
  for (const [type, data] of Object.entries(WEAPON_DATA)) {
    const weaponType = type as WeaponType;
    const weaponDefinitionId = getBuiltinWeaponContentId(weaponType);
    if (ownedDefinitionIds.has(weaponDefinitionId)) continue;
    const rarity = getNewWeaponQuality(weaponType).rarity;
    options.push({
      title: `${data.name} (新!)`,
      description: data.desc,
      icon: data.icon,
      type: 'weapon',
      weaponType,
      weaponDefinitionId,
      rarity,
      cost: applyRarityCost(getNewWeaponBaseCost(player), rarity),
      isMaxed: false,
    });
  }
  return options;
}

function getPassiveOptions(player: Player, random: RandomSource): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  for (const [type, data] of Object.entries(PASSIVE_DATA)) {
    const currentLevel = getPassiveLevel(player, type as PassiveType);
    if (random.next() >= SHOP_PASSIVE_OPTION_CHANCE) continue;
    if (currentLevel >= data.maxLevel) continue;
    const nextLevel = currentLevel + 1;
    const rarity = getPassiveQuality(type as PassiveType, nextLevel, data.maxLevel).rarity;
    options.push({
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
  return options;
}

function pushRandomOption(
  target: UpgradeOption[],
  pool: UpgradeOption[],
  usedKeys: Set<string>,
  limit: number,
  random: RandomSource
) {
  if (target.length >= limit || pool.length === 0) return;
  shuffleArray(pool, random);
  for (const option of pool) {
    if (pushUniqueOption(target, option, usedKeys)) return;
  }
}

function pushUniqueOption(target: UpgradeOption[], option: UpgradeOption, usedKeys: Set<string>): boolean {
  const key = getUpgradeOptionKey(option);
  if (usedKeys.has(key)) return false;
  usedKeys.add(key);
  target.push(option);
  return true;
}

function getUpgradeOptionKey(option: UpgradeOption): string {
  return [
    option.type,
    option.weaponType ?? '',
    option.weaponDefinitionId ?? '',
    option.evolutionId ?? '',
    option.passiveType ?? '',
    option.modifierType ?? '',
    option.supplyType ?? '',
  ].join(':');
}

function getWeaponUpgradeBaseCost(player: Player, weapon: Weapon): number {
  return 6 + (weapon.level + 1) * 2 + getProgressionSurcharge(player, SHOP_WEAPON_XP_SURCHARGE);
}

function getNewWeaponBaseCost(player: Player): number {
  return 8 + player.weapons.length * 3 + getProgressionSurcharge(player, SHOP_NEW_WEAPON_XP_SURCHARGE);
}

function getWeaponEvolutionBaseCost(player: Player, weapon: Weapon, tier: number): number {
  return 16 + tier * 3 + weapon.level * 3 + getProgressionSurcharge(player, SHOP_WEAPON_XP_SURCHARGE);
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

export function getShopOptionCount(player: Player): number {
  const extraOptions = Math.floor(Math.max(0, player.level - 1) / SHOP_LEVELS_PER_EXTRA_OPTION);
  return Math.min(SHOP_MAX_OPTION_COUNT, SHOP_OPTION_COUNT + extraOptions);
}

export function getRerollCost(paidRerollsThisRound: number): number {
  return SHOP_REROLL_BASE_COST + Math.max(0, paidRerollsThisRound) * SHOP_REROLL_COST_STEP;
}

export function applyUpgrade(player: Player, option: UpgradeOption) {
  if (option.type === 'weapon' && option.weaponType) {
    const existing = option.weaponDefinitionId
      ? player.weapons.find(w => w.definitionId === option.weaponDefinitionId)
      : player.weapons.find(w => w.type === option.weaponType);
    if (existing) {
      if (!upgradeWeapon(existing)) return false;
      existing.purchaseValue = (existing.purchaseValue ?? 0) + option.cost;
    } else {
      if (player.weapons.length >= PLAYER_WEAPON_SLOT_LIMIT) return false;
      const weapon = createWeapon(option.weaponType);
      weapon.purchaseValue = option.cost;
      player.weapons.push(weapon);
    }
  } else if (option.type === 'weapon_evolution' && option.weaponType && option.evolutionId) {
    const weapon = option.weaponDefinitionId
      ? player.weapons.find(w => w.definitionId === option.weaponDefinitionId)
      : player.weapons.find(w => w.type === option.weaponType);
    if (!weapon || !applyWeaponEvolution(weapon, option.evolutionId)) return false;
    rebuildWeaponRuntimePlan(weapon);
    weapon.purchaseValue = (weapon.purchaseValue ?? 0) + option.cost;
  } else if (option.type === 'modifier' && option.weaponType && option.modifierType) {
    const weapon = option.weaponDefinitionId
      ? player.weapons.find(w => w.definitionId === option.weaponDefinitionId)
      : player.weapons.find(w => w.type === option.weaponType);
    if (weapon && canApplyModifierToWeapon(weapon, option.modifierType)) {
      weapon.modifiers.push(option.modifierType);
      weapon.modifierMask |= GENERIC_MODIFIER_MASK[option.modifierType];
      rebuildWeaponRuntimePlan(weapon);
      weapon.purchaseValue = (weapon.purchaseValue ?? 0) + option.cost;
    } else {
      return false;
    }
  } else if (option.type === 'supply' && option.supplyType) {
    applySupply(player, option.supplyType);
  } else if (option.type === 'passive' && option.passiveType) {
    if (!applyPassive(player, option.passiveType, option.cost)) return false;
  } else {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.3);
  }
  return true;
}

export function getSellableCards(player: Player): SellableCard[] {
  const weaponCards = player.weapons.map((weapon) => {
    const refund = getSellRefund(weapon.purchaseValue);
    return {
      id: `weapon:${weapon.definitionId}`,
      title: `${weapon.name} Lv${weapon.level}`,
      description: '卖出会移除等级、进化和模块',
      icon: weapon.icon,
      type: 'weapon' as const,
      weaponType: weapon.type,
      weaponDefinitionId: weapon.definitionId,
      level: weapon.level,
      refund,
      sellable: player.weapons.length > 1 && refund > 0,
    };
  });

  const passiveCards = player.passives.map((passive) => {
    const data = PASSIVE_DATA[passive.type];
    const refund = getSellRefund(passive.purchaseValue);
    return {
      id: `passive:${passive.type}`,
      title: `${data.name} Lv${passive.level}`,
      description: data.desc,
      icon: data.icon,
      type: 'passive' as const,
      passiveType: passive.type,
      level: passive.level,
      refund,
      sellable: refund > 0,
    };
  });

  return [...weaponCards, ...passiveCards].filter((card) => card.refund > 0 || card.type === 'weapon');
}

export function sellOwnedCard(player: Player, cardId: string): SellableCard | undefined {
  const card = getSellableCards(player).find((item) => item.id === cardId);
  if (!card || !card.sellable) return undefined;

  if (card.type === 'weapon' && card.weaponType) {
    const index = card.weaponDefinitionId
      ? player.weapons.findIndex((weapon) => weapon.definitionId === card.weaponDefinitionId)
      : player.weapons.findIndex((weapon) => weapon.type === card.weaponType);
    if (index < 0 || player.weapons.length <= 1) return undefined;
    player.weapons.splice(index, 1);
  } else if (card.type === 'passive' && card.passiveType) {
    if (!removePassive(player, card.passiveType)) return undefined;
  } else {
    return undefined;
  }

  player.shards += card.refund;
  return card;
}

function getSellRefund(purchaseValue = 0): number {
  return Math.floor(Math.max(0, purchaseValue) * SHOP_SELL_REFUND_RATE);
}

function getWeaponUpgradeDesc(w: Weapon): string {
  const p = w.perLevel;
  const parts: string[] = [];
  if (p.damage) parts.push(`伤害+${p.damage}`);
  if (p.count) parts.push(`数量+${p.count}`);
  if (p.area) parts.push(`范围+${Math.round(p.area * 100)}%`);
  if (p.pierce) parts.push(`穿透+${p.pierce}`);
  if (p.duration) parts.push(`持续+${p.duration}s`);
  if (p.speed) parts.push(`速度+${p.speed}`);
  if (p.cooldown && p.cooldown < 0) parts.push(`冷却${p.cooldown}s`);
  if (p.knockback) parts.push(`击退+${p.knockback}`);
  if (p.growthLabel) parts.push(p.growthLabel);
  return parts.length > 0 ? parts.join(' ') : '提升基础强度';
}

function getModifierOptions(player: Player, modifierPool: GenericModifierType[]): UpgradeOption[] {
  if (modifierPool.length === 0) return [];
  const options: UpgradeOption[] = [];

  for (const weapon of player.weapons) {
    for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
      if (!modifierPool.includes(modifier.id)) continue;
      if (weapon.level < modifier.unlockLevel) continue;
      if (!modifier.compatibleFamilies.includes(weapon.family)) continue;
      if (!canApplyModifierToWeapon(weapon, modifier.id)) continue;
      const rarity = getModifierQuality(modifier.id, weapon).rarity;

      options.push({
        title: `${modifier.name} · ${weapon.name}`,
        description: modifier.desc,
        icon: modifier.icon,
        type: 'modifier',
        weaponType: weapon.type,
        weaponDefinitionId: weapon.definitionId,
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

function getSupplyOptions(player: Player, random: RandomSource): UpgradeOption[] {
  const options: UpgradeOption[] = [];

  if (player.hp <= player.maxHp * 0.65 && random.next() < SHOP_FIELD_RATION_OPTION_CHANCE) {
    options.push(createSupplyOption(SupplyType.FIELD_RATION, player));
  }

  if (player.level >= 4) {
    const supplyChance = Math.min(0.85, 0.35 * player.luck);
    if (random.next() < supplyChance) {
      options.push(createSupplyOption(SupplyType.OVERCLOCK, player));
    }
    if (random.next() < supplyChance) {
      options.push(createSupplyOption(SupplyType.AEGIS_CHARM, player));
    }
  }

  return options;
}

function createSupplyOption(type: SupplyType, player: Player): UpgradeOption {
  const data = SUPPLY_DATA[type];
  const rarity = getSupplyQuality(type, player).rarity;
  return {
    title: data.name,
    description: data.desc,
    icon: data.icon,
    type: 'supply',
    supplyType: type,
    rarity,
    cost: applyRarityCost(getSupplyCost(type, player.level), rarity),
    isMaxed: false,
  };
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
