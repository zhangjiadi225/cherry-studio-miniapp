import { GenericModifierType } from '../../types';
import {
  DEFAULT_RUN_DIFFICULTY_ID,
  getRunDifficultyPreset,
  type RunDifficultyId,
  type RunDifficultyPreset,
} from '../../data/runDifficulties';

export type MetaUpgradeId =
  | 'star_core'
  | 'paid_reroll'
  | 'shop_slot_1'
  | 'shop_slot_2'
  | 'reroll_discount'
  | 'opening_gold'
  | 'opening_choice'
  | 'ranged_path'
  | 'projectile_velocity'
  | 'orbital_core'
  | 'multi_shot'
  | 'projectile_split'
  | 'mechanism_path'
  | 'chain_conductor'
  | 'reflection_prism'
  | 'area_path'
  | 'impact_pulse'
  | 'repulsion_field'
  | 'damage_path'
  | 'death_burst';

export type DesktopTab = 'start' | 'growth' | 'skins' | 'codex';
export type CodexTab = 'weapons' | 'passives' | 'enemies' | 'modules';

export type SkinId = 'wanderer' | 'ember' | 'oracle';

export interface MetaUpgradeNode {
  id: MetaUpgradeId;
  name: string;
  icon: string;
  branch: 'core' | 'ranged' | 'mechanism' | 'area' | 'damage';
  kind: 'small' | 'notable' | 'keystone';
  cost: number;
  desc: string;
  effect: string;
  x: number;
  y: number;
  requires?: MetaUpgradeId[];
  grantsModifier?: GenericModifierType;
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
  difficultyId: RunDifficultyId;
}

export interface MetaState {
  soulFire: number;
  unlockedUpgrades: MetaUpgradeId[];
  selectedSkin: SkinId;
  selectedDifficulty: RunDifficultyId;
  runs: number;
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  lastRun?: RunSummary;
}

export const META_STORAGE_KEY = 'survivor-game:meta:v1';

export const META_UPGRADES: MetaUpgradeNode[] = [
  {
    id: 'star_core',
    name: '星核',
    icon: '✦',
    branch: 'core',
    kind: 'keystone',
    cost: 12,
    desc: '点亮后开启星图主干，后续节点只改变局内流程、开局节奏和模块池。',
    effect: '开启星图构筑',
    x: 0,
    y: 0,
  },
  {
    id: 'ranged_path',
    name: '远程特化',
    icon: '➶',
    branch: 'ranged',
    kind: 'notable',
    cost: 20,
    desc: '进入远程星座，后续节点强化弹幕、分裂和飞行速度。',
    effect: '远程模块方向',
    x: -0.38,
    y: -0.18,
    requires: ['star_core'],
  },
  {
    id: 'damage_path',
    name: '伤害特化',
    icon: '✹',
    branch: 'damage',
    kind: 'notable',
    cost: 20,
    desc: '进入伤害星座，后续节点让击杀触发爆破和雷暴。',
    effect: '伤害模块方向',
    x: -0.35,
    y: 0.2,
    requires: ['star_core'],
  },
  {
    id: 'paid_reroll',
    name: '星盘调度',
    icon: '⟳',
    branch: 'core',
    kind: 'small',
    cost: 18,
    desc: '免费刷新后，允许继续花魂晶刷新商店。',
    effect: '解锁魂晶刷新',
    x: -0.02,
    y: 0.26,
    requires: ['star_core'],
  },
  {
    id: 'area_path',
    name: '范围特化',
    icon: '◎',
    branch: 'area',
    kind: 'notable',
    cost: 20,
    desc: '进入范围星座，后续节点强化爆破、脉冲和控场。',
    effect: '范围模块方向',
    x: 0.38,
    y: -0.02,
    requires: ['star_core'],
  },
  {
    id: 'projectile_velocity',
    name: '疾行弹道',
    icon: '»',
    branch: 'ranged',
    kind: 'small',
    cost: 24,
    desc: '疾行符文进入模块池，飞行投射物更快命中远处目标。',
    effect: '解锁：子弹速度变快',
    x: -0.72,
    y: -0.24,
    requires: ['ranged_path'],
    grantsModifier: GenericModifierType.VELOCITY_RUNE,
  },
  {
    id: 'opening_gold',
    name: '星尘补给',
    icon: '◈',
    branch: 'core',
    kind: 'small',
    cost: 26,
    desc: '每局开始时获得 50 点局内魂晶，用来购买第一轮构筑牌或保留给刷新。',
    effect: '开局 +50 局内魂晶',
    x: 0.23,
    y: 0.45,
    requires: ['paid_reroll'],
  },
  {
    id: 'opening_choice',
    name: '开局战术',
    icon: '▤',
    branch: 'core',
    kind: 'notable',
    cost: 32,
    desc: '每局开始后立即进入一次商店选牌，先定方向再进入战斗。',
    effect: '开局选一次构筑牌',
    x: 0.04,
    y: 0.66,
    requires: ['opening_gold'],
  },
  {
    id: 'reroll_discount',
    name: '星火折返',
    icon: '◇',
    branch: 'core',
    kind: 'small',
    cost: 34,
    desc: '降低魂晶刷新起价和递增幅度。',
    effect: '刷新魂晶 10/20/30 改为 5/10/15',
    x: -0.18,
    y: 0.52,
    requires: ['paid_reroll'],
  },
  {
    id: 'mechanism_path',
    name: '机制特化',
    icon: '↯',
    branch: 'mechanism',
    kind: 'notable',
    cost: 24,
    desc: '机制路线不再直接从中心展开，需要先同时接触远程和伤害方向。',
    effect: '机制模块方向',
    x: -0.02,
    y: -0.42,
    requires: ['ranged_path', 'damage_path'],
  },
  {
    id: 'impact_pulse',
    name: '冲击脉冲',
    icon: '◎',
    branch: 'area',
    kind: 'small',
    cost: 28,
    desc: '冲击脉冲进入模块池，命中点产生小范围伤害。',
    effect: '解锁：命中脉冲',
    x: 0.68,
    y: 0.08,
    requires: ['area_path'],
    grantsModifier: GenericModifierType.IMPACT_PULSE,
  },
  {
    id: 'multi_shot',
    name: '多重射击',
    icon: '✦✦',
    branch: 'ranged',
    kind: 'notable',
    cost: 34,
    desc: '双重施放进入模块池，每次发动额外生成一次弱化攻击。',
    effect: '解锁：多重射击',
    x: -0.88,
    y: -0.02,
    requires: ['projectile_velocity'],
    grantsModifier: GenericModifierType.DOUBLE_CAST,
  },
  {
    id: 'orbital_core',
    name: '环绕核心',
    icon: '◎↻',
    branch: 'ranged',
    kind: 'notable',
    cost: 36,
    desc: '环绕核心进入模块池，让飞行投射物贴近角色做圆周运动。',
    effect: '解锁：子弹环绕',
    x: -0.72,
    y: -0.52,
    requires: ['projectile_velocity', 'mechanism_path'],
    grantsModifier: GenericModifierType.ORBITAL_CORE,
  },
  {
    id: 'chain_conductor',
    name: '闪电链',
    icon: '↯',
    branch: 'mechanism',
    kind: 'small',
    cost: 28,
    desc: '连锁导体进入模块池，命中后跳向附近敌人。',
    effect: '解锁：子弹弹射 / 闪电链',
    x: -0.26,
    y: -0.64,
    requires: ['mechanism_path'],
    grantsModifier: GenericModifierType.CHAIN_CONDUCTOR,
  },
  {
    id: 'reflection_prism',
    name: '反射棱镜',
    icon: '◇↝',
    branch: 'mechanism',
    kind: 'notable',
    cost: 36,
    desc: '反射棱镜进入模块池，命中后折射到附近未命中过的敌人。',
    effect: '解锁：多次反射',
    x: -0.02,
    y: -0.74,
    requires: ['chain_conductor'],
    grantsModifier: GenericModifierType.REFLECTION_PRISM,
  },
  {
    id: 'death_burst',
    name: '亡语爆炸',
    icon: '✹',
    branch: 'damage',
    kind: 'small',
    cost: 32,
    desc: '亡语爆破进入模块池，击杀时引爆尸骸。',
    effect: '解锁：亡语爆炸',
    x: -0.78,
    y: 0.52,
    requires: ['damage_path'],
    grantsModifier: GenericModifierType.DEATH_BURST,
  },
  {
    id: 'shop_slot_1',
    name: '星界货架 I',
    icon: '▣',
    branch: 'core',
    kind: 'small',
    cost: 24,
    desc: '局内等级达到 6 后，商店额外展示 1 张牌。',
    effect: 'Lv6 商店 +1 牌',
    x: 0.2,
    y: 0.82,
    requires: ['opening_choice'],
  },
  {
    id: 'repulsion_field',
    name: '排斥力场',
    icon: '⟲',
    branch: 'area',
    kind: 'notable',
    cost: 34,
    desc: '排斥力场进入模块池，命中时额外击退敌人。',
    effect: '解锁：控场击退',
    x: 0.9,
    y: 0.28,
    requires: ['impact_pulse', 'mechanism_path'],
    grantsModifier: GenericModifierType.REPULSION_FIELD,
  },
  {
    id: 'shop_slot_2',
    name: '星界货架 II',
    icon: '▦',
    branch: 'core',
    kind: 'notable',
    cost: 42,
    desc: '局内等级达到 11 后，商店再额外展示 1 张牌。',
    effect: 'Lv11 商店 +1 牌',
    x: -0.08,
    y: 0.82,
    requires: ['shop_slot_1', 'reroll_discount'],
  },
  {
    id: 'projectile_split',
    name: '子弹分裂',
    icon: '✧',
    branch: 'ranged',
    kind: 'keystone',
    cost: 46,
    desc: '分裂核心进入模块池，飞行投射物首次命中后分裂。',
    effect: '解锁：子弹分裂',
    x: -0.95,
    y: -0.28,
    requires: ['multi_shot', 'chain_conductor'],
    grantsModifier: GenericModifierType.SPLIT_CORE,
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
    selectedDifficulty: DEFAULT_RUN_DIFFICULTY_ID,
    runs: 0,
    bestTime: 0,
    bestKills: 0,
    bestLevel: 1,
  };
}

export function loadMetaState(raw: string | null = null): MetaState {
  try {
    if (!raw) return createDefaultMetaState();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    const base = createDefaultMetaState();
    return {
      ...base,
      ...parsed,
      soulFire: Math.max(0, Math.floor(parsed.soulFire ?? base.soulFire)),
      unlockedUpgrades: filterValidUpgrades(parsed.unlockedUpgrades),
      selectedSkin: getSkinById(parsed.selectedSkin) ? parsed.selectedSkin! : base.selectedSkin,
      selectedDifficulty: getRunDifficultyPreset(parsed.selectedDifficulty).id,
      runs: Math.max(0, Math.floor(parsed.runs ?? 0)),
      bestTime: Math.max(0, parsed.bestTime ?? 0),
      bestKills: Math.max(0, Math.floor(parsed.bestKills ?? 0)),
      bestLevel: Math.max(1, Math.floor(parsed.bestLevel ?? 1)),
    };
  } catch {
    return createDefaultMetaState();
  }
}

export function serializeMetaState(meta: MetaState): string {
  return JSON.stringify(meta);
}

export function hasMetaUpgrade(meta: MetaState, id: MetaUpgradeId): boolean {
  return meta.unlockedUpgrades.includes(id);
}

export function canBuyMetaUpgrade(meta: MetaState, node: MetaUpgradeNode): boolean {
  if (hasMetaUpgrade(meta, node.id)) return false;
  if (meta.soulFire < node.cost) return false;
  return (node.requires ?? []).every((id) => hasMetaUpgrade(meta, id));
}

export function getUnlockedModifierTypes(meta: MetaState): GenericModifierType[] {
  const modifiers: GenericModifierType[] = [];
  for (const node of META_UPGRADES) {
    if (node.grantsModifier && hasMetaUpgrade(meta, node.id)) {
      modifiers.push(node.grantsModifier);
    }
  }
  return modifiers;
}

export function buyMetaUpgrade(meta: MetaState, id: MetaUpgradeId): MetaState {
  const node = META_UPGRADES.find((item) => item.id === id);
  if (!node || !canBuyMetaUpgrade(meta, node)) return meta;
  const next: MetaState = {
    ...meta,
    soulFire: meta.soulFire - node.cost,
    unlockedUpgrades: [...meta.unlockedUpgrades, id],
  };
  return next;
}

export function getSkinById(id?: string): CharacterSkin | undefined {
  return CHARACTER_SKINS.find((skin) => skin.id === id);
}

export function selectSkin(meta: MetaState, id: SkinId): MetaState {
  if (!getSkinById(id)) return meta;
  return { ...meta, selectedSkin: id };
}

export function selectRunDifficulty(meta: MetaState, id: RunDifficultyId): MetaState {
  return { ...meta, selectedDifficulty: getRunDifficultyPreset(id).id };
}

export function getInitialShards(meta: MetaState): number {
  return hasMetaUpgrade(meta, 'opening_gold') ? 50 : 0;
}

export function hasOpeningCardDraft(meta: MetaState): boolean {
  return hasMetaUpgrade(meta, 'opening_choice');
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
  return hasMetaUpgrade(meta, 'star_core');
}

const SOUL_FIRE_BASE_REWARD = 4;
const SOUL_FIRE_PERFORMANCE_POOL = 56;
const SOUL_FIRE_VICTORY_BONUS = 10;
const SOUL_FIRE_TARGET_KILLS = 1200;
const SOUL_FIRE_TARGET_LEVEL = 28;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function calculateSoulFireReward(
  stats: { time: number; kills: number; level: number },
  runDifficulty: RunDifficultyPreset = getRunDifficultyPreset(DEFAULT_RUN_DIFFICULTY_ID)
): number {
  const timePct = clamp01(stats.time / runDifficulty.duration);
  const killPct = clamp01(stats.kills / SOUL_FIRE_TARGET_KILLS);
  const levelPct = clamp01((stats.level - 1) / (SOUL_FIRE_TARGET_LEVEL - 1));
  const completionPct = timePct * 0.55 + killPct * 0.3 + levelPct * 0.15;
  const victoryBonus = stats.time >= runDifficulty.duration ? SOUL_FIRE_VICTORY_BONUS : 0;
  return Math.max(1, Math.round(
    (SOUL_FIRE_BASE_REWARD + Math.floor(SOUL_FIRE_PERFORMANCE_POOL * completionPct) + victoryBonus) *
    runDifficulty.soulFireRewardMult
  ));
}

export function applyRunReward(
  meta: MetaState,
  stats: { time: number; kills: number; level: number },
  runDifficulty: RunDifficultyPreset = getRunDifficultyPreset(meta.selectedDifficulty),
  options: { previousSoulFireReward?: number; countRun?: boolean } = {}
): MetaState {
  const totalSoulFireReward = calculateSoulFireReward(stats, runDifficulty);
  const soulFireEarned = Math.max(0, totalSoulFireReward - (options.previousSoulFireReward ?? 0));
  const next: MetaState = {
    ...meta,
    soulFire: meta.soulFire + soulFireEarned,
    runs: meta.runs + (options.countRun === false ? 0 : 1),
    bestTime: Math.max(meta.bestTime, stats.time),
    bestKills: Math.max(meta.bestKills, stats.kills),
    bestLevel: Math.max(meta.bestLevel, stats.level),
    lastRun: {
      ...stats,
      victory: stats.time >= runDifficulty.duration,
      soulFireEarned,
      difficultyId: runDifficulty.id,
    },
  };
  return next;
}

function filterValidUpgrades(ids?: unknown[]): MetaUpgradeId[] {
  if (!Array.isArray(ids)) return [];
  const valid = new Set(META_UPGRADES.map((node) => node.id));
  return [...new Set(ids.map(String).filter((id): id is MetaUpgradeId => valid.has(id as MetaUpgradeId)))];
}
