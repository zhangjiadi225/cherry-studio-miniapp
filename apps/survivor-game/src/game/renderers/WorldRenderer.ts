import type { Camera, MapObstacle } from '../types';
import { COLORS, ARENA_HALF, MAP_GRID_SIZE } from '../constants';
import { hashXY } from '../utils/math';

/** 渲染器共享上下文（无状态函数用） */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 世界渲染器：轻量地面、障碍物、竞技场边界
 */
export class WorldRenderer {
  // ──────────────────────────── Ground ────────────────────────────

  drawGround(rc: RenderContext, cam: Camera) {
    const { ctx, w, h } = rc;
    const overscan = 32;
    const halfViewW = w / cam.zoom / 2;
    const halfViewH = h / cam.zoom / 2;
    const viewL = cam.x - halfViewW - overscan;
    const viewR = cam.x + halfViewW + overscan;
    const viewT = cam.y - halfViewH - overscan;
    const viewB = cam.y + halfViewH + overscan;
    const mapL = Math.max(viewL, -ARENA_HALF);
    const mapR = Math.min(viewR, ARENA_HALF);
    const mapT = Math.max(viewT, -ARENA_HALF);
    const mapB = Math.min(viewB, ARENA_HALF);

    ctx.save();
    ctx.fillStyle = COLORS.groundOutside;
    ctx.fillRect(viewL, viewT, viewR - viewL, viewB - viewT);

    if (mapL < mapR && mapT < mapB) {
      ctx.fillStyle = COLORS.groundCheckerLight;
      ctx.fillRect(mapL, mapT, mapR - mapL, mapB - mapT);

      ctx.save();
      ctx.beginPath();
      ctx.rect(mapL, mapT, mapR - mapL, mapB - mapT);
      ctx.clip();
      this.drawCheckerboard(ctx, mapL, mapT, mapR, mapB);
      ctx.restore();
    }
    ctx.restore();
  }

  /** 只补绘视口中的深色格；格子锚定世界坐标，镜头移动时不会漂移。 */
  private drawCheckerboard(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) {
    const cellSize = MAP_GRID_SIZE;
    const firstColumn = Math.floor(startX / cellSize);
    const lastColumn = Math.floor(endX / cellSize);
    const firstRow = Math.floor(startY / cellSize);
    const lastRow = Math.floor(endY / cellSize);

    ctx.fillStyle = COLORS.groundCheckerDark;
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        if ((row + column) % 2 === 0) continue;
        ctx.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
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
      }
    }
  }

  private drawTombstone(ctx: CanvasRenderingContext2D, obs: MapObstacle) {
    const w = obs.width;
    const h = obs.height;
    const accent = '#6f8b83';
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
    const accent = '#82a69d';
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

  // ──────────────────────────── Arena Bounds ────────────────────────────

  drawArenaBounds(rc: RenderContext, cam: Camera) {
    const { ctx, w, h } = rc;
    const time = Date.now() * 0.001;
    const ah = ARENA_HALF;
    const halfViewW = w / cam.zoom / 2;
    const halfViewH = h / cam.zoom / 2;
    const viewL = cam.x - halfViewW;
    const viewR = cam.x + halfViewW;
    const viewT = cam.y - halfViewH;
    const viewB = cam.y + halfViewH;
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
