# Epoch Weaver / 纪元织造者

Cherry miniapp monorepo 中的独立产品 workspace。玩家用本地确定性规则引导文明，Cherry 用户自己的模型负责生成每回合的世界回应。

从 monorepo 根目录运行：

```bash
pnpm --filter @miniapps/epoch-weaver dev
pnpm --filter @miniapps/epoch-weaver build
pnpm --filter @miniapps/epoch-weaver miniapp:pack
```

`@cherry-miniapp/kit` 和 `@cherry-miniapp/cli` 通过根 workspace 解析，外部依赖由根 `pnpm-lock.yaml` 锁定。
