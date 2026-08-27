# WeaponRecipe 与弹幕原语规范

> 状态：Draft Spec
>
> 规范版本：0.4
>
> 更新日期：2026-08-27

## 1. 目的与当前边界

WeaponRecipe（武器配方，即用项目提供的原子能力和受限参数描述一件武器的数据）定义内置内容与 AI 内容如何使用同一协议组合武器与弹体，而不为每件新武器生成代码。

AI 可以提供颜色、尺寸、速度、数量、阵型参数和受限视觉层等具体内容。应用不内置某个用于演示生成能力的固定武器，也不为某种颜色或数量编写专属实现；应用只提供可复用规则原语、封闭参数 Schema、预算和运行时处理器。首批真实样板来自已经存在的内置武器。

当前代码中的 `builtin.weapon.magic-wand`、`builtin.weapon.fire-wand` 等 `behaviorId` 是迁移期兼容适配器。它们完成了从 `WeaponType switch` 到 Registry 分发的第一步，但仍然是一件武器对应一个较粗行为，不是最终原子层。

当前 WeaponRecipe 闭环已经包含 Delivery、Trigger、Targeting、Cast Origin、Emission Schedule/Pattern、Motion、Collision、HitEffect、Lifecycle、Render、Particle、Audio/Camera Feedback、通用 Modifier Registry、Capability Catalog、严格编译和动态 ContentPack 装配。P0/P1/P2 路线图原语已经全部注册；旧的 `delivery: "projectile"` 仍作为兼容写法映射到 `builtin.delivery.projectile`。

Projectile、Zone、Aura、Strike 和 Swing 共用同一个池化弹体执行内核，但交付处理器拥有落点激活、玩家跟随和碰撞生效时机。Orbit 仍可由 `motion.orbit-player` 表达；其他内置武器的旧 `fireXxx` 迁移不属于本次协议扩展。

## 2. 核心原则

1. **项目提供原语与策略，AI 只提供组合和参数。**
2. **参数不是引擎。** 颜色、半径、速度、数量和持续时间是有边界的数据；追踪、扇形、穿透、分裂和反弹等包含规则的能力才注册为原语。
3. **内容不能携带函数。** ContentPack 中不得出现 JavaScript、表达式、模块路径、JSON Patch、任意字段路径或动态导入。
4. **组合先解析后运行。** 配方在安装和开局时解析为只读 `WeaponRuntimePlan`，帧循环不解析 JSON、不按字符串寻找 Handler。
5. **Modifier 由本地代码变换计划。** AI 可以引用 Modifier，不能描述 Modifier 如何改写运行时对象。
6. **组合顺序固定。** 同一引擎版本、配方、Modifier 栈和随机种子必须产生相同结果。
7. **预算双重防线。** 安装/升级前做静态预算；运行时仍保留确定性的实体与弹幕硬上限。
8. **样板必须是真实内容。** AI Prompt、预览和文档示例应从实际内置 Recipe 与冻结 Capability Catalog 派生，不能维护一套只用于演示、运行时不消费的影子武器定义。

## 3. 三种基本概念

| 概念 | 所有者 | 示例 | 是否由 AI 新增 |
| --- | --- | --- | --- |
| Parameter | ContentPack | 颜色、速度、半径、数量、透明度 | 是，在边界内赋值 |
| Primitive | EnginePlugin | 最近目标、扇形阵型、直线运动、标准碰撞 | 否，只能引用 |
| Modifier | EnginePlugin + 局内构筑 | 双重发射、增加穿透、命中分裂 | 否，只能引用和叠层 |

Primitive（原语，即实现一种可复用规则的可信本地处理器）与其参数 Schema 一同注册。多个内置或 AI 武器可以引用同一个 Primitive。

Modifier（修饰器，即在固定阶段变换已解析武器计划的可信局内规则）不能由 AI 定义实现。AI 只可以在蓝图中声明兼容性或建议构筑标签；玩家在局内获得 Modifier 后，由游戏本地代码应用。

一个 EnginePlugin 可以按模块职责注册一组相关原语，例如“基础投射物插件”同时注册直线运动、标准碰撞和圆形渲染。规范不要求为每个数值、每个 ID 建立独立 class 或文件；拆分边界以是否拥有独立规则、参数 Schema、兼容性和成本模型为准。

## 4. 原语 Registry

投射物武器第一阶段需要以下 Registry：

| Registry | 引用字段 | 职责 | 当前已注册 |
| --- | --- | --- | --- |
| Weapon Delivery | `delivery.primitiveId` | 弹体、区域、光环、延迟打击或近战挥击的实体语义 | `builtin.delivery.projectile`、`zone`、`aura`、`strike`、`swing` |
| Weapon Trigger | `trigger.primitiveId` | 何时触发一次施放 | `builtin.trigger.cooldown`、`builtin.trigger.charge` |
| Targeting | `targeting.primitiveId` | 选择目标或方向 | `nearest`、`facing`、`lowest-hp`、`random-seeded`、`cluster` |
| Cast Origin | `emission.origin.primitiveId` | 从玩家、法器挂点、目标地面或其他可信来源计算施放点 | `builtin.origin.player`、`builtin.origin.focus-relic`、`builtin.origin.target-ground` |
| Emission Schedule | `emission.schedule.primitiveId` | 单次或固定时间轴连发 | `builtin.emission.single`、`builtin.emission.burst` |
| Emission Pattern | `emission.pattern.primitiveId` | 把数量映射为生成方向和偏移 | `single`、`fan`、`ring`、`spiral` |
| Projectile Motion | `projectile.motion.primitiveId` | 每帧更新运动 | `straight`、`stationary`、`orbit-player`、`homing`、`accelerating`、`return` |
| Collision Behavior | `projectile.collision.primitiveId` | 地图、敌人与穿透处理 | `standard`、`segment`、`sector`、`area-periodic`、`wall-bounce`、`terrain-stop` |
| Hit Effect | `projectile.hitEffects[]` | 命中后的规则效果 | `damage`、`knockback`、`slow`、`burn`、`chain`、`area-damage` |
| Projectile Lifecycle | `projectile.lifecycle[]` | 命中或到期时派生行为 | `split-on-hit`、`split-on-expire`、`bounce` |
| Render Primitive | `projectile.visual.*.primitiveId` | 不创建实体的形状、轨迹和静态视觉层 | `circle`、`ring`、`beam`、`arc`、`sprite` |
| Particle Effect | `projectile.visual.emitters[]` | 在可信视觉事件点创建受预算约束的粒子实体 | `trail`、`hit-burst`、`explosion`、`telegraph`、`shockwave` |
| Weapon Feedback | `feedback[]` | 向表现系统发送白名单音效或镜头请求 | `builtin.audio.cue`、`builtin.camera.impulse` |
| Weapon Modifier | 局内 Modifier 栈 | 在固定阶段变换运行计划 | `builtin.modifier.double-shot`、`builtin.modifier.piercing` |

原语 ID 使用稳定命名空间。AI 内容可以引用 `builtin.*`，但不能覆盖、别名化或在自己的 Pack 中声明新的处理器 ID。

## 5. AI 可见的 Capability Catalog

Capability Catalog（能力目录，即从冻结 Registry 导出的、只包含公开描述和约束的 AI 上下文）不得暴露函数实现。

概念结构：

```ts
interface PrimitiveDescriptorV1 {
  id: string
  version: string
  kind:
    | 'trigger'
    | 'delivery'
    | 'targeting'
    | 'cast-origin'
    | 'emission-schedule'
    | 'emission-pattern'
    | 'projectile-motion'
    | 'collision'
    | 'hit-effect'
    | 'lifecycle'
    | 'render'
    | 'particle'
    | 'feedback'
  name: string
  description: string
  parameterSchema: {
    schemaId: string
    allowedKeys: string[]
    numericBounds: Record<string, { min: number; max: number }>
    enumValues: Record<string, string[]>
  }
  compatibility: {
    requires?: string[]
    conflictsWith?: string[]
    tags: string[]
  }
  budget: {
    category: 'constant' | 'per-projectile' | 'per-hit' | 'area-query'
    baseCost: number
    variableCosts: string[]
  }
}
```

`parameterSchema` 是描述性目录；本地 Validator 的封闭 Schema 才是裁决真值。未知参数必须拒绝，不能因为 Prompt 中没有列出就静默忽略。

## 6. 投射物武器配方

ContentPack 中的 `WeaponBlueprintV1.recipe` 使用以下概念结构：

```ts
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

interface PrimitiveRefV1 {
  primitiveId: string
  params: Record<string, JsonValue>
}

interface ProjectileWeaponRecipeV1 {
  recipeVersion: 1
  delivery: 'projectile' | PrimitiveRefV1
  trigger: PrimitiveRefV1
  targeting: PrimitiveRefV1
  emission: {
    emitterId: 'builtin.emitter.projectile'
    schedule?: PrimitiveRefV1
    origin: PrimitiveRefV1
    count: number
    burstCount: number
    burstInterval: number
    pattern: PrimitiveRefV1
  }
  feedback?: PrimitiveRefV1[]
  projectile: {
    damage: number
    radius: number
    speed: number
    lifetime: number
    pierce: number
    knockback: number
    motion: PrimitiveRefV1
    collision: PrimitiveRefV1
    hitEffects: PrimitiveRefV1[]
    lifecycle: PrimitiveRefV1[]
    visual: ProjectileVisualRecipeV1
  }
  modifierPolicy: {
    allowedIds: string[]
    deniedIds: string[]
  }
}

interface ProjectileVisualRecipeV1 {
  body: PrimitiveRefV1
  palette: {
    primary: string
    secondary?: string
    accent?: string
  }
  scale: number
  opacity: number
  glow?: { color: string; radiusScale: number; intensity: number }
  layers: PrimitiveRefV1[]
  trail?: PrimitiveRefV1
  particles?: PrimitiveRefV1
  emitters?: PrimitiveRefV1[]
}
```

要求：

- `recipeVersion` 与 ContentPack `schemaVersion` 分开演进。
- `delivery: "projectile"` 是兼容写法；新配方应引用已注册 Delivery 原语，ContentPack 的 `family` 必须与编译结果一致。
- `PrimitiveRefV1.params` 必须通过所引用原语的封闭 Schema；禁止未知字段。
- `count * burstCount` 是一次施放的直接生成数，必须以整数预算校验。
- `emission.origin` 只计算施放点，不得读取内容 ID 或直接生成弹体。
- 运行计划必须保留独立瞄准角；`speed: 0` 与 `motion.stationary` 不能让线段、扇区、光束或圆弧退化为固定世界方向。
- `radius` 是规则碰撞半径；`visual.scale` 只控制展示，二者不能互相覆盖。
- `hitEffects` 与 `lifecycle` 有数量上限，按数组顺序确定执行顺序。
- `visual.body`、`layers`、`trail` 和 `particles` 只引用可信渲染原语；颜色与几何参数由内容提供，但不能包含 SVG/XML、CSS、Shader 或模块路径。
- `visual.emitters` 最多包含 4 个 Particle Effect，其中最多一个持续拖尾；支持 `spawn`、`trail`、`hit`、`kill` 和 `expire` 事件。
- Particle Effect 只能创建视觉粒子，不能施加伤害、击退、状态、掉落或修改战斗实体；链电、爆炸等同名战斗规则仍必须引用对应可信 HitEffect、Lifecycle 或 Modifier。
- 渲染原语不得读取或修改伤害、碰撞、掉落和随机数等规则状态。
- `allowedIds` 不能授予 Registry 中不存在或与配方不兼容的 Modifier。
- Modifier 的 `conflictsWith` 可以引用其他 Modifier 或当前配方原语；例如 `orbital-core` 与 `motion.orbit-player` 冲突，避免运行时覆盖配方声明的环绕参数。
- `deniedIds` 用于表达明确冲突；本地 Modifier Registry 的冲突声明仍拥有最终决定权。
- `emission.schedule` 与兼容字段 `burstCount` / `burstInterval` 必须精确一致；Burst 最少间隔 0.03 秒，运行时单帧最多追赶两次齐射。
- `area-periodic` 必须声明 `tickInterval` 和 `maxTargetsPerTick`；同一敌人使用池化冷却 Map，不能靠无限 `hitEnemies` 集合重复命中。
- Zone、Aura、Strike 和 Swing 的 Delivery Descriptor 通过 `requires` 约束对应的 Origin、Stationary Motion 与 Collision 组合。
- `feedback` 最多 6 项，只能发送类型化表现事件；静音设置和 `prefers-reduced-motion` 分别裁决音效与镜头冲击。

## 7. 真实样板与 AI 参数所有权

首个样板使用现有“魔法法器”的真实内置 Recipe。该 Recipe 必须由当前游戏直接编译和执行，并保持现有数值、升级、碰撞与视觉结果；Prompt 所需示例从这份 Recipe 投影，不能复制成另一份手写 JSON。

在这个合同中：

- 应用提供冷却触发、最近目标、发射阵型、直线运动、标准碰撞、伤害和通用渲染等原语实现。
- 内置 Recipe 提供魔法法器当前的数值、资源引用与展示参数。
- AI Recipe 可以在 Schema 与预算内提供自己的颜色、尺寸、速度、数量、阵型参数和视觉层组合。
- 应用不得因为 AI 选择了某个颜色、数量或外观而新增武器 ID、`fireXxx`、碰撞分支或 Renderer 分支。
- AI 不得提供原语实现；如果现有原语无法表达某种规则，该候选必须被拒绝，而不是降级为动态代码。

内置样板和 AI 候选都是数据，不包含发射循环、碰撞代码或 Modifier 变换规则。

## 8. Modifier 合同

Modifier Handler（修饰器处理器，即由 EnginePlugin 注册、在指定阶段变换运行计划的可信函数）拥有以下概念合同：

```ts
type ModifierPhase =
  | 'stat-additive'
  | 'stat-multiplicative'
  | 'emission-structural'
  | 'projectile-structural'
  | 'hit-effect'
  | 'lifecycle'

interface ModifierDescriptorV1 {
  id: string
  phase: ModifierPhase
  maxStacks: number
  conflictsWith: string[]
  compatibleTags: string[]
  description: string
}

interface TrustedModifierHandler {
  descriptor: ModifierDescriptorV1
  supports(plan: Readonly<WeaponRuntimePlan>): boolean
  apply(plan: MutablePlanBuilder, stacks: number): void
  estimateCost(plan: Readonly<WeaponRuntimePlan>, stacks: number): number
}
```

规则：

- ContentPack 不保存 `apply`、字段路径、公式或 Patch。
- Modifier 按固定 `phase` 顺序执行，同阶段按稳定 ID 排序；获得顺序不得改变最终规则。
- `double-shot` 由本地 Handler 改变发射数量或阵型，不允许 AI 输出 `count *= 2` 表达式。
- `piercing` 由本地 Handler 增加标准碰撞策略的穿透能力；不兼容碰撞策略必须拒绝该升级选项。
- 每个 Modifier 声明最大层数、冲突和成本；商店不得提供当前计划无法安全应用的选项。
- 应用后重新计算平衡与性能预算。超过设计上限时不静默截断数值，应阻止获得并向 UI 返回稳定原因。

概念装配结果：

```text
基础计划
  → double-shot：按本地规则变换发射数量
  → piercing：按本地规则增加标准碰撞的穿透层数
  → 预算检查
  → 冻结运行计划
```

## 9. WeaponRecipeCompiler

WeaponRecipeCompiler（武器配方编译器，即在非热路径把声明式配方解析成只读执行计划的本地服务）执行：

```text
已验证 WeaponRecipe
  → 解析全部 PrimitiveRef
  → 生成基础 PlanBuilder
  → 应用武器等级成长
  → 按固定阶段应用 Modifier 栈
  → 计算最坏情况弹幕与查询成本
  → 绑定已解析 Handler 和参数
  → 冻结 WeaponRuntimePlan
```

概念输出：

```ts
interface WeaponRuntimePlan {
  definitionId: string
  delivery: ResolvedDelivery
  trigger: ResolvedTrigger
  targeting: ResolvedTargeting
  emission: ResolvedEmission
  projectileFactory: ResolvedProjectileFactory
  feedback: ResolvedFeedback[]
  modifierStacks: ReadonlyMap<string, number>
  budget: ResolvedWeaponBudget
}
```

运行计划不是持久化协议，不写入 Storage，也不能跨引擎版本复用。保存的是原始、已接受的 ContentPack 和局内 Modifier 状态；启动或安全检查点使用当前兼容引擎重新编译。

## 10. 热路径规则

帧循环只允许：

- 检查已解析 Trigger。
- 使用已绑定 Targeting 和 Emission Handler 生成确定性发射命令。
- 从对象池获取 Projectile。
- 使用已解析 Motion、Collision、HitEffect 和 Lifecycle Handler 更新实体。
- 读取不可变参数和局内实体状态。

帧循环不得：

- 解析或遍历原始 ContentPack JSON。
- 按字符串查找 Registry。
- 动态构造函数、导入模块或调用 AI。
- 为每颗子弹创建闭包、Schema 对象或临时配置图。
- 使用系统时间或无种子的随机源改变规则结果。

新原语的随机分支必须使用 Kernel 注入的种子 RNG，并使用稳定子流或实体序号，避免粒子等视觉随机改变战斗随机序列。

## 11. 平衡与性能预算

至少计算：

- `directProjectilesPerCast = count * burstCount`。
- 冷却、充能与 Burst 时间轴下的每秒直接生成量。
- 生命周期原语可能产生的最大子代数量和最大派生深度。
- `lifetime / cooldown` 下的理论同时在场数量。
- Homing、Area Hit、Chain 等每颗弹幕的查询成本。
- HitEffect 与视觉粒子的最坏触发次数。
- 拖尾按理论弹体并发量计算；命中/击杀按最大穿透次数计算；到期按直接弹体生成率计算。
- 当前单武器上限为每秒 320 个粒子、理论同时在场 480 个粒子，运行时仍受全局 800 粒子硬上限保护。
- Modifier 满层后的一级和满级计划。
- 单次施放最多 96 个理论派生弹体，单次命中的效果伤害倍数上限为 64；两者都在接受与升级前重新计算。
- 周期区域的最坏命中次数同时乘以生命周期内 Tick 上限和 `maxTargetsPerTick`，并计入伤害、粒子和反馈预算。
- Audio Cue 在音频系统按 Cue 节流；Camera Impulse 合并到现有镜头震动上限，并尊重系统减少动态效果偏好。

禁止无界递归分裂。Lifecycle 原语必须声明：

- 每次最多生成多少子代。
- 最大派生深度。
- 是否只允许首次命中触发。
- 是否继承父弹的 Lifecycle。

运行时硬上限触发时，采用确定性准入策略：按施放序号和子弹索引从小到大生成，容量耗尽后拒绝后续生成，并记录可聚合的诊断计数。不能随机丢弃或突破对象池上限。

## 12. 校验顺序

武器配方按以下顺序校验：

1. `recipeVersion` 和 `delivery`。
2. 封闭字段、JSON 类型和有限数。
3. Primitive 与 Modifier ID 引用。
4. 每个原语的参数 Schema。
5. Primitive、效果和 Modifier 兼容性。
6. 基础数值边界。
7. 一级、满级和 Modifier 满层的组合预算。
8. 最大弹幕、派生深度、范围查询和视觉预算。
9. 编译器能否产生完整、无未解析引用的运行计划。

推荐稳定错误码：

```text
UNKNOWN_PRIMITIVE
UNKNOWN_PRIMITIVE_PARAM
MISSING_PRIMITIVE_PARAM
INVALID_PRIMITIVE_PARAM
INCOMPATIBLE_PRIMITIVES
UNKNOWN_MODIFIER
MODIFIER_CONFLICT
MODIFIER_NOT_SUPPORTED
PROJECTILES_PER_CAST_EXCEEDED
PROJECTILE_CONCURRENCY_EXCEEDED
PARTICLE_BUDGET_EXCEEDED
LIFECYCLE_DEPTH_EXCEEDED
WEAPON_BUDGET_EXCEEDED
RUNTIME_PLAN_UNRESOLVED
```

## 13. Storage 与单局装配

Storage 保存：

- 玩家接受的完整 WeaponBlueprint 与 WeaponRecipe。
- ContentPack、内容 Schema 和配方版本。
- AI 来源、Prompt 版本和接受时间。
- 当前内容包启用状态。
- 若支持单局恢复，则保存 Modifier ID 与层数，不保存 Handler 或运行计划。

Storage 不保存：

- `WeaponRuntimePlan`。
- 函数、闭包、模块路径或 Registry 对象。
- 可从配方和版本重新计算的成本缓存。
- 每颗子弹的普通帧状态；除非未来 RunCheckpoint 明确要求并有独立预算。

运行时流程：

```text
读取 AppState.contentLibrary
  → 迁移 ContentPack 与 WeaponRecipe
  → 完整校验
  → 构建冻结 Primitive Registry Snapshot
  → 编译启用武器的基础 Runtime Plan
  → 选择开局武器与随机种子
  → 根据局内等级和 Modifier 栈派生当前 Plan
  → 进入游戏
```

一局进行中不能因为内容库变化替换基础 Recipe。局内升级只能通过本地 Modifier 或成长规则生成新的冻结 Plan，并在明确的升级/安全检查点交换引用。

## 14. 第一阶段迁移顺序

1. 为 Trigger、Targeting、Cast Origin、Emission Pattern、Motion、Collision、HitEffect 和 Render Primitive 建立 Descriptor 与 Registry。
2. 实现通用 `builtin.emitter.projectile` 和 `WeaponRecipeCompiler`。
3. 注册 `cooldown`、`nearest`、`player/focus-relic origin`、`single/fan`、`straight`、`standard collision`、`damage/knockback`、`circle render` 首批原语。
4. 把魔法法器等价迁移为投射物 Recipe，保留旧实现用于对照，不改变数值和视觉。
5. 实现 `double-shot` 与 `piercing` 两个本地 Modifier Handler。
6. 把第二件现有投射物武器迁移为只增加 Recipe 数据、不增加 `WeaponType`、`fireXxx` 或 Renderer 分支的内容，验证组合能力。
7. 接入不预设具体颜色、数量或外观的 AI 武器候选，完成校验、预览、接受、Storage 和下一局装配闭环。

## 15. 第一阶段验收条件

- 至少一件现有投射物武器能无规则变化地编译为 `WeaponRuntimePlan`。
- 第二件现有投射物武器迁移后只保留 ContentPack/Recipe 数据，不增加内容专属执行分支。
- 颜色、半径、速度、数量和阵型能独立调整并正确进入预览与预算。
- AI 改变受限视觉参数与层组合时不需要新增内置武器、资产文件或内容专属 Renderer 分支。
- `double-shot` 和 `piercing` 可以组合，结果不受获得顺序影响。
- 未知参数、未知原语、冲突 Modifier 和超预算组合得到稳定错误。
- 同一 Recipe、Modifier 栈、引擎版本和随机种子产生相同战斗规则结果。
- 内容包禁用后不进入下一局快照，但不影响持有旧快照的当前单局。

## 16. P0/P1/P2 能力交付状态

以下能力已完成可信处理器、封闭参数 Schema、兼容性、静态最坏预算和运行时硬上限，并从当前 Capability Catalog 发布给 AI。

| 优先级 | 能力组 | 已发布原语 | 已落实的安全模型 |
| --- | --- | --- | --- |
| P0 | 发射调度 | `trigger.charge`、`emission.burst`、`pattern.spiral` | 单次/每秒生成上限、Burst 时间轴、暂停恢复 |
| P0 | 运动 | `motion.homing`、`motion.accelerating`、`motion.return` | 每帧查询成本、转向上限、目标失效回退 |
| P0 | 生命周期 | `lifecycle.split-on-hit`、`lifecycle.split-on-expire`、`lifecycle.bounce` | 子代数、派生深度、继承规则、全局弹体上限 |
| P0 | 命中规则 | `effect.slow`、`effect.burn`、`effect.chain`、`effect.area-damage` | 状态叠加、持续时间、链次数、范围查询预算 |
| P1 | 目标选择 | `target.lowest-hp`、`target.random-seeded`、`target.cluster` | 稳定排序、种子子流、聚类查询预算 |
| P1 | 交付模式 | `delivery.zone`、`delivery.aura`、`delivery.strike`、`delivery.swing` | 独立实体计划、命中间隔、地图与玩家跟随语义 |
| P1 | 碰撞 | `collision.area-periodic`、`collision.wall-bounce`、`collision.terrain-stop` | 重复命中冷却、反弹次数、地图查询预算 |
| P2 | 反馈与视听 | `render.sprite`、`particle.telegraph`、`particle.shockwave`、`audio.cue`、`camera.impulse` | 仅打包资源白名单、无障碍开关、频率与并发预算 |

后续新增原语仍按“合同与预算先于目录发布”的顺序推进。所有同名视觉效果与战斗规则继续分离，例如 `particle.explosion` 不能替代 `effect.area-damage`。
