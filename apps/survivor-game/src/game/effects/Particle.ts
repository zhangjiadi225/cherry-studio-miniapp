import { Particle } from '../types';
import { randFloat } from '../utils/math';
import { pools } from '../utils/PoolManager';
import { MAX_ACTIVE_PARTICLES, MAX_PARTICLE_EMISSIONS_PER_FRAME } from '../constants';

let frameEmissions = 0;
let frameEmissionDrops = 0;
let frameEmissionBudgetActive = false;

export function beginParticleEmissionFrame(): void {
  frameEmissions = 0;
  frameEmissionDrops = 0;
  frameEmissionBudgetActive = true;
}

export function endParticleEmissionFrame(): void {
  frameEmissionBudgetActive = false;
}

export function getParticleEmissionsThisFrame(): number {
  return frameEmissions;
}

export function getParticleEmissionDropsThisFrame(): number {
  return frameEmissionDrops;
}

export function reserveParticleCapacity(particles: Particle[]): boolean {
  if (
    particles.length >= MAX_ACTIVE_PARTICLES ||
    (frameEmissionBudgetActive && frameEmissions >= MAX_PARTICLE_EMISSIONS_PER_FRAME)
  ) {
    frameEmissionDrops++;
    return false;
  }
  if (frameEmissionBudgetActive) frameEmissions++;
  return true;
}

export function createResolvedParticle(
  x: number,
  y: number,
  color: string,
  life: number,
  radius: number,
  type: Particle['type'],
  angle: number,
  speed: number,
  rotation: number,
  rotSpeed: number,
  glow: boolean,
  glowRadius: number,
  glowColor: string = color
): Particle {
  const p = pools.particles.acquire();
  p.x = x;
  p.y = y;
  p.endX = undefined;
  p.endY = undefined;
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.life = life;
  p.maxLife = life;
  p.radius = radius;
  p.color = color;
  p.alpha = 1;
  p.rotation = rotation;
  p.rotSpeed = rotSpeed;
  p.type = type ?? 'circle';
  p.trail = false;
  p.glow = glow;
  p.glowRadius = glowRadius;
  p.glowColor = glowColor;
  return p;
}

export function createParticle(
  x: number, y: number,
  color: string,
  speed: number = 100,
  life: number = 0.5,
  radius: number = 3,
  options: {
    type?: 'circle' | 'square' | 'star' | 'spark' | 'beam' | 'crescent';
    trail?: boolean;
    glow?: boolean;
    glowRadius?: number;
    glowColor?: string;
    minSpeed?: number;
    maxSpeed?: number;
    angle?: number;
    rotSpeed?: number;
    random?: () => number;
  } = {}
): Particle {
  const random = options.random ?? Math.random;
  const angle = options.angle ?? random() * Math.PI * 2;
  const minSpeed = options.minSpeed ?? speed * 0.3;
  const maxSpeed = options.maxSpeed ?? speed;
  const spd = minSpeed + random() * (maxSpeed - minSpeed);
  const rotation = random() * Math.PI * 2;
  const rotSpeed = options.rotSpeed ?? -3 + random() * 6;
  const p = createResolvedParticle(
    x,
    y,
    color,
    life,
    radius,
    options.type,
    angle,
    spd,
    rotation,
    rotSpeed,
    options.glow ?? false,
    options.glowRadius ?? radius * 3,
    options.glowColor ?? color
  );
  p.trail = options.trail ?? false;
  return p;
}

export function spawnChainLightningParticle(
  particles: Particle[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#9fe8ff',
  glowColor = '#4bb7ff'
) {
  if (!reserveParticleCapacity(particles)) return;
  const p = createResolvedParticle(
    x1,
    y1,
    color,
    0.16,
    3,
    'beam',
    0,
    0,
    Math.random() * Math.PI * 2,
    0,
    true,
    14,
    glowColor
  );
  p.endX = x2;
  p.endY = y2;
  p.rotation = Math.random() * Math.PI * 2;
  particles.push(p);
}

export function spawnCrescentWaveParticle(
  particles: Particle[],
  x: number,
  y: number,
  angle: number,
  color = '#d4a6ff',
  glowColor = '#925dff'
) {
  if (!reserveParticleCapacity(particles)) return;
  const p = createResolvedParticle(
    x,
    y,
    color,
    0.28,
    32,
    'crescent',
    angle,
    140,
    angle,
    0,
    true,
    20,
    glowColor
  );
  p.rotation = angle;
  particles.push(p);
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
    if (!reserveParticleCapacity(particles)) break;
    particles.push(createResolvedParticle(
      x,
      y,
      color,
      lf,
      r + Math.random() * 2,
      type,
      Math.random() * Math.PI * 2,
      spd * (0.3 + Math.random() * 0.7),
      Math.random() * Math.PI * 2,
      -3 + Math.random() * 6,
      glow,
      r * 4
    ));
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
    if (!reserveParticleCapacity(particles)) break;
    particles.push(createResolvedParticle(
      x,
      y,
      color,
      lf,
      r + Math.random() * 3,
      type,
      Math.random() * Math.PI * 2,
      spd * (0.3 + Math.random() * 0.7),
      Math.random() * Math.PI * 2,
      randFloat(-8, 8),
      glow,
      r * 5
    ));
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
    if (!reserveParticleCapacity(particles)) break;
    particles.push(createResolvedParticle(
      x,
      y,
      color,
      lf,
      r,
      'spark',
      Math.random() * Math.PI * 2,
      spd * (0.3 + Math.random() * 0.7),
      Math.random() * Math.PI * 2,
      -3 + Math.random() * 6,
      glow,
      r * 6
    ));
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
    if (!reserveParticleCapacity(particles)) break;
    const angle = (i / ringCount) * Math.PI * 2;
    particles.push(createResolvedParticle(
      x,
      y,
      innerColor,
      lf * 0.6,
      r * 1.5,
      'spark',
      angle,
      spd * 0.7,
      Math.random() * Math.PI * 2,
      0,
      true,
      r * 8
    ));
  }

  for (let i = 0; i < count - ringCount; i++) {
    if (!reserveParticleCapacity(particles)) break;
    particles.push(createResolvedParticle(
      x,
      y,
      color,
      lf,
      r,
      type,
      Math.random() * Math.PI * 2,
      spd * (0.3 + Math.random() * 0.7),
      Math.random() * Math.PI * 2,
      -3 + Math.random() * 6,
      glow,
      r * 5
    ));
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
  const spread = options.spread ?? 0.5;
  const minSpeed = spd * (1 - spread);
  const maxSpeed = spd * (1 + spread);

  for (let i = 0; i < count; i++) {
    if (!reserveParticleCapacity(particles)) break;
    const angle = Math.random() * Math.PI * 2;
    particles.push(createResolvedParticle(
      x,
      y,
      color,
      lf,
      r,
      'circle',
      angle,
      minSpeed + Math.random() * (maxSpeed - minSpeed),
      Math.random() * Math.PI * 2,
      -3 + Math.random() * 6,
      glow,
      r * 4
    ));
  }
}


export function spawnLevelUpParticles(
  particles: Particle[],
  x: number, y: number,
  count: number = 30
) {
  for (let i = 0; i < count; i++) {
    if (!reserveParticleCapacity(particles)) break;
    const angle = (i / count) * Math.PI * 2;
    const speed = randFloat(100, 200);
    const life = randFloat(0.6, 1.2);
    particles.push(createResolvedParticle(
      x,
      y,
      '#ffd700',
      life,
      4,
      i % 3 === 0 ? 'star' : 'spark',
      angle,
      speed,
      Math.random() * Math.PI * 2,
      randFloat(-5, 5),
      true,
      16
    ));
  }
}
