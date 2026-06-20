import { describe, expect, it } from 'vitest';
import {
  EnemyType,
  GenericModifierType,
  WeaponType,
  type DamageNumber,
  type Enemy,
  type EnemyProjectile,
  type Particle,
  type Projectile,
  type Weapon,
} from '../../types';
import { GENERIC_MODIFIER_MASK, WEAPON_DATA } from '../../constants';
import type { EnemyQuery } from '../enemy/EnemyQuery';
import { createPlayer } from '../player/Player';
import { ProjectileCombat } from '../combat/ProjectileCombat';
import { createWeapon, updateProjectile, updateWeapon, upgradeWeapon } from './Weapon';

const VALID_WEAPON_TAGS = new Set(['melee', 'ranged', 'piercing']);
const VALID_WEAPON_DISPLAY_MODES = new Set(['none', 'stowed', 'orbit', 'aura_source', 'relic', 'body_mark']);
const VALID_WEAPON_BEHAVIORS = new Set([
  'persistent_melee',
  'cleave_melee',
  'focus_cast',
  'true_projectile',
  'line_piercer',
  'orbit_summon',
  'damage_aura',
  'area_control',
  'body_enhancement',
]);

function makeEnemy(x: number, y: number, id = 1): Enemy {
  return {
    id,
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

function makeEnemyProjectile(x: number, y: number, id = 1): EnemyProjectile {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    damage: 6,
    radius: 4,
    life: 1,
    maxLife: 1,
    sourceType: EnemyType.CULTIST,
    sourceId: id,
    kind: 'cultist_bolt',
    color: '#b58cff',
    glowColor: 'rgba(181,140,255,0.38)',
    animTimer: 0,
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
      expect(VALID_WEAPON_BEHAVIORS.has(data.metadata.behavior)).toBe(true);
      expect(VALID_WEAPON_DISPLAY_MODES.has(data.metadata.displayMode)).toBe(true);
      expect(Number.isInteger(data.metadata.displayPriority)).toBe(true);
      if (data.metadata.displayMode === 'none') expect(data.metadata.displayPriority).toBe(0);
      expect(data.metadata.tags.length).toBeGreaterThan(0);
      expect(data.metadata.tags.every((tag) => VALID_WEAPON_TAGS.has(tag))).toBe(true);
    }
  });

  it('separates behavior roles so not every weapon reads as a thrown projectile', () => {
    const trueProjectiles = Object.entries(WEAPON_DATA)
      .filter(([, data]) => data.metadata.behavior === 'true_projectile')
      .map(([type]) => type);
    const focusCasts = Object.entries(WEAPON_DATA)
      .filter(([, data]) => data.metadata.behavior === 'focus_cast')
      .map(([type]) => type);
    const orbitSummons = Object.entries(WEAPON_DATA)
      .filter(([, data]) => data.metadata.behavior === 'orbit_summon')
      .map(([type]) => type);
    const cleaves = Object.entries(WEAPON_DATA)
      .filter(([, data]) => data.metadata.behavior === 'cleave_melee')
      .map(([type]) => type);

    expect(trueProjectiles).toEqual([]);
    expect(cleaves).toEqual([WeaponType.AXE]);
    expect(focusCasts).toEqual([WeaponType.MAGIC_WAND, WeaponType.FIRE_WAND]);
    expect(orbitSummons).toEqual([WeaponType.BIBLE, WeaponType.MOON_BLADE]);
  });

  it('uses display metadata to identify side-slot equipped weapon assets', () => {
    const displayTypes = Object.entries(WEAPON_DATA)
      .filter(([, data]) => ['stowed', 'aura_source', 'relic'].includes(data.metadata.displayMode))
      .sort(([, a], [, b]) => b.metadata.displayPriority - a.metadata.displayPriority)
      .map(([type]) => type);

    expect(displayTypes).toEqual([
      WeaponType.WHIP,
      WeaponType.AXE,
      WeaponType.GARLIC,
      WeaponType.MAGIC_WAND,
      WeaponType.FIRE_WAND,
      WeaponType.HOLY_WATER,
      WeaponType.RUNE_LANCE,
    ]);
  });

  it('uses orbit display metadata for summon-style weapons', () => {
    const orbitTypes = Object.entries(WEAPON_DATA)
      .filter(([, data]) => data.metadata.displayMode === 'orbit')
      .sort(([, a], [, b]) => b.metadata.displayPriority - a.metadata.displayPriority)
      .map(([type]) => type);

    expect(orbitTypes).toEqual([WeaponType.BIBLE, WeaponType.MOON_BLADE]);
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

  it('fires rune lances as short beam strikes instead of moving bullets', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.RUNE_LANCE);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(120, 0)]));

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].type).toBe(WeaponType.RUNE_LANCE);
    expect(projectiles[0].pierce).toBeGreaterThanOrEqual(4);
    expect(projectiles[0].beamLength).toBeGreaterThan(400);
    expect(projectiles[0].originX).toBeLessThan(player.x);
    expect(projectiles[0].vx).toBeGreaterThan(0.99);

    const x = projectiles[0].x;
    updateProjectile(projectiles[0], 0.05, player);

    expect(projectiles[0].x).toBeCloseTo(x, 5);
  });

  it('uses rune lance line collision without large circular splash hits', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.RUNE_LANCE);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];
    const target = makeEnemy(260, 0, 1);
    const offLine = makeEnemy(140, 120, 2);
    const particles: Particle[] = [];
    const damageNumbers: DamageNumber[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([target]));

    new ProjectileCombat().update({
      player,
      projectiles,
      enemyQuery: enemyQuery([target, offLine]),
      mapSystem: { handleProjectileCollision: () => false } as any,
      particles,
      damageNumbers,
    }, 0.01);

    expect(target.hp).toBeLessThan(target.maxHp);
    expect(offLine.hp).toBe(offLine.maxHp);
  });

  it('casts fire wand as stationary flame eruptions on enemy positions', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.FIRE_WAND);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(180, 0)]));

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].type).toBe(WeaponType.FIRE_WAND);
    expect(Math.abs(projectiles[0].vx)).toBeLessThan(0.01);
    expect(Math.abs(projectiles[0].vy)).toBeLessThan(0.01);
    expect(projectiles[0].pierce).toBe(999);
    expect(projectiles[0].x).toBeGreaterThan(120);

    const x = projectiles[0].x;
    updateProjectile(projectiles[0], 0.1, player);

    expect(projectiles[0].x).toBeCloseTo(x, 5);
  });

  it('casts focus weapons from the equipped side instead of the player body center', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(120, 0)]));

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].x).toBeLessThan(player.x);
    expect(projectiles[0].y).toBeLessThan(player.y);
    expect(projectiles[0].vx).toBeGreaterThan(0);
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
    expect(projectiles.every((projectile) => projectile.orbitFollowPlayer)).toBe(true);
    expect(projectiles.every((projectile) => Math.hypot(projectile.x - player.x, projectile.y - player.y) > player.radius * 1.8)).toBe(true);

    const projectile = projectiles[0];
    const radius = projectile.orbitRadius!;
    player.x = 40;
    player.y = 20;
    updateProjectile(projectile, 0.2, player);

    expect(Math.hypot(projectile.x - player.x, projectile.y - player.y)).toBeCloseTo(radius, 5);
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

  it('treats split as attack count doubling and double cast as a full repeat', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.SPLIT_CORE);
    addModifier(weapon, GenericModifierType.DOUBLE_CAST);
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(160, 0)]));

    expect(projectiles).toHaveLength(4);
    expect(projectiles.every((projectile) => projectile.damage === weapon.damage)).toBe(true);
  });

  it('reflects by angle even when no follow-up target is available', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.REFLECTION_PRISM);
    const target = makeEnemy(45, 0);
    const projectiles: Projectile[] = [];
    const particles: Particle[] = [];
    const damageNumbers: DamageNumber[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([target]));
    new ProjectileCombat().update({
      player,
      projectiles,
      enemyQuery: enemyQuery([target]),
      mapSystem: { handleProjectileCollision: () => false } as any,
      particles,
      damageNumbers,
    }, 0.15);

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].hitEnemies.has(target.id)).toBe(true);
    expect(Math.abs(projectiles[0].vy)).toBeGreaterThan(0.01);
  });

  it('draws chain conductor as a lightning beam between enemies', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.CHAIN_CONDUCTOR);
    const source = makeEnemy(45, 0, 1);
    const chained = makeEnemy(90, 20, 2);
    const projectiles: Projectile[] = [];
    const particles: Particle[] = [];
    const damageNumbers: DamageNumber[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([source]));
    new ProjectileCombat().update({
      player,
      projectiles,
      enemyQuery: enemyQuery([source, chained]),
      mapSystem: { handleProjectileCollision: () => false } as any,
      particles,
      damageNumbers,
    }, 0.15);

    expect(chained.hp).toBeLessThan(chained.maxHp);
    expect(particles.some((particle) => particle.type === 'beam')).toBe(true);
  });

  it('emits impact pulse as a backward crescent wave', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.MAGIC_WAND);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.IMPACT_PULSE);
    const target = makeEnemy(45, 0, 1);
    const behind = makeEnemy(10, 0, 2);
    const projectiles: Projectile[] = [];
    const particles: Particle[] = [];
    const damageNumbers: DamageNumber[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([target]));
    new ProjectileCombat().update({
      player,
      projectiles,
      enemyQuery: enemyQuery([target, behind]),
      mapSystem: { handleProjectileCollision: () => false } as any,
      particles,
      damageNumbers,
    }, 0.15);

    expect(behind.hp).toBeLessThan(behind.maxHp);
    expect(particles.some((particle) => particle.type === 'crescent')).toBe(true);
  });

  it('swings axe as a 120-degree melee cleave instead of a flying axe', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.AXE);
    weapon.timer = weapon.cooldown;
    addModifier(weapon, GenericModifierType.ORBITAL_CORE);
    const projectiles: Projectile[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([makeEnemy(120, 0)]));

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].type).toBe(WeaponType.AXE);
    expect(projectiles[0].beamLength).toBeGreaterThan(120);
    expect(projectiles[0].arcAngle).toBeCloseTo(Math.PI * 2 / 3, 5);
    expect(projectiles[0].originX).toBeCloseTo(player.x, 5);
    expect(projectiles[0].vx).toBeGreaterThan(0.99);
    expect(projectiles[0].orbitFollowPlayer).not.toBe(true);
    expect(projectiles[0].orbitAngle).toBeUndefined();
    expect(projectiles[0].gravY).toBeUndefined();
  });

  it('lets axe cleaves cut enemy projectiles inside the target cone only', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.AXE);
    weapon.timer = weapon.cooldown;
    const projectiles: Projectile[] = [];
    const target = makeEnemy(130, 0);
    const insideBullet = makeEnemyProjectile(86, 24, 1);
    const outsideBullet = makeEnemyProjectile(-70, 0, 2);
    const particles: Particle[] = [];
    const damageNumbers: DamageNumber[] = [];

    updateWeapon(weapon, player, projectiles, 0, enemyQuery([target]));

    new ProjectileCombat().update({
      player,
      projectiles,
      enemyQuery: enemyQuery([target]),
      mapSystem: { handleProjectileCollision: () => false } as any,
      particles,
      damageNumbers,
      enemyProjectiles: [insideBullet, outsideBullet],
    }, 0.01);

    expect(target.hp).toBeLessThan(target.maxHp);
    expect(insideBullet.life).toBe(0);
    expect(outsideBullet.life).toBeGreaterThan(0);
  });
});
