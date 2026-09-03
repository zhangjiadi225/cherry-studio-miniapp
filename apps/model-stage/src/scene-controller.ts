import {
  MemoryWorkspaceSource,
  SkenoraEditor,
  parseSceneJson,
  type SceneDocumentData,
  type ScenePlanApplyResult,
  type ScenePlanValidationResult,
  type SceneRevisionToken
} from '@skenora/sdk/editor'

export interface ImportedModelInfo {
  entityId: string
  assetId: string
  name: string
  size: number
  lastModified: number
  materialSlots: readonly unknown[]
  rebindRequired: boolean
}

export interface RestorableModelInfo {
  entityId?: string
  assetId?: string
  name: string
  size: number
  lastModified: number
}

export interface SceneInitializationResult {
  restored: boolean
  rebindRequired: boolean
  warning: string | null
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
  #modelNeedsRebind = false
  #resizeRequest: number | null = null

  get editor(): SkenoraEditor {
    if (!this.#editor) throw new Error('Skenora scene is not ready')
    return this.#editor
  }

  get primaryModel(): ImportedModelInfo | null {
    return this.#primaryModel ? { ...this.#primaryModel } : null
  }

  get subjectEntityId(): string | null {
    return this.#primaryModel?.entityId ?? null
  }

  get subjectName(): string {
    return this.#primaryModel?.name ?? '未导入模型'
  }

  get hasSubject(): boolean {
    return this.subjectEntityId !== null && !this.#modelNeedsRebind
  }

  get needsModelRebind(): boolean {
    return this.#modelNeedsRebind
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
    savedSceneJson = '',
    savedModel: RestorableModelInfo | null = null
  ): Promise<SceneInitializationResult> {
    let restoredDocument: SceneDocumentData | undefined
    let warning: string | null = null
    if (savedSceneJson) {
      try {
        restoredDocument = parseSceneJson(savedSceneJson)
      } catch {
        warning = '保存的场景数据无效，已打开新的空工作区'
      }
    }

    this.#editor = await SkenoraEditor.create({
      canvas,
      source: new MemoryWorkspaceSource(),
      ...(restoredDocument ? { document: restoredDocument } : {}),
      id: 'model-stage-scene',
      name: '模型布景',
      // A restored local model may no longer have browser File objects. Keep the
      // authored document available and require an explicit file rebind instead
      // of rejecting the entire scene during startup.
      bridge: { modelLoadPolicy: 'best-effort' },
      runtime: {
        qualityPolicy: {
          maxPixelRatio: 2,
          maxShadowMapSize: 2048,
          maxSamples: 4
        }
      }
    })

    if (!restoredDocument) await this.#configureWorkspace()
    else this.#restorePrimaryModel(savedModel)
    await this.editor.showGrid(true)
    this.#refreshViewport()
    return {
      restored: restoredDocument !== undefined,
      rebindRequired: this.#modelNeedsRebind,
      warning
    }
  }

  async #configureWorkspace(): Promise<void> {
    await this.editor.setSky({
      mode: 'color',
      color: '#000000',
      backgroundAssetId: null,
      environmentAssetId: null,
      intensity: 0,
      rotationY: 0,
      blur: 0
    })
    await this.editor.setGround({ enabled: false })
    await this.editor.setFog({ enabled: false })
    await this.editor.setWeather({ enabled: false })
    await this.editor.setLights([
      {
        id: 'workspace-fill',
        type: 'hemispheric',
        enabled: true,
        intensity: 0.72,
        color: { r: 0.95, g: 0.96, b: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      },
      {
        id: 'workspace-key',
        type: 'directional',
        enabled: true,
        intensity: 1.45,
        color: { r: 1, g: 0.91, b: 0.82 },
        rotation: { x: 0.8, y: -0.55, z: 0.18 },
        shadows: {
          enabled: true,
          bias: 0.0008,
          normalBias: 0.02,
          mapSize: 1024,
          darkness: 0.28,
          filtering: 'pcf'
        }
      },
      {
        id: 'workspace-rim',
        type: 'directional',
        enabled: true,
        intensity: 0.62,
        color: { r: 0.74, g: 0.83, b: 1 },
        rotation: { x: -0.45, y: 2.25, z: 0 }
      }
    ])
    await this.editor.setPostProcess({
      enabled: true,
      antialiasing: 'samples',
      samples: 4,
      imageProcessing: true,
      dithering: true,
      exposure: 1,
      contrast: 1.04,
      toneMappingEnabled: true,
      toneMappingType: 'aces',
      bloom: false,
      glow: false,
      depthOfField: false,
      ssao: { enabled: false }
    })
    await this.editor.setViewportCamera({
      mode: 'orbit',
      position: { x: 4.6, y: 3.2, z: -6.2 },
      target: { x: 0, y: 0, z: 0 },
      fov: 0.76,
      speed: 0.85
    })
  }

  async importModel(files: readonly File[]): Promise<ImportedModelInfo> {
    const primary = files
      .filter((file) => /\.(?:glb|gltf)$/iu.test(file.name))
      .sort(compareModelFiles)[0]
    if (!primary) throw new Error('所选目录中没有找到 .glb 或 .gltf 主模型')

    const selectedDirectory = commonSelectedDirectory(files)
    const sequence = Date.now()
    const entityId = `user-model-${sequence}`
    const assetId = `user-asset-${sequence}`
    const dependencies = files
      .filter((file) => file !== primary)
      .map((file) => ({
        file,
        relativePath: modelRelativePath(file, selectedDirectory)
      }))

    const previous = this.#primaryModel
    const previousEntity = previous
      ? this.editor.getConfig().entities[previous.entityId]
      : undefined
    const rebindExisting = previous !== null && this.#modelNeedsRebind
    const previousAsset = previous
      ? this.editor.getConfig().assets[previous.assetId]
      : undefined
    const result = await this.editor.importModel({
      file: primary,
      dependencies,
      relativePath: modelRelativePath(primary, selectedDirectory),
      name: primary.name.replace(/\.(?:glb|gltf)$/iu, ''),
      assetId,
      entityId,
      targetDirectory: `.skenora/imports/${entityId}`,
      conflict: 'error',
      transform: previousEntity?.transform ?? {
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
      if (rebindExisting && previous) {
        await this.editor.upsertAsset({ ...result.asset, id: previous.assetId })
        const reboundFailure = this.editor.modelFailures.find(
          (failure) => failure.entityId === previous.entityId
        )
        if (reboundFailure) throw reboundFailure.error
        await this.editor.removeModel(result.entity.id, { removeAsset: true })
      } else if (previous) {
        await this.editor.removeModel(previous.entityId, { removeAsset: true })
      }
    } catch (error) {
      if (rebindExisting && previousAsset) {
        try {
          await this.editor.upsertAsset(previousAsset)
        } catch {
          // Keep reporting the rebind failure; the restored document was already stale.
        }
      }
      try {
        await this.editor.removeModel(result.entity.id, { removeAsset: true })
      } catch {
        // Preserve the original replacement error; cleanup is best effort.
      }
      throw error
    }

    let materialSlots: readonly unknown[] = []
    const boundEntityId = rebindExisting && previous ? previous.entityId : result.entity.id
    const boundAssetId = rebindExisting && previous ? previous.assetId : result.asset.id
    try {
      materialSlots = this.editor.runtime.describeMaterialSlots(boundEntityId)
    } catch {
      materialSlots = []
    }

    this.#primaryModel = {
      entityId: boundEntityId,
      assetId: boundAssetId,
      name: primary.name,
      size: primary.size,
      lastModified: primary.lastModified,
      materialSlots,
      rebindRequired: false
    }
    this.#modelNeedsRebind = false
    this.editor.frame([boundEntityId])
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
      primaryModelId: this.#primaryModel?.entityId ?? null,
      protectedModelEntityIds: Object.values(document.entities)
        .filter((entity) => entity.type === 'model')
        .map((entity) => entity.id),
      capabilities,
      unavailableCapabilities: unavailableCapabilityDetails,
      model: this.#primaryModel ? { ...this.#primaryModel } : null,
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
        postProcess: document.postProcess
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

  dispose(): void {
    if (this.#resizeRequest !== null) cancelAnimationFrame(this.#resizeRequest)
    this.#resizeRequest = null
    this.#editor?.dispose()
    this.#editor = null
    this.#primaryModel = null
    this.#modelNeedsRebind = false
  }

  #restorePrimaryModel(savedModel: RestorableModelInfo | null): void {
    const document = this.editor.getConfig()
    const savedEntity = savedModel?.entityId
      ? document.entities[savedModel.entityId]
      : undefined
    const modelEntity =
      (savedEntity?.type === 'model' ? savedEntity : undefined) ??
      (savedModel?.assetId
        ? Object.values(document.entities).find(
            (entity) => entity.type === 'model' && entity.assetId === savedModel.assetId
          )
        : undefined) ??
      Object.values(document.entities).find((entity) => entity.type === 'model')
    if (!modelEntity || modelEntity.type !== 'model' || !modelEntity.assetId) return
    const asset = document.assets[modelEntity.assetId]
    this.#primaryModel = {
      entityId: modelEntity.id,
      assetId: modelEntity.assetId,
      name: savedModel?.name ?? modelEntity.name,
      size: savedModel?.size ?? 0,
      lastModified: savedModel?.lastModified ?? 0,
      materialSlots: [],
      rebindRequired: true
    }
    this.#modelNeedsRebind =
      this.editor.modelFailures.some((failure) => failure.entityId === modelEntity.id) ||
      asset === undefined
    this.#primaryModel.rebindRequired = this.#modelNeedsRebind
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
