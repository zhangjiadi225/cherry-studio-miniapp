# 外部开源项目说明

## `binding-of-isaac-webgame`

- 本机路径：`external/isaac-webgame/`
- 原项目：<https://github.com/liyupi/binding-of-isaac-webgame>
- 归属：第三方开源项目，不是本 monorepo 的原创产品，也不属于其版本历史。
- 用途：仅作为本地技术参考保留。

该目录被根 `.gitignore` 排除，不进入 pnpm workspace，不参与批量开发、构建、Cherry 打包、发布或商业化。后续任务默认不得修改其中源码；若需要研究，只进行只读查看并遵守原项目的 LICENSE 与免责声明。

如果以后需要基于第三方项目创作新产品，应先单独确认许可与衍生作品边界，再在新的 `apps/<slug>/` workspace 中独立实现，不直接把外部源码登记成自有产品。
