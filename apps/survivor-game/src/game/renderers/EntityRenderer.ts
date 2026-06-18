import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, Projectile, XPGem } from '../types';
import { WeaponType, EnemyType } from '../types';
import { COLORS, ENEMY_DATA } from '../constants';
import { getSkinById } from '../systems/meta/MetaProgression';

// ──────────────────────────── Helpers ────────────────────────────

export function drawHPBar(rc: RenderContext, x: number, y: number, width: number, hp: number, maxHp: number, height: number) {
  const { ctx } = rc;
  const barW = width;
  const barH = height;
  const ratio = Math.max(0, hp / maxHp);
  const radius = barH / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.moveTo(x - barW / 2 + radius, y);
  ctx.lineTo(x + barW / 2 - radius, y);
  ctx.quadraticCurveTo(x + barW / 2, y, x + barW / 2, y + radius);
  ctx.lineTo(x + barW / 2, y + barH - radius);
  ctx.quadraticCurveTo(x + barW / 2, y + barH, x + barW / 2 - radius, y + barH);
  ctx.lineTo(x - barW / 2 + radius, y + barH);
  ctx.quadraticCurveTo(x - barW / 2, y + barH, x - barW / 2, y + barH - radius);
  ctx.lineTo(x - barW / 2, y + radius);
  ctx.quadraticCurveTo(x - barW / 2, y, x - barW / 2 + radius, y);
  ctx.closePath();
  ctx.fill();

  const color = ratio > 0.5 ? COLORS.hpBar : ratio > 0.25 ? COLORS.warning : COLORS.danger;
  if (ratio > 0) {
    const fillW = barW * ratio;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - barW / 2 + radius, y);
    ctx.lineTo(x - barW / 2 + fillW - radius, y);
    ctx.quadraticCurveTo(x - barW / 2 + fillW, y, x - barW / 2 + fillW, y + radius);
    ctx.lineTo(x - barW / 2 + fillW, y + barH - radius);
    ctx.quadraticCurveTo(x - barW / 2 + fillW, y + barH, x - barW / 2 + fillW - radius, y + barH);
    ctx.lineTo(x - barW / 2 + radius, y + barH);
    ctx.quadraticCurveTo(x - barW / 2, y + barH, x - barW / 2, y + barH - radius);
    ctx.lineTo(x - barW / 2, y + radius);
    ctx.quadraticCurveTo(x - barW / 2, y, x - barW / 2 + radius, y);
    ctx.closePath();
    ctx.fill();

    const shineGrad = ctx.createLinearGradient(x - barW / 2, y, x - barW / 2, y + barH);
    shineGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    shineGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = shineGrad;
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - barW / 2 + radius, y);
  ctx.lineTo(x + barW / 2 - radius, y);
  ctx.quadraticCurveTo(x + barW / 2, y, x + barW / 2, y + radius);
  ctx.lineTo(x + barW / 2, y + barH - radius);
  ctx.quadraticCurveTo(x + barW / 2, y + barH, x + barW / 2 - radius, y + barH);
  ctx.lineTo(x - barW / 2 + radius, y + barH);
  ctx.quadraticCurveTo(x - barW / 2, y + barH, x - barW / 2, y + barH - radius);
  ctx.lineTo(x - barW / 2, y + radius);
  ctx.quadraticCurveTo(x - barW / 2, y, x - barW / 2 + radius, y);
  ctx.closePath();
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
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

// ──────────────────────────── XP Gem ────────────────────────────

export function drawXPGem(rc: RenderContext, gem: XPGem) {
  const { ctx } = rc;
  const pulse = 1 + Math.sin(gem.animTimer) * 0.15;
  const r = gem.radius * pulse;
  let color: string;
  let glowColor: string;
  switch (gem.type) {
    case 'small': color = COLORS.gemSmall; glowColor = 'rgba(68,221,255,'; break;
    case 'medium': color = COLORS.gemMedium; glowColor = 'rgba(68,255,136,'; break;
    case 'large': color = COLORS.gemLarge; glowColor = 'rgba(255,221,68,'; break;
  }

  const outerGlow = ctx.createRadialGradient(gem.x, gem.y, 0, gem.x, gem.y, r * 3);
  outerGlow.addColorStop(0, glowColor + '0.25)');
  outerGlow.addColorStop(0.5, glowColor + '0.1)');
  outerGlow.addColorStop(1, glowColor + '0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(gem.x, gem.y, r * 3, 0, Math.PI * 2);
  ctx.fill();

  const innerGlow = ctx.createRadialGradient(gem.x, gem.y, 0, gem.x, gem.y, r * 1.5);
  innerGlow.addColorStop(0, color + '60');
  innerGlow.addColorStop(1, color + '00');
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(gem.x, gem.y, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - r);
  ctx.lineTo(gem.x + r * 0.7, gem.y);
  ctx.lineTo(gem.x, gem.y + r);
  ctx.lineTo(gem.x - r * 0.7, gem.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - r);
  ctx.lineTo(gem.x + r * 0.7, gem.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - r);
  ctx.lineTo(gem.x - r * 0.7, gem.y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - r * 0.6);
  ctx.lineTo(gem.x + r * 0.3, gem.y);
  ctx.lineTo(gem.x, gem.y + r * 0.3);
  ctx.lineTo(gem.x - r * 0.3, gem.y - r * 0.2);
  ctx.closePath();
  ctx.fill();

  if (gem.type === 'large') {
    const sparklePhase = gem.animTimer * 3;
    for (let i = 0; i < 4; i++) {
      const angle = sparklePhase + (i / 4) * Math.PI * 2;
      const dist = r * 1.2 + Math.sin(gem.animTimer * 2 + i) * 2;
      const sx = gem.x + Math.cos(angle) * dist;
      const sy = gem.y + Math.sin(angle) * dist;
      const sparkleSize = 1.5 + Math.sin(gem.animTimer * 4 + i * 2) * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ──────────────────────────── Player ────────────────────────────

export function drawPlayer(rc: RenderContext, p: Player) {
  const { ctx } = rc;
  const blink = p.invTime > 0 && Math.sin(p.invTime * 20) > 0;
  if (blink) return;

  const bob = Math.sin(p.animTimer) * 2;
  const isMoving = Math.abs(p.animTimer) > 0.1;
  const skin = getSkinById(p.skinId);
  const bodyColor = skin?.body ?? COLORS.playerBody;
  const outlineColor = skin?.outline ?? COLORS.playerOutline;
  const glowColor = skin?.glow ?? 'rgba(74,158,255,';

  const glowSize = isMoving ? p.radius * 3 : p.radius * 2.5;
  const gradient = ctx.createRadialGradient(p.x, p.y + bob, 0, p.x, p.y + bob, glowSize);
  gradient.addColorStop(0, `${glowColor}0.22)`);
  gradient.addColorStop(0.5, `${glowColor}0.1)`);
  gradient.addColorStop(1, `${glowColor}0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, glowSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.radius + 4, p.radius * 0.8, p.radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  const skinId = skin?.id ?? 'wanderer';
  if (skinId === 'ember') {
    drawEmberPlayer(ctx, p, bob, bodyColor, outlineColor);
  } else if (skinId === 'oracle') {
    drawOraclePlayer(ctx, p, bob, bodyColor, outlineColor);
  } else {
    drawWandererPlayer(ctx, p, bob, isMoving, bodyColor, outlineColor);
  }

  drawHPBar(rc, p.x, p.y - p.radius - 14, p.radius * 2.5, p.hp, p.maxHp, 5);
}

function drawWandererPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  bob: number,
  isMoving: boolean,
  bodyColor: string,
  outlineColor: string
) {
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, p.radius, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(
    p.x - p.radius * 0.3, p.y + bob - p.radius * 0.3, 0,
    p.x, p.y + bob, p.radius
  );
  bodyGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
  bodyGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, p.radius, 0, Math.PI * 2);
  ctx.stroke();

  const eyeDir = p.facingLeft ? -1 : 1;
  const eyeY = p.y + bob - 3;
  const pupilOffset = isMoving ? eyeDir * 1.5 : 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(p.x + eyeDir * 4, eyeY, 4, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x + eyeDir * 10, eyeY, 4, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(p.x + eyeDir * 4 + pupilOffset, eyeY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x + eyeDir * 10 + pupilOffset, eyeY, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEmberPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  bob: number,
  bodyColor: string,
  outlineColor: string
) {
  const x = p.x;
  const y = p.y + bob;
  const r = p.radius;
  ctx.fillStyle = 'rgba(255,100,35,0.18)';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.0);
  ctx.lineTo(x + r * 0.8, y - r * 0.6);
  ctx.lineTo(x + r * 1.5, y + r * 0.6);
  ctx.lineTo(x, y + r * 1.55);
  ctx.lineTo(x - r * 1.5, y + r * 0.6);
  ctx.lineTo(x - r * 0.8, y - r * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.45);
  ctx.lineTo(x + r * 1.45, y);
  ctx.lineTo(x, y + r * 1.5);
  ctx.lineTo(x - r * 1.45, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff2b0';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(65,20,0,0.7)';
  ctx.fillRect(x - r * 0.5, y + r * 0.62, r, 3);
}

function drawOraclePlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  bob: number,
  bodyColor: string,
  outlineColor: string
) {
  const x = p.x;
  const y = p.y + bob;
  const r = p.radius;
  ctx.strokeStyle = 'rgba(215,204,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 1.75, r * 1.5, r * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(28,20,70,0.86)';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.35);
  ctx.quadraticCurveTo(x + r * 1.65, y - r * 0.25, x + r * 1.25, y + r * 1.45);
  ctx.lineTo(x - r * 1.25, y + r * 1.45);
  ctx.quadraticCurveTo(x - r * 1.65, y - r * 0.25, x, y - r * 1.35);
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.12);
  ctx.lineTo(x + r * 1.02, y + r * 0.82);
  ctx.lineTo(x, y + r * 1.42);
  ctx.lineTo(x - r * 1.02, y + r * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#302060';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r * 0.23, 0, Math.PI * 2);
  ctx.fill();
}

// ──────────────────────────── Enemy ────────────────────────────

export function drawEnemy(rc: RenderContext, e: Enemy) {
  const { ctx } = rc;
  const data = ENEMY_DATA[e.type];
  const color = e.hitFlash > 0 ? '#ffffff' : data.color;
  const bob = Math.sin(e.animTimer) * 1.5;
  const wobble = Math.sin(e.animTimer * 2) * 0.1;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.radius + 3, e.radius * 0.9, e.radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();

  switch (e.type) {
    case EnemyType.ZOMBIE:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.rotate(wobble);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.arc(-2, -2, e.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-e.radius, 0);
      ctx.lineTo(-e.radius - 10, 8 + Math.sin(e.animTimer * 2) * 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(e.radius + 10, 8 - Math.sin(e.animTimer * 2) * 5);
      ctx.stroke();
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(-4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;

    case EnemyType.BAT:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      const wingY = Math.sin(e.animTimer * 8) * 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-e.radius * 1.5, -e.radius + wingY, -e.radius * 2.2, -e.radius * 0.5 + wingY);
      ctx.quadraticCurveTo(-e.radius * 1.5, e.radius * 0.3, 0, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(e.radius * 1.5, -e.radius + wingY, e.radius * 2.2, -e.radius * 0.5 + wingY);
      ctx.quadraticCurveTo(e.radius * 1.5, e.radius * 0.3, 0, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * 0.7, e.radius, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(-3, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;

    case EnemyType.SKELETON:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -2, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 4, e.radius * 0.7, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(-4, -3, 3, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4, -3, 3, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(1, 0);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      for (let i = -3; i <= 3; i++) ctx.fillRect(i * 2 - 0.5, 3, 1.5, 3);
      ctx.restore();
      break;

    case EnemyType.GHOST:
      ctx.save();
      ctx.translate(e.x, e.y + bob - 5);
      ctx.globalAlpha = 0.7 + Math.sin(e.animTimer * 2) * 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-e.radius, e.radius * 0.3);
      for (let i = 0; i <= 6; i++) {
        const px = -e.radius + (i / 6) * e.radius * 2;
        const py = e.radius * 0.3 + Math.sin(e.animTimer * 3 + i * 1.2) * 6;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#88aaff';
      ctx.beginPath();
      ctx.arc(-4, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;

    case EnemyType.MUMMY:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c4a882';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-e.radius, i * 4);
        ctx.quadraticCurveTo(0, i * 4 + Math.sin(e.animTimer + i) * 3, e.radius, i * 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(-4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;

    case EnemyType.DEMON:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b0000';
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.6, -e.radius);
      ctx.lineTo(-e.radius * 0.3, -e.radius * 2);
      ctx.lineTo(0, -e.radius);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.6, -e.radius);
      ctx.lineTo(e.radius * 0.3, -e.radius * 2);
      ctx.lineTo(0, -e.radius);
      ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#8b0000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 2, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.restore();
      break;

    case EnemyType.WRAITH:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.globalAlpha = 0.8;
      const wraithGrad = ctx.createRadialGradient(0, 0, e.radius, 0, 0, e.radius * 2);
      wraithGrad.addColorStop(0, 'rgba(74,14,78,0.4)');
      wraithGrad.addColorStop(1, 'rgba(74,14,78,0)');
      ctx.fillStyle = wraithGrad;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a0a2e';
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI * 0.7 + (i / 4) * Math.PI * 1.4;
        const hx = Math.cos(angle) * e.radius * 0.9;
        const hy = Math.sin(angle) * e.radius * 0.9 - 5;
        ctx.beginPath();
        ctx.moveTo(hx - 3, hy);
        ctx.lineTo(hx, hy - 10 - Math.sin(e.animTimer + i) * 2);
        ctx.lineTo(hx + 3, hy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ff00ff';
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-5, -3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, -3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.restore();
      break;

    default:
      ctx.arc(e.x, e.y + bob, e.radius, 0, Math.PI * 2);
      ctx.fill();
  }

  // Elite effects
  if (e.isElite) {
    const pulse = 0.8 + Math.sin(e.animTimer * 3) * 0.2;
    const glowR = e.radius * (2.8 + pulse * 0.5);
    const eliteGrad = ctx.createRadialGradient(e.x, e.y, e.radius * 0.5, e.x, e.y, glowR);
    eliteGrad.addColorStop(0, `rgba(255,215,0,${0.35 * pulse})`);
    eliteGrad.addColorStop(0.4, `rgba(255,180,0,${0.2 * pulse})`);
    eliteGrad.addColorStop(1, 'rgba(255,150,0,0)');
    ctx.fillStyle = eliteGrad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, glowR, 0, Math.PI * 2);
    ctx.fill();
    const ringR = e.radius * 1.8;
    ctx.strokeStyle = `rgba(255,215,0,${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -e.animTimer * 30;
    ctx.beginPath();
    ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,200,0,${0.12 * pulse})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y + bob, e.radius * 1.05, 0, Math.PI * 2);
    ctx.fill();
    const crownY = e.y - e.radius - 10;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(e.x - 10, crownY);
    ctx.lineTo(e.x - 7, crownY - 8);
    ctx.lineTo(e.x - 3, crownY - 2);
    ctx.lineTo(e.x, crownY - 12);
    ctx.lineTo(e.x + 3, crownY - 2);
    ctx.lineTo(e.x + 7, crownY - 8);
    ctx.lineTo(e.x + 10, crownY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  if (e.hp < e.maxHp) {
    const hpBarY = e.isElite ? e.y - e.radius - 28 : e.y - e.radius - 12;
    drawHPBar(rc, e.x, hpBarY, e.radius * 2.5, e.hp, e.maxHp, 4);
  }
}

// ──────────────────────────── Projectile ────────────────────────────

/** 基于种子的伪随机（确定性） */
function seededRandom(seed: number): number {
  let s = seed | 0;
  s = ((s * 1103515245 + 12345) & 0x7fffffff);
  return (s >>> 0) / 0x7fffffff;
}

export function drawProjectile(rc: RenderContext, p: Projectile) {
  const { ctx } = rc;
  if (p.radius <= 0 || p.maxLife <= 0 || p.life <= 0) return;
  const lifeRatio = Math.max(0, Math.min(1, p.life / p.maxLife));
  const alpha = Math.min(1, lifeRatio / 0.3);

  switch (p.type) {
    case WeaponType.MAGIC_WAND:
      ctx.fillStyle = `rgba(100,180,255,${alpha * 0.2})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(100,180,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(200,230,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(100,180,255,${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case WeaponType.FIRE_WAND:
      ctx.fillStyle = `rgba(255,80,0,${alpha * 0.25})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,120,0,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,200,0,${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,200,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const angle = p.animTimer * 5 + i * 2.1;
        const dist = p.radius * 0.8;
        ctx.fillStyle = `rgba(255,150,0,${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case WeaponType.AXE:
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.animTimer * 3);
      ctx.fillStyle = `rgba(139,90,43,${alpha})`;
      ctx.fillRect(-p.radius * 0.15, -p.radius * 0.8, p.radius * 0.3, p.radius * 1.6);
      ctx.fillStyle = `rgba(192,192,192,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p.radius * 0.15, -p.radius * 0.6);
      ctx.quadraticCurveTo(p.radius * 0.8, -p.radius * 0.3, p.radius * 0.6, 0);
      ctx.quadraticCurveTo(p.radius * 0.8, p.radius * 0.3, p.radius * 0.15, p.radius * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.radius * 0.2, -p.radius * 0.5);
      ctx.quadraticCurveTo(p.radius * 0.7, -p.radius * 0.2, p.radius * 0.5, 0);
      ctx.stroke();
      ctx.restore();
      break;

    case WeaponType.LIGHTNING: {
      const progress = 1 - lifeRatio;
      const seed = p.lightningSeed ?? 42;
      ctx.fillStyle = `rgba(255,255,100,${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,100,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const segments = 10;
      ctx.moveTo(p.x, p.y - 400);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        if (t > progress * 2) break;
        const jitter = (seededRandom(seed + i * 7) - 0.5) * 20;
        ctx.lineTo(p.x + jitter, p.y - 400 + t * 400);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 400);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        if (t > progress * 2) break;
        const jitter = (seededRandom(seed + i * 13) - 0.5) * 8;
        ctx.lineTo(p.x + jitter, p.y - 400 + t * 400);
      }
      ctx.stroke();
      if (progress > 0.5) {
        const flashAlpha = (1 - progress) * 0.8;
        ctx.fillStyle = `rgba(255,255,200,${flashAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 + progress * 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,100,${flashAlpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (2 + progress * 3), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case WeaponType.WHIP: {
      const swingDir = p.vx >= 0 ? 1 : -1;
      const isSecondHalf = lifeRatio < 0.5;
      const segCount = Math.max(1, p.count ?? 1);
      const whipLen = p.radius;
      const scale = p.segScale ?? 1;
      const originX = p.x - swingDir * 12;
      const originY = p.y + 4;
      const swingPhase = isSecondHalf ? lifeRatio * 2 : (1 - lifeRatio) * 2;
      const arcH = whipLen * 0.2 * scale;
      const controlPts: { x: number; y: number }[] = [{ x: originX, y: originY }];
      for (let i = 1; i <= segCount; i++) {
        const t = i / segCount;
        const d = swingDir;
        const waveDelay = t * 0.45;
        const localPhase = Math.max(0, Math.min(1, (swingPhase - waveDelay) / 0.55));
        const reach = t * whipLen * (0.2 + localPhase * 0.8);
        const archArc = Math.sin(t * Math.PI * 0.75) * (1 - t * 0.3);
        const tipCurl = t > 0.7 ? Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.35 : 0;
        const arcHeight = -(arcH * archArc + whipLen * tipCurl) * localPhase;
        const dirSign = isSecondHalf ? -d : d;
        controlPts.push({ x: originX + dirSign * reach, y: originY + arcHeight });
      }
      const knots: { x: number; y: number }[] = [{ x: originX, y: originY }];
      const resolution = Math.max(6, Math.floor(200 / segCount));
      for (let s = 0; s < segCount; s++) {
        const p0 = controlPts[s];
        const p3 = controlPts[s + 1];
        const cpx = (p0.x + p3.x) / 2;
        const cpy = (p0.y + p3.y) / 2 - 8;
        for (let j = 1; j <= resolution; j++) {
          const tt = j / resolution;
          const mt = 1 - tt;
          knots.push({
            x: mt * mt * mt * p0.x + 3 * mt * mt * tt * cpx + 3 * mt * tt * tt * cpx + tt * tt * tt * p3.x,
            y: mt * mt * mt * p0.y + 3 * mt * mt * tt * cpy + 3 * mt * tt * tt * cpy + tt * tt * tt * p3.y,
          });
        }
      }
      function drawSmoothCrv(pts: { x: number; y: number }[]) {
        if (pts.length < 2) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      // Motion trails
      for (let trail = 3; trail >= 1; trail--) {
        const ta = alpha * 0.15 * trail;
        const dx = trail * swingDir * (isSecondHalf ? -1 : 1) * 8;
        const dy = -trail * 3;
        ctx.strokeStyle = `rgba(255,180,80,${ta})`;
        ctx.lineWidth = 14 - trail * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(knots[0].x + dx * 0.3, knots[0].y + dy * 0.3);
        for (let i = 1; i < knots.length; i++) {
          const ratio = i / knots.length;
          ctx.lineTo(knots[i].x + dx * ratio, knots[i].y + dy * ratio);
        }
        ctx.stroke();
      }
      // Outer glow
      ctx.strokeStyle = `rgba(255,120,20,${alpha * 0.4})`;
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      drawSmoothCrv(knots);
      ctx.stroke();
      // Warm body
      ctx.strokeStyle = `rgba(230,140,40,${alpha * 0.9})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      drawSmoothCrv(knots);
      ctx.stroke();
      // Bright core
      ctx.strokeStyle = `rgba(255,225,130,${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      drawSmoothCrv(knots);
      ctx.stroke();
      // Knot joints
      const jointStep = Math.max(1, Math.floor(knots.length / segCount));
      for (let i = jointStep; i < knots.length - 1; i += jointStep) {
        const k = knots[i];
        const t = i / knots.length;
        const ja = alpha * (0.5 + t * 0.5);
        const jr = 2.5 + t * 3;
        ctx.fillStyle = `rgba(120,70,20,${ja})`;
        ctx.beginPath();
        ctx.arc(k.x, k.y, jr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,210,100,${ja * 0.7})`;
        ctx.beginPath();
        ctx.arc(k.x, k.y, jr * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      // Energy particles
      for (let i = 1; i < knots.length; i += 2) {
        const t = i / knots.length;
        const sparkleA = alpha * t * 0.8;
        const sparkleR = 1 + t * 3;
        const flicker = 0.7 + Math.sin(p.animTimer * 8 + i * 0.5) * 0.3;
        ctx.fillStyle = `rgba(255,240,180,${sparkleA * flicker})`;
        ctx.beginPath();
        ctx.arc(knots[i].x, knots[i].y, sparkleR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tip glow & impact
      const tip = knots[knots.length - 1];
      const glowI = Math.max(0, Math.min(1, swingPhase * 1.5));
      const tipGlowR = 16 + glowI * whipLen * 0.08;
      const tipGrad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tipGlowR);
      tipGrad.addColorStop(0, `rgba(255,230,120,${alpha * glowI * 0.75})`);
      tipGrad.addColorStop(0.3, `rgba(255,140,30,${alpha * glowI * 0.35})`);
      tipGrad.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, tipGlowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${alpha * glowI})`;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3 + glowI * 5, 0, Math.PI * 2);
      ctx.fill();
      if (glowI > 0.6) {
        const burstA = (glowI - 0.6) / 0.4 * alpha;
        const burstR = 8 + whipLen * 0.06;
        ctx.strokeStyle = `rgba(255,200,80,${burstA * 0.6})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + p.animTimer * 0.5;
          ctx.beginPath();
          ctx.moveTo(tip.x + Math.cos(a) * burstR * 0.3, tip.y + Math.sin(a) * burstR * 0.3);
          ctx.lineTo(tip.x + Math.cos(a) * burstR, tip.y + Math.sin(a) * burstR);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255,255,180,${burstA * 0.45})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, burstR * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Handle knot
      ctx.fillStyle = `rgba(160,100,40,${alpha})`;
      ctx.beginPath();
      ctx.arc(originX, originY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(230,180,80,${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(originX, originY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case WeaponType.BIBLE:
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.animTimer);
      const bibleGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      bibleGlow.addColorStop(0, `rgba(255,255,200,${alpha * 0.3})`);
      bibleGlow.addColorStop(1, `rgba(255,255,200,0)`);
      ctx.fillStyle = bibleGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,200,${alpha})`;
      ctx.fillRect(-12, -16, 24, 32);
      ctx.strokeStyle = `rgba(200,150,50,${alpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -16, 24, 32);
      ctx.strokeStyle = `rgba(180,120,30,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, -16);
      ctx.lineTo(-12, 16);
      ctx.stroke();
      ctx.strokeStyle = `rgba(180,100,30,${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.moveTo(-6, -2);
      ctx.lineTo(6, -2);
      ctx.stroke();
      const sparklePhase = p.animTimer * 2;
      for (let i = 0; i < 4; i++) {
        const angle = sparklePhase + i * 1.57;
        const dist = 15 + Math.sin(p.animTimer * 3 + i) * 3;
        ctx.fillStyle = `rgba(255,255,200,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;

    case WeaponType.HOLY_WATER: {
      const progress = 1 - lifeRatio;
      ctx.fillStyle = `rgba(100,150,255,${alpha * (1 - progress * 0.5)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (0.5 + progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(150,200,255,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(100,180,255,${alpha * 0.4})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const r = p.radius * (0.3 + ((progress + i * 0.15) % 1) * 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (progress < 0.3) {
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + p.animTimer;
          const dist = p.radius * (0.5 + progress * 2);
          ctx.fillStyle = `rgba(150,200,255,${alpha * (1 - progress * 3)})`;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case WeaponType.GARLIC:
      break;
  }
}

// ──────────────────────────── Garlic Aura ────────────────────────────

export function drawGarlicAura(rc: RenderContext, player: Player, radius: number) {
  const { ctx } = rc;
  const time = Date.now() * 0.001;
  const pulse = 0.15 + Math.sin(time * 3) * 0.05;

  const outerGrad = ctx.createRadialGradient(player.x, player.y, radius * 0.2, player.x, player.y, radius * 1.2);
  outerGrad.addColorStop(0, `rgba(200,200,100,${pulse * 0.5})`);
  outerGrad.addColorStop(0.5, `rgba(180,180,80,${pulse * 0.3})`);
  outerGrad.addColorStop(1, 'rgba(160,160,60,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius * 1.2, 0, Math.PI * 2);
  ctx.fill();

  const mainGrad = ctx.createRadialGradient(player.x, player.y, radius * 0.3, player.x, player.y, radius);
  mainGrad.addColorStop(0, `rgba(200,200,100,${pulse})`);
  mainGrad.addColorStop(0.7, `rgba(180,180,80,${pulse * 0.5})`);
  mainGrad.addColorStop(1, 'rgba(160,160,60,0)');
  ctx.fillStyle = mainGrad;
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(220,220,120,${pulse * 1.5})`;
  for (let i = 0; i < 8; i++) {
    const angle = time * 0.5 + (i / 8) * Math.PI * 2;
    const dist = radius * 0.7 + Math.sin(time * 2 + i) * 10;
    const size = 2 + Math.sin(time * 3 + i * 2) * 1;
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ──────────────────────────── Pickup Range ────────────────────────────

export function drawPickupRange(rc: RenderContext, player: Player) {
  const { ctx } = rc;
  const time = Date.now() * 0.001;

  ctx.strokeStyle = 'rgba(100,200,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.pickupRange, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const glowAlpha = 0.03 + Math.sin(time * 2) * 0.01;
  const glowGrad = ctx.createRadialGradient(player.x, player.y, player.pickupRange * 0.8, player.x, player.y, player.pickupRange);
  glowGrad.addColorStop(0, 'rgba(100,200,255,0)');
  glowGrad.addColorStop(1, `rgba(100,200,255,${glowAlpha})`);
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.pickupRange, 0, Math.PI * 2);
  ctx.fill();
}
