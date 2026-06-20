import type { Enemy, EnemyType } from '../types';
import { EnemyType as EnemyTypeValues } from '../types';

type LoadState = 'idle' | 'loading' | 'loaded' | 'failed';

interface SpriteEntry {
  image: HTMLImageElement;
  state: LoadState;
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

export const ENEMY_SPRITES: Record<EnemyType, SpriteSheetSpec> = {
  [EnemyTypeValues.ZOMBIE]: {
    id: 'enemy-zombie-move',
    url: `${SPRITE_ROOT}/enemy_zombie_move.svg`,
    cols: 2,
    rows: 2,
    frameCount: 4,
    frameRate: 2,
    anchorX: 0.5,
    anchorY: 0.58,
    heightScale: 2.7,
  },
  [EnemyTypeValues.BAT]: {
    id: 'enemy-bat-move',
    url: `${SPRITE_ROOT}/enemy_bat_move.svg`,
    cols: 2,
    rows: 2,
    frameCount: 4,
    frameRate: 4,
    anchorX: 0.5,
    anchorY: 0.5,
    heightScale: 2.8,
    widthScale: 4.4,
  },
  [EnemyTypeValues.SKELETON]: {
    id: 'enemy-skeleton-move',
    url: `${SPRITE_ROOT}/enemy_skeleton_move.svg`,
    cols: 2,
    rows: 2,
    frameCount: 4,
    frameRate: 2,
    anchorX: 0.5,
    anchorY: 0.58,
    heightScale: 2.75,
  },
  [EnemyTypeValues.GHOST]: {
    id: 'enemy-ghost-move',
    url: `${SPRITE_ROOT}/enemy_ghost_move.svg`,
    cols: 3,
    rows: 2,
    frameCount: 6,
    frameRate: 1.5,
    anchorX: 0.5,
    anchorY: 0.55,
    heightScale: 3,
    alpha: 0.9,
  },
  [EnemyTypeValues.MUMMY]: {
    id: 'enemy-mummy-move',
    url: `${SPRITE_ROOT}/enemy_mummy_move.svg`,
    cols: 2,
    rows: 2,
    frameCount: 4,
    frameRate: 1.6,
    anchorX: 0.5,
    anchorY: 0.58,
    heightScale: 2.75,
  },
  [EnemyTypeValues.DEMON]: {
    id: 'enemy-demon-move',
    url: `${SPRITE_ROOT}/enemy_demon_move.svg`,
    cols: 2,
    rows: 2,
    frameCount: 4,
    frameRate: 2.2,
    anchorX: 0.5,
    anchorY: 0.6,
    heightScale: 2.9,
  },
  [EnemyTypeValues.WRAITH]: {
    id: 'enemy-wraith-move',
    url: `${SPRITE_ROOT}/enemy_wraith_move.svg`,
    cols: 3,
    rows: 2,
    frameCount: 6,
    frameRate: 1.5,
    anchorX: 0.5,
    anchorY: 0.56,
    heightScale: 3,
    alpha: 0.92,
  },
};

class SpriteRegistry {
  private entries = new Map<string, SpriteEntry>();

  drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, bob: number): boolean {
    if (enemy.hitFlash > 0) return false;
    const spec = ENEMY_SPRITES[enemy.type];
    if (!spec) return false;
    const frame = this.getFrame(enemy.animTimer, spec);
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
    if (entry.state !== 'loaded' || entry.image.naturalWidth <= 0 || entry.image.naturalHeight <= 0) {
      return false;
    }

    const frameW = entry.image.naturalWidth / spec.cols;
    const frameH = entry.image.naturalHeight / spec.rows;
    if (!Number.isFinite(frameW) || !Number.isFinite(frameH) || frameW <= 0 || frameH <= 0) {
      return false;
    }

    const col = frameIndex % spec.cols;
    const row = Math.floor(frameIndex / spec.cols);
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
      entry.image,
      col * frameW,
      row * frameH,
      frameW,
      frameH,
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
    const entry: SpriteEntry = { image, state: 'loading' };
    image.decoding = 'async';
    image.onload = () => {
      entry.state = image.naturalWidth > 0 && image.naturalHeight > 0 ? 'loaded' : 'failed';
    };
    image.onerror = () => {
      entry.state = 'failed';
    };
    image.src = spec.url;
    this.entries.set(spec.id, entry);
    return entry;
  }
}

export const spriteRegistry = new SpriteRegistry();
