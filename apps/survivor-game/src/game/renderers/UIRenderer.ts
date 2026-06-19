import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, UpgradeOption } from '../types';
import { COLORS, WEAPON_DATA, PASSIVE_DATA, ENEMY_DATA, GENERIC_MODIFIER_DATA, UPGRADE_RARITY_DATA } from '../constants';
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
  const cards = getSkinCardRects(w, h);
  for (let i = 0; i < CHARACTER_SKINS.length; i++) {
    const skin = CHARACTER_SKINS[i];
    const c = cards[i];
    const selected = meta.selectedSkin === skin.id;
    ctx.save();
    if (selected) { ctx.shadowColor = `${skin.glow}0.5)`; ctx.shadowBlur = 24; }
    uiPanel(ctx, c.x, c.y, c.w, c.h, selected ? skin.outline : 'rgba(150,160,200,0.22)', 14);
    ctx.restore();

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
  if (!node) {
    const owned = meta.unlockedUpgrades.length;
    const avail = META_UPGRADES.filter((n) => canBuyMetaUpgrade(meta, n)).length;
    ctx.font = `900 22px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('星点详情', rect.x + 22, rect.y + 24);
    ctx.font = `14px ${DESKTOP_FONT}`; ctx.fillStyle = 'rgba(224,236,255,0.62)';
    drawWrappedText(ctx, '移到星点查看消耗、效果与解锁内容。', rect.x + 22, rect.y + 62, rect.w - 44, 22, 3);
    ctx.font = `800 14px ${DESKTOP_FONT}`; ctx.fillStyle = '#9dffba';
    ctx.fillText(`已点亮 ${owned}`, rect.x + 22, rect.y + 142);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`可点亮 ${avail}`, rect.x + 22, rect.y + 168);
    return;
  }
  const owned = hasMetaUpgrade(meta, node.id);
  const avail = canBuyMetaUpgrade(meta, node);
  const acc = getBranchAccent(node.branch);
  ctx.font = `38px serif`; ctx.fillStyle = owned ? '#ffffff' : colorWithAlpha(acc, 0.85);
  ctx.fillText(node.icon, rect.x + 22, rect.y + 24);
  ctx.font = `900 22px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
  ctx.fillText(node.name, rect.x + 74, rect.y + 30);
  ctx.font = `800 13px ${DESKTOP_FONT}`;
  ctx.fillStyle = owned ? '#9dffba' : avail ? '#ffd166' : '#8fa7d8';
  ctx.fillText(owned ? '已点亮' : avail ? '可点亮' : '未解锁', rect.x + 74, rect.y + 58);
  ctx.font = `800 13px ${DESKTOP_FONT}`; ctx.fillStyle = acc;
  ctx.fillText(`消耗 ${node.cost} 魂火`, rect.x + 22, rect.y + 96);
  ctx.font = `14px ${DESKTOP_FONT}`; ctx.fillStyle = 'rgba(229,237,255,0.76)';
  drawWrappedText(ctx, node.desc, rect.x + 22, rect.y + 124, rect.w - 44, 21, 4);
  ctx.font = `800 13px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
  ctx.fillText('局内效果', rect.x + 22, rect.y + 228);
  ctx.font = `14px ${DESKTOP_FONT}`; ctx.fillStyle = colorWithAlpha(acc, 0.95);
  drawWrappedText(ctx, node.effect, rect.x + 22, rect.y + 252, rect.w - 44, 21, 2);
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
  const panel = getCodexPanelRect(w, h);
  uiPanel(ctx, panel.x, panel.y, panel.w, panel.h, 'rgba(211,168,255,0.2)', 18);

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `900 24px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
  ctx.fillText('图鉴', panel.x + 26, panel.y + 22);

  drawCodexTabs(rc, activeTab);

  const cards = getCodexCards(activeTab);
  const cols = panel.w >= 1040 ? 4 : 3;
  const gap = 16;
  const cardW = (panel.w - 56 - gap * (cols - 1)) / cols;
  const cardH = Math.min(150, Math.max(122, (panel.h - 158 - gap * 2) / 3));
  const totalW = cols * cardW + (cols - 1) * gap;
  const sx = panel.x + panel.w / 2 - totalW / 2;
  const sy = panel.y + 128;
  for (let i = 0; i < cards.length; i++) {
    const cd = cards[i];
    const x = sx + (i % cols) * (cardW + gap);
    const y = sy + Math.floor(i / cols) * (cardH + gap);
    ctx.fillStyle = 'rgba(16,18,30,0.92)';
    ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 10); ctx.fill();
    ctx.strokeStyle = colorWithAlpha(cd.accent, 0.6); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 10); ctx.stroke();
    ctx.fillStyle = colorWithAlpha(cd.accent, 0.16);
    ctx.beginPath(); ctx.arc(x + 34, y + 36, 22, 0, Math.PI * 2); ctx.fill();
    ctx.font = `24px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText(cd.icon, x + 34, y + 37);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 15px ${DESKTOP_FONT}`; ctx.fillStyle = '#ffffff';
    ctx.fillText(cd.title, x + 66, y + 30);
    ctx.font = `11px ${DESKTOP_FONT}`; ctx.fillStyle = cd.accent;
    ctx.fillText(cd.tag, x + 66, y + 48);
    ctx.textBaseline = 'top';
    ctx.font = `12px ${DESKTOP_FONT}`; ctx.fillStyle = 'rgba(190,199,230,0.85)';
    drawWrappedText(ctx, cd.desc, x + 16, y + 66, cardW - 32, 16, 2);
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
  ctx.fillText('升级商店', w / 2, h / 2 - 190);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillStyle = '#8fe8ff';
  ctx.fillText(`魂晶 ${Math.floor(shards)}`, w / 2, h / 2 - 154);

  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText('可连续购买多个成长，买完后继续战斗', w / 2, h / 2 - 128);

  const cardGap = 12;
  const optionCount = Math.max(options.length, 1);
  const cardW = Math.min(180, (w - 90) / optionCount - cardGap);
  const cardH = 230;
  const totalW = options.length * (cardW + cardGap) - cardGap;
  const startX = (w - totalW) / 2;
  const cardY = h / 2 - cardH / 2 + 8;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const x = startX + i * (cardW + cardGap);
    const y = cardY;
    const selected = i === selectedIndex;
    const affordable = shards >= opt.cost;
    const sold = !!opt.purchased;
    const unavailable = sold || !affordable;
    const isModifier = opt.type === 'modifier';
    const rarity = UPGRADE_RARITY_DATA[opt.rarity];
    const accent = rarity.color;
    const accentDark = rarity.darkColor;

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
    ctx.arc(cardW / 2, 46, 32, 0, Math.PI * 2);
    ctx.fill();

    const rarityBadgeW = 48;
    ctx.fillStyle = colorWithAlpha(accent, sold ? 0.16 : 0.22);
    ctx.beginPath();
    ctx.roundRect(cardW - rarityBadgeW - 10, 10, rarityBadgeW, 22, 8);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(accent, sold ? 0.38 : 0.65);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cardW - rarityBadgeW - 10, 10, rarityBadgeW, 22, 8);
    ctx.stroke();
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = unavailable ? colorWithAlpha(accent, 0.75) : accent;
    ctx.fillText(rarity.label, cardW - rarityBadgeW / 2 - 10, 21);

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
    ctx.fillText(sold ? (isModifier ? '已安装' : '已购买') : `${rarity.label} · 魂晶 ${opt.cost}`, cardW / 2, priceY + 13);

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
