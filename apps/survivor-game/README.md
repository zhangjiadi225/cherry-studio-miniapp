# 暗夜幸存者 / Night Survivor

运行在 Cherry Studio 中的 2D 生存游戏与 AI 武器锻造工具。描述想要的武器，查看生成结果，经本地校验并由玩家接受后，将武器带入战斗；战斗规则、伤害和进度由本地代码决定，不交给 AI 实时控制。

这是 Cherry Mini App monorepo 中的独立应用目录，使用 TypeScript、Canvas 2D 和 Vite。创造怪物和更完整的可组合行为仍是后续方向，不属于当前已交付功能。

## 安装与兼容性

- 在线安装清单：GitHub Pages development 地址待启用；计划路径为 `https://zhangjiadi225.github.io/cherry-studio-miniapp/miniapps/survivor-game/manifest.json`，当前不是有效安装链接。
- 应用 ID：`io.github.zhangjiadi225.survivor-game`；当前版本以[包内清单](./public/manifest.json)为准，仍为开发预发布版本。
- 需要提供 Local MiniApp（本地小应用）能力的 Cherry Studio；已验收版本待记录，不将开发分支兼容基线当作发布版验收结果。
- AI 锻造需要 Cherry Studio 中可用的模型；模型不可用时，仍可使用内置和此前已接受的武器。

`public/manifest.json` 不是在线安装地址。手动触发仓库的 GitHub Pages 工作流后，将生成本应用独立的 HTTPS 发布清单和 `.miniapp` 安装包，不需要安装模型布景或仓库中的能力示例；Pages 未启用或工作流未成功时不要使用上述计划地址。维护者见[社区发布指南](../../foundation/specs/community-publishing.md)。

## 当前状态

- 已有完整的生存战斗循环、武器与进化、怪物强化与弹幕、商店、难度、元成长、音频和存档。
- 已通过 `@cherry-miniapp/kit` 接入 Cherry 存储、AI 能力与 `app.visibilityChange`。
- 已建立版本化单文档 AppState、冻结 Registry、内置与已接受内容快照和武器行为 ID 分派。
- AI Forge、ContentPack 校验/安装和动态武器已实现；怪物 BehaviorGraph 尚未实现。
- Cherry Local MiniApp Runtime 以 Cherry Studio `main` 合并 PR #19475 后的合同为基线。

## 权限与数据

当前包内清单声明以下权限：

| 权限 | 用途 |
| --- | --- |
| `ai.chat` | 玩家发起锻造时，将武器描述与生成所需的能力目录、配方约束发送给 Cherry Studio 配置的模型；失败时可能追加诊断修复请求 |
| `storage.get` | 读取应用设置、元成长进度及已接受的生成内容 |
| `storage.set` | 保存上述状态和生成任务记录，重启后加载已接受的武器 |

AI 文本不是可执行代码：生成内容需要通过本地结构、引用、平衡和性能预算校验，由玩家接受后才安装使用。应用不申请文件、通知、剪贴板或 `network.fetch` 权限；AI 请求仍可能由 Cherry Studio 发送给联网模型服务，不能将其视为完全离线功能。

当前保存设置、元成长和内容库，不支持崩溃后恢复未完成的单局。详细说明见[Cherry 权限与存档规范](./docs/specs/CHERRY_RUNTIME.md)。

## 截图

发布用的真实运行截图待补充，计划展示锻造首页、生成结果和实际战斗画面。包内角色、武器及背景素材不作为运行截图。

## 反馈与许可证

用户可在[本仓库 Issues](https://github.com/zhangjiadi225/cherry-studio-miniapp/issues)提交问题，标题以 `[survivor-game]` 开头，注明应用版本、Cherry Studio 版本、系统、复现步骤及脱敏截图。AI 锻造问题可附脱敏后的武器描述和错误提示，不要上传 API Key 或完整私密对话。

本项目自有源码采用 [MIT License](../../LICENSE)；第三方依赖与素材的分发条件见[仓库说明](../../README.md#许可证与素材)。

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
