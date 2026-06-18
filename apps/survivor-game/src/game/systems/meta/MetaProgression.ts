export type MetaUpgradeId =
  | 'paid_reroll'
  | 'shop_slot_1'
  | 'shop_slot_2'
  | 'reroll_discount'
  | 'module_cards'
  | 'opening_gold';

export type DesktopTab = 'start' | 'growth' | 'skins' | 'codex';
export type CodexTab = 'weapons' | 'passives' | 'enemies' | 'modules';

export type SkinId = 'wanderer' | 'ember' | 'oracle';

export interface MetaUpgradeNode {
  id: MetaUpgradeId;
  name: string;
  icon: string;
  branch: 'shop' | 'build' | 'risk';
  cost: number;
  desc: string;
  effect: string;
  requires?: MetaUpgradeId[];
}

export interface CharacterSkin {
  id: SkinId;
  name: string;
  icon: string;
  archetype: string;
  desc: string;
  body: string;
  outline: string;
  glow: string;
}

export interface RunSummary {
  time: number;
  kills: number;
  level: number;
  victory: boolean;
  soulFireEarned: number;
}

export interface MetaState {
  soulFire: number;
  unlockedUpgrades: MetaUpgradeId[];
  selectedSkin: SkinId;
  runs: number;
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  lastRun?: RunSummary;
}

const META_STORAGE_KEY = 'survivor-game:meta:v1';

export const META_UPGRADES: MetaUpgradeNode[] = [
  {
    id: 'paid_reroll',
    name: '黑市刷新',
    icon: '⟳',
    branch: 'shop',
    cost: 18,
    desc: '免费刷新后，允许继续花魂晶刷新商店。',
    effect: '解锁魂晶刷新',
  },
  {
    id: 'shop_slot_1',
    name: '扩展货架 I',
    icon: '▣',
    branch: 'shop',
    cost: 24,
    desc: '局内等级达到 6 后，商店额外展示 1 张牌。',
    effect: 'Lv6 商店 +1 牌',
    requires: ['paid_reroll'],
  },
  {
    id: 'shop_slot_2',
    name: '扩展货架 II',
    icon: '▦',
    branch: 'shop',
    cost: 42,
    desc: '局内等级达到 11 后，商店再额外展示 1 张牌。',
    effect: 'Lv11 商店 +1 牌',
    requires: ['shop_slot_1'],
  },
  {
    id: 'reroll_discount',
    name: '议价术',
    icon: '◇',
    branch: 'shop',
    cost: 34,
    desc: '降低魂晶刷新起价和递增幅度。',
    effect: '刷新魂晶 10/20/30 改为 5/10/15',
    requires: ['paid_reroll'],
  },
  {
    id: 'module_cards',
    name: '模块工坊',
    icon: '✦',
    branch: 'build',
    cost: 30,
    desc: '通用模块牌进入商店，武器可以获得额外机制。',
    effect: '解锁通用模块牌',
    requires: ['paid_reroll'],
  },
  {
    id: 'opening_gold',
    name: '开局魂晶',
    icon: '◈',
    branch: 'shop',
    cost: 26,
    desc: '每局开始时获得少量魂晶，第一轮商店更稳定。',
    effect: '开局 +10 魂晶',
  },
];

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 'wanderer',
    name: '夜行者',
    icon: '●',
    archetype: '圆形幸存者',
    desc: '默认角色轮廓，双眼读向清晰。',
    body: '#4a9eff',
    outline: '#ffffff',
    glow: 'rgba(74,158,255,',
  },
  {
    id: 'ember',
    name: '余烬',
    icon: '◆',
    archetype: '火核菱形体',
    desc: '尖角火核、火焰尾迹和菱形身体。',
    body: '#ff7a45',
    outline: '#ffd166',
    glow: 'rgba(255,122,69,',
  },
  {
    id: 'oracle',
    name: '星谕',
    icon: '✦',
    archetype: '星环斗篷',
    desc: '星环、斗篷轮廓和单眼符文。',
    body: '#9d7bff',
    outline: '#d7ccff',
    glow: 'rgba(157,123,255,',
  },
];

export function createDefaultMetaState(): MetaState {
  return {
    soulFire: 0,
    unlockedUpgrades: [],
    selectedSkin: 'wanderer',
    runs: 0,
    bestTime: 0,
    bestKills: 0,
    bestLevel: 1,
  };
}

export function loadMetaState(): MetaState {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return createDefaultMetaState();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    const base = createDefaultMetaState();
    return {
      ...base,
      ...parsed,
      soulFire: Math.max(0, Math.floor(parsed.soulFire ?? base.soulFire)),
      unlockedUpgrades: filterValidUpgrades(parsed.unlockedUpgrades),
      selectedSkin: getSkinById(parsed.selectedSkin) ? parsed.selectedSkin! : base.selectedSkin,
      runs: Math.max(0, Math.floor(parsed.runs ?? 0)),
      bestTime: Math.max(0, parsed.bestTime ?? 0),
      bestKills: Math.max(0, Math.floor(parsed.bestKills ?? 0)),
      bestLevel: Math.max(1, Math.floor(parsed.bestLevel ?? 1)),
    };
  } catch {
    return createDefaultMetaState();
  }
}

export function saveMetaState(meta: MetaState) {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
}

export function hasMetaUpgrade(meta: MetaState, id: MetaUpgradeId): boolean {
  return meta.unlockedUpgrades.includes(id);
}

export function canBuyMetaUpgrade(meta: MetaState, node: MetaUpgradeNode): boolean {
  if (hasMetaUpgrade(meta, node.id)) return false;
  if (meta.soulFire < node.cost) return false;
  return (node.requires ?? []).every((id) => hasMetaUpgrade(meta, id));
}

export function buyMetaUpgrade(meta: MetaState, id: MetaUpgradeId): MetaState {
  const node = META_UPGRADES.find((item) => item.id === id);
  if (!node || !canBuyMetaUpgrade(meta, node)) return meta;
  const next: MetaState = {
    ...meta,
    soulFire: meta.soulFire - node.cost,
    unlockedUpgrades: [...meta.unlockedUpgrades, id],
  };
  saveMetaState(next);
  return next;
}

export function getSkinById(id?: string): CharacterSkin | undefined {
  return CHARACTER_SKINS.find((skin) => skin.id === id);
}

export function selectSkin(meta: MetaState, id: SkinId): MetaState {
  if (!getSkinById(id)) return meta;
  const next = { ...meta, selectedSkin: id };
  saveMetaState(next);
  return next;
}

export function getInitialShards(meta: MetaState): number {
  return hasMetaUpgrade(meta, 'opening_gold') ? 10 : 0;
}

export function getMetaShopOptionCount(meta: MetaState, playerLevel: number): number {
  let count = 4;
  if (hasMetaUpgrade(meta, 'shop_slot_1') && playerLevel >= 6) count++;
  if (hasMetaUpgrade(meta, 'shop_slot_2') && playerLevel >= 11) count++;
  return count;
}

export function canPaidReroll(meta: MetaState): boolean {
  return hasMetaUpgrade(meta, 'paid_reroll');
}

export function getMetaRerollCost(meta: MetaState, paidRerollsThisRound: number): number {
  const base = hasMetaUpgrade(meta, 'reroll_discount') ? 5 : 10;
  return base + Math.max(0, paidRerollsThisRound) * base;
}

export function areModifierCardsUnlocked(meta: MetaState): boolean {
  return hasMetaUpgrade(meta, 'module_cards');
}

const SOUL_FIRE_BASE_REWARD = 4;
const SOUL_FIRE_PERFORMANCE_POOL = 56;
const SOUL_FIRE_VICTORY_BONUS = 10;
const SOUL_FIRE_TARGET_TIME = 15 * 60;
const SOUL_FIRE_TARGET_KILLS = 1200;
const SOUL_FIRE_TARGET_LEVEL = 28;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function calculateSoulFireReward(stats: { time: number; kills: number; level: number }): number {
  const timePct = clamp01(stats.time / SOUL_FIRE_TARGET_TIME);
  const killPct = clamp01(stats.kills / SOUL_FIRE_TARGET_KILLS);
  const levelPct = clamp01((stats.level - 1) / (SOUL_FIRE_TARGET_LEVEL - 1));
  const completionPct = timePct * 0.55 + killPct * 0.3 + levelPct * 0.15;
  const victoryBonus = stats.time >= SOUL_FIRE_TARGET_TIME ? SOUL_FIRE_VICTORY_BONUS : 0;
  return SOUL_FIRE_BASE_REWARD + Math.floor(SOUL_FIRE_PERFORMANCE_POOL * completionPct) + victoryBonus;
}

export function applyRunReward(
  meta: MetaState,
  stats: { time: number; kills: number; level: number }
): MetaState {
  const soulFireEarned = calculateSoulFireReward(stats);
  const next: MetaState = {
    ...meta,
    soulFire: meta.soulFire + soulFireEarned,
    runs: meta.runs + 1,
    bestTime: Math.max(meta.bestTime, stats.time),
    bestKills: Math.max(meta.bestKills, stats.kills),
    bestLevel: Math.max(meta.bestLevel, stats.level),
    lastRun: {
      ...stats,
      victory: stats.time >= SOUL_FIRE_TARGET_TIME,
      soulFireEarned,
    },
  };
  saveMetaState(next);
  return next;
}

function filterValidUpgrades(ids?: MetaUpgradeId[]): MetaUpgradeId[] {
  if (!Array.isArray(ids)) return [];
  const valid = new Set(META_UPGRADES.map((node) => node.id));
  return ids.filter((id) => valid.has(id));
}
