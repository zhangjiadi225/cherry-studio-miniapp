import { Particle, DamageNumber, Projectile, XPGem } from '../types';
import { ObjectPool } from './ObjectPool';

function resetParticle(p: Particle) {
  p.x = 0;
  p.y = 0;
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
  p.splitDone = false;
  p.chainDone = false;
  p.pulseDone = false;
  p.gravY = undefined;
  p.animTimer = 0;
  p.orbitAngle = undefined;
  p.orbitRadius = undefined;
  p.orbitSpeed = undefined;
  p.originX = undefined;
  p.originY = undefined;
  p.count = undefined;
  p.segScale = undefined;
  p.lightningSeed = undefined;
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

export const pools = {
  particles: new ObjectPool<Particle>(
    () => ({
      x: 0, y: 0, vx: 0, vy: 0,
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
};

export function clearAllPools() {
  pools.particles.clear();
  pools.damageNumbers.clear();
  pools.projectiles.clear();
  pools.xpGems.clear();
}
