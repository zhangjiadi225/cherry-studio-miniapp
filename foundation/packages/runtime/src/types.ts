export type CherryErrorName =
  | 'PermissionDenied'
  | 'QuotaExceeded'
  | 'RateLimited'
  | 'Unavailable'
  | 'InvalidArgument'
  | 'Cancelled'
  | 'Internal'

export interface CherryError {
  name: CherryErrorName
  message: string
}

export type CherryEvent = 'app.visibilityChange' | 'app.localeChange'

export interface CherryEventPayload {
  'app.visibilityChange': { visible: boolean }
  'app.localeChange': { locale: string }
}

export type CherryModelSlot = 'default' | 'quick'

export interface CherryChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CherryChatParams {
  messages: CherryChatMessage[]
  reasoning?: 'on' | 'off'
  model?: CherryModelSlot
}

export interface CherryUsage {
  bytes: number
  count: number
  bytesLimit: number
  countLimit: number
}

export type CherryModelCapabilities =
  | { available: false }
  | { available: true; reasoning: boolean; contextWindow: number | null }

export interface CherryApp {
  getInfo(): Promise<{ appId: string; version: string; hostVersion: string; locale: string }>
  getPermissions(): Promise<Record<string, boolean>>
}

export interface CherryAi {
  chat(
    params: CherryChatParams,
    options: { onChunk: (text: string) => void; callId?: string }
  ): Promise<{ ok: true }>
  cancel(callId: string): Promise<{ ok: true }>
  getCapabilities(params?: { model?: CherryModelSlot }): Promise<CherryModelCapabilities>
}

export interface CherryStorage {
  get(key: string): Promise<{ value: string | null }>
  set(key: string, value: string): Promise<{ ok: true }>
  delete(key: string): Promise<{ ok: true }>
  keys(): Promise<{ keys: string[] }>
  usage(): Promise<CherryUsage>
}

export interface CherryFile {
  save(name: string, data: string): Promise<{ ok: true }>
  load(name: string): Promise<{ data: string | null }>
  list(): Promise<{ names: string[] }>
  delete(name: string): Promise<{ ok: true }>
  usage(): Promise<CherryUsage>
  export(name: string, options?: { suggestedName?: string }): Promise<{ saved: boolean }>
}

export interface CherryNotification {
  show(params: { title: string; body?: string }): Promise<{ ok: true }>
}

export interface CherryClipboard {
  read(): Promise<{ text: string }>
  write(params: { text: string }): Promise<{ ok: true }>
}

export interface CherryFetchParams {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
  headers?: Record<string, string>
  body?: string
}

export interface CherryNetwork {
  fetch(params: CherryFetchParams): Promise<{
    status: number
    headers: Record<string, string>
    body: string
  }>
}

export interface CherryApi {
  app: CherryApp
  ai: CherryAi
  storage: CherryStorage
  file: CherryFile
  notification: CherryNotification
  clipboard: CherryClipboard
  network: CherryNetwork
  on<E extends CherryEvent>(event: E, handler: (payload: CherryEventPayload[E]) => void): () => void
}

declare global {
  const cherry: CherryApi

  interface Window {
    cherry: CherryApi
  }
}
