import { WeaponEvolutionId, WeaponType } from '../types';
import { WEAPON_EVOLUTION_ASSETS, type WeaponEvolutionAssetSpec } from '../data/weaponEvolutionAssets';

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
  evolutionIds?: readonly WeaponEvolutionId[];
  evolutionIntensity?: number;
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
    if (options.evolutionIds !== undefined && options.evolutionIds.length > 0) {
      this.drawEvolutionLayers(ctx, options.evolutionIds, drawSize, options.evolutionIntensity ?? 1);
    }
    ctx.restore();
    return true;
  }

  drawEvolutionAssets(
    ctx: CanvasRenderingContext2D,
    evolutionIds: readonly WeaponEvolutionId[] | undefined,
    x: number,
    y: number,
    size: number,
    options: Pick<WeaponAssetDrawOptions, 'alpha' | 'rotation' | 'evolutionIntensity'> = {}
  ): boolean {
    if (!evolutionIds || evolutionIds.length === 0) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return false;
    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 1;
    ctx.translate(x, y);
    if (options.rotation) ctx.rotate(options.rotation);
    this.drawEvolutionLayers(ctx, evolutionIds, size, options.evolutionIntensity ?? 1);
    ctx.restore();
    return true;
  }

  private drawEvolutionLayers(
    ctx: CanvasRenderingContext2D,
    evolutionIds: readonly WeaponEvolutionId[],
    size: number,
    intensity: number
  ) {
    const ids = evolutionIds.slice(0, 2);
    for (let i = 0; i < ids.length; i++) {
      const spec = WEAPON_EVOLUTION_ASSETS[ids[i]];
      if (!spec) continue;
      this.drawEvolutionLayer(ctx, spec, size * (1 + i * 0.18), Math.max(0.18, intensity * (0.9 - i * 0.12)), i);
    }
  }

  private drawEvolutionLayer(
    ctx: CanvasRenderingContext2D,
    spec: WeaponEvolutionAssetSpec,
    size: number,
    alpha: number,
    layer: number
  ) {
    const r = size * 0.5;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = spec.glow;
    ctx.shadowBlur = size * 0.18;

    const ringLike = spec.shape === 'ring' || spec.shape === 'orbit' || spec.shape === 'reach' ||
      spec.shape === 'basin' || spec.shape === 'field';
    if (ringLike) {
      ctx.strokeStyle = spec.primary;
      ctx.lineWidth = Math.max(1.2, size * 0.035);
      ctx.setLineDash(spec.shape === 'orbit' || spec.shape === 'reach' ? [size * 0.1, size * 0.08] : []);
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.82 + layer * 0.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = spec.secondary;
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, -0.2, Math.PI * 1.35);
      ctx.stroke();
      this.drawTinyGlyph(ctx, spec, 0, 0, size, 0.48);
      ctx.restore();
      return;
    }

    switch (spec.shape) {
      case 'length':
      case 'haste':
        ctx.strokeStyle = spec.primary;
        ctx.lineWidth = Math.max(1.4, size * 0.035);
        for (let i = 0; i < (spec.shape === 'haste' ? 3 : 2); i++) {
          const off = (i - 1) * size * 0.11;
          ctx.beginPath();
          ctx.moveTo(-r * 0.62, off + r * 0.18);
          ctx.quadraticCurveTo(-r * 0.05, off - r * 0.2, r * 0.64, off - r * 0.12);
          ctx.stroke();
        }
        break;
      case 'edge':
      case 'executioner':
      case 'scour':
        ctx.strokeStyle = spec.primary;
        ctx.lineWidth = Math.max(1.8, size * 0.04);
        ctx.beginPath();
        ctx.moveTo(-r * 0.52, r * 0.24);
        ctx.lineTo(r * 0.2, -r * 0.48);
        ctx.lineTo(r * 0.58, -r * 0.22);
        ctx.stroke();
        ctx.strokeStyle = spec.secondary;
        ctx.lineWidth = Math.max(1, size * 0.022);
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, r * 0.46);
        ctx.lineTo(r * 0.52, -r * 0.24);
        ctx.stroke();
        break;
      case 'twin':
        for (const side of [-1, 1]) {
          const grad = ctx.createRadialGradient(side * r * 0.38, -r * 0.18, 0, side * r * 0.38, -r * 0.18, r * 0.24);
          grad.addColorStop(0, spec.primary);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(side * r * 0.38, -r * 0.18, r * 0.24, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'pierce':
      case 'rod':
        ctx.strokeStyle = spec.primary;
        ctx.lineWidth = Math.max(1.8, size * 0.04);
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, 0);
        ctx.lineTo(r * 0.54, 0);
        ctx.stroke();
        ctx.fillStyle = spec.secondary;
        ctx.beginPath();
        ctx.moveTo(r * 0.68, 0);
        ctx.lineTo(r * 0.42, -r * 0.14);
        ctx.lineTo(r * 0.48, 0);
        ctx.lineTo(r * 0.42, r * 0.14);
        ctx.closePath();
        ctx.fill();
        break;
      case 'volley':
      case 'storm':
      case 'tempest':
      case 'deluge':
      case 'array':
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7 + layer * 0.3;
          const d = r * (0.28 + (i % 3) * 0.16);
          this.drawSpark(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.07, i % 2 === 0 ? spec.primary : spec.secondary);
        }
        break;
      case 'focus':
      case 'brand':
      case 'judgment':
        ctx.fillStyle = spec.primary;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.5);
        ctx.lineTo(r * 0.34, 0);
        ctx.lineTo(0, r * 0.5);
        ctx.lineTo(-r * 0.34, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = spec.secondary;
        ctx.lineWidth = Math.max(1.2, size * 0.026);
        ctx.stroke();
        break;
      case 'aura':
      case 'pool':
      case 'tide':
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = i % 2 === 0 ? spec.primary : spec.secondary;
          ctx.globalAlpha *= 0.82;
          ctx.lineWidth = Math.max(1, size * 0.018);
          ctx.beginPath();
          ctx.ellipse(0, r * 0.1, r * (0.36 + i * 0.13), r * (0.18 + i * 0.08), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case 'thorn':
        ctx.fillStyle = spec.primary;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(r * 0.42, 0);
          ctx.lineTo(r * 0.7, -r * 0.07);
          ctx.lineTo(r * 0.62, r * 0.08);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      case 'ward':
      case 'bulwark':
      case 'guard':
        ctx.strokeStyle = spec.primary;
        ctx.lineWidth = Math.max(1.6, size * 0.035);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, Math.PI * 0.12, Math.PI * 0.88);
        ctx.arc(0, 0, r * 0.62, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        ctx.fillStyle = spec.secondary;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.48);
        ctx.lineTo(r * 0.34, -r * 0.16);
        ctx.lineTo(r * 0.22, r * 0.36);
        ctx.lineTo(0, r * 0.52);
        ctx.lineTo(-r * 0.22, r * 0.36);
        ctx.lineTo(-r * 0.34, -r * 0.16);
        ctx.closePath();
        ctx.fill();
        break;
      case 'burst':
      case 'breaker':
      case 'fan':
        ctx.strokeStyle = spec.primary;
        ctx.lineWidth = Math.max(1.4, size * 0.03);
        for (let i = -2; i <= 2; i++) {
          const a = i * 0.22;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
          ctx.stroke();
        }
        break;
    }

    this.drawTinyGlyph(ctx, spec, r * 0.36, -r * 0.36, size, 0.34);
    ctx.restore();
  }

  private drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - radius * 1.5);
    ctx.lineTo(x + radius * 0.5, y - radius * 0.35);
    ctx.lineTo(x + radius * 1.5, y);
    ctx.lineTo(x + radius * 0.5, y + radius * 0.35);
    ctx.lineTo(x, y + radius * 1.5);
    ctx.lineTo(x - radius * 0.5, y + radius * 0.35);
    ctx.lineTo(x - radius * 1.5, y);
    ctx.lineTo(x - radius * 0.5, y - radius * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  private drawTinyGlyph(
    ctx: CanvasRenderingContext2D,
    spec: WeaponEvolutionAssetSpec,
    x: number,
    y: number,
    size: number,
    scale: number
  ) {
    ctx.shadowBlur = size * 0.08;
    ctx.font = `800 ${Math.max(9, Math.round(size * scale))}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = spec.primary;
    ctx.fillText(spec.glyph, x, y);
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
