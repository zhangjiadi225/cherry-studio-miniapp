import type { Camera, MapObstacle } from '../types';
import { COLORS, ZONE_COLORS, ARENA_HALF } from '../constants';
import { hashXY, getZone } from '../utils/math';

/** 渲染器共享上下文（无状态函数用） */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/** 地面缓存比视口四周多绘制一圈，镜头在缓存内移动时只平滑偏移缓存 */
const GROUND_CACHE_PADDING = 280;
const GROUND_CACHE_THRESHOLD = 170;

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 世界渲染器：地面网格、区域装饰、障碍物、竞技场边界
 * 拥有地面离屏缓存状态，因此作为 class 实现
 */
export class WorldRenderer {
  private groundCanvas: HTMLCanvasElement | null = null;
  private groundCtx: CanvasRenderingContext2D | null = null;
  private groundCacheCamX = Infinity;
  private groundCacheCamY = Infinity;
  private w = 0;
  private h = 0;

  /** 缓存失效：resize 或窗口尺寸变化时调用 */
  rebuildCache(w: number, h: number) {
    this.w = w;
    this.h = h;
    const dpr = window.devicePixelRatio || 1;
    const cacheW = w + GROUND_CACHE_PADDING * 2;
    const cacheH = h + GROUND_CACHE_PADDING * 2;
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = cacheW * dpr;
    this.groundCanvas.height = cacheH * dpr;
    this.groundCtx = this.groundCanvas.getContext('2d')!;
    this.groundCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.groundCacheCamX = Infinity;
    this.groundCacheCamY = Infinity;
  }

  // ──────────────────────────── Ground ────────────────────────────

  drawGround(rc: RenderContext, cam: Camera) {
    const { ctx, w, h } = rc;
    const gridSize = 80;

    // 缓存判断：镜头移动超过阈值才重绘静态部分
    const dx = Math.abs(cam.x - this.groundCacheCamX);
    const dy = Math.abs(cam.y - this.groundCacheCamY);
    if (dx > GROUND_CACHE_THRESHOLD || dy > GROUND_CACHE_THRESHOLD || !this.groundCtx) {
      this.groundCacheCamX = cam.x;
      this.groundCacheCamY = cam.y;
      this.redrawGroundCache(cam, gridSize, w, h);
    }

    // 绘制缓存到主画布
    if (this.groundCanvas) {
      const dpr = window.devicePixelRatio || 1;
      const cacheW = this.groundCanvas.width / dpr;
      const cacheH = this.groundCanvas.height / dpr;
      const drawX = this.groundCacheCamX - cam.x - GROUND_CACHE_PADDING;
      const drawY = this.groundCacheCamY - cam.y - GROUND_CACHE_PADDING;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(this.groundCanvas, drawX, drawY, cacheW, cacheH);
      ctx.restore();
    }

    // 动态浮游粒子（每帧更新）
    const time = Date.now() * 0.001;
    const startX = cam.x - w / 2 - gridSize;
    const startY = cam.y - h / 2 - gridSize;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 20; i++) {
      const px = startX + (Math.sin(i * 7.3 + time * 0.2) * 0.5 + 0.5) * (w + gridSize * 2);
      const py = startY + (Math.cos(i * 5.7 + time * 0.15) * 0.5 + 0.5) * (h + gridSize * 2);
      const pr = 2 + Math.sin(i + time * 0.5) * 1;
      const zone = getZone(px, py);
      ctx.fillStyle = ZONE_COLORS[zone].particle;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(time * 0.35 + i);
      ctx.beginPath();
      ctx.moveTo(0, -pr * 1.8);
      ctx.lineTo(pr, 0);
      ctx.lineTo(0, pr * 1.8);
      ctx.lineTo(-pr, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

  }

  private redrawGroundCache(cam: Camera, gridSize: number, w: number, h: number) {
    const gctx = this.groundCtx!;
    const dpr = window.devicePixelRatio || 1;
    const cacheW = w + GROUND_CACHE_PADDING * 2;
    const cacheH = h + GROUND_CACHE_PADDING * 2;
    gctx.save();
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.fillStyle = COLORS.bg;
    gctx.fillRect(0, 0, this.groundCanvas!.width, this.groundCanvas!.height);
    gctx.restore();
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawAtmosphere(gctx, cacheW, cacheH);
    gctx.translate(cacheW / 2 - cam.x, cacheH / 2 - cam.y);

    const startX = Math.floor((cam.x - cacheW / 2) / gridSize) * gridSize;
    const startY = Math.floor((cam.y - cacheH / 2) / gridSize) * gridSize;
    const endX = startX + cacheW + gridSize * 2;
    const endY = startY + cacheH + gridSize * 2;

    this.drawFloorDepth(gctx, startX, startY, endX, endY, gridSize);

    // 主网格线
    gctx.lineWidth = 0.5;
    gctx.globalAlpha = 0.3;
    for (let x = startX; x <= endX; x += gridSize) {
      const zone = getZone(x, startY);
      gctx.strokeStyle = ZONE_COLORS[zone].line;
      gctx.beginPath();
      gctx.moveTo(x, startY);
      gctx.lineTo(x, endY);
      gctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const zone = getZone(startX, y);
      gctx.strokeStyle = ZONE_COLORS[zone].line;
      gctx.beginPath();
      gctx.moveTo(startX, y);
      gctx.lineTo(endX, y);
      gctx.stroke();
    }

    // 次级网格线
    gctx.globalAlpha = 0.15;
    gctx.lineWidth = 0.3;
    const smallGrid = gridSize / 4;
    for (let x = startX; x <= endX; x += smallGrid) {
      if (x % gridSize !== 0) {
        const zone = getZone(x, startY);
        gctx.strokeStyle = ZONE_COLORS[zone].line;
        gctx.beginPath();
        gctx.moveTo(x, startY);
        gctx.lineTo(x, endY);
        gctx.stroke();
      }
    }
    for (let y = startY; y <= endY; y += smallGrid) {
      if (y % gridSize !== 0) {
        const zone = getZone(startX, y);
        gctx.strokeStyle = ZONE_COLORS[zone].line;
        gctx.beginPath();
        gctx.moveTo(startX, y);
        gctx.lineTo(endX, y);
        gctx.stroke();
      }
    }

    // 装饰圆点
    gctx.globalAlpha = 0.4;
    for (let x = startX; x <= endX; x += gridSize) {
      const zone = getZone(x, startY);
      gctx.fillStyle = ZONE_COLORS[zone].dot;
      gctx.beginPath();
      for (let y = startY; y <= endY; y += gridSize) {
        gctx.moveTo(x + 1.5, y);
        gctx.arc(x, y, 1.5, 0, Math.PI * 2);
      }
      gctx.fill();
    }

    // 区域装饰
    this.drawZoneDecorations(gctx, startX, startY, endX, endY, gridSize);

    gctx.globalAlpha = 1;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#09101d');
    base.addColorStop(0.55, COLORS.bg);
    base.addColorStop(1, '#05060b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, 'rgba(30,58,88,0.08)');
    vignette.addColorStop(0.65, 'rgba(0,0,0,0.1)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  private drawZoneWash(
    ctx: CanvasRenderingContext2D,
    startX: number, startY: number, endX: number, endY: number,
    gridSize: number
  ) {
    const tile = gridSize * 4;
    ctx.save();
    for (let x = startX - tile; x <= endX + tile; x += tile) {
      for (let y = startY - tile; y <= endY + tile; y += tile) {
        const zone = getZone(x + tile / 2, y + tile / 2);
        const h = hashXY(x, y);
        ctx.fillStyle = hexToRgba(ZONE_COLORS[zone].accent, 0.035 + (h % 4) * 0.006);
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.restore();
  }

  private drawFloorDepth(
    ctx: CanvasRenderingContext2D,
    startX: number, startY: number, endX: number, endY: number,
    gridSize: number
  ) {
    const slab = gridSize * 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let x = startX - slab; x <= endX + slab; x += slab) {
      for (let y = startY - slab; y <= endY + slab; y += slab) {
        const h = hashXY(x, y);
        const zone = getZone(x + slab / 2, y + slab / 2);
        if (h % 3 === 0) {
          ctx.fillStyle = hexToRgba(ZONE_COLORS[zone].accent, 0.018);
          ctx.fillRect(x + 2, y + 2, slab - 4, slab - 4);
        }

        if (h % 4 === 0) {
          ctx.strokeStyle = hexToRgba(ZONE_COLORS[zone].accent, 0.12);
          ctx.lineWidth = 1;
          const cx = x + (h % slab);
          const cy = y + ((h >> 5) % slab);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + 18 + (h % 18), cy + 9);
          ctx.lineTo(cx + 10, cy + 22 + ((h >> 8) % 14));
          ctx.stroke();
        }

        if (h % 13 === 0) {
          const cx = x + slab * 0.5;
          const cy = y + slab * 0.5;
          ctx.strokeStyle = hexToRgba(ZONE_COLORS[zone].accent, 0.1);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(cx, cy, 18 + (h % 12), (h % 6) * 0.4, Math.PI * 1.25 + (h % 5) * 0.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - 4, cy);
          ctx.lineTo(cx + 4, cy);
          ctx.moveTo(cx, cy - 4);
          ctx.lineTo(cx, cy + 4);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  private drawFogRibbons(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    w: number,
    h: number,
    time: number
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let band = 0; band < 3; band++) {
      const y = startY + h * (0.22 + band * 0.23) + Math.sin(time * 0.18 + band) * 26;
      const alpha = 0.025 + band * 0.012;
      const grad = ctx.createLinearGradient(startX, y, startX + w, y);
      grad.addColorStop(0, 'rgba(88,180,255,0)');
      grad.addColorStop(0.28, `rgba(88,180,255,${alpha})`);
      grad.addColorStop(0.62, `rgba(174,116,255,${alpha * 0.85})`);
      grad.addColorStop(1, 'rgba(88,180,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 18 + band * 7;
      ctx.beginPath();
      ctx.moveTo(startX - 80, y);
      const segments = 6;
      for (let i = 1; i <= segments; i++) {
        const x = startX + (i / segments) * (w + 160) - 80;
        const wave = Math.sin(time * 0.25 + band * 2 + i * 1.7) * (14 + band * 4);
        ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawZoneDecorations(
    ctx: CanvasRenderingContext2D,
    startX: number, startY: number, endX: number, endY: number,
    gridSize: number
  ) {
    const time = Date.now() * 0.001;
    const step = gridSize * 4;
    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        const h = hashXY(x, y);
        if (h % 5 !== 0) continue;
        const zone = getZone(x, y);
        const accent = ZONE_COLORS[zone].accent;
        const fx = x + ((h >> 4) % gridSize);
        const fy = y + ((h >> 8) % gridSize);

        ctx.globalAlpha = 0.14;
        ctx.fillStyle = accent;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;

        switch (zone) {
          case 'shadow': {
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + 8 + (h % 10), fy + 6);
            ctx.lineTo(fx + 14, fy + 12 + (h % 8));
            ctx.stroke();
            break;
          }
          case 'blood': {
            ctx.beginPath();
            ctx.ellipse(fx, fy, 6 + (h % 5), 4 + (h % 3), (h % 6) * 0.5, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'bone': {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(fx - 4, fy - 4);
            ctx.lineTo(fx + 4, fy + 4);
            ctx.moveTo(fx + 4, fy - 4);
            ctx.lineTo(fx - 4, fy + 4);
            ctx.stroke();
            break;
          }
          case 'storm': {
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + 5, fy + 6);
            ctx.lineTo(fx - 2, fy + 10);
            ctx.lineTo(fx + 4, fy + 16);
            ctx.stroke();
            break;
          }
        }

        if (h % 11 === 0) {
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.moveTo(fx, fy - 7);
          ctx.lineTo(fx + 5, fy);
          ctx.lineTo(fx, fy + 7);
          ctx.lineTo(fx - 5, fy);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ──────────────────────────── Obstacles ────────────────────────────

  drawObstacles(rc: RenderContext, obstacles: MapObstacle[]) {
    const { ctx } = rc;
    const time = Date.now() * 0.001;

    for (const obs of obstacles) {
      switch (obs.type) {
        case 'tombstone': {
          const w = obs.width;
          const h = obs.height;
          const stoneGrad = ctx.createLinearGradient(obs.x, obs.y - h / 2, obs.x, obs.y + h / 2);
          stoneGrad.addColorStop(0, '#626276');
          stoneGrad.addColorStop(0.45, '#3e4051');
          stoneGrad.addColorStop(1, '#232533');
          ctx.fillStyle = stoneGrad;
          ctx.strokeStyle = '#818197';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(obs.x - w / 2, obs.y - h / 2, w, h, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(185,205,230,0.12)';
          ctx.fillRect(obs.x - w / 2 + 3, obs.y - h / 2 + 4, w - 6, 3);
          ctx.strokeStyle = '#b2b2c6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y - h / 2 + 4);
          ctx.lineTo(obs.x, obs.y + h / 2 - 4);
          ctx.moveTo(obs.x - w / 4, obs.y - h / 4 + 2);
          ctx.lineTo(obs.x + w / 4, obs.y - h / 4 + 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(20,22,32,0.72)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(obs.x + w * 0.18, obs.y - h * 0.25);
          ctx.lineTo(obs.x + w * 0.08, obs.y - h * 0.04);
          ctx.lineTo(obs.x + w * 0.2, obs.y + h * 0.1);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(obs.x, obs.y + h / 2 + 3, w / 2, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'bone_wall': {
          const w = obs.width;
          const h = obs.height;
          const ratio = obs.hp / obs.maxHp;
          ctx.globalAlpha = 0.3 + ratio * 0.7;
          ctx.fillStyle = ratio < 0.5 ? '#8a7a5a' : '#6a5a3a';
          ctx.beginPath();
          ctx.roundRect(obs.x - w / 2, obs.y - h / 2, w, h, 2);
          ctx.fill();
          ctx.strokeStyle = ratio < 0.5 ? '#aa9a7a' : '#8a7a5a';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) {
            const bx = obs.x - w / 3 + i * (w / 3);
            const by = obs.y;
            ctx.beginPath();
            ctx.arc(bx - 3, by, 3, 0, Math.PI * 2);
            ctx.arc(bx + 3, by, 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx - 2, by + 3);
            ctx.lineTo(bx + 2, by + 3);
            ctx.stroke();
          }
          if (ratio < 1) {
            ctx.strokeStyle = '#ff6644';
            ctx.lineWidth = 1;
            ctx.globalAlpha = (1 - ratio) * 0.5;
            for (let i = 0; i < 3 - Math.floor(ratio * 3); i++) {
              const rx = obs.x - w / 3 + (hashXY(obs.x + i, obs.y) % 20);
              const ry = obs.y - h / 4 + (hashXY(obs.x, obs.y + i) % (h / 2));
              ctx.beginPath();
              ctx.moveTo(rx, ry);
              ctx.lineTo(rx + 4, ry + 3);
              ctx.lineTo(rx - 1, ry + 6);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'blood_pool': {
          const r = obs.radius;
          const poolGrad = ctx.createRadialGradient(obs.x, obs.y, 0, obs.x, obs.y, r);
          poolGrad.addColorStop(0, 'rgba(80,10,10,0.4)');
          poolGrad.addColorStop(0.7, 'rgba(60,5,5,0.25)');
          poolGrad.addColorStop(1, 'rgba(40,0,0,0)');
          ctx.fillStyle = poolGrad;
          ctx.beginPath();
          ctx.ellipse(obs.x, obs.y, r, r * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,20,20,0.2)';
          ctx.lineWidth = 1;
          const ripplePhase = time * 1.5 + hashXY(obs.x, obs.y) * 0.1;
          for (let i = 0; i < 3; i++) {
            const rr = r * (0.3 + ((ripplePhase + i * 0.35) % 1) * 0.6);
            ctx.beginPath();
            ctx.ellipse(obs.x, obs.y, rr, rr * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }
        case 'magic_circle': {
          const r = obs.radius;
          const pulse = 0.15 + Math.sin(time * 2 + hashXY(obs.x, obs.y) * 0.05) * 0.05;
          const auraGrad = ctx.createRadialGradient(obs.x, obs.y, r * 0.2, obs.x, obs.y, r * 1.3);
          auraGrad.addColorStop(0, `rgba(100,0,150,${pulse})`);
          auraGrad.addColorStop(0.6, `rgba(80,0,120,${pulse * 0.5})`);
          auraGrad.addColorStop(1, 'rgba(60,0,100,0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, r * 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(160,80,255,${pulse * 2})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, r, 0, Math.PI * 2);
          ctx.stroke();
          const rot = time * 0.3;
          for (let i = 0; i < 5; i++) {
            const a1 = rot + (i / 5) * Math.PI * 2 - Math.PI / 2;
            const a2 = rot + (((i + 2) % 5) / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(obs.x + Math.cos(a1) * r, obs.y + Math.sin(a1) * r);
            ctx.lineTo(obs.x + Math.cos(a2) * r, obs.y + Math.sin(a2) * r);
            ctx.stroke();
          }
          break;
        }
      }
    }
  }

  // ──────────────────────────── Arena Bounds ────────────────────────────

  drawArenaBounds(rc: RenderContext, cam: Camera) {
    const { ctx, w, h } = rc;
    const time = Date.now() * 0.001;
    const ah = ARENA_HALF;
    const viewL = cam.x - w / 2;
    const viewR = cam.x + w / 2;
    const viewT = cam.y - h / 2;
    const viewB = cam.y + h / 2;
    const pulse = 0.15 + Math.sin(time * 2) * 0.05;

    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -time * 30;

    if (viewT < ah) {
      ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
      ctx.beginPath();
      ctx.moveTo(Math.max(viewL, -ah), -ah);
      ctx.lineTo(Math.min(viewR, ah), -ah);
      ctx.stroke();
    }
    if (viewB > -ah) {
      ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
      ctx.beginPath();
      ctx.moveTo(Math.max(viewL, -ah), ah);
      ctx.lineTo(Math.min(viewR, ah), ah);
      ctx.stroke();
    }
    if (viewL < ah) {
      ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
      ctx.beginPath();
      ctx.moveTo(-ah, Math.max(viewT, -ah));
      ctx.lineTo(-ah, Math.min(viewB, ah));
      ctx.stroke();
    }
    if (viewR > -ah) {
      ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
      ctx.beginPath();
      ctx.moveTo(ah, Math.max(viewT, -ah));
      ctx.lineTo(ah, Math.min(viewB, ah));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const edgeDist = 150;
    if (viewL < -ah + edgeDist) {
      const grad = ctx.createLinearGradient(-ah, 0, -ah + edgeDist, 0);
      grad.addColorStop(0, `rgba(255,0,0,${pulse * 0.3})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-ah, Math.max(viewT, -ah), edgeDist, Math.min(viewB, ah) - Math.max(viewT, -ah));
    }
    if (viewR > ah - edgeDist) {
      const grad = ctx.createLinearGradient(ah, 0, ah - edgeDist, 0);
      grad.addColorStop(0, `rgba(255,0,0,${pulse * 0.3})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(ah - edgeDist, Math.max(viewT, -ah), edgeDist, Math.min(viewB, ah) - Math.max(viewT, -ah));
    }
  }
}
