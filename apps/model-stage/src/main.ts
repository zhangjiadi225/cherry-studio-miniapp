import {
  getCherry,
  getRuntimeSnapshot,
  isCherryError,
  onAppVisibility,
  type CherryError,
  type CherryErrorName
} from '@cherry-miniapp/kit'
import { installCherryDevMock } from '@cherry-miniapp/kit/dev-mock'
import type { EntityRecord, SceneDocumentData } from '@skenora/sdk/editor'
import {
  AiPlanner,
  AiPlannerError,
  type AiApplyResult,
  type AiPlanProposal,
  type ConversationEntry,
  type PlanRiskLevel
} from './ai-planner'
import { createDevelopmentScenePatch } from './dev-mock'
import { SceneController } from './scene-controller'
import {
  BACKGROUND_CHOICES,
  CAMERA_VIEWS,
  EFFECT_PRESETS,
  LocalScenePlanError,
  applyLocalScenePlan,
  createAtmosphereDensityPlan,
  createAtmospherePlan,
  createBackgroundPlan,
  createCameraViewPlan,
  createEffectPresetPlan,
  createLightIntensityPlan,
  type LocalScenePlan
} from './scene-recipes'
import { ATMOSPHERE_PRESETS, getAtmosphereState } from './scene-particles'
import {
  emptyState,
  loadState,
  persistState,
  type AppliedPlanRecord,
  type InspectorTabId,
  type ModelStageState
} from './state'
import './style.css'

if (import.meta.env.DEV) {
  installCherryDevMock({
    appId: 'dev.cherrymini.model-stage',
    version: '0.6.0',
    permissions: {
      'ai.chat': true,
      'storage.get': true,
      'storage.set': true,
      'storage.delete': true,
      'storage.keys': true,
      'file.save': true,
      'file.export': true
    },
    aiResponder: createDevelopmentScenePatch,
    chunkDelayMs: 4
  })
}

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector)
  if (!value) throw new Error(`Missing element: ${selector}`)
  return value
}

const canvas = element<HTMLCanvasElement>('#scene-canvas')
const sceneStatus = element<HTMLElement>('#scene-status')
const modelLabel = element<HTMLElement>('#model-label')
const importButton = element<HTMLButtonElement>('#import-button')
const modelInput = element<HTMLInputElement>('#model-input')
const composer = element<HTMLFormElement>('#composer')
const promptInput = element<HTMLTextAreaElement>('#prompt-input')
const applyButton = element<HTMLButtonElement>('#apply-button')
const cancelButton = element<HTMLButtonElement>('#cancel-button')
const aiStatus = element<HTMLElement>('#ai-status')
const modelCapability = element<HTMLElement>('#model-capability')
const resourceCount = element<HTMLElement>('#resource-count')
const resourceRevision = element<HTMLElement>('#resource-revision')
const resourceList = element<HTMLElement>('#resource-list')
const selectedNodeLabel = element<HTMLElement>('#selected-node-label')
const selectedNodeJson = element<HTMLElement>('#selected-node-json')
const inspectorTablist = element<HTMLElement>('#inspector-tablist')
const inspectorTabs = Array.from(
  inspectorTablist.querySelectorAll<HTMLButtonElement>('[data-inspector-tab]')
)
const inspectorPanels = Array.from(
  document.querySelectorAll<HTMLElement>('[data-inspector-panel]')
)
const conversation = element<HTMLElement>('#conversation')
const changeSummary = element<HTMLElement>('#change-summary')
const jsonButton = element<HTMLButtonElement>('#json-button')
const jsonDialog = element<HTMLDialogElement>('#json-dialog')
const jsonOutput = element<HTMLElement>('#json-output')
const closeDialogButton = element<HTMLButtonElement>('#close-dialog-button')
const undoButton = element<HTMLButtonElement>('#undo-button')
const redoButton = element<HTMLButtonElement>('#redo-button')
const frameButton = element<HTMLButtonElement>('#frame-button')
const resetViewButton = element<HTMLButtonElement>('#reset-view-button')
const previewButton = element<HTMLButtonElement>('#preview-button')
const exportButton = element<HTMLButtonElement>('#export-button')
const planReview = element<HTMLElement>('#plan-review')
const planRisk = element<HTMLElement>('#plan-risk')
const planReviewTitle = element<HTMLElement>('#plan-review-title')
const planReviewSummary = element<HTMLElement>('#plan-review-summary')
const planReviewReasons = element<HTMLUListElement>('#plan-review-reasons')
const confirmPlanButton = element<HTMLButtonElement>('#confirm-plan-button')
const discardPlanButton = element<HTMLButtonElement>('#discard-plan-button')
const toast = element<HTMLElement>('#toast')
const effectsPanel = element<HTMLElement>('#effects-panel')
const effectsGrid = element<HTMLElement>('#effects-grid')
const effectStatus = element<HTMLElement>('#effect-status')
const effectsGuard = element<HTMLElement>('#effects-guard')
const effectJsonButton = element<HTMLButtonElement>('#effect-json-button')
const cameraShortcuts = element<HTMLElement>('#camera-shortcuts')
const backgroundChoices = element<HTMLElement>('#background-choices')
const atmosphereChoices = element<HTMLElement>('#atmosphere-choices')
const atmosphereDensity = element<HTMLInputElement>('#atmosphere-density')
const atmosphereDensityOutput = element<HTMLOutputElement>('#atmosphere-density-output')
const atmosphereStatus = element<HTMLElement>('#atmosphere-status')
const atmosphereResetButton = element<HTMLButtonElement>('#atmosphere-reset')
const lightInputs = Array.from(
  effectsPanel.querySelectorAll<HTMLInputElement>('[data-light-id]')
)

const scene = new SceneController()
const planner = new AiPlanner(scene)
let state: ModelStageState = structuredClone(emptyState)
let sessionConversation: ConversationEntry[] = []
let stateSaveTimer: number | null = null
let stateSaveQueue: Promise<void> = Promise.resolve()
let statePersistenceAvailable = false
let aiAvailable = false
let sceneReady = false
let activeController: AbortController | null = null
let sceneOperationBusy = false
let pendingProposal: AiPlanProposal | null = null
let toastTimer: number | null = null
let selectedTreeNodeId = 'scene-sky'
const expandedTreeNodes = new Set(['scene-root', 'scene-objects', 'scene-lights'])
const sceneTreeNodes = new Map<string, SceneTreeNode>()
const cherryErrorNames = new Set<CherryErrorName>([
  'PermissionDenied',
  'QuotaExceeded',
  'RateLimited',
  'Unavailable',
  'InvalidArgument',
  'Cancelled',
  'Internal'
])

function isKnownCherryError(error: unknown): error is CherryError {
  return isCherryError(error) && cherryErrorNames.has(error.name)
}

function updateControls(): void {
  const busy = isSceneBusy()
  const awaitingReview = pendingProposal !== null
  applyButton.disabled =
    !sceneReady || !aiAvailable || busy || awaitingReview || !promptInput.value.trim()
  promptInput.disabled = !sceneReady || !aiAvailable || busy || awaitingReview
  importButton.disabled = !sceneReady || busy || awaitingReview
  undoButton.disabled = !sceneReady || busy || awaitingReview || !scene.canUndo
  redoButton.disabled = !sceneReady || busy || awaitingReview || !scene.canRedo
  frameButton.disabled = !sceneReady || busy || awaitingReview || !scene.hasSubject
  resetViewButton.disabled = !sceneReady || busy || awaitingReview
  previewButton.disabled = !sceneReady || busy || awaitingReview
  exportButton.disabled = !sceneReady || busy || awaitingReview
  confirmPlanButton.disabled = busy || !awaitingReview
  discardPlanButton.disabled = busy || !awaitingReview
  cancelButton.hidden = activeController === null
  for (const button of effectsPanel.querySelectorAll<HTMLButtonElement>('[data-local-action]')) {
    button.disabled = !sceneReady || busy || awaitingReview
  }
  for (const input of lightInputs) {
    input.disabled = !sceneReady || busy || awaitingReview || input.dataset.available !== 'true'
  }
  const atmosphere = sceneReady ? getAtmosphereState(scene.getDocument()) : null
  const adjustable = atmosphere && atmosphere.presetId !== 'none' && atmosphere.presetId !== 'custom'
  atmosphereDensity.disabled = !adjustable || busy || awaitingReview || (atmosphere?.density ?? 0) > 2
  atmosphereResetButton.disabled = !adjustable || busy || awaitingReview
  effectsPanel.setAttribute('aria-busy', String(busy))
  effectsGuard.hidden = !busy && !awaitingReview
  effectsGuard.textContent = awaitingReview
    ? '有 AI 修改待确认，请到「对话」应用或取消。'
    : busy
      ? '正在执行场景操作，请稍候。'
      : ''
  effectJsonButton.disabled = !state.lastLocalOperation
  updatePreviewControl()
}

function isSceneBusy(): boolean {
  return activeController !== null || sceneOperationBusy
}

function setEffectStatus(
  message: string,
  kind: 'ready' | 'busy' | 'warning' | 'error' = 'ready'
): void {
  effectStatus.textContent = message
  effectStatus.dataset.kind = kind
}

function renderEffectCatalog(): void {
  effectsGrid.replaceChildren()
  for (const preset of EFFECT_PRESETS) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'effect-card'
    card.dataset.presetId = preset.id
    card.dataset.localAction = 'preset'
    card.setAttribute('aria-pressed', 'false')
    card.setAttribute('aria-label', `应用${preset.name}：${preset.description}`)
    const preview = document.createElement('span')
    preview.className = 'effect-preview'
    preview.setAttribute('aria-hidden', 'true')
    preview.dataset.transparent = String(preset.preview.background === 'transparent')
    for (const [key, value] of Object.entries(preset.preview)) {
      preview.style.setProperty(`--preview-${key}`, value)
    }
    const copy = document.createElement('span')
    copy.className = 'effect-card-copy'
    const title = document.createElement('span')
    title.className = 'effect-card-title'
    title.append(document.createTextNode(preset.name))
    const badge = document.createElement('span')
    badge.className = 'effect-card-badge'
    badge.textContent = preset.badge
    badge.setAttribute('aria-hidden', 'true')
    title.append(badge)
    const description = document.createElement('span')
    description.className = 'effect-card-description'
    description.textContent = preset.description
    copy.append(title, description)
    card.append(preview, copy)
    card.addEventListener('click', () => {
      void applyLocalChange(({ document: current, revisionToken }) =>
        createEffectPresetPlan(preset.id, current, revisionToken)
      )
    })
    effectsGrid.append(card)
  }

  cameraShortcuts.replaceChildren()
  for (const view of CAMERA_VIEWS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'secondary-button'
    button.dataset.localAction = 'camera'
    button.textContent = view.shortLabel
    button.title = view.label
    button.setAttribute('aria-label', view.label)
    button.addEventListener('click', () => {
      void applyLocalChange(({ document: current, revisionToken }) =>
        createCameraViewPlan(view.id, current, revisionToken)
      )
    })
    cameraShortcuts.append(button)
  }

  backgroundChoices.replaceChildren()
  for (const choice of BACKGROUND_CHOICES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'background-swatch'
    button.dataset.localAction = 'background'
    button.dataset.backgroundId = choice.id
    button.dataset.transparent = String(choice.mode === 'transparent')
    button.style.setProperty('--swatch-color', choice.color)
    button.title = choice.label
    button.setAttribute('aria-label', `${choice.label}背景`)
    button.setAttribute('aria-pressed', 'false')
    button.addEventListener('click', () => {
      void applyLocalChange(({ revisionToken }) => createBackgroundPlan(choice.id, revisionToken))
    })
    backgroundChoices.append(button)
  }
  atmosphereChoices.replaceChildren()
  for (const choice of ATMOSPHERE_PRESETS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'secondary-button'
    button.dataset.localAction = 'atmosphere'
    button.dataset.atmosphereId = choice.id
    button.textContent = choice.label
    button.setAttribute('aria-pressed', 'false')
    button.addEventListener('click', () => {
      void applyLocalChange(({ document: current, revisionToken }) =>
        createAtmospherePlan(choice.id, current, revisionToken)
      )
    })
    atmosphereChoices.append(button)
  }
  updateControls()
}

function renderEffectControls(): void {
  for (const card of effectsGrid.querySelectorAll<HTMLButtonElement>('[data-preset-id]')) {
    const preset = EFFECT_PRESETS.find((item) => item.id === card.dataset.presetId)
    const selected = preset?.id === state.activeRecipeId
    card.setAttribute('aria-pressed', String(selected))
    const badge = card.querySelector<HTMLElement>('.effect-card-badge')
    if (badge) badge.textContent = selected ? '已选' : (preset?.badge ?? '')
  }
  if (!sceneReady) return
  const current = scene.getDocument()
  const atmosphere = getAtmosphereState(current)
  for (const button of atmosphereChoices.querySelectorAll<HTMLButtonElement>('[data-atmosphere-id]')) {
    button.setAttribute('aria-pressed', String(button.dataset.atmosphereId === atmosphere.presetId))
  }
  atmosphereDensity.value = String(Math.min(2, Math.max(0, atmosphere.density)))
  atmosphereDensityOutput.textContent = atmosphere.presetId === 'none' || atmosphere.presetId === 'custom'
    ? '—'
    : `${atmosphere.density.toFixed(2)}×`
  for (const swatch of backgroundChoices.querySelectorAll<HTMLButtonElement>('[data-background-id]')) {
    const choice = BACKGROUND_CHOICES.find((item) => item.id === swatch.dataset.backgroundId)
    const background = current.environment.background
    const selected = choice !== undefined && choice.mode === background.mode &&
      (choice.mode === 'transparent' || choice.color.toLowerCase() === background.color.toLowerCase())
    swatch.setAttribute('aria-pressed', String(selected))
  }
  for (const input of lightInputs) {
    const light = current.lights.find((item) => item.id === input.dataset.lightId)
    input.dataset.available = String(light !== undefined && light.enabled)
    input.max = String(Math.max(2.5, light?.intensity ?? 0))
    input.step = '0.01'
    input.value = String(light?.intensity ?? 0)
    const output = input.parentElement?.querySelector('output')
    if (output) {
      output.textContent = !light
        ? '缺失'
        : !light.enabled
          ? '已关闭'
          : light.intensity.toFixed(2)
    }
  }
  canvas.parentElement?.classList.toggle(
    'transparent-viewport', current.environment.background.mode === 'transparent'
  )
  updateControls()
}

async function applyLocalChange(
  createPlan: (snapshot: ReturnType<SceneController['getPlanningSnapshot']>) => LocalScenePlan
): Promise<void> {
  if (!sceneReady || isSceneBusy() || pendingProposal) return
  const controller = new AbortController()
  activeController = controller
  scene.stopPreview()
  updateControls()
  try {
    const localPlan = createPlan(scene.getPlanningSnapshot())
    setEffectStatus(`正在应用${localPlan.label}…`, 'busy')
    setRenderStatus('busy', '本地布景中…')
    const applied = await applyLocalScenePlan(scene, localPlan, controller.signal)
    state.activeRecipeId =
      localPlan.kind === 'preset'
        ? (EFFECT_PRESETS.find((preset) => preset.id === localPlan.id)?.id ?? null)
        : null
    state.lastLocalOperation = {
      ...applied,
      id: localPlan.id,
      label: localPlan.label,
      kind: localPlan.kind,
      at: Date.now(),
      modelFailureEntityIds: [...applied.modelFailureEntityIds],
      changes: {
        created: [...applied.changes.created],
        updated: [...applied.changes.updated],
        removed: [...applied.changes.removed]
      }
    }
    setEffectStatus(
      applied.projectionWarning
        ? `${localPlan.label}：${applied.projectionWarning}`
        : `已应用${localPlan.label} · 可撤销`,
      applied.projectionWarning ? 'warning' : 'ready'
    )
    // The document has committed. A framing/panel failure must not be reported
    // as an unapplied plan or cause a retry of the transaction.
    try {
      if (localPlan.kind === 'preset' || localPlan.kind === 'camera') scene.frame()
      renderSceneResources()
      renderEffectControls()
    } catch {
      showToast('修改已提交，但取景或面板刷新失败；可点击取景或撤销')
    }
    await saveCurrentState()
    if (applied.projectionWarning) showToast(applied.projectionWarning)
  } catch (error) {
    const message = describeError(error)
    setEffectStatus(message, 'error')
    showToast(message)
  } finally {
    activeController = null
    setRenderStatus('ready', currentSceneLabel())
    // Restore sliders to document truth after rejected or cancelled changes.
    try {
      renderEffectControls()
    } catch {
      showToast('场景面板刷新失败，请重新打开小程序恢复已保存的场景')
    }
    updateControls()
  }
}

for (const input of lightInputs) {
  input.addEventListener('input', () => {
    const output = input.parentElement?.querySelector('output')
    if (output) output.textContent = Number(input.value).toFixed(2)
  })
  input.addEventListener('change', () => {
    const lightId = input.dataset.lightId
    const intensity = Number(input.value)
    if (!lightId) return
    void applyLocalChange(({ document: current, revisionToken }) =>
      createLightIntensityPlan(lightId, intensity, current, revisionToken)
    )
  })
}

atmosphereDensity.addEventListener('input', () => {
  atmosphereDensityOutput.textContent = `${Number(atmosphereDensity.value).toFixed(2)}×`
})
atmosphereDensity.addEventListener('change', () => {
  const density = Number(atmosphereDensity.value)
  void applyLocalChange(({ document: current, revisionToken }) =>
    createAtmosphereDensityPlan(density, current, revisionToken)
  )
})
atmosphereResetButton.addEventListener('click', () => {
  if (!sceneReady) return
  const { presetId } = getAtmosphereState(scene.getDocument())
  if (presetId === 'none' || presetId === 'custom') return
  void applyLocalChange(({ document: current, revisionToken }) =>
    createAtmospherePlan(presetId, current, revisionToken)
  )
})

effectJsonButton.addEventListener('click', () => {
  if (!state.lastLocalOperation) return
  jsonOutput.textContent = state.lastLocalOperation.planJson
  jsonDialog.showModal()
})

function updatePreviewControl(): void {
  const previewing = sceneReady && scene.previewing
  previewButton.dataset.active = String(previewing)
  previewButton.textContent = previewing ? '停止预览' : '预览'
  previewButton.setAttribute('aria-pressed', String(previewing))
  if (sceneReady) {
    const atmosphere = getAtmosphereState(scene.getDocument())
    atmosphereStatus.textContent = atmosphere.presetId === 'none'
      ? '未启用环境氛围'
      : atmosphere.presetId === 'custom'
        ? '自定义或组合效果 · 可重新选择内置氛围；自定义粒子不跨会话保存'
        : atmosphere.presetId === 'drift-v1'
          ? previewing ? '漂浮光点 · 预览中' : '漂浮光点已配置 · 点击视口「预览」播放'
          : atmosphere.density > 2
            ? '当前密度超出本地调节范围 · 可恢复默认'
            : '雨雪为即时环境效果 · 点击「关闭」结束，停止预览不会关闭雨雪'
  }
}

function setRenderStatus(kind: 'ready' | 'busy' | 'error', label: string): void {
  sceneStatus.dataset.kind = kind
  modelLabel.textContent = label
}

function currentSceneLabel(): string {
  return scene.subjectName
}

function setAiStatus(value: string): void {
  aiStatus.textContent = value
}

function showToast(message: string): void {
  toast.textContent = message
  toast.hidden = false
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.hidden = true
    toastTimer = null
  }, 3600)
}

interface SceneTreeNode {
  id: string
  label: string
  detail: string
  icon: string
  entityId: string | null
  data: unknown
  children: SceneTreeNode[]
}

function renderSceneResources(): void {
  if (!sceneReady) {
    resourceCount.textContent = '0 节点'
    resourceRevision.textContent = '场景未就绪'
    resourceList.replaceChildren(createResourceEmpty('场景就绪后会显示资源'))
    selectedNodeLabel.textContent = '等待选择节点'
    selectedNodeJson.textContent = '场景就绪后显示节点数据'
    return
  }

  const sceneDocument = scene.getDocument()
  const entityNodes = buildEntityTree(sceneDocument)
  const cameraPaths = Object.values(sceneDocument.cameraPaths).map<SceneTreeNode>((path) => ({
    id: `camera-path:${path.id}`,
    label: path.name || path.id,
    detail: `${path.keyframes.length} 帧`,
    icon: '径',
    entityId: null,
    data: path,
    children: []
  }))
  const sceneRoot: SceneTreeNode = {
    id: 'scene-root',
    label: sceneDocument.name,
    detail: '场景',
    icon: '景',
    entityId: null,
    data: sceneDocument,
    children: [
      {
        id: 'scene-sky',
        label: '天空',
        detail: describeSky(sceneDocument),
        icon: '天',
        entityId: null,
        data: sceneDocument.environment,
        children: []
      },
      ...(sceneDocument.ground.enabled
        ? [
            {
              id: 'scene-ground',
              label: '地面',
              detail: describeGround(sceneDocument),
              icon: '地',
              entityId: null,
              data: sceneDocument.ground,
              children: []
            } satisfies SceneTreeNode
          ]
        : []),
      {
        id: 'scene-objects',
        label: '模型与对象',
        detail: `${Object.keys(sceneDocument.entities).length} 个对象`,
        icon: '物',
        entityId: null,
        data: {
          rootEntityIds: sceneDocument.rootEntityIds,
          entities: sceneDocument.entities
        },
        children: entityNodes
      },
      {
        id: 'scene-lights',
        label: '灯光',
        detail: `${sceneDocument.lights.length} 盏`,
        icon: '光',
        entityId: null,
        data: sceneDocument.lights,
        children: sceneDocument.lights.map((light) => ({
          id: `light:${light.id}`,
          label: describeLightName(light.id),
          detail: `${describeLightType(light.type)} · ${light.enabled ? '已启用' : '已关闭'}`,
          icon: '光',
          entityId: null,
          data: light,
          children: []
        }))
      },
      {
        id: 'scene-camera',
        label: '主镜头',
        detail: sceneDocument.camera.mode === 'orbit' ? '轨道镜头' : '自由镜头',
        icon: '镜',
        entityId: null,
        data: {
          camera: sceneDocument.camera,
          cameraPaths: sceneDocument.cameraPaths
        },
        children: cameraPaths
      },
      ...(sceneDocument.fog.enabled
        ? [
            {
              id: 'scene-fog',
              label: '雾效',
              detail: sceneDocument.fog.mode.toUpperCase(),
              icon: '雾',
              entityId: null,
              data: sceneDocument.fog,
              children: []
            } satisfies SceneTreeNode
          ]
        : []),
      ...(sceneDocument.weather.enabled
        ? [
            {
              id: 'scene-weather',
              label: '天气',
              detail: sceneDocument.weather.type === 'rain' ? '雨' : '雪',
              icon: '候',
              entityId: null,
              data: sceneDocument.weather,
              children: []
            } satisfies SceneTreeNode
          ]
        : []),
      ...(sceneDocument.postProcess.enabled
        ? [
            {
              id: 'scene-post-process',
              label: '后期处理',
              detail: '已启用',
              icon: '效',
              entityId: null,
              data: sceneDocument.postProcess,
              children: []
            } satisfies SceneTreeNode
          ]
        : [])
    ]
  }

  const total = countTreeNodes(sceneRoot) - 1
  resourceCount.textContent = `${total} 节点`
  resourceRevision.textContent = `${Object.keys(sceneDocument.entities).length} 个对象 · ${sceneDocument.lights.length} 盏灯`

  sceneTreeNodes.clear()
  indexSceneTree(sceneRoot)
  if (!sceneTreeNodes.has(selectedTreeNodeId)) selectedTreeNodeId = 'scene-root'

  const tree = document.createElement('ul')
  tree.className = 'scene-tree'
  tree.setAttribute('role', 'tree')
  tree.setAttribute('aria-label', '当前场景层级')
  tree.append(renderTreeNode(sceneRoot))
  resourceList.replaceChildren(tree)
  renderSelectedNodeJson()
}

function buildEntityTree(sceneDocument: SceneDocumentData): SceneTreeNode[] {
  const entities = Object.values(sceneDocument.entities)
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))
  const childrenByParent = new Map<string, EntityRecord[]>()
  for (const entity of entities) {
    if (!entity.parentId) continue
    const siblings = childrenByParent.get(entity.parentId) ?? []
    siblings.push(entity)
    childrenByParent.set(entity.parentId, siblings)
  }

  const emitted = new Set<string>()
  const buildNode = (entity: EntityRecord, ancestors: ReadonlySet<string>): SceneTreeNode | null => {
    if (ancestors.has(entity.id) || emitted.has(entity.id)) return null
    emitted.add(entity.id)
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(entity.id)
    const children = (childrenByParent.get(entity.id) ?? [])
      .map((child) => buildNode(child, nextAncestors))
      .filter((child): child is SceneTreeNode => child !== null)
    return {
      id: `entity:${entity.id}`,
      label: entity.name || entity.id,
      detail: `${describeEntityType(entity.type)} · ${describeEntityState(entity)}`,
      icon: describeEntityIcon(entity.type),
      entityId: entity.id,
      data: entity,
      children
    }
  }

  const rootIds = [
    ...sceneDocument.rootEntityIds,
    ...entities
      .filter((entity) => entity.parentId === null || !entityById.has(entity.parentId))
      .map((entity) => entity.id)
  ]
  const roots = [...new Set(rootIds)]
    .map((id) => entityById.get(id))
    .filter((entity): entity is EntityRecord => entity !== undefined)
    .map((entity) => buildNode(entity, new Set<string>()))
    .filter((node): node is SceneTreeNode => node !== null)

  for (const entity of entities) {
    if (emitted.has(entity.id)) continue
    const node = buildNode(entity, new Set<string>())
    if (node) roots.push(node)
  }
  return roots
}

function renderTreeNode(node: SceneTreeNode): HTMLLIElement {
  const item = document.createElement('li')
  item.setAttribute('role', 'treeitem')
  item.setAttribute('aria-selected', String(selectedTreeNodeId === node.id))

  if (node.children.length > 0) {
    const details = document.createElement('details')
    details.open = expandedTreeNodes.has(node.id)
    item.setAttribute('aria-expanded', String(details.open))
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return
      const changed = details.open !== expandedTreeNodes.has(node.id)
      if (details.open) expandedTreeNodes.add(node.id)
      else expandedTreeNodes.delete(node.id)
      item.setAttribute('aria-expanded', String(details.open))
      if (changed) scheduleStateSave()
    })

    const summary = document.createElement('summary')
    summary.className = 'tree-row'
    setTreeRowContent(summary, node, true)
    const children = document.createElement('ul')
    children.className = 'scene-tree-children'
    children.setAttribute('role', 'group')
    for (const child of node.children) children.append(renderTreeNode(child))
    details.append(summary, children)
    item.append(details)
    return item
  }

  const button = document.createElement('button')
  button.className = 'tree-row'
  button.type = 'button'
  setTreeRowContent(button, node, false)
  item.append(button)
  return item
}

function setTreeRowContent(
  row: HTMLElement,
  node: SceneTreeNode,
  expandable: boolean
): void {
  row.dataset.treeNodeId = node.id
  if (node.entityId) row.dataset.entityId = node.entityId

  const caret = document.createElement('span')
  caret.className = `tree-caret${expandable ? '' : ' tree-caret-placeholder'}`
  caret.setAttribute('aria-hidden', 'true')
  const icon = document.createElement('span')
  icon.className = 'tree-icon'
  icon.textContent = node.icon
  icon.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.className = 'tree-label'
  label.textContent = node.label
  const detail = document.createElement('span')
  detail.className = 'tree-detail'
  detail.textContent = node.detail
  row.append(caret, icon, label, detail)
}

function countTreeNodes(node: SceneTreeNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0)
}

function indexSceneTree(node: SceneTreeNode): void {
  sceneTreeNodes.set(node.id, node)
  for (const child of node.children) indexSceneTree(child)
}

function renderSelectedNodeJson(): void {
  const node = sceneTreeNodes.get(selectedTreeNodeId)
  if (!node) {
    selectedNodeLabel.textContent = '等待选择节点'
    selectedNodeJson.textContent = '请选择场景树中的节点'
    return
  }
  selectedNodeLabel.textContent = `${node.label} · ${node.detail}`
  selectedNodeJson.textContent = JSON.stringify(node.data, null, 2) ?? 'null'
}

function createResourceEmpty(message: string): HTMLParagraphElement {
  const empty = document.createElement('p')
  empty.className = 'resource-empty'
  empty.textContent = message
  return empty
}

function describeEntityType(type: string): string {
  return (
    {
      model: '模型',
      mesh: '网格',
      primitive: '几何体',
      procedural: '程序对象',
      particle: '粒子',
      shape: '形状',
      annotation: '标注',
      group: '组',
      camera: '场景相机'
    }[type] ?? type
  )
}

function describeEntityIcon(type: string): string {
  return (
    {
      model: '模',
      mesh: '网',
      primitive: '几',
      procedural: '程',
      particle: '粒',
      shape: '形',
      annotation: '注',
      group: '组',
      camera: '镜'
    }[type] ?? type
  )
}

function describeEntityState(entity: EntityRecord): string {
  if (!entity.enabled) return '已禁用'
  return entity.visible ? '可见' : '已隐藏'
}

function describeLightName(id: string): string {
  return (
    {
      'workspace-fill': '补光',
      'workspace-key': '主光',
      'workspace-rim': '轮廓光'
    }[id] ?? id
  )
}

function describeLightType(type: string): string {
  return (
    {
      directional: '方向光',
      point: '点光源',
      spot: '聚光灯',
      hemispheric: '半球光'
    }[type] ?? type
  )
}

function describeEnvironment(mode: string): string {
  return (
    {
      transparent: '透明背景',
      color: '纯色背景',
      image: '图片背景',
      environment: '环境背景'
    }[mode] ?? mode
  )
}

function describeSky(sceneDocument: SceneDocumentData): string {
  const background = describeEnvironment(sceneDocument.environment.background.mode)
  return sceneDocument.environment.enabled ? background : `${background} · 环境光关闭`
}

function describeGround(sceneDocument: SceneDocumentData): string {
  if (!sceneDocument.ground.enabled) return '未启用'
  return sceneDocument.ground.mode === 'shadow-catcher' ? '阴影承接' : '实体地面'
}

resourceList.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const row = target.closest<HTMLElement>('[data-tree-node-id]')
  if (!row || !resourceList.contains(row)) return

  selectedTreeNodeId = row.dataset.treeNodeId ?? 'scene-root'
  for (const item of resourceList.querySelectorAll<HTMLElement>('[role="treeitem"]')) {
    const itemRow = item.querySelector<HTMLElement>(':scope > .tree-row, :scope > details > .tree-row')
    item.setAttribute('aria-selected', String(itemRow?.dataset.treeNodeId === selectedTreeNodeId))
  }
  renderSelectedNodeJson()

  if (
    row instanceof HTMLButtonElement &&
    row.dataset.entityId &&
    sceneReady &&
    !isSceneBusy() &&
    !pendingProposal
  ) {
    scene.frameEntity(row.dataset.entityId)
  }
  scheduleStateSave()
})

function renderConversation(): void {
  conversation.replaceChildren()
  if (state.conversation.length === 0) {
    appendMessageElement(
      'assistant',
      '你好，我可以回答当前场景的问题，也可以直接调整环境、灯光、镜头和模型。'
    )
    return
  }
  const archivedCount = Math.max(0, state.conversation.length - sessionConversation.length)
  if (archivedCount > 0) appendConversationNote('历史记录 · 仅供查看，不恢复旧模型或执行旧修改')
  for (const [index, entry] of state.conversation.entries()) {
    appendMessageElement(entry.role, entry.text)
    if (index + 1 === archivedCount) {
      appendConversationNote('本次会话 · AI 仅使用当前场景和本次对话')
    }
  }
  conversation.scrollTop = conversation.scrollHeight
}

function appendConversationNote(text: string): void {
  const note = document.createElement('p')
  note.className = 'conversation-history-note'
  note.textContent = text
  conversation.append(note)
}

function appendMessageElement(
  role: 'user' | 'assistant',
  text: string,
  pending = false
): HTMLElement {
  const article = document.createElement('article')
  article.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`
  if (pending) article.classList.add('pending-message')
  article.setAttribute('aria-label', role === 'user' ? '你' : 'AI')
  const author = document.createElement('span')
  author.className = 'message-author'
  author.textContent = role === 'user' ? '你' : 'AI'
  const body = document.createElement('p')
  body.textContent = text
  article.append(author, body)
  conversation.append(article)
  conversation.scrollTop = conversation.scrollHeight
  return article
}

function addConversation(role: 'user' | 'assistant', text: string): void {
  state.conversation.push({ role, text })
  state.conversation = state.conversation.slice(-20)
  sessionConversation.push({ role, text })
  sessionConversation = sessionConversation.slice(-20)
  renderConversation()
}

function showPlanReview(proposal: AiPlanProposal): void {
  pendingProposal = proposal
  const domains = summarizeDomains(proposal.domains.map((domain) => domain.label))
  planRisk.dataset.risk = proposal.risk
  planRisk.textContent = riskLabel(proposal.risk)
  planReviewTitle.textContent = `${domains}修改需要确认`
  planReviewSummary.textContent = proposal.reply
  planReviewReasons.replaceChildren()
  for (const reason of proposal.riskReasons) {
    const item = document.createElement('li')
    item.textContent = reason
    planReviewReasons.append(item)
  }
  planReview.hidden = false
  changeSummary.textContent = `${domains}修改等待确认`
  jsonOutput.textContent = proposal.planJson
  jsonButton.disabled = false
  updateControls()
}

function clearPlanReview(): void {
  pendingProposal = null
  planReview.hidden = true
  planReviewReasons.replaceChildren()
  jsonOutput.textContent = state.lastPlan
  jsonButton.disabled = !state.lastPlan
  updateControls()
}

function riskLabel(risk: PlanRiskLevel): string {
  return risk === 'high' ? '高影响' : risk === 'medium' ? '需确认' : '低风险'
}

function summarizeDomains(labels: readonly string[]): string {
  return [...new Set(labels)].join('、') || '场景'
}

function scheduleStateSave(): void {
  if (!sceneReady || !statePersistenceAvailable) return
  if (stateSaveTimer !== null) window.clearTimeout(stateSaveTimer)
  stateSaveTimer = window.setTimeout(() => {
    void saveCurrentState()
  }, 250)
}

async function saveCurrentState(): Promise<void> {
  // Do not overwrite an existing save while startup is still loading or has failed.
  if (!sceneReady || !statePersistenceAvailable) return
  if (stateSaveTimer !== null) window.clearTimeout(stateSaveTimer)
  stateSaveTimer = null
  try {
    state.stageSettings = scene.getStageSettings()
    state.ui.selectedTreeNodeId = selectedTreeNodeId
    state.ui.expandedTreeNodeIds = [...expandedTreeNodes]
    const snapshot = structuredClone(state)
    // UI and scene saves can overlap. Keep host writes ordered so an older save
    // cannot finish last and replace more recent settings.
    const saving = stateSaveQueue.then(() => persistState(snapshot))
    stateSaveQueue = saving.catch(() => {})
    await saving
  } catch (error) {
    showToast(
      isKnownCherryError(error) ? `状态未保存：${error.name}` : '状态未保存，但仍可继续使用'
    )
  }
}

async function refreshAiAvailability(): Promise<void> {
  try {
    const runtime = await getRuntimeSnapshot('default')
    const permissionGranted = runtime.permissions['ai.chat'] === true
    aiAvailable = permissionGranted && runtime.capabilities.available
    modelCapability.textContent = !permissionGranted
      ? 'AI 未授权'
      : aiAvailable
        ? 'AI 可用'
        : 'AI 未配置'
    modelCapability.classList.toggle('available', aiAvailable)
    setAiStatus(
      !permissionGranted
        ? '请在 Cherry Studio 中授权 AI 对话'
        : aiAvailable
          ? pendingProposal
            ? '请确认 AI 修改提案'
            : '可以提问，也可以直接修改场景'
          : '请先配置默认模型'
    )
  } catch (error) {
    aiAvailable = false
    modelCapability.textContent = 'AI 不可用'
    modelCapability.classList.remove('available')
    setAiStatus(isKnownCherryError(error) ? `连接失败：${error.name}` : '连接失败')
  }
  updateControls()
}

async function importSelectedFiles(files: readonly File[]): Promise<void> {
  if (!sceneReady || isSceneBusy() || pendingProposal || files.length === 0) return
  sceneOperationBusy = true
  scene.stopPreview()
  updatePreviewControl()
  setRenderStatus('busy', '导入中…')
  setAiStatus('正在读取模型…')
  updateControls()
  try {
    const model = await scene.importModel(files)
    sessionConversation = []
    setRenderStatus('ready', model.name)
    setAiStatus(aiAvailable ? '可以继续调整' : '请先配置默认模型')
    changeSummary.textContent = `已导入 ${model.name}`
    addConversation('assistant', `已导入 ${model.name}。模型仅在当前会话保留，布景设置会自动保存。`)
    selectedTreeNodeId = `entity:${model.entityId}`
    renderSceneResources()
    renderEffectControls()
    setEffectStatus('模型已导入 · 沿用当前布景，仅本次会话有效')
    await saveCurrentState()
  } catch (error) {
    setRenderStatus('ready', currentSceneLabel())
    setAiStatus(aiAvailable ? '可以继续调整' : '请先配置默认模型')
    showToast(describeError(error))
  } finally {
    sceneOperationBusy = false
    modelInput.value = ''
    updateControls()
  }
}

async function applyPrompt(command: string): Promise<void> {
  const blockedReason = getPromptBlockedReason()
  if (blockedReason) {
    setAiStatus(blockedReason)
    showToast(blockedReason)
    updateControls()
    return
  }

  const history = [...sessionConversation]
  const controller = new AbortController()
  activeController = controller
  scene.stopPreview()
  updatePreviewControl()
  promptInput.value = ''
  promptInput.style.height = 'auto'
  addConversation('user', command)
  setRenderStatus('busy', 'AI 处理中…')
  setAiStatus('等待 AI 回复…')
  updateControls()
  appendMessageElement('assistant', '正在回复', true)

  try {
    await saveCurrentState()
    const result = await planner.planConversation(
      command,
      history,
      controller.signal,
      () => setAiStatus('AI 正在生成回复…')
    )
    if (!result.proposal) {
      changeSummary.textContent = '本轮仅回复，场景未修改'
      addConversation('assistant', result.reply)
    } else if (result.proposal.risk === 'low') {
      setAiStatus('正在应用低风险修改…')
      const applied = await applyPlannedChange(result.proposal, controller.signal)
      addConversation(
        'assistant',
        `${result.reply}\n\n${applied.projectionWarning ?? '修改已应用到场景。'}`
      )
    } else {
      addConversation('assistant', result.reply)
      showPlanReview(result.proposal)
    }
    setRenderStatus('ready', currentSceneLabel())
    setAiStatus(
      result.proposal && result.proposal.risk !== 'low'
        ? '请确认 AI 修改提案'
        : '可以继续对话'
    )
    await saveCurrentState()
  } catch (error) {
    const message = describeError(error)
    addConversation('assistant', message)
    setRenderStatus('ready', currentSceneLabel())
    setAiStatus(message)
    await saveCurrentState()
  } finally {
    activeController = null
    updateControls()
    if (!promptInput.disabled) promptInput.focus()
  }
}

async function applyPlannedChange(
  proposal: AiPlanProposal,
  signal: AbortSignal
): Promise<AiApplyResult> {
  scene.stopPreview()
  updatePreviewControl()
  const applied = await planner.applyProposal(proposal, signal)
  const changed = summarizeDomains(applied.domains.map((domain) => domain.label))
  state.lastPlan = applied.planJson
  state.lastApply = createAppliedPlanRecord(proposal, applied, changed)
  state.activeRecipeId = null
  setEffectStatus('场景已由 AI 调整 · 可重新选择本地方案')
  jsonButton.disabled = false
  jsonOutput.textContent = applied.planJson
  changeSummary.textContent = applied.projectionWarning
    ? `${changed}已提交，画面有警告`
    : `${changed}已由 AI 应用`
  try {
    renderSceneResources()
    renderEffectControls()
  } catch {
    showToast('修改已提交，但场景面板刷新失败')
  }
  if (applied.projectionWarning) showToast(applied.projectionWarning)
  return applied
}

function createAppliedPlanRecord(
  proposal: AiPlanProposal,
  applied: AiApplyResult,
  summary: string
): AppliedPlanRecord {
  return {
    at: Date.now(),
    summary,
    risk: proposal.risk,
    planHash: applied.planHash,
    operationId: applied.operationId,
    baseRevision: applied.baseRevision,
    revision: applied.revision,
    projectionStatus: applied.projectionStatus,
    projectionWarning: applied.projectionWarning,
    modelFailureEntityIds: [...applied.modelFailureEntityIds],
    changes: {
      created: [...applied.changes.created],
      updated: [...applied.changes.updated],
      removed: [...applied.changes.removed]
    }
  }
}

function getPromptBlockedReason(): string | null {
  if (!sceneReady) return '场景仍在启动，请稍后再发送。'
  if (!aiAvailable) return 'Cherry AI 尚未就绪，请检查授权和默认模型。'
  if (isSceneBusy()) return '请等待当前场景操作完成。'
  if (pendingProposal) return '请先应用或取消当前 AI 修改提案。'
  return null
}

function describeError(error: unknown): string {
  if (error instanceof AiPlannerError || error instanceof LocalScenePlanError) {
    return error.message
  }
  const runtimeDetail = describeRuntimeProjectionError(error)
  if (runtimeDetail) return runtimeDetail
  if (isKnownCherryError(error)) {
    if (error.name === 'Cancelled') return '已取消，场景未修改。'
    if (error.name === 'PermissionDenied') return 'Cherry AI 未授权，请在宿主中允许 AI 对话权限。'
    if (error.name === 'RateLimited') return '请求过于频繁，请稍后重试。'
    if (error.name === 'Unavailable') return 'Cherry AI 当前不可用。'
    return `Cherry AI 未完成：${error.name}`
  }
  return error instanceof Error && error.message
    ? `场景操作失败：${error.message}`
    : '场景操作失败，请重试。'
}

function describeRuntimeProjectionError(error: unknown): string | null {
  if (!(error instanceof Error) || error.name !== 'EditorRuntimeProjectionError') return null
  const record = error as Error & {
    error?: unknown
    result?: { error?: unknown; modelFailures?: Array<{ error?: unknown }> }
  }
  const detail = errorMessage(
    record.error ?? record.result?.error ?? record.result?.modelFailures?.[0]?.error
  )
  return detail && detail !== error.message
    ? `场景运行时未能加载：${detail}`
    : '场景运行时未能加载该模型'
}

function errorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message
  return typeof error === 'string' && error ? error : null
}

importButton.addEventListener('click', () => modelInput.click())
modelInput.addEventListener('change', () => {
  const files = modelInput.files ? Array.from(modelInput.files) : []
  void importSelectedFiles(files)
})

promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto'
  promptInput.style.height = `${Math.min(126, promptInput.scrollHeight)}px`
  updateControls()
})

promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitCurrentPrompt()
  }
})

function submitCurrentPrompt(): void {
  const command = promptInput.value.trim()
  if (!command) {
    setAiStatus('请输入消息后再发送。')
    return
  }
  void applyPrompt(command)
}

applyButton.addEventListener('click', submitCurrentPrompt)

composer.addEventListener('submit', (event) => {
  event.preventDefault()
  submitCurrentPrompt()
})

cancelButton.addEventListener('click', () => activeController?.abort())

confirmPlanButton.addEventListener('click', async () => {
  const proposal = pendingProposal
  if (!proposal || isSceneBusy()) return
  const controller = new AbortController()
  activeController = controller
  setRenderStatus('busy', '正在应用…')
  setAiStatus('正在提交已确认的修改…')
  updateControls()
  try {
    const applied = await applyPlannedChange(proposal, controller.signal)
    clearPlanReview()
    const changed = summarizeDomains(applied.domains.map((domain) => domain.label))
    addConversation(
      'assistant',
      applied.projectionWarning
        ? `${changed}修改已经提交。${applied.projectionWarning}`
        : `${changed}修改已应用到场景。`
    )
    setRenderStatus('ready', currentSceneLabel())
    setAiStatus('可以继续对话')
    await saveCurrentState()
  } catch (error) {
    const message = describeError(error)
    clearPlanReview()
    changeSummary.textContent = '提案未应用'
    addConversation('assistant', message)
    setRenderStatus('ready', currentSceneLabel())
    setAiStatus(message)
    await saveCurrentState()
  } finally {
    activeController = null
    updateControls()
  }
})

discardPlanButton.addEventListener('click', () => {
  if (!pendingProposal || isSceneBusy()) return
  clearPlanReview()
  changeSummary.textContent = '已取消 AI 修改提案'
  addConversation('assistant', '已取消这次场景修改。')
  setAiStatus('可以继续对话')
  void saveCurrentState()
})

previewButton.addEventListener('click', async () => {
  if (!sceneReady || isSceneBusy() || pendingProposal) return
  sceneOperationBusy = true
  updateControls()
  try {
    if (scene.previewing) {
      scene.stopPreview()
      setAiStatus('动态预览已停止')
    } else {
      await scene.startPreview()
      setAiStatus('动态预览中；再次点击可停止')
    }
  } catch (error) {
    showToast(describeError(error))
  } finally {
    sceneOperationBusy = false
    updateControls()
  }
})

function setInspectorTab(tabId: InspectorTabId, focusTab = false): void {
  const changed = state.ui.activeTab !== tabId
  state.ui.activeTab = tabId
  for (const tab of inspectorTabs) {
    const selected = tab.dataset.inspectorTab === tabId
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    if (selected && focusTab) tab.focus()
  }
  for (const panel of inspectorPanels) {
    panel.hidden = panel.dataset.inspectorPanel !== tabId
  }
  if (tabId === 'chat') {
    requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight
    })
  }
  if (changed) scheduleStateSave()
}

for (const tab of inspectorTabs) {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.inspectorTab
    if (tabId === 'effects' || tabId === 'chat' || tabId === 'scene') setInspectorTab(tabId)
  })
}

inspectorTablist.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const currentIndex = inspectorTabs.findIndex(
    (tab) => tab.getAttribute('aria-selected') === 'true'
  )
  if (currentIndex < 0) return

  event.preventDefault()
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? inspectorTabs.length - 1
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % inspectorTabs.length
          : (currentIndex - 1 + inspectorTabs.length) % inspectorTabs.length
  const nextTabId = inspectorTabs[nextIndex]?.dataset.inspectorTab
  if (nextTabId === 'effects' || nextTabId === 'chat' || nextTabId === 'scene') {
    setInspectorTab(nextTabId, true)
  }
})

undoButton.addEventListener('click', async () => {
  if (!sceneReady || isSceneBusy() || pendingProposal || !scene.canUndo) return
  sceneOperationBusy = true
  updateControls()
  try {
    scene.stopPreview()
    updatePreviewControl()
    await scene.undo()
    state.activeRecipeId = null
    setEffectStatus('已撤销 · 当前为自定义布景')
    changeSummary.textContent = '已撤销'
    setAiStatus('可以继续调整')
    renderSceneResources()
    renderEffectControls()
    await saveCurrentState()
  } catch (error) {
    showToast(describeError(error))
  } finally {
    sceneOperationBusy = false
    updateControls()
  }
})

redoButton.addEventListener('click', async () => {
  if (!sceneReady || isSceneBusy() || pendingProposal || !scene.canRedo) return
  sceneOperationBusy = true
  updateControls()
  try {
    scene.stopPreview()
    updatePreviewControl()
    await scene.redo()
    state.activeRecipeId = null
    setEffectStatus('已重做 · 当前为自定义布景')
    changeSummary.textContent = '已重做'
    setAiStatus('可以继续调整')
    renderSceneResources()
    renderEffectControls()
    await saveCurrentState()
  } catch (error) {
    showToast(describeError(error))
  } finally {
    sceneOperationBusy = false
    updateControls()
  }
})

frameButton.addEventListener('click', () => {
  if (sceneReady && !isSceneBusy() && !pendingProposal && scene.hasSubject) scene.frame()
})
resetViewButton.addEventListener('click', async () => {
  if (!sceneReady || isSceneBusy() || pendingProposal) return
  sceneOperationBusy = true
  scene.stopPreview()
  updateControls()
  try {
    await scene.resetView()
    state.activeRecipeId = null
    setEffectStatus('镜头已重置 · 当前为自定义布景')
    renderSceneResources()
    renderEffectControls()
    await saveCurrentState()
  } catch (error) {
    showToast(describeError(error))
  } finally {
    sceneOperationBusy = false
    updateControls()
  }
})

jsonButton.addEventListener('click', () => {
  jsonOutput.textContent = pendingProposal?.planJson ?? state.lastPlan
  jsonDialog.showModal()
})
closeDialogButton.addEventListener('click', () => jsonDialog.close())
jsonDialog.addEventListener('click', (event) => {
  if (event.target === jsonDialog) jsonDialog.close()
})

exportButton.addEventListener('click', async () => {
  if (!sceneReady || isSceneBusy() || pendingProposal) return
  try {
    const name = 'model-stage.scene.json'
    const data = textToBase64(scene.exportJson())
    await getCherry().file.save(name, data)
    const result = await getCherry().file.export(name, { suggestedName: name })
    showToast(result.saved ? '场景已导出' : '已取消')
  } catch (error) {
    showToast(describeError(error))
  }
})

onAppVisibility((visible) => {
  if (!visible) activeController?.abort()
  scene.setVisible(visible)
  updatePreviewControl()
  if (visible) void refreshAiAvailability()
  else void saveCurrentState()
})

window.addEventListener(
  'beforeunload',
  () => {
    activeController?.abort()
    // Best effort only; meaningful changes are saved before unload as well.
    void saveCurrentState()
    sceneReady = false
    scene.dispose()
  },
  { once: true }
)

async function start(): Promise<void> {
  renderEffectCatalog()
  let restoreWarning: string | null = null
  try {
    const loaded = await loadState()
    state = loaded.state
    restoreWarning = loaded.warning
    statePersistenceAvailable = true
  } catch (error) {
    state = structuredClone(emptyState)
    showToast(
      isKnownCherryError(error)
        ? `读取存档失败：${error.name}；本次不会覆盖旧存档`
        : '读取存档失败；本次不会覆盖旧存档'
    )
  }
  selectedTreeNodeId = state.ui.selectedTreeNodeId
  expandedTreeNodes.clear()
  for (const id of state.ui.expandedTreeNodeIds) expandedTreeNodes.add(id)
  setInspectorTab(state.ui.activeTab)
  renderConversation()
  if (state.lastPlan) {
    jsonButton.disabled = false
    jsonOutput.textContent = state.lastPlan
    changeSummary.textContent = state.lastApply
      ? `历史记录（仅查看）：${state.lastApply.summary}`
      : '可查看历史 AI 修改，不会重新执行'
  }

  try {
    setRenderStatus('busy', '启动中…')
    const restored = state.stageSettings !== null
    await scene.initialize(canvas, state.stageSettings)
    sceneReady = true
    setRenderStatus('ready', currentSceneLabel())
    renderSceneResources()
    renderEffectControls()
    const activePreset = EFFECT_PRESETS.find((preset) => preset.id === state.activeRecipeId)
    setEffectStatus(
      !statePersistenceAvailable
        ? '临时工作区 · 本次不会覆盖旧存档'
        : activePreset
          ? `已恢复${activePreset.name} · 可导入本次模型`
          : restored
            ? '上次布景已恢复 · 可导入本次模型'
            : '本地方案已就绪 · 无需配置 AI'
    )
    await refreshAiAvailability()
    await saveCurrentState()
    if (restoreWarning) showToast(restoreWarning)
    else if (restored) {
      showToast('布景与界面设置已恢复；模型仅在当前会话保留')
    }
  } catch (error) {
    sceneReady = false
    setRenderStatus('error', '场景启动失败')
    renderSceneResources()
    setAiStatus('场景未就绪，AI 操作暂不可用')
    setEffectStatus('场景未就绪，本地方案暂不可用', 'error')
    showToast(describeError(error))
  } finally {
    updateControls()
  }
}

function textToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768))
  }
  return btoa(binary)
}

void start()
