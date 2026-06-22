import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, Projectile, XPGem, EnemyProjectile, WeaponDisplayMode, WeaponEvolutionId } from '../types';
import { WeaponType, EnemyType } from '../types';
import { COLORS, ENEMY_DATA, WEAPON_DATA } from '../constants';
import { getSkinById } from '../systems/meta/MetaProgression';
import { getWeaponEvolutionIds } from '../data/weaponEvolutions';
import { spriteRegistry } from './SpriteRegistry';
import { weaponSpriteRegistry } from './WeaponSpriteRegistry';

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

function drawSmallXPGemFast(ctx: CanvasRenderingContext2D, gem: XPGem) {
  const pulse = 1 + Math.sin(gem.animTimer * 1.4) * 0.08;
  const r = gem.radius * pulse;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(gem.x, gem.y + r * 1.2, r * 0.72, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.gemSmall;
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - r * 1.22);
  ctx.lineTo(gem.x + r * 0.78, gem.y - r * 0.12);
  ctx.lineTo(gem.x + r * 0.45, gem.y + r * 1.02);
  ctx.lineTo(gem.x, gem.y + r * 1.34);
  ctx.lineTo(gem.x - r * 0.45, gem.y + r * 1.02);
  ctx.lineTo(gem.x - r * 0.78, gem.y - r * 0.12);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#60efff';
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(gem.x - r * 0.22, gem.y - r * 0.45, r * 0.13, r * 0.24, -0.65, 0, Math.PI * 2);
  ctx.fill();
}

export function drawXPGem(rc: RenderContext, gem: XPGem) {
  const { ctx } = rc;
  if (gem.type === 'small') {
    drawSmallXPGemFast(ctx, gem);
    return;
  }

  const pulse = 1 + Math.sin(gem.animTimer * 1.4) * 0.12;
  const r = gem.radius * pulse;
  let color = COLORS.gemMedium;
  let core = '#e4ffe9';
  let rim = '#69ff9d';
  let glowColor = 'rgba(68,255,136,';
  switch (gem.type) {
    case 'medium':
      color = COLORS.gemMedium;
      core = '#e4ffe9';
      rim = '#69ff9d';
      glowColor = 'rgba(68,255,136,';
      break;
    case 'large':
      color = COLORS.gemLarge;
      core = '#fff6b8';
      rim = '#ffd166';
      glowColor = 'rgba(255,221,68,';
      break;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const outerGlow = ctx.createRadialGradient(gem.x, gem.y, 0, gem.x, gem.y, r * 4.1);
  outerGlow.addColorStop(0, glowColor + '0.38)');
  outerGlow.addColorStop(0.42, glowColor + '0.14)');
  outerGlow.addColorStop(1, glowColor + '0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(gem.x, gem.y, r * 4.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(gem.x, gem.y + r * 1.25, r * 0.82, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const tilt = Math.sin(gem.animTimer * 0.8) * 0.09;
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.rotate(tilt);

  ctx.save();
  ctx.globalAlpha = gem.type === 'large' ? 0.72 : 0.42;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.setLineDash([2.5, 3.5]);
  ctx.lineDashOffset = -gem.animTimer * 8;
  ctx.beginPath();
  ctx.arc(0, 0, r * (gem.type === 'large' ? 2.05 : 1.72), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const gemGrad = ctx.createLinearGradient(-r, -r, r, r);
  gemGrad.addColorStop(0, core);
  gemGrad.addColorStop(0.32, color);
  gemGrad.addColorStop(1, '#112033');
  ctx.fillStyle = gemGrad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.28);
  ctx.lineTo(r * 0.9, -r * 0.2);
  ctx.lineTo(r * 0.52, r * 1.12);
  ctx.lineTo(0, r * 1.46);
  ctx.lineTo(-r * 0.52, r * 1.12);
  ctx.lineTo(-r * 0.9, -r * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(0.8, r * 0.12);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.16);
  ctx.lineTo(r * 0.62, -r * 0.16);
  ctx.lineTo(0, r * 0.08);
  ctx.lineTo(-r * 0.62, -r * 0.16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.08);
  ctx.lineTo(r * 0.48, r * 1.02);
  ctx.lineTo(0, r * 1.35);
  ctx.lineTo(-r * 0.48, r * 1.02);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.36)';
  ctx.lineWidth = Math.max(0.5, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.22);
  ctx.lineTo(0, r * 1.32);
  ctx.moveTo(-r * 0.78, -r * 0.18);
  ctx.lineTo(r * 0.78, -r * 0.18);
  ctx.moveTo(-r * 0.48, r * 1.02);
  ctx.lineTo(r * 0.48, r * 1.02);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.26, -r * 0.52, r * 0.16, r * 0.28, -0.65, 0, Math.PI * 2);
  ctx.fill();

  const sparkleCount = gem.type === 'large' ? 5 : gem.type === 'medium' ? 3 : 1;
  for (let i = 0; i < sparkleCount; i++) {
    const angle = gem.animTimer * 2.4 + (i / sparkleCount) * Math.PI * 2;
    const dist = r * (1.45 + i * 0.12);
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist * 0.72;
    const sparkleSize = Math.max(1, r * 0.18) + Math.sin(gem.animTimer * 4 + i * 2) * 0.45;
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.beginPath();
    drawStar(ctx, sx, sy, 4, sparkleSize * 1.4, sparkleSize * 0.48);
    ctx.fill();
  }
  ctx.restore();
}

// ──────────────────────────── Player ────────────────────────────

type EquippedWeaponVisual = {
  type: WeaponType;
  mode: WeaponDisplayMode;
  priority: number;
  evolutionIds: WeaponEvolutionId[];
};

const SIDE_WEAPON_DISPLAY_MODES = new Set<WeaponDisplayMode>(['stowed', 'aura_source', 'relic']);
const ORBIT_WEAPON_DISPLAY_MODES = new Set<WeaponDisplayMode>(['orbit']);

function getEquippedWeaponVisuals(player: Player, modes?: Set<WeaponDisplayMode>): EquippedWeaponVisual[] {
  const visuals: EquippedWeaponVisual[] = [];
  const seen = new Set<WeaponType>();
  for (const weapon of player.weapons) {
    const metadata = WEAPON_DATA[weapon.type].metadata;
    if (metadata.displayMode === 'none' || seen.has(weapon.type)) continue;
    if (modes && !modes.has(metadata.displayMode)) continue;
    seen.add(weapon.type);
    visuals.push({
      type: weapon.type,
      mode: metadata.displayMode,
      priority: metadata.displayPriority,
      evolutionIds: getWeaponEvolutionIds(weapon),
    });
  }
  return visuals.sort((a, b) => b.priority - a.priority);
}

function hasEquippedWeaponDisplayMode(player: Player, mode: WeaponDisplayMode): boolean {
  return player.weapons.some((weapon) => WEAPON_DATA[weapon.type].metadata.displayMode === mode);
}

function drawWeaponFallbackIcon(
  ctx: CanvasRenderingContext2D,
  type: WeaponType,
  x: number,
  y: number,
  size: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = 'rgba(12,16,28,0.68)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,225,255,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.font = `${Math.round(size * 0.5)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(245,250,255,0.9)';
  ctx.fillText(WEAPON_DATA[type].icon, x, y + size * 0.02);
  ctx.restore();
}

function drawStowedWhipFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  side: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(42,18,9,0.85)';
  ctx.lineWidth = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(x - side * size * 0.34, y + size * 0.22);
  ctx.quadraticCurveTo(x + side * size * 0.18, y + size * 0.36, x + side * size * 0.08, y - size * 0.02);
  ctx.quadraticCurveTo(x - side * size * 0.03, y - size * 0.36, x + side * size * 0.38, y - size * 0.34);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,194,100,0.9)';
  ctx.lineWidth = size * 0.12;
  ctx.beginPath();
  ctx.moveTo(x - side * size * 0.34, y + size * 0.22);
  ctx.quadraticCurveTo(x + side * size * 0.18, y + size * 0.36, x + side * size * 0.08, y - size * 0.02);
  ctx.quadraticCurveTo(x - side * size * 0.03, y - size * 0.36, x + side * size * 0.38, y - size * 0.34);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,228,166,0.95)';
  ctx.beginPath();
  ctx.arc(x - side * size * 0.36, y + size * 0.22, size * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEquippedWeaponAssets(ctx: CanvasRenderingContext2D, player: Player, bob: number) {
  const visuals = getEquippedWeaponVisuals(player, SIDE_WEAPON_DISPLAY_MODES).slice(0, 4);
  if (visuals.length === 0) return;

  const side = player.facingLeft ? 1 : -1;
  const r = player.radius;
  const baseY = player.y + bob;
  const whipVisual = visuals.find((visual) => visual.type === WeaponType.WHIP);
  const hasWhip = whipVisual !== undefined;

  if (whipVisual) {
    const x = player.x + side * r * 1.45;
    const y = baseY + r * 0.4;
    const size = r * 2.15;
    const rotation = side > 0 ? -0.78 : 0.78;
    const drewWhip = weaponSpriteRegistry.drawWeapon(ctx, WeaponType.WHIP, x, y, size, {
      alpha: 0.92,
      rotation,
      glow: true,
      evolutionIds: whipVisual.evolutionIds,
    });
    if (!drewWhip) {
      drawStowedWhipFallback(ctx, x, y, size, side, 0.92);
      weaponSpriteRegistry.drawEvolutionAssets(ctx, whipVisual.evolutionIds, x, y, size, {
        alpha: 0.9,
        rotation,
      });
    }
  }

  const sideVisuals = visuals.filter((visual) => visual.type !== WeaponType.WHIP).slice(0, hasWhip ? 3 : 4);
  const slots = hasWhip
    ? [
      { ox: side * r * 1.52, oy: -r * 0.95, size: r * 1.32 },
      { ox: side * r * 1.34, oy: r * 1.16, size: r * 1.08 },
      { ox: side * r * 2.04, oy: -r * 0.18, size: r * 1.04 },
    ]
    : [
      { ox: side * r * 1.48, oy: -r * 0.92, size: r * 1.32 },
      { ox: side * r * 1.58, oy: r * 0.18, size: r * 1.22 },
      { ox: side * r * 1.34, oy: r * 1.12, size: r * 1.06 },
      { ox: side * r * 2.06, oy: -r * 0.18, size: r * 1.0 },
    ];

  for (let i = 0; i < sideVisuals.length; i++) {
    const visual = sideVisuals[i];
    const type = visual.type;
    const slot = slots[i];
    const x = player.x + slot.ox;
    const y = baseY + slot.oy + Math.sin(player.animTimer * 0.9 + i) * 1.2;
    const rotation = type === WeaponType.BIBLE
      ? Math.sin(player.animTimer * 0.8) * 0.08
      : side * (0.22 + i * 0.08);
    const drew = weaponSpriteRegistry.drawWeapon(ctx, type, x, y, slot.size, {
      alpha: 0.88,
      rotation,
      glow: true,
      evolutionIds: visual.evolutionIds,
    });
    if (!drew) {
      drawWeaponFallbackIcon(ctx, type, x, y, slot.size, 0.88);
      weaponSpriteRegistry.drawEvolutionAssets(ctx, visual.evolutionIds, x, y, slot.size, {
        alpha: 0.86,
        rotation,
      });
    }
  }
}

function drawOrbitingWeaponAssets(ctx: CanvasRenderingContext2D, player: Player, bob: number) {
  const orbitVisuals = getEquippedWeaponVisuals(player, ORBIT_WEAPON_DISPLAY_MODES).slice(0, 3);
  if (orbitVisuals.length === 0) return;

  const baseRadius = player.radius * 2.45;
  const baseAngle = player.animTimer * 0.45;
  for (let i = 0; i < orbitVisuals.length; i++) {
    const visual = orbitVisuals[i];
    const type = visual.type;
    const angle = baseAngle + (i / orbitVisuals.length) * Math.PI * 2;
    const pulse = Math.sin(player.animTimer * 0.9 + i) * player.radius * 0.12;
    const orbitRadius = baseRadius + pulse;
    const x = player.x + Math.cos(angle) * orbitRadius;
    const y = player.y + bob + Math.sin(angle) * orbitRadius * 0.62;
    const size = player.radius * (type === WeaponType.BIBLE ? 1.18 : 1.05);
    const drew = weaponSpriteRegistry.drawWeapon(ctx, type, x, y, size, {
      alpha: 0.82,
      rotation: angle + player.animTimer * 0.18,
      glow: true,
      evolutionIds: visual.evolutionIds,
    });
    if (!drew) {
      drawWeaponFallbackIcon(ctx, type, x, y, size, 0.82);
      weaponSpriteRegistry.drawEvolutionAssets(ctx, visual.evolutionIds, x, y, size, {
        alpha: 0.8,
        rotation: angle + player.animTimer * 0.18,
      });
    }
  }
}

function drawLightningBodyMark(
  ctx: CanvasRenderingContext2D,
  player: Player,
  bob: number,
  evolutionIds: readonly WeaponEvolutionId[]
) {
  const x = player.x;
  const y = player.y + bob;
  const r = player.radius;
  const pulse = 0.68 + Math.sin(player.animTimer * 3.8) * 0.16;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(128,235,255,0.55)';
  ctx.shadowBlur = r * 0.45;

  ctx.strokeStyle = `rgba(135,230,255,${0.48 + pulse * 0.22})`;
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.88, y - r * 1.16);
  ctx.lineTo(x - r * 0.38, y - r * 1.54);
  ctx.lineTo(x, y - r * 1.23);
  ctx.lineTo(x + r * 0.38, y - r * 1.54);
  ctx.lineTo(x + r * 0.88, y - r * 1.16);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,238,120,${0.46 + pulse * 0.24})`;
  ctx.lineWidth = Math.max(1.4, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.18, y - r * 1.42);
  ctx.lineTo(x + r * 0.08, y - r * 1.82);
  ctx.lineTo(x + r * 0.02, y - r * 1.54);
  ctx.lineTo(x + r * 0.34, y - r * 1.86);
  ctx.stroke();

  ctx.shadowBlur = r * 0.3;
  ctx.strokeStyle = `rgba(155,240,255,${0.45 + pulse * 0.24})`;
  ctx.lineWidth = Math.max(1.6, r * 0.16);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y + r * 0.05);
  ctx.lineTo(x + r * 0.22, y + r * 0.05);
  ctx.lineTo(x - r * 0.02, y + r * 0.46);
  ctx.lineTo(x + r * 0.3, y + r * 0.46);
  ctx.lineTo(x - r * 0.16, y + r * 0.9);
  ctx.stroke();

  ctx.fillStyle = `rgba(255,245,150,${0.18 + pulse * 0.1})`;
  ctx.beginPath();
  ctx.arc(x + r * 0.02, y + r * 0.42, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  weaponSpriteRegistry.drawEvolutionAssets(ctx, evolutionIds, x, y - r * 0.48, r * 2.1, {
    alpha: 0.72,
    evolutionIntensity: 0.7,
  });
  ctx.restore();
}

function drawWeaponBodyMarks(ctx: CanvasRenderingContext2D, player: Player, bob: number) {
  if (!hasEquippedWeaponDisplayMode(player, 'body_mark')) return;
  const visual = getEquippedWeaponVisuals(player, new Set<WeaponDisplayMode>(['body_mark']))[0];
  if (visual) {
    drawLightningBodyMark(ctx, player, bob, visual.evolutionIds);
  }
}

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

  drawOrbitingWeaponAssets(ctx, p, bob);
  drawEquippedWeaponAssets(ctx, p, bob);

  const skinId = skin?.id ?? 'wanderer';
  if (skinId === 'ember') {
    drawEmberPlayer(ctx, p, bob, bodyColor, outlineColor);
  } else if (skinId === 'oracle') {
    drawOraclePlayer(ctx, p, bob, bodyColor, outlineColor);
  } else {
    drawWandererPlayer(ctx, p, bob, isMoving, bodyColor, outlineColor);
  }

  drawWeaponBodyMarks(ctx, p, bob);
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

function drawBossAura(ctx: CanvasRenderingContext2D, e: Enemy, bob: number) {
  const isSpectral = e.type === EnemyType.WRAITH;
  const core = isSpectral ? '255,68,230' : '255,92,30';
  const rim = isSpectral ? '#ff62f2' : '#ffb347';
  const pulse = 0.78 + Math.sin(e.animTimer * 1.8) * 0.18;
  const auraRadius = e.radius * (2.3 + pulse * 0.3);

  const aura = ctx.createRadialGradient(e.x, e.y + bob, e.radius * 0.35, e.x, e.y + bob, auraRadius);
  aura.addColorStop(0, `rgba(${core},${0.22 * pulse})`);
  aura.addColorStop(0.52, `rgba(${core},${0.1 * pulse})`);
  aura.addColorStop(1, `rgba(${core},0)`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(e.x, e.y + bob, auraRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(e.x, e.y + bob);
  ctx.rotate(e.animTimer * (isSpectral ? -0.28 : 0.36));
  ctx.strokeStyle = `rgba(${core},${0.45 * pulse})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, e.radius * 1.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.5 * pulse;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const inner = e.radius * 1.36;
    const outer = e.radius * 1.72;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemyAttackCharge(ctx: CanvasRenderingContext2D, e: Enemy, bob: number) {
  const pulse = 0.55 + Math.sin(e.animTimer * 9) * 0.25;
  const chargeColor = e.type === EnemyType.WRAITH ? 'rgba(214,108,255,' :
                      e.type === EnemyType.DEMON ? 'rgba(255,92,32,' : 'rgba(181,140,255,';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `${chargeColor}${0.32 + pulse * 0.2})`;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -e.animTimer * 18;
  ctx.beginPath();
  ctx.arc(e.x, e.y + bob, e.radius * (1.7 + pulse * 0.25), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = `${chargeColor}${0.18 + pulse * 0.12})`;
  ctx.beginPath();
  ctx.arc(e.x, e.y + bob, e.radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemyEmpoweredAura(ctx: CanvasRenderingContext2D, e: Enemy, bob: number) {
  if (!e.isEmpowered) return;

  const y = e.y + bob;
  const pulse = 0.72 + Math.sin(e.animTimer * 4) * 0.18;
  const active = e.traitWindup > 0 || e.traitDuration > 0;
  const color =
    e.trait === 'dash' ? '98,214,255' :
    e.trait === 'shield' ? '255,225,128' :
    e.trait === 'phase' ? '128,218,255' :
    e.trait === 'split' ? '214,180,138' :
    e.trait === 'charge' ? '255,96,52' :
    e.trait === 'shadowCaster' ? '214,108,255' :
    e.trait === 'burstCaster' ? '181,140,255' :
    '220,235,255';

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${color},${active ? 0.58 : 0.32})`;
  ctx.lineWidth = active ? 2.4 : 1.4;
  ctx.setLineDash(e.trait === 'shield' ? [] : [5, 5]);
  ctx.lineDashOffset = -e.animTimer * 24;
  ctx.beginPath();
  ctx.arc(e.x, y, e.radius * (1.45 + pulse * 0.12), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (e.trait === 'shield') {
    ctx.strokeStyle = `rgba(${color},0.72)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, y, e.radius * 1.18, -Math.PI * 0.82, Math.PI * 0.82);
    ctx.stroke();
  } else if (e.trait === 'dash' || e.trait === 'charge') {
    const len = active ? e.radius * 2.7 : e.radius * 1.7;
    ctx.strokeStyle = `rgba(${color},${active ? 0.7 : 0.38})`;
    ctx.lineWidth = e.trait === 'charge' ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.x - e.traitDirX * len, y - e.traitDirY * len);
    ctx.lineTo(e.x - e.traitDirX * e.radius * 0.25, y - e.traitDirY * e.radius * 0.25);
    ctx.stroke();
  } else if (e.trait === 'phase') {
    ctx.fillStyle = `rgba(${color},${e.traitDuration > 0 ? 0.16 : 0.07})`;
    ctx.beginPath();
    ctx.ellipse(e.x, y, e.radius * 1.6, e.radius * 1.05, e.animTimer * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.trait === 'split') {
    ctx.fillStyle = `rgba(${color},0.62)`;
    for (let i = 0; i < 4; i++) {
      const angle = e.animTimer * 0.7 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(
        e.x + Math.cos(angle) * e.radius * 1.25,
        y + Math.sin(angle) * e.radius * 0.72,
        Math.max(2, e.radius * 0.13),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (e.trait === 'burstCaster' || e.trait === 'shadowCaster') {
    ctx.fillStyle = `rgba(${color},${active ? 0.72 : 0.48})`;
    ctx.font = `${Math.round(e.radius * 0.85)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.trait === 'shadowCaster' ? '✦' : 'II', e.x, y - e.radius * 1.55);
  }
  ctx.restore();
}

export function drawEnemy(rc: RenderContext, e: Enemy) {
  const { ctx } = rc;
  const data = ENEMY_DATA[e.type];
  const color = e.hitFlash > 0 ? '#ffffff' : data.color;
  const visualTimer = spriteRegistry.getEnemyAnimationTimer(e.type) ?? e.animTimer;
  const bob = Math.sin(visualTimer) * 1.5;
  const wobble = Math.sin(visualTimer * 2) * 0.1;

  if (e.isBoss) drawBossAura(ctx, e, bob);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.radius + 3, e.radius * 0.9, e.radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.attackWindup > 0) drawEnemyAttackCharge(ctx, e, bob);

  ctx.save();
  if (e.trait === 'phase' && e.traitDuration > 0) {
    ctx.globalAlpha *= 0.58 + Math.sin(e.animTimer * 6) * 0.08;
  }
  const drewSprite = spriteRegistry.drawEnemy(ctx, e, bob);
  if (!drewSprite) {
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

    case EnemyType.CULTIST:
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.rotate(wobble * 0.4);
      ctx.fillStyle = 'rgba(32,18,52,0.92)';
      ctx.beginPath();
      ctx.moveTo(0, -e.radius * 1.35);
      ctx.quadraticCurveTo(e.radius * 1.2, -e.radius * 0.45, e.radius * 0.82, e.radius * 1.15);
      ctx.lineTo(-e.radius * 0.82, e.radius * 1.15);
      ctx.quadraticCurveTo(-e.radius * 1.2, -e.radius * 0.45, 0, -e.radius * 1.35);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#120b1f';
      ctx.beginPath();
      ctx.arc(0, -e.radius * 0.25, e.radius * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9c2ff';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.23, -e.radius * 0.32, 2, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.23, -e.radius * 0.32, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b58cff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.74, -e.radius * 0.95);
      ctx.lineTo(e.radius * 1.18, e.radius * 1.1);
      ctx.stroke();
      ctx.fillStyle = e.attackWindup > 0 ? '#ffffff' : '#b58cff';
      ctx.beginPath();
      ctx.arc(e.radius * 0.74, -e.radius * 0.95, 3.2, 0, Math.PI * 2);
      ctx.fill();
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
  }
  ctx.restore();

  drawEnemyEmpoweredAura(ctx, e, bob);

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

// ──────────────────────────── Enemy Projectile ────────────────────────────

export function drawEnemyProjectile(rc: RenderContext, p: EnemyProjectile) {
  const { ctx } = rc;
  if (p.radius <= 0 || p.maxLife <= 0 || p.life <= 0) return;
  const lifeRatio = Math.max(0, Math.min(1, p.life / p.maxLife));
  const alpha = Math.min(1, lifeRatio / 0.25);
  const flicker = 0.85 + Math.sin(p.animTimer * 12) * 0.15;
  const angle = Math.atan2(p.vy, p.vx);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = p.glowColor;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius * (1.75 + flicker * 0.25), 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  if (p.kind === 'cultist_bolt') {
    ctx.ellipse(0, 0, p.radius * 1.35, p.radius * 0.82, 0, 0, Math.PI * 2);
  } else if (p.kind === 'demon_fire') {
    ctx.moveTo(p.radius * 1.7, 0);
    ctx.lineTo(-p.radius * 0.8, -p.radius);
    ctx.lineTo(-p.radius * 0.35, 0);
    ctx.lineTo(-p.radius * 0.8, p.radius);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, p.radius * (0.92 + flicker * 0.12), 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.arc(p.radius * 0.18, -p.radius * 0.18, Math.max(1.4, p.radius * 0.28), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ──────────────────────────── Projectile ────────────────────────────

/** 基于种子的伪随机（确定性） */
function seededRandom(seed: number): number {
  let s = seed | 0;
  s = ((s * 1103515245 + 12345) & 0x7fffffff);
  return (s >>> 0) / 0x7fffffff;
}

function getProjectileAngle(p: Projectile, fallback = 0): number {
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  return speed > 0.1 ? Math.atan2(p.vy, p.vx) : fallback;
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
      weaponSpriteRegistry.drawWeapon(ctx, WeaponType.MAGIC_WAND, p.x, p.y, p.radius * 3.1, {
        alpha,
        rotation: getProjectileAngle(p) + Math.PI / 4,
        glow: false,
        evolutionIds: p.evolutionIds,
        evolutionIntensity: 0.72,
      });
      break;

    case WeaponType.FIRE_WAND:
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fireRadius = Math.max(10, p.radius);
      const firePulse = 0.92 + Math.sin(p.animTimer * 2.1) * 0.08;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, fireRadius * 2.55 * firePulse);
      glow.addColorStop(0, `rgba(255,235,130,${alpha * 0.28})`);
      glow.addColorStop(0.34, `rgba(255,105,22,${alpha * 0.34})`);
      glow.addColorStop(0.72, `rgba(180,30,12,${alpha * 0.16})`);
      glow.addColorStop(1, 'rgba(120,18,8,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, fireRadius * 2.55 * firePulse, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 10; i++) {
        const angle = p.animTimer * 0.55 + i * 0.628;
        const dist = fireRadius * (0.18 + (i % 4) * 0.11);
        const lobeX = p.x + Math.cos(angle) * dist;
        const lobeY = p.y + Math.sin(angle) * dist * 0.72 - fireRadius * (i % 3 === 0 ? 0.16 : 0.02);
        const lobeW = fireRadius * (0.95 + (i % 3) * 0.18);
        const lobeH = fireRadius * (0.82 + (i % 4) * 0.16);
        const lobe = ctx.createRadialGradient(lobeX - lobeW * 0.18, lobeY - lobeH * 0.22, 0, lobeX, lobeY, lobeW);
        lobe.addColorStop(0, `rgba(255,208,72,${alpha * 0.78})`);
        lobe.addColorStop(0.46, `rgba(255,102,18,${alpha * 0.74})`);
        lobe.addColorStop(1, `rgba(132,20,10,${alpha * 0.18})`);
        ctx.fillStyle = lobe;
        ctx.beginPath();
        ctx.ellipse(lobeX, lobeY, lobeW, lobeH, angle * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI * 0.5 + (i - 2) * 0.42 + Math.sin(p.animTimer + i) * 0.08;
        const tipX = p.x + Math.cos(angle) * fireRadius * 0.56;
        const tipY = p.y + Math.sin(angle) * fireRadius * 0.42 - fireRadius * 0.28;
        const tipH = fireRadius * (1.12 + i * 0.08);
        ctx.fillStyle = `rgba(255,${155 + i * 14},35,${alpha * 0.64})`;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY - tipH);
        ctx.quadraticCurveTo(tipX + fireRadius * 0.48, tipY - tipH * 0.28, tipX + fireRadius * 0.18, tipY + fireRadius * 0.48);
        ctx.quadraticCurveTo(tipX - fireRadius * 0.48, tipY - tipH * 0.12, tipX, tipY - tipH);
        ctx.fill();
      }

      const core = ctx.createRadialGradient(
        p.x - fireRadius * 0.18, p.y - fireRadius * 0.18, 0,
        p.x, p.y, fireRadius * 1.18
      );
      core.addColorStop(0, `rgba(255,255,210,${alpha * 0.88})`);
      core.addColorStop(0.42, `rgba(255,205,70,${alpha * 0.72})`);
      core.addColorStop(1, `rgba(255,92,18,${alpha * 0.08})`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, fireRadius * 1.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      weaponSpriteRegistry.drawEvolutionAssets(ctx, p.evolutionIds, p.x, p.y, fireRadius * 2.25, {
        alpha: alpha * 0.78,
        evolutionIntensity: 0.7,
      });
      break;

    case WeaponType.AXE: {
      const angle = getProjectileAngle(p);
      const reach = p.beamLength ?? p.radius * 8;
      const arc = p.arcAngle ?? Math.PI * 2 / 3;
      const originX = p.originX ?? p.x - Math.cos(angle) * reach * 0.5;
      const originY = p.originY ?? p.y - Math.sin(angle) * reach * 0.5;
      const progress = 1 - lifeRatio;
      const sweepAlpha = alpha * (0.78 - progress * 0.22);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(originX, originY, 0, originX, originY, reach);
      grad.addColorStop(0, `rgba(255,220,150,${sweepAlpha * 0.1})`);
      grad.addColorStop(0.62, `rgba(255,190,95,${sweepAlpha * 0.18})`);
      grad.addColorStop(1, 'rgba(255,190,95,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, reach, angle - arc * 0.5, angle + arc * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(255,232,174,${alpha * 0.84})`;
      ctx.lineWidth = Math.max(3, p.radius * 0.34);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(originX, originY, reach * (0.72 + progress * 0.12), angle - arc * 0.42, angle + arc * 0.42);
      ctx.stroke();

      const headX = originX + Math.cos(angle + (progress - 0.5) * arc * 0.42) * reach * 0.82;
      const headY = originY + Math.sin(angle + (progress - 0.5) * arc * 0.42) * reach * 0.82;
      weaponSpriteRegistry.drawWeapon(ctx, WeaponType.AXE, headX, headY, p.radius * 3.6, {
        alpha: Math.min(1, alpha + 0.12),
        rotation: angle + Math.PI * 0.32,
        glow: true,
        evolutionIds: p.evolutionIds,
        evolutionIntensity: 0.74,
      });
      ctx.restore();
      break;
    }

    case WeaponType.RUNE_LANCE: {
      const angle = getProjectileAngle(p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.globalCompositeOperation = 'lighter';
      const lanceLen = p.beamLength ?? p.radius * 7.2;
      const trail = ctx.createLinearGradient(-lanceLen * 0.5, 0, lanceLen * 0.5, 0);
      trail.addColorStop(0, `rgba(60,210,255,0)`);
      trail.addColorStop(0.45, `rgba(60,220,255,${alpha * 0.36})`);
      trail.addColorStop(1, `rgba(245,255,255,${alpha})`);
      ctx.strokeStyle = trail;
      ctx.lineWidth = p.radius * 1.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-lanceLen * 0.5, 0);
      ctx.lineTo(lanceLen * 0.5, 0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = Math.max(2, p.radius * 0.34);
      ctx.beginPath();
      ctx.moveTo(-lanceLen * 0.42, 0);
      ctx.lineTo(lanceLen * 0.52, 0);
      ctx.stroke();

      ctx.fillStyle = `rgba(160,250,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(lanceLen * 0.56, 0);
      ctx.lineTo(lanceLen * 0.46, -p.radius * 1.2);
      ctx.lineTo(lanceLen * 0.49, 0);
      ctx.lineTo(lanceLen * 0.46, p.radius * 1.2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(115,230,255,${alpha * 0.8})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-lanceLen * 0.28, -p.radius * 0.75);
      ctx.lineTo(lanceLen * 0.12, -p.radius * 0.18);
      ctx.moveTo(-lanceLen * 0.28, p.radius * 0.75);
      ctx.lineTo(lanceLen * 0.12, p.radius * 0.18);
      ctx.stroke();
      ctx.restore();
      weaponSpriteRegistry.drawEvolutionAssets(ctx, p.evolutionIds, p.x, p.y, Math.min(84, lanceLen * 0.22), {
        alpha: alpha * 0.76,
        rotation: angle,
        evolutionIntensity: 0.7,
      });
      break;
    }

    case WeaponType.MOON_BLADE: {
      const angle = getProjectileAngle(p) + p.animTimer * 2.4;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.globalCompositeOperation = 'lighter';

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius * 2.4);
      glow.addColorStop(0, `rgba(235,220,255,${alpha * 0.18})`);
      glow.addColorStop(0.55, `rgba(150,110,255,${alpha * 0.22})`);
      glow.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(178,130,255,${alpha * 0.82})`;
      ctx.lineWidth = Math.max(3, p.radius * 0.72);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.16, -2.25, 1.2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(245,250,255,${alpha})`;
      ctx.lineWidth = Math.max(1.5, p.radius * 0.26);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.16, -2.05, 1.0);
      ctx.stroke();

      for (const tipAngle of [-2.25, 1.2]) {
        const tx = Math.cos(tipAngle) * p.radius * 1.16;
        const ty = Math.sin(tipAngle) * p.radius * 1.16;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(1.8, p.radius * 0.24), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      weaponSpriteRegistry.drawEvolutionAssets(ctx, p.evolutionIds, p.x, p.y, p.radius * 3.4, {
        alpha: alpha * 0.78,
        rotation: angle,
        evolutionIntensity: 0.75,
      });
      break;
    }

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
      weaponSpriteRegistry.drawWeapon(ctx, WeaponType.LIGHTNING, p.x, p.y, Math.min(76, p.radius * 1.9), {
        alpha,
        rotation: Math.sin(p.animTimer * 4) * 0.12,
        glow: false,
        evolutionIds: p.evolutionIds,
        evolutionIntensity: 0.72,
      });
      break;
    }

    case WeaponType.WHIP: {
      const dirLen = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const dirX = dirLen > 0.001 ? p.vx / dirLen : 1;
      const dirY = dirLen > 0.001 ? p.vy / dirLen : 0;
      const perpX = -dirY;
      const perpY = dirX;
      const level = Math.max(1, p.count ?? 1);
      const scale = p.segScale ?? 1;
      const progress = 1 - lifeRatio;
      const attack = Math.sin(progress * Math.PI);
      const anchorX = p.originX !== undefined ? p.originX + dirX * 16 : p.x - dirX * p.radius * 0.35;
      const anchorY = p.originY !== undefined ? p.originY + dirY * 16 : p.y - dirY * p.radius * 0.35;
      const length = Math.min(128, (62 + level * 7) * scale) * (0.7 + attack * 0.3);
      const amplitude = (8 + level * 0.9) * scale * (0.32 + attack * 0.72);
      const sweep = -Math.sin(progress * Math.PI * 1.12) * (17 + level * 0.8) * scale;
      const samples = 18;

      function buildWhipCurve(phaseOffset: number, lag: number): { x: number; y: number }[] {
        const pts: { x: number; y: number }[] = [];
        const phase = progress * Math.PI * 3.6 + phaseOffset;
        const localAttack = Math.max(0.12, attack - lag);
        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          const ease = 1 - Math.pow(1 - t, 2.35);
          const envelope = Math.sin(t * Math.PI);
          const wave = Math.sin(t * Math.PI * 2.15 - phase);
          const snap = Math.sin((t * 0.9 + progress * 0.55) * Math.PI) * localAttack;
          const forward = length * ease * (0.82 + localAttack * 0.18);
          const lateral = wave * amplitude * envelope + sweep * t * (1 - t * 0.32) - snap * 5 * scale;
          pts.push({
            x: anchorX + dirX * forward + perpX * lateral,
            y: anchorY + dirY * forward + perpY * lateral,
          });
        }
        return pts;
      }

      function drawSmoothCurve(pts: { x: number; y: number }[]) {
        if (pts.length < 2) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }

      const mainCurve = buildWhipCurve(0, 0);
      const tip = mainCurve[mainCurve.length - 1];

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let ghost = 2; ghost >= 1; ghost--) {
        const ghostCurve = buildWhipCurve(ghost * 0.42, ghost * 0.18);
        ctx.strokeStyle = `rgba(80,220,255,${alpha * (0.13 + ghost * 0.04)})`;
        ctx.lineWidth = 8 - ghost * 2;
        ctx.beginPath();
        drawSmoothCurve(ghostCurve);
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(75,210,255,${alpha * 0.34})`;
      ctx.lineWidth = 15;
      ctx.beginPath();
      drawSmoothCurve(mainCurve);
      ctx.stroke();

      ctx.strokeStyle = `rgba(155,110,255,${alpha * 0.38})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      drawSmoothCurve(mainCurve);
      ctx.stroke();

      const core = ctx.createLinearGradient(anchorX, anchorY, tip.x, tip.y);
      core.addColorStop(0, `rgba(245,255,255,${alpha * 0.35})`);
      core.addColorStop(0.45, `rgba(130,245,255,${alpha})`);
      core.addColorStop(1, `rgba(255,255,210,${alpha})`);
      ctx.strokeStyle = core;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      drawSmoothCurve(mainCurve);
      ctx.stroke();

      for (let i = 3; i < mainCurve.length - 1; i += 4) {
        const t = i / mainCurve.length;
        const flicker = 0.72 + Math.sin(p.animTimer * 9 + i) * 0.28;
        ctx.fillStyle = `rgba(230,255,255,${alpha * attack * flicker * (0.18 + t * 0.36)})`;
        ctx.beginPath();
        ctx.arc(mainCurve[i].x, mainCurve[i].y, 1.2 + t * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      const tipGlow = 9 + attack * 13;
      const tipGrad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tipGlow);
      tipGrad.addColorStop(0, `rgba(255,255,230,${alpha * (0.55 + attack * 0.35)})`);
      tipGrad.addColorStop(0.45, `rgba(110,235,255,${alpha * 0.35})`);
      tipGrad.addColorStop(1, 'rgba(70,160,255,0)');
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, tipGlow, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(235,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 2.4 + attack * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(155,235,255,${alpha * 0.45})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const t = (i + 1) / 4;
        const jitter = Math.sin(progress * Math.PI * 4 + i) * 2.5;
        const x = anchorX + dirX * length * t * 0.22 + perpX * jitter;
        const y = anchorY + dirY * length * t * 0.22 + perpY * jitter;
        ctx.beginPath();
        ctx.moveTo(x - dirX * 4 - perpX * 2, y - dirY * 4 - perpY * 2);
        ctx.lineTo(x + dirX * 7 + perpX * 2, y + dirY * 7 + perpY * 2);
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(170,245,255,${alpha * 0.45})`;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      weaponSpriteRegistry.drawEvolutionAssets(ctx, p.evolutionIds, p.x, p.y, p.radius * 1.2, {
        alpha: alpha * 0.72,
        rotation: Math.atan2(dirY, dirX),
        evolutionIntensity: 0.64,
      });
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
      weaponSpriteRegistry.drawWeapon(ctx, WeaponType.BIBLE, p.x, p.y, p.radius * 2.4, {
        alpha,
        rotation: p.animTimer,
        glow: false,
        evolutionIds: p.evolutionIds,
        evolutionIntensity: 0.7,
      });
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
      weaponSpriteRegistry.drawWeapon(ctx, WeaponType.HOLY_WATER, p.x, p.y, Math.min(58, Math.max(34, p.radius * 1.2)), {
        alpha,
        rotation: Math.sin(p.animTimer) * 0.12,
        glow: false,
        evolutionIds: p.evolutionIds,
        evolutionIntensity: 0.72,
      });
      break;
    }

    case WeaponType.GARLIC:
      break;
  }

}

// ──────────────────────────── Garlic Aura ────────────────────────────

export function drawGarlicAura(
  rc: RenderContext,
  player: Player,
  radius: number,
  _modifierMask: number = 0,
  evolutionIds?: readonly WeaponEvolutionId[]
) {
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

  weaponSpriteRegistry.drawEvolutionAssets(ctx, evolutionIds, player.x, player.y, radius * 1.04, {
    alpha: 0.52 + pulse,
    evolutionIntensity: 0.74,
  });

  for (let i = 0; i < 3; i++) {
    const angle = -time * 0.42 + i * Math.PI * 2 / 3;
    const dist = radius * 0.42;
    weaponSpriteRegistry.drawWeapon(ctx, WeaponType.GARLIC, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, 28, {
      alpha: 0.42 + pulse,
      rotation: Math.sin(time + i) * 0.18,
      glow: false,
      evolutionIds,
      evolutionIntensity: 0.54,
    });
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
}
