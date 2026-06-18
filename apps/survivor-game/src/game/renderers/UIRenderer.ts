import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, UpgradeOption } from '../types';
import { COLORS, WEAPON_DATA, PASSIVE_DATA, ENEMY_DATA, GENERIC_MODIFIER_DATA } from '../constants';
import {
  type CodexTab, type DesktopTab, type MetaState,
  META_UPGRADES, CHARACTER_SKINS, hasMetaUpgrade, canBuyMetaUpgrade,
} from '../systems/meta/MetaProgression';

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
  const padding = 16;
  const barW = Math.min(320, w - 32);
  const barH = 14;
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

  // Level badge
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX, barY + barH + 6, 50, 24, 6);
  ctx.fill();
  ctx.strokeStyle = '#44ff44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(barX, barY + barH + 6, 50, 24, 6);
  ctx.stroke();
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillStyle = '#44ff44';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${player.level}`, barX + 25, barY + barH + 18);

  // HP display
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX + 60, barY + barH + 6, 120, 24, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(barX + 60, barY + barH + 6, 120, 24, 6);
  ctx.stroke();
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.danger;
  ctx.textAlign = 'center';
  ctx.fillText(`❤️ ${Math.ceil(player.hp)}/${player.maxHp}`, barX + 120, barY + barH + 18);

  // Gold display
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX + 190, barY + barH + 6, 86, 24, 6);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(barX + 190, barY + barH + 6, 86, 24, 6);
  ctx.stroke();
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'center';
  ctx.fillText(`🪙 ${player.gold}`, barX + 233, barY + barH + 18);

  // Phase indicator
  const phase = elapsed < 60 ? '初期' : elapsed < 180 ? '前期' : elapsed < 300 ? '中期' : elapsed < 600 ? '后期' : '终局';
  const phaseColor = elapsed < 60 ? '#88ff88' : elapsed < 180 ? '#ffff88' : elapsed < 300 ? '#ffaa44' : elapsed < 600 ? '#ff6644' : '#ff4444';

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(w - 100, 12, 88, 28, 6);
  ctx.fill();
  ctx.strokeStyle = phaseColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(w - 100, 12, 88, 28, 6);
  ctx.stroke();
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillStyle = phaseColor;
  ctx.textAlign = 'center';
  ctx.fillText(`阶段: ${phase}`, w - 56, 26);

  // Timer (top center)
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 50, 8, 100, 32, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 50, 8, 100, 32, 8);
  ctx.stroke();
  ctx.font = 'bold 22px "Segoe UI", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.uiText;
  ctx.fillText(timeStr, w / 2, 24);

  // Kill count
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(w - 100, 48, 88, 24, 6);
  ctx.fill();
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText(`💀 ${killCount}`, w - 56, 60);

  if (objective) {
    const toastW = Math.min(460, w - 48);
    const toastX = w / 2 - toastW / 2;
    const toastY = 50;
    ctx.fillStyle = 'rgba(5,10,22,0.82)';
    ctx.beginPath();
    ctx.roundRect(toastX, toastY, toastW, 34, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.58)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(toastX, toastY, toastW, 34, 8);
    ctx.stroke();
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(objective, w / 2, toastY + 17);
  }

  // Weapon icons (bottom left)
  const weaponY = h - 55;
  for (let i = 0; i < player.weapons.length; i++) {
    const wep = player.weapons[i];
    const data = WEAPON_DATA[wep.type];
    const wx = padding + i * 44;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(wx, weaponY, 40, 40, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,100,150,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(wx, weaponY, 40, 40, 8);
    ctx.stroke();

    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.uiText;
    ctx.fillText(data.icon, wx + 20, weaponY + 20);

    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(wx + 34, weaponY + 34, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx + 34, weaponY + 34, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.fillStyle = '#44ff44';
    ctx.fillText(`${wep.level}`, wx + 34, weaponY + 34);
  }

  // Passive icons (bottom right)
  if (player.passives.length > 0) {
    const passiveY = h - 55;
    const passiveStartX = w - padding - 40;
    for (let i = 0; i < player.passives.length; i++) {
      const pa = player.passives[i];
      const data = PASSIVE_DATA[pa.type];
      const px = passiveStartX - i * 44;

      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.roundRect(px, passiveY, 40, 40, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,150,100,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px, passiveY, 40, 40, 8);
      ctx.stroke();

      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.uiText;
      ctx.fillText(data.icon, px + 20, passiveY + 18);

      ctx.font = 'bold 9px "Segoe UI", sans-serif';
      ctx.fillStyle = '#88ff88';
      ctx.fillText(`${pa.level}`, px + 20, passiveY + 34);
    }
  }
}

// ──────────────────────────── Minimap ────────────────────────────

export function drawMinimap(rc: RenderContext, player: Player, enemies: Enemy[]) {
  const { ctx, w } = rc;
  const mapSize = 110;
  const mapX = w - mapSize - 16;
  const mapY = 85;
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

// ──────────────────────────── Boss Bar ────────────────────────────

export function drawBossBar(rc: RenderContext, name: string, hp: number, maxHp: number) {
  const { ctx, w } = rc;
  const barW = Math.min(400, w - 60);
  const barH = 18;
  const barX = (w - barW) / 2;
  const barY = 48;

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

  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ff6666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`👹 ${name}`, w / 2, barY - 6);

  ctx.font = '11px "Segoe UI", sans-serif';
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

type DesktopStartLayout = {
  compact: boolean;
  hero: Rect;
  left: Rect;
  stage: Rect;
  button: Rect;
};

export function getDesktopStartButtonRect(w: number, h: number): Rect {
  return getDesktopStartLayout(w, h).button;
}

function getDesktopStartLayout(w: number, h: number): DesktopStartLayout {
  const compact = w < 760;
  const side = compact ? 22 : Math.max(44, Math.min(78, w * 0.06));
  const heroX = side;
  const heroY = compact ? 132 : 138;
  const heroW = Math.max(280, w - side * 2);
  const heroH = Math.max(compact ? 430 : 470, Math.min(compact ? 590 : 610, h - heroY - 62));
  const leftW = compact ? heroW - 52 : Math.min(560, heroW * 0.48);
  const left: Rect = {
    x: heroX + (compact ? 26 : 44),
    y: heroY + (compact ? 28 : 46),
    w: leftW,
    h: compact ? 156 : heroH - 106,
  };
  const stage: Rect = compact
    ? { x: heroX + 18, y: heroY + 190, w: heroW - 36, h: Math.max(184, heroH - 348) }
    : { x: heroX + leftW + 36, y: heroY + 34, w: heroW - leftW - 68, h: heroH - 78 };
  const button: Rect = compact
    ? { x: heroX + 26, y: heroY + heroH - 76, w: Math.min(268, heroW - 52), h: 56 }
    : { x: heroX + 44, y: heroY + heroH - 84, w: 270, h: 58 };

  return {
    compact,
    hero: { x: heroX, y: heroY, w: heroW, h: heroH },
    left,
    stage,
    button,
  };
}

export function drawDesktop(rc: RenderContext, meta: MetaState, activeTab: DesktopTab, activeCodexTab: CodexTab) {
  const { ctx, w, h } = rc;
  const time = Date.now() * 0.001;

  drawDesktopBackdrop(rc, time);
  drawDesktopHeader(rc, meta);

  drawDesktopTabs(rc, activeTab);

  if (activeTab === 'start') {
    drawDesktopStart(rc, meta, time);
  } else if (activeTab === 'growth') {
    drawMetaGrowth(rc, meta);
  } else if (activeTab === 'skins') {
    drawSkinPanel(rc, meta);
  } else {
    drawCodexPanel(rc, activeCodexTab);
  }

  ctx.font = `12px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(220,230,255,0.42)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('远征档案同步完成 · 商店矩阵待命 · 图鉴数据库在线', w / 2, h - 18);
}

export function getDesktopTabRects(w: number): Array<Rect & { id: DesktopTab }> {
  const tabs: DesktopTab[] = ['start', 'growth', 'skins', 'codex'];
  const tabGap = w < 620 ? 8 : 12;
  const tabH = 42;
  const tabW = Math.min(132, Math.max(74, (w - 44 - (tabs.length - 1) * tabGap) / tabs.length));
  const totalW = tabs.length * tabW + (tabs.length - 1) * tabGap;
  const startX = w / 2 - totalW / 2;
  const y = 82;
  return tabs.map((id, index) => ({
    id,
    x: startX + index * (tabW + tabGap),
    y,
    w: tabW,
    h: tabH,
  }));
}

function drawDesktopBackdrop(rc: RenderContext, time: number) {
  const { ctx, w, h } = rc;
  ctx.fillStyle = cachedLinearGradient(ctx, `desktop-bg-${w}-${h}`, 0, 0, w, h, [
    [0, '#050711'],
    [0.42, '#0d1727'],
    [0.72, '#151322'],
    [1, '#06080d'],
  ]);
  ctx.fillRect(0, 0, w, h);

  const horizonY = h * 0.56;
  ctx.fillStyle = cachedLinearGradient(ctx, `desktop-horizon-${w}-${h}`, 0, horizonY - 90, 0, horizonY + 140, [
    [0, 'rgba(143,232,255,0)'],
    [0.38, 'rgba(143,232,255,0.08)'],
    [0.48, 'rgba(255,209,102,0.18)'],
    [0.56, 'rgba(255,122,69,0.1)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.fillRect(0, horizonY - 90, w, 230);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = 'rgba(255,209,102,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = horizonY + i * 34 + Math.sin(time * 0.5 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y - i * 5);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = 'rgba(143,232,255,0.2)';
  ctx.lineWidth = 1;
  const vanishingX = w * 0.58;
  const vanishingY = horizonY - 8;
  for (let i = -9; i <= 9; i++) {
    const x = w / 2 + i * 78 + Math.sin(time * 0.18 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(vanishingX, vanishingY);
    ctx.lineTo(x, h + 40);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const y = vanishingY + Math.pow(t, 1.9) * (h - vanishingY + 70);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.58;
  for (let i = 0; i < 38; i++) {
    const x = ((i * 127.1 + time * 10) % (w + 180)) - 90;
    const y = 84 + ((i * 53.7 + time * 4) % Math.max(220, h * 0.52));
    const len = 12 + (i % 4) * 5;
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(255,209,102,0.32)' : 'rgba(143,232,255,0.22)';
    ctx.lineWidth = i % 4 === 0 ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - len * 0.24);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(255,209,102,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, horizonY + 2);
  ctx.lineTo(w * 0.3, horizonY - 30);
  ctx.lineTo(w * 0.46, horizonY + 2);
  ctx.lineTo(w * 0.64, horizonY - 44);
  ctx.lineTo(w * 0.86, horizonY + 6);
  ctx.stroke();
  ctx.restore();
}

function drawDesktopHeader(rc: RenderContext, meta: MetaState) {
  const { ctx, w } = rc;
  const compact = w < 760;
  const x = compact ? 24 : 36;
  const y = 22;
  const panelW = Math.min(520, w - 72);
  const titleGrad = cachedLinearGradient(ctx, `desktop-title-${x}-${y}-${panelW}`, x, y, x + panelW, y, [
    [0, '#fff3b8'],
    [0.5, '#ffd166'],
    [1, '#8fe8ff'],
  ]);

  ctx.save();
  ctx.shadowColor = 'rgba(255,209,102,0.32)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = titleGrad;
  ctx.font = `${compact ? 800 : 900} ${compact ? 26 : 34}px ${DESKTOP_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('暗夜幸存者', x + 58, y + 1);
  ctx.restore();

  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y + 2, 42, 42, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.62)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x, y + 2, 42, 42, 10);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.font = '24px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', x + 21, y + 24);

  ctx.font = `12px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(210,224,255,0.62)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('局外远征指挥台', x + 60, y + 41);

  if (compact) return;

  const pillY = 24;
  drawInfoPill(ctx, w - 346, pillY, 94, '魂火', `${meta.soulFire}`, '#ffd166');
  drawInfoPill(ctx, w - 244, pillY, 92, '局数', `${meta.runs}`, '#8fe8ff');
  drawInfoPill(ctx, w - 144, pillY, 108, '最高击杀', `${meta.bestKills}`, '#ff9a76');
}

function drawDesktopTabs(rc: RenderContext, activeTab: DesktopTab) {
  const { ctx, w } = rc;
  const labels: Record<DesktopTab, string> = {
    start: '作战',
    growth: '成长',
    skins: '皮肤',
    codex: '图鉴',
  };
  const tabs = getDesktopTabRects(w);

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const { x, y, w: tabW, h: tabH } = tab;
    const active = tab.id === activeTab;
    const tabGrad = cachedLinearGradient(ctx, `desktop-tab-${active}-${x}-${y}-${tabH}`, x, y, x, y + tabH, active ? [
      [0, 'rgba(255,209,102,0.32)'],
      [1, 'rgba(255,122,69,0.16)'],
    ] : [
      [0, 'rgba(25,33,55,0.82)'],
      [1, 'rgba(12,17,30,0.82)'],
    ]);
    ctx.save();
    if (active) {
      ctx.shadowColor = 'rgba(255,209,102,0.25)';
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = tabGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 10);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = active ? 'rgba(255,226,142,0.92)' : 'rgba(119,143,196,0.34)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 10);
    ctx.stroke();
    ctx.fillStyle = active ? 'rgba(255,209,102,0.8)' : 'rgba(120,150,210,0.36)';
    ctx.fillRect(x + 14, y + tabH - 5, tabW - 28, 2);
    ctx.font = `700 15px ${DESKTOP_FONT}`;
    ctx.fillStyle = active ? '#ffd166' : COLORS.uiText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}  ${labels[tab.id]}`, x + tabW / 2, y + tabH / 2);
  }
}

function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.34)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = cachedLinearGradient(ctx, `glass-shine-${x}-${y}-${w}-${h}`, x, y, x, y + h, [
    [0, 'rgba(255,255,255,0.1)'],
    [0.22, 'rgba(255,255,255,0.03)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, radius - 1);
  ctx.fill();

  ctx.strokeStyle = 'rgba(160,184,235,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

function drawPanelAccent(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, accent: string) {
  ctx.fillStyle = cachedLinearGradient(ctx, `panel-accent-${accent}-${x}-${y}-${w}`, x, y, x + w, y, [
    [0, colorWithAlpha(accent, 0)],
    [0.24, colorWithAlpha(accent, 0.74)],
    [0.76, colorWithAlpha(accent, 0.36)],
    [1, colorWithAlpha(accent, 0)],
  ]);
  ctx.beginPath();
  ctx.roundRect(x + 18, y, w - 36, 3, 2);
  ctx.fill();
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, subtitle: string) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 24px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, x, y);
  ctx.font = `13px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(213,224,255,0.64)';
  ctx.fillText(subtitle, x, y + 34);
}

function drawInfoPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  accent: string
) {
  ctx.fillStyle = 'rgba(10,15,27,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 42, 12);
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(accent, 0.42);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 42, 12);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `11px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(213,224,255,0.55)';
  ctx.fillText(label, x + 12, y + 7);
  ctx.font = `800 18px ${DESKTOP_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(value, x + 12, y + 20);
}

function drawMetricTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: string
) {
  ctx.fillStyle = 'rgba(8,12,24,0.54)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(accent, 0.26);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = colorWithAlpha(accent, 0.14);
  ctx.fillRect(x + 1, y + 1, 4, h - 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `11px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(213,224,255,0.58)';
  ctx.fillText(label, x + 14, y + 9);
  ctx.font = `800 22px ${DESKTOP_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(value, x + 14, y + 25);
}

function drawSmallPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, accent: string) {
  ctx.fillStyle = colorWithAlpha(accent, 0.13);
  ctx.beginPath();
  ctx.roundRect(x, y, w, 24, 12);
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(accent, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 24, 12);
  ctx.stroke();
  ctx.font = `700 12px ${DESKTOP_FONT}`;
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + 12);
}

function getBranchAccent(branch: 'shop' | 'build' | 'risk'): string {
  if (branch === 'build') return '#d3a8ff';
  if (branch === 'risk') return '#ff6b85';
  return '#8fe8ff';
}

function getCodexAccent(tab: CodexTab): string {
  if (tab === 'passives') return '#9dffba';
  if (tab === 'enemies') return '#ff7a76';
  if (tab === 'modules') return '#d3a8ff';
  return '#ffb36b';
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

function drawDesktopStart(rc: RenderContext, meta: MetaState, time: number) {
  const { ctx, w, h } = rc;
  const layout = getDesktopStartLayout(w, h);
  const { hero, left, stage, button, compact } = layout;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.48)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = cachedLinearGradient(ctx, `hero-shell-${hero.x}-${hero.y}-${hero.w}-${hero.h}`, hero.x, hero.y, hero.x + hero.w, hero.y + hero.h, [
    [0, 'rgba(18,27,45,0.82)'],
    [0.42, 'rgba(10,16,29,0.62)'],
    [1, 'rgba(24,14,24,0.76)'],
  ]);
  ctx.beginPath();
  ctx.roundRect(hero.x, hero.y, hero.w, hero.h, compact ? 22 : 30);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,209,102,0.32)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hero.x, hero.y, hero.w, hero.h, compact ? 22 : 30);
  ctx.stroke();
  drawPanelAccent(ctx, hero.x, hero.y, hero.w, '#ffd166');

  const skin = CHARACTER_SKINS.find((item) => item.id === meta.selectedSkin) ?? CHARACTER_SKINS[0];
  drawHeroBattleScene(ctx, stage, skin, time, compact);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${compact ? 13 : 15}px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText('NIGHTFALL COMMAND', left.x, left.y);

  ctx.save();
  ctx.shadowColor = 'rgba(255,209,102,0.28)';
  ctx.shadowBlur = 18;
  ctx.font = `900 ${compact ? 38 : 68}px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('暗夜幸存者', left.x, left.y + (compact ? 24 : 30));
  ctx.restore();

  if (!compact) {
    ctx.font = `800 34px ${DESKTOP_FONT}`;
    ctx.fillStyle = '#8fe8ff';
    ctx.fillText('远征指挥台', left.x, left.y + 100);
  }

  ctx.font = `${compact ? 13 : 15}px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(229,237,255,0.76)';
  drawWrappedText(
    ctx,
    compact ? '带着全局成长进入夜潮。' : '带着全局成长、商店机制和武器模块进入夜潮，把每一局变成下一次远征的筹码。',
    left.x,
    left.y + (compact ? 78 : 150),
    compact ? left.w : Math.min(520, left.w),
    compact ? 20 : 22,
    compact ? 2 : 3
  );

  const bestMinutes = Math.floor(meta.bestTime / 60);
  const bestSeconds = Math.floor(meta.bestTime % 60).toString().padStart(2, '0');
  const stats: Array<[string, string, string]> = [
    ['魂火储备', `${meta.soulFire}`, '#ffd166'],
    ['点亮节点', `${meta.unlockedUpgrades.length}/${META_UPGRADES.length}`, '#8fe8ff'],
    ['最佳时间', `${bestMinutes}:${bestSeconds}`, '#ff9a76'],
    ['最高击杀', `${meta.bestKills}`, '#ff6b85'],
  ];
  if (compact && hero.h > 520) {
    const compactStats = [stats[0], stats[3]];
    const statY = button.y - 58;
    const statW = (button.w - 10) / 2;
    for (let i = 0; i < compactStats.length; i++) {
      drawHeroMetric(ctx, button.x + i * (statW + 10), statY, statW, 44, compactStats[i][0], compactStats[i][1], compactStats[i][2]);
    }
  } else if (!compact) {
    drawLoadoutStrip(ctx, left.x, left.y + 206);
    const statY = button.y - 82;
    for (let i = 0; i < stats.length; i++) {
      drawHeroMetric(ctx, left.x + i * 136, statY, 124, 50, stats[i][0], stats[i][1], stats[i][2]);
    }
  }

  ctx.save();
  ctx.shadowColor = 'rgba(255,209,102,0.28)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = cachedLinearGradient(ctx, `start-btn-${button.x}-${button.y}-${button.h}`, button.x, button.y, button.x, button.y + button.h, [
    [0, '#ffd166'],
    [0.5, '#e99345'],
    [1, '#ba5f36'],
  ]);
  ctx.beginPath();
  ctx.roundRect(button.x, button.y, button.w, button.h, 14);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(button.x, button.y, button.w, button.h, 14);
  ctx.stroke();

  ctx.font = `900 ${compact ? 18 : 21}px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#151018';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始新一局', button.x + button.w / 2 - 8, button.y + button.h / 2);
  ctx.fillStyle = 'rgba(21,16,24,0.72)';
  ctx.beginPath();
  ctx.moveTo(button.x + button.w - 42, button.y + button.h / 2 - 7);
  ctx.lineTo(button.x + button.w - 28, button.y + button.h / 2);
  ctx.lineTo(button.x + button.w - 42, button.y + button.h / 2 + 7);
  ctx.closePath();
  ctx.fill();

  if (!compact) {
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = 'rgba(229,237,255,0.52)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`当前外观：${skin.name} · ${skin.archetype}`, button.x + button.w + 22, button.y + button.h / 2);
  }
}

function drawLoadoutStrip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const items = [
    ['🪄', '魔法弹幕', '#ffb36b'],
    ['🪙', '商店构筑', '#ffd166'],
    ['✦', '模块机制', '#d3a8ff'],
  ];
  for (let i = 0; i < items.length; i++) {
    const itemX = x + i * 104;
    ctx.fillStyle = 'rgba(8,12,24,0.52)';
    ctx.beginPath();
    ctx.roundRect(itemX, y, 92, 32, 10);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(items[i][2], 0.32);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(itemX, y, 92, 32, 10);
    ctx.stroke();
    ctx.font = '16px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(items[i][0], itemX + 10, y + 16);
    ctx.font = `700 11px ${DESKTOP_FONT}`;
    ctx.fillStyle = items[i][2];
    ctx.fillText(items[i][1], itemX + 34, y + 16);
  }
}

function drawHeroMetric(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: string
) {
  ctx.fillStyle = 'rgba(5,9,18,0.56)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(accent, 0.32);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = colorWithAlpha(accent, 0.82);
  ctx.fillRect(x + 12, y + 9, 22, 2);
  ctx.font = `10px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(216,228,255,0.58)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 12, y + 16);
  ctx.font = `800 ${h < 46 ? 16 : 18}px ${DESKTOP_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(value, x + 12, y + (h < 46 ? 25 : 28));
}

function drawHeroBattleScene(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  skin: (typeof CHARACTER_SKINS)[number],
  time: number,
  compact: boolean
) {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const floorY = y + h * 0.72;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, compact ? 18 : 24);
  ctx.clip();

  ctx.fillStyle = cachedLinearGradient(ctx, `hero-stage-bg-${x}-${y}-${w}-${h}`, x, y, x, y + h, [
    [0, 'rgba(4,8,18,0.18)'],
    [0.46, 'rgba(12,21,38,0.64)'],
    [1, 'rgba(5,8,14,0.92)'],
  ]);
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = cachedLinearGradient(ctx, `hero-stage-haze-${x}-${y}-${w}-${h}`, x, y + h * 0.18, x + w, y + h * 0.78, [
    [0, `${skin.glow}0.02)`],
    [0.45, `${skin.glow}0.22)`],
    [1, 'rgba(255,209,102,0.04)'],
  ]);
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(143,232,255,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const yy = floorY + i * 22;
    ctx.beginPath();
    ctx.moveTo(x + 24 + i * 8, yy);
    ctx.lineTo(x + w - 24 - i * 8, yy);
    ctx.stroke();
  }
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, floorY - 18);
    ctx.lineTo(cx + i * w * 0.16, y + h + 22);
    ctx.stroke();
  }
  ctx.restore();

  const enemies: Array<[number, number, number, string]> = [
    [-0.36, -0.1, 13, '#ff6b6b'],
    [-0.28, 0.24, 9, '#ff9a76'],
    [0.32, -0.08, 11, '#b277ff'],
    [0.38, 0.25, 8, '#88ff88'],
    [0.06, -0.34, 7, '#ffd166'],
  ];
  for (let i = 0; i < enemies.length; i++) {
    const [dx, dy, r, color] = enemies[i];
    const pulse = 1 + Math.sin(time * 2.2 + i) * 0.08;
    ctx.fillStyle = colorWithAlpha(color, 0.14);
    ctx.beginPath();
    ctx.arc(cx + dx * w, floorY + dy * h, r * 2.1 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colorWithAlpha(color, 0.72);
    ctx.beginPath();
    ctx.arc(cx + dx * w, floorY + dy * h, r * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = `${skin.glow}0.5)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, floorY + 36, compact ? 70 : 96, compact ? 15 : 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,209,102,0.28)';
  ctx.beginPath();
  ctx.arc(cx, floorY - 24, compact ? 78 : 110, -0.75, 0.45);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(143,232,255,0.24)';
  ctx.beginPath();
  ctx.arc(cx, floorY - 24, compact ? 106 : 150, Math.PI + 0.25, Math.PI * 1.84);
  ctx.stroke();

  drawSkinPreview(ctx, skin.id, cx, floorY - (compact ? 34 : 46) + Math.sin(time * 2.1) * 3, compact ? 1.7 : 2.75, skin.body, skin.outline);

  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 12px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(213,224,255,0.62)';
  ctx.fillText('SELECTED SURVIVOR', x + 20, y + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('15:00', x + w - 20, y + 18);

  ctx.textAlign = 'center';
  ctx.font = `900 ${compact ? 18 : 22}px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(skin.name, cx, y + h - (compact ? 42 : 56));
  ctx.font = `12px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(213,224,255,0.68)';
  ctx.fillText(skin.archetype, cx, y + h - (compact ? 22 : 34));
}

function drawMetaGrowth(rc: RenderContext, meta: MetaState) {
  const { ctx, w } = rc;
  const panelW = Math.min(840, w - 72);
  const panelX = w / 2 - panelW / 2;
  const panelY = 142;
  drawGlassPanel(ctx, panelX, panelY, panelW, 470, 18, 'rgba(13,18,32,0.68)');
  drawPanelAccent(ctx, panelX, panelY, panelW, '#8fe8ff');
  drawSectionTitle(ctx, panelX + 30, panelY + 26, '全局成长', '解锁会影响商店、开局资源和构筑机制。');
  drawInfoPill(ctx, panelX + panelW - 164, panelY + 26, 132, '可用魂火', `${meta.soulFire}`, '#ffd166');

  const cardW = 210;
  const cardH = 112;
  const gap = 14;
  const columns = 3;
  const totalW = columns * cardW + (columns - 1) * gap;
  const startX = w / 2 - totalW / 2;
  const startY = 222;

  for (let i = 0; i < META_UPGRADES.length; i++) {
    const node = META_UPGRADES[i];
    const x = startX + (i % columns) * (cardW + gap);
    const y = startY + Math.floor(i / columns) * (cardH + gap);
    const owned = hasMetaUpgrade(meta, node.id);
    const available = canBuyMetaUpgrade(meta, node);
    const locked = !owned && !available;
    const accent = getBranchAccent(node.branch);
    const cardGrad = cachedLinearGradient(ctx, `growth-card-${owned}-${available}-${x}-${y}-${cardH}`, x, y, x, y + cardH, [
      [0, owned ? 'rgba(35,92,64,0.92)' : available ? 'rgba(42,47,78,0.94)' : 'rgba(30,38,60,0.84)'],
      [1, owned ? 'rgba(15,45,34,0.92)' : available ? 'rgba(20,25,44,0.94)' : 'rgba(16,21,34,0.84)'],
    ]);
    ctx.save();
    if (available) {
      ctx.shadowColor = colorWithAlpha(accent, 0.22);
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = owned ? '#55dd88' : available ? accent : 'rgba(130,150,190,0.38)';
    ctx.lineWidth = owned || available ? 1.7 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.stroke();

    ctx.fillStyle = colorWithAlpha(accent, locked ? 0.11 : 0.18);
    ctx.fillRect(x + 1, y + 1, 5, cardH - 2);
    ctx.fillStyle = colorWithAlpha(accent, locked ? 0.08 : 0.16);
    ctx.beginPath();
    ctx.arc(x + 34, y + 34, 23, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '24px serif';
    ctx.fillStyle = locked ? '#9ba9c8' : COLORS.uiText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.icon, x + 14, y + 30);
    ctx.font = `700 14px ${DESKTOP_FONT}`;
    ctx.fillStyle = locked ? '#c5cde0' : '#ffffff';
    ctx.fillText(node.name, x + 48, y + 24);
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = owned ? '#88ffaa' : available ? '#ffd166' : '#adb7d0';
    ctx.textAlign = 'right';
    ctx.fillText(owned ? '已点亮' : `魂火 ${node.cost}`, x + cardW - 14, y + 24);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = locked ? '#b4bfd8' : '#d9e4ff';
    drawWrappedText(ctx, node.effect, x + 14, y + 55, cardW - 28, 16, 2);
    ctx.fillStyle = locked ? '#8794b0' : '#9fb0d8';
    drawWrappedText(ctx, node.desc, x + 14, y + 84, cardW - 28, 14, 2);
  }
}

function drawSkinPanel(rc: RenderContext, meta: MetaState) {
  const { ctx, w } = rc;
  const panelW = Math.min(910, w - 72);
  const panelX = w / 2 - panelW / 2;
  const panelY = 142;
  drawGlassPanel(ctx, panelX, panelY, panelW, 430, 18, 'rgba(13,18,32,0.68)');
  drawPanelAccent(ctx, panelX, panelY, panelW, '#ff9a76');
  drawSectionTitle(ctx, panelX + 30, panelY + 26, '角色皮肤', '皮肤改变局内轮廓、预览姿态和辨识形态，不提供数值。');

  const cardW = 236;
  const cardH = 318;
  const gap = 18;
  const totalW = CHARACTER_SKINS.length * cardW + (CHARACTER_SKINS.length - 1) * gap;
  const startX = w / 2 - totalW / 2;
  const y = 218;
  for (let i = 0; i < CHARACTER_SKINS.length; i++) {
    const skin = CHARACTER_SKINS[i];
    const x = startX + i * (cardW + gap);
    const selected = meta.selectedSkin === skin.id;
    const cardGrad = cachedLinearGradient(ctx, `skin-card-${skin.id}-${selected}-${x}-${y}-${cardH}`, x, y, x, y + cardH, [
      [0, selected ? `${skin.glow}0.28)` : 'rgba(31,38,62,0.9)'],
      [0.44, 'rgba(15,20,35,0.92)'],
      [1, 'rgba(8,11,20,0.94)'],
    ]);
    ctx.save();
    if (selected) {
      ctx.shadowColor = `${skin.glow}0.44)`;
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 16);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = selected ? skin.outline : 'rgba(128,154,210,0.34)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 16);
    ctx.stroke();

    ctx.fillStyle = `${skin.glow}0.16)`;
    ctx.beginPath();
    ctx.arc(x + cardW / 2, y + 96, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${skin.glow}0.38)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + cardW / 2, y + 158, 68, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawSkinPreview(ctx, skin.id, x + cardW / 2, y + 106, 1.78, skin.body, skin.outline);

    ctx.font = `800 19px ${DESKTOP_FONT}`;
    ctx.fillStyle = selected ? '#ffd166' : COLORS.uiText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(skin.name, x + cardW / 2, y + 190);
    drawSmallPill(ctx, x + 48, y + 210, cardW - 96, skin.archetype, selected ? skin.outline : '#8fa7d8');
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = 'rgba(213,224,255,0.68)';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, skin.desc, x + 24, y + 258, cardW - 48, 17, 2);
    if (selected) {
      ctx.font = `700 12px ${DESKTOP_FONT}`;
      ctx.fillStyle = '#10131c';
      ctx.beginPath();
      ctx.roundRect(x + cardW / 2 - 42, y + cardH - 34, 84, 24, 12);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.fillStyle = '#10131c';
      ctx.textAlign = 'center';
      ctx.fillText('已装备', x + cardW / 2, y + cardH - 22);
    }
  }
}

function drawCodexPanel(rc: RenderContext, activeTab: CodexTab) {
  const { ctx, w } = rc;
  const panelW = Math.min(980, w - 72);
  const panelX = w / 2 - panelW / 2;
  const panelY = 142;
  drawGlassPanel(ctx, panelX, panelY, panelW, 470, 18, 'rgba(13,18,32,0.68)');
  drawPanelAccent(ctx, panelX, panelY, panelW, '#d3a8ff');
  drawSectionTitle(ctx, panelX + 30, panelY + 24, '总体图鉴', '武器、被动、怪物和机制模块分册整理。');
  drawCodexTabs(rc, activeTab);
  drawCodexCards(rc, activeTab);
}

function drawCodexTabs(rc: RenderContext, activeTab: CodexTab) {
  const { ctx, w } = rc;
  const tabs: Array<{ id: CodexTab; label: string }> = [
    { id: 'weapons', label: '武器' },
    { id: 'passives', label: '被动' },
    { id: 'enemies', label: '怪物' },
    { id: 'modules', label: '模块' },
  ];
  const tabW = 128;
  const tabH = 38;
  const gap = 12;
  const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
  const startX = w / 2 - totalW / 2;
  const y = 214;

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const x = startX + i * (tabW + gap);
    const active = tab.id === activeTab;
    const accent = getCodexAccent(tab.id);
    ctx.fillStyle = active ? colorWithAlpha(accent, 0.2) : 'rgba(24,30,52,0.74)';
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 10);
    ctx.fill();
    ctx.strokeStyle = active ? accent : 'rgba(100,120,170,0.38)';
    ctx.lineWidth = active ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 10);
    ctx.stroke();
    ctx.font = `700 14px ${DESKTOP_FONT}`;
    ctx.fillStyle = active ? '#ffffff' : COLORS.uiText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tab.label, x + tabW / 2, y + tabH / 2);
  }
}

type CodexCard = {
  icon: string;
  title: string;
  tag: string;
  desc: string;
  accent: string;
};

function drawCodexCards(rc: RenderContext, tab: CodexTab) {
  const { ctx, w } = rc;
  const cards = getCodexCards(tab);
  const columns = w >= 980 ? 4 : 3;
  const cardW = w >= 980 ? 202 : 214;
  const cardH = 126;
  const gap = 14;
  const totalW = columns * cardW + (columns - 1) * gap;
  const startX = w / 2 - totalW / 2;
  const startY = 272;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const x = startX + (i % columns) * (cardW + gap);
    const y = startY + Math.floor(i / columns) * (cardH + gap);
    ctx.fillStyle = cachedLinearGradient(ctx, `codex-card-${card.accent}-${x}-${y}-${cardH}`, x, y, x, y + cardH, [
      [0, colorWithAlpha(card.accent, 0.1)],
      [0.28, 'rgba(26,33,54,0.94)'],
      [1, 'rgba(11,15,27,0.94)'],
    ]);
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 13);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(card.accent, 0.72);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 13);
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha(card.accent, 0.11);
    ctx.fillRect(x + 1, y + 1, cardW - 2, 4);
    ctx.fillStyle = colorWithAlpha(card.accent, 0.16);
    ctx.beginPath();
    ctx.arc(x + 36, y + 39, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '27px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.uiText;
    ctx.fillText(card.icon, x + 36, y + 40);
    ctx.font = `700 14px ${DESKTOP_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(card.title, x + 68, y + 29);
    ctx.font = `11px ${DESKTOP_FONT}`;
    ctx.fillStyle = card.accent;
    ctx.fillText(card.tag, x + 68, y + 50);
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = '#bac7e6';
    drawWrappedText(ctx, card.desc, x + 18, y + 82, cardW - 36, 16, 2);
  }
}

function getCodexCards(tab: CodexTab): CodexCard[] {
  if (tab === 'weapons') {
    return Object.values(WEAPON_DATA).map((data) => ({
      icon: data.icon,
      title: data.name,
      tag: `${data.family} | Lv.${data.maxLevel}`,
      desc: data.desc,
      accent: '#ff9999',
    }));
  }
  if (tab === 'passives') {
    return Object.values(PASSIVE_DATA).map((data) => ({
      icon: data.icon,
      title: data.name,
      tag: `上限 Lv.${data.maxLevel}`,
      desc: data.desc,
      accent: '#88ff88',
    }));
  }
  if (tab === 'enemies') {
    return Object.values(ENEMY_DATA).map((data) => ({
      icon: '◇',
      title: data.name,
      tag: `XP ${data.xpValue} | ${data.spawnAfter}s`,
      desc: `HP ${data.baseHp} / 伤害 ${data.baseDamage} / 速度 ${data.baseSpeed}`,
      accent: data.color,
    }));
  }
  return Object.values(GENERIC_MODIFIER_DATA).map((data) => ({
    icon: data.icon,
    title: data.name,
    tag: `${data.trigger} → ${data.effect}`,
    desc: data.desc,
    accent: '#d3a8ff',
  }));
}

function drawSkinPreview(
  ctx: CanvasRenderingContext2D,
  skinId: string,
  x: number,
  y: number,
  scale: number,
  body: string,
  outline: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (skinId === 'ember') {
    drawEmberAvatar(ctx, 0, 0, body, outline, 1);
  } else if (skinId === 'oracle') {
    drawOracleAvatar(ctx, 0, 0, body, outline, 1);
  } else {
    drawWandererAvatar(ctx, 0, 0, body, outline, 1);
  }
  ctx.restore();
}

function drawWandererAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: string,
  outline: string,
  scale: number
) {
  const r = 24 * scale;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - 7 * scale, y - 4 * scale, 5 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 8 * scale, y - 4 * scale, 5 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(x - 6 * scale, y - 4 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 9 * scale, y - 4 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawEmberAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: string,
  outline: string,
  scale: number
) {
  ctx.fillStyle = 'rgba(255,120,40,0.18)';
  ctx.beginPath();
  ctx.moveTo(x, y - 44 * scale);
  ctx.lineTo(x + 18 * scale, y - 16 * scale);
  ctx.lineTo(x + 8 * scale, y - 18 * scale);
  ctx.lineTo(x + 28 * scale, y + 14 * scale);
  ctx.lineTo(x, y + 34 * scale);
  ctx.lineTo(x - 28 * scale, y + 14 * scale);
  ctx.lineTo(x - 8 * scale, y - 18 * scale);
  ctx.lineTo(x - 18 * scale, y - 16 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x, y - 30 * scale);
  ctx.lineTo(x + 30 * scale, y);
  ctx.lineTo(x, y + 32 * scale);
  ctx.lineTo(x - 30 * scale, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();

  ctx.fillStyle = '#fff2b0';
  ctx.beginPath();
  ctx.arc(x, y - 2 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,20,0,0.55)';
  ctx.fillRect(x - 10 * scale, y + 13 * scale, 20 * scale, 4 * scale);
}

function drawOracleAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: string,
  outline: string,
  scale: number
) {
  ctx.strokeStyle = 'rgba(215,204,255,0.75)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.ellipse(x, y - 32 * scale, 28 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(30,20,70,0.8)';
  ctx.beginPath();
  ctx.moveTo(x, y - 30 * scale);
  ctx.quadraticCurveTo(x + 34 * scale, y - 8 * scale, x + 24 * scale, y + 34 * scale);
  ctx.lineTo(x - 24 * scale, y + 34 * scale);
  ctx.quadraticCurveTo(x - 34 * scale, y - 8 * scale, x, y - 30 * scale);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x, y - 23 * scale);
  ctx.lineTo(x + 21 * scale, y + 18 * scale);
  ctx.lineTo(x, y + 31 * scale);
  ctx.lineTo(x - 21 * scale, y + 18 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.3 * scale;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - 2 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#302060';
  ctx.beginPath();
  ctx.arc(x, y - 2 * scale, 4 * scale, 0, Math.PI * 2);
  ctx.fill();
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
  let line = '';
  let lines = 0;
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = char;
      lines++;
      if (lines >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

export function drawPaused(rc: RenderContext) {
  const { ctx, w, h } = rc;

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
  ctx.fillText('按 ESC 或 P 继续', w / 2, h / 2 + 70);
}

export function drawUpgradeScreen(
  rc: RenderContext,
  options: UpgradeOption[],
  selectedIndex: number,
  gold: number,
  canFreeReroll: boolean,
  rerollCost: number,
  canPaidReroll: boolean
) {
  const { ctx, w, h } = rc;

  ctx.fillStyle = cachedRadialGradient(ctx, `upgrade-overlay-${w}-${h}`, w / 2, h / 2, 0, w / 2, h / 2, w * 0.7, [
    [0, 'rgba(0,0,30,0.85)'],
    [1, 'rgba(0,0,0,0.95)'],
  ]);
  ctx.fillRect(0, 0, w, h);

  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 12;
  ctx.font = 'bold 34px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('升级商店', w / 2, h / 2 - 180);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`🪙 ${gold}`, w / 2, h / 2 - 142);

  const cardGap = 12;
  const optionCount = Math.max(options.length, 1);
  const cardW = Math.min(180, (w - 90) / optionCount - cardGap);
  const cardH = 230;
  const totalW = options.length * (cardW + cardGap) - cardGap;
  const startX = (w - totalW) / 2;
  const cardY = h / 2 - cardH / 2 - 5;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const x = startX + i * (cardW + cardGap);
    const y = cardY;
    const selected = i === selectedIndex;
    const affordable = gold >= opt.cost;
    const sold = !!opt.purchased;
    const unavailable = sold || !affordable;
    const isModifier = opt.type === 'modifier';

    ctx.save();
    ctx.translate(x, y);

    if (selected) {
      ctx.shadowColor = affordable && !sold ? '#ffd166' : '#6666ff';
      ctx.shadowBlur = 16;
    }

    const cardStops: Array<[number, string]> =
      sold ? [
        [0, 'rgba(45,85,60,0.92)'],
        [1, 'rgba(25,50,35,0.92)'],
      ] : isModifier ? [
        [0, selected ? 'rgba(95,55,145,0.96)' : 'rgba(70,45,115,0.92)'],
        [1, selected ? 'rgba(50,35,92,0.96)' : 'rgba(36,28,68,0.92)'],
      ] : selected ? [
        [0, 'rgba(85,75,135,0.95)'],
        [1, 'rgba(45,42,82,0.95)'],
      ] : [
        [0, 'rgba(50,50,80,0.9)'],
        [1, 'rgba(30,30,50,0.9)'],
      ];
    const cardGrad = cachedLinearGradient(ctx, `upgrade-card-${sold}-${isModifier}-${selected}-${cardH}`, 0, 0, 0, cardH, cardStops);
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 12);
    ctx.fill();

    ctx.strokeStyle = selected ? '#ffd166' : isModifier ? '#b277ff' : 'rgba(100,100,150,0.5)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 12);
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (unavailable) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.roundRect(0, 0, cardW, cardH, 12);
      ctx.fill();
    }

    ctx.fillStyle = isModifier ? 'rgba(178,119,255,0.22)' : selected ? 'rgba(255,209,102,0.18)' : 'rgba(80,80,120,0.3)';
    ctx.beginPath();
    ctx.arc(cardW / 2, 46, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '42px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = unavailable ? 'rgba(255,255,255,0.65)' : COLORS.uiText;
    ctx.fillText(opt.icon, cardW / 2, 53);

    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillStyle = unavailable ? '#999999' : selected ? '#ffffff' : '#dddddd';
    ctx.fillText(opt.title, cardW / 2, 96);

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = unavailable ? '#888888' : '#aaaaaa';
    const words = opt.description.split('');
    let line = '';
    let lineY = 122;
    let lines = 0;
    const maxLineWidth = cardW - 30;
    for (const char of words) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxLineWidth) {
        ctx.fillText(line, cardW / 2, lineY);
        line = char;
        lineY += 18;
        lines++;
        if (lines >= 3) break;
      } else {
        line = testLine;
      }
    }
    if (line && lines < 3) ctx.fillText(line, cardW / 2, lineY);

    const badgeY = 180;
    const badgeText = opt.type === 'weapon' ? '⚔️ 武器' :
                      opt.type === 'passive' ? '🛡️ 被动' :
                      opt.type === 'modifier' ? '✦ 通用模块' :
                      opt.type === 'supply' ? '✚ 战术补给' : '❤️ 治疗';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = opt.type === 'weapon' ? '#ff9999' :
                    opt.type === 'passive' ? '#88ff88' :
                    opt.type === 'modifier' ? '#d3a8ff' :
                    opt.type === 'supply' ? '#ffd166' : '#ffb3c1';
    ctx.fillText(badgeText, cardW / 2, badgeY);

    const priceW = cardW - 34;
    const priceX = 17;
    const priceY = cardH - 38;
    ctx.fillStyle = sold ? 'rgba(68,255,136,0.14)' : affordable ? 'rgba(255,209,102,0.14)' : 'rgba(255,80,80,0.14)';
    ctx.beginPath();
    ctx.roundRect(priceX, priceY, priceW, 26, 13);
    ctx.fill();
    ctx.strokeStyle = sold ? '#44ff88' : affordable ? '#ffd166' : '#ff7777';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(priceX, priceY, priceW, 26, 13);
    ctx.stroke();
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = sold ? '#88ff88' : affordable ? '#ffd166' : '#ff8888';
    ctx.fillText(sold ? (isModifier ? '已安装' : '已购买') : `🪙 ${opt.cost}`, cardW / 2, priceY + 13);

    ctx.restore();
  }

  const btnY = h / 2 + 155;
  const btnW = 150;
  const btnH = 38;
  const canReroll = canFreeReroll || (canPaidReroll && gold >= rerollCost);
  const rerollLabel = canFreeReroll ? '免费刷新' : canPaidReroll ? `刷新 🪙 ${rerollCost}` : '刷新未解锁';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = canReroll ? 'rgba(255,209,102,0.18)' : 'rgba(80,80,100,0.45)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 165, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.strokeStyle = canReroll ? '#ffd166' : 'rgba(160,160,180,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 165, btnY, btnW, btnH, 8);
  ctx.stroke();
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillStyle = canReroll ? '#ffd166' : '#999999';
  ctx.fillText(rerollLabel, w / 2 - 90, btnY + btnH / 2);

  ctx.fillStyle = 'rgba(100,140,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(w / 2 + 15, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.strokeStyle = '#88aaff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(w / 2 + 15, btnY, btnW, btnH, 8);
  ctx.stroke();
  ctx.fillStyle = '#dde6ff';
  ctx.fillText('继续战斗', w / 2 + 90, btnY + btnH / 2);

  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText('← → 选择 | Enter 购买 | R 刷新 | Space/Esc 继续', w / 2, btnY + 60);
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
