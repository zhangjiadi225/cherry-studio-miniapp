# 暗夜幸存者 / Night Survivor

面向 Cherry Studio Local MiniApp 的 2D 生存 Roguelike。游戏使用 TypeScript、Canvas 2D 和 Vite；长期方向是让玩家通过 Cherry 的 AI 能力锻造武器、创造怪物和组合受控招式，同时由本地确定性引擎维护战斗、公平性和存档真值。

## 当前状态

- 已有完整的生存战斗循环、武器与进化、怪物强化与弹幕、商店、难度、元成长、音频和存档。
- 已接入 Cherry 存储与 `app.visibilityChange` 的最小兼容层。
- 已建立版本化单文档 AppState、冻结 Registry、内置内容快照和武器行为 ID 分派；当前仍只装配内置内容。
- AI Forge、ContentPack 校验/安装和怪物 BehaviorGraph 尚未实现；它们是目标架构，不是当前能力。
- Cherry Local MiniApp Runtime 当前依据 Cherry Studio PR #19475 开发，接口仍可能变化。

## 文档

- [当前架构](./ARCHITECTURE.md)
- [文档索引与规范约定](./docs/README.md)
- [产品方向](./docs/product/DIRECTION.md)
- [目标架构](./docs/architecture/TARGET_ARCHITECTURE.md)
- [ContentPack 规范](./docs/specs/CONTENT_PACK.md)
- [WeaponRecipe 与弹幕原语规范](./docs/specs/WEAPON_RECIPE.md)
- [AI 生成规范](./docs/specs/AI_GENERATION.md)
- [Cherry MiniApp 运行规范](./docs/specs/CHERRY_RUNTIME.md)

## 当前开发命令

```bash
pnpm dev
pnpm build
pnpm exec vitest run
```

现有 `package:miniapp:dev` 是过渡脚本。目标打包流程以 `docs/specs/CHERRY_RUNTIME.md` 为准：应用先构建静态 `dist/`，再由共享 `cherry-miniapp` CLI 校验和生成 development `.miniapp`。
