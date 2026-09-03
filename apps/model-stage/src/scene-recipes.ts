import { toPublicScenePlanDiagnostics } from '@skenora/scene-plan'
import type { SceneDocumentData, SceneRevisionToken } from '@skenora/sdk/editor'
import type { SceneController } from './scene-controller'
import { describeProjectionWarning } from './scene-result'

type LightConfig = SceneDocumentData['lights'][number]
type PostProcessConfig = SceneDocumentData['postProcess']
type PatchOperation = Record<string, unknown>

export type EffectPresetId =
  | 'soft-studio'
  | 'dark-product'
  | 'black-gold'
  | 'cool-tech'
  | 'transparent-cutout'

export type CameraViewId = 'front' | 'left-quarter' | 'right-quarter' | 'top'

export interface EffectPresetDefinition {
  id: EffectPresetId
  name: string
  description: string
  badge: string
  preview: {
    background: string
    ground: string
    key: string
    rim: string
  }
}

export interface CameraViewDefinition {
  id: CameraViewId
  label: string
  shortLabel: string
  offset: { x: number; y: number; z: number }
}

export interface BackgroundChoice {
  id: string
  label: string
  mode: 'color' | 'transparent'
  color: string
}

export interface LocalScenePlan {
  id: string
  label: string
  kind: 'preset' | 'camera' | 'background' | 'light'
  plan: Record<string, unknown>
  revisionToken: SceneRevisionToken
}

export interface LocalSceneApplyResult {
  planJson: string
  planHash: string | null
  operationId: string
  baseRevision: number | null
  revision: number | null
  projectionStatus: string
  projectionWarning: string | null
  modelFailureEntityIds: readonly string[]
  changes: Readonly<{
    created: readonly string[]
    updated: readonly string[]
    removed: readonly string[]
  }>
}

export class LocalScenePlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocalScenePlanError'
  }
}

export const EFFECT_PRESETS: readonly EffectPresetDefinition[] = [
  {
    id: 'soft-studio',
    name: '柔光白棚',
    description: '均匀柔光与轻阴影，适合商品和手办。',
    badge: '通用',
    preview: {
      background: '#e9e9e5',
      ground: '#c9c9c4',
      key: '#fff4e6',
      rim: '#dce8ff'
    }
  },
  {
    id: 'dark-product',
    name: '深色产品棚',
    description: '集中主光和冷色轮廓，强化结构与材质。',
    badge: '产品',
    preview: {
      background: '#0a0c10',
      ground: '#171a20',
      key: '#f6e3cf',
      rim: '#8aaeff'
    }
  },
  {
    id: 'black-gold',
    name: '黑金轮廓',
    description: '暖金边缘和克制辉光，适合高级展示。',
    badge: '氛围',
    preview: {
      background: '#030303',
      ground: '#100c07',
      key: '#ffd49a',
      rim: '#ffb24d'
    }
  },
  {
    id: 'cool-tech',
    name: '冷蓝科技',
    description: '蓝黑空间、冷色主光和轻微发光效果。',
    badge: '科技',
    preview: {
      background: '#07101b',
      ground: '#0b1a2a',
      key: '#cfe7ff',
      rim: '#54c7ff'
    }
  },
  {
    id: 'transparent-cutout',
    name: '透明素材',
    description: '透明背景和中性照明，方便后续排版使用。',
    badge: '素材',
    preview: {
      background: 'transparent',
      ground: 'transparent',
      key: '#ffffff',
      rim: '#d9e4f5'
    }
  }
]

export const CAMERA_VIEWS: readonly CameraViewDefinition[] = [
  {
    id: 'front',
    label: '正面机位',
    shortLabel: '正面',
    offset: { x: 0, y: 1.5, z: -6 }
  },
  {
    id: 'left-quarter',
    label: '左前 45° 机位',
    shortLabel: '左前',
    offset: { x: 4.6, y: 2.9, z: -5.2 }
  },
  {
    id: 'right-quarter',
    label: '右前 45° 机位',
    shortLabel: '右前',
    offset: { x: -4.6, y: 2.9, z: -5.2 }
  },
  {
    id: 'top',
    label: '俯视机位',
    shortLabel: '俯视',
    offset: { x: 0, y: 7, z: -0.5 }
  }
]

export const BACKGROUND_CHOICES: readonly BackgroundChoice[] = [
  { id: 'black', label: '纯黑', mode: 'color', color: '#000000' },
  { id: 'graphite', label: '石墨灰', mode: 'color', color: '#1b1d22' },
  { id: 'white', label: '暖白', mode: 'color', color: '#f1f1ed' },
  { id: 'warm', label: '暖棕', mode: 'color', color: '#342b24' },
  { id: 'cool', label: '深蓝', mode: 'color', color: '#0c1826' },
  { id: 'transparent', label: '透明', mode: 'transparent', color: '#ffffff' }
]

export function createEffectPresetPlan(
  presetId: EffectPresetId,
  document: SceneDocumentData,
  revisionToken: SceneRevisionToken
): LocalScenePlan {
  const preset = EFFECT_PRESETS.find((item) => item.id === presetId)
  if (!preset) throw new LocalScenePlanError('未找到这个效果方案')
  const config = presetConfig(presetId)
  const operations: PatchOperation[] = [
    settingOperation('environment', config.environment),
    settingOperation('ground', config.ground),
    settingOperation('fog', disabledFog()),
    settingOperation('weather', disabledWeather()),
    settingOperation('camera', config.camera),
    settingOperation('postProcess', config.postProcess),
    ...config.lights.map((light) => lightOperation(document, light))
  ]
  return {
    id: preset.id,
    label: preset.name,
    kind: 'preset',
    revisionToken,
    plan: createPatch(revisionToken, operations)
  }
}

export function createCameraViewPlan(
  viewId: CameraViewId,
  document: SceneDocumentData,
  revisionToken: SceneRevisionToken
): LocalScenePlan {
  const view = CAMERA_VIEWS.find((item) => item.id === viewId)
  if (!view) throw new LocalScenePlanError('未找到这个快捷机位')
  const target = document.camera.target
  const position = {
    x: target.x + view.offset.x,
    y: target.y + view.offset.y,
    z: target.z + view.offset.z
  }
  return {
    id: view.id,
    label: view.label,
    kind: 'camera',
    revisionToken,
    plan: createPatch(revisionToken, [
      settingOperation('camera', {
        mode: 'orbit',
        position,
        target,
        ...orbitCoordinates(position, target),
        fov: document.camera.fov ?? 0.76,
        speed: document.camera.speed ?? 0.85
      })
    ])
  }
}

export function createBackgroundPlan(
  backgroundId: string,
  revisionToken: SceneRevisionToken
): LocalScenePlan {
  const background = BACKGROUND_CHOICES.find((item) => item.id === backgroundId)
  if (!background) throw new LocalScenePlanError('未找到这个背景颜色')
  return {
    id: background.id,
    label: `${background.label}背景`,
    kind: 'background',
    revisionToken,
    plan: createPatch(revisionToken, [
      settingOperation('environment', {
        background: {
          mode: background.mode,
          color: background.color,
          blur: 0
        }
      })
    ])
  }
}

export function createLightIntensityPlan(
  lightId: string,
  intensity: number,
  document: SceneDocumentData,
  revisionToken: SceneRevisionToken
): LocalScenePlan {
  const light = document.lights.find((item) => item.id === lightId)
  if (!light) throw new LocalScenePlanError('当前方案中没有这盏灯')
  if (!Number.isFinite(intensity)) throw new LocalScenePlanError('灯光强度必须是有效数值')
  const label =
    lightId === 'workspace-key'
      ? '主光'
      : lightId === 'workspace-fill'
        ? '补光'
        : lightId === 'workspace-rim'
          ? '轮廓光'
          : lightId
  return {
    id: lightId,
    label: `${label}强度`,
    kind: 'light',
    revisionToken,
    plan: createPatch(revisionToken, [
      {
        op: 'update',
        target: { kind: 'light', id: lightId },
        changes: [
          { path: ['intensity'], value: clamp(intensity, 0, Math.max(2.5, light.intensity)) }
        ]
      }
    ])
  }
}

export async function applyLocalScenePlan(
  scene: SceneController,
  localPlan: LocalScenePlan,
  signal: AbortSignal
): Promise<LocalSceneApplyResult> {
  const validation = scene.validatePlan(localPlan.plan)
  if (!validation.valid) {
    const diagnostics = toPublicScenePlanDiagnostics(validation.diagnostics)
    throw new LocalScenePlanError(
      `效果方案未通过 Skenora 校验：${formatDiagnostics(diagnostics)}`
    )
  }

  const planJson = JSON.stringify(localPlan.plan, null, 2)
  const applied = await scene.applyPlan(
    planJson,
    localPlan.revisionToken,
    signal,
    crypto.randomUUID(),
    `本地效果：${localPlan.label}`
  )
  if (applied.status !== 'committed') {
    const diagnostics = toPublicScenePlanDiagnostics(applied.diagnostics)
    throw new LocalScenePlanError(
      applied.status === 'cancelled'
        ? '操作已取消，场景未修改'
        : `效果方案没有修改场景：${formatDiagnostics(diagnostics)}`
    )
  }

  const projectionStatus = applied.projection?.status ?? 'skipped'
  const modelFailureEntityIds = applied.projection?.modelFailureEntityIds ?? []
  return {
    planJson,
    planHash: applied.planHash ?? validation.planHash ?? null,
    operationId: applied.operationId,
    baseRevision: applied.baseRevision ?? null,
    revision: applied.revision ?? null,
    projectionStatus,
    projectionWarning: describeProjectionWarning(
      projectionStatus,
      modelFailureEntityIds.length
    ),
    modelFailureEntityIds,
    changes: applied.changes ?? { created: [], updated: [], removed: [] }
  }
}

interface PresetConfig {
  environment: SceneDocumentData['environment']
  ground: SceneDocumentData['ground']
  camera: SceneDocumentData['camera']
  postProcess: PostProcessConfig
  lights: readonly LightConfig[]
}

function presetConfig(id: EffectPresetId): PresetConfig {
  if (id === 'soft-studio') {
    return {
      environment: environment('#edede9'),
      ground: ground('#deded9', 0.2),
      camera: camera({ x: 4.5, y: 3, z: -5.8 }, { x: 0, y: 0.75, z: 0 }),
      postProcess: postProcess({ exposure: 1.06, contrast: 1.02 }),
      lights: lights({
        fill: { intensity: 0.95, color: { r: 1, g: 1, b: 1 } },
        key: { intensity: 1.25, color: { r: 1, g: 0.94, b: 0.87 } },
        rim: { intensity: 0.38, color: { r: 0.82, g: 0.89, b: 1 } }
      })
    }
  }
  if (id === 'dark-product') {
    return {
      environment: environment('#0a0c10'),
      ground: ground('#171a20', 0.32),
      camera: camera({ x: 4.8, y: 2.8, z: -5.5 }, { x: 0, y: 0.72, z: 0 }),
      postProcess: postProcess({ exposure: 1, contrast: 1.14 }),
      lights: lights({
        fill: { intensity: 0.38, color: { r: 0.72, g: 0.78, b: 0.9 } },
        key: { intensity: 1.65, color: { r: 1, g: 0.88, b: 0.76 } },
        rim: { intensity: 0.92, color: { r: 0.45, g: 0.62, b: 1 } }
      })
    }
  }
  if (id === 'black-gold') {
    return {
      environment: environment('#030303'),
      ground: ground('#100c07', 0.38),
      camera: camera({ x: 4.9, y: 2.6, z: -5.1 }, { x: 0, y: 0.72, z: 0 }),
      postProcess: postProcess({
        exposure: 0.96,
        contrast: 1.18,
        bloom: true,
        bloomWeight: 0.18,
        bloomThreshold: 0.84,
        vignetteEnabled: true,
        vignetteWeight: 1.25
      }),
      lights: lights({
        fill: { intensity: 0.22, color: { r: 0.74, g: 0.62, b: 0.46 } },
        key: { intensity: 1.72, color: { r: 1, g: 0.72, b: 0.38 } },
        rim: { intensity: 1.16, color: { r: 1, g: 0.52, b: 0.16 } }
      })
    }
  }
  if (id === 'cool-tech') {
    return {
      environment: environment('#07101b'),
      ground: ground('#0b1a2a', 0.3),
      camera: camera({ x: 4.6, y: 2.7, z: -5.6 }, { x: 0, y: 0.74, z: 0 }),
      postProcess: postProcess({
        exposure: 1.02,
        contrast: 1.13,
        bloom: true,
        bloomWeight: 0.12,
        bloomThreshold: 0.9
      }),
      lights: lights({
        fill: { intensity: 0.46, color: { r: 0.54, g: 0.7, b: 0.94 } },
        key: { intensity: 1.48, color: { r: 0.76, g: 0.9, b: 1 } },
        rim: { intensity: 1.08, color: { r: 0.22, g: 0.74, b: 1 } }
      })
    }
  }
  return {
    environment: environment('#ffffff', 'transparent'),
    ground: { ...ground('#ffffff', 0), enabled: false },
    camera: camera({ x: 4.5, y: 2.8, z: -5.8 }, { x: 0, y: 0.72, z: 0 }),
    postProcess: postProcess({ exposure: 1, contrast: 1.02 }),
    lights: lights({
      fill: { intensity: 0.86, color: { r: 1, g: 1, b: 1 } },
      key: { intensity: 1.28, color: { r: 1, g: 0.97, b: 0.92 } },
      rim: { intensity: 0.44, color: { r: 0.82, g: 0.88, b: 0.96 } }
    })
  }
}

function environment(
  color: string,
  mode: 'color' | 'transparent' = 'color'
): SceneDocumentData['environment'] {
  return {
    enabled: false,
    intensity: 0,
    rotationY: 0,
    background: { mode, color, blur: 0 }
  }
}

function ground(color: string, shadowOpacity: number): SceneDocumentData['ground'] {
  return {
    enabled: true,
    mode: 'shadow-catcher',
    size: 20,
    fitToScene: true,
    padding: 1.4,
    height: 0,
    color,
    opacity: 1,
    shadowOpacity,
    receiveShadows: true
  }
}

function camera(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): SceneDocumentData['camera'] {
  return {
    mode: 'orbit',
    position,
    target,
    ...orbitCoordinates(position, target),
    minZ: 0.01,
    maxZ: 10_000,
    fov: 0.72,
    speed: 0.8
  }
}

function disabledFog(): SceneDocumentData['fog'] {
  return {
    enabled: false,
    mode: 'linear',
    color: { r: 0, g: 0, b: 0 },
    start: 20,
    end: 100,
    density: 0
  }
}

function disabledWeather(): SceneDocumentData['weather'] {
  return {
    enabled: false,
    type: 'rain',
    intensity: 0,
    wind: { x: 0, z: 0 },
    particleSize: 0.1,
    followCamera: true,
    emitterHeight: 10,
    areaSize: 20
  }
}

function postProcess(overrides: Partial<PostProcessConfig>): PostProcessConfig {
  return {
    enabled: true,
    antialiasing: 'samples',
    samples: 4,
    imageProcessing: true,
    dithering: true,
    bloom: false,
    bloomWeight: 0.12,
    bloomThreshold: 0.9,
    bloomKernel: 32,
    sharpen: false,
    sharpenColorAmount: 0.3,
    grain: false,
    grainAnimated: false,
    glow: false,
    glowIntensity: 0.2,
    glowBlurKernelSize: 32,
    chromaticAberration: false,
    depthOfField: false,
    exposure: 1,
    contrast: 1.04,
    sharpenEdgeAmount: 0.3,
    grainIntensity: 5,
    chromaticAberrationAmount: 30,
    chromaticAberrationRadialIntensity: 0,
    chromaticAberrationDirection: 0,
    depthOfFieldBlurLevel: 'low',
    depthOfFieldFocusDistance: 2_000,
    depthOfFieldFStop: 1.4,
    depthOfFieldFocalLength: 50,
    depthOfFieldLensSize: 50,
    vignetteEnabled: false,
    vignetteWeight: 1.1,
    vignetteCameraFov: 0.5,
    toneMappingEnabled: true,
    toneMappingType: 'aces',
    colorCurves: {
      enabled: false,
      globalHue: 30,
      globalDensity: 0,
      globalSaturation: 0
    },
    ssao: {
      enabled: false,
      ssaoRatio: 0.5,
      combineRatio: 1,
      totalStrength: 1,
      base: 0,
      radius: 0.0001,
      area: 0.0075,
      fallOff: 0.000001
    },
    ...overrides
  }
}

function lights(config: {
  fill: Pick<LightConfig, 'intensity' | 'color'>
  key: Pick<LightConfig, 'intensity' | 'color'>
  rim: Pick<LightConfig, 'intensity' | 'color'>
}): readonly LightConfig[] {
  const noShadows = {
    enabled: false,
    bias: 0.0008,
    normalBias: 0.02,
    mapSize: 1024,
    darkness: 0.2,
    filtering: 'pcf' as const
  }
  return [
    {
      id: 'workspace-fill',
      type: 'hemispheric',
      enabled: true,
      ...config.fill,
      intensityMode: 'automatic',
      falloff: 'default',
      rotation: { x: 0, y: 0, z: 0 },
      shadows: noShadows
    },
    {
      id: 'workspace-key',
      type: 'directional',
      enabled: true,
      ...config.key,
      intensityMode: 'automatic',
      falloff: 'default',
      position: { x: 0, y: 10, z: 0 },
      rotation: { x: 0.78, y: -0.58, z: 0.18 },
      shadows: {
        enabled: true,
        bias: 0.0008,
        normalBias: 0.02,
        mapSize: 1024,
        darkness: 0.26,
        filtering: 'pcf'
      }
    },
    {
      id: 'workspace-rim',
      type: 'directional',
      enabled: true,
      ...config.rim,
      intensityMode: 'automatic',
      falloff: 'default',
      position: { x: 0, y: 10, z: 0 },
      rotation: { x: -0.46, y: 2.24, z: 0 },
      shadows: noShadows
    }
  ]
}

function createPatch(
  revisionToken: SceneRevisionToken,
  operations: readonly PatchOperation[]
): Record<string, unknown> {
  return {
    schema: 'skenora.scene.patch',
    version: 1,
    target: {
      sceneId: revisionToken.sceneId,
      expectedRevision: revisionToken.revision,
      expectedDocumentHash: revisionToken.documentHash
    },
    operations
  }
}

function settingOperation(
  id: string,
  value: object
): PatchOperation {
  return {
    op: 'update',
    target: { kind: 'setting', id },
    changes: Object.entries(value).map(([key, child]) => ({
      path: [key],
      value: child
    }))
  }
}

function lightOperation(
  document: SceneDocumentData,
  light: LightConfig
): PatchOperation {
  const existing = document.lights.some((item) => item.id === light.id)
  if (!existing) {
    return {
      op: 'create',
      target: { kind: 'light', id: light.id },
      value: light
    }
  }
  return {
    op: 'update',
    target: { kind: 'light', id: light.id },
    changes: Object.entries(light)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => ({ path: [key], value }))
  }
}

function formatDiagnostics(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '未知校验错误'
  return value
    .slice(0, 3)
    .map((item) => {
      if (!isRecord(item)) return String(item)
      const path = Array.isArray(item.path) ? item.path.join('.') : ''
      const code = typeof item.code === 'string' ? item.code : 'invalid'
      return path ? `${code} (${path})` : code
    })
    .join('；')
}

function orbitCoordinates(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): { alpha: number; beta: number; radius: number } {
  const x = position.x - target.x
  const y = position.y - target.y
  const z = position.z - target.z
  const radius = Math.max(0.01, Math.hypot(x, y, z))
  return {
    alpha: Math.atan2(z, x),
    beta: Math.acos(clamp(y / radius, -1, 1)),
    radius
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
