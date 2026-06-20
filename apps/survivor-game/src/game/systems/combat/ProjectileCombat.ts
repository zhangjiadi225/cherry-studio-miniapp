import { Enemy, Projectile, Particle, DamageNumber, WeaponType, type EnemyProjectile, type GenericModifierType, type Player } from '../../types';
import { ENEMY_DATA, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK, MAX_ACTIVE_PLAYER_PROJECTILES } from '../../constants';
import { damageEnemy } from '../enemy/Enemy';
import type { MapSystem } from '../map/MapSystem';
import { pushDamageNumber } from '../../effects/DamageNumber';
import { spawnExplosionParticles, spawnHitParticles } from '../../effects/Particle';
import { eventBus, GameEvent } from '../../events';
import { updateProjectile } from '../weapon/Weapon';
import { pools } from '../../utils/PoolManager';
import { circlesOverlap } from '../../utils/math';
import type { EnemyQuery } from '../enemy/EnemyQuery';

const MODIFIERS = Object.values(GENERIC_MODIFIER_DATA);
const PROJECTILE_COLLISION_LOOKUP_PADDING = 64;
const REFLECTION_TARGET_RADIUS = 340;
const REFLECTION_DAMAGE_RATIO = 0.72;
const RUNE_REFLECTION_BEAM_MAX_LENGTH = 360;
const RUNE_SPLIT_BEAM_LENGTH = 260;

export interface ProjectileCombatContext {
  player: Player;
  projectiles: Projectile[];
  enemyQuery: EnemyQuery;
  mapSystem: MapSystem;
  particles: Particle[];
  damageNumbers: DamageNumber[];
  enemyProjectiles?: EnemyProjectile[];
}

export class ProjectileCombat {
  update(ctx: ProjectileCombatContext, dt: number) {
    const projectileCount = ctx.projectiles.length;
    for (let i = 0; i < projectileCount; i++) {
      const projectile = ctx.projectiles[i];
      if (projectile.life <= 0) continue;
      if (!updateProjectile(projectile, dt, ctx.player)) {
        projectile.life = 0;
        continue;
      }
      if (
        this.shouldUseMapProjectileCollision(projectile) &&
        ctx.mapSystem.handleProjectileCollision(projectile.x, projectile.y, projectile.radius)
      ) {
        projectile.life = 0;
        continue;
      }
      this.clearEnemyProjectilesWithAxe(projectile, ctx);

      let projectileExpired = false;
      ctx.enemyQuery.forNearby(
        projectile.x,
        projectile.y,
        this.getProjectileLookupRadius(projectile),
        (enemy) => {
          if (projectileExpired || enemy.hp <= 0) return;
          if (projectile.hitEnemies.has(enemy.id)) return;
          if (!this.projectileOverlapsEnemy(projectile, enemy)) return;

          const isDead = this.applyProjectileHit(ctx, projectile, enemy);
          projectile.pierceCount++;
          if (projectile.pierceCount > projectile.pierce) {
            if (projectile.type === WeaponType.FIRE_WAND && isDead) {
              spawnExplosionParticles(ctx.particles, enemy.x, enemy.y, '#ff6600', 15, {
                speed: 200, life: 0.7, radius: 5, type: 'spark', glow: true,
                innerColor: '#ffcc00', ringCount: 6,
              });
            }
            projectile.life = 0;
            projectileExpired = true;
          }
        }
      );
    }
    this.releaseDeadProjectiles(ctx.projectiles);
  }

  private shouldUseMapProjectileCollision(projectile: Projectile): boolean {
    return projectile.orbitAngle === undefined &&
      projectile.type !== WeaponType.FIRE_WAND &&
      projectile.type !== WeaponType.RUNE_LANCE &&
      projectile.type !== WeaponType.AXE;
  }

  private getProjectileLookupRadius(projectile: Projectile): number {
    if (this.isRuneBeam(projectile) || this.isAxeCleave(projectile)) {
      return projectile.beamLength! * 0.5 + projectile.radius + PROJECTILE_COLLISION_LOOKUP_PADDING;
    }
    return projectile.radius + PROJECTILE_COLLISION_LOOKUP_PADDING;
  }

  private isRuneBeam(projectile: Projectile): boolean {
    return projectile.type === WeaponType.RUNE_LANCE &&
      projectile.beamLength !== undefined &&
      projectile.originX !== undefined &&
      projectile.originY !== undefined;
  }

  private isAxeCleave(projectile: Projectile): boolean {
    return projectile.type === WeaponType.AXE &&
      projectile.beamLength !== undefined &&
      projectile.arcAngle !== undefined &&
      projectile.originX !== undefined &&
      projectile.originY !== undefined;
  }

  private projectileOverlapsEnemy(projectile: Projectile, enemy: Enemy): boolean {
    if (this.isAxeCleave(projectile)) {
      return this.arcOverlapsCircle(projectile, enemy.x, enemy.y, enemy.radius);
    }
    if (!this.isRuneBeam(projectile)) {
      return circlesOverlap(projectile.x, projectile.y, projectile.radius, enemy.x, enemy.y, enemy.radius);
    }

    const startX = projectile.originX!;
    const startY = projectile.originY!;
    const len = projectile.beamLength!;
    const dirLen = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
    const dirX = projectile.vx / dirLen;
    const dirY = projectile.vy / dirLen;
    const relX = enemy.x - startX;
    const relY = enemy.y - startY;
    const t = Math.max(0, Math.min(len, relX * dirX + relY * dirY));
    const closestX = startX + dirX * t;
    const closestY = startY + dirY * t;
    const dx = enemy.x - closestX;
    const dy = enemy.y - closestY;
    const hitRadius = projectile.radius + enemy.radius;
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }

  private arcOverlapsCircle(projectile: Projectile, x: number, y: number, radius: number): boolean {
    const startX = projectile.originX!;
    const startY = projectile.originY!;
    const reach = projectile.beamLength!;
    const arcAngle = projectile.arcAngle!;
    const relX = x - startX;
    const relY = y - startY;
    const distSq = relX * relX + relY * relY;
    const reachWithRadius = reach + radius;
    if (distSq > reachWithRadius * reachWithRadius) return false;
    const dist = Math.sqrt(distSq) || 1;
    const dirLen = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
    const dot = (relX / dist) * (projectile.vx / dirLen) + (relY / dist) * (projectile.vy / dirLen);
    const radiusPadding = Math.min(0.36, radius / Math.max(36, dist));
    return dot >= Math.cos(arcAngle * 0.5 + radiusPadding);
  }

  private clearEnemyProjectilesWithAxe(projectile: Projectile, ctx: ProjectileCombatContext) {
    if (!ctx.enemyProjectiles || !this.isAxeCleave(projectile)) return;
    let cleared = 0;
    for (const enemyProjectile of ctx.enemyProjectiles) {
      if (enemyProjectile.life <= 0) continue;
      if (!this.arcOverlapsCircle(projectile, enemyProjectile.x, enemyProjectile.y, enemyProjectile.radius)) continue;
      enemyProjectile.life = 0;
      if (cleared < 5) {
        spawnHitParticles(ctx.particles, enemyProjectile.x, enemyProjectile.y, '#ffd18a', 4, {
          speed: 95, life: 0.26, radius: 2.2, type: 'spark', glow: true,
        });
      }
      cleared++;
    }
  }

  private releaseDeadProjectiles(projectiles: Projectile[]) {
    let write = 0;
    for (let read = 0; read < projectiles.length; read++) {
      const projectile = projectiles[read];
      if (projectile.life > 0) {
        if (write !== read) projectiles[write] = projectile;
        write++;
      } else {
        pools.projectiles.release(projectile);
      }
    }
    projectiles.length = write;
  }

  private applyProjectileHit(ctx: ProjectileCombatContext, projectile: Projectile, enemy: Enemy): boolean {
    projectile.hitEnemies.add(enemy.id);
    const knockbackSourceX = projectile.type === WeaponType.AXE && projectile.originX !== undefined ? projectile.originX : projectile.x;
    const knockbackSourceY = projectile.type === WeaponType.AXE && projectile.originY !== undefined ? projectile.originY : projectile.y;
    const dir = { x: enemy.x - knockbackSourceX, y: enemy.y - knockbackSourceY };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    const knockbackModifier = this.getProjectileModifierByEffect(projectile, 'knockback');
    const knockback = projectile.knockback + (knockbackModifier ? 120 : 0);
    const isDead = damageEnemy(enemy, projectile.damage, (dir.x / len) * knockback, (dir.y / len) * knockback);
    const hitColor = ENEMY_DATA[enemy.type].color;

    spawnHitParticles(ctx.particles, enemy.x, enemy.y, hitColor, 6, {
      speed: 150, life: 0.5, radius: 3, type: 'spark', glow: true,
    });
    if (projectile.type === WeaponType.FIRE_WAND) {
      spawnHitParticles(ctx.particles, enemy.x, enemy.y, '#ff8800', 4, {
        speed: 100, life: 0.4, radius: 4, type: 'circle', glow: true,
      });
    }
    if (projectile.type === WeaponType.LIGHTNING) {
      spawnHitParticles(ctx.particles, enemy.x, enemy.y, '#ffff88', 3, {
        speed: 120, life: 0.3, radius: 2, type: 'star', glow: true,
      });
    }

    const dmgColor = this.getProjectileDamageColor(projectile);
    const dmgSize = projectile.damage >= 30 ? 18 : projectile.damage >= 20 ? 16 : 14;
    pushDamageNumber(ctx.damageNumbers, enemy.x, enemy.y, projectile.damage, dmgColor, dmgSize);
    if (knockbackModifier) {
      this.triggerModifierFeedback(ctx, knockbackModifier.id, enemy.x, enemy.y);
    }
    this.triggerProjectileModifiers(ctx, projectile, enemy, isDead);
    return isDead;
  }

  private triggerProjectileModifiers(ctx: ProjectileCombatContext, projectile: Projectile, enemy: Enemy, isDead: boolean) {
    for (const modifier of MODIFIERS) {
      if (!this.projectileHasModifier(projectile, modifier.id)) continue;

      if (modifier.trigger === 'onKill' && isDead) {
        this.triggerModifierFeedback(ctx, modifier.id, enemy.x, enemy.y);
        switch (modifier.effect) {
          case 'deathExplosion':
            this.spawnDeathExplosion(ctx, projectile, enemy, 92, 0.45, modifier.visual.accent);
            break;
          case 'lightningExplosion':
            this.spawnDeathExplosion(ctx, projectile, enemy, 126, 0.38, modifier.visual.accent);
            break;
          case 'chainExplosion':
            this.spawnChainExplosion(ctx, projectile, enemy);
            break;
        }
        continue;
      }

      if (modifier.trigger !== 'onHit') continue;
      switch (modifier.effect) {
        case 'pulse':
          if (!projectile.pulseDone) {
            projectile.pulseDone = true;
            this.triggerModifierFeedback(ctx, modifier.id, projectile.x, projectile.y);
            this.spawnImpactPulse(ctx, projectile);
          }
          break;
        case 'chain':
          if (!projectile.chainDone) {
            projectile.chainDone = true;
            if (this.spawnChainHit(ctx, projectile, enemy)) {
              this.triggerModifierFeedback(ctx, modifier.id, enemy.x, enemy.y);
            }
          }
          break;
        case 'split':
          if (!projectile.splitDone && this.canSplitProjectile(projectile)) {
            projectile.splitDone = true;
            this.triggerModifierFeedback(ctx, modifier.id, projectile.x, projectile.y);
            this.spawnSplitProjectiles(ctx, projectile);
          }
          break;
        case 'reflect':
          if (this.spawnReflectionProjectile(ctx, projectile, enemy, modifier.id)) {
            this.triggerModifierFeedback(ctx, modifier.id, enemy.x, enemy.y);
          }
          break;
      }
    }
  }

  private projectileHasModifier(projectile: Projectile, modifier: keyof typeof GENERIC_MODIFIER_MASK): boolean {
    return (projectile.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
  }

  private getProjectileModifierByEffect(projectile: Projectile, effect: 'knockback') {
    for (const modifier of MODIFIERS) {
      if (modifier.effect === effect && this.projectileHasModifier(projectile, modifier.id)) {
        return modifier;
      }
    }
    return undefined;
  }

  private triggerModifierFeedback(
    ctx: ProjectileCombatContext,
    modifierType: GenericModifierType,
    x: number,
    y: number
  ) {
    const modifier = GENERIC_MODIFIER_DATA[modifierType];
    const visual = modifier.visual;
    const isKill = visual.layer === 'kill';
    const isControl = visual.layer === 'control';
    spawnExplosionParticles(ctx.particles, x, y, visual.accent, isKill ? 18 : 10, {
      speed: isKill ? 190 : isControl ? 120 : 145,
      life: isKill ? 0.62 : 0.42,
      radius: isKill ? 3.5 : 2.6,
      type: visual.particle,
      glow: true,
      innerColor: visual.color,
      ringCount: isControl ? 4 : 6,
    });
    eventBus.emit(GameEvent.MODIFIER_TRIGGER, modifierType);
  }

  private getProjectileDamageColor(projectile: Projectile): string {
    return projectile.type === WeaponType.FIRE_WAND ? '#ff8844' :
           projectile.type === WeaponType.LIGHTNING ? '#ffff88' :
           projectile.type === WeaponType.RUNE_LANCE ? '#9ff5ff' :
           projectile.type === WeaponType.MOON_BLADE ? '#d8b7ff' :
           projectile.type === WeaponType.AXE ? '#ffcf8a' :
           projectile.type === WeaponType.HOLY_WATER ? '#88ccff' : '#ffffff';
  }

  private spawnImpactPulse(ctx: ProjectileCombatContext, projectile: Projectile) {
    const radius = Math.max(36, projectile.radius * 1.8);
    const damage = projectile.damage * 0.35;
    spawnExplosionParticles(ctx.particles, projectile.x, projectile.y, '#b277ff', 10, {
      speed: 120, life: 0.45, radius: 3, type: 'spark', glow: true,
      innerColor: '#f0ddff', ringCount: 5,
    });

    ctx.enemyQuery.forNearby(projectile.x, projectile.y, radius, (target) => {
      const dir = { x: target.x - projectile.x, y: target.y - projectile.y };
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
      damageEnemy(target, damage, (dir.x / len) * projectile.knockback * 0.4, (dir.y / len) * projectile.knockback * 0.4);
      pushDamageNumber(ctx.damageNumbers, target.x, target.y, damage, '#c49cff', 12);
    });
  }

  private spawnDeathExplosion(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    source: Enemy,
    radius: number,
    damageRatio: number,
    color: string
  ) {
    const damage = projectile.damage * damageRatio;
    spawnExplosionParticles(ctx.particles, source.x, source.y, color, 16, {
      speed: 170, life: 0.55, radius: 4, type: 'spark', glow: true,
      innerColor: '#ffffff', ringCount: 7,
    });

    ctx.enemyQuery.forNearby(source.x, source.y, radius, (target) => {
      if (target.hp <= 0 || target.id === source.id) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dSq = dx * dx + dy * dy;
      if (dSq > radius * radius) return;
      const len = Math.sqrt(dSq) || 1;
      damageEnemy(target, damage, (dx / len) * projectile.knockback * 0.55, (dy / len) * projectile.knockback * 0.55);
      pushDamageNumber(ctx.damageNumbers, target.x, target.y, damage, color, 12);
    });
  }

  private spawnChainExplosion(ctx: ProjectileCombatContext, projectile: Projectile, source: Enemy) {
    const chainRadius = 260;
    const targets: Enemy[] = [];
    ctx.enemyQuery.forNearby(source.x, source.y, chainRadius, (target) => {
      if (target.hp <= 0 || target.id === source.id || targets.length >= 2) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      if (dx * dx + dy * dy <= chainRadius * chainRadius) targets.push(target);
    });

    for (const target of targets) {
      spawnExplosionParticles(ctx.particles, target.x, target.y, '#ffd166', 10, {
        speed: 135, life: 0.4, radius: 3, type: 'star', glow: true,
        innerColor: '#fff0bd', ringCount: 5,
      });
      const damage = projectile.damage * 0.32;
      damageEnemy(target, damage, 0, 0);
      pushDamageNumber(ctx.damageNumbers, target.x, target.y, damage, '#ffd166', 12);
    }
  }

  private spawnChainHit(ctx: ProjectileCombatContext, projectile: Projectile, source: Enemy): boolean {
    let best: Enemy | undefined;
    let bestDistSq = Infinity;
    const chainRadius = 240;
    ctx.enemyQuery.forNearby(source.x, source.y, chainRadius, (target) => {
      if (target.hp <= 0 || target.id === source.id || projectile.hitEnemies.has(target.id)) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < chainRadius * chainRadius && dSq < bestDistSq) {
        best = target;
        bestDistSq = dSq;
      }
    });
    if (!best) return false;

    projectile.hitEnemies.add(best.id);
    const dir = { x: best.x - source.x, y: best.y - source.y };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    const damage = projectile.damage * 0.55;
    damageEnemy(best, damage, (dir.x / len) * projectile.knockback * 0.7, (dir.y / len) * projectile.knockback * 0.7);
    spawnHitParticles(ctx.particles, best.x, best.y, '#bde7ff', 6, {
      speed: 130, life: 0.35, radius: 2.5, type: 'star', glow: true,
    });
    pushDamageNumber(ctx.damageNumbers, best.x, best.y, damage, '#bde7ff', 13);
    return true;
  }

  private canSplitProjectile(projectile: Projectile): boolean {
    return projectile.type === WeaponType.MAGIC_WAND ||
           projectile.type === WeaponType.FIRE_WAND ||
           projectile.type === WeaponType.RUNE_LANCE ||
           projectile.type === WeaponType.MOON_BLADE;
  }

  private canReflectProjectile(projectile: Projectile): boolean {
    return projectile.type === WeaponType.MAGIC_WAND ||
           projectile.type === WeaponType.FIRE_WAND ||
           projectile.type === WeaponType.RUNE_LANCE ||
           projectile.type === WeaponType.MOON_BLADE;
  }

  private clearProjectileMotionExtras(projectile: Projectile) {
    projectile.gravY = undefined;
    projectile.orbitAngle = undefined;
    projectile.orbitRadius = undefined;
    projectile.orbitSpeed = undefined;
    projectile.orbitFollowPlayer = undefined;
    projectile.originX = undefined;
    projectile.originY = undefined;
    projectile.count = undefined;
    projectile.segScale = undefined;
    projectile.lightningSeed = undefined;
    projectile.beamLength = undefined;
    projectile.arcAngle = undefined;
  }

  private configureStationaryFirePatch(
    child: Projectile,
    source: Projectile,
    x: number,
    y: number,
    damageRatio: number,
    radiusRatio: number
  ) {
    child.x = x;
    child.y = y;
    child.vx = 0;
    child.vy = 0;
    child.damage = source.damage * damageRatio;
    child.radius = Math.max(8, source.radius * radiusRatio);
    child.life = Math.min(0.85, Math.max(0.45, source.maxLife * 0.72));
    child.maxLife = child.life;
    child.pierce = 999;
    child.pierceCount = 0;
    child.type = WeaponType.FIRE_WAND;
    child.hitEnemies.clear();
    child.knockback = source.knockback * 0.7;
    child.animTimer = 0;
    child.modifierMask = source.modifierMask;
    child.splitDone = true;
    child.chainDone = false;
    child.pulseDone = false;
    child.reflectRemaining = source.reflectRemaining;
    this.clearProjectileMotionExtras(child);
    child.originX = source.x;
    child.originY = source.y;
  }

  private configureRuneBeam(
    child: Projectile,
    source: Projectile,
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    length: number,
    damageRatio: number,
    radiusRatio: number
  ) {
    child.x = startX + dirX * length * 0.5;
    child.y = startY + dirY * length * 0.5;
    child.vx = dirX;
    child.vy = dirY;
    child.damage = source.damage * damageRatio;
    child.radius = Math.max(4, source.radius * radiusRatio);
    child.life = Math.min(0.18, Math.max(0.12, source.maxLife * 0.9));
    child.maxLife = child.life;
    child.pierce = source.pierce;
    child.pierceCount = 0;
    child.type = WeaponType.RUNE_LANCE;
    child.hitEnemies.clear();
    child.knockback = source.knockback * 0.75;
    child.animTimer = 0;
    child.modifierMask = source.modifierMask;
    child.splitDone = true;
    child.chainDone = false;
    child.pulseDone = false;
    child.reflectRemaining = source.reflectRemaining;
    this.clearProjectileMotionExtras(child);
    child.originX = startX;
    child.originY = startY;
    child.beamLength = length;
  }

  private spawnReflectionProjectile(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    source: Enemy,
    modifierType: GenericModifierType
  ): boolean {
    const remaining = projectile.reflectRemaining ?? 0;
    if (remaining <= 0 || !this.canReflectProjectile(projectile)) return false;
    if (ctx.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) return false;

    let best: Enemy | undefined;
    let bestDistSq = REFLECTION_TARGET_RADIUS * REFLECTION_TARGET_RADIUS;
    ctx.enemyQuery.forNearby(source.x, source.y, REFLECTION_TARGET_RADIUS, (target) => {
      if (target.hp <= 0 || target.id === source.id || projectile.hitEnemies.has(target.id)) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        best = target;
        bestDistSq = dSq;
      }
    });
    if (!best) return false;

    const nextRemaining = remaining - 1;
    projectile.reflectRemaining = nextRemaining;

    const dx = best.x - source.x;
    const dy = best.y - source.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    if (projectile.type === WeaponType.FIRE_WAND) {
      const child = pools.projectiles.acquire();
      this.configureStationaryFirePatch(child, projectile, best.x, best.y, REFLECTION_DAMAGE_RATIO, 0.85);
      child.reflectRemaining = nextRemaining;
      for (const enemyId of projectile.hitEnemies) child.hitEnemies.add(enemyId);
      child.hitEnemies.add(source.id);
      ctx.projectiles.push(child);

      spawnHitParticles(ctx.particles, source.x, source.y, GENERIC_MODIFIER_DATA[modifierType].visual.accent, 5, {
        speed: 115, life: 0.28, radius: 2.2, type: 'star', glow: true,
      });
      return true;
    }

    if (projectile.type === WeaponType.RUNE_LANCE) {
      const child = pools.projectiles.acquire();
      const beamLength = Math.min(RUNE_REFLECTION_BEAM_MAX_LENGTH, Math.max(180, Math.sqrt(bestDistSq) + best.radius * 2));
      this.configureRuneBeam(
        child,
        projectile,
        source.x,
        source.y,
        dx / len,
        dy / len,
        beamLength,
        REFLECTION_DAMAGE_RATIO,
        0.85
      );
      child.reflectRemaining = nextRemaining;
      for (const enemyId of projectile.hitEnemies) child.hitEnemies.add(enemyId);
      child.hitEnemies.add(source.id);
      ctx.projectiles.push(child);

      spawnHitParticles(ctx.particles, source.x, source.y, GENERIC_MODIFIER_DATA[modifierType].visual.accent, 5, {
        speed: 115, life: 0.28, radius: 2.2, type: 'star', glow: true,
      });
      return true;
    }

    const speed = Math.max(260, Math.min(620, Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 360));
    const child = pools.projectiles.acquire();
    child.x = source.x;
    child.y = source.y;
    child.vx = (dx / len) * speed;
    child.vy = (dy / len) * speed;
    child.damage = projectile.damage * REFLECTION_DAMAGE_RATIO;
    child.radius = Math.max(4, projectile.radius * 0.85);
    child.life = Math.min(1.15, Math.max(0.55, Math.sqrt(bestDistSq) / speed + 0.22));
    child.maxLife = child.life;
    child.pierce = 0;
    child.pierceCount = 0;
    child.type = projectile.type;
    child.hitEnemies.clear();
    for (const enemyId of projectile.hitEnemies) child.hitEnemies.add(enemyId);
    child.hitEnemies.add(source.id);
    child.knockback = projectile.knockback * 0.75;
    child.animTimer = 0;
    child.modifierMask = projectile.modifierMask;
    child.splitDone = projectile.splitDone;
    child.chainDone = false;
    child.pulseDone = false;
    child.reflectRemaining = nextRemaining;
    this.clearProjectileMotionExtras(child);
    ctx.projectiles.push(child);

    spawnHitParticles(ctx.particles, source.x, source.y, GENERIC_MODIFIER_DATA[modifierType].visual.accent, 5, {
      speed: 115, life: 0.28, radius: 2.2, type: 'star', glow: true,
    });
    return true;
  }

  private spawnSplitProjectiles(ctx: ProjectileCombatContext, projectile: Projectile) {
    if (projectile.type === WeaponType.FIRE_WAND) {
      for (const offset of [-1, 1]) {
        if (ctx.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) break;
        const child = pools.projectiles.acquire();
        const angle = projectile.animTimer + offset * 1.05;
        this.configureStationaryFirePatch(
          child,
          projectile,
          projectile.x + Math.cos(angle) * projectile.radius * 1.25,
          projectile.y + Math.sin(angle) * projectile.radius * 1.25,
          0.4,
          0.72
        );
        ctx.projectiles.push(child);
      }
      return;
    }

    if (projectile.type === WeaponType.RUNE_LANCE) {
      const baseAngle = Math.atan2(projectile.vy, projectile.vx || 1);
      const startX = projectile.originX ?? projectile.x;
      const startY = projectile.originY ?? projectile.y;
      for (const offset of [-0.36, 0.36]) {
        if (ctx.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) break;
        const child = pools.projectiles.acquire();
        const angle = baseAngle + offset;
        this.configureRuneBeam(
          child,
          projectile,
          startX,
          startY,
          Math.cos(angle),
          Math.sin(angle),
          Math.min(RUNE_SPLIT_BEAM_LENGTH, Math.max(180, projectile.beamLength ?? RUNE_SPLIT_BEAM_LENGTH)),
          0.4,
          0.72
        );
        ctx.projectiles.push(child);
      }
      return;
    }

    const speed = Math.max(220, Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 320);
    const baseAngle = Math.atan2(projectile.vy, projectile.vx || 1);
    for (const offset of [-0.45, 0.45]) {
      if (ctx.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) break;
      const child = pools.projectiles.acquire();
      const angle = baseAngle + offset;
      child.x = projectile.x;
      child.y = projectile.y;
      child.vx = Math.cos(angle) * speed;
      child.vy = Math.sin(angle) * speed;
      child.damage = projectile.damage * 0.4;
      child.radius = Math.max(4, projectile.radius * 0.65);
      child.life = Math.min(1.1, Math.max(0.55, projectile.maxLife * 0.55));
      child.maxLife = child.life;
      child.pierce = 0;
      child.pierceCount = 0;
      child.type = projectile.type;
      child.hitEnemies.clear();
      child.knockback = projectile.knockback * 0.6;
      child.animTimer = 0;
      child.modifierMask = projectile.modifierMask;
      child.splitDone = true;
      child.chainDone = false;
      child.pulseDone = false;
      child.reflectRemaining = projectile.reflectRemaining;
      this.clearProjectileMotionExtras(child);
      if (projectile.type === WeaponType.AXE) child.gravY = projectile.gravY;
      ctx.projectiles.push(child);
    }
  }
}
