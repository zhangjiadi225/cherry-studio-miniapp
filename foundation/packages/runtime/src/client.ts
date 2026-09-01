import type { CherryApi, CherryChatMessage, CherryChatParams, CherryError, CherryModelSlot } from './types.js'

const encoder = new TextEncoder()

export function isCherryError(error: unknown): error is CherryError {
  if (!error || typeof error !== 'object') return false
  const candidate = error as Partial<CherryError>
  return typeof candidate.name === 'string' && typeof candidate.message === 'string'
}

export function getCherry(): CherryApi {
  if (typeof window === 'undefined' || !window.cherry) {
    throw { name: 'Unavailable', message: 'Cherry host is unavailable' } satisfies CherryError
  }
  return window.cherry
}

export function hasCherryHost(): boolean {
  return typeof window !== 'undefined' && Boolean(window.cherry)
}

export interface StreamTextOptions {
  messages: CherryChatMessage[]
  model?: CherryModelSlot
  reasoning?: 'on' | 'off'
  signal?: AbortSignal
  callId?: string
  onChunk?: (chunk: string, accumulated: string) => void
}

export async function streamText(options: StreamTextOptions): Promise<string> {
  const api = getCherry()
  const callId = options.callId ?? `call-${crypto.randomUUID()}`
  let accumulated = ''

  if (options.signal?.aborted) {
    throw { name: 'Cancelled', message: 'Cancelled' } satisfies CherryError
  }

  const cancel = () => {
    void api.ai.cancel(callId)
  }
  options.signal?.addEventListener('abort', cancel, { once: true })

  const params: CherryChatParams = { messages: options.messages }
  if (options.model) params.model = options.model
  if (options.reasoning) params.reasoning = options.reasoning

  try {
    await api.ai.chat(params, {
      callId,
      onChunk(chunk) {
        accumulated += chunk
        options.onChunk?.(chunk, accumulated)
      }
    })
    return accumulated
  } finally {
    options.signal?.removeEventListener('abort', cancel)
  }
}

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const { value } = await getCherry().storage.get(key)
  if (value === null) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value)
  if (encoder.encode(serialized).byteLength > 1_000_000) {
    throw { name: 'QuotaExceeded', message: 'Serialized state is too large' } satisfies CherryError
  }
  await getCherry().storage.set(key, serialized)
}

export function onAppVisibility(handler: (visible: boolean) => void): () => void {
  return getCherry().on('app.visibilityChange', ({ visible }) => handler(visible))
}

export async function getRuntimeSnapshot(model: CherryModelSlot = 'default') {
  const api = getCherry()
  const [info, permissions, capabilities] = await Promise.all([
    api.app.getInfo(),
    api.app.getPermissions(),
    api.ai.getCapabilities({ model })
  ])
  return { info, permissions, capabilities }
}
