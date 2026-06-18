import type { MapZone } from '../types';

export const COLORS = {
  bg: '#0a0a1a',
  ground1: '#111128',
  ground2: '#0d0d22',
  groundLine: '#1a1a35',
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
  shadow: { line: '#1a1a45', dot: '#4a4a8a', accent: '#6a4aff', particle: '#7a6aff' },
  blood: { line: '#451a1a', dot: '#8a4a4a', accent: '#ff4a4a', particle: '#ff6a6a' },
  bone: { line: '#3a3a1a', dot: '#8a8a4a', accent: '#cccc66', particle: '#dddd88' },
  storm: { line: '#1a3a2a', dot: '#4a8a5a', accent: '#66ff88', particle: '#88ffaa' },
};
