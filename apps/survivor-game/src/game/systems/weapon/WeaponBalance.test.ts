import { describe, expect, it } from 'vitest';
import { EnemyType, WeaponType, type Enemy, type Projectile, type Weapon } from '../../types';
import type { EnemyQuery } from '../enemy/EnemyQuery';
import { createPlayer } from '../player/Player';
import { createWeapon, updateWeapon, upgradeWeapon } from './Weapon';

function makeEnemy(x: number, y: number): Enemy {
  return {
    id: 1,
    x,
    y,
    radius: 18,
    hp: 10,
    maxHp: 10,
    speed: 0,
    damage: 1,
    type: EnemyType.ZOMBIE,
    isElite: false,
    isBoss: false,
    knockbackX: 0,
    knockbackY: 0,
    hitFlash: 0,
    animTimer: 0,
    xpValue: 1,
    contactCooldown: 0,
    attackCooldown: 0,
    attackWindup: 0,
    attackPatternIndex: 0,
    pendingAttackPattern: 0,
  };
}

function enemyQuery(enemies: Enemy[]): EnemyQuery {
  return {
    forNearby(_x, _y, _radius, visit) {
      for (const enemy of enemies) visit(enemy);
    },
  };
}

function weaponAtLevel(type: WeaponType, level: number): Weapon {
  const weapon = createWeapon(type);
  while (weapon.level < level) upgradeWeapon(weapon);
  return weapon;
}

function projectedOutput(type: WeaponType, level: number): number {
  const weapon = weaponAtLevel(type, level);
  const effectiveCount = type === WeaponType.WHIP ? weapon.level : weapon.count;
  const usesPersistentUptime = type === WeaponType.BIBLE || type === WeaponType.HOLY_WATER;
  const uptime = usesPersistentUptime
    ? Math.min(1, weapon.duration / weapon.cooldown)
    : 1;

  return (weapon.damage * effectiveCount * uptime) / weapon.cooldown;
}

describe('weapon output model', () => {
  it('keeps late lightning from dominating every other damage choice', () => {
    expect(projectedOutput(WeaponType.LIGHTNING, 8)).toBeLessThan(450);
  });

  it('keeps level 8 bible above the decorative damage band', () => {
    expect(projectedOutput(WeaponType.BIBLE, 8)).toBeGreaterThan(70);
  });

  it('caps weapon upgrades at level 8', () => {
    const weapon = weaponAtLevel(WeaponType.MAGIC_WAND, 8);

    expect(weapon.level).toBe(8);
    expect(upgradeWeapon(weapon)).toBe(false);
    expect(weapon.level).toBe(8);
  });

  it('keeps capped magic wand output under runaway scaling', () => {
    const levelOneOutput = projectedOutput(WeaponType.MAGIC_WAND, 1);
    const cappedOutput = projectedOutput(WeaponType.MAGIC_WAND, 8);

    expect(cappedOutput / levelOneOutput).toBeLessThan(40);
  });

  it('aims whip swings toward nearby enemies in any direction', () => {
    const player = createPlayer();
    player.facingLeft = false;
    const weapon = createWeapon(WeaponType.WHIP);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(0, -120)]));

    expect(projectiles).toHaveLength(1);
    expect(Math.abs(projectiles[0].vx)).toBeLessThan(0.01);
    expect(projectiles[0].vy).toBeLessThan(-0.99);
    expect(projectiles[0].y).toBeLessThan(player.y - 20);
  });
});
