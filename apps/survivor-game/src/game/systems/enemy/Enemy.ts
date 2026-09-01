import { Enemy, EnemyType, Player, type EnemyEnhancement } from '../../types';
import {
  CONTACT_COOLDOWN,
  ELITE_RADIUS_MULT,
  ELITE_SPEED_MULT,
  ELITE_STAT_MULT,
  ELITE_DAMAGE_MULT,
  ELITE_XP_MULT,
  ENEMY_DATA,
  ENEMY_FALLBACK_HP_DIFFICULTY_STEP,
  ENEMY_FALLBACK_SPEED_DIFFICULTY_STEP,
  ENEMY_KNOCKBACK_DECAY,
} from '../../constants';
import type { DifficultyParams } from '../../data/difficulty';
import type { RunDifficultyPreset } from '../../data/runDifficulties';
import { circlesOverlap } from '../../utils/math';
import { pools } from '../../utils/PoolManager';
import type { MapSystem } from '../map/MapSystem';
import { getEnemyEngagementProfile } from './EnemyAttack';
import { SYSTEM_RANDOM, type RandomSource } from '../../kernel/Random';

const mapCollisionPushScratch = { x: 0, y: 0 };
let nextEnemyId = 1;

const DASH_WINDUP = 0.22;
const DASH_DURATION = 0.34;
const DASH_COOLDOWN = 3.2;
const CHARGE_WINDUP = 0.42;
const CHARGE_DURATION = 0.46;
const CHARGE_COOLDOWN = 4.4;
const PHASE_DURATION = 1.25;
const PHASE_COOLDOWN = 4.8;

type TraitMoveState = {
  dashActive: boolean;
  windup: boolean;
  moveScale: number;
};

export function resetEnemyIds() {
  nextEnemyId = 1;
}

export function createEnemy(
  type: EnemyType,
  x: number,
  y: number,
  difficulty: number,
  curseMult: number = 1,
  isElite: boolean = false,
  isBoss: boolean = false,
  difficultyParams?: DifficultyParams,
  elapsed: number = 0,
  enhancementUnlockTimeMult: number = 1,
  random: RandomSource = SYSTEM_RANDOM
): Enemy {
  const data = ENEMY_DATA[type];
  const enhancement = getEnemyEnhancement(type, elapsed, enhancementUnlockTimeMult);
  const hpMult = (difficultyParams?.enemyHpMultiplier ?? (1 + difficulty * ENEMY_FALLBACK_HP_DIFFICULTY_STEP)) * curseMult;
  const spdMult = difficultyParams?.enemySpeedMultiplier ?? (1 + difficulty * ENEMY_FALLBACK_SPEED_DIFFICULTY_STEP);
  const dmgMult = curseMult * (difficultyParams?.enemyDamageMultiplier ?? 1);
  const eliteHpMult = isElite ? ELITE_STAT_MULT : 1;
  const eliteDamageMult = isElite && !isBoss ? ELITE_DAMAGE_MULT : 1;
  const enhancedHpMult = enhancement?.hpMult ?? 1;
  const enhancedSpeedMult = enhancement?.speedMult ?? 1;
  const enhancedDamageMult = enhancement?.damageMult ?? 1;
  const enemy = pools.enemies.acquire();

  enemy.id = nextEnemyId++;
  enemy.x = x;
  enemy.y = y;
  enemy.radius = data.radius * (isElite ? ELITE_RADIUS_MULT : 1);
  enemy.hp = data.baseHp * hpMult * eliteHpMult * enhancedHpMult;
  enemy.maxHp = enemy.hp;
  enemy.speed = data.baseSpeed * spdMult * (isElite ? ELITE_SPEED_MULT : 1) * enhancedSpeedMult;
  enemy.damage = data.baseDamage * dmgMult * eliteDamageMult * enhancedDamageMult;
  enemy.type = type;
  enemy.isElite = isElite;
  enemy.isBoss = isBoss;
  enemy.knockbackX = 0;
  enemy.knockbackY = 0;
  enemy.hitFlash = 0;
  enemy.animTimer = random.next() * Math.PI * 2;
  enemy.xpValue = data.xpValue * (isElite ? ELITE_XP_MULT : 1) * curseMult;
  enemy.contactCooldown = CONTACT_COOLDOWN;
  enemy.attackCooldown = randInitialAttackCooldown(type, isBoss, random);
  enemy.attackWindup = 0;
  enemy.attackPatternIndex = 0;
  enemy.pendingAttackPattern = -1;
  enemy.isEmpowered = !!enhancement;
  enemy.trait = enhancement?.trait ?? 'none';
  enemy.traitCooldown = getInitialTraitCooldown(enemy.trait, enemy.id);
  enemy.traitWindup = 0;
  enemy.traitDuration = 0;
  enemy.traitDirX = 0;
  enemy.traitDirY = 0;
  enemy.slowMultiplier = 1;
  enemy.slowRemaining = 0;
  enemy.burnDamagePerSecond = 0;
  enemy.burnRemaining = 0;
  enemy.burnTickTimer = 0;
  return enemy;
}

export function updateEnemy(
  e: Enemy,
  player: Player,
  dt: number,
  mapSystem?: MapSystem
): boolean {
  e.animTimer += dt * 3;
  e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
  e.contactCooldown = Math.max(0, e.contactCooldown - dt);
  if (e.slowRemaining > 0) {
    e.slowRemaining = Math.max(0, e.slowRemaining - dt);
    if (e.slowRemaining === 0) e.slowMultiplier = 1;
  }
  if (e.burnRemaining > 0 && e.hp > 0) {
    e.burnRemaining = Math.max(0, e.burnRemaining - dt);
    e.burnTickTimer += dt;
    const tickCount = Math.min(2, Math.floor(e.burnTickTimer / 0.2));
    if (tickCount > 0) {
      e.burnTickTimer -= tickCount * 0.2;
      e.hp -= e.burnDamagePerSecond * tickCount * 0.2;
      e.hitFlash = 1;
    }
    if (e.burnRemaining === 0) {
      e.burnDamagePerSecond = 0;
      e.burnTickTimer = 0;
    }
  }

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const traitMove = updateTraitState(e, dx, dy, len, dt);
  const phasing = isEnemyPhasing(e);

  if (len > 1) {
    const engagement = getEnemyEngagementProfile(e);
    let dirX = dx / len;
    let dirY = dy / len;
    let moveScale = 1;

    if (traitMove.dashActive) {
      dirX = e.traitDirX;
      dirY = e.traitDirY;
      moveScale = traitMove.moveScale;
    } else if (engagement) {
      if (len < engagement.retreatRange) {
        dirX = -dirX;
        dirY = -dirY;
        moveScale = 0.78;
      } else if (len <= engagement.preferredRange) {
        const strafe = e.id % 2 === 0 ? 1 : -1;
        dirX = (-dy / len) * strafe;
        dirY = (dx / len) * strafe;
        moveScale = e.attackWindup > 0 ? 0.15 : 0.36;
      }
    }
    if (!traitMove.dashActive && e.trait === 'phase' && e.traitDuration > 0) moveScale *= 1.32;
    if (!traitMove.dashActive && traitMove.windup) moveScale *= 0.2;

    const slowMultiplier = traitMove.dashActive ? 1 : e.slowMultiplier;
    e.x += dirX * e.speed * moveScale * slowMultiplier * dt;
    e.y += dirY * e.speed * moveScale * slowMultiplier * dt;
  }

  if (mapSystem && !phasing) {
    mapSystem.handleCircleCollisionInto(e.x, e.y, e.radius, mapCollisionPushScratch);
    e.x += mapCollisionPushScratch.x;
    e.y += mapCollisionPushScratch.y;
  }

  e.x += e.knockbackX * dt;
  e.y += e.knockbackY * dt;
  e.knockbackX *= Math.pow(ENEMY_KNOCKBACK_DECAY, dt);
  e.knockbackY *= Math.pow(ENEMY_KNOCKBACK_DECAY, dt);

  return e.hp > 0;
}

export function damageEnemy(
  e: Enemy,
  damage: number,
  knockbackX: number,
  knockbackY: number
): boolean {
  const shielded = e.isEmpowered && e.trait === 'shield';
  const actualDamage = shielded ? damage * 0.72 : damage;
  e.hp -= actualDamage;
  e.hitFlash = 1;
  e.knockbackX += shielded ? knockbackX * 0.45 : knockbackX;
  e.knockbackY += shielded ? knockbackY * 0.45 : knockbackY;
  return e.hp <= 0;
}

export function applyEnemySlow(e: Enemy, speedMultiplier: number, duration: number): void {
  e.slowMultiplier = Math.min(e.slowMultiplier, speedMultiplier);
  e.slowRemaining = Math.max(e.slowRemaining, duration);
}

export function applyEnemyBurn(e: Enemy, damagePerSecond: number, duration: number): void {
  e.burnDamagePerSecond = Math.max(e.burnDamagePerSecond, damagePerSecond);
  e.burnRemaining = Math.max(e.burnRemaining, duration);
}

export function getEnemyEnhancement(
  type: EnemyType,
  elapsed: number,
  unlockTimeMult: number = 1
): EnemyEnhancement | undefined {
  const enhancement = ENEMY_DATA[type].enhancement;
  if (!enhancement) return undefined;
  const unlockAt = enhancement.unlockAfter * Math.max(0.1, unlockTimeMult);
  return elapsed >= unlockAt ? enhancement : undefined;
}

export function getEnemyEnhancementUnlockAt(type: EnemyType, unlockTimeMult: number = 1): number | undefined {
  const enhancement = ENEMY_DATA[type].enhancement;
  return enhancement ? enhancement.unlockAfter * Math.max(0.1, unlockTimeMult) : undefined;
}

export function isEnemyPhasing(e: Enemy): boolean {
  return e.isEmpowered && e.trait === 'phase' && e.traitDuration > 0;
}

export function shouldSplitOnDeath(e: Enemy): boolean {
  return e.isEmpowered && e.trait === 'split' && !e.isBoss;
}

function getInitialTraitCooldown(trait: Enemy['trait'], id: number): number {
  const offset = (id % 5) * 0.18;
  switch (trait) {
    case 'dash':
      return 0.7 + offset;
    case 'charge':
      return 1.3 + offset;
    case 'phase':
      return 1.0 + offset;
    default:
      return 0;
  }
}

function updateTraitState(e: Enemy, dx: number, dy: number, len: number, dt: number): TraitMoveState {
  const state: TraitMoveState = { dashActive: false, windup: false, moveScale: 1 };
  if (!e.isEmpowered) return state;

  if (e.traitWindup > 0) {
    e.traitWindup = Math.max(0, e.traitWindup - dt);
    if (e.traitWindup === 0) {
      if (e.trait === 'dash') e.traitDuration = DASH_DURATION;
      if (e.trait === 'charge') e.traitDuration = CHARGE_DURATION;
    }
    state.windup = true;
    return state;
  }

  if (e.traitDuration > 0) {
    e.traitDuration = Math.max(0, e.traitDuration - dt);
    if (e.trait === 'dash') return { dashActive: true, windup: false, moveScale: 3.4 };
    if (e.trait === 'charge') return { dashActive: true, windup: false, moveScale: 2.7 };
    return state;
  }

  e.traitCooldown = Math.max(0, e.traitCooldown - dt);
  if (e.traitCooldown > 0 || len <= 1) return state;

  if (e.trait === 'dash' && len > 70 && len < 430) {
    startDirectedTrait(e, dx, dy, len, DASH_WINDUP, DASH_COOLDOWN);
    state.windup = true;
  } else if (e.trait === 'charge' && len > 120 && len < 560) {
    startDirectedTrait(e, dx, dy, len, CHARGE_WINDUP, CHARGE_COOLDOWN);
    state.windup = true;
  } else if (e.trait === 'phase' && len < 520) {
    e.traitDuration = PHASE_DURATION;
    e.traitCooldown = PHASE_COOLDOWN;
  }

  return state;
}

function startDirectedTrait(
  e: Enemy,
  dx: number,
  dy: number,
  len: number,
  windup: number,
  cooldown: number
) {
  e.traitDirX = dx / len;
  e.traitDirY = dy / len;
  e.traitWindup = windup;
  e.traitCooldown = cooldown;
}

function randInitialAttackCooldown(type: EnemyType, isBoss: boolean, random: RandomSource): number {
  if (type === EnemyType.CULTIST) return 0.6 + random.next() * 0.8;
  if (isBoss && (type === EnemyType.DEMON || type === EnemyType.WRAITH)) return 1.0;
  return 0;
}

export function getAvailableEnemyTypes(
  elapsed: number,
  _difficulty: number,
  runDifficulty?: RunDifficultyPreset
): EnemyType[] {
  const types: EnemyType[] = [];
  const unlockTimeMult = runDifficulty?.enemyUnlockTimeMult ?? 1;
  for (const [type, data] of Object.entries(ENEMY_DATA)) {
    if (data.spawnAfter * unlockTimeMult <= elapsed) {
      types.push(type as EnemyType);
    }
  }
  return types;
}

export function isCollidingWithPlayer(e: Enemy, p: Player): boolean {
  return circlesOverlap(e.x, e.y, e.radius, p.x, p.y, p.radius);
}
