import { Weapon, WeaponType, Player, Enemy, Projectile, GenericModifierType, type ModifierEffect, type Vec2 } from '../../types';
import {
  WEAPON_DATA, FIND_ENEMY_RANGE, LIGHTNING_RANGE, HOLY_WATER_RANGE,
  GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK, MAX_ACTIVE_PLAYER_PROJECTILES,
} from '../../constants';
import { normalize, randFloat } from '../../utils/math';
import { pools } from '../../utils/PoolManager';
import { eventBus, GameEvent } from '../../events';
import type { EnemyQuery } from '../enemy/EnemyQuery';

const nearestEnemiesScratch: Enemy[] = [];
const nearestDistancesScratch: number[] = [];
const ORBITAL_PROJECTILE_RADIUS_MIN = 48;
const ORBITAL_PROJECTILE_RADIUS_MAX = 132;
const ORBITAL_PROJECTILE_RADIUS_PADDING = 34;
const ORBITAL_PROJECTILE_RADIUS_SCALE = 2.6;
const ORBITAL_PROJECTILE_SPEED = 3.7;
const FIRE_ERUPTION_DURATION = 0.85;
const AXE_CLEAVE_ARC = Math.PI * 2 / 3;
const AXE_CLEAVE_BASE_REACH = 118;
const AXE_CLEAVE_REACH_PER_LEVEL = 7;
const RUNE_LANCE_MIN_LENGTH = 420;
const RUNE_LANCE_MAX_LENGTH = 680;
const RUNE_LANCE_DURATION = 0.18;
const MOON_BLADE_ORBIT_SPEED = 4.8;

export function createWeapon(type: WeaponType): Weapon {
  const d = WEAPON_DATA[type];
  return {
    type,
    family: d.family,
    level: 1,
    cooldown: d.baseCooldown,
    timer: 0,
    damage: d.baseDamage,
    speed: d.baseSpeed,
    area: d.baseArea,
    count: d.baseCount,
    pierce: d.basePierce,
    duration: d.baseDuration,
    knockback: d.baseKnockback,
    modifiers: [],
    modifierMask: 0,
  };
}

export function upgradeWeapon(w: Weapon): boolean {
  const d = WEAPON_DATA[w.type];
  if (d.maxLevel !== undefined && w.level >= d.maxLevel) return false;
  w.level++;
  const p = d.perLevel;
  if (p.damage) w.damage += p.damage;
  if (p.cooldown) w.cooldown = Math.max(0.2, w.cooldown + p.cooldown);
  if (p.speed) w.speed += p.speed;
  if (p.area) w.area += p.area;
  if (p.count) w.count += p.count;
  if (p.pierce) w.pierce += p.pierce;
  if (p.duration) w.duration += p.duration;
  if (p.knockback) w.knockback += p.knockback;
  return true;
}

export function updateWeapon(
  w: Weapon,
  player: Player,
  projectiles: Projectile[],
  dt: number,
  enemyQuery: EnemyQuery
) {
  if (w.type === WeaponType.GARLIC) return;

  w.timer += dt;
  const effectiveCooldown = w.cooldown * (1 - player.cooldownReduction);
  if (w.timer < effectiveCooldown) return;

  const effectiveDamage = w.damage * player.might;
  const effectiveArea = w.area * player.area;

  const castDamages = getCastDamages(w, effectiveDamage);
  let fired = false;
  switch (w.type) {
    case WeaponType.MAGIC_WAND:
      for (const damage of castDamages) fired = fireMagicWand(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.FIRE_WAND:
      for (const damage of castDamages) fired = fireFireWand(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.AXE:
      for (const damage of castDamages) fired = fireAxe(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.RUNE_LANCE:
      for (const damage of castDamages) fired = fireRuneLance(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.MOON_BLADE:
      for (const damage of castDamages) fired = fireMoonBlade(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.LIGHTNING:
      for (const damage of castDamages) fired = fireLightning(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.WHIP:
      fired = fireWhip(w, player, projectiles, effectiveDamage, effectiveArea, enemyQuery);
      break;
    case WeaponType.BIBLE:
      fired = fireBible(w, player, projectiles, effectiveDamage, effectiveArea);
      break;
    case WeaponType.HOLY_WATER:
      for (const damage of castDamages) fired = fireHolyWater(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
  }
  if (fired) {
    w.timer = 0;
    emitTriggeredModifiers(w, 'onFire');
    eventBus.emit(GameEvent.WEAPON_FIRE, w.type);
  }
}

function findNearestEnemies(
  player: Player,
  enemyQuery: EnemyQuery,
  count: number,
  maxDist: number = FIND_ENEMY_RANGE
): Enemy[] {
  if (count <= 0) return [];
  nearestEnemiesScratch.length = 0;
  nearestDistancesScratch.length = 0;
  const maxDistSq = maxDist * maxDist;

  const considerEnemy = (enemy: Enemy) => {
    if (enemy.hp <= 0) return;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dSq = dx * dx + dy * dy;
    if (dSq >= maxDistSq) return;

    let insertAt = nearestDistancesScratch.length;
    while (insertAt > 0 && dSq < nearestDistancesScratch[insertAt - 1]) insertAt--;
    if (insertAt >= count) return;

    nearestEnemiesScratch.splice(insertAt, 0, enemy);
    nearestDistancesScratch.splice(insertAt, 0, dSq);
    if (nearestEnemiesScratch.length > count) {
      nearestEnemiesScratch.length = count;
      nearestDistancesScratch.length = count;
    }
  };

  enemyQuery.forNearby(player.x, player.y, maxDist, considerEnemy);

  return nearestEnemiesScratch;
}

function acquireProjectile(): Projectile {
  return pools.projectiles.acquire();
}

function hasModifier(w: Weapon, modifier: GenericModifierType): boolean {
  return (w.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
}

function getModifierStackCount(w: Weapon, modifier: GenericModifierType): number {
  return w.modifiers.filter((item) => item === modifier).length;
}

function hasModifierEffect(w: Weapon, trigger: 'onFire', effect: ModifierEffect): boolean {
  return Object.values(GENERIC_MODIFIER_DATA).some((modifier) =>
    modifier.trigger === trigger &&
    modifier.effect === effect &&
    hasModifier(w, modifier.id)
  );
}

function emitTriggeredModifiers(w: Weapon, trigger: 'onFire') {
  for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
    if (modifier.trigger === trigger && hasModifier(w, modifier.id)) {
      eventBus.emit(GameEvent.MODIFIER_TRIGGER, modifier.id);
    }
  }
}

function getCastDamages(w: Weapon, damage: number): number[] {
  return hasModifierEffect(w, 'onFire', 'extraCast') ? [damage, damage * 0.65] : [damage];
}

function getProjectileSpeed(w: Weapon): number {
  return hasModifierEffect(w, 'onFire', 'projectileSpeed') ? w.speed * 1.28 : w.speed;
}

function canApplyProjectileOrbit(w: Weapon, config: ProjectileConfig): boolean {
  const speed = Math.sqrt(config.vx * config.vx + config.vy * config.vy);
  return w.family === 'projectile' &&
    speed > 0.1 &&
    config.gravY === undefined &&
    config.beamLength === undefined &&
    config.arcAngle === undefined &&
    hasModifierEffect(w, 'onFire', 'projectileOrbit');
}

function clampOrbitRadius(radius: number): number {
  return Math.max(
    ORBITAL_PROJECTILE_RADIUS_MIN,
    Math.min(ORBITAL_PROJECTILE_RADIUS_MAX, radius)
  );
}

function setProjectileOrbitPosition(p: Projectile, originX: number, originY: number) {
  const angle = p.orbitAngle ?? 0;
  const radius = p.orbitRadius ?? 0;
  const angularSpeed = p.orbitSpeed ?? 0;
  p.x = originX + Math.cos(angle) * radius;
  p.y = originY + Math.sin(angle) * radius;
  p.vx = -Math.sin(angle) * radius * angularSpeed;
  p.vy = Math.cos(angle) * radius * angularSpeed;
}

function attachProjectileOrbit(p: Projectile, config: ProjectileConfig, index: number) {
  const speed = Math.sqrt(config.vx * config.vx + config.vy * config.vy);
  const baseAngle = speed > 0.1 ? Math.atan2(config.vy, config.vx) : index * 2.399963;
  const radius = clampOrbitRadius(ORBITAL_PROJECTILE_RADIUS_PADDING + config.radius * ORBITAL_PROJECTILE_RADIUS_SCALE);
  const direction = index % 2 === 0 ? 1 : -1;

  p.orbitFollowPlayer = true;
  p.orbitAngle = baseAngle + index * 0.55;
  p.orbitRadius = radius;
  p.orbitSpeed = ORBITAL_PROJECTILE_SPEED * direction;
  p.originX = config.x;
  p.originY = config.y;
  setProjectileOrbitPosition(p, config.x, config.y);
}

function attachWeaponModifiers(p: Projectile, w: Weapon) {
  p.modifierMask = w.modifierMask;
  p.splitDone = false;
  p.chainDone = false;
  p.pulseDone = false;
  p.reflectRemaining = getModifierStackCount(w, GenericModifierType.REFLECTION_PRISM);
}

function getWeaponCastOrigin(player: Player, w: Weapon, index = 0, total = 1): Vec2 {
  const behavior = WEAPON_DATA[w.type].metadata.behavior;
  const side = player.facingLeft ? 1 : -1;
  const radius = player.radius;

  if (behavior === 'focus_cast') {
    return {
      x: player.x + side * radius * 1.55,
      y: player.y - radius * 0.58 + (index - (total - 1) / 2) * radius * 0.22,
    };
  }

  if (behavior === 'line_piercer') {
    return {
      x: player.x + side * radius * 1.7,
      y: player.y - radius * 0.18 + (index - (total - 1) / 2) * radius * 0.18,
    };
  }

  if (behavior === 'orbit_summon') {
    const angle = player.animTimer * 0.45 + (index / Math.max(1, total)) * Math.PI * 2;
    const orbitRadius = radius * 2.25;
    return {
      x: player.x + Math.cos(angle) * orbitRadius,
      y: player.y + Math.sin(angle) * orbitRadius,
    };
  }

  return { x: player.x, y: player.y };
}

type ProjectileConfig = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  pierce: number;
  type: WeaponType;
  knockback: number;
  animTimer?: number;
  gravY?: number;
  beamLength?: number;
  arcAngle?: number;
};

type TargetedProjectileConfig = Omit<ProjectileConfig, 'x' | 'y' | 'vx' | 'vy' | 'life' | 'pierce' | 'knockback'> & {
  origin?: Vec2;
};

function spawnWeaponProjectile(w: Weapon, projectiles: Projectile[], config: ProjectileConfig): Projectile | undefined {
  if (projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) return undefined;
  const projectileIndex = projectiles.length;
  const p = acquireProjectile();
  p.x = config.x;
  p.y = config.y;
  p.vx = config.vx;
  p.vy = config.vy;
  p.damage = config.damage;
  p.radius = config.radius;
  p.life = config.life;
  p.maxLife = config.life;
  p.pierce = config.pierce;
  p.pierceCount = 0;
  p.type = config.type;
  p.knockback = config.knockback;
  p.animTimer = config.animTimer ?? 0;
  p.gravY = config.gravY;
  p.beamLength = config.beamLength;
  p.arcAngle = config.arcAngle;
  attachWeaponModifiers(p, w);
  if (canApplyProjectileOrbit(w, config)) {
    attachProjectileOrbit(p, config, projectileIndex);
  }
  projectiles.push(p);
  return p;
}

function fireTargetedProjectile(
  w: Weapon,
  player: Player,
  target: Enemy | undefined,
  fallbackAngle: number,
  projectiles: Projectile[],
  config: TargetedProjectileConfig
): boolean {
  const speed = getProjectileSpeed(w);
  const origin = config.origin ?? { x: player.x, y: player.y };
  let vx: number;
  let vy: number;
  if (target) {
    const dir = normalize({ x: target.x - origin.x, y: target.y - origin.y });
    vx = dir.x * speed;
    vy = dir.y * speed;
  } else {
    vx = Math.cos(fallbackAngle) * speed;
    vy = Math.sin(fallbackAngle) * speed;
  }
  return spawnWeaponProjectile(w, projectiles, {
    x: origin.x,
    y: origin.y,
    vx,
    vy,
    damage: config.damage,
    radius: config.radius,
    life: w.duration,
    pierce: w.pierce,
    type: config.type,
    knockback: w.knockback,
    animTimer: config.animTimer,
    gravY: config.gravY,
  }) !== undefined;
}

function fireMagicWand(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const targets = findNearestEnemies(player, enemyQuery, w.count, FIND_ENEMY_RANGE);
  let fired = false;
  for (let i = 0; i < w.count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const angle = (i / w.count) * Math.PI * 2 + player.animTimer * 0.1;
    fired = fireTargetedProjectile(w, player, target, angle, projectiles, {
      origin: getWeaponCastOrigin(player, w, i, w.count),
      damage,
      radius: 8 * area,
      type: WeaponType.MAGIC_WAND,
    }) || fired;
  }
  return fired;
}

function fireFireWand(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const targets = findNearestEnemies(player, enemyQuery, w.count, FIND_ENEMY_RANGE);
  let fired = false;
  for (let i = 0; i < w.count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const origin = getWeaponCastOrigin(player, w, i, w.count);
    const fallbackAngle = Math.random() * Math.PI * 2;
    const aimAngle = target ? Math.atan2(target.y - origin.y, target.x - origin.x) : fallbackAngle;
    const splashOffset = target ? (i === 0 ? 0 : 18 + i * 5) * area : 180 + i * 26;
    const splashAngle = aimAngle + (target ? i * 2.399963 : 0);
    const x = (target?.x ?? origin.x + Math.cos(aimAngle) * splashOffset) + Math.cos(splashAngle) * splashOffset * 0.35;
    const y = (target?.y ?? origin.y + Math.sin(aimAngle) * splashOffset) + Math.sin(splashAngle) * splashOffset * 0.35;
    const p = spawnWeaponProjectile(w, projectiles, {
      x,
      y,
      vx: 0,
      vy: 0,
      damage,
      radius: 24 * area,
      life: FIRE_ERUPTION_DURATION,
      pierce: 999,
      type: WeaponType.FIRE_WAND,
      knockback: w.knockback,
      animTimer: i * 0.73,
    });
    if (p) {
      p.originX = origin.x;
      p.originY = origin.y;
      fired = true;
    }
  }
  return fired;
}

function fireAxe(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const target = findNearestEnemies(player, enemyQuery, 1, FIND_ENEMY_RANGE)[0];
  const originX = player.x;
  const originY = player.y - player.radius * 0.12;
  const fallbackX = player.facingLeft ? -1 : 1;
  const dir = target
    ? normalize({ x: target.x - originX, y: target.y - originY })
    : { x: fallbackX, y: 0 };
  const reach = (AXE_CLEAVE_BASE_REACH + w.level * AXE_CLEAVE_REACH_PER_LEVEL) * area;
  const p = spawnWeaponProjectile(w, projectiles, {
    x: originX + dir.x * reach * 0.5,
    y: originY + dir.y * reach * 0.5,
    vx: dir.x,
    vy: dir.y,
    damage,
    radius: 14 * area,
    life: w.duration,
    pierce: w.pierce,
    type: WeaponType.AXE,
    knockback: w.knockback,
    animTimer: 0,
    beamLength: reach,
    arcAngle: AXE_CLEAVE_ARC,
  });
  if (!p) return false;
  p.originX = originX;
  p.originY = originY;
  return true;
}

function fireRuneLance(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const targets = findNearestEnemies(player, enemyQuery, Math.max(1, w.count), FIND_ENEMY_RANGE);
  let fired = false;
  const count = Math.max(1, w.count);
  const spread = Math.min(0.42, 0.1 * (count - 1));
  for (let i = 0; i < count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const origin = getWeaponCastOrigin(player, w, i, count);
    const fallbackAngle = player.facingLeft ? Math.PI : 0;
    const t = count === 1 ? 0.5 : i / (count - 1);
    const aimAngle = target ? Math.atan2(target.y - origin.y, target.x - origin.x) : fallbackAngle;
    const angle = aimAngle - spread / 2 + spread * t;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const beamLength = Math.max(
      RUNE_LANCE_MIN_LENGTH,
      Math.min(RUNE_LANCE_MAX_LENGTH, getProjectileSpeed(w) * w.duration * 0.82)
    );
    const p = spawnWeaponProjectile(w, projectiles, {
      x: origin.x + dirX * beamLength * 0.5,
      y: origin.y + dirY * beamLength * 0.5,
      vx: dirX,
      vy: dirY,
      damage,
      radius: 7 * area,
      life: RUNE_LANCE_DURATION,
      pierce: w.pierce,
      type: WeaponType.RUNE_LANCE,
      knockback: w.knockback,
      beamLength,
    });
    if (p) {
      p.originX = origin.x;
      p.originY = origin.y;
      fired = true;
    }
  }
  return fired;
}

function fireMoonBlade(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const target = findNearestEnemies(player, enemyQuery, 1, FIND_ENEMY_RANGE)[0];
  const baseAngle = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
  const count = Math.max(1, w.count);
  const spread = Math.min(1.1, 0.18 * (count - 1));
  const orbitRadius = (68 + Math.min(36, w.level * 4)) * area;
  const orbitSpeed = MOON_BLADE_ORBIT_SPEED + Math.min(1.4, w.level * 0.12);
  const hasProjectileOrbit = hasModifierEffect(w, 'onFire', 'projectileOrbit');
  let fired = false;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const origin = getWeaponCastOrigin(player, w, i, count);
    const aimAngle = target ? Math.atan2(target.y - origin.y, target.x - origin.x) : baseAngle;
    const angle = aimAngle - spread / 2 + spread * t;
    const p = spawnWeaponProjectile(w, projectiles, {
      x: origin.x,
      y: origin.y,
      vx: 0,
      vy: 0,
      damage,
      radius: 10 * area,
      life: w.duration,
      pierce: w.pierce,
      type: WeaponType.MOON_BLADE,
      knockback: w.knockback,
      animTimer: i * 0.7,
    });
    if (!p) continue;
    p.orbitFollowPlayer = true;
    p.orbitAngle = angle;
    p.orbitRadius = orbitRadius + (hasProjectileOrbit ? 24 : 0);
    p.orbitSpeed = orbitSpeed * (i % 2 === 0 ? 1 : -1);
    p.originX = player.x;
    p.originY = player.y;
    setProjectileOrbitPosition(p, player.x, player.y);
    fired = true;
  }
  return fired;
}

function fireLightning(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const targets = findNearestEnemies(player, enemyQuery, w.count, LIGHTNING_RANGE);
  if (targets.length === 0) return false;
  let fired = false;
  for (let i = 0; i < w.count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    if (target) {
      if (projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) break;
      const p = acquireProjectile();
      p.x = target.x; p.y = target.y;
      p.vx = 0; p.vy = 0;
      p.damage = damage;
      p.radius = 30 * area;
      p.life = 0.3; p.maxLife = 0.3;
      p.pierce = w.pierce; p.pierceCount = 0;
      p.type = WeaponType.LIGHTNING;
      p.knockback = w.knockback;
      p.animTimer = 0;
      p.lightningSeed = Math.random() * 1000;
      attachWeaponModifiers(p, w);
      projectiles.push(p);
      fired = true;
    }
  }
  return fired;
}

function fireWhip(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const target = findNearestEnemies(player, enemyQuery, 1)[0];
  const fallbackX = player.facingLeft ? -1 : 1;
  const dir = target
    ? normalize({ x: target.x - player.x, y: target.y - player.y })
    : { x: fallbackX, y: 0 };
  const segments = w.level;
  const reachRadius = (44 + segments * 7) * area;
  const offset = 24 + reachRadius * 0.42;
  const originX = player.x;
  const originY = player.y - 4;
  const p = spawnWeaponProjectile(w, projectiles, {
    x: originX + dir.x * offset,
    y: originY + dir.y * offset,
    vx: dir.x,
    vy: dir.y,
    damage,
    radius: reachRadius,
    life: w.duration,
    pierce: w.pierce,
    type: WeaponType.WHIP,
    knockback: w.knockback,
    animTimer: 0,
  });
  if (!p) return false;
  p.count = segments;
  p.segScale = area;
  p.originX = originX;
  p.originY = originY;
  return true;
}

function fireBible(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number
): boolean {
  let fired = false;
  for (let i = 0; i < w.count; i++) {
    const angle = (i / w.count) * Math.PI * 2;
    const p = spawnWeaponProjectile(w, projectiles, {
      x: player.x + Math.cos(angle) * 80 * area,
      y: player.y + Math.sin(angle) * 80 * area,
      vx: 0,
      vy: 0,
      damage,
      radius: 20 * area,
      life: w.duration,
      pierce: w.pierce,
      type: WeaponType.BIBLE,
      knockback: w.knockback,
      animTimer: 0,
    });
    if (!p) break;
    p.orbitAngle = angle;
    p.orbitRadius = 80 * area;
    p.orbitSpeed = 3;
    p.originX = player.x;
    p.originY = player.y;
    fired = true;
  }
  return fired;
}

function fireHolyWater(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  const targets = findNearestEnemies(player, enemyQuery, w.count, HOLY_WATER_RANGE);
  let fired = false;
  for (let i = 0; i < w.count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const tx = target ? target.x : player.x + randFloat(-200, 200);
    const ty = target ? target.y : player.y + randFloat(-200, 200);
    fired = spawnWeaponProjectile(w, projectiles, {
      x: tx,
      y: ty,
      vx: 0,
      vy: 0,
      damage,
      radius: 40 * area,
      life: w.duration,
      pierce: w.pierce,
      type: WeaponType.HOLY_WATER,
      knockback: w.knockback,
    }) !== undefined || fired;
  }
  return fired;
}

export function getGarlicRadius(w: Weapon, player: Player): number {
  return 60 * w.area * player.area;
}

export function updateProjectile(p: Projectile, dt: number, player?: Player): boolean {
  p.animTimer += dt * 5;
  p.life -= dt;
  if (p.life <= 0) return false;

  if (p.orbitFollowPlayer && p.orbitAngle !== undefined && p.orbitRadius !== undefined && p.orbitSpeed !== undefined) {
    p.orbitAngle += p.orbitSpeed * dt;
    p.originX = player?.x ?? p.originX ?? p.x;
    p.originY = player?.y ?? p.originY ?? p.y;
    setProjectileOrbitPosition(p, p.originX, p.originY);
    return true;
  }

  switch (p.type) {
    case WeaponType.BIBLE:
      if (p.orbitAngle !== undefined && p.orbitRadius !== undefined && p.orbitSpeed !== undefined) {
        p.orbitAngle += p.orbitSpeed * dt;
        p.x = (p.originX ?? p.x) + Math.cos(p.orbitAngle) * p.orbitRadius;
        p.y = (p.originY ?? p.y) + Math.sin(p.orbitAngle) * p.orbitRadius;
      }
      break;
    case WeaponType.LIGHTNING:
    case WeaponType.WHIP:
    case WeaponType.HOLY_WATER:
    case WeaponType.FIRE_WAND:
    case WeaponType.RUNE_LANCE:
    case WeaponType.AXE:
      break;
    default:
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravY) {
        p.vy += p.gravY * dt;
      }
      break;
  }

  return true;
}

export function updateBiblePositions(projectiles: Projectile[], player: Player) {
  for (const p of projectiles) {
    if (p.type === WeaponType.BIBLE) {
      p.originX = player.x;
      p.originY = player.y;
    }
    if (p.type === WeaponType.WHIP) {
      const dirLen = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const dirX = dirLen > 0.001 ? p.vx / dirLen : player.facingLeft ? -1 : 1;
      const dirY = dirLen > 0.001 ? p.vy / dirLen : 0;
      const off = 24 + p.radius * 0.42;
      p.originX = player.x;
      p.originY = player.y - 4;
      p.x = p.originX + dirX * off;
      p.y = p.originY + dirY * off;
    }
  }
}

/**
 * 大蒜光环范围伤害更新
 */
export function updateGarlicAura(
  garlicWeapon: Weapon,
  player: Player,
  dt: number,
  tickTimer: { value: number },
  enemyQuery: EnemyQuery
): { hits: Array<{ x: number; y: number; dmg: number }> } {
  const hits: Array<{ x: number; y: number; dmg: number }> = [];
  tickTimer.value += dt;
  if (tickTimer.value < 0.5) return { hits };
  tickTimer.value = 0;

  const radius = getGarlicRadius(garlicWeapon, player);
  const dmg = garlicWeapon.damage * player.might;
  const hasRepulsion = hasModifier(garlicWeapon, GenericModifierType.REPULSION_FIELD);
  const hitEnemy = (e: Enemy) => {
    if (e.hp <= 0) return;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const hitRadius = radius + e.radius;
    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      e.hp -= dmg;
      e.hitFlash = 1;
      if (hasRepulsion) {
        const dir = normalize({ x: e.x - player.x, y: e.y - player.y });
        e.knockbackX += dir.x * 120;
        e.knockbackY += dir.y * 120;
      }
      hits.push({ x: e.x, y: e.y, dmg });
    }
  };

  enemyQuery.forNearby(player.x, player.y, radius, hitEnemy);
  return { hits };
}
