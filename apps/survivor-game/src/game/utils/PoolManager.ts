import { Particle, DamageNumber, Projectile, XPGem, Enemy, EnemyType, EnemyProjectile } from '../types';
import { ObjectPool } from './ObjectPool';

function resetParticle(p: Particle) {
  p.x = 0;
  p.y = 0;
  p.endX = undefined;
  p.endY = undefined;
  p.vx = 0;
  p.vy = 0;
  p.life = 0;
  p.maxLife = 0;
  p.radius = 0;
  p.color = '';
  p.alpha = 1;
  p.rotation = 0;
  p.rotSpeed = 0;
  p.type = 'circle';
  p.trail = false;
  p.glow = false;
  p.glowRadius = 0;
  p.glowColor = '';
}

function resetDamageNumber(d: DamageNumber) {
  d.x = 0;
  d.y = 0;
  d.value = 0;
  d.life = 0;
  d.maxLife = 0;
  d.vy = 0;
  d.color = '';
  d.size = 0;
}

function resetProjectile(p: Projectile) {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.damage = 0;
  p.radius = 0;
  p.life = 0;
  p.maxLife = 0;
  p.pierce = 0;
  p.pierceCount = 0;
  p.type = 'magic_wand';
  p.hitEnemies.clear();
  p.knockback = 0;
  p.modifierMask = 0;

  p.chainDone = false;
  p.pulseDone = false;
  p.reflectRemaining = undefined;
  p.gravY = undefined;
  p.animTimer = 0;
  p.orbitAngle = undefined;
  p.orbitRadius = undefined;
  p.orbitSpeed = undefined;
  p.orbitFollowPlayer = undefined;
  p.originX = undefined;
  p.originY = undefined;
  p.count = undefined;
  p.segScale = undefined;
  p.lightningSeed = undefined;
  p.beamLength = undefined;
  p.arcAngle = undefined;
  p.evolutionIds = undefined;
  p.runtimePlan = undefined;
  p.useLegacyProjectileSprite = undefined;
}

function resetEnemyProjectile(p: EnemyProjectile) {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.damage = 0;
  p.radius = 0;
  p.life = 0;
  p.maxLife = 0;
  p.sourceType = EnemyType.ZOMBIE;
  p.sourceId = 0;
  p.kind = 'cultist_bolt';
  p.color = '';
  p.glowColor = '';
  p.animTimer = 0;
}

function resetXPGem(g: XPGem) {
  g.x = 0;
  g.y = 0;
  g.value = 0;
  g.radius = 4;
  g.magnetized = false;
  g.life = 0;
  g.animTimer = 0;
  g.type = 'small';
}

function resetEnemy(e: Enemy) {
  e.id = 0;
  e.x = 0;
  e.y = 0;
  e.radius = 0;
  e.hp = 0;
  e.maxHp = 0;
  e.speed = 0;
  e.damage = 0;
  e.type = EnemyType.ZOMBIE;
  e.isElite = false;
  e.isBoss = false;
  e.knockbackX = 0;
  e.knockbackY = 0;
  e.hitFlash = 0;
  e.animTimer = 0;
  e.xpValue = 0;
  e.contactCooldown = 0;
  e.attackCooldown = 0;
  e.attackWindup = 0;
  e.attackPatternIndex = 0;
  e.pendingAttackPattern = -1;
  e.isEmpowered = false;
  e.trait = 'none';
  e.traitCooldown = 0;
  e.traitWindup = 0;
  e.traitDuration = 0;
  e.traitDirX = 0;
  e.traitDirY = 0;
}

export const pools = {
  particles: new ObjectPool<Particle>(
    () => ({
      x: 0, y: 0, vx: 0, vy: 0,
      endX: undefined, endY: undefined,
      life: 0, maxLife: 0, radius: 0,
      color: '', alpha: 1,
      rotation: 0, rotSpeed: 0,
      type: 'circle', trail: false, glow: false,
      glowRadius: 0, glowColor: '',
    }),
    resetParticle,
    128, 2048
  ),

  damageNumbers: new ObjectPool<DamageNumber>(
    () => ({
      x: 0, y: 0, value: 0,
      life: 0, maxLife: 0, vy: 0,
      color: '', size: 0,
    }),
    resetDamageNumber,
    64, 512
  ),

  projectiles: new ObjectPool<Projectile>(
    () => ({
      x: 0, y: 0, vx: 0, vy: 0,
      damage: 0, radius: 0,
      life: 0, maxLife: 0,
      pierce: 0, pierceCount: 0,
      type: 'magic_wand' as any,
      hitEnemies: new Set<number>(),
      knockback: 0,
      modifierMask: 0,
      animTimer: 0,
    }),
    resetProjectile,
    64, 512
  ),

  enemyProjectiles: new ObjectPool<EnemyProjectile>(
    () => ({
      x: 0, y: 0, vx: 0, vy: 0,
      damage: 0, radius: 0,
      life: 0, maxLife: 0,
      sourceType: EnemyType.ZOMBIE,
      sourceId: 0,
      kind: 'cultist_bolt',
      color: '',
      glowColor: '',
      animTimer: 0,
    }),
    resetEnemyProjectile,
    64, 512
  ),

  xpGems: new ObjectPool<XPGem>(
    () => ({
      x: 0, y: 0, value: 0,
      radius: 4, magnetized: false,
      life: 0, animTimer: 0,
      type: 'small',
    }),
    resetXPGem,
    64, 512
  ),

  enemies: new ObjectPool<Enemy>(
    () => ({
      id: 0,
      x: 0, y: 0,
      radius: 0,
      hp: 0, maxHp: 0,
      speed: 0, damage: 0,
      type: EnemyType.ZOMBIE,
      isElite: false,
      isBoss: false,
      knockbackX: 0,
      knockbackY: 0,
      hitFlash: 0,
      animTimer: 0,
      xpValue: 0,
      contactCooldown: 0,
      attackCooldown: 0,
      attackWindup: 0,
      attackPatternIndex: 0,
      pendingAttackPattern: -1,
      isEmpowered: false,
      trait: 'none',
      traitCooldown: 0,
      traitWindup: 0,
      traitDuration: 0,
      traitDirX: 0,
      traitDirY: 0,
    }),
    resetEnemy,
    256, 1024
  ),
};

export function clearAllPools() {
  pools.particles.clear();
  pools.damageNumbers.clear();
  pools.projectiles.clear();
  pools.enemyProjectiles.clear();
  pools.xpGems.clear();
  pools.enemies.clear();
}
