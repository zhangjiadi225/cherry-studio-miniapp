import { Weapon, WeaponType, Player, Enemy, Projectile, GenericModifierType } from '../../types';
import { WEAPON_DATA, FIND_ENEMY_RANGE, LIGHTNING_RANGE, HOLY_WATER_RANGE, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK } from '../../constants';
import { dist, normalize, randFloat } from '../../utils/math';
import { pools } from '../../utils/PoolManager';

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
  if (w.level >= d.maxLevel) return false;
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
  if (fired) w.timer = 0;
}

function findNearestEnemies(
  player: Player,
  enemies: Enemy[],
  count: number,
  maxDist: number = FIND_ENEMY_RANGE
): Enemy[] {
  return enemies
    .filter(e => e.hp > 0)
    .map(e => ({ enemy: e, d: dist(player, e) }))
    .filter(e => e.d < maxDist)
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(e => e.enemy);
}

function acquireProjectile(): Projectile {
  return pools.projectiles.acquire();
}

function hasModifier(w: Weapon, modifier: GenericModifierType): boolean {
  return (w.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
}

function hasModifierEffect(w: Weapon, trigger: 'onFire', effect: 'extraCast'): boolean {
  return Object.values(GENERIC_MODIFIER_DATA).some((modifier) =>
    modifier.trigger === trigger &&
    modifier.effect === effect &&
    hasModifier(w, modifier.id)
  );
}

function getCastDamages(w: Weapon, damage: number): number[] {
  return hasModifierEffect(w, 'onFire', 'extraCast') ? [damage, damage * 0.65] : [damage];
}

function attachWeaponModifiers(p: Projectile, w: Weapon) {
  p.modifierMask = w.modifierMask;
  p.splitDone = false;
  p.chainDone = false;
  p.pulseDone = false;
}

function fireMagicWand(
  w: Weapon, player: Player, enemies: Enemy[],
  projectiles: Projectile[], damage: number, area: number
) {
  const targets = findNearestEnemies(player, enemies, w.count);
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    let vx: number, vy: number;
    if (target) {
      const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
      vx = dir.x * w.speed;
      vy = dir.y * w.speed;
    } else {
      const angle = (i / w.count) * Math.PI * 2 + player.animTimer * 0.1;
      vx = Math.cos(angle) * w.speed;
      vy = Math.sin(angle) * w.speed;
    }
    const p = acquireProjectile();
    p.x = player.x; p.y = player.y;
    p.vx = vx; p.vy = vy;
    p.damage = damage;
    p.radius = 8 * area;
    p.life = w.duration; p.maxLife = w.duration;
    p.pierce = w.pierce; p.pierceCount = 0;
    p.type = WeaponType.MAGIC_WAND;
    p.knockback = w.knockback;
    p.animTimer = 0;
    attachWeaponModifiers(p, w);
    projectiles.push(p);
  }
}

function fireFireWand(
  w: Weapon, player: Player, enemies: Enemy[],
  projectiles: Projectile[], damage: number, area: number
) {
  const targets = findNearestEnemies(player, enemies, w.count);
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    let vx: number, vy: number;
    if (target) {
      const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
      vx = dir.x * w.speed;
      vy = dir.y * w.speed;
    } else {
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * w.speed;
      vy = Math.sin(angle) * w.speed;
    }
    const p = acquireProjectile();
    p.x = player.x; p.y = player.y;
    p.vx = vx; p.vy = vy;
    p.damage = damage;
    p.radius = 12 * area;
    p.life = w.duration; p.maxLife = w.duration;
    p.pierce = w.pierce; p.pierceCount = 0;
    p.type = WeaponType.FIRE_WAND;
    p.knockback = w.knockback;
    p.animTimer = 0;
    attachWeaponModifiers(p, w);
    projectiles.push(p);
  }
}

function fireAxe(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number
) {
  for (let i = 0; i < w.count; i++) {
    const angle = randFloat(-Math.PI * 0.8, -Math.PI * 0.2) + (i * 0.3);
    const speed = w.speed * randFloat(0.8, 1.2);
    const p = acquireProjectile();
    p.x = player.x + randFloat(-20, 20); p.y = player.y;
    p.vx = Math.cos(angle) * speed * 0.5;
    p.vy = Math.sin(angle) * speed;
    p.damage = damage;
    p.radius = 14 * area;
    p.life = w.duration; p.maxLife = w.duration;
    p.pierce = w.pierce; p.pierceCount = 0;
    p.type = WeaponType.AXE;
    p.knockback = w.knockback;
    p.animTimer = Math.random() * Math.PI * 2;
    p.gravY = 400;
    attachWeaponModifiers(p, w);
    projectiles.push(p);
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
    const p = acquireProjectile();
    p.x = tx; p.y = ty;
    p.vx = 0; p.vy = 0;
    p.damage = damage;
    p.radius = 40 * area;
    p.life = w.duration; p.maxLife = w.duration;
    p.pierce = w.pierce; p.pierceCount = 0;
    p.type = WeaponType.HOLY_WATER;
    p.knockback = w.knockback;
    p.animTimer = 0;
    attachWeaponModifiers(p, w);
    projectiles.push(p);
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
    if (dist(e, player) < radius + e.radius) {
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
