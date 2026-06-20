import { describe, expect, it } from 'vitest';
import { EnemyType, GenericModifierType, WeaponType, type Enemy, type Projectile, type Weapon } from '../../types';
import { GENERIC_MODIFIER_MASK, WEAPON_DATA } from '../../constants';
import type { EnemyQuery } from '../enemy/EnemyQuery';
import { createPlayer } from '../player/Player';
import { createWeapon, updateProjectile, updateWeapon, upgradeWeapon } from './Weapon';

const VALID_WEAPON_TAGS = new Set(['melee', 'ranged', 'piercing']);
const VALID_WEAPON_DISPLAY_MODES = new Set(['none', 'stowed', 'orbit', 'aura_source', 'relic', 'body_mark']);

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
    isEmpowered: false,
    trait: 'none',
    traitCooldown: 0,
    traitWindup: 0,
    traitDuration: 0,
    traitDirX: 0,
    traitDirY: 0,
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

function addModifier(weapon: Weapon, modifier: GenericModifierType) {
  weapon.modifiers.push(modifier);
  weapon.modifierMask |= GENERIC_MODIFIER_MASK[modifier];
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
  it('keeps every weapon classified with lightweight metadata', () => {
    for (const data of Object.values(WEAPON_DATA)) {
      expect(VALID_WEAPON_DISPLAY_MODES.has(data.metadata.displayMode)).toBe(true);
      expect(Number.isInteger(data.metadata.displayPriority)).toBe(true);
      if (data.metadata.displayMode === 'none') expect(data.metadata.displayPriority).toBe(0);
      expect(data.metadata.tags.length).toBeGreaterThan(0);
      expect(data.metadata.tags.every((tag) => VALID_WEAPON_TAGS.has(tag))).toBe(true);
    }
  });

  it('uses display metadata to identify side-slot equipped weapon assets', () => {
    const displayTypes = Object.entries(WEAPON_DATA)
      .filter(([, data]) => ['stowed', 'orbit', 'aura_source', 'relic'].includes(data.metadata.displayMode))
      .sort(([, a], [, b]) => b.metadata.displayPriority - a.metadata.displayPriority)
      .map(([type]) => type);

    expect(displayTypes).toEqual([
      WeaponType.WHIP,
      WeaponType.BIBLE,
      WeaponType.GARLIC,
      WeaponType.HOLY_WATER,
    ]);
  });

  it('treats lightning as a player body mark instead of a side-slot weapon', () => {
    expect(WEAPON_DATA[WeaponType.LIGHTNING].metadata.displayMode).toBe('body_mark');
    expect(WEAPON_DATA[WeaponType.LIGHTNING].metadata.displayPriority).toBeGreaterThan(
      WEAPON_DATA[WeaponType.GARLIC].metadata.displayPriority
    );
  });

  it('tags current piercing projectile weapons for later build rules', () => {
    expect(WEAPON_DATA[WeaponType.AXE].metadata.tags).toContain('piercing');
    expect(WEAPON_DATA[WeaponType.RUNE_LANCE].metadata.tags).toContain('piercing');
    expect(WEAPON_DATA[WeaponType.MOON_BLADE].metadata.tags).toContain('piercing');
  });

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

  it('fires rune lances as high-speed piercing projectiles', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.RUNE_LANCE);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(120, 0)]));

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].type).toBe(WeaponType.RUNE_LANCE);
    expect(projectiles[0].pierce).toBeGreaterThanOrEqual(4);
    expect(projectiles[0].vx).toBeGreaterThan(500);
  });

  it('fires moon blades as multiple piercing blades', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MOON_BLADE);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(120, 0)]));

    expect(projectiles).toHaveLength(2);
    expect(projectiles.every((projectile) => projectile.type === WeaponType.MOON_BLADE)).toBe(true);
    expect(projectiles.every((projectile) => projectile.pierce >= 2)).toBe(true);
  });

  it('makes each double-cast projectile orbit around the moving player with orbital core', () => {
    const player = createPlayer();
    player.x = 20;
    player.y = 30;
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.DOUBLE_CAST);
    addModifier(weapon, GenericModifierType.ORBITAL_CORE);
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(160, 30)]));

    expect(projectiles).toHaveLength(2);
    expect(projectiles.every((projectile) => projectile.orbitFollowPlayer)).toBe(true);
    expect(projectiles.every((projectile) => projectile.orbitRadius! > 48)).toBe(true);

    const projectile = projectiles[0];
    const radius = projectile.orbitRadius!;
    const startAngle = projectile.orbitAngle!;
    player.x = 80;
    player.y = -10;

    updateProjectile(projectile, 0.25, player);

    expect(projectile.orbitAngle).not.toBe(startAngle);
    expect(Math.hypot(projectile.x - player.x, projectile.y - player.y)).toBeCloseTo(radius, 5);
  });

  it('keeps arcing axe throws out of orbital core movement', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.AXE);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.ORBITAL_CORE);
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([]));

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].orbitFollowPlayer).not.toBe(true);
    expect(projectiles[0].orbitAngle).toBeUndefined();
    expect(projectiles[0].gravY).toBeGreaterThan(0);
  });
});
