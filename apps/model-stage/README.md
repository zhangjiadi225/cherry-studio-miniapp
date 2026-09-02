# 模型布景

Cherry miniapp monorepo 中的独立产品 workspace。

打开就是一个纯黑背景的 3D 模型工作区，只显示位于世界坐标 `Y=0` 平面的网格辅助线，不创建实体地面、展台或内置模型。用户可以选择包含 GLB/glTF 及其贴图、二进制文件等依赖的模型目录，再用 Cherry AI 调整导入的模型、环境、灯光和镜头。

右侧面板提供“对话 / 场景”两个 Tab（页签，即同一面板内切换的内容页），默认显示占满面板的 Cherry AI 对话；切换到“场景”后，上方显示实时场景树，下方显示当前节点属性。天空、地面、灯光、镜头以及模型/对象均按 SceneDocument（场景文档）中的真实父子层级呈现。普通问题直接回复，明确的场景修改会生成 ScenePatch，经 Skenora 校验后自动应用到画面。

- [开发方案](./docs/development-plan.md)
- [目标界面](./docs/assets/product-target-v1.png)

从 monorepo 根目录运行：

```bash
pnpm --filter @miniapps/model-stage dev
pnpm --filter @miniapps/model-stage build
pnpm --filter @miniapps/model-stage miniapp:pack
```

源码只通过公开包入口使用 foundation 或 Skenora。`@cherry-miniapp/*` 依赖由根 workspace 解析；`@skenora/sdk` 与 `@skenora/scene-plan` 固定使用 npm registry 中发布的 0.1.2。
