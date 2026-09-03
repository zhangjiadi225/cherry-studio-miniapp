import {
  createEmptySceneDocument,
  parseSceneJson,
  type SceneDocumentData
} from '@skenora/sdk/editor'
import {
  builtinParticleAssets,
  createDriftEntity,
  isBuiltinParticleAssetId,
  readDriftDensity
} from './scene-particles'

const settingKeys = [
  'environment', 'ground', 'fog', 'weather', 'camera', 'lights', 'postProcess'
] as const

type SettingKey = (typeof settingKeys)[number]
export type StageSettings = Pick<SceneDocumentData, SettingKey> & { driftDensity: number | null }

export function createWorkspaceDocument(): SceneDocumentData {
  const document = createEmptySceneDocument('model-stage-scene', '模型布景')
  // Fixed package-owned resources are reconstructed, never loaded from a saved
  // asset table or local model path. Image modules stay lazy until used.
  for (const asset of builtinParticleAssets()) document.assets[asset.id] = asset
  document.environment = {
    enabled: true,
    intensity: 0,
    rotationY: 0,
    background: { mode: 'color', color: '#000000', blur: 0 }
  }
  document.lights = [
    {
      id: 'workspace-fill', type: 'hemispheric', enabled: true, intensity: 0.72,
      color: { r: 0.95, g: 0.96, b: 1 }, rotation: { x: 0, y: 0, z: 0 }
    },
    {
      id: 'workspace-key', type: 'directional', enabled: true, intensity: 1.45,
      color: { r: 1, g: 0.91, b: 0.82 }, rotation: { x: 0.8, y: -0.55, z: 0.18 },
      shadows: {
        enabled: true, bias: 0.0008, normalBias: 0.02, mapSize: 1024,
        darkness: 0.28, filtering: 'pcf'
      }
    },
    {
      id: 'workspace-rim', type: 'directional', enabled: true, intensity: 0.62,
      color: { r: 0.74, g: 0.83, b: 1 }, rotation: { x: -0.45, y: 2.25, z: 0 }
    }
  ]
  document.postProcess = {
    ...document.postProcess,
    contrast: 1.04,
    toneMappingEnabled: true,
    toneMappingType: 'aces'
  }
  document.camera = {
    ...document.camera,
    position: { x: 4.6, y: 3.2, z: -6.2 },
    target: { x: 0, y: 0, z: 0 },
    fov: 0.76,
    speed: 0.85
  }
  return document
}

export function createStageDocument(settings: StageSettings | null): SceneDocumentData {
  const document = createWorkspaceDocument()
  if (settings) {
    const safe = readStageSettings(settings).settings
    // Never spread a saved document into the editor: imported resources and
    // arbitrary entities are session-only. Rebuild only the owned drift recipe.
    for (const key of settingKeys) Object.assign(document, { [key]: structuredClone(safe[key]) })
    if (safe.driftDensity !== null) {
      const entity = createDriftEntity(safe.driftDensity)
      document.entities[entity.id] = entity
      document.rootEntityIds.push(entity.id)
    }
  }
  return document
}

export function readStageSettings(value: unknown): {
  settings: StageSettings
  warning: string | null
} {
  let document = createWorkspaceDocument()
  const warnings = new Set<string>()
  if (!isRecord(value)) {
    warnings.add('布景数据无效，已使用默认设置')
  } else {
    // Select recoverable fields BEFORE parsing, so stale model references cannot
    // reject otherwise recoverable settings from a v2/v3/v4 scene document.
    for (const key of settingKeys) {
      if (value[key] === undefined) {
        warnings.add(`${settingLabels[key]}缺失，已使用默认设置`)
        continue
      }
      try {
        const section = selectSection(key, value[key], warnings)
        document = parseSceneJson(JSON.stringify({ ...document, [key]: section }))
      } catch {
        warnings.add(`${settingLabels[key]}无效，已使用默认设置`)
      }
    }
  }
  return {
    settings: {
      environment: document.environment,
      ground: document.ground,
      fog: document.fog,
      weather: document.weather,
      camera: document.camera,
      lights: document.lights,
      postProcess: document.postProcess,
      driftDensity: isRecord(value) ? readDriftDensity(value.driftDensity) : null
    },
    warning: warnings.size ? [...warnings].join('；') : null
  }
}

const settingLabels: Record<SettingKey, string> = {
  environment: '环境', ground: '地面', fog: '雾效', weather: '天气',
  camera: '镜头', lights: '灯光', postProcess: '后期'
}
const vectorKeys = ['x', 'y', 'z']
const colorKeys = ['r', 'g', 'b']

function selectSection(
  key: SettingKey,
  value: unknown,
  warnings: Set<string>
): unknown {
  switch (key) {
    case 'environment': {
      const environment = pick(value, ['enabled', 'intensity', 'rotationY'])
      const source = requireRecord(value)
      const background = pick(source.background, ['mode', 'color', 'blur'])
      const sourceBackground = requireRecord(source.background)
      if (source.assetId !== undefined) {
        environment.enabled = false
        environment.intensity = 0
        warnings.add('外部环境贴图不跨会话保存')
      }
      if (background.mode === 'skybox') {
        const skybox = requireRecord(sourceBackground.skybox)
        const skySource = requireRecord(skybox.source)
        if (skySource.kind === 'procedural' && skySource.model === 'atmosphere-v1') {
          const safeSource = pick(skySource, ['kind', 'model'])
          if (skySource.parameters !== undefined) {
            safeSource.parameters = pick(skySource.parameters, [
              'luminance', 'turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG',
              'horizonOffset', 'dithering'
            ], { sunDiskDirection: vectorKeys, up: vectorKeys })
          }
          background.skybox = { ...pick(skybox, ['rotationY', 'blur', 'fogParticipation']), source: safeSource }
        } else {
          background.mode = 'color'
          warnings.add('外部背景已回退为纯色')
        }
      } else if (background.mode === 'image' || background.mode === 'environment') {
        background.mode = 'color'
        warnings.add('外部背景已回退为纯色')
      }
      return { ...environment, background }
    }
    case 'ground':
      return pick(value, [
        'enabled', 'mode', 'size', 'fitToScene', 'padding', 'height', 'color',
        'opacity', 'shadowOpacity', 'receiveShadows'
      ])
    case 'fog':
      return pick(value, ['enabled', 'mode', 'start', 'end', 'density'], { color: colorKeys })
    case 'weather': {
      const source = requireRecord(value)
      const weather = pick(value, [
        'enabled', 'type', 'intensity', 'particleSize', 'followCamera', 'emitterHeight', 'areaSize'
      ], { wind: ['x', 'z'] })
      if (isBuiltinParticleAssetId(source.textureAssetId)) {
        weather.textureAssetId = source.textureAssetId
      } else if (source.textureAssetId !== undefined || source.enabled === true) {
        // An omitted texture is not a visible default in Skenora. Do not claim
        // that missing custom weather textures were successfully recovered.
        weather.enabled = false
        warnings.add('天气缺少可恢复贴图，已关闭；可重新选择雨幕或飘雪')
      }
      return weather
    }
    case 'camera':
      return pick(value, ['mode', 'alpha', 'beta', 'radius', 'minZ', 'maxZ', 'fov', 'speed'], {
        position: vectorKeys, target: vectorKeys
      })
    case 'lights': {
      if (!Array.isArray(value)) throw new Error('Invalid lights')
      return value.map((light) => pick(light, [
        'id', 'type', 'enabled', 'intensity', 'range', 'radius', 'angle', 'exponent',
        'falloff', 'intensityMode'
      ], {
        color: colorKeys, position: vectorKeys, rotation: vectorKeys,
        shadows: [
          'enabled', 'bias', 'normalBias', 'mapSize', 'darkness', 'frustumEdgeFalloff',
          'filtering', 'transparent'
        ]
      }))
    }
    case 'postProcess':
      return pick(value, [
        'enabled', 'antialiasing', 'samples', 'imageProcessing', 'dithering',
        'bloom', 'bloomWeight', 'bloomThreshold', 'bloomKernel', 'sharpen',
        'sharpenColorAmount', 'grain', 'grainAnimated', 'glow', 'glowIntensity',
        'glowBlurKernelSize', 'chromaticAberration', 'depthOfField', 'exposure',
        'contrast', 'sharpenEdgeAmount', 'grainIntensity', 'chromaticAberrationAmount',
        'chromaticAberrationRadialIntensity', 'chromaticAberrationDirection',
        'depthOfFieldBlurLevel', 'depthOfFieldFocusDistance', 'depthOfFieldFStop',
        'depthOfFieldFocalLength', 'depthOfFieldLensSize', 'vignetteEnabled',
        'vignetteWeight', 'vignetteCameraFov', 'toneMappingEnabled', 'toneMappingType'
      ], {
        colorCurves: ['enabled', 'globalHue', 'globalDensity', 'globalSaturation'],
        ssao: ['enabled', 'ssaoRatio', 'combineRatio', 'totalStrength', 'base', 'radius', 'area', 'fallOff']
      })
  }
}

function pick(
  value: unknown,
  keys: readonly string[],
  nested: Record<string, readonly string[]> = {}
): Record<string, unknown> {
  const source = requireRecord(value)
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key]
  }
  for (const [key, childKeys] of Object.entries(nested)) {
    if (source[key] !== undefined) result[key] = pick(source[key], childKeys)
  }
  return result
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Invalid settings')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
