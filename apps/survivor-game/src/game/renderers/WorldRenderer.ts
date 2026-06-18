import type { Camera, MapObstacle } from '../types';
import { COLORS, ZONE_COLORS, ARENA_HALF } from '../constants';
import { hashXY, getZone } from '../utils/math';

/** 渲染器共享上下文（无状态函数用） */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/** 镜头移动超过此距离才重绘地面缓存 */
const GROUND_CACHE_THRESHOLD = 180;

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
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = w * dpr;
    this.groundCanvas.height = h * dpr;
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
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(this.groundCanvas, 0, 0);
      ctx.restore();
    }

    // 动态浮游粒子（每帧更新）
    const time = Date.now() * 0.001;
    const startX = Math.floor((cam.x - w / 2) / gridSize) * gridSize;
    const startY = Math.floor((cam.y - h / 2) / gridSize) * gridSize;
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 20; i++) {
      const px = startX + (Math.sin(i * 7.3 + time * 0.2) * 0.5 + 0.5) * (w + gridSize * 2);
      const py = startY + (Math.cos(i * 5.7 + time * 0.15) * 0.5 + 0.5) * (h + gridSize * 2);
      const pr = 2 + Math.sin(i + time * 0.5) * 1;
      const zone = getZone(px, py);
      ctx.fillStyle = ZONE_COLORS[zone].particle;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private redrawGroundCache(cam: Camera, gridSize: number, w: number, h: number) {
    const gctx = this.groundCtx!;
    const dpr = window.devicePixelRatio || 1;
    gctx.save();
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.fillStyle = COLORS.bg;
    gctx.fillRect(0, 0, this.groundCanvas!.width, this.groundCanvas!.height);
    gctx.restore();
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.translate(w / 2 - cam.x, h / 2 - cam.y);

    const startX = Math.floor((cam.x - w / 2) / gridSize) * gridSize;
    const startY = Math.floor((cam.y - h / 2) / gridSize) * gridSize;
    const endX = startX + w + gridSize * 2;
    const endY = startY + h + gridSize * 2;

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

        ctx.globalAlpha = 0.12;
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
          ctx.fillStyle = '#3a3a4a';
          ctx.strokeStyle = '#555566';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(obs.x - w / 2, obs.y - h / 2, w, h, 3);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#666677';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y - h / 2 + 4);
          ctx.lineTo(obs.x, obs.y + h / 2 - 4);
          ctx.moveTo(obs.x - w / 4, obs.y - h / 4 + 2);
          ctx.lineTo(obs.x + w / 4, obs.y - h / 4 + 2);
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
