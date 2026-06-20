import { WeaponType } from '../types';

type LoadState = 'loading' | 'loaded' | 'failed';

interface WeaponAssetSpec {
  id: string;
  url: string;
  glow: string;
  alpha?: number;
}

interface WeaponAssetEntry {
  image: HTMLImageElement;
  state: LoadState;
}

export interface WeaponAssetDrawOptions {
  alpha?: number;
  rotation?: number;
  scale?: number;
  glow?: boolean;
}

const WEAPON_ROOT = '/sprites/weapons';

export const WEAPON_ASSETS: Record<WeaponType, WeaponAssetSpec> = {
  [WeaponType.WHIP]: {
    id: 'weapon-whip',
    url: `${WEAPON_ROOT}/whip.svg`,
    glow: 'rgba(255,180,72,0.72)',
  },
  [WeaponType.MAGIC_WAND]: {
    id: 'weapon-magic-wand',
    url: `${WEAPON_ROOT}/magic_wand.svg`,
    glow: 'rgba(112,230,255,0.78)',
  },
  [WeaponType.BIBLE]: {
    id: 'weapon-bible',
    url: `${WEAPON_ROOT}/bible.svg`,
    glow: 'rgba(255,230,142,0.72)',
  },
  [WeaponType.GARLIC]: {
    id: 'weapon-garlic',
    url: `${WEAPON_ROOT}/garlic.svg`,
    glow: 'rgba(210,240,110,0.68)',
  },
  [WeaponType.FIRE_WAND]: {
    id: 'weapon-fire-wand',
    url: `${WEAPON_ROOT}/fire_wand.svg`,
    glow: 'rgba(255,102,36,0.82)',
  },
  [WeaponType.HOLY_WATER]: {
    id: 'weapon-holy-water',
    url: `${WEAPON_ROOT}/holy_water.svg`,
    glow: 'rgba(114,226,255,0.72)',
  },
  [WeaponType.LIGHTNING]: {
    id: 'weapon-lightning',
    url: `${WEAPON_ROOT}/lightning.svg`,
    glow: 'rgba(255,232,82,0.86)',
  },
  [WeaponType.AXE]: {
    id: 'weapon-axe',
    url: `${WEAPON_ROOT}/axe.svg`,
    glow: 'rgba(190,222,255,0.68)',
  },
  [WeaponType.RUNE_LANCE]: {
    id: 'weapon-rune-lance',
    url: `${WEAPON_ROOT}/rune_lance.svg`,
    glow: 'rgba(118,244,255,0.78)',
  },
  [WeaponType.MOON_BLADE]: {
    id: 'weapon-moon-blade',
    url: `${WEAPON_ROOT}/moon_blade.svg`,
    glow: 'rgba(196,160,255,0.76)',
  },
};

class WeaponSpriteRegistry {
  private entries = new Map<string, WeaponAssetEntry>();

  drawWeapon(
    ctx: CanvasRenderingContext2D,
    type: WeaponType,
    x: number,
    y: number,
    size: number,
    options: WeaponAssetDrawOptions = {}
  ): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return false;
    const spec = WEAPON_ASSETS[type];
    if (!spec) return false;
    const entry = this.getEntry(spec);
    if (entry.state !== 'loaded' || entry.image.naturalWidth <= 0 || entry.image.naturalHeight <= 0) return false;

    const scale = options.scale ?? 1;
    const drawSize = size * scale;
    ctx.save();
    ctx.globalAlpha *= (spec.alpha ?? 1) * (options.alpha ?? 1);
    ctx.translate(x, y);
    if (options.rotation) ctx.rotate(options.rotation);
    if (options.glow) {
      ctx.shadowColor = spec.glow;
      ctx.shadowBlur = drawSize * 0.18;
    }
    ctx.drawImage(entry.image, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
    return true;
  }

  private getEntry(spec: WeaponAssetSpec): WeaponAssetEntry {
    const existing = this.entries.get(spec.id);
    if (existing) return existing;

    const image = new Image();
    const entry: WeaponAssetEntry = { image, state: 'loading' };
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

export const weaponSpriteRegistry = new WeaponSpriteRegistry();
