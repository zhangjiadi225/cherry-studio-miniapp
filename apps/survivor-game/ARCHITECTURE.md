# 暗夜幸存者 — 当前架构

> 状态：Current
>
> 更新日期：2026-08-27
> 本文只描述已实现代码；未来方向见 [`docs/architecture/TARGET_ARCHITECTURE.md`](./docs/architecture/TARGET_ARCHITECTURE.md)。

## 1. 项目概览

暗夜幸存者是 TypeScript + Canvas 2D 实现的生存 Roguelike，没有使用游戏框架。Vite 负责开发与构建，Vitest 负责单元和数值测试。

当前产品包含：

- 9 分钟基础单局、三个难度和无尽继续。
- 10 种武器、两段进化选择、通用 Modifier 和被动技能。
- 8 种怪物、时间强化、精英、Boss、远程弹幕和多种攻击 Pattern。
- 商店、出售、补给、魂晶、星图元成长、角色皮肤和 Codex。
- 程序化地图、对象池、空间索引、音频与性能统计。
- Cherry 存储与 `app.visibilityChange` 的过渡接入。
- 单文档 `AppStateStore`、冻结 Registry、内置内容快照和武器行为分派。

AI Forge、ContentPack 校验/安装和 BehaviorGraph 尚未实现，不属于当前能力。当前 Registry 只注册内置武器施放行为与内置武器/怪物定义。

## 2. 当前目录

```text
survivor-game/
├── AGENTS.md
├── README.md
├── ARCHITECTURE.md
├── docs/
│   ├── product/                    # 产品方向
│   ├── architecture/               # 目标架构
│   └── specs/                      # 内容、AI、Cherry 协议
├── miniapp/
│   └── manifest.json               # 当前过渡 manifest
├── scripts/
│   └── package-miniapp-dev.sh      # 当前过渡打包脚本
├── public/
│   └── sprites/                    # 包内单位与武器图片
└── src/
    ├── main.ts                     # 启动、读取 AppState、装配内容、创建 Game
    ├── cherry.d.ts                 # 当前过渡 Bridge 类型
    ├── application/
    │   └── AppVersion.ts           # 当前 App 版本真值
    ├── content/
    │   ├── registry/               # 稳定 ID、可冻结 Registry
    │   └── runtime/                # 内置内容的只读运行时快照
    ├── platform/
    │   ├── AppHost.ts              # Browser/Cherry 存储与可见性适配
    │   └── AppStateStore.ts        # 版本化单文档状态与串行事务写入
    └── game/
        ├── Game.ts                 # 单局与桌面 UI 编排器
        ├── Renderer.ts             # Canvas 与渲染器代理
        ├── types.ts                # 共享实体、ID 和配置类型
        ├── constants.ts            # 全局常量与数据表 re-export
        ├── behaviors/              # 已注册的可信行为接口与稳定 ID
        ├── data/                   # 武器、怪物、难度、进化等数据
        ├── effects/                # 粒子与伤害飘字
        ├── events/                 # 类型化事件总线与状态机
        ├── renderers/              # 世界、实体、特效和 UI 绘制
        ├── systems/
        │   ├── audio/
        │   ├── camera/
        │   ├── combat/
        │   ├── enemy/
        │   ├── input/
        │   ├── map/
        │   ├── meta/
        │   ├── player/
        │   ├── upgrade/
        │   └── weapon/
        └── utils/                  # 数学、碰撞、对象池、空间网格
```

## 3. 当前分层

```text
main.ts
  ├─ AppHost：提供 Storage 与 Host 可见性
  ├─ AppStateStore：加载/迁移单一状态文档，串行持久化事务
  ├─ GameContentSnapshot：冻结内置行为、武器和怪物定义
  └─ Game：输入、状态、单局循环、系统调度、桌面 UI 流程
       ├─ systems：确定性玩法系统
       ├─ events：状态切换与跨系统通知
       ├─ Renderer：Canvas 与子渲染器
       ├─ effects：通用视觉实体
       └─ data/types/constants/utils：基础数据与算法
```

依赖总体从编排层指向系统和基础层。`Game.ts` 是有状态编排器，持有当前 World 数组、系统实例、MetaState 和 UI 流程。

## 4. 启动与宿主

`main.ts` 当前流程：

1. 创建 `AppHost`。
2. 读取稳定 Key `survivor-game:app-state` 中带 `stateVersion` 的文档；首次运行时读取三个旧 Key 并迁移，但不删除旧值。
3. 把 AppState 的内容库槽位交给装配器，通过核心 `EnginePlugin` 注册武器行为，再装配冻结的武器/怪物内容快照。当前若状态尝试启用尚不受支持的外部内容包，会阻止启动而不是静默加载。
4. 创建 `Game`，注入内容快照和 AppState 持久化回调。
5. 将 Host 可见性事件转发给 `Game.setHostVisible`。
6. 启动失败时显示可点击重试提示。

`AppHost` 当前有两种实现：

- Cherry：直接使用全局 `cherry.storage` 和 `cherry.on`。
- Browser：使用 `localStorage` 和浏览器 `visibilitychange`。

这是过渡实现。它尚未使用 `@cherry-miniapp/kit`，类型只覆盖 Storage 和 Visibility，也没有 AI、权限或能力探测。目标约束见 [`docs/specs/CHERRY_RUNTIME.md`](./docs/specs/CHERRY_RUNTIME.md)。

## 5. Game 编排器

`Game` 负责：

- 注册键盘、鼠标和触控输入。
- 管理桌面 Tab、皮肤、星图、Codex、开局武器和难度。
- 持有 Player、Enemy、Projectile、EnemyProjectile、XPGem、Particle 和 DamageNumber 数组。
- 运行 `requestAnimationFrame` 循环。
- 调度玩家、生成器、敌人、敌方攻击、武器、战斗、地图、经验和死亡处理。
- 调度升级商店、局终奖励、无尽模式、渲染和性能统计。

主更新顺序：

```text
更新时间/难度/目标
  → 玩家与镜头
  → Spawner
  → 敌人移动与接触伤害
  → 敌方弹幕
  → 敌人攻击施放
  → 重建 Enemy SpatialGrid
  → 玩家武器
  → 光环
  → ProjectileCombat
  → 死亡、掉落与分裂
  → 经验收集和升级队列
  → 粒子/飘字清理
  → 玩家死亡或时间结束
```

`dt` 上限为 0.05 秒；Host 不可见时停止 RAF，恢复时重置 `lastTime`，避免隐藏时长形成大步长。

## 6. 游戏系统

| 系统 | 当前职责 |
| --- | --- |
| `player` | 创建、移动、属性重算、受伤、魂晶与经验、XP Gem |
| `enemy` | 创建、追击/横移/撤退、强化 Trait、远程攻击、波次、精英与 Boss |
| `weapon` | 创建、升级、十种开火行为、弹幕移动、进化与升级选项 |
| `combat` | 玩家弹幕碰撞、Modifier 命中/击杀效果、地图和敌弹交互 |
| `upgrade` | 商店状态、选择、购买、刷新、出售和布局 |
| `meta` | 星图、皮肤、难度、局终奖励、序列化与容错加载 |
| `map` | 障碍生成、可见查询、碰撞、弹幕阻挡和清理 |
| `input` | 键盘与触控摇杆 |
| `camera` | 跟随与震动 |
| `audio` | Web Audio 生命周期、事件音效与静音状态 |

大多数实体逻辑使用操作普通对象的函数；持有缓存或长期状态的模块使用 class，例如 `Game`、`Renderer`、`Spawner`、`MapSystem` 和 `ShopSystem`。

## 7. 武器与进化

武器基础数据在 `data/weapons.ts`，包括：

- `family`：projectile、strike、aura、orbit、zone、swing。
- 展示方式、行为标签和战斗标签。
- 一级属性、每级成长和最大等级。

每件内置武器现在声明稳定 `behaviorId`。启动时 `Weapon.ts` 把现有 `fireXxx` 注册为冻结的 `WeaponBehaviorHandler`，武器施放通过 Registry 查找处理器，不再用具体 `WeaponType` 的发射分支。弹幕更新仍按类型处理特殊移动。进化数据和视觉资产分别位于 `weaponEvolutions.ts` 与 `weaponEvolutionAssets.ts`。

这仍是粗粒度迁移层：`builtin.weapon.magic-wand` 等 ID 基本对应一件完整武器，而不是瞄准、阵型、运动、碰撞、命中和生命周期等可自由组合的原语。当前新增一种真正不同的武器仍可能需要修改类型、行为注册、弹幕更新和渲染；但多个内容定义已经可以复用同一个施放行为 ID。

目标是把颜色、大小、速度和数量保留为受限参数，把追踪、穿透、分裂、反弹等规则拆为可信原语，在非热路径编译成只读 `WeaponRuntimePlan`。Projectile Motion、Collision、HitEffect、Lifecycle、Modifier、Render Registry 与 WeaponRecipeCompiler 尚未实现，具体边界见 [`docs/specs/WEAPON_RECIPE.md`](./docs/specs/WEAPON_RECIPE.md)。

## 8. 怪物与攻击

怪物基础数据在 `data/enemies.ts`，每种怪物可以声明一个随时间解锁的 Enhancement：

- 属性倍率。
- `dash`、`shield`、`phase`、`split`、`burstCaster`、`charge` 或 `shadowCaster` Trait。

`Enemy.ts` 处理基础移动、远程敌人的距离控制、Trait 状态、地形碰撞和伤害减免。`EnemyAttack.ts` 已把弹幕招式抽象为 `EnemyAttackPattern`，当前包括单发、三连、扇形、环形、螺旋、十字和暗影弹幕。

攻击 Pattern 已接近可注册原语；但 Attack Profile 与具体 EnemyType/Trait 的选择仍是静态判断。目标迁移会先注册现有 Pattern，再让怪物蓝图按 ID 引用。

## 9. 数据与平衡

`constants.ts` 保存全局硬上限并 re-export `data/` 表。主要数据表：

- `weapons.ts`
- `weaponEvolutions.ts`
- `enemies.ts`
- `modifiers.ts`
- `passives.ts`
- `supplies.ts`
- `difficulty.ts`
- `runDifficulties.ts`
- `economy.ts`

当前平衡原则是数据驱动：数值调整优先修改数据，不把内容专属数字散落到编排器。AI 内容未来也必须先通过同一类确定性 Balance Policy，不能直接绕开现有上限。

## 10. 事件与状态机

`GameStateMachine` 管理：

```text
menu ↔ playing ↔ paused
          ↕
      upgrading
          ↓
       gameover
```

具体 transition 名称由状态机校验。`EventBus<GameEventMap>` 提供类型化通知，包括开始、结束、受伤、升级、敌人死亡、Boss、武器开火、Modifier、经验、暂停和恢复。

事件总线用于通知已发生事件。多数规则更新仍由 `Game` 明确调用系统完成，EventBus 不是依赖注入或命令总线。

## 11. 渲染

`Renderer` 持有 Canvas Context、尺寸与 `WorldRenderer`，将绘制委托给：

- `WorldRenderer`：背景、网格、边界和地图。
- `EntityRenderer`：玩家、武器展示、怪物、弹幕和经验。
- `EffectsRenderer`：粒子、飘字、受伤/升级闪光和 Boss 预警。
- `UIRenderer`：HUD、桌面、商店、暂停和结算。

`SpriteRegistry`、`PlayerSpriteRegistry` 和 `WeaponSpriteRegistry` 管理包内图片加载与查找。部分实体仍按具体类型选择绘制分支；目标架构会把可生成变化限制在安全视觉配方中。

## 12. 性能边界

当前实现已有：

- Enemy、Projectile、EnemyProjectile、XP Gem、Particle、DamageNumber 对象池。
- Enemy `SpatialGrid` 与 `EnemyQuery`，避免大范围 O(n²) 查询。
- Map 空间查询和可见缓存。
- 敌人、玩家弹幕、敌方弹幕、粒子和飘字硬上限。
- 批量压缩/释放死亡实体。

未来 ContentPack 和 BehaviorGraph 不得绕过这些边界。生成内容的弹幕、召唤、范围查询和视觉预算必须在安装前检查，运行时仍保留硬上限作为最后防线。

## 13. 当前持久化

当前持久化真值是稳定 Key `survivor-game:app-state` 下的 v1 文档，包含：

- `stateVersion`、`revision`、`savedAt`、`appVersion`。
- Meta 与设置。
- 尚未启用的 `contentLibrary` 和 `generationJobs` 存储槽位。

写入在 `AppStateStore` 内串行执行，并在序列化后检查 UTF-8 字节预算。首次找不到主文档时会读取旧 Meta、静音和性能 Key，写入 v1 主文档，同时保留旧值。已有主文档解析失败时不覆盖原值，启动进入错误提示。

当前仍没有：

- v2 及以上逐版本迁移链。
- 经过结构校验的 AI Generation Job。
- ContentPack Validator 与可安装 Content Library。
- 单局崩溃恢复。

目标存档规范见 [`docs/specs/CHERRY_RUNTIME.md`](./docs/specs/CHERRY_RUNTIME.md)。

## 14. 当前 MiniApp 打包

当前仓库通过 `scripts/package-miniapp-dev.sh`：

1. 运行 TypeScript 检查。
2. 用 Vite development mode 构建到临时目录。
3. 复制 `miniapp/manifest.json`。
4. 校验 icon hash。
5. 直接 ZIP 为 `.miniapp`。

这是早期接入的过渡流程，不是目标合同。目标是让 manifest 进入 `public/`，构建标准 `dist/`，再使用共享 `cherry-miniapp` CLI 校验和打包。

## 15. 当前扩展方式

在 Registry 迁移完成前，现有扩展仍遵循当前源码模式：

- 当前新武器行为：稳定 `behaviorId` → Registry 注册 → 内容定义引用 → Renderer/升级/平衡测试。
- 目标新投射物武器：只增加 WeaponRecipe 数据，复用 Trigger、Targeting、Emission、Motion、Collision、Effect、Lifecycle、Modifier 和 Render 原语。
- 新怪物：类型 → `ENEMY_DATA` → 必要的 Attack/Trait → Renderer → Spawner/测试。
- 新被动：类型 → `PASSIVE_DATA` → Player 属性重算 → 商店/测试。
- 新 Modifier：类型与 bit mask → 数据 → Weapon/Combat 效果 → 视觉/事件。

但新功能若目标是被多个内容复用，应该优先成为行为原语并按目标架构注册，避免继续扩大按内容 ID 分发的 `switch`。

## 16. 已知迁移点

| 当前状态 | 目标 |
| --- | --- |
| 自建 `cherry.d.ts` 与 Browser fallback | `@cherry-miniapp/kit` + Cherry-only production + dev mock |
| v1 AppStateEnvelope 已接入，旧 Key 仅用于首次迁移 | 后续逐版本迁移、恢复 UI 与 RunCheckpoint |
| 武器施放已按粗粒度 behaviorId 分派；其余仍有类型分支 | 原子 Projectile/Modifier Registry + WeaponRecipeCompiler + 声明式 ContentPack |
| 内置武器/怪物快照已冻结；多数系统仍直接导入旧表 | 系统统一依赖已解析 Registry Snapshot |
| AI 尚未接入 | 持久化 Job、校验、预览、玩家确认的 AI Forge |
| 自定义 ZIP 脚本 | 共享 `cherry-miniapp` CLI |

迁移顺序和依赖规则以 [`TARGET_ARCHITECTURE.md`](./docs/architecture/TARGET_ARCHITECTURE.md) 为准。
