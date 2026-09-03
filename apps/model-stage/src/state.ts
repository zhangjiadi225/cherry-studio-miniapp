import { loadJson, saveJson } from '@cherry-miniapp/kit'
import type { ConversationEntry } from './ai-planner'
import { EFFECT_PRESETS, type EffectPresetId, type LocalScenePlan } from './scene-recipes'
import { readStageSettings, type StageSettings } from './stage-settings'
import { DRIFT_ENTITY_ID } from './scene-particles'

export type InspectorTabId = 'effects' | 'chat' | 'scene'

export interface ModelStageUiState {
  activeTab: InspectorTabId
  selectedTreeNodeId: string
  expandedTreeNodeIds: string[]
}

export interface AppliedPlanRecord {
  at: number
  summary: string
  risk: 'low' | 'medium' | 'high'
  planHash: string | null
  operationId: string
  baseRevision: number | null
  revision: number | null
  projectionStatus: string
  projectionWarning: string | null
  modelFailureEntityIds: string[]
  changes: {
    created: string[]
    updated: string[]
    removed: string[]
  }
}

export interface ModelStageState {
  version: 6
  conversation: ConversationEntry[]
  lastPlan: string
  lastApply: AppliedPlanRecord | null
  activeRecipeId: EffectPresetId | null
  lastLocalOperation: LocalOperationRecord | null
  stageSettings: StageSettings | null
  ui: ModelStageUiState
}

export interface LocalOperationRecord extends Omit<AppliedPlanRecord, 'summary' | 'risk'> {
  id: string
  label: string
  kind: LocalScenePlan['kind']
  planJson: string
}

const stateKey = 'model-stage-state-v6'
const previousStateKeys = ['model-stage-state-v5', 'model-stage-state-v4', 'model-stage-state-v3', 'model-stage-state-v2']

export const emptyState: ModelStageState = {
  version: 6,
  conversation: [],
  lastPlan: '',
  lastApply: null,
  activeRecipeId: null,
  lastLocalOperation: null,
  stageSettings: null,
  ui: {
    activeTab: 'effects',
    selectedTreeNodeId: 'scene-sky',
    expandedTreeNodeIds: ['scene-root', 'scene-objects', 'scene-lights']
  }
}

export async function loadState(): Promise<{
  state: ModelStageState
  warning: string | null
}> {
  let value = await loadJson<unknown>(stateKey, null)
  for (const key of previousStateKeys) {
    if (isVersionedState(value)) break
    value = await loadJson<unknown>(key, null)
  }
  if (!isVersionedState(value)) {
    return { state: structuredClone(emptyState), warning: null }
  }
  let settingsValue: unknown = value.stageSettings
  if ([2, 3, 4].includes(Number(value.version)) && typeof value.sceneJson === 'string' && value.sceneJson) {
    try {
      settingsValue = JSON.parse(value.sceneJson)
    } catch {
      settingsValue = false // Invalid legacy JSON must not block history/UI recovery.
    }
  }
  const restored = settingsValue == null ? null : readStageSettings(settingsValue)
  const stageSettings = restored?.settings ?? null
  const state: ModelStageState = {
    version: 6,
    conversation: Array.isArray(value.conversation)
      ? value.conversation
          .filter(isConversationEntry)
          .slice(-20)
          .map((entry) => ({ ...entry }))
      : [],
    lastPlan: typeof value.lastPlan === 'string' ? value.lastPlan : '',
    lastApply: isAppliedPlanRecord(value.lastApply) ? cloneAppliedPlanRecord(value.lastApply) : null,
    activeRecipeId:
      stageSettings && !restored?.warning && isEffectPresetId(value.activeRecipeId)
        ? value.activeRecipeId
        : null,
    lastLocalOperation: isLocalOperationRecord(value.lastLocalOperation)
      ? structuredClone(value.lastLocalOperation)
      : null,
    stageSettings,
    ui: readUiState(value.ui, stageSettings)
  }
  return { state, warning: restored?.warning ?? null }
}

export async function persistState(state: ModelStageState): Promise<void> {
  const stageSettings = state.stageSettings ? readStageSettings(state.stageSettings).settings : null
  await saveJson(stateKey, {
    version: 6,
    stageSettings,
    ui: readUiState(state.ui, stageSettings),
    activeRecipeId: state.activeRecipeId,
    conversation: state.conversation.slice(-20),
    lastPlan: state.lastPlan,
    lastApply: state.lastApply,
    lastLocalOperation: state.lastLocalOperation
  })
}

function readUiState(value: unknown, settings: StageSettings | null): ModelStageUiState {
  const source = isRecord(value) ? value : {}
  const allowedNodes = new Set([
    'scene-root', 'scene-sky', 'scene-ground', 'scene-objects', 'scene-lights',
    'scene-camera', 'scene-fog', 'scene-weather', 'scene-post-process',
    ...(settings?.lights.map((light) => `light:${light.id}`) ?? []),
    ...(settings && settings.driftDensity !== null ? [`entity:${DRIFT_ENTITY_ID}`] : [])
  ])
  return {
    activeTab:
      source.activeTab === 'chat' || source.activeTab === 'scene' ? source.activeTab : 'effects',
    selectedTreeNodeId:
      typeof source.selectedTreeNodeId === 'string' && allowedNodes.has(source.selectedTreeNodeId)
        ? source.selectedTreeNodeId
        : 'scene-sky',
    expandedTreeNodeIds: isStringArray(source.expandedTreeNodeIds)
      ? [...new Set(source.expandedTreeNodeIds.filter((id) => allowedNodes.has(id)))]
      : [...emptyState.ui.expandedTreeNodeIds]
  }
}

function isConversationEntry(value: unknown): value is ConversationEntry {
  return (
    isRecord(value) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.text === 'string'
  )
}

function isAppliedPlanRecord(value: unknown): value is AppliedPlanRecord {
  return (
    isRecord(value) &&
    typeof value.summary === 'string' &&
    (value.risk === 'low' || value.risk === 'medium' || value.risk === 'high') &&
    isApplyOutcome(value)
  )
}

function isLocalOperationRecord(value: unknown): value is LocalOperationRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.kind === 'string' &&
    ['preset', 'camera', 'background', 'light', 'atmosphere'].includes(value.kind) &&
    typeof value.planJson === 'string' &&
    isApplyOutcome(value)
  )
}

function isApplyOutcome(value: Record<string, unknown>): boolean {
  return (
    typeof value.at === 'number' &&
    (value.planHash === null || typeof value.planHash === 'string') &&
    typeof value.operationId === 'string' &&
    (value.baseRevision === null || typeof value.baseRevision === 'number') &&
    (value.revision === null || typeof value.revision === 'number') &&
    typeof value.projectionStatus === 'string' &&
    (value.projectionWarning === null || typeof value.projectionWarning === 'string') &&
    isStringArray(value.modelFailureEntityIds) &&
    isRecord(value.changes) &&
    isStringArray(value.changes.created) &&
    isStringArray(value.changes.updated) &&
    isStringArray(value.changes.removed)
  )
}

function cloneAppliedPlanRecord(value: AppliedPlanRecord): AppliedPlanRecord {
  return {
    ...value,
    modelFailureEntityIds: [...value.modelFailureEntityIds],
    changes: {
      created: [...value.changes.created],
      updated: [...value.changes.updated],
      removed: [...value.changes.removed]
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isEffectPresetId(value: unknown): value is EffectPresetId {
  return EFFECT_PRESETS.some((preset) => preset.id === value)
}

function isVersionedState(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.version === 'number' && [2, 3, 4, 5, 6].includes(value.version)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
