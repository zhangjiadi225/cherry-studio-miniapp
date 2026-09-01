import { Enemy, Projectile, Particle, DamageNumber, WeaponType, type EnemyProjectile, type GenericModifierType, type Player } from '../../types';
import { ENEMY_DATA, GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK, MAX_ACTIVE_PLAYER_PROJECTILES } from '../../constants';
import { applyEnemyBurn, applyEnemySlow, damageEnemy } from '../enemy/Enemy';
import type { MapSystem } from '../map/MapSystem';
import { pushDamageNumber } from '../../effects/DamageNumber';
import {
  spawnChainLightningParticle,
  spawnCrescentWaveParticle,
  spawnExplosionParticles,
  spawnHitParticles,
} from '../../effects/Particle';
import { eventBus, GameEvent } from '../../events';
import { updateProjectile } from '../weapon/Weapon';
import { pools } from '../../utils/PoolManager';
import { circlesOverlap } from '../../utils/math';
import type { EnemyQuery } from '../enemy/EnemyQuery';
import type {
  ProjectileHitEffectContext,
  ProjectileLifecycleContext,
  ProjectileLifecycleEvent,
  ProjectileParticleEffectContext,
  ProjectileParticleEvent,
  WeaponFeedbackContext,
  WeaponFeedbackEvent,
} from '../../recipes/weapon/WeaponRuntimePlan';

const MODIFIERS = Object.values(GENERIC_MODIFIER_DATA);
const KNOCKBACK_MODIFIER_MASK = MODIFIERS.reduce(
  (mask, modifier) => modifier.effect === 'knockback'
    ? mask | GENERIC_MODIFIER_MASK[modifier.id]
    : mask,
  0
);
const PROJECTILE_COLLISION_LOOKUP_PADDING = 64;
const REFLECTION_DAMAGE_RATIO = 0.72;
const REFLECTION_ANGLE_STEP = Math.PI * 0.36;
const RUNE_REFLECTION_BEAM_MAX_LENGTH = 360;
const effectTargetsScratch: Enemy[] = [];
const sweptTargetsScratch: Enemy[] = [];
const sweptHitFractionsScratch: number[] = [];
const effectTargetDistancesScratch: number[] = [];
const HIT_DEAD = 1;
const HIT_PRESERVED = 2;
const BASE_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 150,
  life: 0.5,
  radius: 3,
  type: 'spark' as const,
  glow: true,
});
const FIRE_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 100,
  life: 0.4,
  radius: 4,
  type: 'circle' as const,
  glow: true,
});
const LIGHTNING_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 120,
  life: 0.3,
  radius: 2,
  type: 'star' as const,
  glow: true,
});
const FIRE_EXPLOSION_PARTICLE_OPTIONS = Object.freeze({
  speed: 200,
  life: 0.7,
  radius: 5,
  type: 'spark' as const,
  glow: true,
  innerColor: '#ffcc00',
  ringCount: 6,
});
const AXE_CLEAR_PARTICLE_OPTIONS = Object.freeze({
  speed: 95,
  life: 0.26,
  radius: 2.2,
  type: 'spark' as const,
  glow: true,
});
const REFLECT_PARTICLE_OPTIONS = Object.freeze({
  speed: 100,
  life: 0.3,
  radius: 2,
  type: 'star' as const,
  glow: true,
});
const DEATH_EXPLOSION_PARTICLE_OPTIONS = Object.freeze({
  speed: 170,
  life: 0.55,
  radius: 4,
  type: 'spark' as const,
  glow: true,
  innerColor: '#ffffff',
  ringCount: 7,
});
const CHAIN_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 130,
  life: 0.35,
  radius: 2.5,
  type: 'star' as const,
  glow: true,
});

function particleEventSeed(
  definitionHash: number,
  projectile: Projectile,
  event: ProjectileParticleEvent,
  sequence: number
): number {
  const eventValue = event === 'spawn' ? 1 : event === 'trail' ? 2 : event === 'hit' ? 3 : event === 'kill' ? 4 : 5;
  return (
    definitionHash ^
    Math.imul(sequence + 1, 0x9e3779b1) ^
    Math.imul(Math.round(projectile.x * 16), 0x85ebca6b) ^
    Math.imul(Math.round(projectile.y * 16), 0xc2b2ae35) ^
    eventValue
  ) >>> 0;
}

export interface ProjectileCombatContext {
  player: Player;
  projectiles: Projectile[];
  enemyQuery: EnemyQuery;
  mapSystem: MapSystem;
  particles: Particle[];
  damageNumbers: DamageNumber[];
  enemyProjectiles?: EnemyProjectile[];
}

export interface ProjectileCombatMetrics {
  collisionCandidates: number;
  hits: number;
}

export class ProjectileCombat {
  private metricsEnabled = false;
  private readonly frameMetrics: ProjectileCombatMetrics = {
    collisionCandidates: 0,
    hits: 0,
  };
  private activeUpdateContext?: ProjectileCombatContext;
  private activeProjectile?: Projectile;
  private activeProjectileExpired = false;
  private activeHitContext?: ProjectileCombatContext;
  private activeHitProjectile?: Projectile;
  private activeHitEnemy?: Enemy;
  private hitDamageScale = 0;
  private hitKnockbackScale = 0;
  private activeParticleContext?: ProjectileCombatContext;
  private activeParticleProjectile?: Projectile;
  private activeParticleX = 0;
  private activeParticleY = 0;
  private activeParticleDt = 0;
  private activeParticleSeed = 0;
  private activeLifecycleContext?: ProjectileCombatContext;
  private activeLifecycleProjectile?: Projectile;
  private activeLifecycleEnemy?: Enemy;
  private activeLifecycleEvent: ProjectileLifecycleEvent = 'hit';
  private activeLifecycleTriggerCount = 0;
  private activeLifecyclePrimitiveId = '';
  private activeLifecyclePreserved = false;
  private activeFeedbackDefinitionId = '';
  private activeFeedbackEvent: WeaponFeedbackEvent = 'cast';
  private activeFeedbackX = 0;
  private activeFeedbackY = 0;
  private activeAreaContext?: ProjectileCombatContext;
  private activeAreaProjectile?: Projectile;
  private activeAreaSourceId = 0;
  private activeAreaDamage = 0;
  private activeAreaMaximumTargets = 0;
  private activeAreaHits = 0;
  private activeChainSource?: Enemy;
  private activeChainMaximumTargets = 0;
  private readonly directionScratch = { x: 1, y: 0 };
  private readonly hitEffectContext = this.createHitEffectContext();
  private readonly particleEffectContext = this.createParticleEffectContext();
  private readonly lifecycleEffectContext = this.createLifecycleEffectContext();
  private readonly feedbackEffectContext = this.createFeedbackEffectContext();

  private readonly visitProjectileEnemy = (enemy: Enemy): boolean => {
    const ctx = this.activeUpdateContext!;
    const projectile = this.activeProjectile!;
    if (this.activeProjectileExpired || enemy.hp <= 0) return !this.activeProjectileExpired;
    const collision = projectile.runtimePlan?.projectile.collision;
    if (
      collision &&
      collision.repeatHitInterval > 0 &&
      (projectile.collisionHitsThisFrame ?? 0) >= collision.maximumTargetsPerTick
    ) return false;
    if (!this.canHitEnemy(projectile, enemy.id)) return true;

    const hitFlags = this.applyProjectileHit(ctx, projectile, enemy);
    if (this.metricsEnabled) this.frameMetrics.hits++;
    projectile.collisionHitsThisFrame = (projectile.collisionHitsThisFrame ?? 0) + 1;
    if ((projectile.runtimePlan?.projectile.collision.repeatHitInterval ?? 0) > 0) {
      return (projectile.collisionHitsThisFrame ?? 0) < (collision?.maximumTargetsPerTick ?? Infinity);
    }
    projectile.pierceCount++;
    if (projectile.pierceCount > projectile.pierce && (hitFlags & HIT_PRESERVED) === 0) {
      if (projectile.type === WeaponType.FIRE_WAND && (hitFlags & HIT_DEAD) !== 0) {
        spawnExplosionParticles(
          ctx.particles,
          enemy.x,
          enemy.y,
          '#ff6600',
          15,
          FIRE_EXPLOSION_PARTICLE_OPTIONS
        );
      }
      this.expireRuntimeProjectile(ctx, projectile);
      this.activeProjectileExpired = true;
    }
    return !this.activeProjectileExpired;
  };

  private readonly visitOverlappingProjectileEnemy = (enemy: Enemy): boolean => {
    const projectile = this.activeProjectile!;
    if (this.metricsEnabled) this.frameMetrics.collisionCandidates++;
    if (!this.projectileOverlapsEnemy(projectile, enemy)) return true;
    return this.visitProjectileEnemy(enemy);
  };

  private readonly collectSweptTarget = (enemy: Enemy, hitFraction: number): void => {
    let insertionIndex = sweptTargetsScratch.length;
    sweptTargetsScratch.push(enemy);
    sweptHitFractionsScratch.push(hitFraction);
    while (insertionIndex > 0) {
      const previousIndex = insertionIndex - 1;
      const previousFraction = sweptHitFractionsScratch[previousIndex];
      const previousEnemy = sweptTargetsScratch[previousIndex];
      if (
        previousFraction < hitFraction ||
        (previousFraction === hitFraction && previousEnemy.id <= enemy.id)
      ) break;
      sweptTargetsScratch[insertionIndex] = previousEnemy;
      sweptHitFractionsScratch[insertionIndex] = previousFraction;
      insertionIndex--;
    }
    sweptTargetsScratch[insertionIndex] = enemy;
    sweptHitFractionsScratch[insertionIndex] = hitFraction;
  };

  private readonly visitAreaTarget = (target: Enemy): boolean => {
    if (this.activeAreaHits >= this.activeAreaMaximumTargets) return false;
    if (target.hp <= 0 || target.id === this.activeAreaSourceId) return true;
    this.dealSecondaryDamage(
      this.activeAreaContext!,
      this.activeAreaProjectile!,
      target,
      this.activeAreaDamage
    );
    this.activeAreaHits++;
    return this.activeAreaHits < this.activeAreaMaximumTargets;
  };

  private readonly collectBoundedChainTarget = (target: Enemy): void => {
    const source = this.activeChainSource!;
    if (target.hp <= 0 || target.id === source.id) return;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = dx * dx + dy * dy;
    let insertionIndex = effectTargetsScratch.length;
    while (
      insertionIndex > 0 &&
      (
        effectTargetDistancesScratch[insertionIndex - 1] > distance ||
        (
          effectTargetDistancesScratch[insertionIndex - 1] === distance &&
          effectTargetsScratch[insertionIndex - 1].id > target.id
        )
      )
    ) {
      insertionIndex--;
    }
    if (insertionIndex >= this.activeChainMaximumTargets) return;
    const previousLength = effectTargetsScratch.length;
    const nextLength = Math.min(previousLength + 1, this.activeChainMaximumTargets);
    effectTargetsScratch.length = nextLength;
    effectTargetDistancesScratch.length = nextLength;
    for (let index = nextLength - 1; index > insertionIndex; index--) {
      effectTargetsScratch[index] = effectTargetsScratch[index - 1];
      effectTargetDistancesScratch[index] = effectTargetDistancesScratch[index - 1];
    }
    effectTargetsScratch[insertionIndex] = target;
    effectTargetDistancesScratch[insertionIndex] = distance;
  };

  setMetricsEnabled(enabled: boolean): void {
    this.metricsEnabled = enabled;
  }

  resetMetrics(): void {
    this.frameMetrics.collisionCandidates = 0;
    this.frameMetrics.hits = 0;
  }

  get metrics(): Readonly<ProjectileCombatMetrics> {
    return this.frameMetrics;
  }

  private createHitEffectContext(): ProjectileHitEffectContext {
    const combat = this;
    return {
      get projectile() {
        return combat.activeHitProjectile!;
      },
      get enemy() {
        return combat.activeHitEnemy!;
      },
      dealDamage(scale: number) {
        combat.hitDamageScale += scale;
        return false;
      },
      applyKnockback(scale: number) {
        combat.hitKnockbackScale += scale;
      },
      applySlow(speedMultiplier: number, duration: number) {
        applyEnemySlow(combat.activeHitEnemy!, speedMultiplier, duration);
      },
      applyBurn(damagePerSecondScale: number, duration: number) {
        applyEnemyBurn(
          combat.activeHitEnemy!,
          combat.activeHitProjectile!.damage * damagePerSecondScale,
          duration
        );
      },
      dealAreaDamage(radius: number, damageScale: number, maxTargets: number) {
        combat.dealAreaEffect(
          combat.activeHitContext!,
          combat.activeHitProjectile!,
          combat.activeHitEnemy!,
          radius,
          damageScale,
          maxTargets
        );
      },
      dealChainDamage(range: number, damageScale: number, maxTargets: number) {
        combat.dealChainEffect(
          combat.activeHitContext!,
          combat.activeHitProjectile!,
          combat.activeHitEnemy!,
          range,
          damageScale,
          maxTargets
        );
      },
    };
  }

  private createParticleEffectContext(): ProjectileParticleEffectContext {
    const combat = this;
    return {
      get particles() {
        return combat.activeParticleContext!.particles;
      },
      get projectile() {
        return combat.activeParticleProjectile!;
      },
      get x() {
        return combat.activeParticleX;
      },
      get y() {
        return combat.activeParticleY;
      },
      get dt() {
        return combat.activeParticleDt;
      },
      get seed() {
        return combat.activeParticleSeed;
      },
      get palette() {
        return combat.activeParticleProjectile!.runtimePlan!.projectile.visual.palette;
      },
    };
  }

  private createLifecycleEffectContext(): ProjectileLifecycleContext {
    const combat = this;
    return {
      get projectile() {
        return combat.activeLifecycleProjectile!;
      },
      get enemy() {
        return combat.activeLifecycleEnemy;
      },
      get event() {
        return combat.activeLifecycleEvent;
      },
      get triggerCount() {
        return combat.activeLifecycleTriggerCount;
      },
      setTriggerCount(value: number) {
        combat.activeLifecycleProjectile!.lifecycleTriggerCounts!.set(
          combat.activeLifecyclePrimitiveId,
          Math.max(0, Math.floor(value))
        );
      },
      spawnChild(angle, damageScale, speedScale, lifetimeScale, inheritLifecycle) {
        return combat.spawnLifecycleChild(
          combat.activeLifecycleContext!,
          combat.activeLifecycleProjectile!,
          angle,
          damageScale,
          speedScale,
          lifetimeScale,
          inheritLifecycle
        );
      },
      redirect(angle, speedScale) {
        const projectile = combat.activeLifecycleProjectile!;
        const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) * speedScale;
        projectile.headingAngle = angle;
        projectile.vx = Math.cos(angle) * speed;
        projectile.vy = Math.sin(angle) * speed;
      },
      preserveProjectile() {
        combat.activeLifecyclePreserved = true;
      },
    };
  }

  private createFeedbackEffectContext(): WeaponFeedbackContext {
    const combat = this;
    return {
      get definitionId() {
        return combat.activeFeedbackDefinitionId;
      },
      get event() {
        return combat.activeFeedbackEvent;
      },
      get x() {
        return combat.activeFeedbackX;
      },
      get y() {
        return combat.activeFeedbackY;
      },
    };
  }

  update(ctx: ProjectileCombatContext, dt: number) {
    const projectileCount = ctx.projectiles.length;
    for (let i = 0; i < projectileCount; i++) {
      const projectile = ctx.projectiles[i];
      if (projectile.life <= 0) continue;
      this.updateRepeatHitCooldowns(projectile, dt);
      if (projectile.visualSpawnPending) {
        projectile.visualSpawnPending = false;
        this.emitProjectileParticles(ctx, projectile, 'spawn');
      }
      if (!updateProjectile(projectile, dt, ctx.player, ctx.enemyQuery)) {
        this.expireRuntimeProjectile(ctx, projectile);
        continue;
      }
      this.emitProjectileParticles(ctx, projectile, 'trail', projectile.x, projectile.y, dt);
      if (
        this.shouldUseMapProjectileCollision(projectile) &&
        ctx.mapSystem.handleProjectileCollision(
          projectile.x,
          projectile.y,
          projectile.radius,
          projectile.previousX,
          projectile.previousY
        )
      ) {
        const collision = projectile.runtimePlan?.projectile.collision;
        if (!collision || !collision.handleMapCollision(projectile)) {
          this.expireRuntimeProjectile(ctx, projectile);
          continue;
        }
      }
      this.clearEnemyProjectilesWithAxe(projectile, ctx);

      if (projectile.runtimePlan && !projectile.runtimePlan.delivery.canCollide(projectile)) continue;
      projectile.collisionHitsThisFrame = 0;

      this.activeUpdateContext = ctx;
      this.activeProjectile = projectile;
      this.activeProjectileExpired = false;

      const sweepRadius = this.getProjectileSweepRadius(projectile);
      if (
        sweepRadius !== undefined &&
        projectile.previousX !== undefined &&
        projectile.previousY !== undefined
      ) {
        this.collectSweptTargets(ctx.enemyQuery, projectile, sweepRadius);
        for (const enemy of sweptTargetsScratch) {
          if (this.metricsEnabled) this.frameMetrics.collisionCandidates++;
          if (!this.visitProjectileEnemy(enemy)) break;
        }
      } else {
        const radius = this.getProjectileLookupRadius(projectile);
        if (ctx.enemyQuery.forNearbyUntil) {
          ctx.enemyQuery.forNearbyUntil(
            projectile.x,
            projectile.y,
            radius,
            this.visitOverlappingProjectileEnemy
          );
        } else {
          ctx.enemyQuery.forNearby(
            projectile.x,
            projectile.y,
            radius,
            this.visitOverlappingProjectileEnemy
          );
        }
      }
    }
    this.activeUpdateContext = undefined;
    this.activeProjectile = undefined;
    this.releaseDeadProjectiles(ctx.projectiles);
  }

  private updateRepeatHitCooldowns(projectile: Projectile, dt: number): void {
    if (!projectile.hitCooldowns || projectile.hitCooldowns.size === 0) return;
    for (const [enemyId, remaining] of projectile.hitCooldowns) {
      const next = remaining - dt;
      if (next <= 0) projectile.hitCooldowns.delete(enemyId);
      else projectile.hitCooldowns.set(enemyId, next);
    }
  }

  private canHitEnemy(projectile: Projectile, enemyId: number): boolean {
    const repeatInterval = projectile.runtimePlan?.projectile.collision.repeatHitInterval ?? 0;
    if (repeatInterval > 0) return !projectile.hitCooldowns?.has(enemyId);
    return !projectile.hitEnemies.has(enemyId);
  }

  private expireRuntimeProjectile(ctx: ProjectileCombatContext, projectile: Projectile): void {
    if (projectile.life <= 0 && !projectile.runtimePlan) return;
    this.triggerProjectileLifecycle(ctx, projectile, 'expire');
    this.emitProjectileParticles(ctx, projectile, 'expire');
    this.emitWeaponFeedback(projectile, 'expire', projectile.x, projectile.y);
    projectile.life = 0;
  }

  private shouldUseMapProjectileCollision(projectile: Projectile): boolean {
    if (projectile.orbitAngle !== undefined) return false;
    if (projectile.runtimePlan) {
      return projectile.runtimePlan.projectile.collision.stopOnMap;
    }
    return projectile.type !== WeaponType.FIRE_WAND &&
      projectile.type !== WeaponType.RUNE_LANCE &&
      projectile.type !== WeaponType.AXE;
  }

  private getProjectileLookupRadius(projectile: Projectile): number {
    if (projectile.runtimePlan) {
      return projectile.runtimePlan.projectile.collision.getLookupRadius(projectile);
    }
    if (this.isRuneBeam(projectile) || this.isAxeCleave(projectile)) {
      return projectile.beamLength! * 0.5 + projectile.radius + PROJECTILE_COLLISION_LOOKUP_PADDING;
    }
    return projectile.radius + PROJECTILE_COLLISION_LOOKUP_PADDING;
  }

  private getProjectileSweepRadius(projectile: Projectile): number | undefined {
    if (projectile.runtimePlan) {
      return projectile.runtimePlan.projectile.collision.getSweepRadius(projectile);
    }
    if (this.isRuneBeam(projectile) || this.isAxeCleave(projectile)) return undefined;
    return projectile.radius;
  }

  private collectSweptTargets(
    enemyQuery: EnemyQuery,
    projectile: Projectile,
    sweepRadius: number
  ): void {
    sweptTargetsScratch.length = 0;
    sweptHitFractionsScratch.length = 0;
    enemyQuery.forSweptCircle(
      projectile.previousX!,
      projectile.previousY!,
      projectile.x,
      projectile.y,
      sweepRadius,
      this.collectSweptTarget
    );
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
    if (projectile.runtimePlan) {
      return projectile.runtimePlan.projectile.collision.overlaps(projectile, enemy);
    }
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
        spawnHitParticles(
          ctx.particles,
          enemyProjectile.x,
          enemyProjectile.y,
          '#ffd18a',
          4,
          AXE_CLEAR_PARTICLE_OPTIONS
        );
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

  private applyProjectileHit(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    enemy: Enemy
  ): number {
    const repeatInterval = projectile.runtimePlan?.projectile.collision.repeatHitInterval ?? 0;
    if (repeatInterval > 0) {
      projectile.hitCooldowns ??= new Map<number, number>();
      projectile.hitCooldowns.set(enemy.id, repeatInterval);
    } else {
      projectile.hitEnemies.add(enemy.id);
    }
    const knockbackSourceX = projectile.type === WeaponType.AXE && projectile.originX !== undefined ? projectile.originX : projectile.x;
    const knockbackSourceY = projectile.type === WeaponType.AXE && projectile.originY !== undefined ? projectile.originY : projectile.y;
    const dirX = enemy.x - knockbackSourceX;
    const dirY = enemy.y - knockbackSourceY;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const hasKnockbackModifier = (projectile.modifierMask & KNOCKBACK_MODIFIER_MASK) !== 0;
    let appliedDamage = projectile.damage;
    let isDead: boolean;
    if (projectile.runtimePlan) {
      this.activeHitContext = ctx;
      this.activeHitProjectile = projectile;
      this.activeHitEnemy = enemy;
      this.hitDamageScale = 0;
      this.hitKnockbackScale = 0;
      for (const effect of projectile.runtimePlan.projectile.hitEffects) {
        effect.apply(this.hitEffectContext);
      }
      appliedDamage = projectile.damage * this.hitDamageScale;
      const knockback = projectile.knockback * this.hitKnockbackScale + (hasKnockbackModifier ? 120 : 0);
      isDead = damageEnemy(
        enemy,
        appliedDamage,
        (dirX / len) * knockback,
        (dirY / len) * knockback
      );
      this.activeHitContext = undefined;
      this.activeHitProjectile = undefined;
      this.activeHitEnemy = undefined;
    } else {
      const knockback = projectile.knockback + (hasKnockbackModifier ? 120 : 0);
      isDead = damageEnemy(
        enemy,
        projectile.damage,
        (dirX / len) * knockback,
        (dirY / len) * knockback
      );
    }
    const hitColor = ENEMY_DATA[enemy.type].color;

    spawnHitParticles(ctx.particles, enemy.x, enemy.y, hitColor, 6, BASE_HIT_PARTICLE_OPTIONS);
    if (projectile.type === WeaponType.FIRE_WAND) {
      spawnHitParticles(ctx.particles, enemy.x, enemy.y, '#ff8800', 4, FIRE_HIT_PARTICLE_OPTIONS);
    }
    if (projectile.type === WeaponType.LIGHTNING) {
      spawnHitParticles(ctx.particles, enemy.x, enemy.y, '#ffff88', 3, LIGHTNING_HIT_PARTICLE_OPTIONS);
    }

    const dmgColor = this.getProjectileDamageColor(projectile);
    const dmgSize = appliedDamage >= 30 ? 18 : appliedDamage >= 20 ? 16 : 14;
    pushDamageNumber(ctx.damageNumbers, enemy.x, enemy.y, appliedDamage, dmgColor, dmgSize);
    this.emitProjectileParticles(ctx, projectile, 'hit', enemy.x, enemy.y);
    this.emitWeaponFeedback(projectile, 'hit', enemy.x, enemy.y);
    if (isDead) {
      this.emitProjectileParticles(ctx, projectile, 'kill', enemy.x, enemy.y);
      this.emitWeaponFeedback(projectile, 'kill', enemy.x, enemy.y);
    }
    this.triggerProjectileModifiers(ctx, projectile, enemy, isDead);
    const preserved = this.triggerProjectileLifecycle(ctx, projectile, 'hit', enemy);
    return (isDead ? HIT_DEAD : 0) | (preserved ? HIT_PRESERVED : 0);
  }

  private dealAreaEffect(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    source: Enemy,
    radius: number,
    damageScale: number,
    maxTargets: number
  ): void {
    if (maxTargets <= 0) return;
    this.activeAreaContext = ctx;
    this.activeAreaProjectile = projectile;
    this.activeAreaSourceId = source.id;
    this.activeAreaDamage = projectile.damage * damageScale;
    this.activeAreaMaximumTargets = maxTargets;
    this.activeAreaHits = 0;
    if (ctx.enemyQuery.forNearbyUntil) {
      ctx.enemyQuery.forNearbyUntil(source.x, source.y, radius, this.visitAreaTarget);
    } else {
      ctx.enemyQuery.forNearby(source.x, source.y, radius, this.visitAreaTarget);
    }
    this.activeAreaContext = undefined;
    this.activeAreaProjectile = undefined;
  }

  private dealChainEffect(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    source: Enemy,
    range: number,
    damageScale: number,
    maxTargets: number
  ): void {
    if (maxTargets <= 0) return;
    effectTargetsScratch.length = 0;
    effectTargetDistancesScratch.length = 0;
    this.activeChainSource = source;
    this.activeChainMaximumTargets = maxTargets;
    ctx.enemyQuery.forNearby(source.x, source.y, range, this.collectBoundedChainTarget);
    this.activeChainSource = undefined;
    let fromX = source.x;
    let fromY = source.y;
    for (let index = 0; index < effectTargetsScratch.length; index++) {
      const target = effectTargetsScratch[index];
      spawnChainLightningParticle(ctx.particles, fromX, fromY, target.x, target.y);
      this.dealSecondaryDamage(ctx, projectile, target, projectile.damage * damageScale);
      fromX = target.x;
      fromY = target.y;
    }
  }

  private dealSecondaryDamage(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    enemy: Enemy,
    damage: number
  ): void {
    damageEnemy(enemy, damage, 0, 0);
    pushDamageNumber(
      ctx.damageNumbers,
      enemy.x,
      enemy.y,
      damage,
      this.getProjectileDamageColor(projectile),
      damage >= 30 ? 18 : damage >= 20 ? 16 : 14
    );
  }

  private emitProjectileParticles(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    event: ProjectileParticleEvent,
    x = projectile.x,
    y = projectile.y,
    dt = 0
  ): void {
    const plan = projectile.runtimePlan;
    if (!plan || plan.projectile.visual.emitters.length === 0) return;
    const effects = plan.projectile.visual.emitters;

    if (event === 'trail') {
      let effect: (typeof effects)[number] | undefined;
      for (const candidate of effects) {
        if (candidate.event === event) {
          effect = candidate;
          break;
        }
      }
      if (!effect) return;
      projectile.visualTrailTimer = (projectile.visualTrailTimer ?? 0) + dt;
      let emissions = 0;
      while (projectile.visualTrailTimer >= effect.emissionInterval && emissions < 2) {
        projectile.visualTrailTimer -= effect.emissionInterval;
        this.emitProjectileParticleEffect(ctx, projectile, effect, event, x, y, dt);
        emissions++;
      }
      if (emissions === 2) {
        projectile.visualTrailTimer %= effect.emissionInterval;
      }
      return;
    }

    for (const effect of effects) {
      if (effect.event !== event) continue;
      this.emitProjectileParticleEffect(ctx, projectile, effect, event, x, y, dt);
    }
  }

  private emitProjectileParticleEffect(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    effect: NonNullable<Projectile['runtimePlan']>['projectile']['visual']['emitters'][number],
    event: ProjectileParticleEvent,
    x: number,
    y: number,
    dt: number
  ): void {
    const plan = projectile.runtimePlan!;
    const sequence = projectile.visualEffectSequence ?? 0;
    projectile.visualEffectSequence = sequence + 1;
    this.activeParticleContext = ctx;
    this.activeParticleProjectile = projectile;
    this.activeParticleX = x;
    this.activeParticleY = y;
    this.activeParticleDt = dt;
    this.activeParticleSeed = particleEventSeed(plan.definitionHash, projectile, event, sequence);
    effect.emit(this.particleEffectContext);
    this.activeParticleContext = undefined;
    this.activeParticleProjectile = undefined;
  }

  private emitWeaponFeedback(
    projectile: Projectile,
    event: 'charge' | 'cast' | 'hit' | 'kill' | 'expire',
    x: number,
    y: number
  ): void {
    const plan = projectile.runtimePlan;
    if (!plan) return;
    this.activeFeedbackDefinitionId = plan.definitionId;
    this.activeFeedbackEvent = event;
    this.activeFeedbackX = x;
    this.activeFeedbackY = y;
    for (const effect of plan.feedback) {
      if (effect.event === event) {
        effect.emit(this.feedbackEffectContext);
      }
    }
  }

  private triggerProjectileLifecycle(
    ctx: ProjectileCombatContext,
    projectile: Projectile,
    event: 'hit' | 'expire',
    enemy?: Enemy
  ): boolean {
    const plan = projectile.runtimePlan;
    if (!plan || projectile.lifecycleSuppressed) return false;
    projectile.lifecycleTriggerCounts ??= new Map<string, number>();
    this.activeLifecycleContext = ctx;
    this.activeLifecycleProjectile = projectile;
    this.activeLifecycleEnemy = enemy;
    this.activeLifecycleEvent = event;
    this.activeLifecyclePreserved = false;
    for (const effect of plan.projectile.lifecycle) {
      if (effect.event !== event) continue;
      this.activeLifecyclePrimitiveId = effect.primitiveId;
      this.activeLifecycleTriggerCount = projectile.lifecycleTriggerCounts.get(effect.primitiveId) ?? 0;
      effect.handle(this.lifecycleEffectContext);
    }
    const preserved = this.activeLifecyclePreserved;
    this.activeLifecycleContext = undefined;
    this.activeLifecycleProjectile = undefined;
    this.activeLifecycleEnemy = undefined;
    return preserved;
  }

  private spawnLifecycleChild(
    ctx: ProjectileCombatContext,
    source: Projectile,
    angle: number,
    damageScale: number,
    speedScale: number,
    lifetimeScale: number,
    inheritLifecycle: boolean
  ): boolean {
    if (ctx.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES || !source.runtimePlan) return false;
    const child = pools.projectiles.acquire();
    const speed = Math.sqrt(source.vx * source.vx + source.vy * source.vy) * speedScale;
    child.x = source.x;
    child.y = source.y;
    child.vx = Math.cos(angle) * speed;
    child.vy = Math.sin(angle) * speed;
    child.damage = source.damage * damageScale;
    child.radius = source.radius;
    child.life = Math.max(0.05, source.maxLife * lifetimeScale);
    child.maxLife = child.life;
    child.pierce = source.pierce;
    child.pierceCount = 0;
    child.type = source.type;
    child.knockback = source.knockback;
    child.modifierMask = source.modifierMask;
    child.chainDone = false;
    child.pulseDone = false;
    child.reflectRemaining = source.reflectRemaining;
    child.animTimer = 0;
    child.headingAngle = angle;
    child.runtimePlan = source.runtimePlan;
    child.useLegacyProjectileSprite = source.useLegacyProjectileSprite;
    child.evolutionIds = source.evolutionIds;
    child.lifecycleDepth = (source.lifecycleDepth ?? 0) + 1;
    child.lifecycleSuppressed = !inheritLifecycle;
    child.visualSpawnPending = true;
    child.activationRemaining = source.runtimePlan.delivery.activationDelay;
    source.runtimePlan.delivery.initialize(child, ctx.player);
    ctx.projectiles.push(child);
    return true;
  }

  private triggerProjectileModifiers(ctx: ProjectileCombatContext, projectile: Projectile, enemy: Enemy, isDead: boolean) {
    for (const modifier of MODIFIERS) {
      if (!this.projectileHasModifier(projectile, modifier.id)) continue;

      if (modifier.trigger === 'onKill' && isDead) {
        switch (modifier.effect) {
          case 'deathExplosion':
            this.spawnDeathExplosion(ctx, projectile, enemy, 92, 0.45, modifier.visual.accent);
            this.emitModifierCue(modifier.id);
            break;
        }
        continue;
      }

      if (modifier.trigger !== 'onHit') continue;
      switch (modifier.effect) {
        case 'pulse':
          if (!projectile.pulseDone) {
            projectile.pulseDone = true;
            this.spawnImpactPulse(ctx, projectile, enemy, modifier.visual.accent);
            this.emitModifierCue(modifier.id);
          }
          break;
        case 'chain':
          if (!projectile.chainDone) {
            projectile.chainDone = true;
            if (this.spawnChainHit(ctx, projectile, enemy, modifier.visual.accent)) {
              this.emitModifierCue(modifier.id);
            }
          }
          break;
        case 'reflect':
          if (this.spawnReflectionProjectile(ctx, projectile, enemy)) {
            spawnHitParticles(
              ctx.particles,
              enemy.x,
              enemy.y,
              modifier.visual.accent,
              5,
              REFLECT_PARTICLE_OPTIONS
            );
            this.emitModifierCue(modifier.id);
          }
          break;
      }
    }
  }

  private projectileHasModifier(projectile: Projectile, modifier: keyof typeof GENERIC_MODIFIER_MASK): boolean {
    return (projectile.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
  }

  private emitModifierCue(modifierType: GenericModifierType) {
    eventBus.emit(GameEvent.MODIFIER_TRIGGER, modifierType);
  }

  private getProjectileDamageColor(projectile: Projectile): string {
    const runtimeColor = projectile.runtimePlan?.projectile.visual.palette.accent;
    if (runtimeColor) return runtimeColor;
    return projectile.type === WeaponType.FIRE_WAND ? '#ff8844' :
           projectile.type === WeaponType.LIGHTNING ? '#ffff88' :
           projectile.type === WeaponType.RUNE_LANCE ? '#9ff5ff' :
           projectile.type === WeaponType.MOON_BLADE ? '#d8b7ff' :
           projectile.type === WeaponType.AXE ? '#ffcf8a' :
           projectile.type === WeaponType.HOLY_WATER ? '#88ccff' : '#ffffff';
  }

  private getProjectileDirection(projectile: Projectile, fallbackTarget?: Enemy): { x: number; y: number } {
    const direction = this.directionScratch;
    const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
    if (speed > 0.01) {
      direction.x = projectile.vx / speed;
      direction.y = projectile.vy / speed;
      return direction;
    }
    if (projectile.headingAngle !== undefined) {
      direction.x = Math.cos(projectile.headingAngle);
      direction.y = Math.sin(projectile.headingAngle);
      return direction;
    }
    if (projectile.originX !== undefined && projectile.originY !== undefined) {
      const dx = projectile.x - projectile.originX;
      const dy = projectile.y - projectile.originY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        direction.x = dx / len;
        direction.y = dy / len;
        return direction;
      }
    }
    if (fallbackTarget) {
      const dx = fallbackTarget.x - projectile.x;
      const dy = fallbackTarget.y - projectile.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        direction.x = dx / len;
        direction.y = dy / len;
        return direction;
      }
    }
    direction.x = 1;
    direction.y = 0;
    return direction;
  }

  private spawnImpactPulse(ctx: ProjectileCombatContext, projectile: Projectile, source: Enemy, accent = '#925dff') {
    const dir = this.getProjectileDirection(projectile, source);
    const backX = -dir.x;
    const backY = -dir.y;
    const radius = Math.max(62, projectile.radius * 2.6);
    const centerX = source.x + backX * radius * 0.62;
    const centerY = source.y + backY * radius * 0.62;
    const damage = projectile.damage * 0.35;
    spawnCrescentWaveParticle(ctx.particles, centerX, centerY, Math.atan2(backY, backX), accent);

    ctx.enemyQuery.forNearby(centerX, centerY, radius, (target) => {
      if (target.hp <= 0 || target.id === source.id) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > radius * radius) return;
      const dist = Math.sqrt(distSq) || 1;
      const alignment = (dx / dist) * backX + (dy / dist) * backY;
      if (alignment < 0.32) return;
      damageEnemy(target, damage, backX * projectile.knockback * 0.38, backY * projectile.knockback * 0.38);
      pushDamageNumber(ctx.damageNumbers, target.x, target.y, damage, accent, 12);
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
    spawnExplosionParticles(
      ctx.particles,
      source.x,
      source.y,
      color,
      16,
      DEATH_EXPLOSION_PARTICLE_OPTIONS
    );

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

  private spawnChainHit(ctx: ProjectileCombatContext, projectile: Projectile, source: Enemy, accent = '#4bb7ff'): boolean {
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
    const dirX = best.x - source.x;
    const dirY = best.y - source.y;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const damage = projectile.damage * 0.55;
    damageEnemy(best, damage, (dirX / len) * projectile.knockback * 0.7, (dirY / len) * projectile.knockback * 0.7);
    spawnChainLightningParticle(ctx.particles, source.x, source.y, best.x, best.y, accent);
    spawnHitParticles(ctx.particles, best.x, best.y, accent, 6, CHAIN_HIT_PARTICLE_OPTIONS);
    pushDamageNumber(ctx.damageNumbers, best.x, best.y, damage, accent, 13);
    return true;
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
    projectile.runtimePlan = undefined;
  }

  private copyProjectileEvolutionAssets(child: Projectile, source: Projectile) {
    child.evolutionIds = source.evolutionIds;
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
    this.copyProjectileEvolutionAssets(child, source);
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
    this.copyProjectileEvolutionAssets(child, source);
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
    source: Enemy
  ): boolean {
    const remaining = projectile.reflectRemaining ?? 0;
    if (remaining <= 0 || !this.canReflectProjectile(projectile)) return false;
    if (ctx.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) return false;

    const nextRemaining = remaining - 1;
    projectile.reflectRemaining = nextRemaining;
    const dir = this.getProjectileDirection(projectile, source);
    const baseAngle = Math.atan2(dir.y, dir.x);
    const bendDirection = remaining % 2 === 0 ? -1 : 1;
    const reflectAngle = baseAngle + REFLECTION_ANGLE_STEP * bendDirection;
    const dirX = Math.cos(reflectAngle);
    const dirY = Math.sin(reflectAngle);

    if (projectile.type === WeaponType.FIRE_WAND) {
      const child = pools.projectiles.acquire();
      const travel = Math.max(54, projectile.radius * 2.4);
      this.configureStationaryFirePatch(
        child,
        projectile,
        source.x + dirX * travel,
        source.y + dirY * travel,
        REFLECTION_DAMAGE_RATIO,
        0.85
      );
      child.reflectRemaining = nextRemaining;
      for (const enemyId of projectile.hitEnemies) child.hitEnemies.add(enemyId);
      child.hitEnemies.add(source.id);
      ctx.projectiles.push(child);
      return true;
    }

    if (projectile.type === WeaponType.RUNE_LANCE) {
      const child = pools.projectiles.acquire();
      const beamLength = Math.min(RUNE_REFLECTION_BEAM_MAX_LENGTH, Math.max(180, projectile.beamLength ?? RUNE_REFLECTION_BEAM_MAX_LENGTH));
      this.configureRuneBeam(
        child,
        projectile,
        source.x,
        source.y,
        dirX,
        dirY,
        beamLength,
        REFLECTION_DAMAGE_RATIO,
        0.85
      );
      child.reflectRemaining = nextRemaining;
      for (const enemyId of projectile.hitEnemies) child.hitEnemies.add(enemyId);
      child.hitEnemies.add(source.id);
      ctx.projectiles.push(child);
      return true;
    }

    const speed = Math.max(260, Math.min(620, Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 360));
    const child = pools.projectiles.acquire();
    child.x = source.x;
    child.y = source.y;
    child.vx = dirX * speed;
    child.vy = dirY * speed;
    child.damage = projectile.damage * REFLECTION_DAMAGE_RATIO;
    child.radius = Math.max(4, projectile.radius * 0.85);
    child.life = Math.min(1.15, Math.max(0.55, projectile.maxLife * 0.6));
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
    this.copyProjectileEvolutionAssets(child, projectile);
    child.chainDone = false;
    child.pulseDone = false;
    child.reflectRemaining = nextRemaining;
    this.clearProjectileMotionExtras(child);
    child.runtimePlan = projectile.runtimePlan;
    child.useLegacyProjectileSprite = projectile.useLegacyProjectileSprite;
    ctx.projectiles.push(child);
    return true;
  }
}
