import type { MapZone } from '../types';

export const COLORS = {
  bg: '#d8ddd2',
  groundOutside: '#b8beb5',
  ground1: '#101827',
  ground2: '#0b1020',
  groundLine: '#24324d',
  playerBody: '#4a9eff',
  playerOutline: '#2d7ad6',
  playerGlow: 'rgba(74,158,255,0.3)',
  hpBar: '#ff4444',
  hpBarBg: '#333333',
  xpBar: '#44ff44',
  xpBarBg: '#333333',
  gemSmall: '#44ddff',
  gemMedium: '#44ff88',
  gemLarge: '#ffdd44',
  uiBg: 'rgba(0,0,0,0.75)',
  uiBorder: '#444',
  uiText: '#ffffff',
  uiDim: '#888888',
  danger: '#ff4444',
  warning: '#ffaa44',
  heal: '#44ff88',

  magicWand: '#64b4ff',
  fireWand: '#ff7800',
  axe: '#b4783c',
  lightning: '#ffff64',
  whip: '#c89664',
  bible: '#ffffc8',
  holyWater: '#6496ff',
  garlic: '#c8c864',

  critical: '#ff8844',
  elite: '#ffd700',
  boss: '#ff4444',
  levelUp: '#ffd700',
  revive: '#ffd700',
};

export const ZONE_COLORS: Record<MapZone, { line: string; dot: string; accent: string; particle: string }> = {
  shadow: { line: '#202852', dot: '#5261a8', accent: '#8a6fff', particle: '#a190ff' },
  blood: { line: '#522024', dot: '#a84f56', accent: '#ff5858', particle: '#ff8070' },
  bone: { line: '#4a4024', dot: '#b1a66a', accent: '#eadb86', particle: '#fff0a6' },
  storm: { line: '#1e4b3f', dot: '#5fc092', accent: '#66ffc2', particle: '#93ffda' },
};
