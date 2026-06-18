import { Enemy, EnemyType, Player } from '../../types';
import { ENEMY_DATA, DIFFICULTY_STEP, CONTACT_COOLDOWN, ELITE_RADIUS_MULT, ELITE_SPEED_MULT, ELITE_STAT_MULT, ELITE_XP_MULT } from '../../constants';
import { circlesOverlap } from '../../utils/math';
import { getBloodPoolSlowFactor } from '../../utils/collision';
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
  isBoss: boolean = false
): Enemy {
  const data = ENEMY_DATA[type];
  const hpMult = (1 + difficulty * DIFFICULTY_STEP) * curseMult;
  const spdMult = 1 + difficulty * DIFFICULTY_STEP * 0.3;
  const dmgMult = curseMult;
  const eliteMult = isElite ? ELITE_STAT_MULT : 1;

  return {
    id: nextEnemyId++,
    x, y,
    radius: data.radius * (isElite ? ELITE_RADIUS_MULT : 1),
    hp: data.baseHp * hpMult * eliteMult,
    maxHp: data.baseHp * hpMult * eliteMult,
    speed: data.baseSpeed * spdMult * (isElite ? ELITE_SPEED_MULT : 1),
    damage: data.baseDamage * dmgMult * eliteMult,
    type,
    isElite,
    isBoss,
    knockbackX: 0,
    knockbackY: 0,
    hitFlash: 0,
    animTimer: Math.random() * Math.PI * 2,
    xpValue: data.xpValue * (isElite ? ELITE_XP_MULT : 1),
    contactCooldown: CONTACT_COOLDOWN,
  };
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
  e.knockbackX *= Math.pow(0.01, dt);
  e.knockbackY *= Math.pow(0.01, dt);

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
