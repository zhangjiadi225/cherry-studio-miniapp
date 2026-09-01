# Cherry Mini App Foundation

Cherry miniapp monorepo 中可独立发布的共享基础层。

| 共享层 | 产物 | 职责 |
| --- | --- | --- |
| Runtime | `@cherry-miniapp/kit` | `window.cherry` 类型与薄封装、AI 流取消、模型可用性、存档、导出与剪贴板 |
| CLI | `@cherry-miniapp/cli` / `cherry-miniapp` | 创建 app、主线 manifest 校验、`.miniapp` 打包、分发清单 |
| Skills | `skills/cherry-miniapp-development` | 让 Codex 正确选择仓库、遵守沙箱和产品边界 |
| Specs | `specs/*.md` | 运行时、仓库模型、AI 产品与打包协议的共同真源 |

从 monorepo 根目录安装依赖，workspace 会把兼容版本的共享包链接给 app，并由根 `pnpm-lock.yaml` 统一锁定外部依赖。foundation 包对外发布时仍遵循 semver。

当前宿主契约基线为 Cherry Studio `main` 的 `56cf04c`（2026-08-30，PR #19475 合并后）。
