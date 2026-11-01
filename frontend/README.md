# Frontend

Wails 3 + Vue 3 + TypeScript + Element Plus 前端工程。

完整使用说明见项目根目录的 [README](../README.md)。

## 开发

```bash
pnpm install
pnpm dev        # 仅前端（浏览器预览，无 Wails 本地能力）
```

首次安装依赖前请先确保项目已 `git init`，否则 husky 钩子会被跳过。

推荐使用 `wails3 dev` 在项目根目录启动，可同时获得 Go 热重载、绑定生成与完整的桌面能力。

## 关键目录

- `src/api`：业务接口域模块，统一从 `@/api` 导入 `http`
- `src/bridge`：Wails 桥接层（服务调用、事件、窗口、对话框、系统能力）
- `src/utils/request.ts`：Axios 基座（解包、错误归一化、401、下载）
- `src/store`：Pinia（主题、应用信息）
- `src/types`：环境变量与 unplugin 生成的类型声明
- `bindings`：`wails3 generate bindings` 生成，请勿手动修改

## 脚本

| 命令                                | 说明                |
| ----------------------------------- | ------------------- |
| `pnpm dev`                          | Vite 开发服务器     |
| `pnpm build`                        | 类型检查 + 生产构建 |
| `pnpm typecheck`                    | 类型检查            |
| `pnpm test` / `pnpm test:watch`     | Vitest 单元测试     |
| `pnpm lint` / `pnpm lint:fix`       | ESLint              |
| `pnpm format` / `pnpm format:check` | Prettier            |
