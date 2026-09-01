# 暗夜幸存者 / Night Survivor

Cherry Mini App monorepo 中面向 Cherry Studio Local MiniApp 的独立 2D 生存 Roguelike workspace。游戏使用 TypeScript、Canvas 2D 和 Vite；长期方向是让玩家通过 Cherry 的 AI 能力锻造武器、创造怪物和组合受控招式，同时由本地确定性引擎维护战斗、公平性和存档真值。

## 当前状态

- 已有完整的生存战斗循环、武器与进化、怪物强化与弹幕、商店、难度、元成长、音频和存档。
- 已通过 `@cherry-miniapp/kit` 接入 Cherry 存储、AI 能力与 `app.visibilityChange`。
- 已建立版本化单文档 AppState、冻结 Registry、内置与已接受内容快照和武器行为 ID 分派。
- AI Forge、ContentPack 校验/安装和动态武器已实现；怪物 BehaviorGraph 尚未实现。
- Cherry Local MiniApp Runtime 以 Cherry Studio `main` 合并 PR #19475 后的合同为基线。

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

从 monorepo 根目录运行：

```bash
pnpm --filter @miniapps/survivor-game dev
pnpm --filter @miniapps/survivor-game build
pnpm --filter @miniapps/survivor-game miniapp:validate
pnpm --filter @miniapps/survivor-game miniapp:pack
```

`dev` 会安装显式浏览器开发 mock；正式构建必须运行在 Cherry Host 中。`miniapp:validate` 和 `miniapp:pack` 只消费已经构建好的 `dist/`，不会隐式运行 build。`@cherry-miniapp/kit@^0.2.0` 与 `@cherry-miniapp/cli@^0.2.0` 通过根 pnpm workspace 解析，外部依赖由仓库根 `pnpm-lock.yaml` 锁定。
