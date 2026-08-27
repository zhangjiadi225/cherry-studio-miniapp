# 文档索引

本目录记录暗夜幸存者的产品方向、目标架构和需要长期保持兼容的协议。代码仍是当前行为的最终事实来源；当代码与文档不一致时，应先确认代码现状，再在同一变更中修正文档。

## 状态定义

- **Current**：描述已经存在的实现。
- **Target**：已确认的演进方向，允许尚未实现。
- **Draft Spec**：实现前的协议草案；字段仍可调整，但实现不得绕过其安全边界。
- **Active Spec**：已有实现依赖的兼容协议；破坏性变化需要迁移方案。

规范中的“必须”“不得”“应该”“可以”分别对应 MUST、MUST NOT、SHOULD、MAY。

## 文档地图

| 文档 | 状态 | 负责回答 |
| --- | --- | --- |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Current | 游戏现在如何组织和运行 |
| [`product/DIRECTION.md`](./product/DIRECTION.md) | Target | 产品为什么做 AI + 插件化、优先做什么 |
| [`architecture/TARGET_ARCHITECTURE.md`](./architecture/TARGET_ARCHITECTURE.md) | Target | 目标分层、模块所有权和迁移顺序 |
| [`specs/CONTENT_PACK.md`](./specs/CONTENT_PACK.md) | Draft Spec | AI/内置内容如何安全进入游戏 |
| [`specs/AI_GENERATION.md`](./specs/AI_GENERATION.md) | Draft Spec | AI 请求、校验、确认、失败恢复如何工作 |
| [`specs/CHERRY_RUNTIME.md`](./specs/CHERRY_RUNTIME.md) | Draft Spec | Cherry 权限、生命周期、存档和打包规则 |

## 真源优先级

1. 当前源码和当前 Cherry Host 合同。
2. Active Spec。
3. Current 架构文档。
4. Target 与 Draft Spec。

目标文档不能覆盖当前事实，当前实现也不能静默绕过规范。若实现需要改变协议，先更新对应规范并记录迁移影响。

## 更新规则

- 新增或改变 AI 工作流时，更新 `AI_GENERATION.md`。
- 改变内容包字段、行为原语、ID 或迁移规则时，更新 `CONTENT_PACK.md`。
- 改变权限、宿主 API、存档、生命周期或打包流程时，更新 `CHERRY_RUNTIME.md`。
- 改变模块所有权或依赖方向时，更新 `TARGET_ARCHITECTURE.md`。
- 当前代码完成迁移后，同步更新根目录 `ARCHITECTURE.md`，不要让它提前描述未实现模块。
