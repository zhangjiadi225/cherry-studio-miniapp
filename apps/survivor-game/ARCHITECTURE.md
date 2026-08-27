# 暗夜幸存者 — 架构设计文档

> 最后更新：2026-06-18  
> 状态：已重构 v3.0（深度模块化）

---

## 1. 项目概览

**类型**：类吸血鬼幸存者的 2D 生存 Roguelike  
**技术栈**：TypeScript + Canvas 2D（纯原生，无游戏框架）  
**构建工具**：Vite  
**代码规模**：~4,800 行，22 个 TypeScript 源文件

---

## 2. 目录结构

```
survivor-game/
├── index.html
├── package.json
├── ARCHITECTURE.md                 # 本文档
│
└── src/
    ├── main.ts                     # 应用入口
    ├── style.css
    ├── assets/                     # 静态资源
    │
    └── game/
        ├── types.ts                # 全局接口 & 类型枚举
        ├── constants.ts            # 数据表 & 全局常量
        ├── Game.ts                 # 核心游戏循环 & 编排器
        ├── Renderer.ts             # 渲染器代理（转发到子渲染器）
        │
        ├── systems/                # 独立游戏系统（每个可单独扩展）
        │   ├── player/
        │   │   ├── Player.ts       # 玩家：创建/更新/受伤/升级
        │   │   └── XPGem.ts        # 经验宝石：创建/吸引/收集
        │   ├── enemy/
        │   │   ├── Enemy.ts        # 敌人：创建/更新/受伤/碰撞
        │   │   └── Spawner.ts      # 生成器：波次/Boss/精英
        │   ├── weapon/
        │   │   ├── Weapon.ts       # 武器：开火/弹幕/大蒜范围
        │   │   └── Upgrade.ts      # 升级：选项生成/应用
        │   ├── camera/
        │   │   └── Camera.ts       # 镜头跟随 & 震动
        │   ├── input/
        │   │   └── Input.ts        # 键盘 + 触控输入
        │   └── map/
        │       └── MapSystem.ts    # 程序化地图：障碍物/空间网格
        │
        ├── effects/                # 通用可组合资产
        │   ├── Particle.ts         # 粒子系统（创建/更新/多种生成器）
        │   └── DamageNumber.ts     # 伤害飘字
        │
        ├── renderers/              # 渲染子模块
        │   ├── WorldRenderer.ts    # 浅色地面/程序化标记/障碍物/竞技场边界
        │   ├── EntityRenderer.ts   # 玩家/敌人/弹幕/宝石/光环
        │   ├── EffectsRenderer.ts  # 粒子/飘字/闪光/Boss预警
        │   └── UIRenderer.ts       # HUD/小地图/菜单/升级/暂停/结算
        │
        └── utils/                  # 工具函数
            ├── math.ts             # 向量/距离/哈希/数组压缩
            └── collision.ts        # 碰撞检测 & 推出算法
```

---

## 3. 分层架构

```
┌─────────────────────────────────────────────────────┐
│                     main.ts                         │  入口
├─────────────────────────────────────────────────────┤
│                    Game.ts                          │  编排层
│      状态机 · 游戏循环 · 输入路由 · 系统协调           │
├──────────┬──────────┬───────────┬───────────────────┤
│ Renderer │          │           │                   │  渲染层
│  (代理)   │          │           │                   │
├──────────┴──────────┤           │                   │
│ WorldRenderer       │ UIRenderer│                   │
│ EntityRenderer      │           │                   │
│ EffectsRenderer     │           │                   │
├─────────────────────┴───────────┴───────────────────┤
│  systems/player  │  systems/enemy  │  systems/weapon │  系统层
│  Player.ts       │  Enemy.ts       │  Weapon.ts      │
│  XPGem.ts        │  Spawner.ts     │  Upgrade.ts     │
├──────────────────┼─────────────────┼─────────────────┤
│  systems/camera  │  systems/input  │  systems/map    │
│  Camera.ts       │  Input.ts       │  MapSystem.ts   │
├──────────────────┴─────────────────┴─────────────────┤
│  effects/                                            │  资产层
│  Particle.ts · DamageNumber.ts                       │
├──────────────────────────────────────────────────────┤
│  types · constants · utils/math · utils/collision    │  基础层
└──────────────────────────────────────────────────────┘
```

---

## 4. 模块详解

### 4.1 systems/ — 独立游戏系统

每个子目录是一个**自包含系统**，有明确的职责边界，可独立扩展。

| 系统 | 目录 | 文件 | 职责 |
|------|------|------|------|
| **玩家** | `systems/player/` | `Player.ts` `XPGem.ts` | 移动、受伤、升级、属性重算、经验收集 |
| **敌人** | `systems/enemy/` | `Enemy.ts` `Spawner.ts` | 敌人 AI、波次生成、Boss/精英机制、难度缩放 |
| **武器** | `systems/weapon/` | `Weapon.ts` `Upgrade.ts` | 8 种武器开火逻辑、弹幕更新、大蒜范围、升级选项 |
| **镜头** | `systems/camera/` | `Camera.ts` | 平滑跟随、屏幕震动 |
| **输入** | `systems/input/` | `Input.ts` | 键盘 WASD/方向键、触控虚拟摇杆 |
| **地图** | `systems/map/` | `MapSystem.ts` | 程序化障碍物生成、空间网格查询、碰撞处理 |

### 4.2 effects/ — 通用可组合资产

独立于任何系统，可被任意模块组合使用：

| 资产 | 职责 | 使用方 |
|------|------|--------|
| `Particle.ts` | 粒子创建/更新 + 7 种工厂函数 | Game.ts, renderers/ |
| `DamageNumber.ts` | 飘字创建/更新 | Game.ts |

### 4.3 renderers/ — 渲染层

纯绘制逻辑，不包含游戏状态：

| 渲染器 | 职责 | 状态 |
|--------|------|------|
| `WorldRenderer` | 浅色地面、视口内程序化标记、障碍物、竞技场边界 | 无大纹理缓存（class） |
| `EntityRenderer` | 玩家、敌人、弹幕、宝石、光环 | 无状态函数 |
| `EffectsRenderer` | 粒子、飘字、屏幕闪光、Boss 预警 | 无状态函数 |
| `UIRenderer` | HUD、小地图、菜单、升级界面、暂停、结算 | 无状态函数 |

### 4.4 types.ts & constants.ts — 基础层

| 文件 | 职责 |
|------|------|
| `types.ts` | 所有接口定义（Player, Enemy, Weapon, Projectile...）和类型枚举 |
| `constants.ts` | 数据驱动表（WEAPON_DATA, ENEMY_DATA, PASSIVE_DATA）+ 全局常量 |

---

## 5. 游戏状态机

```
          ┌──────────┐
    ┌────→│   menu   │←─────────────────────┐
    │     └────┬─────┘                       │
    │     Enter/Space/Click                  │
    │          ↓                             │
    │     ┌──────────┐    ESC/P/暂停按钮     │
    │     │ playing  │←───────────┐          │
    │     └┬───┬───┬─┘           │          │
    │  升级 │   │   │ HP≤0       │          │
    │      ↓   │   ↓            │          │
    │ ┌────────┐ │ ┌──────────┐  │          │
    │ │upgrading│ │ │ gameover │──┘(重开)    │
    │ └────┬───┘ │ └──────────┘             │
    │  选择 │     │  ESC/P                   │
    │      ↓     ↓                          │
    │   playing  ┌──────────┐               │
    │            │  paused  │───────────────┘
    │            └──────────┘
    └────────────────────────────────────────┘
```

---

## 6. 扩展指南

### 添加新武器

1. `types.ts` → `WeaponType` 添加枚举
2. `constants.ts` → `WEAPON_DATA` 添加数据表
3. `systems/weapon/Weapon.ts` → 实现 `fireXxx()` + 添加到 `updateWeapon()` switch
4. `renderers/EntityRenderer.ts` → `drawProjectile()` 添加渲染分支

### 添加新敌人

1. `types.ts` → `EnemyType` 添加枚举
2. `constants.ts` → `ENEMY_DATA` 添加数据
3. `renderers/EntityRenderer.ts` → `drawEnemy()` 添加渲染
4. `Spawner.ts` 根据 `spawnAfter` 自动解锁

### 添加新被动技能

1. `types.ts` → `PassiveType` 添加枚举
2. `constants.ts` → `PASSIVE_DATA` 添加数据
3. `systems/player/Player.ts` → `recalcStats()` 处理效果

### 添加新特效资产

1. 在 `effects/` 目录创建新文件（如 `ScreenFlash.ts`、`TrailEffect.ts`）
2. 在 `renderers/EffectsRenderer.ts` 添加对应的绘制函数
3. 在 `Game.ts` 或子系统中调用

### 调整地图障碍

1. `types.ts` → 更新 `MapObstacle` 类型
2. `systems/map/MapSystem.ts` → 调整生成密度、尺寸和碰撞逻辑
3. `renderers/WorldRenderer.ts` → 更新对应障碍物绘制

### 添加音效系统（计划）

建议在 `systems/audio/` 目录新增 `Audio.ts`，在 Game.ts 关键事件点触发播放。

---

## 7. 技术决策

| 决策 | 理由 |
|------|------|
| 纯 Canvas 2D，无框架 | 逻辑简单，避免框架开销，性能可控 |
| systems/ 按游戏系统分目录 | 每个系统自成一体，添加新武器/敌人只需改对应目录 |
| effects/ 独立于系统 | 粒子/飘字是通用资产，可被任意系统组合 |
| 函数式实体模块 | 用导出函数而非 class，便于测试和组合 |
| Renderer 薄代理 | 渲染细节在 renderers/ 子模块，Renderer 仅转发 |
| constants.ts 数据表驱动 | 平衡调整只改数据，不改逻辑 |
| compactArray 替代 splice | 大量实体场景下 O(n) vs O(n²) |
