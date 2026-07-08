import type { Enemy, EnemyType } from '../types';
import { EnemyType as EnemyTypeValues } from '../types';

type LoadState = 'idle' | 'loading' | 'loaded' | 'failed';

interface SpriteEntry {
  image: HTMLImageElement;
  state: LoadState;
  frames: HTMLCanvasElement[];
  frameWidth: number;
  frameHeight: number;
}

export interface SpriteSheetSpec {
  id: string;
  url: string;
  cols: number;
  rows: number;
  frameCount: number;
  frameRate: number;
  anchorX: number;
  anchorY: number;
  heightScale: number;
  widthScale?: number;
  alpha?: number;
}

const SPRITE_ROOT = '/sprites/units';

export const ENEMY_SPRITES: Partial<Record<EnemyType, SpriteSheetSpec>> = {
  [EnemyTypeValues.ZOMBIE]: {
    id: 'enemy-zombie',
    url: `${SPRITE_ROOT}/enemy_zombie.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.56,
    heightScale: 2.8,
  },
  [EnemyTypeValues.BAT]: {
    id: 'enemy-bat',
    url: `${SPRITE_ROOT}/enemy_bat.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    heightScale: 2.9,
    widthScale: 2.6,
  },
  [EnemyTypeValues.SKELETON]: {
    id: 'enemy-skeleton',
    url: `${SPRITE_ROOT}/enemy_skeleton.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.58,
    heightScale: 2.95,
  },
  [EnemyTypeValues.CULTIST]: {
    id: 'enemy-cultist',
    url: `${SPRITE_ROOT}/enemy_cultist.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.58,
    heightScale: 3.0,
  },
  [EnemyTypeValues.GHOST]: {
    id: 'enemy-ghost',
    url: `${SPRITE_ROOT}/enemy_ghost.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.55,
    heightScale: 3.0,
    alpha: 0.92,
  },
  [EnemyTypeValues.MUMMY]: {
    id: 'enemy-mummy',
    url: `${SPRITE_ROOT}/enemy_mummy.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.58,
    heightScale: 2.95,
  },
  [EnemyTypeValues.DEMON]: {
    id: 'enemy-demon',
    url: `${SPRITE_ROOT}/enemy_demon.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.6,
    heightScale: 3.0,
  },
  [EnemyTypeValues.WRAITH]: {
    id: 'enemy-wraith',
    url: `${SPRITE_ROOT}/enemy_wraith.png`,
    cols: 1,
    rows: 1,
    frameCount: 1,
    frameRate: 1,
    anchorX: 0.5,
    anchorY: 0.56,
    heightScale: 3.0,
    alpha: 0.94,
  },
};

class SpriteRegistry {
  private entries = new Map<string, SpriteEntry>();
  private frameTimeSeconds = 0;

  beginFrame(timeSeconds: number) {
    if (Number.isFinite(timeSeconds)) {
      this.frameTimeSeconds = timeSeconds;
    }
  }

  preloadEnemies() {
    for (const spec of Object.values(ENEMY_SPRITES)) {
      if (spec) this.getEntry(spec);
    }
  }

  getEnemyAnimationTimer(type: EnemyType): number | undefined {
    return ENEMY_SPRITES[type] ? this.frameTimeSeconds * 3 : undefined;
  }

  drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, bob: number): boolean {
    if (enemy.hitFlash > 0) return false;
    const spec = ENEMY_SPRITES[enemy.type];
    if (!spec) return false;
    const frame = this.getFrame(this.frameTimeSeconds * 3, spec);
    return this.drawFrame(ctx, spec, frame, enemy.x, enemy.y + bob, enemy.radius);
  }

  private getFrame(animTimer: number, spec: SpriteSheetSpec): number {
    const timer = Number.isFinite(animTimer) ? animTimer : 0;
    return Math.abs(Math.floor(timer * spec.frameRate)) % spec.frameCount;
  }

  private drawFrame(
    ctx: CanvasRenderingContext2D,
    spec: SpriteSheetSpec,
    frameIndex: number,
    x: number,
    y: number,
    radius: number,
    flipX = false
  ): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) {
      return false;
    }

    const entry = this.getEntry(spec);
    if (entry.state !== 'loaded' || !this.buildFrameCache(entry, spec)) {
      return false;
    }

    const frameW = entry.frameWidth;
    const frameH = entry.frameHeight;
    if (!Number.isFinite(frameW) || !Number.isFinite(frameH) || frameW <= 0 || frameH <= 0) {
      return false;
    }

    const frame = entry.frames[frameIndex % entry.frames.length];
    if (!frame) return false;

    const targetH = radius * spec.heightScale;
    const targetW = spec.widthScale ? radius * spec.widthScale : targetH * (frameW / frameH);
    if (!Number.isFinite(targetW) || !Number.isFinite(targetH) || targetW <= 0 || targetH <= 0) {
      return false;
    }

    ctx.save();
    ctx.globalAlpha *= spec.alpha ?? 1;
    if (flipX) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      x = 0;
    }
    ctx.drawImage(
      frame,
      x - targetW * spec.anchorX,
      y - targetH * spec.anchorY,
      targetW,
      targetH
    );
    ctx.restore();
    return true;
  }

  private getEntry(spec: SpriteSheetSpec): SpriteEntry {
    const existing = this.entries.get(spec.id);
    if (existing) return existing;

    const image = new Image();
    const entry: SpriteEntry = { image, state: 'loading', frames: [], frameWidth: 0, frameHeight: 0 };
    image.decoding = 'async';
    image.onload = () => {
      entry.state = image.naturalWidth > 0 && image.naturalHeight > 0 ? 'loaded' : 'failed';
      if (entry.state === 'loaded') this.buildFrameCache(entry, spec);
    };
    image.onerror = () => {
      entry.state = 'failed';
    };
    image.src = spec.url;
    this.entries.set(spec.id, entry);
    return entry;
  }

  private buildFrameCache(entry: SpriteEntry, spec: SpriteSheetSpec): boolean {
    if (entry.frames.length === spec.frameCount && entry.frameWidth > 0 && entry.frameHeight > 0) {
      return true;
    }
    if (entry.image.naturalWidth <= 0 || entry.image.naturalHeight <= 0) return false;

    const sourceFrameW = entry.image.naturalWidth / spec.cols;
    const sourceFrameH = entry.image.naturalHeight / spec.rows;
    if (!Number.isFinite(sourceFrameW) || !Number.isFinite(sourceFrameH) || sourceFrameW <= 0 || sourceFrameH <= 0) {
      entry.state = 'failed';
      return false;
    }

    const targetFrameW = Math.max(1, Math.round(sourceFrameW));
    const targetFrameH = Math.max(1, Math.round(sourceFrameH));
    const frames: HTMLCanvasElement[] = [];

    for (let i = 0; i < spec.frameCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = targetFrameW;
      canvas.height = targetFrameH;
      const frameCtx = canvas.getContext('2d');
      if (!frameCtx) {
        entry.state = 'failed';
        return false;
      }

      const col = i % spec.cols;
      const row = Math.floor(i / spec.cols);
      frameCtx.drawImage(
        entry.image,
        col * sourceFrameW,
        row * sourceFrameH,
        sourceFrameW,
        sourceFrameH,
        0,
        0,
        targetFrameW,
        targetFrameH
      );
      frames.push(canvas);
    }

    entry.frames = frames;
    entry.frameWidth = targetFrameW;
    entry.frameHeight = targetFrameH;
    return true;
  }
}

export const spriteRegistry = new SpriteRegistry();
