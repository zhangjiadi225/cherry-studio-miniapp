# Epoch Weaver / 纪元织造者（示例）

Cherry miniapp monorepo 中的 AI 能力与架构示例，不作为独立产品发布，也不参与 `apps/*` 的批量构建和打包。玩家用本地确定性规则引导文明，Cherry 用户自己的模型负责生成每回合的世界回应。

从 monorepo 根目录运行：

```bash
pnpm --filter @examples/epoch-weaver dev
pnpm --filter @examples/epoch-weaver build
pnpm --filter @examples/epoch-weaver miniapp:pack
```

`@cherry-miniapp/kit` 和 `@cherry-miniapp/cli` 通过根 workspace 解析，外部依赖由根 `pnpm-lock.yaml` 锁定。
