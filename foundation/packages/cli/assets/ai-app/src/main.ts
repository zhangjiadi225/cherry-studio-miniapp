import {
  getRuntimeSnapshot,
  isCherryError,
  loadJson,
  onAppVisibility,
  saveJson,
  streamText
} from '@cherry-miniapp/kit'
import { installCherryDevMock } from '@cherry-miniapp/kit/dev-mock'
import './style.css'

interface AppState {
  prompt: string
  output: string
}

const stateKey = 'app-state'
const emptyState: AppState = { prompt: '', output: '' }

if (import.meta.env.DEV) {
  installCherryDevMock({
    appId: '__APP_ID__',
    version: '0.1.0',
    aiResponder(messages) {
      const prompt = messages.at(-1)?.content ?? ''
      return `这是浏览器开发模式的模拟结果。\n\n你的输入是：${prompt}\n\n下一步：把 aiResponder 替换成贴近产品的稳定样例，同时保持正式环境使用 Cherry 用户自己的模型。`
    }
  })
}

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector)
  if (!value) throw new Error(`Missing element: ${selector}`)
  return value
}

const form = element<HTMLFormElement>('#prompt-form')
const promptInput = element<HTMLTextAreaElement>('#prompt')
const output = element<HTMLParagraphElement>('#output')
const status = element<HTMLSpanElement>('#status')
const clearButton = element<HTMLButtonElement>('#clear-button')
const submitButton = element<HTMLButtonElement>('.composer button[type="submit"]')
let state = await loadJson(stateKey, emptyState)
let activeController: AbortController | null = null

async function refreshModelAvailability() {
  try {
    const runtime = await getRuntimeSnapshot('default')
    submitButton.disabled = !runtime.capabilities.available
    if (!runtime.capabilities.available) {
      status.textContent = '请先在 Cherry 中配置默认模型'
    } else if (!activeController && status.textContent === '请先在 Cherry 中配置默认模型') {
      status.textContent = '就绪'
    }
  } catch (error) {
    submitButton.disabled = true
    status.textContent = isCherryError(error) ? `模型不可用：${error.name}` : '模型不可用'
  }
}

function render() {
  promptInput.value = state.prompt
  output.textContent = state.output || '生成内容会出现在这里。'
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  activeController?.abort()
  activeController = new AbortController()
  state = { prompt: promptInput.value.trim(), output: '' }
  await saveJson(stateKey, state)
  status.textContent = '生成中…'
  output.textContent = ''

  try {
    const result = await streamText({
      model: 'default',
      reasoning: 'off',
      signal: activeController.signal,
      messages: [
        { role: 'system', content: '你是这个小程序的核心 AI。给出具体、简洁、可执行的中文结果。' },
        { role: 'user', content: state.prompt }
      ],
      onChunk(_chunk, accumulated) {
        output.textContent = accumulated
      }
    })
    state.output = result
    await saveJson(stateKey, state)
    status.textContent = '已保存'
  } catch (error) {
    status.textContent = isCherryError(error) ? `未完成：${error.name}` : '未完成'
  } finally {
    activeController = null
  }
})

clearButton.addEventListener('click', async () => {
  activeController?.abort()
  state = { ...emptyState }
  await saveJson(stateKey, state)
  status.textContent = '已清空'
  render()
})

onAppVisibility((visible) => {
  if (visible) {
    void refreshModelAvailability()
  } else {
    activeController?.abort()
  }
})

await refreshModelAvailability()
render()
