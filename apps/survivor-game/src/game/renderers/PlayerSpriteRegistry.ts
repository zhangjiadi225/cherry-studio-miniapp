import type { SkinId } from '../systems/meta/MetaProgression';

type LoadState = 'loading' | 'loaded' | 'failed';

interface PlayerSpriteSpec {
  id: string;
  url: string;
  anchorY: number;
  scale: number;
  alpha?: number;
}

interface PlayerSpriteEntry {
  image: HTMLImageElement;
  state: LoadState;
}

const PLAYER_ROOT = '/sprites/units';

export const PLAYER_SKIN_SPRITES: Record<SkinId, PlayerSpriteSpec> = {
  wanderer: {
    id: 'player-wanderer',
    url: `${PLAYER_ROOT}/player_wanderer.png`,
    anchorY: 0.5,
    scale: 3.0,
  },
  oracle: {
    id: 'player-oracle',
    url: `${PLAYER_ROOT}/player_oracle.png`,
    anchorY: 0.5,
    scale: 3.0,
  },
  ember: {
    id: 'player-ember',
    url: `${PLAYER_ROOT}/player_ember.png`,
    anchorY: 0.5,
    scale: 3.0,
  },
};

class PlayerSpriteRegistry {
  private entries = new Map<string, PlayerSpriteEntry>();

  preload() {
    for (const spec of Object.values(PLAYER_SKIN_SPRITES)) {
      this.getEntry(spec);
    }
  }

  drawPlayer(
    ctx: CanvasRenderingContext2D,
    skinId: SkinId,
    x: number,
    y: number,
    radius: number,
    facingLeft: boolean,
    alpha = 1
  ): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) {
      return false;
    }
    const spec = PLAYER_SKIN_SPRITES[skinId];
    if (!spec) return false;

    const entry = this.getEntry(spec);
    if (entry.state !== 'loaded' || entry.image.naturalWidth <= 0 || entry.image.naturalHeight <= 0) {
      return false;
    }

    const targetH = radius * spec.scale;
    const targetW = targetH * (entry.image.naturalWidth / entry.image.naturalHeight);
    if (!Number.isFinite(targetW) || !Number.isFinite(targetH) || targetW <= 0 || targetH <= 0) {
      return false;
    }

    ctx.save();
    ctx.globalAlpha *= (spec.alpha ?? 1) * alpha;
    if (facingLeft) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      x = 0;
    }
    ctx.drawImage(
      entry.image,
      x - targetW / 2,
      y - targetH * spec.anchorY,
      targetW,
      targetH
    );
    ctx.restore();
    return true;
  }

  private getEntry(spec: PlayerSpriteSpec): PlayerSpriteEntry {
    const existing = this.entries.get(spec.id);
    if (existing) return existing;

    const image = new Image();
    const entry: PlayerSpriteEntry = { image, state: 'loading' };
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

export const playerSpriteRegistry = new PlayerSpriteRegistry();
