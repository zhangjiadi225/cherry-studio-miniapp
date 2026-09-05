# 多应用社区发布指南

本文面向本仓库维护者，说明如何在一个源码仓库中独立发布多款 MiniApp，并申请加入 [Cherry Studio MiniApps 社区列表](https://github.com/CherryHQ/cherry-studio-miniapps)。不定义新的安装包格式，不代替现有[打包规范](./packaging.md)。

## 当前状态与待确认事项

截至 2026-09-05：当前远端已公开，自有源码已选择 MIT License。分发来源已选择 GitHub Pages，但远端尚未启用 Pages；两款应用的源码清单不保存环境专属的 `update.url`，尚未提供公开安装清单，也未记录当前 Cherry Studio 发布版的安装验收结果。

在完成下列决定前，只准备文档，不填入猜测的发布地址，不声明已经开源、上线或通过验收：

- 源码公开检查：当前整个仓库已经公开。继续检查历史记录、个人信息以及第三方代码和素材来源；发现问题时按公开事件处理，不能再假设旧内容未暴露。
- 许可证：项目根目录的 MIT License 覆盖本项目自有源码；第三方依赖和素材保留各自条件，发布前仍需完成来源与分发条件审查。
- Pages 可用条件：公开仓库满足 GitHub Free 的 Pages 仓库可见性要求；Pages 站点同样公开。启用前仍需完成许可证和分发材料检查。
- 应用身份：确认首次公开发布的应用 ID 及命名空间归属，之后保持稳定。尤其需要确认 `dev.cherrymini.model-stage` 的命名空间。
- 发现入口：建议先主推模型布景，但仓库 Website 最终指向哪款应用的安装清单，仍需维护者确认后再配置。
- 操作授权：构建、测试、安装验收、公开仓库、部署、推送和提交收录 PR 分别按用户授权执行；仅整理文档不表示已获这些授权。构建类型另行确认，未明确要求正式发布构建时默认 development（开发构建）。

## 一仓库，多应用

| 应用 | 源码与配置 | 社区分类 | 独立发布路径示意 |
| --- | --- | --- | --- |
| 模型布景 / Model Stage | `apps/model-stage/` | Creative tools / 创作工具 | `https://zhangjiadi225.github.io/cherry-studio-miniapp/miniapps/model-stage/manifest.json` |
| 暗夜幸存者 / Night Survivor | `apps/survivor-game/` | Games / 游戏 | `https://zhangjiadi225.github.io/cherry-studio-miniapp/miniapps/survivor-game/manifest.json` |

以上是计划中的 Pages 地址；在 Pages 启用且手动发布工作流成功前，不是有效安装链接。每款应用有自己的 ID、版本、安装包和更新清单，共用一个 HTTPS 来源的不同路径。`foundation/` 不作为应用安装；`examples/epoch-weaver/` 仍是能力示例，不参加产品发布或收录。

社区的[贡献指南](https://github.com/CherryHQ/cherry-studio-miniapps/blob/main/CONTRIBUTING.md)没有明确要求一应用一仓库，也没有专门说明多应用仓库收录。因此采用“每应用一个条目、指向各自源码目录”的方案申请，是否接受同仓库多个条目由维护者决定。

## 安装清单与托管

每个应用分别准备：

1. `apps/<slug>/public/manifest.json`：包内清单真源，保持应用 ID、版本、权限和真实功能一致。Pages 工作流只在临时 runner（自动化任务的执行环境）内加入该环境的 `update.url`，不会改写或提交源码工作区。
2. `apps/<slug>/artifacts/<slug>-<version>.miniapp`：由已有共享 CLI（命令行打包工具）生成的版本化安装包，不手工另建 ZIP 格式。
3. `apps/<slug>/artifacts/<slug>-<version>.distribution.json`：由同一 CLI 生成的发布清单，部署到该应用 `update.url` 指定的位置。

GitHub Pages 托管布局（尚未部署）：

```text
https://zhangjiadi225.github.io/cherry-studio-miniapp/miniapps/
├── model-stage/
│   ├── manifest.json
│   └── releases/<模型布景版本>/model-stage-<模型布景版本>.miniapp
└── survivor-game/
    ├── manifest.json
    └── releases/<暗夜幸存者版本>/survivor-game-<暗夜幸存者版本>.miniapp
```

发布清单应保留所有包内共享字段，额外添加 `package` 中的安装包 URL、SHA-256（安装包完整性摘要）和精确字节数。不要把 `package` 写回包内清单，也不要把两个应用合并成一个发布清单。

按照社区[发布文档](https://github.com/CherryHQ/cherry-studio-miniapps/blob/main/docs/publishing.md)：`package.url` 与 `update.url` 必须同源且均为 HTTPS，资源必须直接返回，不能跳转到登录页、下载页或其他地址。GitHub Release 资源链接通常会重定向，不能直接作为 `package.url` 使用。

## 每应用发布步骤

以下是待执行步骤，不是本轮已完成的构建、测试或上线记录：

1. 确认 ID、版本、素材分发条件与构建类型，并复核 MIT License 覆盖的自有源码范围。包清单和 `package.json` 的版本保持一致。
2. 模型布景建议补充应用图标；若使用图标，填写真实路径和摘要。不要用设计图冒充图标或截图。
3. 在仓库设置中将 Pages 的 Source 设为 GitHub Actions。这个设置会影响远端状态，需单独获得授权。
4. 推送 `.github/workflows/publish-miniapps-pages.yml` 后，由维护者手动触发 `Publish MiniApps development channel to GitHub Pages`。普通 push 不会发布；该工作流使用 development 构建，依次构建共享 runtime 和两款应用，校验、打包、生成发布清单，再将一个 Pages artifact（页面部署包）交给 GitHub Pages。
5. 工作流通过 `actions/configure-pages` 读取实际 Pages 地址，并运行 `foundation/scripts/configure-pages-manifests.mjs`，只在 runner 内把两个 `update.url` 写入待构建清单。生成的包内清单和在线发布清单因此使用同一个实际 Pages 基础地址，不依赖猜测的自定义域名。
6. 工作流先准备完整站点再部署：两个版本化安装包、两个发布清单和暗夜幸存者图标在同一个 Pages artifact 内原子替换。每次更新提升应用版本，不复用已经公开的版本路径。
7. 获准执行安装验收后，确认 HTTPS 直连、摘要与字节数、当前 Cherry Studio 发布版安装与运行、权限提示、AI 可用/不可用路径、持久化和更新流程。记录应用版本、Cherry Studio 版本、系统、日期及实际结果；不把浏览器开发 mock（模拟宿主）当作真实宿主验收。
8. 添加当前版本的真实截图、安装清单 URL、已验收版本和已知限制到该应用 README，再更新根目录应用表。未上线的应用继续标为待发布；不要因为一个应用通过就勾选另一个。

GitHub Pages 的 `github.io` 地址自动支持 HTTPS。GitHub 官方说明也指出，即使来源仓库是私有仓库，Pages 站点仍公开；部署前不得把密钥、私有构建日志或其他敏感文件复制进 Pages artifact。当前工作流只复制分发首页、两份发布清单、两份安装包和一张公开包内图标，不上传源码、环境文件或整个 `dist/`。

## 截图与反馈材料

截图应来自实际运行版本，记录应用版本、Cherry Studio 版本和操作系统，并避开私人对话、API Key、个人路径和无权分发的模型。每款应用至少准备一张能体现核心功能的真实截图：

- 模型布景：使用可公开展示的模型，展示真实布景、方案面板和场景设置。现有 `docs/assets/product-target-v1.png` 仅是设计参考。
- 暗夜幸存者：展示锻造首页、可接受的生成结果和实际战斗；不要把包内美术素材当作运行截图。

应用问题统一进入[本仓库 Issues](https://github.com/zhangjiadi225/cherry-studio-miniapp/issues)，标题分别使用 `[model-stage]` 或 `[survivor-game]`。若最终公开源码位置发生变化，要同步更新根目录和两个应用 README 中的所有源码及反馈链接。

## 发现入口与收录 PR

在公开源码和真实安装入口准备好后：

- 给源码仓库添加 `cherry-studio-miniapp` GitHub Topic（仓库主题标签）。这个发现入口按仓库工作，不会自动把两个目录变成两个仓库结果。
- 按社区当前规则，仓库 Website 应填写可安装的发布清单 URL。它只有一个地址；暂定先指向主推应用模型布景，根 README 列出全部应用的独立安装清单。在 PR 中说明多应用情况；如果维护者要求其他方案，先确认约定，不将普通导航页默认为合规安装清单。
- 每应用分别提交一个收录 PR，仅向社区中英文 README 的对应分类添加该应用条目。不要向社区仓库提交本仓库源码、安装包或构建目录。
- 只在所有收录要求有证据后发布 PR；以下条目模板只是本地草稿。

模型布景条目（分别用于社区英文、中文 README）：

```markdown
- [Model Stage](https://github.com/zhangjiadi225/cherry-studio-miniapp/tree/main/apps/model-stage) — Stage local 3D models with lighting presets, camera controls and optional Cherry AI assistance. [Install manifest](MODEL_STAGE_MANIFEST_URL)
- [模型布景](https://github.com/zhangjiadi225/cherry-studio-miniapp/tree/main/apps/model-stage) — 用灯光方案、镜头控制和可选 Cherry AI 为本地 3D 模型布景。[安装清单](MODEL_STAGE_MANIFEST_URL)
```

暗夜幸存者条目（分别用于社区英文、中文 README）：

```markdown
- [Night Survivor](https://github.com/zhangjiadi225/cherry-studio-miniapp/tree/main/apps/survivor-game) — Forge AI-assisted weapons, validate and accept them, then use them in deterministic local survival combat. [Install manifest](SURVIVOR_GAME_MANIFEST_URL)
- [暗夜幸存者](https://github.com/zhangjiadi225/cherry-studio-miniapp/tree/main/apps/survivor-game) — 描述并锻造 AI 武器，经校验和接受后投入本地确定性生存战斗。[安装清单](SURVIVOR_GAME_MANIFEST_URL)
```

提交前将大写占位符替换为真实且已验收的 HTTPS 清单 URL，并确认源码链接公开可访问。PR 描述使用英文，说明共享源码仓库、该应用独立的 ID/版本/安装入口及验收信息；不声称另一款应用也已就绪。

## 收录前检查清单

- [x] 当前源码仓库已公开。
- [ ] 历史记录及代码、素材的公开风险已处理。
- [x] 项目自有源码已采用 MIT License。
- [ ] 第三方依赖与素材的来源及分发条件说明齐备。
- [ ] 应用 ID 归属、版本、包内清单及实际权限用途已确认。
- [ ] 该应用有直接可达的 HTTPS 安装清单，安装包完整性及大小信息正确。
- [ ] 当前 Cherry Studio 发布版的安装、运行和更新验收结果已记录。
- [ ] 该应用 README 有真实截图、功能限制、逐项权限说明、安装地址及公开反馈入口。
- [ ] 仓库主题标签、Website 和根目录应用表已配置。
- [ ] 英文与中文收录条目均无占位符，且 PR 只包含一个应用。

当前只确认了仓库公开和自有源码许可证；其余发布检查项仍需逐项取得证据，整理这份指南不等于它们已经通过。
