import { Weapon, WeaponType, Player, Enemy, Projectile, GenericModifierType } from '../../types';
import { WEAPON_DATA, FIND_ENEMY_RANGE, LIGHTNING_RANGE, HOLY_WATER_RANGE, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK } from '../../constants';
import { normalize, randFloat } from '../../utils/math';
import { pools } from '../../utils/PoolManager';
import { eventBus, GameEvent } from '../../events';

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
  enemies: Enemy[],
  projectiles: Projectile[],
  dt: number
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
      for (const damage of castDamages) fireMagicWand(w, player, enemies, projectiles, damage, effectiveArea);
      fired = true;
      break;
    case WeaponType.FIRE_WAND:
      for (const damage of castDamages) fireFireWand(w, player, enemies, projectiles, damage, effectiveArea);
      fired = true;
      break;
    case WeaponType.AXE:
      for (const damage of castDamages) fireAxe(w, player, projectiles, damage, effectiveArea);
      fired = true;
      break;
    case WeaponType.LIGHTNING:
      for (const damage of castDamages) fired = fireLightning(w, player, enemies, projectiles, damage, effectiveArea) || fired;
      break;
    case WeaponType.WHIP:
      fireWhip(w, player, projectiles, effectiveDamage, effectiveArea);
      fired = true;
      break;
    case WeaponType.BIBLE:
      fireBible(w, player, projectiles, effectiveDamage, effectiveArea);
      fired = true;
      break;
    case WeaponType.HOLY_WATER:
      for (const damage of castDamages) fireHolyWater(w, player, enemies, projectiles, damage, effectiveArea);
      fired = true;
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
  enemies: Enemy[],
  count: number,
  maxDist: number = FIND_ENEMY_RANGE
): Enemy[] {
  if (count <= 0) return [];
  const bestEnemies: Enemy[] = [];
  const bestDistSq: number[] = [];
  const maxDistSq = maxDist * maxDist;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dSq = dx * dx + dy * dy;
    if (dSq >= maxDistSq) continue;

    let insertAt = bestDistSq.length;
    while (insertAt > 0 && dSq < bestDistSq[insertAt - 1]) insertAt--;
    if (insertAt >= count) continue;

    bestEnemies.splice(insertAt, 0, enemy);
    bestDistSq.splice(insertAt, 0, dSq);
    if (bestEnemies.length > count) {
      bestEnemies.length = count;
      bestDistSq.length = count;
    }
  }

  return bestEnemies;
}

function acquireProjectile(): Projectile {
  return pools.projectiles.acquire();
}

function hasModifier(w: Weapon, modifier: GenericModifierType): boolean {
  return (w.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
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

function spawnWeaponProjectile(w: Weapon, projectiles: Projectile[], config: ProjectileConfig): Projectile {
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
) {
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
  spawnWeaponProjectile(w, projectiles, {
    ...config,
    x: player.x,
    y: player.y,
    vx,
    vy,
    life: w.duration,
    pierce: w.pierce,
    knockback: w.knockback,
  });
}

function fireMagicWand(
  w: Weapon, player: Player, enemies: Enemy[],
  projectiles: Projectile[], damage: number, area: number
) {
  const targets = findNearestEnemies(player, enemies, w.count);
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    const angle = (i / w.count) * Math.PI * 2 + player.animTimer * 0.1;
    fireTargetedProjectile(w, player, target, angle, projectiles, {
      damage,
      radius: 8 * area,
      type: WeaponType.MAGIC_WAND,
    });
  }
}

function fireFireWand(
  w: Weapon, player: Player, enemies: Enemy[],
  projectiles: Projectile[], damage: number, area: number
) {
  const targets = findNearestEnemies(player, enemies, w.count);
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    fireTargetedProjectile(w, player, target, Math.random() * Math.PI * 2, projectiles, {
      damage,
      radius: 12 * area,
      type: WeaponType.FIRE_WAND,
    });
  }
}

function fireAxe(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number
) {
  for (let i = 0; i < w.count; i++) {
    const angle = randFloat(-Math.PI * 0.8, -Math.PI * 0.2) + (i * 0.3);
    const speed = getProjectileSpeed(w) * randFloat(0.8, 1.2);
    spawnWeaponProjectile(w, projectiles, {
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
    });
  }
}

function fireLightning(
  w: Weapon, player: Player, enemies: Enemy[],
  projectiles: Projectile[], damage: number, area: number
): boolean {
  const targets = findNearestEnemies(player, enemies, w.count, LIGHTNING_RANGE);
  if (targets.length === 0) return false;
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    if (target) {
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
    }
  }
  return true;
}

function fireWhip(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number
) {
  const dir = player.facingLeft ? -1 : 1;
  const segments = w.level;
  const reachRadius = (40 + segments * 30) * area;
  const offset = 30 + segments * 12;
  const p = acquireProjectile();
  p.x = player.x + dir * offset; p.y = player.y;
  p.vx = dir; p.vy = 0;
  p.damage = damage;
  p.radius = reachRadius;
  p.life = w.duration; p.maxLife = w.duration;
  p.pierce = w.pierce; p.pierceCount = 0;
  p.type = WeaponType.WHIP;
  p.knockback = w.knockback;
  p.animTimer = 0;
  p.count = segments;
  p.segScale = area;
  attachWeaponModifiers(p, w);
  projectiles.push(p);
}

function fireBible(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number
) {
  for (let i = 0; i < w.count; i++) {
    const angle = (i / w.count) * Math.PI * 2;
    const p = acquireProjectile();
    p.x = player.x + Math.cos(angle) * 80 * area;
    p.y = player.y + Math.sin(angle) * 80 * area;
    p.vx = 0; p.vy = 0;
    p.damage = damage;
    p.radius = 20 * area;
    p.life = w.duration; p.maxLife = w.duration;
    p.pierce = w.pierce; p.pierceCount = 0;
    p.type = WeaponType.BIBLE;
    p.knockback = w.knockback;
    p.animTimer = 0;
    p.orbitAngle = angle;
    p.orbitRadius = 80 * area;
    p.orbitSpeed = 3;
    p.originX = player.x;
    p.originY = player.y;
    attachWeaponModifiers(p, w);
    projectiles.push(p);
  }
}

function fireHolyWater(
  w: Weapon, player: Player, enemies: Enemy[],
  projectiles: Projectile[], damage: number, area: number
) {
  const targets = findNearestEnemies(player, enemies, w.count, HOLY_WATER_RANGE);
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    const tx = target ? target.x : player.x + randFloat(-200, 200);
    const ty = target ? target.y : player.y + randFloat(-200, 200);
    spawnWeaponProjectile(w, projectiles, {
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
    });
  }
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
      const isSecondHalf = p.life < p.maxLife / 2;
      const offsetDir = isSecondHalf ? -swingDir : swingDir;
      const off = 30 + (p.count ?? 1) * 12;
      p.x = player.x + offsetDir * off;
      p.y = player.y;
    }
  }
}

/**
 * 大蒜光环范围伤害更新
 */
export function updateGarlicAura(
  garlicWeapon: Weapon,
  player: Player,
  enemies: Enemy[],
  dt: number,
  tickTimer: { value: number }
): { hits: Array<{ x: number; y: number; dmg: number }> } {
  const hits: Array<{ x: number; y: number; dmg: number }> = [];
  tickTimer.value += dt;
  if (tickTimer.value < 0.5) return { hits };
  tickTimer.value = 0;

  const radius = getGarlicRadius(garlicWeapon, player);
  const dmg = garlicWeapon.damage * player.might;
  const hasRepulsion = hasModifier(garlicWeapon, GenericModifierType.REPULSION_FIELD);
  for (const e of enemies) {
    if (e.hp <= 0) continue;
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
  }
  return { hits };
}
