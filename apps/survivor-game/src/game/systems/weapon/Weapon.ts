import {
  Weapon,
  WeaponEvolutionId,
  WeaponType,
  Player,
  Enemy,
  Projectile,
  GenericModifierType,
  type ModifierEffect,
  type Vec2,
} from '../../types';
import {
  WEAPON_DATA, FIND_ENEMY_RANGE, LIGHTNING_RANGE, HOLY_WATER_RANGE,
  GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK, MAX_ACTIVE_PLAYER_PROJECTILES,
} from '../../constants';
import { normalize, randFloat } from '../../utils/math';
import { pools } from '../../utils/PoolManager';
import { eventBus, GameEvent } from '../../events';
import type { EnemyQuery } from '../enemy/EnemyQuery';
import { getWeaponEvolutionIds, hasAnyWeaponEvolution, hasWeaponEvolution } from '../../data/weaponEvolutions';
import { getBuiltinWeaponContentId, type WeaponData } from '../../data/weapons';
import type { Registry, ReadonlyRegistry } from '../../../content/registry/Registry';
import {
  CoreWeaponBehaviorId,
  type WeaponBehaviorHandler,
} from '../../behaviors/weapon/WeaponBehavior';
import {
  buildEngineRegistrySnapshot,
  type EnginePlugin,
  type EngineRegistrySnapshot,
} from '../../behaviors/EngineRegistry';

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
const RUNE_LANCE_MIN_LENGTH = 420;
const RUNE_LANCE_MAX_LENGTH = 680;
const RUNE_LANCE_DURATION = 0.18;
const MOON_BLADE_ORBIT_SPEED = 4.8;

export function createWeapon(
  type: WeaponType,
  definition: WeaponData & { readonly id?: string } = WEAPON_DATA[type]
): Weapon {
  const d = definition;
  return {
    type,
    definitionId: definition.id ?? getBuiltinWeaponContentId(type),
    behaviorId: d.behaviorId,
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
    evolutions: {},
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
  enemyQuery: EnemyQuery,
  weaponBehaviors: ReadonlyRegistry<WeaponBehaviorHandler> = getDefaultWeaponBehaviorRegistry()
) {
  const behavior = weaponBehaviors.require(w.behaviorId);
  if (behavior.mode === 'continuous') return;

  w.timer += dt;
  const effectiveCooldown = w.cooldown * getEvolutionCooldownMultiplier(w) * (1 - player.cooldownReduction);
  if (w.timer < effectiveCooldown) return;

  const effectiveDamage = w.damage * player.might * getEvolutionDamageMultiplier(w);
  const effectiveArea = w.area * player.area;

  const castDamages = getCastDamages(w, effectiveDamage);
  let fired = false;
  for (const damage of castDamages) {
    fired = behavior.fire({
      weapon: w,
      player,
      projectiles,
      damage,
      area: effectiveArea,
      enemyQuery,
    }) || fired;
  }
  if (fired) {
    w.timer = 0;
    eventBus.emit(GameEvent.WEAPON_FIRE, w.type);
  }
}

function registerCoreWeaponBehaviors(registry: Registry<WeaponBehaviorHandler>): void {
  const register = (
    id: string,
    mode: WeaponBehaviorHandler['mode'],
    fire: WeaponBehaviorHandler['fire']
  ) => registry.register(id, Object.freeze({ id, mode, fire }));

  register(CoreWeaponBehaviorId.WHIP, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireWhip(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.MAGIC_WAND, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireMagicWand(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.BIBLE, 'cast', ({ weapon, player, projectiles, damage, area }) =>
    fireBible(weapon, player, projectiles, damage, area));
  register(CoreWeaponBehaviorId.GARLIC_AURA, 'continuous', () => false);
  register(CoreWeaponBehaviorId.FIRE_WAND, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireFireWand(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.HOLY_WATER, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireHolyWater(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.LIGHTNING, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireLightning(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.AXE, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireAxe(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.RUNE_LANCE, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireRuneLance(weapon, player, projectiles, damage, area, enemyQuery));
  register(CoreWeaponBehaviorId.MOON_BLADE, 'cast', ({ weapon, player, projectiles, damage, area, enemyQuery }) =>
    fireMoonBlade(weapon, player, projectiles, damage, area, enemyQuery));
}

export const CORE_WEAPON_BEHAVIOR_PLUGIN: EnginePlugin = Object.freeze({
  id: 'builtin.plugin.weapon-behaviors',
  version: '1.0.0',
  register(api) {
    registerCoreWeaponBehaviors(api.weaponBehaviors);
  },
});

export function createCoreWeaponBehaviorRegistry(): ReadonlyRegistry<WeaponBehaviorHandler> {
  return createCoreEngineRegistrySnapshot().weaponBehaviors;
}

export function createCoreEngineRegistrySnapshot(): EngineRegistrySnapshot {
  return buildEngineRegistrySnapshot([CORE_WEAPON_BEHAVIOR_PLUGIN]);
}

let defaultWeaponBehaviorRegistry: ReadonlyRegistry<WeaponBehaviorHandler> | undefined;

function getDefaultWeaponBehaviorRegistry(): ReadonlyRegistry<WeaponBehaviorHandler> {
  defaultWeaponBehaviorRegistry ??= createCoreWeaponBehaviorRegistry();
  return defaultWeaponBehaviorRegistry;
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

function getCastDamages(w: Weapon, damage: number): number[] {
  return hasModifierEffect(w, 'onFire', 'extraCast') ? [damage, damage] : [damage];
}

function getAttackCountWithBonus(w: Weapon, bonusCount: number): number {
  const baseCount = Math.max(1, w.count + bonusCount);
  return hasModifierEffect(w, 'onFire', 'split') ? baseCount * 2 : baseCount;
}

function getProjectileSpeed(w: Weapon): number {
  const modifierMultiplier = hasModifierEffect(w, 'onFire', 'projectileSpeed') ? 1.28 : 1;
  let evolutionMultiplier = 1;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_FOCUS)) evolutionMultiplier *= 1.18;
  return w.speed * modifierMultiplier * evolutionMultiplier;
}

function getEvolutionCooldownMultiplier(w: Weapon): number {
  let multiplier = 1;
  if (hasWeaponEvolution(w, WeaponEvolutionId.WHIP_QUICK)) multiplier *= 0.82;
  if (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_REQUIEM)) multiplier *= 0.9;
  if (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_TEMPEST)) multiplier *= 0.9;
  if (hasWeaponEvolution(w, WeaponEvolutionId.AXE_GUARD)) multiplier *= 0.88;
  return multiplier;
}

function getEvolutionDamageMultiplier(w: Weapon): number {
  let multiplier = 1;
  if (hasWeaponEvolution(w, WeaponEvolutionId.WHIP_RAZOR)) multiplier *= 1.25;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_FOCUS)) multiplier *= 1.22;
  if (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_REQUIEM)) multiplier *= 1.18;
  if (hasWeaponEvolution(w, WeaponEvolutionId.GARLIC_CENSER)) multiplier *= 1.28;
  if (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_BRAND)) multiplier *= 1.22;
  if (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_SCOUR)) multiplier *= 1.24;
  if (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_JUDGMENT)) multiplier *= 1.25;
  if (hasWeaponEvolution(w, WeaponEvolutionId.AXE_EXECUTIONER)) multiplier *= 1.32;
  if (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_FOCUS)) multiplier *= 1.18;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MOON_REND)) multiplier *= 1.2;
  return multiplier;
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
  p.evolutionIds = getWeaponEvolutionIds(w);
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
  life?: number;
  pierce?: number;
  knockback?: number;
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
    life: config.life ?? w.duration,
    pierce: config.pierce ?? w.pierce,
    type: config.type,
    knockback: config.knockback ?? w.knockback,
    animTimer: config.animTimer,
    gravY: config.gravY,
  }) !== undefined;
}

function fireMagicWand(
  w: Weapon, player: Player,
  projectiles: Projectile[], damage: number, area: number,
  enemyQuery: EnemyQuery
): boolean {
  let bonusCount = 0;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_TWIN)) bonusCount += 1;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_VOLLEY)) bonusCount += 2;
  const count = getAttackCountWithBonus(w, bonusCount);
  const bonusPierce =
    (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_PIERCER) ? 2 : 0) +
    (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_FOCUS) ? 1 : 0);
  const radiusMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_PIERCER) ? 1.12 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.MAGIC_FOCUS) ? 1.08 : 1);
  const targets = findNearestEnemies(player, enemyQuery, count, FIND_ENEMY_RANGE);
  let fired = false;
  for (let i = 0; i < count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const angle = (i / count) * Math.PI * 2 + player.animTimer * 0.1;
    fired = fireTargetedProjectile(w, player, target, angle, projectiles, {
      origin: getWeaponCastOrigin(player, w, i, count),
      damage,
      radius: 8 * area * radiusMultiplier,
      pierce: w.pierce + bonusPierce,
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
  let bonusCount = 0;
  if (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_BURST)) bonusCount += 1;
  if (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_STORM)) bonusCount += 2;
  const count = getAttackCountWithBonus(w, bonusCount);
  const targets = findNearestEnemies(player, enemyQuery, count, FIND_ENEMY_RANGE);
  const radiusMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_POOL) ? 1.25 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_STORM) ? 1.08 : 1);
  const lifeMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_POOL) ? 1.3 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.FIRE_BRAND) ? 1.12 : 1);
  let fired = false;
  for (let i = 0; i < count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const origin = getWeaponCastOrigin(player, w, i, count);
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
      radius: 24 * area * radiusMultiplier,
      life: FIRE_ERUPTION_DURATION * lifeMultiplier,
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
  const reachMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.AXE_BULWARK) ? 1.28 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.AXE_GUARD) ? 1.12 : 1);
  const arcMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.AXE_BREAKER) ? 1.18 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.AXE_GUARD) ? 1.15 : 1);
  const reach = AXE_CLEAVE_BASE_REACH * area * reachMultiplier;
  const arcAngle = Math.min(Math.PI * 0.96, AXE_CLEAVE_ARC * arcMultiplier);
  const p = spawnWeaponProjectile(w, projectiles, {
    x: originX + dir.x * reach * 0.5,
    y: originY + dir.y * reach * 0.5,
    vx: dir.x,
    vy: dir.y,
    damage,
    radius: 14 * area * (hasWeaponEvolution(w, WeaponEvolutionId.AXE_BULWARK) ? 1.16 : 1),
    life: w.duration,
    pierce: w.pierce,
    type: WeaponType.AXE,
    knockback: w.knockback,
    animTimer: 0,
    beamLength: reach,
    arcAngle,
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
  let bonusCount = 0;
  if (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_FAN)) bonusCount += 2;
  if (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_ARRAY)) bonusCount += 2;
  const count = getAttackCountWithBonus(w, bonusCount);
  const targets = findNearestEnemies(player, enemyQuery, count, FIND_ENEMY_RANGE);
  let fired = false;
  const spreadCap = hasAnyWeaponEvolution(w, [WeaponEvolutionId.RUNE_FAN, WeaponEvolutionId.RUNE_ARRAY]) ? 0.74 : 0.42;
  const spread = Math.min(spreadCap, 0.1 * (count - 1));
  const lengthMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_PIERCER) ? 1.18 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_FOCUS) ? 1.25 : 1);
  const bonusPierce =
    (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_PIERCER) ? 2 : 0) +
    (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_FOCUS) ? 1 : 0);
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
      Math.min(RUNE_LANCE_MAX_LENGTH * lengthMultiplier, getProjectileSpeed(w) * w.duration * 0.82 * lengthMultiplier)
    );
    const p = spawnWeaponProjectile(w, projectiles, {
      x: origin.x + dirX * beamLength * 0.5,
      y: origin.y + dirY * beamLength * 0.5,
      vx: dirX,
      vy: dirY,
      damage,
      radius: 7 * area * (hasWeaponEvolution(w, WeaponEvolutionId.RUNE_FOCUS) ? 1.12 : 1),
      life: RUNE_LANCE_DURATION,
      pierce: w.pierce + bonusPierce,
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
  let bonusCount = 0;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MOON_TWIN)) bonusCount += 1;
  if (hasWeaponEvolution(w, WeaponEvolutionId.MOON_RING)) bonusCount += 2;
  const count = getAttackCountWithBonus(w, bonusCount);
  const spread = Math.min(1.1, 0.18 * (count - 1));
  const orbitRadius = 76 * area *
    (hasWeaponEvolution(w, WeaponEvolutionId.MOON_REACH) ? 1.22 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.MOON_RING) ? 1.08 : 1);
  const orbitSpeed = MOON_BLADE_ORBIT_SPEED * (hasWeaponEvolution(w, WeaponEvolutionId.MOON_REND) ? 1.16 : 1);
  const life = w.duration *
    (hasWeaponEvolution(w, WeaponEvolutionId.MOON_REACH) ? 1.22 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.MOON_RING) ? 1.08 : 1);
  const pierce = w.pierce + (hasWeaponEvolution(w, WeaponEvolutionId.MOON_REND) ? 2 : 0);
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
      radius: 10 * area * (hasWeaponEvolution(w, WeaponEvolutionId.MOON_RING) ? 1.08 : 1),
      life,
      pierce,
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
  const bonusCount =
    (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_ROD) ? 1 : 0) +
    (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_TEMPEST) ? 2 : 0);
  const count = getAttackCountWithBonus(w, bonusCount);
  const targets = findNearestEnemies(player, enemyQuery, count, LIGHTNING_RANGE);
  if (targets.length === 0) return false;
  const radiusMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_FIELD) ? 1.28 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_JUDGMENT) ? 1.08 : 1);
  let fired = false;
  for (let i = 0; i < count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    if (target) {
      if (projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) break;
      const p = acquireProjectile();
      p.x = target.x; p.y = target.y;
      p.vx = 0; p.vy = 0;
      p.damage = damage;
      p.radius = 30 * area * radiusMultiplier;
      p.life = 0.3; p.maxLife = 0.3;
      p.pierce = w.pierce + (hasWeaponEvolution(w, WeaponEvolutionId.LIGHTNING_FIELD) ? 1 : 0);
      p.pierceCount = 0;
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
  const segments =
    1 +
    (hasWeaponEvolution(w, WeaponEvolutionId.WHIP_LONG) ? 2 : 0) +
    (hasWeaponEvolution(w, WeaponEvolutionId.WHIP_RING) ? 3 : 0);
  const reachMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.WHIP_LONG) ? 1.16 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.WHIP_RING) ? 1.24 : 1);
  const reachRadius = (54 + segments * 7) * area * reachMultiplier;
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
  const count = Math.max(
    1,
    w.count +
      (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_TOME) ? 1 : 0) +
      (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_SANCTUARY) ? 2 : 0)
  );
  const orbitRadius = 80 * area *
    (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_ORBIT) ? 1.22 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_SANCTUARY) ? 1.08 : 1);
  const projectileRadius = 20 * area * (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_SANCTUARY) ? 1.1 : 1);
  const duration = w.duration *
    (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_ORBIT) ? 1.25 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_SANCTUARY) ? 1.08 : 1);
  const orbitSpeed = 3 *
    (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_ORBIT) ? 1.08 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.BIBLE_REQUIEM) ? 1.18 : 1);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const p = spawnWeaponProjectile(w, projectiles, {
      x: player.x + Math.cos(angle) * orbitRadius,
      y: player.y + Math.sin(angle) * orbitRadius,
      vx: 0,
      vy: 0,
      damage,
      radius: projectileRadius,
      life: duration,
      pierce: w.pierce,
      type: WeaponType.BIBLE,
      knockback: w.knockback,
      animTimer: 0,
    });
    if (!p) break;
    p.orbitAngle = angle;
    p.orbitRadius = orbitRadius;
    p.orbitSpeed = orbitSpeed;
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
  const bonusCount =
    (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_TIDE) ? 1 : 0) +
    (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_DELUGE) ? 2 : 0);
  const count = Math.max(1, w.count + bonusCount);
  const targets = findNearestEnemies(player, enemyQuery, count, HOLY_WATER_RANGE);
  const radiusMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_BASIN) ? 1.22 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_DELUGE) ? 1.06 : 1);
  const lifeMultiplier =
    (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_BASIN) ? 1.28 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.HOLY_SCOUR) ? 1.1 : 1);
  let fired = false;
  for (let i = 0; i < count; i++) {
    const target = targets.length > 0 ? targets[i % targets.length] : undefined;
    const tx = target ? target.x : player.x + randFloat(-200, 200);
    const ty = target ? target.y : player.y + randFloat(-200, 200);
    fired = spawnWeaponProjectile(w, projectiles, {
      x: tx,
      y: ty,
      vx: 0,
      vy: 0,
      damage,
      radius: 40 * area * radiusMultiplier,
      life: w.duration * lifeMultiplier,
      pierce: w.pierce,
      type: WeaponType.HOLY_WATER,
      knockback: w.knockback,
    }) !== undefined || fired;
  }
  return fired;
}

export function getGarlicRadius(w: Weapon, player: Player): number {
  return 60 * w.area * player.area *
    (hasWeaponEvolution(w, WeaponEvolutionId.GARLIC_MIASMA) ? 1.25 : 1) *
    (hasWeaponEvolution(w, WeaponEvolutionId.GARLIC_WARD) ? 1.08 : 1);
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
  const tickInterval = hasWeaponEvolution(garlicWeapon, WeaponEvolutionId.GARLIC_THORNS) ? 0.38 : 0.5;
  if (tickTimer.value < tickInterval) return { hits };
  tickTimer.value = 0;

  const radius = getGarlicRadius(garlicWeapon, player);
  const dmg = garlicWeapon.damage * player.might * getEvolutionDamageMultiplier(garlicWeapon);
  const hasRepulsion = hasModifier(garlicWeapon, GenericModifierType.REPULSION_FIELD);
  const wardKnockback = hasWeaponEvolution(garlicWeapon, WeaponEvolutionId.GARLIC_WARD) ? 90 : 0;
  const hitEnemy = (e: Enemy) => {
    if (e.hp <= 0) return;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const hitRadius = radius + e.radius;
    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      e.hp -= dmg;
      e.hitFlash = 1;
      if (hasRepulsion || wardKnockback > 0) {
        const dir = normalize({ x: e.x - player.x, y: e.y - player.y });
        const knockback = (hasRepulsion ? 120 : 0) + wardKnockback;
        e.knockbackX += dir.x * knockback;
        e.knockbackY += dir.y * knockback;
      }
      hits.push({ x: e.x, y: e.y, dmg });
    }
  };

  enemyQuery.forNearby(player.x, player.y, radius, hitEnemy);
  return { hits };
}
