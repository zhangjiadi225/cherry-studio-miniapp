import type { RenderContext } from './WorldRenderer';
import type { Player, Enemy, UpgradeOption } from '../types';
import { COLORS, WEAPON_DATA, PASSIVE_DATA, ENEMY_DATA } from '../constants';

// ──────────────────────────── HUD ────────────────────────────

export function drawUI(rc: RenderContext, player: Player, elapsed: number, killCount: number) {
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

    const shineGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    shineGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    shineGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = shineGrad;
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

  const playerGlow = ctx.createRadialGradient(playerDotX, playerDotY, 0, playerDotX, playerDotY, 8);
  playerGlow.addColorStop(0, 'rgba(74,158,255,0.6)');
  playerGlow.addColorStop(1, 'rgba(74,158,255,0)');
  ctx.fillStyle = playerGlow;
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
    const grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    grad.addColorStop(0, '#ff4444');
    grad.addColorStop(0.5, '#cc2222');
    grad.addColorStop(1, '#881111');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 6);
    ctx.fill();

    const shine = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    shine.addColorStop(0, 'rgba(255,255,255,0.25)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    shine.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = shine;
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
  const size = 36;
  const x = w - size - 12;
  const y = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x + 10, y + 8, 5, 20);
  ctx.fillRect(x + 21, y + 8, 5, 20);
}

/** 暂停按钮的命中区域（供 Input 判断） */
export function getPauseButtonRect(w: number): { x: number; y: number; w: number; h: number } {
  const size = 36;
  return { x: w - size - 12, y: 8, w: size, h: size };
}

// ──────────────────────────── Overlays ────────────────────────────

export function drawMenu(rc: RenderContext) {
  const { ctx, w, h } = rc;
  const time = Date.now() * 0.001;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 60; i++) {
    const x = (Math.sin(i * 7.3 + time * 0.3) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 5.7 + time * 0.2) * 0.5 + 0.5) * h;
    const r = 1.5 + Math.sin(i + time) * 0.8;
    const alpha = 0.1 + Math.sin(i * 3 + time) * 0.05;
    ctx.fillStyle = `rgba(74,158,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const weapons = ['🪄', '🔥', '📖', '🧄', '💧', '⚡', '🪓'];
  ctx.globalAlpha = 0.08;
  ctx.font = '40px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < weapons.length; i++) {
    ctx.fillText(weapons[i], w * (0.15 + (i / (weapons.length - 1)) * 0.7), h * 0.3 + Math.sin(time * 0.5 + i * 1.5) * 20);
  }
  ctx.globalAlpha = 1;

  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 64px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚔️ 暗夜幸存者 ⚔️', w / 2, h / 2 - 100);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText('在无尽的黑夜中生存15分钟', w / 2, h / 2 - 45);

  const btnW = 220;
  const btnH = 55;
  const btnX = w / 2 - btnW / 2;
  const btnY = h / 2 + 10;

  ctx.shadowColor = '#6666ff';
  ctx.shadowBlur = 15;
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  btnGrad.addColorStop(0, 'rgba(80,80,200,0.9)');
  btnGrad.addColorStop(1, 'rgba(50,50,150,0.9)');
  ctx.fillStyle = btnGrad;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 10);
  ctx.fill();
  ctx.strokeStyle = '#8888ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 10);
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = 'bold 24px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('🎮 开始游戏', w / 2, btnY + btnH / 2);

  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.uiDim;
  ctx.fillText('WASD / 方向键 移动  |  武器自动攻击  |  触屏滑动控制', w / 2, h / 2 + 110);

  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('v2.0', w / 2, h - 20);
}

export function drawPaused(rc: RenderContext) {
  const { ctx, w, h } = rc;

  const overlayGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
  overlayGrad.addColorStop(0, 'rgba(0,0,20,0.7)');
  overlayGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = overlayGrad;
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
  rerollCost: number
) {
  const { ctx, w, h } = rc;

  const overlayGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  overlayGrad.addColorStop(0, 'rgba(0,0,30,0.85)');
  overlayGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = overlayGrad;
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

    const cardGrad = ctx.createLinearGradient(0, 0, 0, cardH);
    if (sold) {
      cardGrad.addColorStop(0, 'rgba(45,85,60,0.92)');
      cardGrad.addColorStop(1, 'rgba(25,50,35,0.92)');
    } else if (isModifier) {
      cardGrad.addColorStop(0, selected ? 'rgba(95,55,145,0.96)' : 'rgba(70,45,115,0.92)');
      cardGrad.addColorStop(1, selected ? 'rgba(50,35,92,0.96)' : 'rgba(36,28,68,0.92)');
    } else if (selected) {
      cardGrad.addColorStop(0, 'rgba(85,75,135,0.95)');
      cardGrad.addColorStop(1, 'rgba(45,42,82,0.95)');
    } else {
      cardGrad.addColorStop(0, 'rgba(50,50,80,0.9)');
      cardGrad.addColorStop(1, 'rgba(30,30,50,0.9)');
    }
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
                      opt.type === 'modifier' ? '✦ 通用模块' : '❤️ 治疗';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = opt.type === 'weapon' ? '#ff9999' :
                    opt.type === 'passive' ? '#88ff88' :
                    opt.type === 'modifier' ? '#d3a8ff' : '#ffb3c1';
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
  const canReroll = canFreeReroll || gold >= rerollCost;
  const rerollLabel = canFreeReroll ? '免费刷新' : `刷新 🪙 ${rerollCost}`;

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

export function drawGameOver(rc: RenderContext, stats: { time: number; kills: number; level: number; weaponNames: string[] }) {
  const { ctx, w, h } = rc;
  const isVictory = stats.time >= 900;
  const time = Date.now() * 0.001;

  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  bgGrad.addColorStop(0, 'rgba(0,0,20,0.9)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.98)');
  ctx.fillStyle = bgGrad;
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
  const containerH = 180;
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
  ctx.fillText('⚔️ 武器:', containerX + 20, statsY + 120);
  ctx.textAlign = 'right';
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText(stats.weaponNames.join(', ') || '无', containerX + containerW - 20, statsY + 120);

  const btnW = 200;
  const btnH = 45;
  const btnX = w / 2 - btnW / 2;
  const btnY = h / 2 + 170;

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
  ctx.fillText('🔄 重新开始', w / 2, btnY + btnH / 2);
}
