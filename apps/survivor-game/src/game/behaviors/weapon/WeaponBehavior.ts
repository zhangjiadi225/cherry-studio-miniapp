import type { Player, Projectile, Weapon } from '../../types';
import type { EnemyQuery } from '../../systems/enemy/EnemyQuery';

export const CoreWeaponBehaviorId = {
  PROJECTILE_RECIPE: 'builtin.weapon.recipe-projectile',
  WHIP: 'builtin.weapon.whip',
  MAGIC_WAND: 'builtin.weapon.magic-wand',
  BIBLE: 'builtin.weapon.bible',
  GARLIC_AURA: 'builtin.weapon.garlic-aura',
  FIRE_WAND: 'builtin.weapon.fire-wand',
  HOLY_WATER: 'builtin.weapon.holy-water',
  LIGHTNING: 'builtin.weapon.lightning',
  AXE: 'builtin.weapon.axe',
  RUNE_LANCE: 'builtin.weapon.rune-lance',
  MOON_BLADE: 'builtin.weapon.moon-blade',
} as const;

export interface WeaponFireContext {
  weapon: Weapon;
  player: Player;
  projectiles: Projectile[];
  damage: number;
  area: number;
  enemyQuery: EnemyQuery;
}

export interface WeaponBehaviorHandler {
  readonly id: string;
  readonly mode: 'cast' | 'continuous';
  readonly usesRuntimePlan?: boolean;
  fire(context: WeaponFireContext): boolean;
}
