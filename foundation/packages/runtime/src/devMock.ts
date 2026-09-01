import type {
  CherryApi,
  CherryChatMessage,
  CherryError,
  CherryEvent,
  CherryEventPayload,
  CherryModelCapabilities
} from './types.js'

type EventHandler<E extends CherryEvent> = (payload: CherryEventPayload[E]) => void

export interface CherryDevMockOptions {
  appId?: string
  version?: string
  locale?: string
  permissions?: Record<string, boolean>
  modelCapabilities?: CherryModelCapabilities
  aiResponder?: (messages: CherryChatMessage[]) => string | Promise<string>
  chunkDelayMs?: number
}

const encoder = new TextEncoder()

function reject(name: CherryError['name'], message: string): never {
  throw { name, message } satisfies CherryError
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export function installCherryDevMock(options: CherryDevMockOptions = {}): void {
  if (window.cherry) return

  const storage = new Map<string, string>()
  const files = new Map<string, string>()
  let clipboardText = ''
  const cancelledCalls = new Set<string>()
  const activeCalls = new Set<string>()
  const listeners = new Map<CherryEvent, Set<(payload: never) => void>>()
  const permissions = options.permissions ?? {
    'ai.chat': true,
    'storage.get': true,
    'storage.set': true,
    'storage.delete': true,
    'storage.keys': true
  }
  const modelCapabilities = options.modelCapabilities ?? {
    available: true,
    reasoning: true,
    contextWindow: 128_000
  }

  function assertPermission(permission: string) {
    if (!permissions[permission]) reject('PermissionDenied', `${permission} is not granted`)
  }

  function assertNamespacePermission(namespace: string) {
    if (
      !Object.entries(permissions).some(
        ([permission, granted]) => granted && permission.startsWith(`${namespace}.`)
      )
    ) {
      reject('PermissionDenied', `${namespace} is not granted`)
    }
  }

  function emit<E extends CherryEvent>(event: E, payload: CherryEventPayload[E]) {
    for (const handler of listeners.get(event) ?? []) handler(payload as never)
  }

  const api: CherryApi = {
    app: {
      async getInfo() {
        return {
          appId: options.appId ?? 'dev.cherrymini.mock',
          version: options.version ?? '0.0.0-dev',
          hostVersion: 'browser-dev-mock',
          locale: options.locale ?? 'zh-CN'
        }
      },
      async getPermissions() {
        return { ...permissions }
      }
    },
    ai: {
      async chat(params, chatOptions) {
        assertPermission('ai.chat')
        if (!modelCapabilities.available) reject('Unavailable', 'The selected model slot is unavailable')

        const callId = chatOptions.callId ?? `anonymous-${crypto.randomUUID()}`
        if (activeCalls.has(callId)) reject('InvalidArgument', 'callId is already in flight')
        activeCalls.add(callId)

        try {
          const response = options.aiResponder
            ? await options.aiResponder(params.messages)
            : `开发模式回应：${params.messages.at(-1)?.content ?? '你好'}`
          const characters = Array.from(response)

          for (let index = 0; index < characters.length; index += 5) {
            if (cancelledCalls.has(callId)) reject('Cancelled', 'Cancelled')
            chatOptions.onChunk(characters.slice(index, index + 5).join(''))
            await wait(options.chunkDelayMs ?? 24)
          }
          return { ok: true }
        } finally {
          activeCalls.delete(callId)
          cancelledCalls.delete(callId)
        }
      },
      async cancel(callId) {
        if (activeCalls.has(callId)) cancelledCalls.add(callId)
        return { ok: true }
      },
      async getCapabilities() {
        assertNamespacePermission('ai')
        return modelCapabilities
      }
    },
    storage: {
      async get(key) {
        assertPermission('storage.get')
        return { value: storage.get(key) ?? null }
      },
      async set(key, value) {
        assertPermission('storage.set')
        storage.set(key, value)
        return { ok: true }
      },
      async delete(key) {
        assertPermission('storage.delete')
        storage.delete(key)
        return { ok: true }
      },
      async keys() {
        assertPermission('storage.keys')
        return { keys: [...storage.keys()].sort() }
      },
      async usage() {
        assertNamespacePermission('storage')
        return {
          bytes: encoder.encode(JSON.stringify(Object.fromEntries(storage))).byteLength,
          count: storage.size,
          bytesLimit: 1_048_576,
          countLimit: 1_000
        }
      }
    },
    file: {
      async save(name, data) {
        assertPermission('file.save')
        base64ToBytes(data)
        files.set(name, data)
        return { ok: true }
      },
      async load(name) {
        assertPermission('file.load')
        return { data: files.get(name) ?? null }
      },
      async list() {
        assertPermission('file.list')
        return { names: [...files.keys()].sort() }
      },
      async delete(name) {
        assertPermission('file.delete')
        files.delete(name)
        return { ok: true }
      },
      async usage() {
        assertNamespacePermission('file')
        const bytes = [...files.values()].reduce((total, value) => total + base64ToBytes(value).byteLength, 0)
        return { bytes, count: files.size, bytesLimit: 20 * 1024 * 1024, countLimit: 200 }
      },
      async export(name) {
        assertPermission('file.export')
        if (!files.has(name)) reject('InvalidArgument', `Unknown file: ${name}`)
        return { saved: true }
      }
    },
    notification: {
      async show() {
        assertPermission('notification.show')
        return { ok: true }
      }
    },
    clipboard: {
      async read() {
        assertPermission('clipboard.read')
        return { text: clipboardText }
      },
      async write({ text }) {
        assertPermission('clipboard.write')
        if (text.length > 1024 * 1024) reject('InvalidArgument', 'Clipboard text is too large')
        clipboardText = text
        return { ok: true }
      }
    },
    network: {
      async fetch(params) {
        assertPermission('network.fetch')
        const request: RequestInit = {}
        if (params.method) request.method = params.method
        if (params.headers) request.headers = params.headers
        if (params.body) {
          const body = base64ToBytes(params.body)
          request.body = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
        }
        const response = await fetch(params.url, request)
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: bytesToBase64(new Uint8Array(await response.arrayBuffer()))
        }
      }
    },
    on<E extends CherryEvent>(event: E, handler: EventHandler<E>) {
      const handlers = listeners.get(event) ?? new Set<(payload: never) => void>()
      handlers.add(handler as (payload: never) => void)
      listeners.set(event, handlers)
      return () => handlers.delete(handler as (payload: never) => void)
    }
  }

  window.cherry = api
  document.addEventListener('visibilitychange', () => {
    emit('app.visibilityChange', { visible: !document.hidden })
  })
}
