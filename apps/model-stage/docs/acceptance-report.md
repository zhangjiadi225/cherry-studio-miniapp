# 模型布景 v0.1 开发验收报告

> 历史报告：其中的中性摄影棚方案已被 v0.3.7 的“纯黑背景 + `Y=0` 网格 + 无实体地面或内置模型”空工作区取代。

> 日期：2026-08-31  
> 范围：代码落地、静态检查、开发构建与 MiniApp 打包  
> 宿主内人工 UI/WebGL/E2E：按仓库规则未代替用户执行

## 验收目标映射

### 1. 通过 Cherry AI 对话修改 3D 场景

- `AiPlanner` 使用 Cherry 的 `default` 模型槽和流式文本能力。
- 每轮把当前 SceneDocument 安全摘要、revision token、主模型逻辑 ID、材质槽和能力摘要发送给 AI；不发送 File、路径、URL 或模型字节。
- AI 只允许返回 `skenora.scene.patch` V1。应用先执行 JSON 提取和产品策略，再调用 Skenora 预检；解析、策略或预检失败时最多修复一次。
- 只有 Skenora 返回 `committed` 才更新 UI；revision/hash 不匹配、资源操作、模型替换或校验失败均不会部分应用。

对应实现：`src/ai-planner.ts`、`src/scene-controller.ts`。

### 2. 支持用户传入本地模型

- 文件选择支持 GLB，以及 glTF 与同时选择的 sidecars。
- Skenora 使用内存 workspace 和严格模型加载策略；默认进行 bounds-center、ground placement、移除内嵌灯光和自动取景。
- 新模型成功导入后才移除上一模型；AI 上下文只暴露逻辑 asset/entity ID 与安全元数据。
- 模型二进制不上传到 Cherry AI。应用重启后需要用户重新选择本地文件完成绑定。

对应实现：`index.html`、`src/scene-controller.ts`、`src/main.ts`。

### 3. 支持连续对话调整场景

- 保存最近 20 条 UI 对话，向下一轮 AI 携带最近 8 条上下文，并在每轮重新读取最新 revision 和 SceneDocument。
- 支持连续修改环境、灯光、镜头、模型 transform，以及 Skenora JSON 能力允许的材质、动画、镜头路径、Flow 和安全非模型实体。
- 支持取消、撤销、重做、查看最近一次已校验 JSON、重新取景、重置视角和导出场景。
- 小程序隐藏时取消 AI 请求、暂停 3D Runtime 并保存状态；恢复前台后重新检查 Cherry 默认模型能力。

对应实现：`src/main.ts`、`src/state.ts`、`src/ai-planner.ts`。

## 已完成的机器校验

| 校验 | 结果 |
| --- | --- |
| `tsc -p tsconfig.json` | 通过 |
| `vite build` | 通过，323 个分发文件 |
| `cherry-miniapp validate` | 通过，解包体积 4,705,383 bytes |
| `cherry-miniapp pack` | 通过，开发包 1,259,855 bytes |

开发包：`artifacts/model-stage-0.1.0.miniapp`  
SHA-256：`8e87203fca107045b13eb184204162b1be79a7c16f581e563517e8275a08b586`

构建存在一个非阻断警告：Skenora/Babylon 主 chunk 约 2.87 MB（gzip 约 733 KB），后续可按真实启动耗时决定是否拆包。

## Cherry Studio 内人工验收步骤

1. 安装开发包，确认中性摄影棚和 WebGL 视口正常出现。
2. 导入一个 GLB，确认模型居中、落地、自动取景且可以 orbit/zoom。
3. 依次对话：“把背景换成暖灰色”“增加柔和轮廓光”“镜头转到左前方并靠近”“把模型向右旋转 30 度”。
4. 每轮确认画面实际改变、JSON 的 revision 更新，并能撤销/重做；第四轮应能理解前三轮后的当前场景。
5. 尝试要求 AI 替换或删除本地模型，确认请求被策略拒绝且场景保持不变。
6. 隐藏小程序时发起中的 AI 应被取消；重新打开后需要重新绑定本地模型。

人工验收通过后，三个产品目标即可从“代码与打包完成”升级为“Cherry Studio 真实宿主验收完成”。
