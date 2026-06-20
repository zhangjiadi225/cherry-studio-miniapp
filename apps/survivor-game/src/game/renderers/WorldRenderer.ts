import type { Camera, MapObstacle } from '../types';
import { COLORS, ZONE_COLORS, ARENA_HALF, MAP_GRID_SIZE } from '../constants';
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
    const gridSize = MAP_GRID_SIZE;

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

    this.drawZoneWash(gctx, startX, startY, endX, endY, gridSize);
    this.drawFloorDepth(gctx, startX, startY, endX, endY, gridSize);

    // 主网格线：按线段中点取区域色，避免跨区移动时整条线突然换色
    gctx.lineWidth = 0.5;
    gctx.globalAlpha = 0.3;
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        const zone = getZone(x, y + gridSize / 2);
        gctx.strokeStyle = ZONE_COLORS[zone].line;
        gctx.beginPath();
        gctx.moveTo(x, y);
        gctx.lineTo(x, Math.min(y + gridSize, endY));
        gctx.stroke();
      }
    }
    for (let y = startY; y <= endY; y += gridSize) {
      for (let x = startX; x < endX; x += gridSize) {
        const zone = getZone(x + gridSize / 2, y);
        gctx.strokeStyle = ZONE_COLORS[zone].line;
        gctx.beginPath();
        gctx.moveTo(x, y);
        gctx.lineTo(Math.min(x + gridSize, endX), y);
        gctx.stroke();
      }
    }

    // 次级网格线
    gctx.globalAlpha = 0.15;
    gctx.lineWidth = 0.3;
    const smallGrid = gridSize / 4;
    for (let x = startX; x <= endX; x += smallGrid) {
      if (x % gridSize !== 0) {
        for (let y = startY; y < endY; y += gridSize) {
          const zone = getZone(x, y + gridSize / 2);
          gctx.strokeStyle = ZONE_COLORS[zone].line;
          gctx.beginPath();
          gctx.moveTo(x, y);
          gctx.lineTo(x, Math.min(y + gridSize, endY));
          gctx.stroke();
        }
      }
    }
    for (let y = startY; y <= endY; y += smallGrid) {
      if (y % gridSize !== 0) {
        for (let x = startX; x < endX; x += gridSize) {
          const zone = getZone(x + gridSize / 2, y);
          gctx.strokeStyle = ZONE_COLORS[zone].line;
          gctx.beginPath();
          gctx.moveTo(x, y);
          gctx.lineTo(Math.min(x + gridSize, endX), y);
          gctx.stroke();
        }
      }
    }

    // 装饰圆点
    gctx.globalAlpha = 0.4;
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        const zone = getZone(x, y);
        gctx.fillStyle = ZONE_COLORS[zone].dot;
        gctx.beginPath();
        gctx.moveTo(x + 1.5, y);
        gctx.arc(x, y, 1.5, 0, Math.PI * 2);
        gctx.fill();
      }
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
          if (obs.landmark) this.drawObeliskLandmark(ctx, obs, time);
          else this.drawTombstone(ctx, obs);
          break;
        }
        case 'bone_wall': {
          this.drawBoneWall(ctx, obs);
          break;
        }
        case 'blood_pool': {
          if (obs.landmark) this.drawBloodRiftLandmark(ctx, obs, time);
          else this.drawBloodPool(ctx, obs, time);
          break;
        }
        case 'magic_circle': {
          if (obs.landmark) this.drawRuneShrineLandmark(ctx, obs, time);
          else this.drawMagicCircle(ctx, obs, time);
          break;
        }
      }
    }
  }

  private drawTombstone(ctx: CanvasRenderingContext2D, obs: MapObstacle) {
    const w = obs.width;
    const h = obs.height;
    const accent = ZONE_COLORS[obs.zone].accent;
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.rotate(obs.rotation * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(0, h / 2 + 3, w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const stoneGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    stoneGrad.addColorStop(0, '#76798e');
    stoneGrad.addColorStop(0.45, '#45485c');
    stoneGrad.addColorStop(1, '#262837');
    ctx.fillStyle = stoneGrad;
    ctx.strokeStyle = '#969ab0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, h * 0.42);
    ctx.lineTo(-w * 0.42, -h * 0.18);
    ctx.quadraticCurveTo(-w * 0.34, -h * 0.48, 0, -h * 0.5);
    ctx.quadraticCurveTo(w * 0.34, -h * 0.48, w * 0.42, -h * 0.18);
    ctx.lineTo(w * 0.42, h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = hexToRgba(accent, 0.42);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.28);
    ctx.lineTo(0, h * 0.16);
    ctx.moveTo(-w * 0.18, -h * 0.08);
    ctx.lineTo(w * 0.18, -h * 0.08);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20,22,32,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, -h * 0.18);
    ctx.lineTo(w * 0.05, h * 0.02);
    ctx.lineTo(w * 0.18, h * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  private drawObeliskLandmark(ctx: CanvasRenderingContext2D, obs: MapObstacle, time: number) {
    const w = obs.width;
    const h = obs.height * 1.35;
    const accent = ZONE_COLORS[obs.zone].accent;
    const pulse = 0.22 + Math.sin(time * 1.8 + obs.variant) * 0.05;
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.rotate(obs.rotation * 0.18);

    const aura = ctx.createRadialGradient(0, 0, w * 0.15, 0, 0, w * 1.15);
    aura.addColorStop(0, hexToRgba(accent, pulse));
    aura.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.18, w * 0.82, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.43, w * 0.72, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(0, -h * 0.58, 0, h * 0.42);
    grad.addColorStop(0, '#9ca2c4');
    grad.addColorStop(0.35, '#5a607a');
    grad.addColorStop(1, '#242839');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#c2c8e4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.62);
    ctx.lineTo(w * 0.36, -h * 0.26);
    ctx.lineTo(w * 0.28, h * 0.4);
    ctx.lineTo(-w * 0.28, h * 0.4);
    ctx.lineTo(-w * 0.36, -h * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = hexToRgba(accent, 0.72);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const y = -h * 0.22 + i * h * 0.17;
      ctx.beginPath();
      ctx.moveTo(-w * 0.12, y);
      ctx.lineTo(0, y + h * 0.06);
      ctx.lineTo(w * 0.12, y);
      ctx.stroke();
    }

    ctx.strokeStyle = hexToRgba(accent, 0.34);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.37, w * 0.55, h * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBoneWall(ctx: CanvasRenderingContext2D, obs: MapObstacle) {
    const w = obs.width;
    const h = obs.height;
    const ratio = obs.hp / obs.maxHp;
    const intact = 0.42 + ratio * 0.58;
    const segments = obs.landmark ? 7 : 5;
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.rotate(obs.rotation * 0.25);

    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.34, w * 0.54, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = intact;
    ctx.strokeStyle = ratio < 0.45 ? '#8c7551' : '#d7c58d';
    ctx.lineWidth = obs.landmark ? 5 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, h * 0.06);
    ctx.quadraticCurveTo(-w * 0.16, -h * 0.12, 0, -h * 0.02);
    ctx.quadraticCurveTo(w * 0.18, h * 0.12, w * 0.42, -h * 0.06);
    ctx.stroke();

    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      const x = -w * 0.42 + t * w * 0.84;
      const lean = (i % 2 === 0 ? -0.2 : 0.18) + obs.rotation * 0.08;
      const len = h * (0.72 + ((obs.variant + i) % 3) * 0.07);
      this.drawBoneSegment(ctx, x, 0, len, lean, obs.landmark ? 9 : 7, ratio);
      if (obs.landmark && (i === 0 || i === segments - 1)) {
        this.drawBoneSegment(ctx, x, -h * 0.03, h * 1.05, lean * 0.45, 12, ratio);
      }
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(255,96,66,${(1 - ratio) * 0.72})`;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 4 - Math.floor(ratio * 3); i++) {
      const h0 = hashXY(obs.x + i * 13, obs.y - i * 7);
      const x = -w * 0.34 + (h0 % Math.max(1, Math.floor(w * 0.68)));
      const y = -h * 0.2 + ((h0 >> 8) % Math.max(1, Math.floor(h * 0.45)));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y + 5);
      ctx.lineTo(x - 2, y + 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoneSegment(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    length: number,
    angle: number,
    thickness: number,
    ratio: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const fill = ratio < 0.45 ? '#9b865d' : '#d9ca97';
    const stroke = ratio < 0.45 ? '#5b4728' : '#7b6437';
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-thickness / 2, -length / 2, thickness, length, thickness / 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -length / 2, thickness * 0.72, 0, Math.PI * 2);
    ctx.arc(0, length / 2, thickness * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawBloodPool(ctx: CanvasRenderingContext2D, obs: MapObstacle, time: number) {
    const r = obs.radius;
    const poolGrad = ctx.createRadialGradient(obs.x, obs.y, 0, obs.x, obs.y, r);
    poolGrad.addColorStop(0, 'rgba(110,12,18,0.46)');
    poolGrad.addColorStop(0.62, 'rgba(64,5,10,0.28)');
    poolGrad.addColorStop(1, 'rgba(24,0,0,0)');
    ctx.fillStyle = poolGrad;
    ctx.beginPath();
    ctx.ellipse(obs.x, obs.y, r, r * 0.65, obs.rotation * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168,32,38,0.26)';
    ctx.lineWidth = 1;
    const ripplePhase = time * 1.5 + hashXY(obs.x, obs.y) * 0.1;
    for (let i = 0; i < 3; i++) {
      const rr = r * (0.3 + ((ripplePhase + i * 0.35) % 1) * 0.6);
      ctx.beginPath();
      ctx.ellipse(obs.x, obs.y, rr, rr * 0.65, obs.rotation * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawBloodRiftLandmark(ctx: CanvasRenderingContext2D, obs: MapObstacle, time: number) {
    this.drawBloodPool(ctx, obs, time);
    const r = obs.radius;
    const pulse = 0.45 + Math.sin(time * 2.4 + obs.variant) * 0.12;
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.rotate(obs.rotation * 0.32);
    ctx.strokeStyle = `rgba(255,72,72,${pulse})`;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + time * 0.08;
      const inner = r * 0.25;
      const outer = r * (0.72 + (i % 2) * 0.12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner * 0.65);
      ctx.lineTo(Math.cos(a + 0.1) * outer, Math.sin(a + 0.1) * outer * 0.65);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,52,52,${0.18 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.18);
    ctx.lineTo(r * 0.2, 0);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(-r * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawMagicCircle(ctx: CanvasRenderingContext2D, obs: MapObstacle, time: number) {
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
    const rot = time * 0.3 + obs.rotation;
    for (let i = 0; i < 5; i++) {
      const a1 = rot + (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = rot + (((i + 2) % 5) / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(obs.x + Math.cos(a1) * r, obs.y + Math.sin(a1) * r);
      ctx.lineTo(obs.x + Math.cos(a2) * r, obs.y + Math.sin(a2) * r);
      ctx.stroke();
    }
  }

  private drawRuneShrineLandmark(ctx: CanvasRenderingContext2D, obs: MapObstacle, time: number) {
    this.drawMagicCircle(ctx, obs, time);
    const r = obs.radius;
    const accent = ZONE_COLORS[obs.zone].accent;
    const rot = time * 0.22 + obs.rotation;
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.strokeStyle = hexToRgba(accent, 0.72);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * r * 0.8;
      const y = Math.sin(a) * r * 0.8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 4);
      ctx.strokeRect(-3, -3, 6, 6);
      ctx.restore();
    }
    const crystal = ctx.createLinearGradient(0, -r * 0.26, 0, r * 0.24);
    crystal.addColorStop(0, '#ffffff');
    crystal.addColorStop(0.42, accent);
    crystal.addColorStop(1, '#251538');
    ctx.fillStyle = crystal;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.32);
    ctx.lineTo(r * 0.2, -r * 0.02);
    ctx.lineTo(0, r * 0.3);
    ctx.lineTo(-r * 0.2, -r * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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
