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
import { AiPlanner, AiPlannerError } from './ai-planner'
import { createDevelopmentScenePatch } from './dev-mock'
import { SceneController } from './scene-controller'
import { emptyState, loadState, persistState, type ModelStageState } from './state'
import './style.css'

if (import.meta.env.DEV) {
  installCherryDevMock({
    appId: 'dev.cherrymini.model-stage',
    version: '0.3.11',
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
const exportButton = element<HTMLButtonElement>('#export-button')
const toast = element<HTMLElement>('#toast')

const scene = new SceneController()
const planner = new AiPlanner(scene)
let state: ModelStageState = structuredClone(emptyState)
let aiAvailable = false
let sceneReady = false
let activeController: AbortController | null = null
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
  const busy = activeController !== null
  applyButton.disabled = !sceneReady || !aiAvailable || busy || !promptInput.value.trim()
  promptInput.disabled = !sceneReady || !aiAvailable
  importButton.disabled = !sceneReady || busy
  undoButton.disabled = !sceneReady || busy || !scene.canUndo
  redoButton.disabled = !sceneReady || busy || !scene.canRedo
  frameButton.disabled = !sceneReady || !scene.hasSubject
  resetViewButton.disabled = !sceneReady || busy
  exportButton.disabled = !sceneReady || busy
  cancelButton.hidden = !busy
}

function setRenderStatus(kind: 'ready' | 'busy' | 'error', label: string): void {
  sceneStatus.dataset.kind = kind
  modelLabel.textContent = label
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
      if (details.open) expandedTreeNodes.add(node.id)
      else expandedTreeNodes.delete(node.id)
      item.setAttribute('aria-expanded', String(details.open))
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

  if (row instanceof HTMLButtonElement && row.dataset.entityId && sceneReady) {
    scene.frameEntity(row.dataset.entityId)
  }
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
  for (const entry of state.conversation) appendMessageElement(entry.role, entry.text)
  conversation.scrollTop = conversation.scrollHeight
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
  renderConversation()
}

function summarizeDomains(labels: readonly string[]): string {
  return [...new Set(labels)].join('、') || '场景'
}

async function saveCurrentState(): Promise<void> {
  if (sceneReady) state.sceneJson = scene.exportJson()
  try {
    await persistState(state)
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
          ? '可以提问，也可以直接修改场景'
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
  if (!sceneReady || files.length === 0) return
  activeController?.abort()
  setRenderStatus('busy', '导入中…')
  setAiStatus('正在读取模型…')
  updateControls()
  try {
    const model = await scene.importModel(files)
    state.model = {
      name: model.name,
      size: model.size,
      lastModified: model.lastModified
    }
    setRenderStatus('ready', model.name)
    setAiStatus(aiAvailable ? '可以继续调整' : '请先配置默认模型')
    changeSummary.textContent = `已导入 ${model.name}`
    addConversation('assistant', `已替换为 ${model.name}。`)
    selectedTreeNodeId = `entity:${model.entityId}`
    renderSceneResources()
    await saveCurrentState()
  } catch (error) {
    setRenderStatus('ready', scene.subjectName)
    setAiStatus(aiAvailable ? '可以继续调整' : '请先配置默认模型')
    showToast(describeError(error))
  } finally {
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

  const history = [...state.conversation]
  const controller = new AbortController()
  activeController = controller
  promptInput.value = ''
  promptInput.style.height = 'auto'
  addConversation('user', command)
  setRenderStatus('busy', 'AI 处理中…')
  setAiStatus('等待 AI 回复…')
  updateControls()
  appendMessageElement('assistant', '正在回复', true)

  try {
    await saveCurrentState()
    const result = await planner.applyConversation(
      command,
      history,
      controller.signal,
      () => setAiStatus('AI 正在生成回复…')
    )
    if (result.applied && result.planJson) {
      state.lastPlan = result.planJson
      jsonButton.disabled = false
      jsonOutput.textContent = result.planJson
      const changed = summarizeDomains(result.domains.map((domain) => domain.label))
      changeSummary.textContent = `${changed}已由 AI 应用`
      renderSceneResources()
      try {
        await scene.startPreview()
      } catch {
        showToast('修改已应用，但动态预览未能启动')
      }
    } else {
      changeSummary.textContent = '本轮仅回复，场景未修改'
    }
    addConversation('assistant', result.reply)
    setRenderStatus('ready', scene.subjectName)
    setAiStatus('可以继续对话')
    await saveCurrentState()
  } catch (error) {
    const message = describeError(error)
    addConversation('assistant', message)
    setRenderStatus('ready', scene.subjectName)
    setAiStatus(message)
    await saveCurrentState()
  } finally {
    activeController = null
    updateControls()
    if (!promptInput.disabled) promptInput.focus()
  }
}

function getPromptBlockedReason(): string | null {
  if (!sceneReady) return '场景仍在启动，请稍后再发送。'
  if (!aiAvailable) return 'Cherry AI 尚未就绪，请检查授权和默认模型。'
  if (activeController) return '请等待当前回复完成，或先停止它。'
  return null
}

function describeError(error: unknown): string {
  if (error instanceof AiPlannerError) return error.message
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

type InspectorTabId = 'chat' | 'scene'

function setInspectorTab(tabId: InspectorTabId, focusTab = false): void {
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
}

for (const tab of inspectorTabs) {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.inspectorTab
    if (tabId === 'chat' || tabId === 'scene') setInspectorTab(tabId)
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
  if (nextTabId === 'chat' || nextTabId === 'scene') {
    setInspectorTab(nextTabId, true)
  }
})

undoButton.addEventListener('click', async () => {
  try {
    await scene.undo()
    changeSummary.textContent = '已撤销'
    setAiStatus('可以继续调整')
    renderSceneResources()
    await saveCurrentState()
  } catch (error) {
    showToast(describeError(error))
  } finally {
    updateControls()
  }
})

redoButton.addEventListener('click', async () => {
  try {
    await scene.redo()
    changeSummary.textContent = '已重做'
    setAiStatus('可以继续调整')
    renderSceneResources()
    await saveCurrentState()
  } catch (error) {
    showToast(describeError(error))
  } finally {
    updateControls()
  }
})

frameButton.addEventListener('click', () => {
  if (scene.hasSubject) scene.frame()
})
resetViewButton.addEventListener('click', async () => {
  try {
    await scene.resetView()
    await saveCurrentState()
  } catch (error) {
    showToast(describeError(error))
  } finally {
    updateControls()
  }
})

jsonButton.addEventListener('click', () => {
  jsonOutput.textContent = state.lastPlan
  jsonDialog.showModal()
})
closeDialogButton.addEventListener('click', () => jsonDialog.close())
jsonDialog.addEventListener('click', (event) => {
  if (event.target === jsonDialog) jsonDialog.close()
})

exportButton.addEventListener('click', async () => {
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
  if (visible) void refreshAiAvailability()
  else void saveCurrentState()
})

window.addEventListener(
  'beforeunload',
  () => {
    activeController?.abort()
    scene.dispose()
  },
  { once: true }
)

async function start(): Promise<void> {
  try {
    state = await loadState()
  } catch (error) {
    state = structuredClone(emptyState)
    showToast(
      isKnownCherryError(error) ? `历史对话未恢复：${error.name}` : '历史对话未恢复'
    )
  }
  renderConversation()
  if (state.lastPlan) {
    jsonButton.disabled = false
    jsonOutput.textContent = state.lastPlan
    changeSummary.textContent = '可查看最近一次 AI 修改'
  }

  try {
    setRenderStatus('busy', '启动中…')
    await scene.initialize(canvas)
    sceneReady = true
    setRenderStatus('ready', scene.subjectName)
    selectedTreeNodeId = scene.subjectEntityId
      ? `entity:${scene.subjectEntityId}`
      : 'scene-sky'
    renderSceneResources()
    await refreshAiAvailability()
    if (state.model) showToast(`${state.model.name} 需要重新导入；空工作区仍可直接使用`)
  } catch (error) {
    sceneReady = false
    setRenderStatus('error', '场景启动失败')
    renderSceneResources()
    setAiStatus('场景未就绪，AI 操作暂不可用')
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
