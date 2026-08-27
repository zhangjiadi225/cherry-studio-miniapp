import type { Camera, MapObstacle } from '../types';
import { COLORS, ZONE_COLORS, ARENA_HALF, MAP_GRID_SIZE, MAP_ZONE_SIZE } from '../constants';
import { hashXY, getZone } from '../utils/math';

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
    const viewL = cam.x - w / 2 - overscan;
    const viewR = cam.x + w / 2 + overscan;
    const viewT = cam.y - h / 2 - overscan;
    const viewB = cam.y + h / 2 + overscan;
    const mapL = Math.max(viewL, -ARENA_HALF);
    const mapR = Math.min(viewR, ARENA_HALF);
    const mapT = Math.max(viewT, -ARENA_HALF);
    const mapB = Math.min(viewB, ARENA_HALF);

    ctx.save();
    ctx.fillStyle = COLORS.groundOutside;
    ctx.fillRect(viewL, viewT, viewR - viewL, viewB - viewT);

    if (mapL < mapR && mapT < mapB) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(mapL, mapT, mapR - mapL, mapB - mapT);

      ctx.save();
      ctx.beginPath();
      ctx.rect(mapL, mapT, mapR - mapL, mapB - mapT);
      ctx.clip();
      this.drawZoneTints(ctx, mapL, mapT, mapR, mapB);
      this.drawSparseGroundMarks(ctx, mapL, mapT, mapR, mapB);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawZoneTints(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) {
    const firstBlockX = Math.floor((startX + MAP_ZONE_SIZE / 2) / MAP_ZONE_SIZE);
    const lastBlockX = Math.floor((endX + MAP_ZONE_SIZE / 2) / MAP_ZONE_SIZE);
    const firstBlockY = Math.floor((startY + MAP_ZONE_SIZE / 2) / MAP_ZONE_SIZE);
    const lastBlockY = Math.floor((endY + MAP_ZONE_SIZE / 2) / MAP_ZONE_SIZE);

    for (let bx = firstBlockX; bx <= lastBlockX; bx++) {
      const x = bx * MAP_ZONE_SIZE - MAP_ZONE_SIZE / 2;
      for (let by = firstBlockY; by <= lastBlockY; by++) {
        const y = by * MAP_ZONE_SIZE - MAP_ZONE_SIZE / 2;
        const zone = getZone(x + MAP_ZONE_SIZE / 2, y + MAP_ZONE_SIZE / 2);
        ctx.fillStyle = hexToRgba(ZONE_COLORS[zone].accent, 0.035);
        ctx.fillRect(x, y, MAP_ZONE_SIZE, MAP_ZONE_SIZE);
      }
    }
  }

  /** 只为当前视口按坐标哈希补绘少量地面标记，不保存地图块或纹理。 */
  private drawSparseGroundMarks(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) {
    const cellSize = MAP_GRID_SIZE * 3;
    const firstX = Math.floor(startX / cellSize) * cellSize;
    const firstY = Math.floor(startY / cellSize) * cellSize;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.2;

    for (let x = firstX; x <= endX; x += cellSize) {
      for (let y = firstY; y <= endY; y += cellSize) {
        const hash = hashXY(x, y);
        if (hash % 4 !== 0) continue;

        const px = x + 36 + ((hash >>> 5) % (cellSize - 72));
        const py = y + 36 + ((hash >>> 13) % (cellSize - 72));
        const zone = getZone(px, py);
        const accent = ZONE_COLORS[zone].accent;
        ctx.fillStyle = hexToRgba(accent, 0.1);
        ctx.strokeStyle = hexToRgba(accent, 0.16);

        switch (zone) {
          case 'shadow':
            ctx.beginPath();
            ctx.moveTo(px - 8, py - 5);
            ctx.lineTo(px + 2, py + 1);
            ctx.lineTo(px + 10, py + 9);
            ctx.stroke();
            break;
          case 'blood':
            ctx.beginPath();
            ctx.ellipse(px, py, 8, 5, (hash % 7) * 0.2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'bone':
            ctx.beginPath();
            ctx.moveTo(px - 6, py - 6);
            ctx.lineTo(px + 6, py + 6);
            ctx.moveTo(px + 6, py - 6);
            ctx.lineTo(px - 6, py + 6);
            ctx.stroke();
            break;
          case 'storm':
            ctx.beginPath();
            ctx.moveTo(px + 2, py - 8);
            ctx.lineTo(px - 3, py);
            ctx.lineTo(px + 3, py + 2);
            ctx.lineTo(px - 2, py + 10);
            ctx.stroke();
            break;
        }
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
