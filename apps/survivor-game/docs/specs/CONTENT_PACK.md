# ContentPack 规范

> 状态：Draft Spec
>
> 规范版本：0.4
>
> 更新日期：2026-08-27

## 1. 目的

当前实现进度：武器 `ContentPackV1`、封闭字段 Validator、结构问题聚合、引用/数值/一级与满级最坏 Modifier、派生弹体、伤害、粒子和反馈预算校验、内容库接受事务和启动期动态武器装配已经落地。Cherry AI Forge 先规划并裁剪能力目录，再生成、归一化、最多修复一次、预览并由玩家接受 Projectile、Zone、Aura、Strike 或 Swing 武器；P0/P1/P2 的发射、运动、生命周期、命中、目标、交付、碰撞与视听原语均使用同一个 `WeaponRuntimePlan` 执行链。当前仍只支持一个 Pack 一件武器；怪物、行为图、版本迁移和包管理 UI 尚未完成。

第一版最多同时启用 6 个生成武器 Pack。达到上限时必须先通过未来的包管理入口禁用已有内容；不能继续安装并让开局选择界面或运行时预算无界增长。

ContentPack（内容包，即可以被验证、保存和安装的声明式玩法数据）是内置内容与 AI 生成内容进入游戏的唯一运行时协议。

应用不内置用于证明生成能力的固定示例内容。颜色、尺寸、速度、数量、名称、描述和受限视觉组合等实例值由内置内容或 AI ContentPack 提供；应用只拥有可信规则原语、校验、预算与确定性执行。

它解决以下问题：

- 内容与引擎行为实现解耦。
- AI 只能组合白名单原语，不能生成可执行代码。
- 同一生成结果可以保存、迁移、禁用和复现。
- 安装前统一检查结构、引用、平衡与性能预算。

本规范不定义 EnginePlugin 的代码接口，也不允许通过内容包扩展宿主权限。

## 2. 信任模型

所有 ContentPack 数据都必须视为不可信输入，包括：

- Cherry AI 返回的文本。
- 旧版本应用保存的数据。
- 未来可能支持的导入文件或网络响应。
- 开发阶段手写但尚未通过 Validator 的 JSON。

只有完成迁移并通过全部校验的内容包才能进入 Registry Snapshot。`source: "builtin"` 也不得绕过结构和引用校验；内置包可以在构建阶段完成同一检查。

## 3. 包级结构

以下是概念类型，字段命名和语义是协议的一部分；实现可以将其拆分到多个 TypeScript 文件。

```ts
interface ContentPackV1 {
  schemaVersion: 1
  id: string
  version: string
  source: 'builtin' | 'ai'
  status: 'draft' | 'accepted' | 'disabled' | 'archived'
  metadata: {
    name: string
    description: string
    createdAt: string
    updatedAt: string
    tags: string[]
  }
  engineCompatibility: {
    min: string
    maxExclusive?: string
  }
  weapons: WeaponBlueprintV1[]
  enemies: EnemyBlueprintV1[]
  attackProfiles: AttackProfileV1[]
  behaviorGraphs: BehaviorGraphV1[]
  provenance?: AiProvenanceV1
}

interface AiProvenanceV1 {
  task: 'weapon' | 'enemy' | 'behavior-mutation'
  modelSlot: 'default' | 'quick'
  promptVersion: string
  requestId: string
  acceptedAt: string
  parentPackId?: string
}
```

要求：

- `schemaVersion` 必须是受支持的整数版本。
- `id` 在用户内容库中必须唯一且创建后不可变。
- `version` 和引擎兼容范围必须使用合法 SemVer。
- 时间使用 ISO 8601 UTC 字符串，只用于展示和审计，不参与战斗规则。
- `draft` 不得进入游戏 Registry；只有 `accepted` 且启用的包可以生效。
- `provenance` 不得包含完整 Prompt、API Key、宿主私有信息或原始战斗日志。

## 4. ID 与命名空间

ID 必须由小写 ASCII 字母、数字、点、短横线和斜线组成，长度不超过 120 个字符，不允许空白、`..` 或前后斜线。

推荐格式：

```text
builtin.core
builtin.weapon.magic-wand
ai.<pack-id>
ai.<pack-id>/weapon/moon-echo
ai.<pack-id>/enemy/ash-priest
```

规则：

- 内置内容使用 `builtin.` 前缀。
- AI 内容使用所属 Pack 的命名空间。
- 一个 AI 内容包只能定义自己命名空间内的内容 ID。
- 第一版不支持 AI 内容包依赖另一个 AI 内容包；可以引用引擎 Registry 的内置原语。
- 重复 ID、大小写归一后冲突或覆盖内置 ID 必须拒绝整个包。

## 5. 武器蓝图

```ts
interface WeaponBlueprintV1 {
  id: string
  name: string
  description: string
  family: 'projectile' | 'strike' | 'aura' | 'orbit' | 'zone' | 'swing'
  recipe: ProjectileWeaponRecipeV1
  progression: {
    maxLevel: number
    perLevel: {
      damage?: number
      cooldown?: number
      projectileSpeed?: number
      projectileRadius?: number
      count?: number
      pierce?: number
      lifetime?: number
      knockback?: number
    }
  }
  balance: {
    budgetTier: 1 | 2 | 3 | 4 | 5
    intendedRole: 'single-target' | 'area' | 'control' | 'defense' | 'hybrid'
  }
}
```

要求：

- `recipe` 的 Trigger、Targeting、Cast Origin、Emission、Motion、Collision、HitEffect、Lifecycle、Render 和 Modifier 引用必须存在于冻结的 Engine Registry。
- `family` 必须与 `recipe.delivery` 编译出的家族一致；当前可安装 Delivery 为 Projectile、Zone、Aura、Strike 和 Swing，Orbit 由已注册运动原语表达但尚无独立 Delivery。
- 所有数值必须是有限数，禁止 `NaN`、`Infinity` 和隐式字符串转换。
- 冷却/充能/Burst 时间轴、数量、持续时间、穿透、周期命中数、范围和 Lifecycle 派生数量必须通过当前 Balance Policy 的硬边界。
- `progression.perLevel` 只能修改列出的白名单属性；一级、满级和兼容 Modifier 满层必须分别检查。
- AI 不得声明任意 on-hit 表达式、字段 Patch 或 Modifier 公式；效果只能引用注册的原语。
- 配方 Schema、原语目录、Modifier 装配顺序、运行时编译和示例见 [`WEAPON_RECIPE.md`](./WEAPON_RECIPE.md)。

## 6. 怪物蓝图

```ts
interface EnemyBlueprintV1 {
  id: string
  name: string
  description: string
  stats: {
    hp: number
    speed: number
    contactDamage: number
    radius: number
    reward: number
  }
  spawn: {
    unlockAfter: number
    weight: number
    eliteEligible: boolean
    bossEligible: boolean
  }
  behaviorGraphId: string
  attackProfileId?: string
  visual: VisualRecipeV1
  balance: {
    threatTier: 1 | 2 | 3 | 4 | 5
    role: 'swarm' | 'chaser' | 'ranged' | 'tank' | 'disruptor' | 'boss'
  }
}
```

要求：

- HP、速度、伤害、半径和奖励必须同时通过单项边界与组合威胁预算。
- `reward` 由本地策略根据威胁预算复核，AI 值只作为候选。
- 生成时间和权重必须遵守同时在场数量与远程压力上限。
- Boss 必须引用明确允许 Boss 使用的行为图和攻击 Profile。

## 7. 攻击 Profile

```ts
interface AttackProfileV1 {
  id: string
  range: number
  preferredRange: number
  retreatRange: number
  cooldown: number
  windup: number
  projectileSpeed: number
  projectileRadius: number
  damageRatio: number
  patternIds: string[]
  maxProjectilesPerCast: number
}
```

要求：

- `patternIds` 只能引用 Engine Registry 中注册的 Pattern。
- `windup` 必须大于当前公平性策略规定的最小值。
- `maxProjectilesPerCast` 必须同时满足 Pattern 声明和全局敌方弹幕上限。
- `retreatRange <= preferredRange <= range`。
- Pattern 组合必须有确定顺序；运行时不得再次请求 AI 选择下一招。

## 8. BehaviorGraph

BehaviorGraph 是有限状态图，不是通用脚本语言。

```ts
interface BehaviorGraphV1 {
  id: string
  initialState: string
  states: Array<{
    id: string
    action: BehaviorActionV1
    duration?: number
    transitions: Array<{
      to: string
      when: BehaviorConditionV1
      priority: number
    }>
  }>
}

type BehaviorConditionV1 =
  | { type: 'always' }
  | { type: 'distance'; operator: 'lt' | 'lte' | 'gt' | 'gte'; value: number }
  | { type: 'hp-ratio'; operator: 'lt' | 'lte' | 'gt' | 'gte'; value: number }
  | { type: 'cooldown-ready'; slot: string }
  | { type: 'elapsed-in-state'; operator: 'gte'; value: number }
  | { type: 'seeded-chance'; probability: number; interval: number }

type BehaviorActionV1 =
  | { type: 'chase'; speedScale: number }
  | { type: 'strafe'; speedScale: number; direction: 'seeded' }
  | { type: 'retreat'; speedScale: number }
  | { type: 'hold' }
  | { type: 'windup'; telegraphId: string }
  | { type: 'dash'; speedScale: number; duration: number; cooldownSlot: string }
  | { type: 'phase'; duration: number; cooldownSlot: string }
  | { type: 'attack'; attackProfileId: string; cooldownSlot: string }
```

第一版不支持：

- 任意数学表达式或字符串表达式。
- 递归、子图调用、并行节点或无限循环。
- 读取任意全局状态、DOM、时间戳或宿主 API。
- 动态生成 Action/Condition ID。
- 直接创建任意数量实体；召唤动作需在后续规范版本中单独定义。

Validator 必须限制状态数、每状态转移数和每帧最大转移数，并验证所有目标状态可达、所有引用存在、至少存在一个有时间或冷却边界的执行路径。

## 9. 视觉配方

```ts
interface VisualRecipeV1 {
  baseAssetId: string
  palette: {
    primary: string
    secondary: string
    accent: string
  }
  scale: number
  outline?: string
  glow?: { color: string; radius: number }
  glyphId?: string
  particleRecipeId?: string
}
```

要求：

- `baseAssetId`、`glyphId`、`particleRecipeId` 必须引用已打包资产或注册配方。
- 不允许 URL、路径穿越、Data URL、SVG/XML 文本、CSS 或 Shader 源码。
- 颜色必须解析为允许的格式；透明度、缩放和光晕范围受性能边界限制。
- 视觉配方不得改变碰撞半径、伤害区域或其他规则真值。

## 10. 校验管线

内容包必须按以下顺序完整通过：

1. **Parse**：JSON 能被解析为未知数据。
2. **Schema**：字段、类型、长度、枚举和未知字段策略正确。
3. **Identity**：Pack 和内容 ID 合法、唯一且属于正确命名空间。
4. **Compatibility**：schema 和引擎版本兼容。
5. **References**：所有 Primitive、Modifier、Pattern、资产和内部引用存在且兼容。
6. **Recipe**：武器配方可以解析并编译为无悬空引用的只读运行计划。
7. **Graph**：状态图有界、可达且不会在单帧无限转移。
8. **Numbers**：所有数字有限并处于硬边界。
9. **Balance**：一级、满级、Modifier 满层、组合威胁和奖励预算通过。
10. **Performance**：弹幕、派生深度、召唤、范围查询、粒子和同时在场预算通过。
11. **Policy**：文本长度、保留名称和内容安全策略通过。

任何错误都拒绝整个包。Validator 返回稳定错误码、字段路径和面向用户的简短原因；不得只返回模型生成的解释。

## 11. 生命周期

```text
draft
  → validated preview
  → accepted
  → enabled in next Registry Snapshot
  → disabled
  → archived/deleted
```

- AI 响应最初只能形成 `draft`。
- 玩家接受后才设置 `accepted` 并持久化。
- 启用、禁用和删除在下一局或显式安全检查点生效。
- 正在运行的一局持有不可变 Registry Snapshot，不因内容库变化而改变。
- 删除前必须检查当前单局、构筑和其他保存对象的引用；必要时先禁用并在安全点清理。

## 12. 迁移与失败恢复

- 每个旧 `schemaVersion` 必须通过纯函数迁移到下一版本，不能跳过未知版本。
- 迁移前保留原始 JSON；迁移失败不得覆盖原文档。
- 不支持的未来版本进入只读禁用状态，并向用户显示升级提示。
- AI 生成内容不因为 Prompt 更新而自动重生成。
- 内容包升级必须产生新版本；不得静默修改已接受版本的规则字段。

## 13. 首版验收条件

- 现有一件内置投射物武器可以无行为变化地表示为 ContentPack + WeaponRecipe。
- 第二件现有投射物武器迁移后只保留配方数据，不增加内容专属执行分支。
- 未知 Primitive、冲突 Modifier、越界数值、重复 ID 和图循环能被稳定拒绝。
- AI Draft 无法绕过玩家确认进入 Registry。
- Registry Snapshot 创建后不可被 Content Library 原地修改。
- 保存并重新加载后，已接受内容保持完全相同的规则字段。
