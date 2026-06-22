import {
  GenericModifierType,
  PassiveType,
  SupplyType,
  WeaponEvolutionId,
  WeaponType,
  type Player,
  type UpgradeRarity,
  type Weapon,
  type WeaponEvolutionChoice,
} from '../types';
import { WEAPON_DATA } from './weapons';

export type CardQuality = {
  score: number;
  rarity: UpgradeRarity;
};

export function rarityFromQualityScore(score: number): UpgradeRarity {
  if (score >= 7.5) return 'legendary';
  if (score >= 5.5) return 'epic';
  if (score >= 3) return 'rare';
  if (score >= 1.4) return 'uncommon';
  return 'common';
}

function quality(score: number): CardQuality {
  return {
    score,
    rarity: rarityFromQualityScore(score),
  };
}

function ratio(value: number, baseline: number): number {
  if (baseline <= 0) return value > 0 ? 1 : 0;
  return Math.max(0, value / baseline);
}

export function getWeaponLevelQuality(weapon: Weapon): CardQuality {
  const data = WEAPON_DATA[weapon.type];
  const p = data.perLevel;
  let score = 0;

  if (p.damage) score += Math.min(1, ratio(p.damage, Math.max(weapon.damage, data.baseDamage))) * 4;
  if (p.cooldown && p.cooldown < 0) score += Math.min(1, ratio(Math.abs(p.cooldown), Math.max(0.15, weapon.cooldown))) * 6;
  if (p.count) score += p.count * 4.8;
  if (p.area) score += p.area * 16;
  if (p.pierce) score += weapon.pierce >= 999 ? p.pierce * 0.4 : p.pierce * 1.5;
  if (p.duration) score += Math.min(1, ratio(p.duration, Math.max(0.2, weapon.duration))) * 3.2;
  if (p.speed) score += Math.min(1, ratio(p.speed, Math.max(80, weapon.speed))) * 2.2;
  if (p.knockback) score += Math.min(1, ratio(p.knockback, Math.max(30, weapon.knockback))) * 1.2;
  if (p.growthLabel) score += 0.8;

  return quality(score);
}

function projectedBaseOutput(type: WeaponType): number {
  const data = WEAPON_DATA[type];
  const uptime = data.family === 'orbit' || data.family === 'zone'
    ? Math.min(1, data.baseDuration / data.baseCooldown)
    : 1;
  return (data.baseDamage * Math.max(1, data.baseCount) * uptime) / Math.max(0.25, data.baseCooldown);
}

export function getNewWeaponQuality(type: WeaponType): CardQuality {
  const data = WEAPON_DATA[type];
  let score = 3.1 + Math.min(2.4, projectedBaseOutput(type) / 18);
  if (data.metadata.tags.includes('piercing')) score += 0.4;
  if (data.family === 'aura' || data.family === 'orbit' || data.family === 'zone') score += 0.35;
  if (data.family === 'swing') score += 0.45;
  return quality(score);
}

const PASSIVE_QUALITY_SCORES: Record<PassiveType, number> = {
  [PassiveType.MIGHT]: 4.1,
  [PassiveType.SPEED]: 2.3,
  [PassiveType.MAX_HP]: 2.4,
  [PassiveType.ARMOR]: 2.6,
  [PassiveType.COOLDOWN]: 4.3,
  [PassiveType.AREA]: 3.2,
  [PassiveType.PICKUP_RANGE]: 1.8,
  [PassiveType.REGEN]: 1.9,
  [PassiveType.LUCK]: 2.2,
  [PassiveType.MAGNET]: 3.8,
  [PassiveType.CURSE]: 5.8,
  [PassiveType.REVIVE]: 8.2,
};

export function getPassiveQuality(type: PassiveType, nextLevel: number, maxLevel: number): CardQuality {
  let score = PASSIVE_QUALITY_SCORES[type];
  if (maxLevel > 1 && nextLevel === maxLevel) score += 0.35;
  if (
    nextLevel >= 4 &&
    (type === PassiveType.MIGHT || type === PassiveType.COOLDOWN || type === PassiveType.AREA)
  ) {
    score += 0.35;
  }
  return quality(score);
}

export function getModifierQuality(modifierType: GenericModifierType, weapon: Weapon): CardQuality {
  const stackCount = weapon.modifiers.filter((m) => m === modifierType).length;
  let score: number;

  switch (modifierType) {
    case GenericModifierType.DOUBLE_CAST:
    case GenericModifierType.SPLIT_CORE:
      score = 8.4;
      break;
    case GenericModifierType.REFLECTION_PRISM:
      score = stackCount >= 2 ? 8.0 : stackCount === 1 ? 6.2 : 4.2;
      break;
    case GenericModifierType.CHAIN_CONDUCTOR:
      score = 6.2;
      break;
    case GenericModifierType.ORBITAL_CORE:
      score = 6.0;
      break;
    case GenericModifierType.DEATH_BURST:
      score = 6.1;
      break;
    case GenericModifierType.IMPACT_PULSE:
      score = 4.0;
      break;
    case GenericModifierType.REPULSION_FIELD:
      score = weapon.family === 'aura' || weapon.family === 'swing' || weapon.family === 'zone' ? 3.1 : 2.6;
      break;
    case GenericModifierType.VELOCITY_RUNE:
      score = 2.3;
      break;
  }

  return quality(score);
}

const EVOLUTION_QUALITY_SCORES: Record<WeaponEvolutionId, number> = {
  [WeaponEvolutionId.WHIP_LONG]: 3.8,
  [WeaponEvolutionId.WHIP_QUICK]: 3.4,
  [WeaponEvolutionId.WHIP_RING]: 7.7,
  [WeaponEvolutionId.WHIP_RAZOR]: 5.8,
  [WeaponEvolutionId.MAGIC_TWIN]: 6.1,
  [WeaponEvolutionId.MAGIC_PIERCER]: 3.6,
  [WeaponEvolutionId.MAGIC_VOLLEY]: 8.0,
  [WeaponEvolutionId.MAGIC_FOCUS]: 5.9,
  [WeaponEvolutionId.BIBLE_TOME]: 5.7,
  [WeaponEvolutionId.BIBLE_ORBIT]: 3.8,
  [WeaponEvolutionId.BIBLE_SANCTUARY]: 7.9,
  [WeaponEvolutionId.BIBLE_REQUIEM]: 5.8,
  [WeaponEvolutionId.GARLIC_MIASMA]: 3.4,
  [WeaponEvolutionId.GARLIC_THORNS]: 4.0,
  [WeaponEvolutionId.GARLIC_CENSER]: 5.4,
  [WeaponEvolutionId.GARLIC_WARD]: 6.0,
  [WeaponEvolutionId.FIRE_POOL]: 3.8,
  [WeaponEvolutionId.FIRE_BURST]: 6.2,
  [WeaponEvolutionId.FIRE_STORM]: 8.1,
  [WeaponEvolutionId.FIRE_BRAND]: 5.8,
  [WeaponEvolutionId.HOLY_TIDE]: 5.6,
  [WeaponEvolutionId.HOLY_BASIN]: 3.9,
  [WeaponEvolutionId.HOLY_DELUGE]: 7.9,
  [WeaponEvolutionId.HOLY_SCOUR]: 5.6,
  [WeaponEvolutionId.LIGHTNING_ROD]: 5.7,
  [WeaponEvolutionId.LIGHTNING_FIELD]: 4.1,
  [WeaponEvolutionId.LIGHTNING_TEMPEST]: 8.1,
  [WeaponEvolutionId.LIGHTNING_JUDGMENT]: 5.7,
  [WeaponEvolutionId.AXE_BREAKER]: 3.8,
  [WeaponEvolutionId.AXE_BULWARK]: 3.9,
  [WeaponEvolutionId.AXE_EXECUTIONER]: 5.8,
  [WeaponEvolutionId.AXE_GUARD]: 7.6,
  [WeaponEvolutionId.RUNE_PIERCER]: 4.0,
  [WeaponEvolutionId.RUNE_FAN]: 7.7,
  [WeaponEvolutionId.RUNE_FOCUS]: 5.9,
  [WeaponEvolutionId.RUNE_ARRAY]: 7.8,
  [WeaponEvolutionId.MOON_TWIN]: 5.7,
  [WeaponEvolutionId.MOON_REACH]: 3.8,
  [WeaponEvolutionId.MOON_RING]: 7.8,
  [WeaponEvolutionId.MOON_REND]: 5.9,
};

export function getWeaponEvolutionQuality(choice: WeaponEvolutionChoice): CardQuality {
  return quality(EVOLUTION_QUALITY_SCORES[choice.id]);
}

export function getSupplyQuality(type: SupplyType, player: Player): CardQuality {
  switch (type) {
    case SupplyType.FIELD_RATION: {
      const missingRatio = 1 - player.hp / Math.max(1, player.maxHp);
      if (missingRatio >= 0.7) return quality(4.6);
      if (missingRatio >= 0.45) return quality(3.2);
      return quality(2.1);
    }
    case SupplyType.AEGIS_CHARM: {
      const hpRatio = player.hp / Math.max(1, player.maxHp);
      return quality(hpRatio <= 0.35 ? 5.7 : 4.6);
    }
    case SupplyType.OVERCLOCK: {
      const cooldownDebt = player.weapons.reduce((sum, weapon) => {
        const remainingRatio = 1 - Math.min(1, weapon.timer / Math.max(0.1, weapon.cooldown));
        return sum + Math.max(0, remainingRatio);
      }, 0);
      const longCooldownCount = player.weapons.filter((weapon) => weapon.cooldown >= 2).length;
      return quality(2.6 + player.weapons.length * 0.35 + cooldownDebt * 0.6 + longCooldownCount * 0.3);
    }
  }
}
