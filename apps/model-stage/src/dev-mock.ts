import type { CherryChatMessage } from '@cherry-miniapp/kit'

export function createDevelopmentScenePatch(messages: CherryChatMessage[]): string {
  const content = messages.at(-1)?.content ?? ''
  const context = readTaggedJson(content, 'scene-context')
  const command = content.match(/用户指令：([^\n]+)/u)?.[1] ?? content
  const revisionToken = isRecord(context.revisionToken) ? context.revisionToken : {}
  const document = isRecord(context.document) ? context.document : {}
  const operations: Record<string, unknown>[] = []
  const requestsChange = /把|改|调整|增加|减少|换|开启|关闭|旋转|转到|靠近|变成|设为/u.test(
    command
  )

  if (requestsChange && /背景|环境|暖|冷|夜/u.test(command)) {
    const color = /夜|深色|黑/u.test(command)
      ? '#25272c'
      : /冷|蓝/u.test(command)
        ? '#aeb9c4'
        : '#b9b1a8'
    operations.push({
      op: 'update',
      target: { kind: 'setting', id: 'environment' },
      changes: [
        { path: ['background', 'mode'], value: 'color' },
        { path: ['background', 'color'], value: color }
      ]
    })
  }

  if (requestsChange && /灯|轮廓|明亮|柔和/u.test(command)) {
    const lights = Array.isArray(document.lights) ? document.lights : []
    const rim = lights.find((light) => isRecord(light) && light.id === 'workspace-rim')
    const current = isRecord(rim) && typeof rim.intensity === 'number' ? rim.intensity : 0.62
    operations.push({
      op: 'update',
      target: { kind: 'light', id: 'workspace-rim' },
      changes: [
        { path: ['intensity'], value: Math.min(1.4, current + 0.28) },
        { path: ['color'], value: { r: 0.84, g: 0.9, b: 1 } }
      ]
    })
  }

  if (requestsChange && /镜头|视角|靠近|左前方|右前方/u.test(command)) {
    const position = /右/u.test(command)
      ? { x: -3.1, y: 2.05, z: -4.2 }
      : { x: 3.1, y: 2.05, z: -4.2 }
    const target = { x: 0, y: 0.82, z: 0 }
    const radius = Math.hypot(position.x, position.y - target.y, position.z)
    operations.push({
      op: 'update',
      target: { kind: 'setting', id: 'camera' },
      changes: [
        { path: ['position'], value: position },
        { path: ['target'], value: target },
        { path: ['alpha'], value: Math.atan2(position.z, position.x) },
        { path: ['beta'], value: Math.acos((position.y - target.y) / radius) },
        { path: ['radius'], value: radius }
      ]
    })
  }

  const subjectEntityId =
    typeof context.subjectEntityId === 'string' ? context.subjectEntityId : null
  if (requestsChange && subjectEntityId && /旋转|转动|换个角度/u.test(command)) {
    const subject = isRecord(document.subjectEntity) ? document.subjectEntity : {}
    const transform = isRecord(subject.transform) ? subject.transform : {}
    const rotation = isRecord(transform.rotation) ? transform.rotation : {}
    const currentY = typeof rotation.y === 'number' ? rotation.y : 0
    operations.push({
      op: 'update',
      target: { kind: 'entity', id: subjectEntityId },
      changes: [{ path: ['transform', 'rotation', 'y'], value: currentY + Math.PI / 6 }]
    })
  }

  return JSON.stringify({
    schema: 'model-stage.assistant-response',
    version: 1,
    reply: createReply(command, document, operations),
    patch:
      operations.length > 0
        ? {
            schema: 'skenora.scene.patch',
            version: 1,
            target: {
              sceneId: revisionToken.sceneId,
              expectedRevision: revisionToken.revision,
              expectedDocumentHash: revisionToken.documentHash
            },
            operations
          }
        : null
  })
}

function createReply(
  command: string,
  document: Record<string, unknown>,
  operations: readonly Record<string, unknown>[]
): string {
  if (operations.length > 0) {
    const domains = [
      /背景|环境|暖|冷|夜/u.test(command) ? '环境' : '',
      /灯|轮廓|明亮|柔和/u.test(command) ? '灯光' : '',
      /镜头|视角|靠近|左前方|右前方/u.test(command) ? '镜头' : '',
      /旋转|转动|换个角度/u.test(command) ? '主体角度' : ''
    ].filter(Boolean)
    return `准备按你的描述调整${domains.join('、') || '场景'}。`
  }

  if (/有什么|哪些|多少|资源|对象/u.test(command)) {
    const counts = isRecord(document.counts) ? document.counts : {}
    const entities = typeof counts.entities === 'number' ? counts.entities : 0
    const lights = typeof counts.lights === 'number' ? counts.lights : 0
    return `当前场景有 ${entities} 个模型或对象和 ${lights} 盏灯；切换右侧“场景”页签可查看天空、地面、镜头及对象父子关系。`
  }

  if (/生成|创建|换一个.*模型|删除.*模型/u.test(command)) {
    return '我不能生成、替换或删除模型文件，但可以调整已有场景的环境、灯光、镜头，以及当前模型的位置、角度和显隐。'
  }

  return '我可以回答当前场景的问题，也可以直接调整环境、灯光、镜头和已导入模型。你可以告诉我想看到什么效果。'
}

function readTaggedJson(content: string, tag: string): Record<string, unknown> {
  const match = content.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, 'u'))
  if (!match?.[1]) return {}
  try {
    const parsed: unknown = JSON.parse(match[1])
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
