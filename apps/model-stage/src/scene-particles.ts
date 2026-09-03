import {
  createParticlePreset,
  createWeatherPreset,
  getBuiltinParticleTextureAsset,
  type BuiltinParticleTexture
} from '@skenora/sdk/particles'
import type { EntityRecord, SceneDocumentData } from '@skenora/sdk/editor'

export const DRIFT_ENTITY_ID = 'model-stage-ambient-drift'
export const ATMOSPHERE_PRESETS = [
  { id: 'none', label: '关闭' },
  { id: 'rain-v1', label: '雨幕' },
  { id: 'snow-v1', label: '飘雪' },
  { id: 'drift-v1', label: '漂浮光点' }
] as const
export type AtmospherePresetId = (typeof ATMOSPHERE_PRESETS)[number]['id']

const textures: readonly BuiltinParticleTexture[] = [
  'rain-streak-v1', 'snow-grain-v1', 'soft-dot-v1'
]

export function builtinParticleAssets() {
  // Metadata only. The installed provider loads each bundled image on demand.
  return textures.map((texture) => getBuiltinParticleTextureAsset(texture))
}

export function isBuiltinParticleAssetId(value: unknown): value is string {
  return typeof value === 'string' && builtinParticleAssets().some((asset) => asset.id === value)
}

export function createDriftEntity(density = 1): EntityRecord & {
  properties: Record<string, unknown> & { emitRate: number }
} {
  const preset = createParticlePreset('drift-v1', {
    id: DRIFT_ENTITY_ID,
    name: '环境 · 漂浮光点'
  })
  return {
    ...preset.entity,
    properties: {
      ...preset.entity.properties,
      emitRate: Number(preset.entity.properties?.emitRate) * density
    }
  }
}

export function readDriftDensity(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2
    ? value
    : null
}

export function captureDriftDensity(document: SceneDocumentData): number | null {
  const entity = document.entities[DRIFT_ENTITY_ID]
  if (!entity || entity.type !== 'particle' || !entity.enabled || !entity.visible || entity.parentId !== null) {
    return null
  }
  const defaults = createDriftEntity()
  // Only this app-owned, model-independent preset is recoverable. Arbitrary
  // particle entities, transforms and material/Flow references stay session-only.
  if (entity.properties?.textureAssetId !== defaults.properties.textureAssetId) return null
  const density = readDriftDensity(Number(entity.properties?.emitRate) / defaults.properties.emitRate)
  if (density === null) return null
  const expected = createDriftEntity(density)
  expected.properties.emitRate = Number(entity.properties?.emitRate)
  return sameJson(entity, expected) ? density : null
}

export function getAtmosphereState(document: SceneDocumentData): {
  presetId: AtmospherePresetId | 'custom'
  density: number
} {
  const drift = document.entities[DRIFT_ENTITY_ID]
  const driftActive = drift?.enabled && drift.visible
  const driftDensity = captureDriftDensity(document)
  if (document.weather.enabled) {
    if (driftActive) return { presetId: 'custom', density: 1 }
    const id = document.weather.type === 'rain' ? 'rain-v1' : 'snow-v1'
    const preset = createWeatherPreset(id)
    if (document.weather.textureAssetId !== preset.weather.textureAssetId) {
      return { presetId: 'custom', density: 1 }
    }
    return { presetId: id, density: document.weather.intensity / preset.weather.intensity }
  }
  if (driftDensity !== null) return { presetId: 'drift-v1', density: driftDensity }
  return { presetId: driftActive ? 'custom' : 'none', density: 1 }
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((item, index) => sameJson(item, right[index]))
  }
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
}
