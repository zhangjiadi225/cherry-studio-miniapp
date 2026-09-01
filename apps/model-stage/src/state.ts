import { loadJson, saveJson } from '@cherry-miniapp/kit'
import type { ConversationEntry } from './ai-planner'

export interface PersistedModelMeta {
  name: string
  size: number
  lastModified: number
}

export interface ModelStageState {
  version: 2
  conversation: ConversationEntry[]
  lastPlan: string
  sceneJson: string
  model: PersistedModelMeta | null
}

const stateKey = 'model-stage-state-v2'

export const emptyState: ModelStageState = {
  version: 2,
  conversation: [],
  lastPlan: '',
  sceneJson: '',
  model: null
}

export async function loadState(): Promise<ModelStageState> {
  const value = await loadJson<unknown>(stateKey, emptyState)
  if (!isRecord(value) || value.version !== 2) return structuredClone(emptyState)
  return {
    version: 2,
    conversation: Array.isArray(value.conversation)
      ? value.conversation
          .filter(isConversationEntry)
          .slice(-20)
          .map((entry) => ({ ...entry }))
      : [],
    lastPlan: typeof value.lastPlan === 'string' ? value.lastPlan : '',
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
    typeof value.name === 'string' &&
    typeof value.size === 'number' &&
    typeof value.lastModified === 'number'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
