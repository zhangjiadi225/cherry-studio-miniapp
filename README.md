# Cherry Mini App Monorepo

面向 Cherry Studio 的小应用集合。模型布景用于本地 3D 模型展示，暗夜幸存者用于 AI 武器锻造与生存战斗。

本项目采用 monorepo（多个应用及共享工具放在同一个 Git 仓库）：源码一起维护，每个应用独立安装、更新和发布，不需要安装整个仓库。

## 应用与安装

| 应用 | 用途 | 安装状态 |
| --- | --- | --- |
| [模型布景 / Model Stage](./apps/model-stage/README.md) | 导入本地模型，调整灯光、镜头和环境；AI 为可选增强 | GitHub Pages development 清单待启用 |
| [暗夜幸存者 / Night Survivor](./apps/survivor-game/README.md) | 描述并生成武器，经校验和接受后带入生存战斗 | GitHub Pages development 清单待启用 |

本仓库已准备使用 GitHub Pages 提供 HTTPS 分发，但远端尚未启用 Pages，因此目前仍没有公开可安装地址，也尚未记录已验收的 Cherry Studio 发布版本。各应用的 `public/manifest.json` 是包内配置，不是可直接用于在线安装的发布清单；本地存在安装包也不代表已公开发布。

应用介绍、权限用途、数据边界和反馈方式见各自 README。发布准备与维护者操作步骤见[多应用社区发布指南](./foundation/specs/community-publishing.md)。

## 仓库结构

```text
cherry-studio-miniapp/
├── foundation/
│   ├── packages/runtime/       # @cherry-miniapp/kit
│   ├── packages/cli/           # @cherry-miniapp/cli
│   ├── skills/                 # 可复用 Codex Skills
│   └── specs/                  # 宿主、产品、仓库和打包规范
├── apps/
│   ├── model-stage/            # 模型布景
│   └── survivor-game/          # 暗夜幸存者
└── examples/
    └── epoch-weaver/           # 纪元织造者（AI 能力与架构示例）
```

## 目录边界

- `foundation/` 负责宿主适配、共享 runtime、打包 CLI、Skills、模板与跨产品规范。
- `apps/<slug>/` 负责对应产品的 UI、玩法、提示词、资产、manifest 和发布配置。
- `examples/<slug>/` 放置可运行的能力示例，不注册为正式产品，也不参与批量构建和打包。
- 产品只能通过 `@cherry-miniapp/kit`、`@cherry-miniapp/cli` 等公开包入口消费共享能力，不跨目录深层导入源码。
- 跨共享层与产品层的契约变更可以在同一个分支和提交中完成，但仍需维护公开包版本和迁移说明。
- 第三方参考项目放在被忽略的 `external/`，不进入 workspace、Git 历史、构建或发布。

## 本地开发

从仓库根目录安装依赖并提交唯一的根 lockfile：

```bash
pnpm install
pnpm --filter @miniapps/model-stage dev
pnpm --filter @miniapps/survivor-game dev
pnpm --filter @examples/epoch-weaver dev
pnpm build:all
pnpm pack:all
pnpm apps:list
```

workspace 会把版本兼容的 foundation 包链接给 app；CI 和本地开发都以根 `pnpm-lock.yaml` 为依赖真源。模型布景固定使用 npm registry 中发布的 Skenora 0.1.3，不依赖仓库外的本地目录。

## 打包模型

每个 app 都通过 `@cherry-miniapp/cli` 执行同一流水线：

```bash
pnpm --filter @miniapps/model-stage build
pnpm --filter @miniapps/model-stage miniapp:pack
```

CLI 只接受已经构建完成的静态目录，校验 manifest 和入口、拒绝 symlink、生成 `.miniapp`、SHA-256、体积与元数据。HTTPS 发布需要显式生成 distribution manifest；批量打包只是逐 app 调用同一 CLI，不产生第二套格式。

详细设计见 [foundation/specs/repository-model.md](./foundation/specs/repository-model.md) 与 [foundation/specs/packaging.md](./foundation/specs/packaging.md)。

## GitHub

本 monorepo 的公开远端为 [zhangjiadi225/cherry-studio-miniapp](https://github.com/zhangjiadi225/cherry-studio-miniapp)。Cherry 宿主联调以现有 fork [zhangjiadi225/cherry-studio](https://github.com/zhangjiadi225/cherry-studio) 为准，并持续对照上游 [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio)。

本 monorepo 是 foundation 与所有 miniapp 的唯一代码真源。

## 当前产品线

- `model-stage`（模型布景）：本地 3D 模型布景工作区，Cherry AI 为可选增强。
- `survivor-game`（暗夜幸存者）：支持 Cherry AI 武器锻造的确定性 2D 生存游戏引擎。

## 能力示例

- `epoch-weaver`（纪元织造者）：AI 能力与架构样板，位于 `examples/`，不作为独立产品发布。

## 反馈

用户可以在[本仓库 Issues](https://github.com/zhangjiadi225/cherry-studio-miniapp/issues)反馈问题，标题注明 `[model-stage]` 或 `[survivor-game]`，附上应用版本、Cherry Studio 版本、操作系统、复现步骤和脱敏截图。

应用功能问题由本项目维护者处理；被社区列表收录不代表 Cherry Studio 负责维护本应用。不要在公开 Issue 中上传 API Key、私人模型文件或完整私密对话。

## 许可证与素材

本项目自有源码采用 [MIT License](./LICENSE)。第三方依赖与素材保留各自的许可证和分发条件；公开分发应用前仍需完成现有图片、模型示例及其他素材的来源审查，不能将它们直接视为采用 MIT License。
