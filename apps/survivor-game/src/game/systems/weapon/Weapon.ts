import { Weapon, WeaponType, Player, Enemy, Projectile, GenericModifierType } from '../../types';
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
      for (const damage of castDamages) fired = fireAxe(w, player, projectiles, damage, effectiveArea) || fired;
      break;
    case WeaponType.LIGHTNING:
      for (const damage of castDamages) fired = fireLightning(w, player, projectiles, damage, effectiveArea, enemyQuery) || fired;
      break;
    case WeaponType.WHIP:
      fired = fireWhip(w, player, projectiles, effectiveDamage, effectiveArea);
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

function hasModifierEffect(w: Weapon, trigger: 'onFire', effect: 'extraCast' | 'projectileSpeed'): boolean {
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

function attachWeaponModifiers(p: Projectile, w: Weapon) {
  p.modifierMask = w.modifierMask;
  p.splitDone = false;
  p.chainDone = false;
  p.pulseDone = false;
  p.reflectRemaining = getModifierStackCount(w, GenericModifierType.REFLECTION_PRISM);
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
};

function spawnWeaponProjectile(w: Weapon, projectiles: Projectile[], config: ProjectileConfig): Projectile | undefined {
  if (projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) return undefined;
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
  attachWeaponModifiers(p, w);
  projectiles.push(p);
  return p;
}

function fireTargetedProjectile(
  w: Weapon,
  player: Player,
  target: Enemy | undefined,
  fallbackAngle: number,
  projectiles: Projectile[],
  config: Omit<ProjectileConfig, 'x' | 'y' | 'vx' | 'vy' | 'life' | 'pierce' | 'knockback'>
): boolean {
  const speed = getProjectileSpeed(w);
  let vx: number;
  let vy: number;
  if (target) {
    const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
    vx = dir.x * speed;
    vy = dir.y * speed;
  } else {
    vx = Math.cos(fallbackAngle) * speed;
    vy = Math.sin(fallbackAngle) * speed;
  }
  return spawnWeaponProjectile(w, projectiles, {
    ...config,
    x: player.x,
    y: player.y,
    vx,
    vy,
    life: w.duration,
    pierce: w.pierce,
    knockback: w.knockback,
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
    fired = fireTargetedProjectile(w, player, target, Math.random() * Math.PI * 2, projectiles, {
      damage,
      radius: 12 * area,
      type: WeaponType.FIRE_WAND,
    }) || fired;
  }
  return fired;
}

function fireAxe(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number
): boolean {
  let fired = false;
  for (let i = 0; i < w.count; i++) {
    const angle = randFloat(-Math.PI * 0.8, -Math.PI * 0.2) + (i * 0.3);
    const speed = getProjectileSpeed(w) * randFloat(0.8, 1.2);
    fired = spawnWeaponProjectile(w, projectiles, {
      x: player.x + randFloat(-20, 20),
      y: player.y,
      vx: Math.cos(angle) * speed * 0.5,
      vy: Math.sin(angle) * speed,
      damage,
      radius: 14 * area,
      life: w.duration,
      pierce: w.pierce,
      type: WeaponType.AXE,
      knockback: w.knockback,
      animTimer: Math.random() * Math.PI * 2,
      gravY: 400,
    }) !== undefined || fired;
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
  projectiles: Projectile[], damage: number, area: number
): boolean {
  const dir = player.facingLeft ? -1 : 1;
  const segments = w.level;
  const reachRadius = (44 + segments * 7) * area;
  const offset = 24 + reachRadius * 0.42;
  const p = spawnWeaponProjectile(w, projectiles, {
    x: player.x + dir * offset,
    y: player.y - 2,
    vx: dir,
    vy: 0,
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

export function updateProjectile(p: Projectile, dt: number): boolean {
  p.animTimer += dt * 5;
  p.life -= dt;
  if (p.life <= 0) return false;

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
      const swingDir = p.vx >= 0 ? 1 : -1;
      const off = 24 + p.radius * 0.42;
      p.originX = player.x;
      p.originY = player.y - 4;
      p.x = player.x + swingDir * off;
      p.y = player.y - 2;
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
