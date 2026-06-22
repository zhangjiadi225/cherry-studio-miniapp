import type { Enemy, EnemyProjectile, EnemyProjectileKind, Player } from '../../types';
import { EnemyType } from '../../types';
import { pools } from '../../utils/PoolManager';
import { circlesOverlap } from '../../utils/math';
import { MAX_ACTIVE_ENEMY_PROJECTILES } from '../../constants';
import type { MapSystem } from '../map/MapSystem';
import { getRunDifficultyPreset, type RunDifficultyPreset } from '../../data/runDifficulties';

type EnemyAttackPatternId =
  | 'single'
  | 'aimed_burst'
  | 'fire_fan'
  | 'ring_pulse'
  | 'spiral'
  | 'cross_volley'
  | 'shadow_barrage';

interface EnemyAttackProfile {
  range: number;
  preferredRange: number;
  retreatRange: number;
  cooldown: number;
  windup: number;
  bulletSpeed: number;
  bulletRadius: number;
  bulletDamageRatio: number;
  kind: EnemyProjectileKind;
  color: string;
  glowColor: string;
  patterns: EnemyAttackPattern[];
}

interface EnemyAttackPattern {
  id: EnemyAttackPatternId;
  cooldown?: number;
  fire: (ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) => void;
}

interface EnemyAttackContext {
  player: Player;
  projectiles: EnemyProjectile[];
  maxProjectiles: number;
}

export const ENEMY_PROJECTILE_LIFETIME = 2.75;

export interface EnemyEngagementProfile {
  preferredRange: number;
  retreatRange: number;
}

function angleToPlayer(enemy: Enemy, player: Player): number {
  return Math.atan2(player.y - enemy.y, player.x - enemy.x);
}

function spawnEnemyProjectile(
  ctx: EnemyAttackContext,
  enemy: Enemy,
  profile: EnemyAttackProfile,
  angle: number,
  speedScale = 1,
  radiusScale = 1,
  damageScale = 1
) {
  if (ctx.projectiles.length >= ctx.maxProjectiles) return;

  const p = pools.enemyProjectiles.acquire();
  const speed = profile.bulletSpeed * speedScale;
  const spawnOffset = enemy.radius + profile.bulletRadius + 2;
  p.x = enemy.x + Math.cos(angle) * spawnOffset;
  p.y = enemy.y + Math.sin(angle) * spawnOffset;
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.damage = enemy.damage * profile.bulletDamageRatio * damageScale;
  p.radius = profile.bulletRadius * radiusScale;
  p.life = ENEMY_PROJECTILE_LIFETIME;
  p.maxLife = p.life;
  p.sourceType = enemy.type;
  p.sourceId = enemy.id;
  p.kind = profile.kind;
  p.color = profile.color;
  p.glowColor = profile.glowColor;
  p.animTimer = 0;
  ctx.projectiles.push(p);
}

function fireSingle(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  spawnEnemyProjectile(ctx, enemy, profile, angleToPlayer(enemy, ctx.player));
}

function fireAimedBurst(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  const base = angleToPlayer(enemy, ctx.player);
  const offsets = [-0.08, 0, 0.08];
  for (let i = 0; i < offsets.length; i++) {
    spawnEnemyProjectile(ctx, enemy, profile, base + offsets[i], 0.92 + i * 0.08, 1, 0.72);
  }
}

function fireFan(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  const base = angleToPlayer(enemy, ctx.player);
  const count = 7;
  const spread = Math.PI / 3;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    spawnEnemyProjectile(ctx, enemy, profile, base - spread / 2 + spread * t, 0.88, 0.95, 0.55);
  }
}

function fireRingPulse(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  const count = 14;
  const base = enemy.animTimer * 0.18 + enemy.attackPatternIndex * 0.09;
  for (let i = 0; i < count; i++) {
    spawnEnemyProjectile(ctx, enemy, profile, base + (i / count) * Math.PI * 2, 0.62, 0.85, 0.45);
  }
}

function fireSpiral(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  const count = 18;
  const base = enemy.animTimer * 0.55 + enemy.attackPatternIndex * 0.31;
  for (let i = 0; i < count; i++) {
    const armOffset = i % 2 === 0 ? 0 : Math.PI;
    const angle = base + armOffset + Math.floor(i / 2) * 0.42;
    spawnEnemyProjectile(ctx, enemy, profile, angle, 0.72 + (i % 3) * 0.06, 0.82, 0.38);
  }
}

function fireCrossVolley(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  const count = 8;
  const base = enemy.attackPatternIndex % 2 === 0 ? 0 : Math.PI / 8;
  for (let i = 0; i < count; i++) {
    spawnEnemyProjectile(ctx, enemy, profile, base + (i / count) * Math.PI * 2, 0.8, 0.9, 0.48);
  }
}

function fireShadowBarrage(ctx: EnemyAttackContext, enemy: Enemy, profile: EnemyAttackProfile) {
  const base = angleToPlayer(enemy, ctx.player);
  const offsets = [-0.28, -0.14, 0, 0.14, 0.28];
  for (let i = 0; i < offsets.length; i++) {
    spawnEnemyProjectile(ctx, enemy, profile, base + offsets[i], 0.92 + (i % 2) * 0.12, 0.88, 0.5);
  }
}

const SINGLE_SHOT: EnemyAttackPattern = { id: 'single', fire: fireSingle };
const AIMED_BURST: EnemyAttackPattern = { id: 'aimed_burst', cooldown: 2.7, fire: fireAimedBurst };
const FIRE_FAN: EnemyAttackPattern = { id: 'fire_fan', cooldown: 2.7, fire: fireFan };
const RING_PULSE: EnemyAttackPattern = { id: 'ring_pulse', cooldown: 3.2, fire: fireRingPulse };
const SPIRAL: EnemyAttackPattern = { id: 'spiral', cooldown: 2.8, fire: fireSpiral };
const CROSS_VOLLEY: EnemyAttackPattern = { id: 'cross_volley', cooldown: 2.9, fire: fireCrossVolley };
const SHADOW_BARRAGE: EnemyAttackPattern = { id: 'shadow_barrage', cooldown: 3.1, fire: fireShadowBarrage };

const CULTIST_ATTACK: EnemyAttackProfile = {
  range: 430,
  preferredRange: 285,
  retreatRange: 190,
  cooldown: 2.05,
  windup: 0.34,
  bulletSpeed: 235,
  bulletRadius: 4,
  bulletDamageRatio: 1,
  kind: 'cultist_bolt',
  color: '#b58cff',
  glowColor: 'rgba(181,140,255,0.38)',
  patterns: [SINGLE_SHOT],
};

const CULTIST_BURST_ATTACK: EnemyAttackProfile = {
  ...CULTIST_ATTACK,
  cooldown: 2.65,
  windup: 0.42,
  bulletSpeed: 250,
  bulletDamageRatio: 0.78,
  patterns: [AIMED_BURST],
};

const WRAITH_HUNTER_ATTACK: EnemyAttackProfile = {
  range: 620,
  preferredRange: 340,
  retreatRange: 185,
  cooldown: 3.1,
  windup: 0.44,
  bulletSpeed: 225,
  bulletRadius: 4,
  bulletDamageRatio: 0.72,
  kind: 'wraith_orb',
  color: '#d16dff',
  glowColor: 'rgba(209,109,255,0.36)',
  patterns: [SINGLE_SHOT, SHADOW_BARRAGE],
};

const DEMON_BOSS_ATTACK: EnemyAttackProfile = {
  range: 820,
  preferredRange: 330,
  retreatRange: 175,
  cooldown: 2.4,
  windup: 0.48,
  bulletSpeed: 255,
  bulletRadius: 5.5,
  bulletDamageRatio: 0.6,
  kind: 'demon_fire',
  color: '#ff6a2a',
  glowColor: 'rgba(255,98,34,0.42)',
  patterns: [AIMED_BURST, FIRE_FAN, RING_PULSE],
};

const WRAITH_BOSS_ATTACK: EnemyAttackProfile = {
  range: 900,
  preferredRange: 400,
  retreatRange: 220,
  cooldown: 2.5,
  windup: 0.42,
  bulletSpeed: 235,
  bulletRadius: 5.5,
  bulletDamageRatio: 0.58,
  kind: 'wraith_orb',
  color: '#d16dff',
  glowColor: 'rgba(209,109,255,0.42)',
  patterns: [SPIRAL, CROSS_VOLLEY, SHADOW_BARRAGE],
};

export function getEnemyAttackProfile(enemy: Enemy): EnemyAttackProfile | undefined {
  if (enemy.isBoss && enemy.type === EnemyType.DEMON) return DEMON_BOSS_ATTACK;
  if (enemy.isBoss && enemy.type === EnemyType.WRAITH) return WRAITH_BOSS_ATTACK;
  if (enemy.type === EnemyType.CULTIST) {
    return enemy.isEmpowered && enemy.trait === 'burstCaster' ? CULTIST_BURST_ATTACK : CULTIST_ATTACK;
  }
  if (enemy.type === EnemyType.WRAITH && enemy.isEmpowered && enemy.trait === 'shadowCaster') {
    return WRAITH_HUNTER_ATTACK;
  }
  return undefined;
}

export function getEnemyEngagementProfile(enemy: Enemy): EnemyEngagementProfile | undefined {
  const profile = getEnemyAttackProfile(enemy);
  if (!profile) return undefined;
  return {
    preferredRange: profile.preferredRange,
    retreatRange: profile.retreatRange,
  };
}

export function updateEnemyAttacks(
  enemies: Enemy[],
  player: Player,
  projectiles: EnemyProjectile[],
  dt: number,
  runDifficulty: RunDifficultyPreset = getRunDifficultyPreset()
) {
  const ctx: EnemyAttackContext = {
    player,
    projectiles,
    maxProjectiles: Math.max(36, Math.round(MAX_ACTIVE_ENEMY_PROJECTILES * runDifficulty.enemyProjectileCapMult)),
  };
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const profile = getEnemyAttackProfile(enemy);
    if (!profile) continue;

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    if (enemy.attackWindup > 0) {
      enemy.attackWindup = Math.max(0, enemy.attackWindup - dt);
      if (enemy.attackWindup === 0 && enemy.pendingAttackPattern >= 0) {
        const pattern = profile.patterns[enemy.pendingAttackPattern] ?? profile.patterns[0];
        pattern.fire(ctx, enemy, profile);
        enemy.attackCooldown = (pattern.cooldown ?? profile.cooldown) * runDifficulty.enemyAttackCooldownMult;
        enemy.pendingAttackPattern = -1;
      }
      continue;
    }

    if (enemy.attackCooldown > 0) continue;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    if (dx * dx + dy * dy > profile.range * profile.range) continue;

    const patternCount = enemy.isBoss
      ? Math.max(1, Math.min(profile.patterns.length, runDifficulty.bossPatternLimit))
      : profile.patterns.length;
    enemy.pendingAttackPattern = enemy.attackPatternIndex % patternCount;
    enemy.attackPatternIndex++;
    enemy.attackWindup = profile.windup;
  }
}

export function updateEnemyProjectile(
  projectile: EnemyProjectile,
  player: Player,
  mapSystem: MapSystem,
  dt: number
): 'active' | 'expired' | 'hitPlayer' {
  projectile.animTimer += dt;
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;
  projectile.life -= dt;
  if (projectile.life <= 0) return 'expired';
  if (mapSystem.projectileHitsSolidObstacle(projectile.x, projectile.y, projectile.radius, false)) return 'expired';
  if (circlesOverlap(projectile.x, projectile.y, projectile.radius, player.x, player.y, player.radius)) return 'hitPlayer';
  return 'active';
}
