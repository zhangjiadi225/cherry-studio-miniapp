import type { RenderContext } from './WorldRenderer';
import type { Particle, DamageNumber } from '../types';
import { MAX_PARTICLE_RENDER_COST } from '../constants';

// ──────────────────────────── Particle ────────────────────────────

export type ParticleRenderQuality = 'full' | 'reduced' | 'minimal';

const GLOW_CACHE_LIMIT = 96;
const GLOW_SPRITE_SCALE = 2;
const glowSpriteCache = new Map<string, HTMLCanvasElement>();

export function estimateParticleRenderCost(p: Particle): number {
  let cost = 1;
  if (p.glow && (p.glowRadius ?? 0) >= 8 && p.alpha > 0.22) cost += 2;
  if (p.type === 'beam') cost += 7;
  else if (p.type === 'crescent') cost += 5;
  else if (p.type === 'star' || p.type === 'spark') cost += 1;
  return cost;
}

export function selectParticleRenderQuality(totalCost: number): ParticleRenderQuality {
  if (totalCost <= MAX_PARTICLE_RENDER_COST) return 'full';
  if (totalCost <= MAX_PARTICLE_RENDER_COST * 2) return 'reduced';
  return 'minimal';
}

export function getGlowSpriteCacheSize(): number {
  return glowSpriteCache.size;
}

export function drawParticle(
  rc: RenderContext,
  p: Particle,
  quality: ParticleRenderQuality = 'full'
) {
  const { ctx } = rc;
  ctx.globalAlpha = p.alpha;

  const glowRadius = Math.min(p.glowRadius ?? 0, 24);
  if (
    quality !== 'minimal' &&
    p.glow &&
    glowRadius >= 8 &&
    p.alpha > (quality === 'full' ? 0.22 : 0.5)
  ) {
    drawCachedGlow(ctx, p.x, p.y, glowRadius, p.glowColor || p.color);
  }

  ctx.fillStyle = p.color;

  const type = p.type || 'circle';
  const r = p.radius * p.alpha;

  switch (type) {
    case 'beam':
      drawBeamParticle(ctx, p, quality);
      break;

    case 'crescent':
      drawCrescentParticle(ctx, p, r, quality);
      break;

    case 'circle':
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'square':
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      break;

    case 'star':
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);
      drawStarShape(ctx, 0, 0, 5, r, r * 0.5);
      ctx.restore();
      break;

    case 'spark':
      drawSparkParticle(ctx, p, r);
      break;
  }

  ctx.globalAlpha = 1;
}

function drawCachedGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  const cachedRadius = Math.max(8, Math.round(radius / 2) * 2);
  const key = `${color}:${cachedRadius}`;
  let sprite = glowSpriteCache.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    const logicalSize = cachedRadius * 2;
    sprite.width = logicalSize * GLOW_SPRITE_SCALE;
    sprite.height = logicalSize * GLOW_SPRITE_SCALE;
    const spriteContext = sprite.getContext('2d');
    if (!spriteContext) return;
    spriteContext.scale(GLOW_SPRITE_SCALE, GLOW_SPRITE_SCALE);
    const gradient = spriteContext.createRadialGradient(
      cachedRadius,
      cachedRadius,
      0,
      cachedRadius,
      cachedRadius,
      cachedRadius
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(0, 0, logicalSize, logicalSize);
    if (glowSpriteCache.size >= GLOW_CACHE_LIMIT) {
      const oldestKey = glowSpriteCache.keys().next().value;
      if (oldestKey !== undefined) glowSpriteCache.delete(oldestKey);
    }
    glowSpriteCache.set(key, sprite);
  }
  const diameter = cachedRadius * 2;
  ctx.drawImage(sprite, x - cachedRadius, y - cachedRadius, diameter, diameter);
}

function drawSparkParticle(ctx: CanvasRenderingContext2D, p: Particle, r: number): void {
  const angle = p.rotation ? Math.atan2(p.vy, p.vx) : 0;
  const dx = Math.cos(angle) * r * 1.5;
  const dy = Math.sin(angle) * r * 1.5;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = Math.max(0.5, r * 0.6);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x - dx, p.y - dy);
  ctx.lineTo(p.x + dx, p.y + dy);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawBeamParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  quality: ParticleRenderQuality
) {
  const endX = p.endX ?? p.x;
  const endY = p.endY ?? p.y;
  const dx = endX - p.x;
  const dy = endY - p.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const seed = p.rotation ?? 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const firstPass = quality === 'full' ? 0 : quality === 'reduced' ? 1 : 2;
  const segmentCount = quality === 'full' ? 6 : quality === 'reduced' ? 4 : 2;
  for (let pass = firstPass; pass < 3; pass++) {
    ctx.strokeStyle = pass === 0
      ? `rgba(62,178,255,${p.alpha * 0.22})`
      : pass === 1
        ? `rgba(125,232,255,${p.alpha * 0.7})`
        : `rgba(245,255,255,${p.alpha * 0.92})`;
    ctx.lineWidth = pass === 0 ? 8 : pass === 1 ? 3.2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (let i = 1; i < segmentCount; i++) {
      const t = i / segmentCount;
      const jitter = Math.sin(seed * 7.13 + i * 2.41 + pass) * (7 - pass * 2.2);
      ctx.lineTo(p.x + dx * t + nx * jitter, p.y + dy * t + ny * jitter);
    }
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrescentParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  r: number,
  quality: ParticleRenderQuality
) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation ?? 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(146,93,255,${p.alpha * 0.26})`;
  ctx.lineWidth = Math.max(8, r * 0.38);
  ctx.beginPath();
  ctx.arc(0, 0, r, -0.9, 0.9);
  ctx.stroke();
  if (quality !== 'minimal') {
    ctx.strokeStyle = `rgba(230,210,255,${p.alpha * 0.82})`;
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, -0.78, 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

// ──────────────────────────── Damage Number ────────────────────────────

export function drawDamageNumber(rc: RenderContext, d: DamageNumber) {
  const { ctx } = rc;
  const alpha = Math.min(1, d.life / (d.maxLife * 0.3));
  const scale = 1 + (1 - alpha) * 0.3;

  ctx.globalAlpha = alpha;
  ctx.font = `bold ${d.size * scale}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (d.size >= 18) {
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 8;
  }

  ctx.fillStyle = '#000000';
  ctx.fillText(d.label, d.x + 1, d.y + 2);

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeText(d.label, d.x, d.y);

  ctx.fillStyle = d.color;
  ctx.fillText(d.label, d.x, d.y);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ──────────────────────────── Screen Effects ────────────────────────────

export function drawDamageFlash(rc: RenderContext, alpha: number) {
  if (alpha <= 0) return;
  const { ctx, w, h } = rc;

  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
  grad.addColorStop(0, 'rgba(255,0,0,0)');
  grad.addColorStop(0.5, `rgba(255,0,0,${alpha * 0.1})`);
  grad.addColorStop(1, `rgba(255,0,0,${alpha * 0.4})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = `rgba(255,0,0,${alpha * 0.6})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);
}

export function drawLevelUpFlash(rc: RenderContext, alpha: number) {
  if (alpha <= 0) return;
  const { ctx, w, h } = rc;

  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.6);
  grad.addColorStop(0, `rgba(255,215,0,${alpha * 0.2})`);
  grad.addColorStop(0.5, `rgba(255,215,0,${alpha * 0.1})`);
  grad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const time = Date.now() * 0.001;
  ctx.fillStyle = `rgba(255,255,200,${alpha * 0.5})`;
  for (let i = 0; i < 12; i++) {
    const angle = time * 2 + (i / 12) * Math.PI * 2;
    const dist = 100 + Math.sin(time * 3 + i) * 30;
    const size = 2 + Math.sin(time * 5 + i * 2) * 1;
    ctx.beginPath();
    ctx.arc(w / 2 + Math.cos(angle) * dist, h / 2 + Math.sin(angle) * dist, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBossWarning(rc: RenderContext, name: string, timer: number) {
  const { ctx, w, h } = rc;
  const alpha = Math.min(1, timer) * (0.5 + Math.sin(Date.now() * 0.01) * 0.3);
  const time = Date.now() * 0.001;

  const borderGrad = ctx.createLinearGradient(0, 0, w, 0);
  borderGrad.addColorStop(0, `rgba(255,0,0,${alpha * 0.6})`);
  borderGrad.addColorStop(0.5, `rgba(255,0,0,${alpha * 0.2})`);
  borderGrad.addColorStop(1, `rgba(255,0,0,${alpha * 0.6})`);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = `rgba(255,50,50,${alpha * 0.3})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  const pulse = 1 + Math.sin(time * 5) * 0.05;
  ctx.save();
  ctx.translate(w / 2, h / 2 - 220);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 25;
  ctx.font = 'bold 42px "Segoe UI", sans-serif';
  ctx.fillStyle = `rgba(255,80,80,${alpha})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`⚠️ ${name} 即将出现! ⚠️`, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillStyle = `rgba(255,200,200,${alpha * 0.9})`;
  ctx.textAlign = 'center';
  ctx.fillText('做好准备!', w / 2, h / 2 - 170);

  ctx.font = '30px serif';
  for (let i = 0; i < 6; i++) {
    const angle = time * 0.8 + (i / 6) * Math.PI * 2;
    const dist = 150 + Math.sin(time * 2 + i) * 20;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillText('💀', w / 2 + Math.cos(angle) * dist, h / 2 - 220 + Math.sin(angle) * 50);
  }
  ctx.globalAlpha = 1;
}
