# @cherry-miniapp/cli

Cherry miniapp 的共享创建、校验和打包 CLI。

```bash
cherry-miniapp create my-app "My App" dev.example.my-app --root ./apps
cherry-miniapp validate
cherry-miniapp pack
cherry-miniapp distribution https://example.com/my-app-1.0.0.miniapp --icon https://example.com/icon.png
```

`pack` 只消费当前 app 的 `dist/`，不会隐式运行 build。产物默认写入 app 自己的 `artifacts/`。
校验器与 Cherry Studio 主线契约保持一致，包括 `releaseNotes`、clipboard/file export 权限、精确域名规则、保留命名空间和 `__cherry` 目录。
