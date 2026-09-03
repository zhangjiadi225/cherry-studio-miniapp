import { loadJson, saveJson } from '@cherry-miniapp/kit'
import type { ConversationEntry } from './ai-planner'
import { EFFECT_PRESETS, type EffectPresetId, type LocalScenePlan } from './scene-recipes'

export interface PersistedModelMeta {
  entityId?: string
  assetId?: string
  name: string
  size: number
  lastModified: number
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
  version: 4
  conversation: ConversationEntry[]
  lastPlan: string
  lastApply: AppliedPlanRecord | null
  activeRecipeId: EffectPresetId | null
  lastLocalOperation: LocalOperationRecord | null
  sceneJson: string
  model: PersistedModelMeta | null
}

export interface LocalOperationRecord extends Omit<AppliedPlanRecord, 'summary' | 'risk'> {
  id: string
  label: string
  kind: LocalScenePlan['kind']
  planJson: string
}

const stateKey = 'model-stage-state-v4'
const previousStateKeys = ['model-stage-state-v3', 'model-stage-state-v2']

export const emptyState: ModelStageState = {
  version: 4,
  conversation: [],
  lastPlan: '',
  lastApply: null,
  activeRecipeId: null,
  lastLocalOperation: null,
  sceneJson: '',
  model: null
}

export async function loadState(): Promise<ModelStageState> {
  let value = await loadJson<unknown>(stateKey, null)
  for (const key of previousStateKeys) {
    if (isVersionedState(value)) break
    value = await loadJson<unknown>(key, null)
  }
  if (!isVersionedState(value)) {
    return structuredClone(emptyState)
  }
  return {
    version: 4,
    conversation: Array.isArray(value.conversation)
      ? value.conversation
          .filter(isConversationEntry)
          .slice(-20)
          .map((entry) => ({ ...entry }))
      : [],
    lastPlan: typeof value.lastPlan === 'string' ? value.lastPlan : '',
    lastApply: isAppliedPlanRecord(value.lastApply) ? cloneAppliedPlanRecord(value.lastApply) : null,
    activeRecipeId: isEffectPresetId(value.activeRecipeId) ? value.activeRecipeId : null,
    lastLocalOperation: isLocalOperationRecord(value.lastLocalOperation)
      ? structuredClone(value.lastLocalOperation)
      : null,
    sceneJson: typeof value.sceneJson === 'string' ? value.sceneJson : '',
    model: isModelMeta(value.model) ? { ...value.model } : null
  }
}

export async function persistState(state: ModelStageState): Promise<void> {
  await saveJson(stateKey, {
    ...state,
    conversation: state.conversation.slice(-20)
  })
}

function isConversationEntry(value: unknown): value is ConversationEntry {
  return (
    isRecord(value) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.text === 'string'
  )
}

function isModelMeta(value: unknown): value is PersistedModelMeta {
  return (
    isRecord(value) &&
    (value.entityId === undefined || typeof value.entityId === 'string') &&
    (value.assetId === undefined || typeof value.assetId === 'string') &&
    typeof value.name === 'string' &&
    typeof value.size === 'number' &&
    typeof value.lastModified === 'number'
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
    ['preset', 'camera', 'background', 'light'].includes(value.kind) &&
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
  return isRecord(value) && (value.version === 2 || value.version === 3 || value.version === 4)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
