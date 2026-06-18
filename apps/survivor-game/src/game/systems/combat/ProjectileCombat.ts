import { Enemy, Projectile, Particle, DamageNumber, WeaponType } from '../../types';
import { ENEMY_DATA, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK } from '../../constants';
import { damageEnemy } from '../enemy/Enemy';
import type { MapSystem } from '../map/MapSystem';
import { createDamageNumber } from '../../effects/DamageNumber';
import { spawnExplosionParticles, spawnHitParticles } from '../../effects/Particle';
import { updateProjectile } from '../weapon/Weapon';
import { pools } from '../../utils/PoolManager';
import { SpatialGrid } from '../../utils/SpatialGrid';
import { circlesOverlap } from '../../utils/math';

export interface ProjectileCombatContext {
  projectiles: Projectile[];
  enemies: Enemy[];
  mapSystem: MapSystem;
  particles: Particle[];
  damageNumbers: DamageNumber[];
}

export class ProjectileCombat {
  private readonly enemyGrid = new SpatialGrid<Enemy>(240);

  update(ctx: ProjectileCombatContext, dt: number) {
    this.enemyGrid.rebuild(ctx.enemies);
    const projectileCount = ctx.projectiles.length;
    for (let i = 0; i < projectileCount; i++) {
      const projectile = ctx.projectiles[i];
      if (projectile.life <= 0) continue;
      if (!updateProjectile(projectile, dt)) {
        projectile.life = 0;
        continue;
      }
      if (
        projectile.orbitAngle === undefined &&
        ctx.mapSystem.handleProjectileCollision(projectile.x, projectile.y, projectile.radius)
      ) {
        projectile.life = 0;
        continue;
      }

      for (const enemy of ctx.enemies) {
        if (enemy.hp <= 0) continue;
        if (projectile.hitEnemies.has(enemy.id)) continue;
        if (circlesOverlap(projectile.x, projectile.y, projectile.radius, enemy.x, enemy.y, enemy.radius)) {
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
            break;
          }
        }
      }
    }
    this.releaseDeadProjectiles(ctx.projectiles);
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
    const dir = { x: enemy.x - projectile.x, y: enemy.y - projectile.y };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    const knockback = projectile.knockback + (this.projectileHasEffect(projectile, 'knockback') ? 120 : 0);
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
    ctx.damageNumbers.push(createDamageNumber(enemy.x, enemy.y, projectile.damage, dmgColor, dmgSize));
    this.triggerProjectileModifiers(ctx, projectile, enemy, isDead);
    return isDead;
  }

  private triggerProjectileModifiers(ctx: ProjectileCombatContext, projectile: Projectile, enemy: Enemy, isDead: boolean) {
    for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
      if (!this.projectileHasModifier(projectile, modifier.id)) continue;

      if (modifier.trigger === 'onKill' && isDead) {
        switch (modifier.effect) {
          case 'deathExplosion':
            this.spawnDeathExplosion(ctx, projectile, enemy, 92, 0.45, '#ff9a45');
            break;
          case 'lightningExplosion':
            this.spawnDeathExplosion(ctx, projectile, enemy, 126, 0.38, '#8fe8ff');
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
            this.spawnImpactPulse(ctx, projectile);
          }
          break;
        case 'chain':
          if (!projectile.chainDone) {
            projectile.chainDone = true;
            this.spawnChainHit(ctx, projectile, enemy);
          }
          break;
        case 'split':
          if (!projectile.splitDone && this.canSplitProjectile(projectile)) {
            projectile.splitDone = true;
            this.spawnSplitProjectiles(ctx, projectile);
          }
          break;
      }
    }
  }

  private projectileHasModifier(projectile: Projectile, modifier: keyof typeof GENERIC_MODIFIER_MASK): boolean {
    return (projectile.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
  }

  private projectileHasEffect(projectile: Projectile, effect: 'knockback'): boolean {
    return Object.values(GENERIC_MODIFIER_DATA).some((modifier) =>
      modifier.effect === effect &&
      this.projectileHasModifier(projectile, modifier.id)
    );
  }

  private getProjectileDamageColor(projectile: Projectile): string {
    return projectile.type === WeaponType.FIRE_WAND ? '#ff8844' :
           projectile.type === WeaponType.LIGHTNING ? '#ffff88' :
           projectile.type === WeaponType.HOLY_WATER ? '#88ccff' : '#ffffff';
  }

  private spawnImpactPulse(ctx: ProjectileCombatContext, projectile: Projectile) {
    const radius = Math.max(36, projectile.radius * 1.8);
    const damage = projectile.damage * 0.35;
    spawnExplosionParticles(ctx.particles, projectile.x, projectile.y, '#b277ff', 10, {
      speed: 120, life: 0.45, radius: 3, type: 'spark', glow: true,
      innerColor: '#f0ddff', ringCount: 5,
    });

    this.enemyGrid.forNearby(projectile.x, projectile.y, radius, (target) => {
      const dir = { x: target.x - projectile.x, y: target.y - projectile.y };
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
      damageEnemy(target, damage, (dir.x / len) * projectile.knockback * 0.4, (dir.y / len) * projectile.knockback * 0.4);
      ctx.damageNumbers.push(createDamageNumber(target.x, target.y, damage, '#c49cff', 12));
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

    this.enemyGrid.forNearby(source.x, source.y, radius, (target) => {
      if (target.hp <= 0 || target.id === source.id) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dSq = dx * dx + dy * dy;
      if (dSq > radius * radius) return;
      const len = Math.sqrt(dSq) || 1;
      damageEnemy(target, damage, (dx / len) * projectile.knockback * 0.55, (dy / len) * projectile.knockback * 0.55);
      ctx.damageNumbers.push(createDamageNumber(target.x, target.y, damage, color, 12));
    });
  }

  private spawnChainExplosion(ctx: ProjectileCombatContext, projectile: Projectile, source: Enemy) {
    const chainRadius = 260;
    const targets: Enemy[] = [];
    this.enemyGrid.forNearby(source.x, source.y, chainRadius, (target) => {
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
      ctx.damageNumbers.push(createDamageNumber(target.x, target.y, damage, '#ffd166', 12));
    }
  }

  private spawnChainHit(ctx: ProjectileCombatContext, projectile: Projectile, source: Enemy) {
    let best: Enemy | undefined;
    let bestDistSq = Infinity;
    const chainRadius = 240;
    this.enemyGrid.forNearby(source.x, source.y, chainRadius, (target) => {
      if (target.hp <= 0 || target.id === source.id || projectile.hitEnemies.has(target.id)) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < chainRadius * chainRadius && dSq < bestDistSq) {
        best = target;
        bestDistSq = dSq;
      }
    });
    if (!best) return;

    projectile.hitEnemies.add(best.id);
    const dir = { x: best.x - source.x, y: best.y - source.y };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    const damage = projectile.damage * 0.55;
    damageEnemy(best, damage, (dir.x / len) * projectile.knockback * 0.7, (dir.y / len) * projectile.knockback * 0.7);
    spawnHitParticles(ctx.particles, best.x, best.y, '#bde7ff', 6, {
      speed: 130, life: 0.35, radius: 2.5, type: 'star', glow: true,
    });
    ctx.damageNumbers.push(createDamageNumber(best.x, best.y, damage, '#bde7ff', 13));
  }

  private canSplitProjectile(projectile: Projectile): boolean {
    return projectile.type === WeaponType.MAGIC_WAND ||
           projectile.type === WeaponType.FIRE_WAND ||
           projectile.type === WeaponType.AXE;
  }

  private spawnSplitProjectiles(ctx: ProjectileCombatContext, projectile: Projectile) {
    const speed = Math.max(220, Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 320);
    const baseAngle = Math.atan2(projectile.vy, projectile.vx || 1);
    for (const offset of [-0.45, 0.45]) {
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
      if (projectile.type === WeaponType.AXE) child.gravY = projectile.gravY;
      ctx.projectiles.push(child);
    }
  }
}
