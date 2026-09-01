# Cherry Mini App Monorepo

Cherry miniapp 的单一 Git 仓库。共享基础能力与所有产品位于同一个 pnpm workspace 中，同时保持清晰的目录所有权和独立发布边界。

```text
cherry-studio-miniapp/
├── foundation/
│   ├── packages/runtime/       # @cherry-miniapp/kit
│   ├── packages/cli/           # @cherry-miniapp/cli
│   ├── skills/                 # 可复用 Codex Skills
│   └── specs/                  # 宿主、产品、仓库和打包规范
└── apps/
    ├── epoch-weaver/           # 纪元织造者
    └── model-stage/            # 模型布景
```

## 目录边界

- `foundation/` 负责宿主适配、共享 runtime、打包 CLI、Skills、模板与跨产品规范。
- `apps/<slug>/` 负责对应产品的 UI、玩法、提示词、资产、manifest 和发布配置。
- 产品只能通过 `@cherry-miniapp/kit`、`@cherry-miniapp/cli` 等公开包入口消费共享能力，不跨目录深层导入源码。
- 跨共享层与产品层的契约变更可以在同一个分支和提交中完成，但仍需维护公开包版本和迁移说明。
- 第三方参考项目放在被忽略的 `external/`，不进入 workspace、Git 历史、构建或发布。

## 本地开发

从仓库根目录安装依赖并提交唯一的根 lockfile：

```bash
pnpm install
pnpm --filter @miniapps/epoch-weaver dev
pnpm --filter @miniapps/model-stage dev
pnpm build:all
pnpm pack:all
pnpm apps:list
```

workspace 会把版本兼容的 foundation 包链接给 app；CI 和本地开发都以根 `pnpm-lock.yaml` 为依赖真源。当前模型布景使用的 Skenora 0.1.2 尚通过相邻本地目录覆盖，发布或独立 CI 前仍需将该版本发布到 registry，或把 Skenora 纳入明确的版本化依赖方案。

## 打包模型

每个 app 都通过 `@cherry-miniapp/cli` 执行同一流水线：

```bash
pnpm --filter @miniapps/epoch-weaver build
pnpm --filter @miniapps/epoch-weaver miniapp:pack
```

CLI 只接受已经构建完成的静态目录，校验 manifest 和入口、拒绝 symlink、生成 `.miniapp`、SHA-256、体积与元数据。HTTPS 发布需要显式生成 distribution manifest；批量打包只是逐 app 调用同一 CLI，不产生第二套格式。

详细设计见 [foundation/specs/repository-model.md](./foundation/specs/repository-model.md) 与 [foundation/specs/packaging.md](./foundation/specs/packaging.md)。

## GitHub

本 monorepo 的 Private 远端为 [zhangjiadi225/cherry-studio-miniapp](https://github.com/zhangjiadi225/cherry-studio-miniapp)。Cherry 宿主联调以现有 fork [zhangjiadi225/cherry-studio](https://github.com/zhangjiadi225/cherry-studio) 为准，并持续对照上游 [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio)。

历史独立仓库只作为迁移备份，不再是代码真源；所有后续 foundation 与 miniapp 开发都进入本 monorepo。

## 当前产品线

- `epoch-weaver`（纪元织造者）：AI 能力与架构样板。
- `model-stage`（模型布景）：Cherry AI 驱动的 3D 模型工作区。
