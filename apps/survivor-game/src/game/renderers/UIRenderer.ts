import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, UpgradeOption, TouchJoystickState } from '../types';
import { COLORS, WEAPON_DATA, PASSIVE_DATA, ENEMY_DATA, GENERIC_MODIFIER_DATA, UPGRADE_RARITY_DATA } from '../constants';
import {
  type CodexTab, type DesktopTab, type MetaState, type MetaUpgradeNode,
  META_UPGRADES, CHARACTER_SKINS, hasMetaUpgrade, canBuyMetaUpgrade,
} from '../systems/meta/MetaProgression';
import { getShopLayout, isMobileViewport } from '../systems/upgrade/ShopLayout';

const gradientCache = new Map<string, CanvasGradient>();
const GRADIENT_CACHE_LIMIT = 160;

function cachedLinearGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Array<[number, string]>
): CanvasGradient {
  const cacheKey = `l:${key}:${x0}:${y0}:${x1}:${y1}`;
  let gradient = gradientCache.get(cacheKey);
  if (!gradient) {
    gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    if (gradientCache.size > GRADIENT_CACHE_LIMIT) gradientCache.clear();
    gradientCache.set(cacheKey, gradient);
  }
  return gradient;
}

function cachedRadialGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: Array<[number, string]>
): CanvasGradient {
  const cacheKey = `r:${key}:${x0}:${y0}:${r0}:${x1}:${y1}:${r1}`;
  let gradient = gradientCache.get(cacheKey);
  if (!gradient) {
    gradient = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    if (gradientCache.size > GRADIENT_CACHE_LIMIT) gradientCache.clear();
    gradientCache.set(cacheKey, gradient);
  }
  return gradient;
}

// ──────────────────────────── HUD ────────────────────────────

export function drawUI(rc: RenderContext, player: Player, elapsed: number, killCount: number, objective?: string) {
  const { ctx, w, h } = rc;
  const mobile = isMobileViewport(w, h);
  const padding = mobile ? 10 : 16;
  const barW = mobile ? Math.min(240, Math.max(172, w - 142)) : Math.min(320, w - 32);
  const barH = mobile ? 12 : 14;
  const barX = padding;
  const barY = padding;

  // XP Bar background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 8);
  ctx.fill();

  // XP Bar fill
  ctx.fillStyle = COLORS.xpBarBg;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 6);
  ctx.fill();

  const xpRatio = player.xp / player.xpToNext;
  if (xpRatio > 0) {
    ctx.fillStyle = COLORS.xpBar;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * xpRatio, barH, 6);
    ctx.fill();

    ctx.fillStyle = cachedLinearGradient(ctx, `xp-shine-${barW}-${barH}`, barX, barY, barX, barY + barH, [
      [0, 'rgba(255,255,255,0.3)'],
      [0.5, 'rgba(255,255,255,0.1)'],
      [1, 'rgba(0,0,0,0.1)'],
    ]);
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * xpRatio, barH, 6);
    ctx.fill();
  }

  // XP text
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.floor(xpRatio * 100)}%`, barX + barW / 2, barY + barH / 2);

  const rowY = barY + barH + 6;
  const rowH = mobile ? 22 : 24;
  const levelW = mobile ? 46 : 50;
  const hpW = mobile ? 94 : 120;
  const shardW = mobile ? 82 : 104;
  const gap = mobile ? 6 : 10;

  // Level badge
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX, rowY, levelW, rowH, 6);
  ctx.fill();
  ctx.strokeStyle = '#44ff44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(barX, rowY, levelW, rowH, 6);
  ctx.stroke();
  ctx.font = `bold ${mobile ? 12 : 14}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#44ff44';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${player.level}`, barX + levelW / 2, rowY + rowH / 2);

  // HP display
  const hpX = barX + levelW + gap;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(hpX, rowY, hpW, rowH, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(hpX, rowY, hpW, rowH, 6);
  ctx.stroke();
  ctx.font = `${mobile ? 11 : 13}px "Segoe UI", sans-serif`;
  ctx.fillStyle = COLORS.danger;
  ctx.textAlign = 'center';
  ctx.fillText(`${mobile ? '' : '❤️ '}${Math.ceil(player.hp)}/${player.maxHp}`, hpX + hpW / 2, rowY + rowH / 2);

  // Spendable soul shard display
  const shardX = hpX + hpW + gap;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(shardX, rowY, shardW, rowH, 6);
  ctx.fill();
  ctx.strokeStyle = '#8fe8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(shardX, rowY, shardW, rowH, 6);
  ctx.stroke();
  ctx.font = `${mobile ? 11 : 13}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#8fe8ff';
  ctx.textAlign = 'center';
  ctx.fillText(`魂晶 ${Math.floor(player.shards)}`, shardX + shardW / 2, rowY + rowH / 2);

  // Phase indicator
  const phase = elapsed < 60 ? '初期' : elapsed < 180 ? '前期' : elapsed < 300 ? '中期' : elapsed < 600 ? '后期' : '终局';
  const phaseColor = elapsed < 60 ? '#88ff88' : elapsed < 180 ? '#ffff88' : elapsed < 300 ? '#ffaa44' : elapsed < 600 ? '#ff6644' : '#ff4444';
  const timerW = mobile ? 86 : 100;
  const timerH = mobile ? 28 : 32;
  const timerY = mobile ? 58 : 8;
  const phaseW = mobile ? 68 : 88;
  const phaseH = mobile ? 22 : 28;
  const phaseX = mobile ? padding : w - 224;
  const phaseY = mobile ? timerY + timerH + 8 : 12;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(phaseX, phaseY, phaseW, phaseH, 6);
  ctx.fill();
  ctx.strokeStyle = phaseColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(phaseX, phaseY, phaseW, phaseH, 6);
  ctx.stroke();
  ctx.font = `${mobile ? 11 : 12}px "Segoe UI", sans-serif`;
  ctx.fillStyle = phaseColor;
  ctx.textAlign = 'center';
  ctx.fillText(mobile ? phase : `阶段: ${phase}`, phaseX + phaseW / 2, phaseY + phaseH / 2);

  // Timer (top center)
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - timerW / 2, timerY, timerW, timerH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(w / 2 - timerW / 2, timerY, timerW, timerH, 8);
  ctx.stroke();
  ctx.font = `bold ${mobile ? 18 : 22}px "Segoe UI", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.uiText;
  ctx.fillText(timeStr, w / 2, timerY + timerH / 2);

  // Kill count
  const killW = mobile ? 62 : 88;
  const killH = mobile ? 22 : 24;
  const killX = mobile ? phaseX + phaseW + 6 : w - 100;
  const killY = mobile ? phaseY : 50;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(killX, killY, killW, killH, 6);
  ctx.fill();
  ctx.font = `${mobile ? 11 : 14}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText(`💀 ${killCount}`, killX + killW / 2, killY + killH / 2);

  if (objective) {
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    const mobileMapSize = Math.max(72, Math.min(88, w * 0.22));
    const toastW = mobile ? Math.max(180, w - mobileMapSize - 48) : Math.min(420, w - 32);
    const objectiveLines = getWrappedLines(ctx, objective, toastW - 28, 2);
    const lineHeight = 16;
    const toastH = objectiveLines.length > 1 ? 52 : 36;
    const toastX = mobile ? padding : w / 2 - toastW / 2;
    const toastY = mobile ? Math.max(126, phaseY + phaseH + 12) : 82;
    ctx.fillStyle = 'rgba(5,10,22,0.82)';
    ctx.beginPath();
    ctx.roundRect(toastX, toastY, toastW, toastH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.58)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(toastX, toastY, toastW, toastH, 8);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textY = toastY + toastH / 2 - ((objectiveLines.length - 1) * lineHeight) / 2;
    objectiveLines.forEach((line, index) => {
      ctx.fillText(line, toastX + toastW / 2, textY + index * lineHeight);
    });
  }

  if (mobile) {
    drawMobileLoadoutSummary(ctx, player, padding, timerY);
  } else {
    drawDesktopLoadoutDocks(ctx, player, w, h, padding);
  }
}

function drawMobileLoadoutSummary(ctx: CanvasRenderingContext2D, player: Player, x: number, y: number) {
  const weapons = player.weapons.length;
  const passives = player.passives.length;
  if (weapons === 0 && passives === 0) return;

  const w = 118;
  const h = 28;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(143,232,255,0.32)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 12px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(230,244,255,0.86)';
  ctx.fillText(`技能 ${weapons}   被动 ${passives}`, x + w / 2, y + h / 2);
  ctx.restore();
}

function drawDesktopLoadoutDocks(ctx: CanvasRenderingContext2D, player: Player, w: number, h: number, padding: number) {
  const dockGap = 96;
  const sideW = Math.max(220, (w - padding * 2 - dockGap) / 2);
  const preferredWeaponSize = 60;
  const preferredPassiveSize = 54;
  const minSize = w < 840 ? 42 : 48;
  const weaponSize = fitDockSlotSize(player.weapons.length, sideW, preferredWeaponSize, minSize);
  const passiveSize = fitDockSlotSize(player.passives.length, sideW, preferredPassiveSize, minSize);
  const weaponStep = weaponSize + 8;
  const passiveStep = passiveSize + 8;

  const weaponY = h - weaponSize - 18;
  for (let i = 0; i < player.weapons.length; i++) {
    const wep = player.weapons[i];
    const data = WEAPON_DATA[wep.type];
    const wx = padding + i * weaponStep;
    drawLoadoutSlot(ctx, wx, weaponY, weaponSize, data.icon, wep.level, 'rgba(255,126,126,0.62)', '#44ff44', true);
  }

  if (player.passives.length === 0) return;
  const passiveY = h - passiveSize - 20;
  for (let i = 0; i < player.passives.length; i++) {
    const pa = player.passives[i];
    const data = PASSIVE_DATA[pa.type];
    const px = w - padding - passiveSize - i * passiveStep;
    drawLoadoutSlot(ctx, px, passiveY, passiveSize, data.icon, pa.level, 'rgba(116,224,146,0.58)', '#88ff88', false);
  }
}

function fitDockSlotSize(count: number, maxW: number, preferred: number, min: number) {
  if (count <= 1) return preferred;
  return Math.min(preferred, Math.max(min, (maxW - 8 * (count - 1)) / count));
}

function drawLoadoutSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  icon: string,
  level: number,
  stroke: string,
  badgeColor: string,
  prominentBadge: boolean
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.76)';
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.stroke();

  ctx.font = `${Math.floor(size * (prominentBadge ? 0.52 : 0.46))}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.uiText;
  ctx.fillText(icon, x + size / 2, y + size * 0.48);

  const badgeR = prominentBadge ? Math.max(11, size * 0.2) : Math.max(9, size * 0.17);
  const badgeX = x + size - badgeR * 0.78;
  const badgeY = y + size - badgeR * 0.78;
  ctx.fillStyle = '#191b24';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = badgeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `800 ${Math.max(10, Math.floor(size * 0.2))}px "Segoe UI", sans-serif`;
  ctx.fillStyle = badgeColor;
  ctx.fillText(`${level}`, badgeX, badgeY);
  ctx.restore();
}

// ──────────────────────────── Minimap ────────────────────────────

export function drawMinimap(rc: RenderContext, player: Player, enemies: Enemy[]) {
  const { ctx, w, h } = rc;
  const mobile = isMobileViewport(w, h);
  const mapSize = mobile ? Math.max(72, Math.min(88, w * 0.22)) : 110;
  const mapX = w - mapSize - 16;
  const mapY = mobile ? 116 : 85;
  const scale = mapSize / 3000;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapSize, mapSize, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,100,150,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapSize, mapSize, 8);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(100,100,150,0.1)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    const gx = mapX + (mapSize / 4) * i;
    const gy = mapY + (mapSize / 4) * i;
    ctx.beginPath();
    ctx.moveTo(gx, mapY);
    ctx.lineTo(gx, mapY + mapSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mapX, gy);
    ctx.lineTo(mapX + mapSize, gy);
    ctx.stroke();
  }

  const playerDotX = mapX + mapSize / 2;
  const playerDotY = mapY + mapSize / 2;

  ctx.fillStyle = cachedRadialGradient(ctx, `minimap-player-${playerDotX}-${playerDotY}`, playerDotX, playerDotY, 0, playerDotX, playerDotY, 8, [
    [0, 'rgba(74,158,255,0.6)'],
    [1, 'rgba(74,158,255,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(playerDotX, playerDotY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.playerBody;
  ctx.beginPath();
  ctx.arc(playerDotX, playerDotY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(playerDotX, playerDotY, 4, 0, Math.PI * 2);
  ctx.stroke();

  for (const e of enemies) {
    const ex = mapX + mapSize / 2 + (e.x - player.x) * scale;
    const ey = mapY + mapSize / 2 + (e.y - player.y) * scale;
    if (ex >= mapX && ex <= mapX + mapSize && ey >= mapY && ey <= mapY + mapSize) {
      if (e.isElite) {
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = e.isElite ? '#ffd700' : ENEMY_DATA[e.type].color;
      ctx.beginPath();
      ctx.arc(ex, ey, e.isElite ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.font = '9px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('小地图', mapX + mapSize / 2, mapY + mapSize + 12);
}

// ──────────────────────────── Touch Joystick ────────────────────────────

export function drawVirtualJoystick(rc: RenderContext, joystick: TouchJoystickState) {
  if (!joystick.active) return;

  const { ctx } = rc;
  const baseR = joystick.maxRadius;
  const knobR = Math.max(18, baseR * 0.38);
  const activeRatio = Math.min(1, joystick.distance / joystick.maxRadius);
  const alpha = 0.42 + activeRatio * 0.28;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;

  ctx.fillStyle = cachedRadialGradient(
    ctx,
    `touch-joy-base-${baseR}`,
    joystick.startX,
    joystick.startY,
    baseR * 0.18,
    joystick.startX,
    joystick.startY,
    baseR * 1.35,
    [
      [0, 'rgba(143,232,255,0.14)'],
      [0.62, 'rgba(143,232,255,0.07)'],
      [1, 'rgba(143,232,255,0)'],
    ]
  );
  ctx.beginPath();
  ctx.arc(joystick.startX, joystick.startY, baseR * 1.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(143,232,255,0.48)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joystick.startX, joystick.startY, baseR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,209,102,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(joystick.startX, joystick.startY, baseR * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  if (activeRatio > 0.05) {
    ctx.strokeStyle = 'rgba(143,232,255,0.38)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(joystick.startX, joystick.startY);
    ctx.lineTo(joystick.knobX, joystick.knobY);
    ctx.stroke();
  }

  ctx.shadowColor = 'rgba(143,232,255,0.8)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = cachedRadialGradient(
    ctx,
    `touch-joy-knob-${knobR}`,
    joystick.knobX,
    joystick.knobY,
    0,
    joystick.knobX,
    joystick.knobY,
    knobR,
    [
      [0, 'rgba(255,244,207,0.9)'],
      [0.48, 'rgba(143,232,255,0.75)'],
      [1, 'rgba(54,115,132,0.55)'],
    ]
  );
  ctx.beginPath();
  ctx.arc(joystick.knobX, joystick.knobY, knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(joystick.knobX, joystick.knobY, knobR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ──────────────────────────── Boss Bar ────────────────────────────

export function drawBossBar(rc: RenderContext, name: string, hp: number, maxHp: number) {
  const { ctx, w, h } = rc;
  const mobile = isMobileViewport(w, h);
  const barW = Math.min(mobile ? 250 : 400, w - (mobile ? 80 : 60));
  const barH = mobile ? 14 : 18;
  const barX = (w - barW) / 2;
  const barY = mobile ? 228 : 62;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, 10);
  ctx.fill();
  ctx.fillStyle = '#220000';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 6);
  ctx.fill();

  const ratio = Math.max(0, hp / maxHp);
  if (ratio > 0) {
    ctx.fillStyle = cachedLinearGradient(ctx, `boss-hp-${barW}-${barH}`, barX, barY, barX, barY + barH, [
      [0, '#ff4444'],
      [0.5, '#cc2222'],
      [1, '#881111'],
    ]);
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 6);
    ctx.fill();

    ctx.fillStyle = cachedLinearGradient(ctx, `boss-shine-${barW}-${barH}`, barX, barY, barX, barY + barH, [
      [0, 'rgba(255,255,255,0.25)'],
      [0.5, 'rgba(255,255,255,0.05)'],
      [1, 'rgba(0,0,0,0.1)'],
    ]);
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 6);
    ctx.fill();
  }

  ctx.font = `bold ${mobile ? 12 : 14}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#ff6666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`👹 ${name}`, w / 2, barY - 6);

  ctx.font = `${mobile ? 10 : 11}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, w / 2, barY + barH / 2);
}

// ──────────────────────────── Pause Button ────────────────────────────

export function drawPauseButton(rc: RenderContext) {
  const { ctx, w } = rc;
  const { x, y, w: size, h: buttonH } = getPauseButtonRect(w);
  drawHudIconButton(ctx, x, y, size, buttonH);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x + 10, y + 8, 5, 20);
  ctx.fillRect(x + 21, y + 8, 5, 20);
}

export function drawAudioButton(rc: RenderContext, muted: boolean) {
  const { ctx, w } = rc;
  const rect = getAudioButtonRect(w);
  drawHudIconButton(ctx, rect.x, rect.y, rect.w, rect.h);
  ctx.font = '18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = muted ? 'rgba(255,160,160,0.85)' : 'rgba(255,255,255,0.78)';
  ctx.fillText(muted ? '🔇' : '🔊', rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function drawHudIconButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();
}

/** 暂停按钮的命中区域（供 Input 判断） */
export function getPauseButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  const size = 36;
  return { x: w - size - 12, y: 8, w: size, h: size };
}

export function getAudioButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  const size = 36;
  return { x: w - size * 2 - 20, y: 8, w: size, h: size };
}

// ──────────────────────────── Overlays ────────────────────────────

const DESKTOP_FONT = '"Segoe UI", "PingFang SC", sans-serif';

type Rect = { x: number; y: number; w: number; h: number };

type MenuLayout = {
  content: Rect;
  rail: Rect;
};

const DESKTOP_TABS: DesktopTab[] = ['start', 'skins', 'growth', 'codex'];

export function getDesktopStartButtonRect(w: number, h: number): Rect {
  const btnW = Math.min(320, Math.max(240, w * 0.26));
  const btnH = 64;
  return {
    x: w / 2 - btnW / 2,
    y: h * 0.7,
    w: btnW,
    h: btnH,
  };
}

function getMenuLayout(w: number, h: number): MenuLayout {
  const marginX = Math.max(28, Math.min(72, w * 0.045));
  const railW = Math.min(710, w - marginX * 2);
  const railH = 70;
  const railY = Math.max(18, Math.min(32, h * 0.036));
  const contentTop = railY + railH + Math.max(20, h * 0.035);
  const bottom = Math.max(28, Math.min(48, h * 0.05));
  const contentW = Math.min(1180, w - marginX * 2);
  const contentH = Math.max(340, h - contentTop - bottom);
  const rail: Rect = {
    x: w / 2 - railW / 2,
    y: railY,
    w: railW,
    h: railH,
  };
  return {
    rail,
    content: {
      x: w / 2 - contentW / 2,
      y: contentTop,
      w: contentW,
      h: contentH,
    },
  };
}

export function drawDesktop(
  rc: RenderContext,
  meta: MetaState,
  activeTab: DesktopTab,
  activeCodexTab: CodexTab,
  hoveredStarId?: MetaUpgradeNode['id']
) {
  drawDesktopBackdrop(rc);

  if (activeTab === 'start') {
    drawStartButton(rc);
  } else if (activeTab === 'skins') {
    drawSkinPanel(rc, meta);
  } else if (activeTab === 'growth') {
    drawMetaGrowth(rc, meta, hoveredStarId);
  } else if (activeTab === 'codex') {
    drawCodexPanel(rc, activeCodexTab);
  }

  drawDesktopTabs(rc, activeTab);
}

export function getDesktopTabRects(w: number, h: number = 720): Array<Rect & { id: DesktopTab }> {
  const { rail } = getMenuLayout(w, h);
  const gap = 10;
  const tabH = 48;
  const tabW = Math.min(152, (rail.w - 24 - gap * (DESKTOP_TABS.length - 1)) / DESKTOP_TABS.length);
  const totalW = DESKTOP_TABS.length * tabW + (DESKTOP_TABS.length - 1) * gap;
  const startX = rail.x + rail.w / 2 - totalW / 2;
  const y = rail.y + rail.h / 2 - tabH / 2;
  return DESKTOP_TABS.map((id, index) => ({
    id,
    x: startX + index * (tabW + gap),
    y,
    w: tabW,
    h: tabH,
  }));
}

export function getMetaStarNodeRects(w: number, h: number = 720): Array<Rect & { id: MetaUpgradeNode['id'] }> {
  const panel = getMetaStarPanel(w, h);
  const scale = panel.scale;
  return META_UPGRADES.map((node) => {
    const r = node.kind === 'keystone' ? 24 : node.kind === 'notable' ? 19 : 15;
    const cx = panel.cx + node.x * scale;
    const cy = panel.cy + node.y * scale;
    return { id: node.id, x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
  });
}

function getSkinPanelRect(w: number, h: number): Rect {
  const { content } = getMenuLayout(w, h);
  const panelW = Math.min(1060, content.w);
  const panelH = Math.min(620, content.h);
  return {
    x: content.x + (content.w - panelW) / 2,
    y: content.y + (content.h - panelH) / 2,
    w: panelW,
    h: panelH,
  };
}

export function getSkinCardRects(w: number, h: number = 720): Array<Rect & { index: number }> {
  const panel = getSkinPanelRect(w, h);
  if (isMobileViewport(w, h)) {
    const gap = 10;
    const cardW = panel.w - 28;
    const cardH = Math.min(154, Math.max(126, (panel.h - 92 - gap * (CHARACTER_SKINS.length - 1)) / CHARACTER_SKINS.length));
    const startY = panel.y + 76;
    return CHARACTER_SKINS.map((_, index) => ({
      index,
      x: panel.x + 14,
      y: startY + index * (cardH + gap),
      w: cardW,
      h: cardH,
    }));
  }
  const gap = Math.max(18, Math.min(30, panel.w * 0.025));
  const innerW = panel.w - 72;
  const cardW = Math.min(286, Math.max(198, (innerW - gap * (CHARACTER_SKINS.length - 1)) / CHARACTER_SKINS.length));
  const cardH = Math.min(372, Math.max(302, panel.h - 152));
  const totalW = CHARACTER_SKINS.length * cardW + (CHARACTER_SKINS.length - 1) * gap;
  const startX = panel.x + panel.w / 2 - totalW / 2;
  const y = panel.y + 112;
  return CHARACTER_SKINS.map((_, index) => ({
    index,
    x: startX + index * (cardW + gap),
    y,
    w: cardW,
    h: cardH,
  }));
}

function getCodexPanelRect(w: number, h: number): Rect {
  const { content } = getMenuLayout(w, h);
  const panelW = Math.min(1120, content.w);
  const panelH = Math.min(650, content.h);
  return {
    x: content.x + (content.w - panelW) / 2,
    y: content.y + (content.h - panelH) / 2,
    w: panelW,
    h: panelH,
  };
}

export function getCodexTabRects(w: number, h: number = 720): Array<Rect & { id: CodexTab }> {
  const panel = getCodexPanelRect(w, h);
  const tabs: Array<{ id: CodexTab; label: string }> = [
    { id: 'weapons', label: '武器' },
    { id: 'passives', label: '被动' },
    { id: 'enemies', label: '怪物' },
    { id: 'modules', label: '模块' },
  ];
  const gap = 12;
  const tabW = Math.min(124, (panel.w - 56 - gap * (tabs.length - 1)) / tabs.length);
  const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
  const startX = panel.x + panel.w / 2 - totalW / 2;
  const y = panel.y + 76;
  return tabs.map((tab, index) => ({
    id: tab.id,
    x: startX + index * (tabW + gap),
    y,
    w: tabW,
    h: 40,
  }));
}

let lobbyBg: HTMLImageElement | null = null;
let lobbyBgReady = false;
function getLobbyBackground(): HTMLImageElement {
  if (!lobbyBg) {
    lobbyBg = new Image();
    lobbyBg.onload = () => { lobbyBgReady = true; };
    lobbyBg.src = '/lobby-bg.png';
  }
  return lobbyBg;
}

function drawDesktopBackdrop(rc: RenderContext) {
  const { ctx, w, h } = rc;
  ctx.fillStyle = '#05040a';
  ctx.fillRect(0, 0, w, h);
  const img = getLobbyBackground();
  if (lobbyBgReady && img.width > 0 && img.height > 0) {
    const scale = Math.max(w / img.width, h / img.height); // cover
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}

function drawStartButton(rc: RenderContext) {
  const { ctx, w, h } = rc;
  const b = getDesktopStartButtonRect(w, h);
  ctx.save();
  ctx.shadowColor = 'rgba(255,140,60,0.5)';
  ctx.shadowBlur = 22;
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  g.addColorStop(0, '#ffd270');
  g.addColorStop(1, '#ff7e3c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 14);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,246,205,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 14);
  ctx.stroke();
  ctx.font = `900 24px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#2a1206';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始夜潮', b.x + b.w / 2, b.y + b.h / 2);
}

// opaque card/panel so content reads clearly over the background image
function uiPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, r = 16) {
  ctx.fillStyle = 'rgba(10,9,16,0.86)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

function getBranchAccent(branch: MetaUpgradeNode['branch']): string {
  if (branch === 'ranged') return '#8fe8ff';
  if (branch === 'mechanism') return '#d3a8ff';
  if (branch === 'area') return '#9dffba';
  if (branch === 'damage') return '#ff9a76';
  return '#ffd166';
}

// ---- 衣橱 ----
function drawSkinPanel(rc: RenderContext, meta: MetaState) {
  const { ctx, w, h } = rc;
  const mobile = isMobileViewport(w, h);
  const panel = getSkinPanelRect(w, h);
  if (mobile) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `900 22px ${DESKTOP_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('衣橱', panel.x + 18, panel.y + 20);
  }
  const cards = getSkinCardRects(w, h);
  for (let i = 0; i < CHARACTER_SKINS.length; i++) {
    const skin = CHARACTER_SKINS[i];
    const c = cards[i];
    const selected = meta.selectedSkin === skin.id;
    ctx.save();
    if (selected) { ctx.shadowColor = `${skin.glow}0.5)`; ctx.shadowBlur = 24; }
    uiPanel(ctx, c.x, c.y, c.w, c.h, selected ? skin.outline : 'rgba(150,160,200,0.22)', 14);
    ctx.restore();

    if (mobile) {
      const avatarX = c.x + 52;
      const avatarY = c.y + c.h / 2;
      const avatarR = Math.min(34, c.h * 0.25);
      ctx.fillStyle = `${skin.glow}0.18)`;
      ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin.body;
      ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = skin.outline; ctx.lineWidth = 2.2; ctx.stroke();

      const textX = c.x + 96;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = `800 17px ${DESKTOP_FONT}`;
      ctx.fillStyle = selected ? '#ffd166' : '#ffffff';
      ctx.fillText(skin.name, textX, c.y + 18);
      ctx.font = `12px ${DESKTOP_FONT}`;
      ctx.fillStyle = 'rgba(200,210,235,0.72)';
      ctx.fillText(skin.archetype, textX, c.y + 43);
      ctx.fillStyle = 'rgba(190,200,225,0.66)';
      drawWrappedText(ctx, skin.desc, textX, c.y + 66, c.w - 116, 15, 2);

      const badgeW = 78;
      const badgeX = c.x + c.w - badgeW - 14;
      const badgeY = c.y + c.h - 34;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (selected) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.roundRect(badgeX, badgeY, badgeW, 24, 12); ctx.fill();
        ctx.fillStyle = '#2a1206'; ctx.font = `700 12px ${DESKTOP_FONT}`;
        ctx.fillText('已装备', badgeX + badgeW / 2, badgeY + 12);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(badgeX, badgeY, badgeW, 24, 12); ctx.stroke();
        ctx.fillStyle = 'rgba(225,232,250,0.82)'; ctx.font = `600 12px ${DESKTOP_FONT}`;
        ctx.fillText('装备', badgeX + badgeW / 2, badgeY + 12);
      }
      continue;
    }

    const ex = c.x + c.w / 2;
    const ey = c.y + c.h * 0.30;
    const er = Math.min(46, c.w * 0.20);
    ctx.fillStyle = `${skin.glow}0.18)`;
    ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin.body;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = skin.outline; ctx.lineWidth = 2.5; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 20px ${DESKTOP_FONT}`;
    ctx.fillStyle = selected ? '#ffd166' : '#ffffff';
    ctx.fillText(skin.name, ex, c.y + c.h * 0.56);
    ctx.font = `13px ${DESKTOP_FONT}`;
    ctx.fillStyle = 'rgba(200,210,235,0.7)';
    ctx.fillText(skin.archetype, ex, c.y + c.h * 0.56 + 24);

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = 'rgba(190,200,225,0.62)';
    drawWrappedText(ctx, skin.desc, c.x + 18, c.y + c.h * 0.72, c.w - 36, 17, 2);

    const by = c.y + c.h - 40;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (selected) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.roundRect(ex - 46, by, 92, 26, 13); ctx.fill();
      ctx.fillStyle = '#2a1206'; ctx.font = `700 13px ${DESKTOP_FONT}`;
      ctx.fillText('已装备', ex, by + 13);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(ex - 46, by, 92, 26, 13); ctx.stroke();
      ctx.fillStyle = 'rgba(225,232,250,0.82)'; ctx.font = `600 13px ${DESKTOP_FONT}`;
      ctx.fillText('点击装备', ex, by + 13);
    }
  }
}

// ---- 星图 ----
function drawMetaGrowth(rc: RenderContext, meta: MetaState, hoveredId?: MetaUpgradeNode['id']) {
  const { ctx, w, h } = rc;
  const panel = getMetaStarPanel(w, h);

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `900 24px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('星图', panel.x + 6, panel.y + 6);
  ctx.textAlign = 'right';
  ctx.font = `800 16px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`魂火 ${meta.soulFire}`, panel.x + panel.w - 6, panel.y + 10);

  uiPanel(ctx, panel.chart.x, panel.chart.y, panel.chart.w, panel.chart.h, 'rgba(143,232,255,0.18)', 16);

  const centers = new Map<MetaUpgradeNode['id'], { x: number; y: number }>();
  for (const n of META_UPGRADES) centers.set(n.id, { x: panel.cx + n.x * panel.scale, y: panel.cy + n.y * panel.scale });

  ctx.lineCap = 'round';
  for (const n of META_UPGRADES) {
    const to = centers.get(n.id)!;
    for (const req of n.requires ?? []) {
      const from = centers.get(req);
      if (!from) continue;
      const owned = hasMetaUpgrade(meta, n.id);
      const acc = getBranchAccent(n.branch);
      ctx.strokeStyle = owned ? colorWithAlpha(acc, 0.8) : colorWithAlpha(acc, 0.22);
      ctx.lineWidth = owned ? 3 : 1.6;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
  }

  for (const n of META_UPGRADES) {
    const c = centers.get(n.id)!;
    const owned = hasMetaUpgrade(meta, n.id);
    const avail = canBuyMetaUpgrade(meta, n);
    const hov = hoveredId === n.id;
    const acc = getBranchAccent(n.branch);
    const r = n.kind === 'keystone' ? 22 : n.kind === 'notable' ? 18 : 14;
    ctx.save();
    if (owned || hov) { ctx.shadowColor = colorWithAlpha(acc, owned ? 0.7 : 0.4); ctx.shadowBlur = owned ? 20 : 12; }
    ctx.fillStyle = owned ? colorWithAlpha(acc, 0.55) : avail ? colorWithAlpha(acc, 0.2) : 'rgba(18,22,34,0.95)';
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = owned ? '#9dffba' : hov ? acc : avail ? colorWithAlpha(acc, 0.6) : 'rgba(150,160,196,0.3)';
    ctx.lineWidth = owned ? 2.4 : hov ? 2 : 1.3;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `${n.kind === 'keystone' ? 20 : 15}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = owned ? '#ffffff' : avail ? '#eef8ff' : 'rgba(210,220,245,0.4)';
    ctx.fillText(n.icon, c.x, c.y + 1);
    if (avail && !owned) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(c.x + r * 0.6, c.y - r * 0.6, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawMetaDetail(ctx, panel.detail, meta, META_UPGRADES.find((n) => n.id === hoveredId));
}

function drawMetaDetail(ctx: CanvasRenderingContext2D, rect: Rect, meta: MetaState, node?: MetaUpgradeNode) {
  uiPanel(ctx, rect.x, rect.y, rect.w, rect.h, 'rgba(255,255,255,0.12)', 16);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const compact = rect.h < 230 || rect.w < 310;
  if (!node) {
    const owned = meta.unlockedUpgrades.length;
    const avail = META_UPGRADES.filter((n) => canBuyMetaUpgrade(meta, n)).length;
    ctx.font = `900 ${compact ? 18 : 22}px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('星点详情', rect.x + 18, rect.y + 16);
    ctx.font = `${compact ? 12 : 14}px ${DESKTOP_FONT}`; ctx.fillStyle = 'rgba(224,236,255,0.62)';
    drawWrappedText(ctx, '点星点查看消耗、效果与解锁内容。', rect.x + 18, rect.y + (compact ? 46 : 62), rect.w - 36, compact ? 17 : 22, compact ? 2 : 3);
    ctx.font = `800 ${compact ? 12 : 14}px ${DESKTOP_FONT}`; ctx.fillStyle = '#9dffba';
    ctx.fillText(`已点亮 ${owned}`, rect.x + 18, rect.y + (compact ? 104 : 142));
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`可点亮 ${avail}`, rect.x + (compact ? 104 : 22), rect.y + (compact ? 104 : 168));
    return;
  }
  const owned = hasMetaUpgrade(meta, node.id);
  const avail = canBuyMetaUpgrade(meta, node);
  const acc = getBranchAccent(node.branch);
  ctx.font = `${compact ? 28 : 38}px serif`; ctx.fillStyle = owned ? '#ffffff' : colorWithAlpha(acc, 0.85);
  ctx.fillText(node.icon, rect.x + 18, rect.y + (compact ? 16 : 24));
  ctx.font = `900 ${compact ? 17 : 22}px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
  ctx.fillText(node.name, rect.x + (compact ? 58 : 74), rect.y + (compact ? 20 : 30));
  ctx.font = `800 ${compact ? 11 : 13}px ${DESKTOP_FONT}`;
  ctx.fillStyle = owned ? '#9dffba' : avail ? '#ffd166' : '#8fa7d8';
  ctx.fillText(owned ? '已点亮' : avail ? '可点亮' : '未解锁', rect.x + (compact ? 58 : 74), rect.y + (compact ? 44 : 58));
  ctx.font = `800 ${compact ? 11 : 13}px ${DESKTOP_FONT}`; ctx.fillStyle = acc;
  ctx.fillText(`消耗 ${node.cost} 魂火`, rect.x + 18, rect.y + (compact ? 72 : 96));
  ctx.font = `${compact ? 12 : 14}px ${DESKTOP_FONT}`; ctx.fillStyle = 'rgba(229,237,255,0.76)';
  drawWrappedText(ctx, node.desc, rect.x + 18, rect.y + (compact ? 94 : 124), rect.w - 36, compact ? 16 : 21, compact ? 2 : 4);
  if (!compact) {
    ctx.font = `800 13px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('局内效果', rect.x + 22, rect.y + 228);
    ctx.font = `14px ${DESKTOP_FONT}`; ctx.fillStyle = colorWithAlpha(acc, 0.95);
    drawWrappedText(ctx, node.effect, rect.x + 22, rect.y + 252, rect.w - 44, 21, 2);
  } else {
    ctx.font = `12px ${DESKTOP_FONT}`; ctx.fillStyle = colorWithAlpha(acc, 0.95);
    drawWrappedText(ctx, node.effect, rect.x + 18, rect.y + rect.h - 40, rect.w - 36, 16, 2);
  }
}

// ---- 图鉴 ----
function getCodexAccent(tab: CodexTab): string {
  if (tab === 'passives') return '#9dffba';
  if (tab === 'enemies') return '#ff7a76';
  if (tab === 'modules') return '#d3a8ff';
  return '#ffb36b';
}

type CodexCard = { icon: string; title: string; tag: string; desc: string; accent: string };

function getCodexCards(tab: CodexTab): CodexCard[] {
  if (tab === 'weapons') {
    return Object.values(WEAPON_DATA).map((d) => ({ icon: d.icon, title: d.name, tag: `${d.family} · 最高Lv.${d.maxLevel ?? '∞'}`, desc: d.desc, accent: '#ff9999' }));
  }
  if (tab === 'passives') {
    return Object.values(PASSIVE_DATA).map((d) => ({ icon: d.icon, title: d.name, tag: `上限Lv.${d.maxLevel}`, desc: d.desc, accent: '#88ff88' }));
  }
  if (tab === 'enemies') {
    return Object.values(ENEMY_DATA).map((d) => ({ icon: '◇', title: d.name, tag: `魂晶${d.xpValue} · ${d.spawnAfter}s`, desc: `HP ${d.baseHp} / 伤害 ${d.baseDamage} / 速度 ${d.baseSpeed}`, accent: d.color }));
  }
  return Object.values(GENERIC_MODIFIER_DATA).map((d) => ({ icon: d.icon, title: d.name, tag: `${d.trigger}→${d.effect}`, desc: d.desc, accent: '#d3a8ff' }));
}

function drawCodexPanel(rc: RenderContext, activeTab: CodexTab) {
  const { ctx, w, h } = rc;
  const mobile = isMobileViewport(w, h);
  const panel = getCodexPanelRect(w, h);
  uiPanel(ctx, panel.x, panel.y, panel.w, panel.h, 'rgba(211,168,255,0.2)', 18);

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `900 ${mobile ? 22 : 24}px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
  ctx.fillText('图鉴', panel.x + (mobile ? 18 : 26), panel.y + (mobile ? 18 : 22));

  drawCodexTabs(rc, activeTab);

  const cards = getCodexCards(activeTab);
  const cols = mobile ? 2 : panel.w >= 1040 ? 4 : 3;
  const gap = mobile ? 10 : 16;
  const cardW = (panel.w - 56 - gap * (cols - 1)) / cols;
  const rows = Math.ceil(cards.length / cols);
  const cardH = mobile
    ? Math.min(118, Math.max(94, (panel.h - 140 - gap * Math.max(0, rows - 1)) / rows))
    : Math.min(150, Math.max(122, (panel.h - 158 - gap * 2) / 3));
  const totalW = cols * cardW + (cols - 1) * gap;
  const sx = panel.x + panel.w / 2 - totalW / 2;
  const sy = panel.y + (mobile ? 118 : 128);
  for (let i = 0; i < cards.length; i++) {
    const cd = cards[i];
    const x = sx + (i % cols) * (cardW + gap);
    const y = sy + Math.floor(i / cols) * (cardH + gap);
    ctx.fillStyle = 'rgba(16,18,30,0.92)';
    ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 10); ctx.fill();
    ctx.strokeStyle = colorWithAlpha(cd.accent, 0.6); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 10); ctx.stroke();
    ctx.fillStyle = colorWithAlpha(cd.accent, 0.16);
    ctx.beginPath(); ctx.arc(x + (mobile ? 26 : 34), y + (mobile ? 30 : 36), mobile ? 18 : 22, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${mobile ? 20 : 24}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText(cd.icon, x + (mobile ? 26 : 34), y + (mobile ? 31 : 37));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${mobile ? 12 : 15}px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
    ctx.fillText(cd.title, x + (mobile ? 50 : 66), y + (mobile ? 25 : 30));
    ctx.font = `${mobile ? 9 : 11}px ${DESKTOP_FONT}`; ctx.fillStyle = cd.accent;
    ctx.fillText(cd.tag, x + (mobile ? 50 : 66), y + (mobile ? 41 : 48));
    ctx.textBaseline = 'top';
    ctx.font = `${mobile ? 10 : 12}px ${DESKTOP_FONT}`; ctx.fillStyle = 'rgba(190,199,230,0.85)';
    drawWrappedText(ctx, cd.desc, x + 12, y + (mobile ? 56 : 66), cardW - 24, mobile ? 13 : 16, mobile ? 2 : 2);
  }
}

function drawCodexTabs(rc: RenderContext, activeTab: CodexTab) {
  const { ctx, w, h } = rc;
  const tabs: Array<{ id: CodexTab; label: string }> = [
    { id: 'weapons', label: '武器' },
    { id: 'passives', label: '被动' },
    { id: 'enemies', label: '怪物' },
    { id: 'modules', label: '模块' },
  ];
  const rects = getCodexTabRects(w, h);
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    const r = rects[i];
    const active = t.id === activeTab;
    const acc = getCodexAccent(t.id);
    ctx.fillStyle = active ? colorWithAlpha(acc, 0.24) : 'rgba(17,24,38,0.85)';
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = active ? acc : 'rgba(120,135,180,0.4)';
    ctx.lineWidth = active ? 1.8 : 1;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.font = `700 14px ${DESKTOP_FONT}`;
    ctx.fillStyle = active ? '#ffffff' : 'rgba(225,232,250,0.8)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.label, r.x + r.w / 2, r.y + r.h / 2);
  }
}

function drawDesktopTabs(rc: RenderContext, activeTab: DesktopTab) {
  const { ctx, w, h } = rc;
  const labels: Record<DesktopTab, string> = {
    start: '出征',
    skins: '衣橱',
    growth: '星图',
    codex: '图鉴',
  };
  const icons: Record<DesktopTab, string> = {
    start: '✦',
    skins: '●',
    growth: '◆',
    codex: '▣',
  };
  const { rail } = getMenuLayout(w, h);
  const tabs = getDesktopTabRects(w, h);

  ctx.fillStyle = 'rgba(3,7,13,0.64)';
  ctx.beginPath();
  ctx.roundRect(rail.x, rail.y, rail.w, rail.h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(rail.x, rail.y, rail.w, rail.h, 14);
  ctx.stroke();

  for (const tab of tabs) {
    const { x, y, w: tabW, h: tabH } = tab;
    const active = tab.id === activeTab;
    const compact = tabW < 96;
    ctx.fillStyle = active
      ? cachedLinearGradient(ctx, `menu-tab-${tab.id}-${x}-${y}`, x, y, x, y + tabH, [
        [0, 'rgba(255,209,102,0.34)'],
        [1, 'rgba(146,76,36,0.28)'],
      ])
      : 'rgba(255,255,255,0.055)';
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 10);
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255,209,102,0.82)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = active ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 10);
    ctx.stroke();

    if (active) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x + 18, y + tabH - 4, tabW - 36, 3);
    }

    ctx.font = compact ? `800 15px ${DESKTOP_FONT}` : `800 17px ${DESKTOP_FONT}`;
    ctx.fillStyle = active ? '#fff4cf' : 'rgba(235,240,255,0.72)';
    ctx.textAlign = compact ? 'center' : 'left';
    ctx.textBaseline = 'middle';
    if (!compact) {
      ctx.font = `18px serif`;
      ctx.fillStyle = active ? '#fff4cf' : 'rgba(235,240,255,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(icons[tab.id], x + 20, y + tabH / 2);
      ctx.font = `800 17px ${DESKTOP_FONT}`;
      ctx.fillStyle = active ? '#fff4cf' : 'rgba(235,240,255,0.72)';
    }
    ctx.fillText(labels[tab.id], compact ? x + tabW / 2 : x + 48, y + tabH / 2);
  }
}

function getMetaStarPanel(w: number, h: number) {
  const { content } = getMenuLayout(w, h);
  const panelW = Math.min(1120, content.w);
  const panelH = Math.min(650, content.h);
  const panelX = content.x + (content.w - panelW) / 2;
  const panelY = content.y + (content.h - panelH) / 2;
  if (isMobileViewport(w, h)) {
    const innerPad = 14;
    const detailH = Math.min(190, Math.max(150, panelH * 0.28));
    const chart: Rect = {
      x: panelX + innerPad,
      y: panelY + 64,
      w: panelW - innerPad * 2,
      h: Math.max(220, panelH - detailH - 90),
    };
    const detail: Rect = {
      x: chart.x,
      y: chart.y + chart.h + 10,
      w: chart.w,
      h: detailH,
    };
    return {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      chart,
      detail,
      cx: chart.x + chart.w * 0.5,
      cy: chart.y + chart.h * 0.52,
      scale: Math.min(chart.w * 0.42, chart.h * 0.38),
    };
  }
  const innerPad = 32;
  const detailW = Math.min(330, Math.max(278, panelW * 0.29));
  const chart: Rect = {
    x: panelX + innerPad,
    y: panelY + 90,
    w: panelW - detailW - innerPad * 3,
    h: panelH - 126,
  };
  const detail: Rect = {
    x: chart.x + chart.w + innerPad,
    y: chart.y,
    w: detailW,
    h: chart.h,
  };
  return {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    chart,
    detail,
    cx: chart.x + chart.w * 0.5,
    cy: chart.y + chart.h * 0.52,
    scale: Math.min(chart.w * 0.44, chart.h * 0.42),
  };
}

function colorWithAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  const raw = color.slice(1);
  const hex = raw.length === 3
    ? raw.split('').map((char) => char + char).join('')
    : raw.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(hex, 16);
  if (Number.isNaN(value)) return color;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const wrappedLines = getWrappedLines(ctx, text, maxWidth, maxLines);
  wrappedLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function getWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    const next = line + char;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) return lines;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export function drawPaused(rc: RenderContext) {
  const { ctx, w, h } = rc;
  const mobile = isMobileViewport(w, h);

  ctx.fillStyle = cachedRadialGradient(ctx, `paused-overlay-${w}-${h}`, w / 2, h / 2, 0, w / 2, h / 2, w * 0.5, [
    [0, 'rgba(0,0,20,0.7)'],
    [1, 'rgba(0,0,0,0.85)'],
  ]);
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(100,100,150,0.8)';
  ctx.fillRect(w / 2 - 25, h / 2 - 50, 15, 60);
  ctx.fillRect(w / 2 + 10, h / 2 - 50, 15, 60);

  ctx.font = 'bold 44px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂停', w / 2, h / 2 + 30);

  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText(mobile ? '点按屏幕继续' : '按 ESC 或 P 继续', w / 2, h / 2 + 70);
}

export function drawUpgradeScreen(
  rc: RenderContext,
  options: UpgradeOption[],
  selectedIndex: number,
  shards: number,
  canFreeReroll: boolean,
  rerollCost: number,
  canPaidReroll: boolean
) {
  const { ctx, w, h } = rc;
  const layout = getShopLayout(w, h, options.length);

  ctx.fillStyle = cachedRadialGradient(ctx, `upgrade-overlay-${w}-${h}`, w / 2, h / 2, 0, w / 2, h / 2, w * 0.7, [
    [0, 'rgba(0,0,30,0.85)'],
    [1, 'rgba(0,0,0,0.95)'],
  ]);
  ctx.fillRect(0, 0, w, h);

  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 12;
  ctx.font = `bold ${layout.mobile ? 26 : 34}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('升级商店', w / 2, layout.titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = `bold ${layout.mobile ? 15 : 18}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#8fe8ff';
  ctx.fillText(`魂晶 ${Math.floor(shards)}`, w / 2, layout.shardsY);

  ctx.font = `${layout.mobile ? 12 : 13}px "Segoe UI", sans-serif`;
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText(layout.mobile ? '点卡片购买，点按钮刷新或继续' : '可连续购买多个成长，买完后继续战斗', w / 2, layout.helperY);

  for (const card of layout.cards) {
    const opt = options[card.index];
    const x = card.x;
    const y = card.y;
    const cardW = card.w;
    const cardH = card.h;
    const selected = card.index === selectedIndex;
    const affordable = shards >= opt.cost;
    const sold = !!opt.purchased;
    const unavailable = sold || !affordable;
    const isModifier = opt.type === 'modifier';
    const rarity = UPGRADE_RARITY_DATA[opt.rarity];
    const accent = rarity.color;
    const accentDark = rarity.darkColor;

    ctx.save();
    ctx.translate(x, y);
    const compact = layout.compact;
    const ultraCompact = cardH < 132;
    const iconGlowY = ultraCompact ? 28 : compact ? 34 : 46;
    const iconY = ultraCompact ? 34 : compact ? 40 : 53;
    const iconGlowR = ultraCompact ? 20 : compact ? 24 : 32;
    const titleY = ultraCompact ? 66 : compact ? 76 : 96;
    const descY = ultraCompact ? 84 : compact ? 98 : 122;
    const lineHeight = ultraCompact ? 13 : compact ? 15 : 18;
    const maxLines = ultraCompact ? 1 : compact ? 2 : 3;
    const typeY = ultraCompact ? cardH - 50 : compact ? cardH - 56 : 180;
    const priceY = cardH - (compact ? 32 : 38);
    const priceH = compact ? 24 : 26;

    if (selected) {
      ctx.shadowColor = affordable && !sold ? '#ffd166' : '#6666ff';
      ctx.shadowBlur = 16;
    }

    const cardStops: Array<[number, string]> =
      sold ? [
        [0, 'rgba(45,85,60,0.92)'],
        [1, 'rgba(25,50,35,0.92)'],
      ] : [
        [0, colorWithAlpha(accent, selected ? 0.3 : 0.18)],
        [0.42, colorWithAlpha(accentDark, selected ? 0.62 : 0.42)],
        [1, selected ? 'rgba(22,24,46,0.96)' : 'rgba(20,22,38,0.92)'],
      ];
    const cardGrad = cachedLinearGradient(ctx, `upgrade-card-${sold}-${opt.rarity}-${selected}-${cardH}`, 0, 0, 0, cardH, cardStops);
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 8);
    ctx.fill();

    ctx.strokeStyle = selected ? accent : colorWithAlpha(accent, 0.45);
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 8);
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (unavailable) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.roundRect(0, 0, cardW, cardH, 8);
      ctx.fill();
    }

    ctx.fillStyle = colorWithAlpha(accent, unavailable ? 0.14 : selected ? 0.28 : 0.2);
    ctx.beginPath();
    ctx.arc(cardW / 2, iconGlowY, iconGlowR, 0, Math.PI * 2);
    ctx.fill();

    const rarityBadgeW = compact ? 42 : 48;
    const rarityBadgeH = compact ? 19 : 22;
    ctx.fillStyle = colorWithAlpha(accent, sold ? 0.16 : 0.22);
    ctx.beginPath();
    ctx.roundRect(cardW - rarityBadgeW - 10, 10, rarityBadgeW, rarityBadgeH, 8);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(accent, sold ? 0.38 : 0.65);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cardW - rarityBadgeW - 10, 10, rarityBadgeW, rarityBadgeH, 8);
    ctx.stroke();
    ctx.font = `bold ${compact ? 10 : 11}px "Segoe UI", sans-serif`;
    ctx.fillStyle = unavailable ? colorWithAlpha(accent, 0.75) : accent;
    ctx.fillText(rarity.label, cardW - rarityBadgeW / 2 - 10, 10 + rarityBadgeH / 2);

    ctx.font = `${ultraCompact ? 28 : compact ? 34 : 42}px serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = unavailable ? 'rgba(255,255,255,0.65)' : COLORS.uiText;
    ctx.fillText(opt.icon, cardW / 2, iconY);

    ctx.font = `bold ${compact ? 13 : 15}px "Segoe UI", sans-serif`;
    ctx.fillStyle = unavailable ? '#999999' : selected ? '#ffffff' : '#dddddd';
    ctx.fillText(opt.title, cardW / 2, titleY);

    ctx.font = `${compact ? 11 : 12}px "Segoe UI", sans-serif`;
    ctx.fillStyle = unavailable ? '#888888' : '#aaaaaa';
    const words = opt.description.split('');
    let line = '';
    let lineY = descY;
    let lines = 0;
    const maxLineWidth = cardW - 30;
    for (const char of words) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxLineWidth) {
        ctx.fillText(line, cardW / 2, lineY);
        line = char;
        lineY += lineHeight;
        lines++;
        if (lines >= maxLines) break;
      } else {
        line = testLine;
      }
    }
    if (line && lines < maxLines) ctx.fillText(line, cardW / 2, lineY);

    const badgeText = opt.type === 'weapon' ? '⚔️ 武器' :
                      opt.type === 'passive' ? '🛡️ 被动' :
                      opt.type === 'modifier' ? '✦ 通用模块' :
                      opt.type === 'supply' ? '✚ 战术补给' : '❤️ 治疗';
    ctx.font = `${compact ? 10 : 11}px "Segoe UI", sans-serif`;
    ctx.fillStyle = opt.type === 'weapon' ? '#ff9999' :
                    opt.type === 'passive' ? '#88ff88' :
                    opt.type === 'modifier' ? '#d3a8ff' :
                    opt.type === 'supply' ? '#ffd166' : '#ffb3c1';
    ctx.fillText(badgeText, cardW / 2, typeY);

    const priceW = cardW - 34;
    const priceX = 17;
    ctx.fillStyle = sold ? 'rgba(68,255,136,0.14)' : affordable ? 'rgba(255,209,102,0.14)' : 'rgba(255,80,80,0.14)';
    ctx.beginPath();
    ctx.roundRect(priceX, priceY, priceW, priceH, 13);
    ctx.fill();
    ctx.strokeStyle = sold ? '#44ff88' : affordable ? '#ffd166' : '#ff7777';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(priceX, priceY, priceW, priceH, 13);
    ctx.stroke();
    ctx.font = `bold ${compact ? 11 : 13}px "Segoe UI", sans-serif`;
    ctx.fillStyle = sold ? '#88ff88' : affordable ? '#ffd166' : '#ff8888';
    ctx.fillText(sold ? (isModifier ? '已安装' : '已购买') : `${rarity.label} · 魂晶 ${opt.cost}`, cardW / 2, priceY + priceH / 2);

    ctx.restore();
  }

  const rerollButton = layout.rerollButton;
  const continueButton = layout.continueButton;
  const canReroll = canFreeReroll || (canPaidReroll && shards >= rerollCost);
  const rerollLabel = canFreeReroll ? '免费刷新' : canPaidReroll ? `刷新 魂晶 ${rerollCost}` : '刷新未解锁';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = canReroll ? 'rgba(255,209,102,0.18)' : 'rgba(80,80,100,0.45)';
  ctx.beginPath();
  ctx.roundRect(rerollButton.x, rerollButton.y, rerollButton.w, rerollButton.h, 8);
  ctx.fill();
  ctx.strokeStyle = canReroll ? '#ffd166' : 'rgba(160,160,180,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rerollButton.x, rerollButton.y, rerollButton.w, rerollButton.h, 8);
  ctx.stroke();
  ctx.font = `bold ${layout.mobile ? 13 : 14}px "Segoe UI", sans-serif`;
  ctx.fillStyle = canReroll ? '#ffd166' : '#999999';
  ctx.fillText(rerollLabel, rerollButton.x + rerollButton.w / 2, rerollButton.y + rerollButton.h / 2);

  ctx.fillStyle = 'rgba(100,140,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(continueButton.x, continueButton.y, continueButton.w, continueButton.h, 8);
  ctx.fill();
  ctx.strokeStyle = '#88aaff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(continueButton.x, continueButton.y, continueButton.w, continueButton.h, 8);
  ctx.stroke();
  ctx.fillStyle = '#dde6ff';
  ctx.fillText('继续战斗', continueButton.x + continueButton.w / 2, continueButton.y + continueButton.h / 2);

  ctx.font = `${layout.mobile ? 11 : 14}px "Segoe UI", sans-serif`;
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText(
    layout.mobile ? '点选卡片后自动购买' : '← → 选择 | Enter 购买 | R 刷新 | Space/Esc 继续',
    w / 2,
    layout.footerY
  );
}

export function drawGameOver(rc: RenderContext, stats: {
  time: number;
  kills: number;
  level: number;
  weaponNames: string[];
  soulFireEarned: number;
  totalSoulFire: number;
  deathCause?: string;
  advice?: string;
}) {
  const { ctx, w, h } = rc;
  const isVictory = stats.time >= 900;
  const time = Date.now() * 0.001;

  ctx.fillStyle = cachedRadialGradient(ctx, `gameover-bg-${w}-${h}`, w / 2, h / 2, 0, w / 2, h / 2, w * 0.7, [
    [0, 'rgba(0,0,20,0.9)'],
    [1, 'rgba(0,0,0,0.98)'],
  ]);
  ctx.fillRect(0, 0, w, h);

  ctx.shadowColor = isVictory ? '#ffd700' : '#ff4444';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 52px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isVictory ? '#ffd700' : COLORS.danger;
  ctx.fillText(isVictory ? '🏆 胜利! 🏆' : '💀 游戏结束 💀', w / 2, h / 2 - 130);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  if (isVictory) {
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#88ff88';
    ctx.fillText('你成功存活了15分钟!', w / 2, h / 2 - 75);
  }

  const containerW = 300;
  const containerH = 270;
  const containerX = w / 2 - containerW / 2;
  const containerY = h / 2 - 40;

  ctx.fillStyle = 'rgba(30,30,60,0.8)';
  ctx.beginPath();
  ctx.roundRect(containerX, containerY, containerW, containerH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,100,150,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(containerX, containerY, containerW, containerH, 12);
  ctx.stroke();

  ctx.font = '22px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiText;
  const minutes = Math.floor(stats.time / 60);
  const seconds = Math.floor(stats.time % 60);
  const statsY = containerY + 30;

  ctx.textAlign = 'left';
  ctx.fillText('⏱️ 存活时间:', containerX + 20, statsY);
  ctx.textAlign = 'right';
  ctx.fillText(`${minutes}分${seconds}秒`, containerX + containerW - 20, statsY);
  ctx.textAlign = 'left';
  ctx.fillText('💀 击杀数:', containerX + 20, statsY + 40);
  ctx.textAlign = 'right';
  ctx.fillText(`${stats.kills}`, containerX + containerW - 20, statsY + 40);
  ctx.textAlign = 'left';
  ctx.fillText('⭐ 等级:', containerX + 20, statsY + 80);
  ctx.textAlign = 'right';
  ctx.fillText(`${stats.level}`, containerX + containerW - 20, statsY + 80);
  ctx.textAlign = 'left';
  ctx.fillText('🔥 魂火:', containerX + 20, statsY + 120);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`+${stats.soulFireEarned} / ${stats.totalSoulFire}`, containerX + containerW - 20, statsY + 120);
  ctx.fillStyle = COLORS.uiText;
  ctx.textAlign = 'left';
  ctx.fillText('⚔️ 武器:', containerX + 20, statsY + 160);
  ctx.textAlign = 'right';
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText(stats.weaponNames.join(', ') || '无', containerX + containerW - 20, statsY + 160);

  ctx.font = '14px "Segoe UI", sans-serif';
  if (stats.deathCause) {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.uiDim;
    ctx.fillText('死因:', containerX + 20, statsY + 194);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff9a76';
    ctx.fillText(stats.deathCause, containerX + containerW - 20, statsY + 194);
  }
  if (stats.advice) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fe8ff';
    drawWrappedText(ctx, stats.advice, containerX + 20, statsY + 218, containerW - 40, 17, 2);
  }

  const btnW = 200;
  const btnH = 45;
  const btnX = w / 2 - btnW / 2;
  const btnY = Math.min(h - 70, containerY + containerH + 24);

  ctx.fillStyle = 'rgba(60,60,160,0.8)';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.strokeStyle = '#6666ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.stroke();

  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('返回桌面', w / 2, btnY + btnH / 2);
}
