# Cherry MiniApp 运行规范

> 状态：Draft Spec
>
> 规范版本：0.2
>
> 更新日期：2026-09-01

## 1. 合同状态

本项目目标是 Cherry Studio Local MiniApp，不是普通网页产品。

当前运行合同来自 Cherry Studio `main` 在 PR [#19475](https://github.com/CherryHQ/cherry-studio/pull/19475) 合并后的基线，并通过 `@cherry-miniapp/kit@0.2.0` 隔离宿主变化：

- 所有 Host 调用必须隔离在 `@cherry-miniapp/kit`。
- App 不得复制 foundation 的 Bridge 类型或实现作为长期方案。
- 启动时必须探测宿主、版本、权限和模型能力。
- Host 合同变化时先升级 foundation 包，再显式升级本 App 的依赖。
- 默认只制作 development 构建和本地安装包；发布流程需要用户单独授权。

当前实现说明：本 App 声明 `@cherry-miniapp/kit@^0.2.0` 与 `@cherry-miniapp/cli@^0.2.0`，由 monorepo 根 pnpm workspace 解析，并由根 `pnpm-lock.yaml` 锁定外部依赖。Storage、Visibility、运行时能力探测与 AI 流式调用均经过 kit；构建后的 `dist/` 由共享 CLI 校验和打包。manifest 已申请 `ai.chat`、`storage.get` 和 `storage.set`，产品已提供 Forge UI。

## 2. 运行环境

### 2.1 生产

- 生产入口必须检测 Cherry Host。
- Host 缺失时显示明确的“不支持当前运行环境”，不得静默切换到浏览器存储或假 AI。
- 所有运行资源必须包含在 `.miniapp` 包中。
- 不得依赖 Web Storage、IndexedDB、Cookie、Service Worker、Worker、外部 `fetch`、WebSocket、iframe、popup、剪贴板、摄像头、麦克风或地理位置。

### 2.2 开发

- 普通浏览器只作为开发环境。
- Vite DEV 模式可以显式安装 `@cherry-miniapp/kit/dev-mock`。
- Dev mock 必须在已经存在真实 Cherry Host 时保持不变，不得覆盖 Host。
- Mock 只验证产品流程，不能替代 opaque origin、CSP、权限、配额、keep-alive 和安装包联调。

### 2.3 可用 Web 能力

Canvas 2D、Web Audio、WebGL/WebGPU、WebAssembly、主题 media query 和包内相对资源可用。包内资源应使用构建后稳定路径；不得把远程 URL 写进内容包或 CSS。

## 3. Host 访问边界

应用代码只从 `@cherry-miniapp/kit` 的公开入口导入：

- `getCherry`：仅在需要原始 namespace 方法时使用。
- `getRuntimeSnapshot`：获取 app 信息、权限与模型能力。
- `streamText`：流式 AI、call ID 与取消。
- `loadJson` / `saveJson`：JSON 状态。
- `onAppVisibility`：Cherry 生命周期。
- `isCherryError`：识别普通错误对象。

直接 `window.cherry`、自建 ambient `cherry.d.ts` 或深层导入 foundation `src/` 均不得进入产品模块。

Platform 层应对上层提供项目语义接口，例如 `StateStore`、`AiGateway`、`AppLifecycle`，不让 Game Kernel 看到 Cherry API。

## 4. 权限策略

当前第一阶段 manifest：

```json
{
  "permissions": ["ai.chat", "storage.get", "storage.set"]
}
```

解释：

- 存档是核心体验，因此 `storage.get`、`storage.set` 为必需权限。
- `ai.chat` 用于玩家明确打开 Forge 后发起生成；权限被拒绝或能力不可用时，Forge 显示失败，内置和已接受内容仍由本地引擎运行。
- `app.getInfo`、`app.getPermissions` 和能力探测不额外申请产品权限。
- 不申请 `network.fetch`、`file.*`、`notification.show`。

未来权限必须按以下条件引入：

| 权限 | 允许引入的前提 |
| --- | --- |
| `storage.delete` | App 内需要删除整个状态文档，而非覆盖为默认状态 |
| `storage.keys` | 有明确的诊断或迁移需求，不能只为调试申请 |
| `file.*` | 接受内容或资产确实超过 Storage 预算，且有清理与配额 UI |
| `network.fetch` | 有明确 HTTPS 后端、精确 Host allowlist、离线降级和隐私说明 |
| `notification.show` | 存在离开 App 后仍有价值的长任务完成提醒 |

权限增加必须同时更新 manifest、本规范、权限说明 UI 和失败降级路径。

## 5. 能力预算

按当前 Host 合同设计：

| 能力 | Host 预算 | App 内策略 |
| --- | --- | --- |
| AI | 最多 2 个进行中、60 次/分钟/App | App 内最多 1 个生成 Job；不自动循环重试 |
| Storage | 1 MB、1000 keys、无事务 | 一个主状态文档；写入前检查字节数；串行写入 |
| File | 单文件 10 MB，总计 20 MB/200 文件 | 第一阶段不申请 |
| Network | 请求 1 MB、响应 5 MB、无跳转 | 第一阶段不申请 |
| Notification | 5 次/分钟/App、无点击回调 | 第一阶段不申请 |

这些数值来自尚未稳定的 Host 合同，不得散落为业务魔法数。Platform 层统一暴露能力快照和产品策略。

## 6. 应用状态文档

当前实现进度：`AppStateStore` 已落地 v1 Envelope、旧 Key 首次迁移、串行事务写入和 UTF-8 字节预算检查。`contentLibrary.packs` 与 `generationJobs` 按 `unknown[]` 保存，在内容快照或 Forge 服务使用时重新校验；接受武器时 Pack 安装、启用和 Job 结果通过一次写入提交。逐版本迁移链、恢复 UI 和 RunCheckpoint 尚未实现。

应用使用一个版本化、可恢复的状态文档作为持久化真值：

```ts
interface AppStateEnvelopeV1 {
  stateVersion: 1
  revision: number
  savedAt: string
  appVersion: string
  meta: MetaState
  settings: {
    muted: boolean
    perfEnabled: boolean
  }
  contentLibrary: {
    packs: unknown[]
    enabledPackIds: string[]
  }
  generationJobs: unknown[]
  activeRun?: RunCheckpointV1
}
```

具体业务类型由各自规范定义，Envelope 负责恢复与迁移。

要求：

- `stateVersion` 只递增，迁移为逐版本纯函数。
- `revision` 每次成功保存后递增，用于识别旧写入和诊断。
- 写操作必须串行，后发状态不能被先发 Promise 完成顺序覆盖。
- 序列化后按 UTF-8 字节检查额度，不以 JavaScript 字符长度代替。
- 解析或迁移失败时保留原始值，不写回默认状态覆盖用户数据。
- 不用多个 Storage Key 模拟事务。
- 大型、可重建的临时流式文本不进入主状态文档。
- `contentLibrary` 保存玩家接受的 ContentPack 与 WeaponRecipe 原文，不保存已绑定 Handler、Registry 对象或 `WeaponRuntimePlan`；运行计划按 [`WEAPON_RECIPE.md`](./WEAPON_RECIPE.md) 在启动或安全检查点重建。

## 7. 保存时机

必须保存：

- 元成长、设置或内容库发生变化。
- AI 请求即将开始、完整 Draft 收到、玩家接受/拒绝或请求中断。
- 单局开始、进入显式检查点、局终或重要不可逆选择完成。
- 收到 `app.visibilityChange(false)`。

不应该保存：

- 每一帧位置、动画计时器、粒子和飘字。
- 每个流式 AI Chunk。
- 可以从内容包和种子重新推导的缓存。

单局恢复粒度需要单独实现 `RunCheckpoint`。在它完成前，隐藏 App 至少暂停当前实例并持久化元状态，不能宣称支持崩溃后续局。

## 8. Visibility 生命周期

Cherry 的隐藏 App 可能留在 keep-alive 池中，浏览器 `visibilitychange` 不足以代表真实状态。

收到 `app.visibilityChange(false)` 时，必须按顺序：

1. 阻止新的用户动作和 AI 请求。
2. 暂停 Game Loop、输入、音频和产品 Timer。
3. 取消进行中的 AI call。
4. 把 Generation Job 标记为 interrupted。
5. 保存当前可恢复状态。

收到 `true` 时：

1. 重新读取必要的权限/能力变化。
2. 重置帧时间，避免把隐藏时长计入 `dt`。
3. 保持游戏在暂停态，由用户恢复。
4. 不自动重试 AI 请求。

Host 没有可靠 shutdown 事件，因此任何有意义的状态变化都不能只等待退出时保存。

## 9. AI 调用

- AI 只通过 `streamText` 或项目 `AiGateway` 调用。
- 每次调用都有稳定 Job ID、唯一 call ID 和 AbortSignal。
- Chunk 只更新展示缓冲区；完整文本完成后再持久化 Draft。
- 错误按公开 `{ name, message }` 处理，不使用 `instanceof Error` 判断 Cherry 错误。
- 详细流程遵循 `AI_GENERATION.md`。

## 10. 错误与降级

- Host 不可用：生产显示阻断页面；开发允许显式 mock。
- Storage 失败：阻止会产生不可恢复结果的操作，并保留内存中的最后状态供重试。
- AI 权限拒绝、限流或不可用：关闭生成入口或显示可重试状态，不影响本地游戏。
- 未知 Host 版本或能力缺失：按功能不可用降级，不猜测方法存在。
- 错误消息面向用户说明影响和下一步；内部对象和堆栈不写入 ContentPack。

## 11. Manifest

manifest 位于 `public/manifest.json`，由 Vite 原样复制到 `dist/manifest.json` 根目录。

要求：

- `id` 稳定，发布后不可随意更改。
- `version` 是合法 SemVer；development 构建使用预发布标识。
- `entry`、icon 路径和 icon SHA-256 与 `dist/` 内容一致。
- 权限与产品实际调用一致。
- 第一阶段不声明 network Host。
- 更新 URL 只在明确建立 HTTPS 分发流程后添加。

## 12. 构建与打包

唯一目标流水线：

```text
source + public/manifest.json
  → app build
  → dist/
  → cherry-miniapp validate
  → cherry-miniapp pack
  → development .miniapp + metadata
```

规则：

- App build 与 MiniApp pack 是独立步骤，分别报告失败。
- 使用发布的 `@cherry-miniapp/cli` / `cherry-miniapp`，不自行维护 ZIP 格式。
- CLI 必须验证 manifest、entry、icon hash、文件数量、体积、symlink 和权限。
- 默认只生成 development 构建。release/production、上传、分发清单和发布都需要当前任务的用户明确授权。
- App 只声明 foundation 包的 semver 范围，并通过 monorepo 根 workspace 解析；不得加入机器相关的绝对 `link:` 或子项目 lockfile。

## 13. 发布前 Host 验证

普通浏览器不能验证真实沙箱。发布候选必须在包含目标 MiniApp Runtime 的 Cherry 开发版中检查：

- 文件安装、manifest 和权限审查。
- 无 AI 权限与授权后的两条路径。
- Storage 保存、重启恢复和额度错误。
- 隐藏、恢复、取消 AI 和暂停游戏。
- 包内 Sprite、音频和主题在 opaque origin 下加载。
- 清除数据、升级和卸载后的行为。

是否执行这些验证由当前任务授权决定；文档不得把未执行检查写成已通过。

## 14. 首版验收条件

- 生产代码不再维护自定义 `cherry.d.ts` 子集。
- Cherry 调用只经过 kit/Platform 边界。
- 没有 Host 时生产不会使用 `localStorage` 假装正常运行。
- manifest 权限与实际调用一致，AI 缺失时可以离线游玩。
- 隐藏时 Game Loop、音频和 AI 全部停止并产生可恢复状态。
- `dist/manifest.json` 通过共享 CLI 校验并生成 development 包。
