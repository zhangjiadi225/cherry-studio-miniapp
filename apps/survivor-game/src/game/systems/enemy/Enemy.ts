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
import type { RunDifficultyPreset } from '../../data/runDifficulties';
import { circlesOverlap } from '../../utils/math';
import { pools } from '../../utils/PoolManager';
import type { MapSystem } from '../map/MapSystem';
import { getEnemyEngagementProfile } from './EnemyAttack';

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
  const dmgMult = curseMult * (difficultyParams?.enemyDamageMultiplier ?? 1);
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
  enemy.attackCooldown = randInitialAttackCooldown(type, isBoss);
  enemy.attackWindup = 0;
  enemy.attackPatternIndex = 0;
  enemy.pendingAttackPattern = -1;
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
    speedMult = mapSystem.getBloodPoolSlowFactor(e.x, e.y, e.radius);
  }

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1) {
    const engagement = getEnemyEngagementProfile(e);
    let dirX = dx / len;
    let dirY = dy / len;
    let moveScale = 1;

    if (engagement) {
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

    e.x += dirX * e.speed * speedMult * moveScale * dt;
    e.y += dirY * e.speed * speedMult * moveScale * dt;
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

function randInitialAttackCooldown(type: EnemyType, isBoss: boolean): number {
  if (type === EnemyType.CULTIST) return 0.6 + Math.random() * 0.8;
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
