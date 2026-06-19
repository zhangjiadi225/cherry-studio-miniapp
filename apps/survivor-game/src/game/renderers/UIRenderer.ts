import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, UpgradeOption } from '../types';
import { COLORS, WEAPON_DATA, PASSIVE_DATA, ENEMY_DATA, GENERIC_MODIFIER_DATA } from '../constants';
import {
  type CodexTab, type DesktopTab, type MetaState, type MetaUpgradeNode,
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

  // Spendable soul shard display
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX + 190, barY + barH + 6, 104, 24, 6);
  ctx.fill();
  ctx.strokeStyle = '#8fe8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(barX + 190, barY + barH + 6, 104, 24, 6);
  ctx.stroke();
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#8fe8ff';
  ctx.textAlign = 'center';
  ctx.fillText(`魂晶 ${Math.floor(player.shards)}`, barX + 242, barY + barH + 18);

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
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    const toastW = Math.min(420, w - 32);
    const objectiveLines = getWrappedLines(ctx, objective, toastW - 28, 2);
    const lineHeight = 16;
    const toastH = objectiveLines.length > 1 ? 52 : 36;
    const toastX = w / 2 - toastW / 2;
    const toastY = 82;
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
      ctx.fillText(line, w / 2, textY + index * lineHeight);
    });
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

type MenuLayout = {
  content: Rect;
  rail: Rect;
};

const DESKTOP_TABS: DesktopTab[] = ['start', 'skins', 'growth', 'codex'];

export function getDesktopStartButtonRect(w: number, h: number): Rect {
  const { content } = getMenuLayout(w, h);
  const panelY = content.y + Math.max(18, content.h * 0.08);
  const panelH = Math.min(430, content.h * 0.76);
  const btnW = Math.min(310, Math.max(240, content.w * 0.28));
  return {
    x: content.x + 36,
    y: panelY + panelH - 92,
    w: btnW,
    h: 62,
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

  if (activeTab === 'growth') {
    drawMetaGrowth(rc, meta, hoveredStarId);
  } else if (activeTab === 'skins') {
    drawSkinPanel(rc, meta);
  } else if (activeTab === 'codex') {
    drawCodexPanel(rc, activeCodexTab);
  } else {
    drawDesktopStart(rc);
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

function drawDesktopBackdrop(rc: RenderContext) {
  const { ctx, w, h } = rc;
  ctx.fillStyle = cachedLinearGradient(ctx, `menu-bg-sky-${w}-${h}`, 0, 0, 0, h, [
    [0, '#11152a'],
    [0.38, '#102c31'],
    [0.72, '#0d1c16'],
    [1, '#050708'],
  ]);
  ctx.fillRect(0, 0, w, h);

  const moonX = w * 0.74;
  const moonY = h * 0.18;
  const moonR = Math.max(52, Math.min(88, w * 0.055));
  ctx.fillStyle = cachedRadialGradient(ctx, `menu-moon-${w}-${h}`, moonX, moonY, 4, moonX, moonY, moonR * 1.7, [
    [0, 'rgba(255,229,155,0.95)'],
    [0.44, 'rgba(245,219,142,0.72)'],
    [1, 'rgba(245,219,142,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3df9c';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(17,21,42,0.74)';
  ctx.beginPath();
  ctx.arc(moonX - moonR * 0.36, moonY - moonR * 0.08, moonR * 0.92, 0, Math.PI * 2);
  ctx.fill();

  const horizon = h * 0.56;
  ctx.fillStyle = 'rgba(6,13,14,0.78)';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 18);
  for (let x = 0; x <= w; x += 140) {
    ctx.lineTo(x, horizon + Math.sin(x * 0.011) * 22);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(173,105,46,0.34)';
  ctx.lineWidth = 4;
  for (let y = horizon + 52; y < h; y += 44) {
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.lineTo(w + 20, y - 18);
    ctx.stroke();
  }
  ctx.lineWidth = 5;
  for (let x = -40; x < w + 80; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, horizon + 34);
    ctx.lineTo(x + 18, h * 0.76);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,209,102,0.88)';
  for (let i = 0; i < 34; i++) {
    const x = (i * 173) % w;
    const y = h * 0.12 + ((i * 67) % Math.max(80, h * 0.62));
    const r = i % 5 === 0 ? 1.7 : 1.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = cachedLinearGradient(ctx, `menu-left-vignette-${w}-${h}`, 0, 0, w * 0.72, 0, [
    [0, 'rgba(1,4,8,0.72)'],
    [0.52, 'rgba(1,4,8,0.22)'],
    [1, 'rgba(1,4,8,0)'],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = cachedLinearGradient(ctx, `menu-right-vignette-${w}-${h}`, w * 0.58, 0, w, 0, [
    [0, 'rgba(1,4,8,0)'],
    [0.72, 'rgba(1,4,8,0.52)'],
    [1, 'rgba(1,4,8,0.92)'],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = cachedLinearGradient(ctx, `menu-floor-${w}-${h}`, 0, h * 0.6, 0, h, [
    [0, 'rgba(13,34,21,0)'],
    [1, 'rgba(0,0,0,0.72)'],
  ]);
  ctx.fillRect(0, h * 0.48, w, h * 0.52);
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

function getMetaStarPanel(w: number, h: number) {
  const { content } = getMenuLayout(w, h);
  const panelW = Math.min(1120, content.w);
  const panelH = Math.min(650, content.h);
  const panelX = content.x + (content.w - panelW) / 2;
  const panelY = content.y + (content.h - panelH) / 2;
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

function getBranchAccent(branch: MetaUpgradeNode['branch']): string {
  if (branch === 'ranged') return '#8fe8ff';
  if (branch === 'mechanism') return '#d3a8ff';
  if (branch === 'area') return '#9dffba';
  if (branch === 'damage') return '#ff9a76';
  return '#ffd166';
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

function drawDesktopStart(rc: RenderContext) {
  const { ctx, w, h } = rc;
  const { content } = getMenuLayout(w, h);
  const panelX = content.x;
  const panelY = content.y + Math.max(18, content.h * 0.08);
  const panelW = Math.min(760, content.w * 0.72);
  const panelH = Math.min(430, content.h * 0.76);
  const titleGrad = cachedLinearGradient(ctx, `menu-title-${w}-${h}`, panelX, 0, panelX + 560, 0, [
    [0, '#fff2c0'],
    [0.55, '#ffd166'],
    [1, '#ff8c66'],
  ]);

  ctx.fillStyle = cachedLinearGradient(ctx, `menu-start-panel-${w}-${h}`, panelX, panelY, panelX + panelW, panelY, [
    [0, 'rgba(3,7,13,0.78)'],
    [0.72, 'rgba(3,7,13,0.42)'],
    [1, 'rgba(3,7,13,0)'],
  ]);
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 18);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,209,102,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 18);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `900 ${Math.min(86, Math.max(58, w * 0.052))}px ${DESKTOP_FONT}`;
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.fillText('暗夜幸存者', panelX + 34, panelY + 42);
  ctx.shadowBlur = 0;

  ctx.font = `800 18px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#9dffba';
  ctx.fillText('夜潮围场', panelX + 40, panelY + 150);

  ctx.font = `15px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(232,239,255,0.76)';
  drawWrappedText(ctx, '收割魂晶，点亮星图，把下一局的构筑池变成你的武器。', panelX + 40, panelY + 184, Math.min(520, panelW - 80), 24, 2);

  const chips = [
    ['局外成长', '#8fe8ff'],
    ['角色衣橱', '#ff9a76'],
    ['武器图鉴', '#d3a8ff'],
  ];
  let chipX = panelX + 40;
  const chipY = panelY + 252;
  for (const [text, accent] of chips) {
    const chipW = ctx.measureText(text).width + 34;
    drawSmallPill(ctx, chipX, chipY, chipW, text, accent);
    chipX += chipW + 12;
  }

  const button = getDesktopStartButtonRect(w, h);
  ctx.fillStyle = cachedLinearGradient(ctx, `menu-start-button-${w}-${h}`, button.x, button.y, button.x, button.y + button.h, [
    [0, 'rgba(255,215,120,0.96)'],
    [1, 'rgba(255,129,78,0.96)'],
  ]);
  ctx.beginPath();
  ctx.roundRect(button.x, button.y, button.w, button.h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,205,0.84)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(button.x, button.y, button.w, button.h, 14);
  ctx.stroke();
  ctx.font = `900 22px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#20130b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始夜潮', button.x + button.w / 2, button.y + button.h / 2);
}

function drawMenuPageShell(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  accent: string,
  title: string
) {
  const { x, y, w, h } = rect;
  ctx.fillStyle = 'rgba(3,7,14,0.48)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(accent, 0.38);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `900 28px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, x + 28, y + 24);
}

function drawMetaGrowth(rc: RenderContext, meta: MetaState, hoveredNodeId?: MetaUpgradeNode['id']) {
  const { ctx, w, h } = rc;
  const panel = getMetaStarPanel(w, h);
  drawMenuPageShell(ctx, panel, '#8fe8ff', '星图');

  ctx.font = `700 13px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(224,236,255,0.62)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('默认星点保持暗色，点亮后进入局内模块池。', panel.x + 30, panel.y + 58);

  ctx.fillStyle = 'rgba(3,8,16,0.54)';
  ctx.beginPath();
  ctx.roundRect(panel.chart.x, panel.chart.y, panel.chart.w, panel.chart.h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(143,232,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(panel.chart.x, panel.chart.y, panel.chart.w, panel.chart.h, 16);
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = 'rgba(143,232,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(panel.cx, panel.cy, panel.scale * i * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(panel.cx, panel.cy);
    ctx.lineTo(panel.cx + Math.cos(angle) * panel.scale, panel.cy + Math.sin(angle) * panel.scale);
    ctx.stroke();
  }
  ctx.restore();

  const nodeCenters = new Map<MetaUpgradeNode['id'], { x: number; y: number }>();
  for (const node of META_UPGRADES) {
    nodeCenters.set(node.id, {
      x: panel.cx + node.x * panel.scale,
      y: panel.cy + node.y * panel.scale,
    });
  }

  ctx.save();
  ctx.lineCap = 'round';
  for (const node of META_UPGRADES) {
    const to = nodeCenters.get(node.id);
    if (!to) continue;
    for (const req of node.requires ?? []) {
      const from = nodeCenters.get(req);
      if (!from) continue;
      const owned = hasMetaUpgrade(meta, node.id);
      const available = canBuyMetaUpgrade(meta, node);
      const hovered = hoveredNodeId === node.id;
      const accent = getBranchAccent(node.branch);
      ctx.strokeStyle = owned
        ? colorWithAlpha(accent, 0.82)
        : hovered
          ? colorWithAlpha(accent, 0.58)
          : available
            ? colorWithAlpha(accent, 0.34)
            : 'rgba(130,150,190,0.16)';
      ctx.lineWidth = owned ? 3.4 : hovered ? 2.6 : 1.8;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }
  ctx.restore();

  for (const node of META_UPGRADES) {
    const center = nodeCenters.get(node.id)!;
    const owned = hasMetaUpgrade(meta, node.id);
    const available = canBuyMetaUpgrade(meta, node);
    const locked = !owned && !available;
    const hovered = hoveredNodeId === node.id;
    const accent = getBranchAccent(node.branch);
    const r = node.kind === 'keystone' ? 24 : node.kind === 'notable' ? 19 : 15;

    ctx.save();
    if (owned || hovered) {
      ctx.shadowColor = colorWithAlpha(accent, owned ? 0.68 : 0.4);
      ctx.shadowBlur = owned ? 22 : 12;
    }
    ctx.fillStyle = owned
      ? colorWithAlpha(accent, 0.52)
      : hovered
        ? colorWithAlpha(accent, 0.18)
        : locked
          ? 'rgba(15,21,34,0.96)'
          : 'rgba(25,31,45,0.9)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = owned
      ? '#9dffba'
      : hovered
        ? accent
        : available
          ? colorWithAlpha(accent, 0.58)
          : 'rgba(145,160,196,0.3)';
    ctx.lineWidth = owned ? 2.6 : hovered ? 2.2 : node.kind === 'keystone' ? 1.7 : 1.2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = `${node.kind === 'keystone' ? 23 : 18}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = owned ? '#ffffff' : hovered ? '#eef8ff' : locked ? 'rgba(210,220,245,0.34)' : 'rgba(229,236,255,0.58)';
    ctx.fillText(node.icon, center.x, center.y + 1);

    if (owned || hovered) {
      ctx.font = `800 ${node.kind === 'small' ? 10 : 11}px ${DESKTOP_FONT}`;
      ctx.fillStyle = owned ? '#9dffba' : '#fff2c0';
      ctx.fillText(node.name, center.x, center.y + r + 13);
    }
    if (available && !owned) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(center.x + r * 0.62, center.y - r * 0.62, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const hoveredNode = META_UPGRADES.find((node) => node.id === hoveredNodeId);
  drawMetaStarDetail(ctx, panel.detail, meta, hoveredNode);
}

function drawMetaStarDetail(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  meta: MetaState,
  node?: MetaUpgradeNode
) {
  ctx.fillStyle = 'rgba(4,9,18,0.72)';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 16);
  ctx.stroke();

  ctx.font = `800 13px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`魂火 ${meta.soulFire}`, rect.x + 22, rect.y + 22);

  if (!node) {
    const ownedCount = meta.unlockedUpgrades.length;
    const availableCount = META_UPGRADES.filter((item) => canBuyMetaUpgrade(meta, item)).length;
    ctx.font = `900 24px ${DESKTOP_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('星点详情', rect.x + 22, rect.y + 66);
    ctx.font = `14px ${DESKTOP_FONT}`;
    ctx.fillStyle = 'rgba(224,236,255,0.66)';
    drawWrappedText(ctx, '移动到星点后查看消耗、效果和局内解锁内容。', rect.x + 22, rect.y + 106, rect.w - 44, 22, 3);
    drawSmallPill(ctx, rect.x + 22, rect.y + 190, 104, `已点亮 ${ownedCount}`, '#9dffba');
    drawSmallPill(ctx, rect.x + 138, rect.y + 190, 108, `可点亮 ${availableCount}`, '#ffd166');
    return;
  }

  const owned = hasMetaUpgrade(meta, node.id);
  const available = canBuyMetaUpgrade(meta, node);
  const accent = getBranchAccent(node.branch);
  const status = owned ? '已点亮' : available ? '可点亮' : '未解锁';

  ctx.font = `42px serif`;
  ctx.fillStyle = owned ? '#ffffff' : colorWithAlpha(accent, 0.82);
  ctx.textAlign = 'left';
  ctx.fillText(node.icon, rect.x + 22, rect.y + 58);

  ctx.font = `900 24px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(node.name, rect.x + 78, rect.y + 62);
  drawSmallPill(ctx, rect.x + 78, rect.y + 98, 82, status, owned ? '#9dffba' : available ? '#ffd166' : '#8fa7d8');

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 13px ${DESKTOP_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(`消耗 ${node.cost} 魂火`, rect.x + 22, rect.y + 150);

  ctx.font = `14px ${DESKTOP_FONT}`;
  ctx.fillStyle = 'rgba(229,237,255,0.76)';
  drawWrappedText(ctx, node.desc, rect.x + 22, rect.y + 178, rect.w - 44, 22, 4);

  ctx.font = `800 13px ${DESKTOP_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('局内效果', rect.x + 22, rect.y + 294);
  ctx.font = `14px ${DESKTOP_FONT}`;
  ctx.fillStyle = colorWithAlpha(accent, 0.94);
  drawWrappedText(ctx, node.effect, rect.x + 22, rect.y + 320, rect.w - 44, 22, 2);
}

function drawSkinPanel(rc: RenderContext, meta: MetaState) {
  const { ctx, w, h } = rc;
  const panel = getSkinPanelRect(w, h);
  drawMenuPageShell(ctx, panel, '#ff9a76', '衣橱');

  const cards = getSkinCardRects(w, h);
  for (let i = 0; i < CHARACTER_SKINS.length; i++) {
    const skin = CHARACTER_SKINS[i];
    const card = cards[i];
    const { x, y, w: cardW, h: cardH } = card;
    const selected = meta.selectedSkin === skin.id;
    const cardGrad = cachedLinearGradient(ctx, `skin-card-v2-${skin.id}-${selected}-${x}-${y}-${cardH}`, x, y, x, y + cardH, [
      [0, selected ? `${skin.glow}0.34)` : 'rgba(25,32,46,0.76)'],
      [0.5, 'rgba(11,16,27,0.92)'],
      [1, 'rgba(5,8,14,0.96)'],
    ]);
    ctx.save();
    if (selected) {
      ctx.shadowColor = `${skin.glow}0.44)`;
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = selected ? skin.outline : 'rgba(128,154,210,0.28)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.stroke();

    ctx.fillStyle = `${skin.glow}0.16)`;
    ctx.beginPath();
    ctx.arc(x + cardW / 2, y + cardH * 0.3, cardW * 0.31, 0, Math.PI * 2);
    ctx.fill();
    drawSkinPreview(ctx, skin.id, x + cardW / 2, y + cardH * 0.32, cardW / 125, skin.body, skin.outline);

    ctx.font = `800 19px ${DESKTOP_FONT}`;
    ctx.fillStyle = selected ? '#ffd166' : COLORS.uiText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(skin.name, x + cardW / 2, y + cardH * 0.66);
    drawSmallPill(ctx, x + 38, y + cardH * 0.74, cardW - 76, skin.archetype, selected ? skin.outline : '#8fa7d8');
    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = 'rgba(224,236,255,0.64)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawWrappedText(ctx, skin.desc, x + 24, y + cardH - 64, cardW - 48, 16, selected ? 1 : 2);
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
  const { ctx, w, h } = rc;
  const panel = getCodexPanelRect(w, h);
  drawMenuPageShell(ctx, panel, '#d3a8ff', '图鉴');
  drawCodexTabs(rc, activeTab);
  drawCodexCards(rc, activeTab);
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
    const tab = tabs[i];
    const rect = rects[i];
    const { x, y, w: tabW, h: tabH } = rect;
    const active = tab.id === activeTab;
    const accent = getCodexAccent(tab.id);
    ctx.fillStyle = active ? colorWithAlpha(accent, 0.22) : 'rgba(17,24,38,0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 8);
    ctx.fill();
    ctx.strokeStyle = active ? accent : 'rgba(100,120,170,0.38)';
    ctx.lineWidth = active ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, tabW, tabH, 8);
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
  const { ctx, w, h } = rc;
  const panel = getCodexPanelRect(w, h);
  const cards = getCodexCards(tab);
  const columns = panel.w >= 1040 ? 4 : 3;
  const gap = 16;
  const cardW = (panel.w - 56 - gap * (columns - 1)) / columns;
  const cardH = Math.min(154, Math.max(128, (panel.h - 158 - gap * 2) / 3));
  const totalW = columns * cardW + (columns - 1) * gap;
  const startX = panel.x + panel.w / 2 - totalW / 2;
  const startY = panel.y + 136;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const x = startX + (i % columns) * (cardW + gap);
    const y = startY + Math.floor(i / columns) * (cardH + gap);
    ctx.fillStyle = cachedLinearGradient(ctx, `codex-card-v2-${card.accent}-${x}-${y}-${cardH}`, x, y, x, y + cardH, [
      [0, colorWithAlpha(card.accent, 0.12)],
      [0.34, 'rgba(21,29,45,0.92)'],
      [1, 'rgba(7,11,20,0.94)'],
    ]);
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(card.accent, 0.72);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha(card.accent, 0.11);
    ctx.fillRect(x + 1, y + 1, cardW - 2, 4);
    ctx.fillStyle = colorWithAlpha(card.accent, 0.16);
    ctx.beginPath();
    ctx.arc(x + 36, y + 39, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `27px serif`;
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
      tag: `${data.family} | 最高 Lv.${data.maxLevel ?? '∞'}`,
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
      tag: `魂晶 ${data.xpValue} | ${data.spawnAfter}s`,
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
  shards: number,
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
  ctx.fillStyle = '#8fe8ff';
  ctx.fillText(`魂晶 ${Math.floor(shards)}`, w / 2, h / 2 - 142);

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
    const affordable = shards >= opt.cost;
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
    ctx.fillText(sold ? (isModifier ? '已安装' : '已购买') : `魂晶 ${opt.cost}`, cardW / 2, priceY + 13);

    ctx.restore();
  }

  const btnY = h / 2 + 155;
  const btnW = 150;
  const btnH = 38;
  const canReroll = canFreeReroll || (canPaidReroll && shards >= rerollCost);
  const rerollLabel = canFreeReroll ? '免费刷新' : canPaidReroll ? `刷新 魂晶 ${rerollCost}` : '刷新未解锁';

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
