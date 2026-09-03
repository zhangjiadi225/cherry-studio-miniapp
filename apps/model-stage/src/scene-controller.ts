import {
  MemoryWorkspaceSource,
  SkenoraEditor,
  type SceneDocumentData,
  type ScenePlanApplyResult,
  type ScenePlanValidationResult,
  type SceneRevisionToken
} from '@skenora/sdk/editor'
import { createBuiltinParticleResourceProvider, createWeatherPreset } from '@skenora/sdk/particles'
import { createStageDocument, readStageSettings, type StageSettings } from './stage-settings'
import { builtinParticleAssets, captureDriftDensity, createDriftEntity } from './scene-particles'

export interface ImportedModelInfo {
  entityId: string
  assetId: string
  name: string
  size: number
  lastModified: number
  materialSlots: readonly unknown[]
}

export interface SceneAiContext {
  sceneId: string
  sceneName: string
  revisionToken: SceneRevisionToken
  subjectEntityId: string | null
  subjectName: string
  primaryModelId: string | null
  protectedModelEntityIds: readonly string[]
  capabilities: readonly unknown[]
  unavailableCapabilities: readonly unknown[]
  model: ImportedModelInfo | null
  document: Record<string, unknown>
}

type FileWithRelativePath = File & { webkitRelativePath?: string }

export class SceneController {
  #editor: SkenoraEditor | null = null
  #primaryModel: ImportedModelInfo | null = null
  #resizeRequest: number | null = null

  get editor(): SkenoraEditor {
    if (!this.#editor) throw new Error('Skenora scene is not ready')
    return this.#editor
  }

  get primaryModel(): ImportedModelInfo | null {
    return this.hasSubject && this.#primaryModel ? { ...this.#primaryModel } : null
  }

  get subjectEntityId(): string | null {
    return this.primaryModel?.entityId ?? null
  }

  get subjectName(): string {
    return this.primaryModel?.name ?? '未导入模型'
  }

  get hasSubject(): boolean {
    if (!this.#editor || !this.#primaryModel) return false
    const entity = this.#editor.getConfig().entities[this.#primaryModel.entityId]
    return entity?.type === 'model' &&
      entity.assetId === this.#primaryModel.assetId &&
      !this.#editor.modelFailures.some((failure) => failure.entityId === entity.id)
  }

  get canUndo(): boolean {
    return this.#editor?.canUndo ?? false
  }

  get canRedo(): boolean {
    return this.#editor?.canRedo ?? false
  }

  get previewing(): boolean {
    return this.#editor?.previewing ?? false
  }

  async initialize(
    canvas: HTMLCanvasElement,
    settings: StageSettings | null = null
  ): Promise<void> {
    this.#editor = await SkenoraEditor.create({
      canvas,
      source: new MemoryWorkspaceSource(),
      document: createStageDocument(settings),
      resourceProviders: [createBuiltinParticleResourceProvider()],
      runtime: {
        qualityPolicy: {
          maxPixelRatio: 2,
          maxShadowMapSize: 2048,
          maxSamples: 4
        }
      }
    })

    await this.editor.showGrid(true)
    this.#refreshViewport()
  }

  async importModel(files: readonly File[]): Promise<ImportedModelInfo> {
    const primary = files
      .filter((file) => /\.(?:glb|gltf)$/iu.test(file.name))
      .sort(compareModelFiles)[0]
    if (!primary) throw new Error('所选目录中没有找到 .glb 或 .gltf 主模型')

    const selectedDirectory = commonSelectedDirectory(files)
    const sequence = crypto.randomUUID()
    const entityId = `user-model-${sequence}`
    const assetId = `user-asset-${sequence}`
    const dependencies = files
      .filter((file) => file !== primary)
      .map((file) => ({
        file,
        relativePath: modelRelativePath(file, selectedDirectory)
      }))

    const previous = this.primaryModel
    const result = await this.editor.importModel({
      file: primary,
      dependencies,
      relativePath: modelRelativePath(primary, selectedDirectory),
      name: primary.name.replace(/\.(?:glb|gltf)$/iu, ''),
      assetId,
      entityId,
      targetDirectory: `.skenora/imports/${entityId}`,
      conflict: 'error',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scaling: { x: 1, y: 1, z: 1 }
      },
      alignment: {
        pivot: 'bounds-center',
        placement: 'ground',
        embeddedLights: 'remove',
        materialCompatibility: 'presentation'
      }
    })

    try {
      const importedFailure = this.editor.modelFailures.find(
        (failure) => failure.entityId === result.entity.id
      )
      if (importedFailure) throw importedFailure.error
      if (previous) {
        await this.editor.removeModel(previous.entityId, { removeAsset: true })
      }
    } catch (error) {
      try {
        await this.editor.removeModel(result.entity.id, { removeAsset: true })
      } catch {
        // Preserve the original replacement error; cleanup is best effort.
      }
      throw error
    }

    let materialSlots: readonly unknown[] = []
    try {
      materialSlots = this.editor.runtime.describeMaterialSlots(result.entity.id)
    } catch {
      materialSlots = []
    }

    this.#primaryModel = {
      entityId: result.entity.id,
      assetId: result.asset.id,
      name: primary.name,
      size: primary.size,
      lastModified: primary.lastModified,
      materialSlots
    }
    this.editor.frame([result.entity.id])
    return { ...this.#primaryModel }
  }

  getAiContext(): SceneAiContext {
    const inspection = this.editor.scenePlan.inspectScene({ limit: 200 })
    const document = this.editor.getConfig()
    const subjectEntityId = this.hasSubject ? this.subjectEntityId : null
    const subjectEntity = subjectEntityId ? document.entities[subjectEntityId] : null
    const subjectBindings = subjectEntityId
      ? Object.values(document.materialBindings).filter(
          (binding) => binding.entityId === subjectEntityId
        )
      : []
    const subjectMaterialIds = new Set(subjectBindings.map((binding) => binding.materialId))
    const subjectMaterials = Object.fromEntries(
      Object.entries(document.materials).filter(([id]) => subjectMaterialIds.has(id))
    )
    const availability = new Map(
      (inspection.capabilityAvailability ?? []).map((entry) => [entry.id, entry])
    )
    const capabilities = inspection.capabilities.flatMap((capability) => {
      const observed = availability.get(capability.id)
      return observed?.installed &&
        observed.enabled &&
        observed.compatibility === 'supported' &&
        observed.version === capability.version
        ? [
            {
              id: capability.id,
              version: capability.version,
              ...(capability.config === undefined ? {} : { config: capability.config }),
              ...(observed.limits ? { limits: observed.limits } : {})
            }
          ]
        : []
    })
    const unavailableCapabilityDetails = inspection.capabilities.flatMap((capability) => {
      const observed = availability.get(capability.id)
      const available =
        observed?.installed &&
        observed.enabled &&
        observed.compatibility === 'supported' &&
        observed.version === capability.version
      return available
        ? []
        : [
            {
              id: capability.id,
              version: capability.version,
              ...(observed?.version && observed.version !== capability.version
                ? { observedVersion: observed.version }
                : {}),
              reason:
                observed?.reason ??
                (!observed
                  ? 'runtime-not-observed'
                  : observed.version !== capability.version
                    ? 'version-mismatch'
                    : !observed.installed
                      ? 'not-installed'
                      : !observed.enabled
                        ? 'disabled'
                        : observed.compatibility)
            }
          ]
    })

    return {
      sceneId: inspection.sceneId,
      sceneName: inspection.sceneName,
      revisionToken: inspection.revisionToken,
      subjectEntityId,
      subjectName: this.subjectName,
      primaryModelId: this.subjectEntityId,
      protectedModelEntityIds: Object.values(document.entities)
        .filter((entity) => entity.type === 'model')
        .map((entity) => entity.id),
      capabilities,
      unavailableCapabilities: unavailableCapabilityDetails,
      model: this.primaryModel,
      document: {
        counts: inspection.counts,
        outline: inspection.outline.items,
        outlineTruncated: inspection.outline.nextCursor !== undefined,
        subjectEntity,
        subjectMaterials,
        subjectMaterialBindings: subjectBindings,
        camera: document.camera,
        environment: document.environment,
        ground: document.ground,
        fog: document.fog,
        weather: document.weather,
        lights: document.lights,
        postProcess: document.postProcess,
        particlePresets: {
          textures: builtinParticleAssets().map((asset) => ({ id: asset.id, kind: asset.kind, label: asset.label })),
          rain: createWeatherPreset('rain-v1').weather,
          snow: createWeatherPreset('snow-v1').weather,
          drift: createDriftEntity(),
          playback: '雨雪启用后即时显示；漂浮粒子只在用户显式预览时播放。'
        }
      }
    }
  }

  getPlanningSnapshot(): {
    document: SceneDocumentData
    revisionToken: SceneRevisionToken
  } {
    const inspection = this.editor.scenePlan.inspectScene({ limit: 1 })
    return {
      document: this.editor.getConfig(),
      revisionToken: inspection.revisionToken
    }
  }

  validatePlan(plan: unknown): ScenePlanValidationResult {
    return this.editor.scenePlan.validatePlan(plan)
  }

  applyPlan(
    plan: string,
    revisionToken: SceneRevisionToken,
    signal: AbortSignal,
    idempotencyKey = crypto.randomUUID(),
    label = 'Cherry AI 场景调整'
  ): Promise<ScenePlanApplyResult> {
    return this.editor.scenePlan.applyPlan(plan, {
      expectedRevisionToken: revisionToken,
      idempotencyKey,
      label,
      modelLoadPolicy: 'strict',
      signal
    })
  }

  async undo(): Promise<void> {
    await this.editor.undo()
  }

  async redo(): Promise<void> {
    await this.editor.redo()
  }

  frame(): void {
    if (this.hasSubject && this.subjectEntityId) this.editor.frame([this.subjectEntityId])
  }

  frameEntity(entityId: string): void {
    const unavailable = this.editor.modelFailures.some(
      (failure) => failure.entityId === entityId
    )
    if (!unavailable && this.editor.getConfig().entities[entityId]) {
      this.editor.frame([entityId])
    }
  }

  async resetView(): Promise<void> {
    const radius = Math.hypot(4.6, 3.2, -6.2)
    await this.editor.setViewportCamera({
      mode: 'orbit',
      position: { x: 4.6, y: 3.2, z: -6.2 },
      target: { x: 0, y: 0, z: 0 },
      alpha: Math.atan2(-6.2, 4.6),
      beta: Math.acos(3.2 / radius),
      radius,
      fov: 0.76,
      speed: 0.85
    })
    this.frame()
  }

  async startPreview(): Promise<void> {
    if (!this.editor.previewing) await this.editor.startPreview()
  }

  stopPreview(): void {
    if (this.editor.previewing) this.editor.stopPreview()
  }

  setVisible(visible: boolean): void {
    if (!this.#editor) return
    if (visible) {
      this.editor.runtime.resume()
      this.#refreshViewport()
    }
    else {
      this.editor.stopPreview()
      this.editor.runtime.pause()
    }
  }

  exportJson(): string {
    return this.editor.exportJson({ mode: 'single', space: 2 })
  }

  getDocument(): SceneDocumentData {
    return this.editor.getConfig()
  }

  getStageSettings(): StageSettings {
    // Capture authored settings, not preview animation frames or model resources.
    const document = this.editor.getConfig()
    return readStageSettings({ ...document, driftDensity: captureDriftDensity(document) }).settings
  }

  dispose(): void {
    if (this.#resizeRequest !== null) cancelAnimationFrame(this.#resizeRequest)
    this.#resizeRequest = null
    this.#editor?.dispose()
    this.#editor = null
    this.#primaryModel = null
  }

  #refreshViewport(): void {
    if (!this.#editor) return
    this.editor.runtime.resize()
    if (this.#resizeRequest !== null) cancelAnimationFrame(this.#resizeRequest)
    this.#resizeRequest = requestAnimationFrame(() => {
      this.#resizeRequest = null
      this.#editor?.runtime.resize()
    })
  }
}

function compareModelFiles(left: FileWithRelativePath, right: FileWithRelativePath): number {
  const leftPath = left.webkitRelativePath || left.name
  const rightPath = right.webkitRelativePath || right.name
  const depthDifference = leftPath.split('/').length - rightPath.split('/').length
  if (depthDifference !== 0) return depthDifference
  const formatDifference = Number(left.name.toLowerCase().endsWith('.gltf')) -
    Number(right.name.toLowerCase().endsWith('.gltf'))
  if (formatDifference !== 0) return formatDifference
  return leftPath.localeCompare(rightPath, 'zh-CN')
}

function commonSelectedDirectory(files: readonly File[]): string | null {
  const paths = files.map((file) => (file as FileWithRelativePath).webkitRelativePath || '')
  const firstDirectory = paths[0]?.split('/')[0]
  if (!firstDirectory || paths.some((path) => !path.startsWith(`${firstDirectory}/`))) return null
  return firstDirectory
}

function modelRelativePath(file: File, selectedDirectory: string | null): string {
  const path = (file as FileWithRelativePath).webkitRelativePath || file.name
  return selectedDirectory && path.startsWith(`${selectedDirectory}/`)
    ? path.slice(selectedDirectory.length + 1)
    : path
}
