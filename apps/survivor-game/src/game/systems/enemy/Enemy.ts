import { Enemy, EnemyType, Player } from '../../types';
import {
  CONTACT_COOLDOWN,
  ELITE_RADIUS_MULT,
  ELITE_SPEED_MULT,
  ELITE_STAT_MULT,
  ELITE_XP_MULT,
  ENEMY_DATA,
  ENEMY_FALLBACK_HP_DIFFICULTY_STEP,
  ENEMY_FALLBACK_SPEED_DIFFICULTY_STEP,
  ENEMY_KNOCKBACK_DECAY,
} from '../../constants';
import type { DifficultyParams } from '../../data/difficulty';
import { circlesOverlap } from '../../utils/math';
import { getBloodPoolSlowFactor } from '../../utils/collision';
import { pools } from '../../utils/PoolManager';
import type { MapSystem } from '../map/MapSystem';

let nextEnemyId = 1;

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
  difficultyParams?: DifficultyParams
): Enemy {
  const data = ENEMY_DATA[type];
  const hpMult = (difficultyParams?.enemyHpMultiplier ?? (1 + difficulty * ENEMY_FALLBACK_HP_DIFFICULTY_STEP)) * curseMult;
  const spdMult = difficultyParams?.enemySpeedMultiplier ?? (1 + difficulty * ENEMY_FALLBACK_SPEED_DIFFICULTY_STEP);
  const dmgMult = curseMult;
  const eliteMult = isElite ? ELITE_STAT_MULT : 1;
  const enemy = pools.enemies.acquire();

  enemy.id = nextEnemyId++;
  enemy.x = x;
  enemy.y = y;
  enemy.radius = data.radius * (isElite ? ELITE_RADIUS_MULT : 1);
  enemy.hp = data.baseHp * hpMult * eliteMult;
  enemy.maxHp = enemy.hp;
  enemy.speed = data.baseSpeed * spdMult * (isElite ? ELITE_SPEED_MULT : 1);
  enemy.damage = data.baseDamage * dmgMult * eliteMult;
  enemy.type = type;
  enemy.isElite = isElite;
  enemy.isBoss = isBoss;
  enemy.knockbackX = 0;
  enemy.knockbackY = 0;
  enemy.hitFlash = 0;
  enemy.animTimer = Math.random() * Math.PI * 2;
  enemy.xpValue = data.xpValue * (isElite ? ELITE_XP_MULT : 1) * curseMult;
  enemy.contactCooldown = CONTACT_COOLDOWN;
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

  let speedMult = 1;
  if (mapSystem) {
    const nearbyObs = mapSystem.getNearby(e.x - 100, e.y - 100, e.x + 100, e.y + 100);
    speedMult = getBloodPoolSlowFactor(nearbyObs, e.x, e.y, e.radius);
  }

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1) {
    e.x += (dx / len) * e.speed * speedMult * dt;
    e.y += (dy / len) * e.speed * speedMult * dt;
  }

  if (mapSystem) {
    const push = mapSystem.handleCircleCollision(e.x, e.y, e.radius);
    e.x += push.x;
    e.y += push.y;
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
  e.hp -= damage;
  e.hitFlash = 1;
  e.knockbackX += knockbackX;
  e.knockbackY += knockbackY;
  return e.hp <= 0;
}

export function getAvailableEnemyTypes(
  elapsed: number,
  _difficulty: number
): EnemyType[] {
  const types: EnemyType[] = [];
  for (const [type, data] of Object.entries(ENEMY_DATA)) {
    if (data.spawnAfter <= elapsed) {
      types.push(type as EnemyType);
    }
  }
  return types;
}

export function isCollidingWithPlayer(e: Enemy, p: Player): boolean {
  return circlesOverlap(e.x, e.y, e.radius, p.x, p.y, p.radius);
}
