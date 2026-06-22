import {
  WeaponEvolutionId,
  WeaponType,
  type Weapon,
  type WeaponEvolutionChoice,
} from '../types';

export const WEAPON_EVOLUTION_DATA: Record<WeaponEvolutionId, WeaponEvolutionChoice> = {
  [WeaponEvolutionId.WHIP_LONG]: {
    id: WeaponEvolutionId.WHIP_LONG,
    weaponType: WeaponType.WHIP,
    tier: 4,
    name: '延展光鞭',
    icon: '⌁',
    desc: '光鞭更长，鞭身段数提升',
    rarity: 'rare',
  },
  [WeaponEvolutionId.WHIP_QUICK]: {
    id: WeaponEvolutionId.WHIP_QUICK,
    weaponType: WeaponType.WHIP,
    tier: 4,
    name: '疾影抽击',
    icon: '≋',
    desc: '鞭打冷却降低，保持短线快打',
    rarity: 'rare',
  },
  [WeaponEvolutionId.WHIP_RING]: {
    id: WeaponEvolutionId.WHIP_RING,
    weaponType: WeaponType.WHIP,
    tier: 8,
    name: '环扫鞭势',
    icon: '◎',
    desc: '鞭势覆盖更大圆周，近身清场更稳',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.WHIP_RAZOR]: {
    id: WeaponEvolutionId.WHIP_RAZOR,
    weaponType: WeaponType.WHIP,
    tier: 8,
    name: '裂光鞭刃',
    icon: '◇',
    desc: '鞭击伤害提升，保持单次高爆发',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.MAGIC_TWIN]: {
    id: WeaponEvolutionId.MAGIC_TWIN,
    weaponType: WeaponType.MAGIC_WAND,
    tier: 4,
    name: '双星法弹',
    icon: '∴',
    desc: '魔法弹数量+1，优先覆盖多个目标',
    rarity: 'rare',
  },
  [WeaponEvolutionId.MAGIC_PIERCER]: {
    id: WeaponEvolutionId.MAGIC_PIERCER,
    weaponType: WeaponType.MAGIC_WAND,
    tier: 4,
    name: '穿星弹芯',
    icon: '⇢',
    desc: '魔法弹获得穿透，适合直线清怪',
    rarity: 'rare',
  },
  [WeaponEvolutionId.MAGIC_VOLLEY]: {
    id: WeaponEvolutionId.MAGIC_VOLLEY,
    weaponType: WeaponType.MAGIC_WAND,
    tier: 8,
    name: '星雨齐射',
    icon: '✦',
    desc: '额外魔法弹数量提升，适合多重组合',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.MAGIC_FOCUS]: {
    id: WeaponEvolutionId.MAGIC_FOCUS,
    weaponType: WeaponType.MAGIC_WAND,
    tier: 8,
    name: '聚焦星核',
    icon: '◆',
    desc: '魔法弹伤害与速度提升，单发更可靠',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.BIBLE_TOME]: {
    id: WeaponEvolutionId.BIBLE_TOME,
    weaponType: WeaponType.BIBLE,
    tier: 4,
    name: '增页圣典',
    icon: '▤',
    desc: '环绕圣书数量+1，提升贴身覆盖',
    rarity: 'rare',
  },
  [WeaponEvolutionId.BIBLE_ORBIT]: {
    id: WeaponEvolutionId.BIBLE_ORBIT,
    weaponType: WeaponType.BIBLE,
    tier: 4,
    name: '广域经环',
    icon: '◌',
    desc: '圣书轨道更大，持续时间提升',
    rarity: 'rare',
  },
  [WeaponEvolutionId.BIBLE_SANCTUARY]: {
    id: WeaponEvolutionId.BIBLE_SANCTUARY,
    weaponType: WeaponType.BIBLE,
    tier: 8,
    name: '圣域书阵',
    icon: '◎',
    desc: '圣书数量继续提升，形成稳定护圈',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.BIBLE_REQUIEM]: {
    id: WeaponEvolutionId.BIBLE_REQUIEM,
    weaponType: WeaponType.BIBLE,
    tier: 8,
    name: '镇魂经文',
    icon: '✙',
    desc: '圣书伤害提升，旋转更快',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.GARLIC_MIASMA]: {
    id: WeaponEvolutionId.GARLIC_MIASMA,
    weaponType: WeaponType.GARLIC,
    tier: 4,
    name: '扩散蒜雾',
    icon: '◉',
    desc: '大蒜光环范围提升，保护更大身位',
    rarity: 'rare',
  },
  [WeaponEvolutionId.GARLIC_THORNS]: {
    id: WeaponEvolutionId.GARLIC_THORNS,
    weaponType: WeaponType.GARLIC,
    tier: 4,
    name: '辛辣刺雾',
    icon: '⌁',
    desc: '大蒜伤害跳动更快，近身压制更稳',
    rarity: 'rare',
  },
  [WeaponEvolutionId.GARLIC_CENSER]: {
    id: WeaponEvolutionId.GARLIC_CENSER,
    weaponType: WeaponType.GARLIC,
    tier: 8,
    name: '净化香炉',
    icon: '✹',
    desc: '大蒜光环伤害提升，适合贴身消耗',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.GARLIC_WARD]: {
    id: WeaponEvolutionId.GARLIC_WARD,
    weaponType: WeaponType.GARLIC,
    tier: 8,
    name: '驱邪结界',
    icon: '⊙',
    desc: '大蒜光环附带额外击退，强化防线',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.FIRE_POOL]: {
    id: WeaponEvolutionId.FIRE_POOL,
    weaponType: WeaponType.FIRE_WAND,
    tier: 4,
    name: '余烬火池',
    icon: '◌',
    desc: '火焰范围与持续时间提升',
    rarity: 'rare',
  },
  [WeaponEvolutionId.FIRE_BURST]: {
    id: WeaponEvolutionId.FIRE_BURST,
    weaponType: WeaponType.FIRE_WAND,
    tier: 4,
    name: '双焰爆燃',
    icon: '✺',
    desc: '每次施放额外落下一团火焰',
    rarity: 'rare',
  },
  [WeaponEvolutionId.FIRE_STORM]: {
    id: WeaponEvolutionId.FIRE_STORM,
    weaponType: WeaponType.FIRE_WAND,
    tier: 8,
    name: '焰雨阵列',
    icon: '✹',
    desc: '额外火焰数量提升，适合多重组合',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.FIRE_BRAND]: {
    id: WeaponEvolutionId.FIRE_BRAND,
    weaponType: WeaponType.FIRE_WAND,
    tier: 8,
    name: '灼魂烙印',
    icon: '✦',
    desc: '火焰伤害提升，单点燃烧更强',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.HOLY_TIDE]: {
    id: WeaponEvolutionId.HOLY_TIDE,
    weaponType: WeaponType.HOLY_WATER,
    tier: 4,
    name: '潮汐圣瓶',
    icon: '∿',
    desc: '圣水落点数量+1，覆盖更多目标',
    rarity: 'rare',
  },
  [WeaponEvolutionId.HOLY_BASIN]: {
    id: WeaponEvolutionId.HOLY_BASIN,
    weaponType: WeaponType.HOLY_WATER,
    tier: 4,
    name: '祝福水域',
    icon: '◌',
    desc: '圣水范围与持续时间提升',
    rarity: 'rare',
  },
  [WeaponEvolutionId.HOLY_DELUGE]: {
    id: WeaponEvolutionId.HOLY_DELUGE,
    weaponType: WeaponType.HOLY_WATER,
    tier: 8,
    name: '圣雨倾盆',
    icon: '☔',
    desc: '额外圣水数量提升，形成区域压制',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.HOLY_SCOUR]: {
    id: WeaponEvolutionId.HOLY_SCOUR,
    weaponType: WeaponType.HOLY_WATER,
    tier: 8,
    name: '净罪水痕',
    icon: '✙',
    desc: '圣水伤害提升，持续灼烧更强',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.LIGHTNING_ROD]: {
    id: WeaponEvolutionId.LIGHTNING_ROD,
    weaponType: WeaponType.LIGHTNING,
    tier: 4,
    name: '引雷印记',
    icon: 'ϟ',
    desc: '闪电目标数量+1，更容易清理小群',
    rarity: 'rare',
  },
  [WeaponEvolutionId.LIGHTNING_FIELD]: {
    id: WeaponEvolutionId.LIGHTNING_FIELD,
    weaponType: WeaponType.LIGHTNING,
    tier: 4,
    name: '雷场扩散',
    icon: '◉',
    desc: '闪电落点范围提升，命中群体更稳定',
    rarity: 'rare',
  },
  [WeaponEvolutionId.LIGHTNING_TEMPEST]: {
    id: WeaponEvolutionId.LIGHTNING_TEMPEST,
    weaponType: WeaponType.LIGHTNING,
    tier: 8,
    name: '风暴召令',
    icon: '✹',
    desc: '额外闪电数量提升，冷却略降',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.LIGHTNING_JUDGMENT]: {
    id: WeaponEvolutionId.LIGHTNING_JUDGMENT,
    weaponType: WeaponType.LIGHTNING,
    tier: 8,
    name: '审判雷冠',
    icon: '♢',
    desc: '闪电伤害提升，落雷范围更集中',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.AXE_BREAKER]: {
    id: WeaponEvolutionId.AXE_BREAKER,
    weaponType: WeaponType.AXE,
    tier: 4,
    name: '破阵横扫',
    icon: '⌒',
    desc: '斧击角度更宽，命中面更稳定',
    rarity: 'rare',
  },
  [WeaponEvolutionId.AXE_BULWARK]: {
    id: WeaponEvolutionId.AXE_BULWARK,
    weaponType: WeaponType.AXE,
    tier: 4,
    name: '护身斧幕',
    icon: '◜',
    desc: '斧击距离提升，更容易斩落弹幕',
    rarity: 'rare',
  },
  [WeaponEvolutionId.AXE_EXECUTIONER]: {
    id: WeaponEvolutionId.AXE_EXECUTIONER,
    weaponType: WeaponType.AXE,
    tier: 8,
    name: '处刑重斩',
    icon: '◆',
    desc: '斧击伤害提升，保留120度核心定位',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.AXE_GUARD]: {
    id: WeaponEvolutionId.AXE_GUARD,
    weaponType: WeaponType.AXE,
    tier: 8,
    name: '守势回旋',
    icon: '◡',
    desc: '斧幕更宽，冷却更短，偏防御清弹',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.RUNE_PIERCER]: {
    id: WeaponEvolutionId.RUNE_PIERCER,
    weaponType: WeaponType.RUNE_LANCE,
    tier: 4,
    name: '贯穿枪芒',
    icon: '╍',
    desc: '枪芒更长，穿透目标更多',
    rarity: 'rare',
  },
  [WeaponEvolutionId.RUNE_FAN]: {
    id: WeaponEvolutionId.RUNE_FAN,
    weaponType: WeaponType.RUNE_LANCE,
    tier: 4,
    name: '扇列枪阵',
    icon: '⋔',
    desc: '额外刺出两道枪芒，形成小扇面',
    rarity: 'rare',
  },
  [WeaponEvolutionId.RUNE_FOCUS]: {
    id: WeaponEvolutionId.RUNE_FOCUS,
    weaponType: WeaponType.RUNE_LANCE,
    tier: 8,
    name: '聚焦长枪',
    icon: '━',
    desc: '枪芒伤害和长度提升，适合单线贯穿',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.RUNE_ARRAY]: {
    id: WeaponEvolutionId.RUNE_ARRAY,
    weaponType: WeaponType.RUNE_LANCE,
    tier: 8,
    name: '符文枪阵',
    icon: '≡',
    desc: '额外枪芒数量提升，强化范围覆盖',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.MOON_TWIN]: {
    id: WeaponEvolutionId.MOON_TWIN,
    weaponType: WeaponType.MOON_BLADE,
    tier: 4,
    name: '双月回旋',
    icon: '☽',
    desc: '月轮刃数量+1，环绕覆盖更密',
    rarity: 'rare',
  },
  [WeaponEvolutionId.MOON_REACH]: {
    id: WeaponEvolutionId.MOON_REACH,
    weaponType: WeaponType.MOON_BLADE,
    tier: 4,
    name: '远月轨迹',
    icon: '◌',
    desc: '月轮轨道更大，持续时间提升',
    rarity: 'rare',
  },
  [WeaponEvolutionId.MOON_RING]: {
    id: WeaponEvolutionId.MOON_RING,
    weaponType: WeaponType.MOON_BLADE,
    tier: 8,
    name: '满月刃环',
    icon: '◎',
    desc: '额外月轮数量提升，形成刃环',
    rarity: 'legendary',
  },
  [WeaponEvolutionId.MOON_REND]: {
    id: WeaponEvolutionId.MOON_REND,
    weaponType: WeaponType.MOON_BLADE,
    tier: 8,
    name: '裂月刃锋',
    icon: '☾',
    desc: '月轮伤害与穿透提升，单刃更锋利',
    rarity: 'legendary',
  },
};

const emptyEvolutionLists = Object.values(WeaponType).reduce((acc, type) => {
  acc[type] = [];
  return acc;
}, {} as Record<WeaponType, WeaponEvolutionChoice[]>);

export const WEAPON_EVOLUTIONS_BY_WEAPON: Record<WeaponType, WeaponEvolutionChoice[]> =
  Object.values(WEAPON_EVOLUTION_DATA).reduce((acc, choice) => {
    acc[choice.weaponType].push(choice);
    return acc;
  }, emptyEvolutionLists);

export function getWeaponEvolutionChoices(type: WeaponType): WeaponEvolutionChoice[] {
  return WEAPON_EVOLUTIONS_BY_WEAPON[type] ?? [];
}

export function getAvailableWeaponEvolutionChoices(weapon: Weapon): WeaponEvolutionChoice[] {
  return getWeaponEvolutionChoices(weapon.type).filter((choice) =>
    weapon.level >= choice.tier &&
    weapon.evolutions[choice.tier] === undefined
  );
}

export function applyWeaponEvolution(weapon: Weapon, evolutionId: WeaponEvolutionId): boolean {
  const choice = WEAPON_EVOLUTION_DATA[evolutionId];
  if (!choice || choice.weaponType !== weapon.type) return false;
  if (weapon.level < choice.tier) return false;
  if (weapon.evolutions[choice.tier] !== undefined) return false;
  weapon.evolutions[choice.tier] = evolutionId;
  return true;
}

export function hasWeaponEvolution(weapon: Weapon, evolutionId: WeaponEvolutionId): boolean {
  return Object.values(weapon.evolutions).includes(evolutionId);
}

export function hasAnyWeaponEvolution(weapon: Weapon, evolutionIds: WeaponEvolutionId[]): boolean {
  return evolutionIds.some((id) => hasWeaponEvolution(weapon, id));
}

export function getWeaponEvolutionIds(weapon: Pick<Weapon, 'evolutions'>): WeaponEvolutionId[] {
  const ids: WeaponEvolutionId[] = [];
  const tier4 = weapon.evolutions[4];
  const tier8 = weapon.evolutions[8];
  if (tier4 !== undefined) ids.push(tier4);
  if (tier8 !== undefined) ids.push(tier8);
  return ids;
}

export function getWeaponEvolutionSummary(weapon: Weapon): string {
  return getWeaponEvolutionIds(weapon)
    .map((id) => WEAPON_EVOLUTION_DATA[id].name)
    .join(' / ');
}
