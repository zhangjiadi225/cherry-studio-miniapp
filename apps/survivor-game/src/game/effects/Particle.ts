import { Particle } from '../types';
import { randFloat } from '../utils/math';
import { pools } from '../utils/PoolManager';

export function createParticle(
  x: number, y: number,
  color: string,
  speed: number = 100,
  life: number = 0.5,
  radius: number = 3,
  options: {
    type?: 'circle' | 'square' | 'star' | 'spark';
    trail?: boolean;
    glow?: boolean;
    glowRadius?: number;
    glowColor?: string;
    minSpeed?: number;
    maxSpeed?: number;
    angle?: number;
    rotSpeed?: number;
  } = {}
): Particle {
  const p = pools.particles.acquire();
  const angle = options.angle ?? Math.random() * Math.PI * 2;
  const spd = randFloat(options.minSpeed ?? speed * 0.3, options.maxSpeed ?? speed);
  p.x = x;
  p.y = y;
  p.vx = Math.cos(angle) * spd;
  p.vy = Math.sin(angle) * spd;
  p.life = life;
  p.maxLife = life;
  p.radius = radius;
  p.color = color;
  p.alpha = 1;
  p.rotation = Math.random() * Math.PI * 2;
  p.rotSpeed = options.rotSpeed ?? randFloat(-3, 3);
  p.type = options.type ?? 'circle';
  p.trail = options.trail ?? false;
  p.glow = options.glow ?? false;
  p.glowRadius = options.glowRadius ?? radius * 3;
  p.glowColor = options.glowColor ?? color;
  return p;
}

export function updateParticle(p: Particle, dt: number): boolean {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= 0.96;
  p.vy *= 0.96;
  p.life -= dt;
  p.alpha = Math.max(0, p.life / p.maxLife);
  if (p.rotation !== undefined && p.rotSpeed) {
    p.rotation += p.rotSpeed * dt;
  }
  return p.life > 0;
}

export function spawnHitParticles(
  particles: Particle[],
  x: number, y: number,
  color: string,
  count: number = 5,
  options: {
    speed?: number;
    life?: number;
    radius?: number;
    type?: 'circle' | 'square' | 'star' | 'spark';
    glow?: boolean;
  } = {}
) {
  const spd = options.speed ?? 120;
  const lf = options.life ?? 0.4;
  const r = options.radius ?? 2;
  const type = options.type ?? 'circle';
  const glow = options.glow ?? false;

  for (let i = 0; i < count; i++) {
    particles.push(createParticle(x, y, color, spd, lf, r + Math.random() * 2, {
      type,
      glow,
      glowRadius: r * 4,
    }));
  }
}

export function spawnDeathParticles(
  particles: Particle[],
  x: number, y: number,
  color: string,
  count: number = 12,
  options: {
    speed?: number;
    life?: number;
    radius?: number;
    type?: 'circle' | 'square' | 'star' | 'spark';
    glow?: boolean;
  } = {}
) {
  const spd = options.speed ?? 180;
  const lf = options.life ?? 0.6;
  const r = options.radius ?? 3;
  const type = options.type ?? 'square';
  const glow = options.glow ?? true;

  for (let i = 0; i < count; i++) {
    particles.push(createParticle(x, y, color, spd, lf, r + Math.random() * 3, {
      type,
      glow,
      glowRadius: r * 5,
      rotSpeed: randFloat(-8, 8),
    }));
  }
}

export function spawnXPParticles(
  particles: Particle[],
  x: number, y: number,
  count: number = 4,
  options: {
    speed?: number;
    life?: number;
    radius?: number;
    color?: string;
    glow?: boolean;
  } = {}
) {
  const spd = options.speed ?? 60;
  const lf = options.life ?? 0.3;
  const r = options.radius ?? 2;
  const color = options.color ?? '#44ff88';
  const glow = options.glow ?? true;

  for (let i = 0; i < count; i++) {
    particles.push(createParticle(x, y, color, spd, lf, r, {
      type: 'spark',
      glow,
      glowRadius: r * 6,
    }));
  }
}

export function spawnExplosionParticles(
  particles: Particle[],
  x: number, y: number,
  color: string,
  count: number = 20,
  options: {
    speed?: number;
    life?: number;
    radius?: number;
    type?: 'circle' | 'square' | 'star' | 'spark';
    glow?: boolean;
    innerColor?: string;
    ringCount?: number;
  } = {}
) {
  const spd = options.speed ?? 250;
  const lf = options.life ?? 0.8;
  const r = options.radius ?? 4;
  const type = options.type ?? 'spark';
  const glow = options.glow ?? true;
  const innerColor = options.innerColor ?? '#ffffff';
  const ringCount = options.ringCount ?? 8;

  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2;
    particles.push(createParticle(x, y, innerColor, spd * 0.7, lf * 0.6, r * 1.5, {
      type: 'spark',
      glow: true,
      glowRadius: r * 8,
      angle,
      rotSpeed: 0,
    }));
  }

  for (let i = 0; i < count - ringCount; i++) {
    particles.push(createParticle(x, y, color, spd, lf, r, {
      type,
      glow,
      glowRadius: r * 5,
    }));
  }
}

export function spawnTrailParticles(
  particles: Particle[],
  x: number, y: number,
  color: string,
  count: number = 2,
  options: {
    speed?: number;
    life?: number;
    radius?: number;
    spread?: number;
    glow?: boolean;
  } = {}
) {
  const spd = options.speed ?? 20;
  const lf = options.life ?? 0.2;
  const r = options.radius ?? 1.5;
  const glow = options.glow ?? true;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push(createParticle(x, y, color, spd, lf, r, {
      type: 'circle',
      glow,
      glowRadius: r * 4,
      angle,
      minSpeed: spd * (1 - (options.spread ?? 0.5)),
      maxSpeed: spd * (1 + (options.spread ?? 0.5)),
    }));
  }
}


export function spawnLevelUpParticles(
  particles: Particle[],
  x: number, y: number,
  count: number = 30
) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = randFloat(100, 200);
    const life = randFloat(0.6, 1.2);
    particles.push(createParticle(x, y, '#ffd700', speed, life, 4, {
      type: i % 3 === 0 ? 'star' : 'spark',
      glow: true,
      glowRadius: 16,
      angle,
      rotSpeed: randFloat(-5, 5),
    }));
  }
}
