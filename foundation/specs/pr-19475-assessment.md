# PR #19475 主线落地评估

来源：[feat(mini-app): add real local mini apps in a sandbox](https://github.com/CherryHQ/cherry-studio/pull/19475)。
该 PR 已于 2026-08-28 合并到 Cherry Studio `main`；本评估于 2026-08-30 按最终 30 个提交和主线
[`56cf04c`](https://github.com/CherryHQ/cherry-studio/commit/56cf04c3c7d717c51ed9039eab70a7199d11d7f1)
复核。

## 结论

本地 miniapp 已成为 Cherry 的正式主线能力：`.miniapp` 安装包、独立 session、权限沙箱、宿主能力桥、
更新/回滚/卸载、活动日志和内置应用目录均已落地。当前契约足以支撑离线 UI、用户模型驱动的轻量 AI
游戏和 AI 工具。

最终合并版本相对最初快照新增或改变了以下作者可见行为：

- `ai.getCapabilities()` 使用 `available` 判别模型槽位是否可用。
- 新增 `file.export` 和 `clipboard.read` / `clipboard.write`。
- AI 和网络增加不会随时间恢复的隐藏态调用额度。
- optional permissions 在安装卡片中默认勾选，由用户主动取消。
- 宿主记录每个应用的能力活动，但不记录调用载荷。
- 安装、更新、回滚和 quiesce 路径经过额外的安全与崩溃恢复加固。

## 对批量开发的影响

1. **兼容层仍然必须保留。** 参数和返回形状由宿主文档维护，业务 app 不应散落直接的
   `window.cherry` 调用。
2. **产品保持 local-first。** 所有运行资源打进包内，AI 使用 Cherry 用户自己的模型；只有明确的
   跨设备或共享需求才申请 network 权限。
3. **存档使用单文档。** 没有多 key 事务，也没有可靠销毁通知；一个 JSON key 保存完整可恢复状态最稳。
4. **先判断模型可用。** `available: false` 是正常值，不是异常；AI 入口应禁用或提供本地降级。
5. **后台不做轮询。** 隐藏态 AI 和网络额度不会随时间补充，等待后重试只会制造更多拒绝日志。
6. **开发 mock 不能代替宿主验证。** 普通浏览器无法精确复现 opaque origin、CSP、请求拦截、焦点、
   keep-alive、活动日志和 quiesce。

## 适合的产品方向

- AI 文明、剧情和推理游戏。
- 提示词、世界观、角色卡和分镜等创作工作台。
- 苏格拉底教练、面试官和谈判陪练。
- 需要用户明确导出文件或在前台复制粘贴文本的轻量工具。

实时多人、摄像头/麦克风、语音通话、外部网页嵌入和重度云同步仍不适合作为核心玩法。
