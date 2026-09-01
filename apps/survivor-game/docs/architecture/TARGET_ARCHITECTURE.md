# 目标架构：确定性内核 + 生成式内容边缘

> 状态：Target
>
> 更新日期：2026-08-27

## 1. 目标

目标架构要同时解决四件事：

1. 游戏完全作为 Cherry Studio Local MiniApp 运行。
2. 现有玩法在迁移期间保持稳定，不做一次性重写。
3. 开发者可以通过注册新的行为原语扩展引擎。
4. AI 和玩家可以通过声明式内容包组合原语，而不能执行任意代码。

核心边界是：**游戏内核拥有真值，AI 只产生候选内容。**

## 2. 总体分层

```text
┌─────────────────────────────────────────────────────────┐
│ Cherry Studio Host                                      │
│ app · ai · storage · lifecycle                          │
└──────────────────────────┬──────────────────────────────┘
                           │ @cherry-miniapp/kit
┌──────────────────────────▼──────────────────────────────┐
│ Platform                                                │
│ HostGateway · StateStore · VisibilityCoordinator       │
└───────────────┬──────────────────────┬──────────────────┘
                │                      │
┌───────────────▼────────────┐  ┌──────▼──────────────────┐
│ AI Forge                   │  │ Application            │
│ prompt · stream · extract  │  │ menu · forge · library │
│ validate · preview         │  │ run lifecycle          │
└───────────────┬────────────┘  └──────┬──────────────────┘
                │ ContentPack Draft    │ accepted packs
┌───────────────▼──────────────────────▼──────────────────┐
│ Content                                                 │
│ pack validator · migrations · registries · library     │
└──────────────────────────┬──────────────────────────────┘
                           │ resolved definitions
┌──────────────────────────▼──────────────────────────────┐
│ Deterministic Game Kernel                              │
│ world · combat · spawn · upgrade · progression · RNG   │
│ behavior runtime · performance budgets                 │
└──────────────────────────┬──────────────────────────────┘
                           │ render snapshot / events
┌──────────────────────────▼──────────────────────────────┐
│ Presentation                                            │
│ Canvas renderers · HUD · forge preview · error states  │
└─────────────────────────────────────────────────────────┘
```

依赖只允许从上层指向下层接口；Game Kernel 不得导入 Cherry API、Prompt 或 AI 客户端。

## 3. 模块职责

### 3.1 Platform

Platform 是 Host（宿主，即 Cherry 提供能力和生命周期的运行环境）边界。

- `HostGateway`：封装 `@cherry-miniapp/kit`，暴露 app 信息、权限、AI 和生命周期。
- `StateStore`：读写一个可恢复、带版本号的应用状态文档，并串行化写入。
- `VisibilityCoordinator`：隐藏时暂停游戏和音频、取消 AI、触发存档。
- 浏览器开发环境只能安装显式 dev mock，不提供生产级 `localStorage` 备选路径。

### 3.2 Application

Application 负责编排用户流程，不实现武器伤害或怪物移动：

- 启动与恢复。
- 菜单、内容库、锻造、预览、接受和删除流程。
- 单局生命周期和状态切换。
- 将系统事件转换为存档时机或 UI 状态。

现有 `Game` 可以继续作为单局编排器，但逐步改为依赖明确的 `GameServices`，不再直接读取全局内容表。

### 3.3 AI Forge

AI Forge（AI 锻造管线，即把模型文本转成安全候选内容的应用服务）只处理候选内容：

- 根据已注册原语和预算构建 Prompt。
- 管理流式请求、取消、错误和恢复。
- 从文本中提取一个候选 JSON 文档。
- 调用 Content Validator 和 Balance Policy。
- 生成可解释的预览与拒绝原因。
- 玩家接受后才把内容交给 Content Library。

AI Forge 不得直接访问 `Player`、`Enemy`、`Weapon` 等热路径实体。

### 3.4 Content

Content 层把“玩法实现”和“玩法实例”分开：

- Registry（注册表，即通过稳定 ID 保存行为实现和定义的中心）管理可信原语。
- `ContentPackValidator` 验证不可信数据。
- `ContentResolver` 把内容包中的 ID 引用解析成运行时定义。
- `ContentLibrary` 管理内置、AI 生成、启用、禁用和归档内容包。
- `ContentMigrator` 将旧 schema 升级到当前版本。

任何未解析引用、重复 ID 或不兼容 schema 都必须使整个内容包失效，不得部分静默安装。

### 3.5 Deterministic Game Kernel

Kernel（游戏内核，即拥有战斗与规则真值的本地代码）负责：

- 游戏时钟、状态机和种子随机数。
- 玩家、敌人、弹幕、碰撞、伤害、掉落与升级。
- 难度曲线、资源、胜负和元成长。
- 行为图执行与硬性能上限。
- 产出只读渲染状态和领域事件。

同一引擎版本、内容包集合、初始状态和随机种子必须产生相同规则结果。视觉粒子可以非确定，但不得反向影响规则。

### 3.6 Presentation

Presentation 只读取状态并发送用户意图：

- Canvas 世界、实体和特效渲染。
- HUD、菜单、Codex 和结算。
- AI 流式文本、校验报告和内容预览。
- 权限拒绝、限流、不可用和中断恢复状态。

渲染配方可以来自内容包，但只能引用注册的形状、Sprite、颜色槽和粒子原语。

## 4. 两类插件

“插件化”必须区分可信代码与不可信内容。

### 4.1 EnginePlugin

EnginePlugin（引擎插件，即随应用编译、由开发者维护的可信 TypeScript 模块）注册可复用原语：

- 武器触发、瞄准与发射器。
- 弹幕阵型、移动、碰撞、命中和生命周期行为。
- 局内 Modifier 的兼容检查、计划变换与成本估算。
- 怪物移动动作与攻击 Pattern。
- 条件节点与动作节点。
- 渲染配方处理器。

EnginePlugin 只能在启动阶段注册；游戏开始后 Registry 冻结。它不通过 AI、存档或网络下载。

概念接口：

```ts
interface EnginePlugin {
  id: string
  version: string
  register(api: EnginePluginApi): void
}

interface EnginePluginApi {
  weaponTriggers: Registry<WeaponTriggerHandler>
  targetingStrategies: Registry<TargetingHandler>
  castOrigins: Registry<CastOriginHandler>
  emissionPatterns: Registry<EmissionPatternHandler>
  projectileMotions: Registry<ProjectileMotionHandler>
  collisionBehaviors: Registry<CollisionBehaviorHandler>
  hitEffects: Registry<HitEffectHandler>
  projectileLifecycles: Registry<ProjectileLifecycleHandler>
  weaponModifiers: Registry<WeaponModifierHandler>
  enemyActions: Registry<EnemyActionHandler>
  attackPatterns: Registry<AttackPatternHandler>
  renderRecipes: Registry<RenderRecipeHandler>
}
```

具体实现可以调整，但注册阶段、稳定 ID 和只读解析结果是必须保持的约束。

### 4.2 ContentPack

ContentPack（内容包，即内置或 AI 生成的声明式玩法数据）只能引用 Registry 中已有的原语：

- 武器配方、成长数据和允许引用的 Modifier。
- 怪物、攻击 Profile 和行为图。
- 程序化视觉配方。
- 文案、标签和来源信息。

ContentPack 不能包含函数、模块路径、脚本、任意表达式、远程 URL 或可执行 Shader。完整协议见 `../specs/CONTENT_PACK.md`；武器和弹幕组合合同见 `../specs/WEAPON_RECIPE.md`。

## 5. 关键 Registry

| Registry | Key | 当前实现迁移来源 | AI 是否可新增实现 |
| --- | --- | --- | --- |
| Weapon Trigger | `trigger.primitiveId` | 当前冷却与施放计时 | 否，只能引用 |
| Targeting | `targeting.primitiveId` | 最近目标、朝向和随机目标逻辑 | 否，只能引用 |
| Cast Origin | `emission.origin.primitiveId` | 玩家中心、法器挂点与受限偏移 | 否，只能引用 |
| Emission Pattern | `emission.pattern.primitiveId` | 单发、扇形、环形和 Burst 排布 | 否，只能引用 |
| Projectile Motion | `projectile.motion.primitiveId` | `updateProjectile` 分支 | 否，只能引用 |
| Collision Behavior | `projectile.collision.primitiveId` | 穿透、地图阻挡和命中处理 | 否，只能引用 |
| Hit Effect | `projectile.hitEffects[].primitiveId` | 伤害、击退和状态效果 | 否，只能引用 |
| Projectile Lifecycle | `projectile.lifecycle[].primitiveId` | 分裂、返回、到期和派生规则 | 否，只能引用 |
| Weapon Modifier | Modifier ID | 双重发射、穿透和局内构筑变换 | 否，只能引用和叠层 |
| Enemy Action | `actionId` | 追击、横移、撤退、Dash、Phase | 否，只能引用 |
| Attack Pattern | `patternId` | single、fan、ring、spiral 等 | 否，只能引用 |
| Render Recipe | `recipeId` | Sprite、形状、光晕、粒子组合 | 否，只能引用 |
| Content Definition | namespaced content ID | `WEAPON_DATA`、`ENEMY_DATA` 等 | 是，经校验后注册数据 |

新内容应组合细粒度原语，而不是按具体武器或怪物 ID 增加新的 `switch`。当前按 `builtin.weapon.<name>` 注册的完整 `fireXxx` 是迁移期适配器；目标不是持续为每件武器增加一个粗粒度行为。

### 5.1 武器配方编译

AI 生成的是 WeaponRecipe，不是可执行武器对象。WeaponRecipeCompiler 在安装、开局或局内明确升级检查点执行：

```text
WeaponRecipe
  → 解析原语引用
  → 绑定可信 Handler
  → 应用等级成长
  → 按固定阶段应用 Modifier 栈
  → 平衡与性能预算
  → 冻结 WeaponRuntimePlan
```

WeaponRuntimePlan 是一局内部的执行真值，不写入 Storage。帧循环只执行已绑定 Handler 和不可变参数，不解析 ContentPack、不做字符串 Registry 查询，也不为每颗弹幕临时构建配置对象。

颜色、大小、速度、数量、持续时间等是 Parameter；瞄准、阵型、运动、碰撞、命中、分裂等才是 Primitive。该边界、Modifier 顺序和首版 Schema 以 [`WEAPON_RECIPE.md`](../specs/WEAPON_RECIPE.md) 为准。

## 6. 两条关键数据流

### 6.1 内容生成

```text
玩家意图
  → 先保存 pending request
  → Cherry AI stream
  → 文本提取
  → schema 校验
  → 引用校验
  → 数值/复杂度/性能预算
  → 预览
  → 玩家接受
  → 保存 ContentPack
  → 重建 Content Registry Snapshot
```

任何阶段失败都不得改变当前启用内容集合。

### 6.2 单局运行

```text
读取已接受内容包
  → 迁移与验证
  → 构建不可变 Primitive Registry Snapshot
  → 将启用的 WeaponRecipe 编译为 Runtime Plan
  → 选择内容与随机种子
  → 启动 Game Kernel
  → 运行时只读取已解析定义
  → 局后保存结果和精简战报
```

游戏进行中不得热替换 Registry Snapshot。内容变化只在下一局或显式安全检查点生效。

## 7. 行为运行时

AI 调整怪物逻辑时输出的是 BehaviorGraph（行为图，即由白名单条件、动作和有界转移组成的数据），不是代码。

行为运行时必须满足：

- 每个实体每帧最多执行一个状态和有限数量转移。
- 所有循环通过冷却、持续时间或最大重复次数限制。
- 所有攻击动作声明前摇、冷却和成本。
- 召唤、弹幕、范围查询和特效受全局与单实体双重上限控制。
- 随机分支使用 Kernel 提供的种子 RNG。
- 未知条件或动作使内容包在安装阶段失败，不在战斗中临时降级。

## 8. 状态与版本

需要区分三类版本：

- `appVersion`：MiniApp 产品版本。
- `stateVersion`：完整应用存档 schema。
- `contentSchemaVersion`：ContentPack schema。

应用启动顺序是：加载状态 → 迁移状态 → 迁移内容包 → 验证内容包 → 构建 Registry Snapshot → 渲染 UI。任何迁移失败必须保留原始文档并进入可恢复状态，不能覆盖旧存档。

## 9. 目标目录

目录按增量迁移形成，不要求一次完成：

```text
src/
├── platform/
│   └── cherry/              # kit、权限、生命周期、存档适配
├── application/             # 启动、锻造、内容库、单局编排
├── ai/
│   ├── prompts/             # 产品 Prompt
│   ├── generation/          # 请求、提取、修复、取消
│   └── validation/          # AI 输出到 ContentPack 的管线
├── content/
│   ├── builtins/            # 内置 ContentPack
│   ├── registry/            # 行为和内容注册表
│   ├── schema/              # 类型、验证、迁移
│   └── library/             # 接受、启用、禁用、归档
└── game/
    ├── kernel/              # 时钟、世界、RNG、预算
    ├── recipes/             # Recipe 到只读 Runtime Plan
    ├── systems/             # 当前确定性游戏系统
    ├── behaviors/           # 可信 EnginePlugin 原语
    ├── renderers/
    ├── effects/
    └── events/
```

## 10. 依赖规则

- `game/` 不得导入 `ai/` 或 Cherry Host。
- `ai/` 可以依赖 ContentPack 类型和 Validator，不得依赖热路径实体。
- `content/` 可以依赖共享基础类型，不得依赖 UI。
- `platform/` 不包含产品 Prompt、武器、怪物或平衡规则。
- Renderer 不修改 Game Kernel 状态。
- EventBus 用于已发生事件的通知；需要返回值或拥有状态的操作使用明确接口，不把 EventBus 当服务定位器。

## 11. 增量迁移顺序

### Slice 0：MiniApp 基础合规

- 使用 `@cherry-miniapp/kit`。
- 建立 Cherry-only 生产入口和显式 dev mock。
- 建立版本化应用状态文档。
- 使用共享 CLI 打包。

### Slice 1：只读 Registry

- 把现有武器和怪物数据装入 Registry Snapshot。
- 系统通过 Registry 查询，内容和数值保持不变。
- Registry 启动后冻结。

### Slice 2：行为分发

- 按 `behaviorId` 注册现有 `fireXxx`。
- 按 `patternId` 注册现有敌人攻击。
- Renderer 按视觉配方分发。
- 删除与具体内容 ID 绑定的新扩展路径。

### Slice 3：原子投射物配方

- 注册 Trigger、Targeting、Cast Origin、Emission、Motion、Collision、HitEffect、Lifecycle 和 Modifier 原语。
- 建立 Capability Catalog 与 WeaponRecipeCompiler。
- 等价迁移一件现有投射物武器，再把第二件现有投射物武器改为纯配方数据。
- 打通双重发射与穿透的固定顺序装配。
- 不创建只用于演示生成能力的固定样板武器；AI 的具体颜色、尺寸、速度、数量和受限视觉组合保留在 ContentPack 数据侧。

### Slice 4：内置 ContentPack

- 将现有内容表达为内置 ContentPack。
- 完成 schema、迁移、引用和预算验证。
- 内置包与旧数据表得到等价结果。

### Slice 5：AI 武器锻造

- 接入生成状态机、预览和玩家确认。
- AI 只能生成 ContentPack 数据。
- 支持取消、中断恢复、拒绝和删除。

### Slice 6：怪物行为图

- 引入有界 BehaviorGraph 执行器。
- 先迁移内置怪物，再允许 AI 组合。

每个 Slice 必须可以独立合并，不要求后续 Slice 才能保持游戏可玩。

## 12. 架构完成标准

- 新武器实例可以只增加 ContentPack 数据，不修改武器 ID `switch`。
- 新投射物武器可以组合原语和参数，不新增内容专属 `fireXxx`、Motion 或 Renderer 分支。
- 局内 Modifier 按稳定阶段组合，结果不依赖获得顺序。
- 新怪物可以组合现有移动、攻击和视觉原语，不修改核心追击代码。
- 无 AI 权限时，内置和已接受内容正常运行。
- AI 输出无法绕过 Validator，也无法进入可执行路径。
- 隐藏、取消、限流、崩溃或宿主销毁后，用户可以看到并恢复未完成请求。
- 当前内容包可以被禁用、删除、迁移和复现。
