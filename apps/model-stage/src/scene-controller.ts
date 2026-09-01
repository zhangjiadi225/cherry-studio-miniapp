import {
  MemoryWorkspaceSource,
  SkenoraEditor,
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
}

export interface SceneAiContext {
  sceneId: string
  sceneName: string
  revisionToken: SceneRevisionToken
  subjectEntityId: string | null
  subjectName: string
  primaryModelId: string | null
  capabilities: readonly unknown[]
  capabilityAvailability: readonly unknown[]
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
    return this.#primaryModel ? { ...this.#primaryModel } : null
  }

  get subjectEntityId(): string | null {
    return this.#primaryModel?.entityId ?? null
  }

  get subjectName(): string {
    return this.#primaryModel?.name ?? '未导入模型'
  }

  get hasSubject(): boolean {
    return this.subjectEntityId !== null
  }

  get canUndo(): boolean {
    return this.#editor?.canUndo ?? false
  }

  get canRedo(): boolean {
    return this.#editor?.canRedo ?? false
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.#editor = await SkenoraEditor.create({
      canvas,
      source: new MemoryWorkspaceSource(),
      id: 'model-stage-scene',
      name: '模型布景',
      bridge: { modelLoadPolicy: 'strict' },
      runtime: {
        qualityPolicy: {
          maxPixelRatio: 2,
          maxShadowMapSize: 2048,
          maxSamples: 4
        }
      }
    })

    await this.#configureWorkspace()
    await this.editor.showGrid(true)
    this.#refreshViewport()
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
    const inspection = this.editor.scenePlan.inspectScene()
    const document = this.editor.getConfig()
    const safeAssets = Object.fromEntries(
      Object.values(document.assets).map((asset) => [
        asset.id,
        {
          id: asset.id,
          kind: asset.kind,
          label: asset.label,
          mediaType: asset.mediaType
        }
      ])
    )

    return {
      sceneId: inspection.sceneId,
      sceneName: inspection.sceneName,
      revisionToken: inspection.revisionToken,
      subjectEntityId: this.subjectEntityId,
      subjectName: this.subjectName,
      primaryModelId: this.#primaryModel?.entityId ?? null,
      capabilities: inspection.capabilities,
      capabilityAvailability: inspection.capabilityAvailability ?? [],
      model: this.#primaryModel ? { ...this.#primaryModel } : null,
      document: {
        assets: safeAssets,
        entities: document.entities,
        rootEntityIds: document.rootEntityIds,
        materials: document.materials,
        materialBindings: document.materialBindings,
        textureAnimations: document.textureAnimations,
        camera: document.camera,
        cameraPaths: document.cameraPaths,
        environment: document.environment,
        ground: document.ground,
        fog: document.fog,
        weather: document.weather,
        lights: document.lights,
        postProcess: document.postProcess,
        flows: document.flows,
        variables: document.variables
      }
    }
  }

  validatePlan(plan: unknown): ScenePlanValidationResult {
    return this.editor.scenePlan.validatePlan(plan)
  }

  applyPlan(
    plan: string,
    revisionToken: SceneRevisionToken,
    signal: AbortSignal
  ): Promise<ScenePlanApplyResult> {
    return this.editor.scenePlan.applyPlan(plan, {
      expectedRevisionToken: revisionToken,
      idempotencyKey: crypto.randomUUID(),
      label: 'Cherry AI 场景调整',
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
    if (this.subjectEntityId) this.editor.frame([this.subjectEntityId])
  }

  frameEntity(entityId: string): void {
    if (this.editor.getConfig().entities[entityId]) this.editor.frame([entityId])
  }

  async resetView(): Promise<void> {
    await this.editor.setViewportCamera({
      mode: 'orbit',
      position: { x: 4.6, y: 3.2, z: -6.2 },
      target: { x: 0, y: 0, z: 0 },
      fov: 0.76,
      speed: 0.85
    })
    this.frame()
  }

  async startPreview(): Promise<void> {
    if (!this.editor.previewing) await this.editor.startPreview()
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
