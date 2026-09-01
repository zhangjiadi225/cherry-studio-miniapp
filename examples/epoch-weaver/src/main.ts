import {
  getCherry,
  getRuntimeSnapshot,
  isCherryError,
  loadJson,
  onAppVisibility,
  saveJson,
  streamText
} from '@cherry-miniapp/kit'
import { installCherryDevMock } from '@cherry-miniapp/kit/dev-mock'
import { AmbientField } from './ambient'
import './style.css'

type SeedId = 'tidal' | 'glass' | 'forest'
type ActionId = 'explore' | 'build' | 'connect'

interface ChronicleEntry {
  turn: number
  role: 'world' | 'player'
  text: string
}

interface GameState {
  version: 1
  seed: SeedId
  turn: number
  stability: number
  insight: number
  energy: number
  chronicle: ChronicleEntry[]
  pendingAction?: { id: ActionId; turn: number }
}

const stateKey = 'epoch-weaver-state'
const seeds: Record<SeedId, { name: string; premise: string }> = {
  tidal: {
    name: '潮汐群岛',
    premise:
      '月潮第一次越过旧世界的山巅。七座漂浮城市松开锚链，在深蓝色天际汇成环形。鲸群带来了陌生的歌：它们说海面之下，还有一座从未醒来的城市。'
  },
  glass: {
    name: '玻璃荒原',
    premise:
      '第九次恒星风暴结束后，大地凝成一整块会歌唱的玻璃。你的人民发现，脚下每一道裂纹都储存着过去的声音，而最深处传来尚未发生的回响。'
  },
  forest: {
    name: '夜语森林',
    premise:
      '古树连续一百年没有入睡，整片森林因此无法做梦。今夜，它第一次向人类开口，请求你替它保管一个会改变季节的秘密。'
  }
}

const actions: Record<
  ActionId,
  { label: string; instruction: string; stability: number; insight: number; energy: number }
> = {
  explore: {
    label: '探索边界',
    instruction: '派出最勇敢的人越过已知世界，寻找文明从未理解的现象。',
    stability: -6,
    insight: 12,
    energy: -3
  },
  build: {
    label: '建造奇迹',
    instruction: '集中资源建造一个能代表这个时代、也可能改变环境的巨大工程。',
    stability: 10,
    insight: 2,
    energy: -12
  },
  connect: {
    label: '连接众生',
    instruction: '让彼此隔绝的群体、物种或意识建立新的交流方式。',
    stability: 3,
    insight: 6,
    energy: 8
  }
}

if (import.meta.env.DEV) {
  installCherryDevMock({
    appId: 'dev.cherrymini.epoch-weaver',
    version: '0.1.1',
    aiResponder(messages) {
      const decision = messages.at(-1)?.content ?? ''
      if (decision.includes('探索边界')) {
        return '探索者沿着世界边缘前进七日，最终发现地平线并不是尽头，而是一面缓慢呼吸的薄膜。有人把手贴上去，另一个时代的掌纹从对面回应。消息传回后，年轻人开始学习一种尚未被发明的语言。'
      }
      if (decision.includes('建造奇迹')) {
        return '工程历时整整一个季节。当最后一块构件升起，它没有成为纪念碑，反而像乐器一样接住了风。城市第一次听见自己的声音，争吵的人群在同一段低沉和弦里安静下来。'
      }
      return '新的连接从一场失败的翻译开始。双方误解了彼此，却共同创造出第三种表达：用光的明暗记录情绪。几周后，孩子们已经能熟练使用它，而旧有的边界开始失去意义。'
    }
  })
}

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector)
  if (!value) throw new Error(`Missing element: ${selector}`)
  return value
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

const setupPanel = element<HTMLElement>('#setup-panel')
const gamePanel = element<HTMLElement>('#game-panel')
const modelStatus = element<HTMLElement>('#model-status')
const epochLabel = element<HTMLElement>('#epoch-label')
const civilizationName = element<HTMLElement>('#civilization-name')
const narrative = element<HTMLElement>('#narrative')
const saveStatus = element<HTMLElement>('#save-status')
const resumeButton = element<HTMLButtonElement>('#resume-button')
const resetButton = element<HTMLButtonElement>('#reset-button')
const ambient = new AmbientField(element<HTMLCanvasElement>('#ambient'))
const metricElements = {
  stability: {
    value: element<HTMLElement>('#stability-value'),
    meter: element<HTMLElement>('#stability-meter')
  },
  insight: {
    value: element<HTMLElement>('#insight-value'),
    meter: element<HTMLElement>('#insight-meter')
  },
  energy: {
    value: element<HTMLElement>('#energy-value'),
    meter: element<HTMLElement>('#energy-meter')
  }
}

let state = await loadJson<GameState | null>(stateKey, null)
let activeController: AbortController | null = null
let modelAvailable = false

function renderMetric(metric: keyof typeof metricElements, value: number) {
  metricElements[metric].value.textContent = String(value)
  metricElements[metric].meter.style.width = `${value}%`
}

function setActionsDisabled(disabled: boolean) {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]'))
    button.disabled = disabled
  resumeButton.disabled = disabled
}

async function refreshModelAvailability() {
  try {
    const runtime = await getRuntimeSnapshot('default')
    modelAvailable = runtime.capabilities.available
    setActionsDisabled(!modelAvailable || activeController !== null)
    if (!runtime.capabilities.available) {
      modelStatus.textContent = '时代引擎不可用 · 请先配置默认模型'
      return
    }

    const context = runtime.capabilities.contextWindow
    modelStatus.textContent = context ? `时代引擎在线 · ${Math.round(context / 1000)}K 记忆` : '时代引擎在线'
  } catch (error) {
    modelAvailable = false
    setActionsDisabled(true)
    modelStatus.textContent = isCherryError(error) ? `时代引擎不可用 · ${error.name}` : '时代引擎不可用'
  }
}

function render() {
  setupPanel.hidden = state !== null
  gamePanel.hidden = state === null
  if (!state) return

  const seed = seeds[state.seed]
  epochLabel.textContent = `纪元 ${String(state.turn).padStart(2, '0')}`
  civilizationName.textContent = seed.name
  renderMetric('stability', state.stability)
  renderMetric('insight', state.insight)
  renderMetric('energy', state.energy)

  const latestWorld = [...state.chronicle].reverse().find((entry) => entry.role === 'world')
  narrative.textContent = latestWorld?.text ?? seed.premise
  resumeButton.hidden = !state.pendingAction
  saveStatus.textContent = state.pendingAction ? '推演曾被中断 · 选择已保存' : '已写入纪年'
}

async function startCivilization(seed: SeedId) {
  state = {
    version: 1,
    seed,
    turn: 1,
    stability: 72,
    insight: 18,
    energy: 64,
    chronicle: [{ turn: 0, role: 'world', text: seeds[seed].premise }]
  }
  await saveJson(stateKey, state)
  render()
}

function buildPrompt(game: GameState, actionId: ActionId): string {
  const action = actions[actionId]
  const recentHistory = game.chronicle
    .slice(-6)
    .map((entry) => `${entry.role === 'world' ? '世界' : '文明'}：${entry.text}`)
    .join('\n')
  return [
    `文明：${seeds[game.seed].name}`,
    `当前纪元：${game.turn}`,
    `状态：稳定度 ${game.stability}，洞察 ${game.insight}，能量 ${game.energy}`,
    `最近纪年：\n${recentHistory}`,
    `本回合选择「${action.label}」：${action.instruction}`,
    '请用 90-150 个汉字讲述世界对此产生的具体、意外但合乎前文的回应。不要列点，不要解释规则，不要替玩家做下一次选择。'
  ].join('\n\n')
}

async function runAction(actionId: ActionId, resume = false) {
  if (!state || activeController || !modelAvailable) return
  const action = actions[actionId]

  if (!resume) {
    state.pendingAction = { id: actionId, turn: state.turn }
    state.chronicle.push({ turn: state.turn, role: 'player', text: action.label })
    await saveJson(stateKey, state)
  }

  activeController = new AbortController()
  setActionsDisabled(true)
  saveStatus.textContent = '时代引擎正在推演…'
  narrative.textContent = ''

  try {
    const response = await streamText({
      model: 'default',
      reasoning: 'off',
      signal: activeController.signal,
      messages: [
        {
          role: 'system',
          content: '你是诗意但克制的文明模拟叙事引擎。保持世界连续性，让变化产生代价、发现与新的悬念。'
        },
        { role: 'user', content: buildPrompt(state, actionId) }
      ],
      onChunk(_chunk, accumulated) {
        narrative.textContent = accumulated
      }
    })

    state.stability = clamp(state.stability + action.stability)
    state.insight = clamp(state.insight + action.insight)
    state.energy = clamp(state.energy + action.energy)
    state.chronicle.push({ turn: state.turn, role: 'world', text: response })
    state.turn += 1
    delete state.pendingAction
    await saveJson(stateKey, state)
  } catch (error) {
    saveStatus.textContent = isCherryError(error) ? `推演暂停 · ${error.name}` : '推演暂停'
  } finally {
    activeController = null
    setActionsDisabled(!modelAvailable)
    render()
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-seed]')) {
  button.addEventListener('click', () => void startCivilization(button.dataset.seed as SeedId))
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  button.addEventListener('click', () => void runAction(button.dataset.action as ActionId))
}

resumeButton.addEventListener('click', () => {
  if (state?.pendingAction) void runAction(state.pendingAction.id, true)
})

resetButton.addEventListener('click', async () => {
  activeController?.abort()
  await getCherry().storage.delete(stateKey)
  state = null
  render()
})

onAppVisibility((visible) => {
  if (visible) {
    ambient.start()
    void refreshModelAvailability()
    return
  }
  ambient.stop()
  activeController?.abort()
  if (state) void saveJson(stateKey, state)
})

await refreshModelAvailability()
ambient.start()
render()
