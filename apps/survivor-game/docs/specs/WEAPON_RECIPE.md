# WeaponRecipe 与弹幕原语规范

> 状态：Draft Spec
>
> 规范版本：0.1
>
> 更新日期：2026-08-27

## 1. 目的与当前边界

WeaponRecipe（武器配方，即用项目提供的原子能力和受限参数描述一件武器的数据）定义 AI 如何组合武器与子弹，而不为每件新武器生成代码。

目标示例是：AI 可以声明“一次发射三颗红色、半径 8、速度 420 的直线子弹”，局内获得“双重发射”和“穿透弹”后，由本地规则把它装配为六颗、具有两层穿透的子弹。

当前代码中的 `builtin.weapon.magic-wand`、`builtin.weapon.fire-wand` 等 `behaviorId` 是迁移期兼容适配器。它们完成了从 `WeaponType switch` 到 Registry 分发的第一步，但仍然是一件武器对应一个较粗行为，不是最终原子层。

本规范第一阶段只要求打通普通玩家投射物武器。Aura、Orbit、Strike、Zone、Swing 等交付模式在现有实现保持不变，等投射物配方闭环稳定后再扩展，避免一次性抽象所有武器。

## 2. 核心原则

1. **项目提供原语与策略，AI 只提供组合和参数。**
2. **参数不是引擎。** 颜色、半径、速度、数量和持续时间是有边界的数据；追踪、扇形、穿透、分裂和反弹等包含规则的能力才注册为原语。
3. **内容不能携带函数。** ContentPack 中不得出现 JavaScript、表达式、模块路径、JSON Patch、任意字段路径或动态导入。
4. **组合先解析后运行。** 配方在安装和开局时解析为只读 `WeaponRuntimePlan`，帧循环不解析 JSON、不按字符串寻找 Handler。
5. **Modifier 由本地代码变换计划。** AI 可以引用 Modifier，不能描述 Modifier 如何改写运行时对象。
6. **组合顺序固定。** 同一引擎版本、配方、Modifier 栈和随机种子必须产生相同结果。
7. **预算双重防线。** 安装/升级前做静态预算；运行时仍保留确定性的实体与弹幕硬上限。

## 3. 三种基本概念

| 概念 | 所有者 | 示例 | 是否由 AI 新增 |
| --- | --- | --- | --- |
| Parameter | ContentPack | `color: "#ff3b30"`、`speed: 420`、`count: 3` | 是，在边界内赋值 |
| Primitive | EnginePlugin | 最近目标、扇形阵型、直线运动、标准碰撞 | 否，只能引用 |
| Modifier | EnginePlugin + 局内构筑 | 双重发射、增加穿透、命中分裂 | 否，只能引用和叠层 |

Primitive（原语，即实现一种可复用规则的可信本地处理器）与其参数 Schema 一同注册。多个内置或 AI 武器可以引用同一个 Primitive。

Modifier（修饰器，即在固定阶段变换已解析武器计划的可信局内规则）不能由 AI 定义实现。AI 只可以在蓝图中声明兼容性或建议构筑标签；玩家在局内获得 Modifier 后，由游戏本地代码应用。

一个 EnginePlugin 可以按模块职责注册一组相关原语，例如“基础投射物插件”同时注册直线运动、标准碰撞和圆形渲染。规范不要求为每个数值、每个 ID 建立独立 class 或文件；拆分边界以是否拥有独立规则、参数 Schema、兼容性和成本模型为准。

## 4. 原语 Registry

投射物武器第一阶段需要以下 Registry：

| Registry | 引用字段 | 职责 | 首批原语示例 |
| --- | --- | --- | --- |
| Weapon Trigger | `trigger.primitiveId` | 何时触发一次施放 | `builtin.trigger.cooldown` |
| Targeting | `targeting.primitiveId` | 选择目标或方向 | `builtin.target.nearest`、`builtin.target.facing` |
| Emission Pattern | `emission.pattern.primitiveId` | 把数量映射为生成方向和偏移 | `builtin.pattern.single`、`builtin.pattern.fan`、`builtin.pattern.ring` |
| Projectile Motion | `projectile.motion.primitiveId` | 每帧更新运动 | `builtin.motion.straight`、`builtin.motion.homing`、`builtin.motion.orbit` |
| Collision Behavior | `projectile.collision.primitiveId` | 地图、敌人与穿透处理 | `builtin.collision.standard` |
| Hit Effect | `projectile.hitEffects[]` | 命中后的规则效果 | `builtin.effect.damage`、`builtin.effect.knockback` |
| Projectile Lifecycle | `projectile.lifecycle[]` | 生成、命中、到期或死亡时派生行为 | `builtin.lifecycle.split-on-hit`、`builtin.lifecycle.return` |
| Render Primitive | `projectile.visual.*Id` | 形状、轨迹、光晕和粒子 | `builtin.shape.orb`、`builtin.trail.comet` |
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
    | 'targeting'
    | 'emission-pattern'
    | 'projectile-motion'
    | 'collision'
    | 'hit-effect'
    | 'lifecycle'
    | 'render'
    | 'modifier'
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
  delivery: 'projectile'
  trigger: PrimitiveRefV1
  targeting: PrimitiveRefV1
  emission: {
    emitterId: 'builtin.emitter.projectile'
    count: number
    burstCount: number
    burstInterval: number
    pattern: PrimitiveRefV1
  }
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
  shapeId: string
  primaryColor: string
  secondaryColor?: string
  scale: number
  opacity: number
  glow?: { color: string; radius: number; intensity: number }
  trailId?: string
  particleRecipeId?: string
}
```

要求：

- `recipeVersion` 与 ContentPack `schemaVersion` 分开演进。
- 第一版只接受 `delivery: "projectile"`；其他值必须拒绝，不能推测降级。
- `PrimitiveRefV1.params` 必须通过所引用原语的封闭 Schema；禁止未知字段。
- `count * burstCount` 是一次施放的直接生成数，必须以整数预算校验。
- `radius` 是规则碰撞半径；`visual.scale` 只控制展示，二者不能互相覆盖。
- `hitEffects` 与 `lifecycle` 有数量上限，按数组顺序确定执行顺序。
- `allowedIds` 不能授予 Registry 中不存在或与配方不兼容的 Modifier。
- `deniedIds` 用于表达明确冲突；本地 Modifier Registry 的冲突声明仍拥有最终决定权。

## 7. 示例：三颗红色子弹

```json
{
  "recipeVersion": 1,
  "delivery": "projectile",
  "trigger": {
    "primitiveId": "builtin.trigger.cooldown",
    "params": { "cooldown": 1.2 }
  },
  "targeting": {
    "primitiveId": "builtin.target.nearest",
    "params": { "range": 720 }
  },
  "emission": {
    "emitterId": "builtin.emitter.projectile",
    "count": 3,
    "burstCount": 1,
    "burstInterval": 0,
    "pattern": {
      "primitiveId": "builtin.pattern.fan",
      "params": { "spreadRadians": 0.28 }
    }
  },
  "projectile": {
    "damage": 12,
    "radius": 8,
    "speed": 420,
    "lifetime": 2,
    "pierce": 0,
    "knockback": 24,
    "motion": {
      "primitiveId": "builtin.motion.straight",
      "params": {}
    },
    "collision": {
      "primitiveId": "builtin.collision.standard",
      "params": { "stopOnMap": true }
    },
    "hitEffects": [
      {
        "primitiveId": "builtin.effect.damage",
        "params": { "damageScale": 1 }
      }
    ],
    "lifecycle": [],
    "visual": {
      "shapeId": "builtin.shape.orb",
      "primaryColor": "#ff3b30",
      "scale": 1,
      "opacity": 1,
      "glow": { "color": "#ff6b5f", "radius": 10, "intensity": 0.7 },
      "trailId": "builtin.trail.comet"
    }
  },
  "modifierPolicy": {
    "allowedIds": [
      "builtin.modifier.double-shot",
      "builtin.modifier.piercing"
    ],
    "deniedIds": []
  }
}
```

该 JSON 是数据，不包含发射循环、碰撞代码或 Modifier 变换规则。

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

示例装配结果：

```text
基础：count=3, burstCount=1, pierce=0
  → double-shot ×1：count=6
  → piercing ×2：pierce=2
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
  trigger: ResolvedTrigger
  targeting: ResolvedTargeting
  emission: ResolvedEmission
  projectileFactory: ResolvedProjectileFactory
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
- 冷却与 Burst 间隔下的每秒直接生成量。
- 生命周期原语可能产生的最大子代数量和最大派生深度。
- `lifetime / cooldown` 下的理论同时在场数量。
- Homing、Area Hit、Chain 等每颗弹幕的查询成本。
- HitEffect 与视觉粒子的最坏触发次数。
- Modifier 满层后的一级和满级计划。

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
INCOMPATIBLE_PRIMITIVES
UNKNOWN_MODIFIER
MODIFIER_CONFLICT
MODIFIER_NOT_SUPPORTED
PROJECTILES_PER_CAST_EXCEEDED
PROJECTILE_CONCURRENCY_EXCEEDED
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

1. 为 Trigger、Targeting、Emission Pattern、Motion、Collision、HitEffect 和 Render Primitive 建立 Descriptor 与 Registry。
2. 实现通用 `builtin.emitter.projectile` 和 `WeaponRecipeCompiler`。
3. 注册 `cooldown`、`nearest`、`single/fan`、`straight`、`standard collision`、`damage`、`orb` 首批原语。
4. 把魔法法器等价迁移为投射物 Recipe，保留旧实现用于对照，不改变数值和视觉。
5. 实现 `double-shot` 与 `piercing` 两个本地 Modifier Handler。
6. 用第二件只增加 Recipe 数据、不增加 `WeaponType`、`fireXxx` 或 Renderer 分支的武器验证组合能力。
7. 接入 AI 生成“三颗红色子弹”类候选，完成校验、预览、接受、Storage 和下一局装配闭环。

## 15. 第一阶段验收条件

- 至少一件现有投射物武器能无规则变化地编译为 `WeaponRuntimePlan`。
- 第二件测试武器只增加 ContentPack 数据，不增加内容专属执行分支。
- 颜色、半径、速度、数量和阵型能独立调整并正确进入预览与预算。
- `double-shot` 和 `piercing` 可以组合，结果不受获得顺序影响。
- 未知参数、未知原语、冲突 Modifier 和超预算组合得到稳定错误。
- 同一 Recipe、Modifier 栈、引擎版本和随机种子产生相同战斗规则结果。
- 内容包禁用后不进入下一局快照，但不影响持有旧快照的当前单局。
