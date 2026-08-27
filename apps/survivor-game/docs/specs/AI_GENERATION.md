# AI 生成规范

> 状态：Draft Spec
>
> 规范版本：0.3
>
> 更新日期：2026-08-27

## 1. 目的

本规范定义 Cherry AI 如何参与武器、怪物和行为变异的生成。目标不是保证模型永远返回正确内容，而是保证错误、取消、限流和格式漂移不会破坏游戏状态。

AI 输出始终是候选 Draft。游戏规则只接受经过本地校验且被玩家明确接受的 ContentPack。

当前实现进度：武器任务已经通过本机链接的 `@cherry-miniapp/kit` 接入真实 Cherry Host。AI 引擎首页可收集玩家意图并进入同一个受控 Forge；Forge UI 可显示流式结果、预览一级/满级数值、Delivery 与全部原语引用、展示本地校验结果，并明确接受或拒绝。`weapon.v4` Prompt 会发送 P0/P1/P2 的完整冻结 Capability Catalog；单请求状态机、取消、单 JSON 提取、Draft 持久化、完整本地校验以及“接受 Job + 安装并启用 ContentPack”的原子写入已经落地。一次自动修复、启动恢复管理 UI 和内容包管理 UI 尚未接入。

## 2. 支持的任务

第一阶段支持：

- `weapon`：生成一件武器蓝图、WeaponRecipe、文案和视觉配方。
- `enemy`：生成一个怪物蓝图、攻击 Profile、行为图和视觉配方。
- `behavior-mutation`：基于已有怪物生成一个有界行为变体。

不支持：

- 直接生成或执行代码。
- 定义新的 Primitive、Modifier Handler 或任意字段变换公式。
- 在单局帧循环中持续调用模型。
- 让模型结算伤害、掉落、货币或胜负。
- 让模型直接修改已经接受的 ContentPack。
- 通过 `ai.chat` 生成位图、音频或可执行 Shader。

## 3. 模型槽位

| 任务 | 默认槽位 | Reasoning | 说明 |
| --- | --- | --- | --- |
| 武器/怪物完整生成 | `default` | `off` | 低频、结构较大 |
| 行为变异 | `default` | `off` | 需要完整规则上下文 |
| 命名、短描述 | `quick` | `off` | 短响应 |
| 一次结构修复 | `quick` | `off` | 只修复校验错误，不重新设计 |

调用前应该查询模型能力和上下文窗口。上下文窗口未知或不足时，必须缩减历史、Registry 摘要和示例；不得假设固定上下文长度。

应用内部最多允许一个生成请求进行中。第二个用户意图必须等待、替换尚未开始的请求，或被明确拒绝，不能无提示并发。

## 4. 持久化状态机

一次生成请求必须具有稳定 `requestId`，并遵循以下状态：

```text
idle
  → pending-persisted
  → streaming
  → received
  → validating
  ├─→ preview
  │    ├─→ accepted
  │    └─→ rejected
  ├─→ repairable
  │    └─→ repairing → validating
  └─→ failed

任意进行中状态
  → interrupted
  → retrying 或 rejected
```

最低持久化形状：

```ts
interface GenerationJobV1 {
  requestId: string
  task: 'weapon' | 'enemy' | 'behavior-mutation'
  promptVersion: string
  modelSlot: 'default' | 'quick'
  status:
    | 'pending'
    | 'streaming'
    | 'received'
    | 'validating'
    | 'preview'
    | 'repairing'
    | 'accepted'
    | 'rejected'
    | 'interrupted'
    | 'failed'
  userIntent: string
  createdAt: string
  updatedAt: string
  rawResponse?: string
  draft?: unknown
  validation?: ValidationReportV1
  error?: { name: string; message: string; retryable: boolean }
}
```

要求：

- 发起 AI 请求前必须先保存 `pending` Job 和玩家意图。
- 流式文本只用于 UI，不需要每个 Chunk 写入存档。
- 完整响应收到后，先保存不超过 100,000 字符的可恢复原文，再提取 Draft 并进入校验；接受后清除重复原文。
- 玩家接受后，必须以一次串行写入同时保存 ContentPack 与 Job 结果。
- 隐藏、取消或宿主销毁导致中断时，Job 必须在下次启动显示为可重试或可放弃。
- 重试复用同一用户意图，但创建新的调用 ID；不能把两次响应拼接。
- 主状态文档只保留最近 12 个 Generation Job，防止失败原文无界占用 Storage。

## 5. Prompt 合同

每个 Prompt 必须带有显式版本，并只包含完成任务所需的最小信息：

- 任务目标和玩家意图。
- 当前 ContentPack schema 的任务相关子集。
- 可引用的行为、Pattern、Modifier 和视觉原语 ID。
- 每个武器/弹幕原语的参数 Schema、兼容关系和成本摘要；格式遵循 [`WEAPON_RECIPE.md`](./WEAPON_RECIPE.md)。
- 当前任务的全部已发布原语，以及每个 Modifier 的兼容家族；最终由所选 Delivery 家族裁决 Modifier。
- Prompt 必须要求遵守 `requires` / `conflictsWith`，并使线段/扇区碰撞与光束/圆弧渲染的几何参数保持语义一致。
- 视觉 Particle Effect 的事件、参数边界、每秒生成量和理论同时在场预算。
- 数值预算和硬限制摘要。
- 一个最小有效示例。
- 输出要求：只返回一个 JSON 对象，不返回 Markdown 解释。

Prompt 不得包含：

- API Key、用户模型配置或宿主内部信息。
- 完整原始战斗事件日志。
- 与任务无关的全部存档。
- 未经压缩的所有内容包正文。

Prompt 文本属于产品代码，应与 `promptVersion` 一同变更。Prompt 更新不得自动重生成已有内容。

## 6. 输出提取

当前 Cherry `ai.chat` 不提供结构化输出或 JSON Schema 强制能力，因此调用层必须假设模型返回普通文本。

提取规则：

1. 接受一个裸 JSON 对象，或一个只包含 JSON 的 fenced code block。
2. 只允许一个顶层对象；多个候选对象必须拒绝。
3. 解析结果类型为 `unknown`，不得直接断言为 ContentPack。
4. 去除 code fence 不等于信任内容，随后必须运行完整 ContentPack Validator。
5. 不执行字段中的代码、HTML、SVG、CSS、表达式或 URL。

模型返回的解释文本不能作为规则真值，也不能作为校验成功依据。

## 7. 校验与修复

校验顺序遵循 `CONTENT_PACK.md`。错误分为：

- `repairable`：缺少必填展示字段、合法枚举拼写错误、引用了相近但不存在的原语 ID 等结构问题。
- `non-repairable`：越权字段、可执行内容、严重超预算、未知 schema、多个顶层对象、恶意或不可判定内容。

修复策略：

- 每个 Job 最多自动尝试一次结构修复。
- 修复请求只发送原 Draft、稳定错误码、字段路径和允许值，不要求模型重新设计全部内容。
- 修复结果重新经过完整校验，不能只验证原失败字段。
- 第二次失败直接进入 `failed`，由玩家修改意图或重新生成。
- 本地代码可以对无语义歧义的展示字段做规范化，但不得偷偷改伤害、冷却、奖励或行为图来“让它通过”。

## 8. Balance Policy

AI 可以提出数值，本地 Balance Policy（平衡策略，即根据引擎规则裁定候选内容是否可用的确定性代码）拥有最终决定权。

至少检查：

- 一级与满级每秒伤害预算。
- 范围、穿透、数量、持续时间和冷却的组合成本。
- 控制能力与伤害能力的叠加。
- 怪物有效生命、接近时间、攻击覆盖率和奖励比。
- 单次与持续弹幕数量。
- WeaponRecipe 在一级、满级和兼容 Modifier 满层时的最坏弹幕与派生深度。
- 召唤、范围查询和粒子开销。
- Burst 追赶、Lifecycle 派生深度、周期区域 `maxTargetsPerTick`、多目标效果总伤害与视听反馈频率。
- Boss 招式前摇与安全窗口。

Validator 可以返回建议区间供玩家理解，但第一版不得自动重写规则数值。以后若增加“自动平衡”，必须展示原值、调整值和原因，并再次要求玩家确认。

## 9. 玩家确认

预览必须展示：

- 名称、描述和视觉预览。
- 关键一级/满级数值。
- 使用的行为、Modifier、Pattern 和行为图摘要。
- Balance/Performance 检查结果。
- 这是新生成、修复后结果还是已有内容的变体。

玩家必须通过明确的“接受并安装”操作才能改变内容库。关闭页面、切换 Tab、请求完成或流式输出结束都不代表接受。

首页可以提供自然语言输入并直接发起一次生成，但必须先进入同一 Forge Job 与预览流程；首页按钮不得把模型结果自动安装或绕过玩家确认。

## 10. 生命周期与取消

- 每个 AI 调用必须有唯一 `callId` 和 `AbortController`。
- 收到 `app.visibilityChange(false)` 时必须取消当前调用并保存 Job 状态。
- 取消后迟到的 Chunk 或完成回调必须按 `requestId` 丢弃。
- 游戏恢复可见时不自动重试，先让玩家确认。
- AI 请求不得持有或修改正在运行的 Game World 引用。

如果设计未来允许局中变异，必须先进入明确的暂停/检查点状态，保存单局，再发起请求；超时或失败使用内置变异或无变化继续。

## 11. 错误映射与降级

Cherry 错误以普通 `{ name, message }` 对象跨 Bridge，不是 `Error` 实例。应用只按公开错误名分支：

| 错误 | 用户行为 | 产品降级 |
| --- | --- | --- |
| `PermissionDenied` | 引导查看权限 | 继续使用内置和已接受内容 |
| `QuotaExceeded` | 说明存储/文件额度 | 不丢弃当前 Draft，允许清理后重试 |
| `RateLimited` | 显示稍后重试 | 不自动循环重试 |
| `Unavailable` | 显示模型不可用 | 离线玩法可继续 |
| `InvalidArgument` | 记录稳定错误码 | 结束 Job，允许重新生成 |
| `Cancelled` | 标记中断 | 提供重试/放弃 |
| `Internal` | 显示通用失败 | 保留意图，不修改内容库 |

任何未知错误按不可用处理并保留当前安全状态，不向用户展示堆栈或宿主内部细节。

## 12. 可复现性

- 接受后保存确切 ContentPack，不在每次启动时重新请求模型。
- 保存 `promptVersion`、任务类型、模型槽位和父内容 ID；不依赖模型名称保持一致。
- 战斗使用保存后的规则字段和本地种子 RNG。
- AI 叙事可以变化，但不能反向改变已开始单局的数值。

## 13. 隐私与上下文

局后 AI 输入只使用明确的精简摘要，例如：

- 使用的武器与等级。
- 存活时间、击杀数、承受伤害。
- 主要死亡来源。
- 构筑中已接受内容的公开规则摘要。

不发送逐帧位置、完整事件日志、宿主设置或其他 MiniApp 数据。未来增加网络服务前必须单独更新 Cherry Runtime 规范。

## 14. 首版验收条件

- 请求前能恢复 `pending` Job。
- 隐藏应用会取消请求，恢复后不会自动继续或重复安装。
- 非 JSON、未知行为 ID、越界数值和可执行字段均不能进入预览通过状态。
- 一次修复失败后停止，不发生无限 AI 调用。
- 玩家拒绝 Draft 后，启用内容集合保持不变。
- 没有 `ai.chat` 权限时，游戏和内容库仍可使用。
