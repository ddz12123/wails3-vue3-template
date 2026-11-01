# Wails 3 + Vue 3 开箱即用模板

基于 `wails3 init` 生成的 Vue 3 模板，补齐了桌面应用常用的前端工程化与桥接封装，克隆后即可直接写业务。

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 桌面框架 | Wails v3 (Go) |
| 前端框架 | Vue 3.5 + TypeScript 5.9 + Vite 8 |
| UI | Element Plus（按需引入、支持暗色模式与动态主题色） |
| 状态管理 | Pinia + pinia-plugin-persistedstate |
| 路由 | Vue Router（hash 模式）+ NProgress |
| 请求 | Axios（统一响应解包、错误归一化、401 钩子、文件下载） |
| 工具库 | VueUse |
| 测试 | Vitest + Go testing |
| 规范 | ESLint 10 + Prettier + Husky + lint-staged + GitHub Actions |

## 快速开始

环境要求：Go 1.26+、Node.js 20.19+ / 22.12+、Wails CLI v3、pnpm 12+（模板默认包管理器）。

```bash
# 0.（推荐）裁剪模板：README 改写为极简版，删除 docs/、frontend/README.md
#    与本地构建产物（bin、.task、.mimosa、node_modules 等，新项目用不到）
node scripts/clean.mjs          # 先 --dry-run 预览；--remove-github 等选项见脚本帮助

# 1. 初始化模板：替换模块名、产品名、公司等占位符
node scripts/init.mjs

# 开发模式（自动安装前端依赖、生成 Go 绑定、热更新）
wails3 dev

# 生产构建
wails3 build

# 生成当前系统的安装包
wails3 package
```

> `wails3 dev` 启动时会先执行一次开发构建（编译 Go、生成绑定、构建 dev 前端），
> 然后启动 Vite 和桌面应用；它不是 `wails3 package`，不会生成安装包。
> 之后改 Vue/TS 由 Vite HMR 处理，改 Go 才会重新编译。
> `wails3 package` 也只处理当前系统，跨平台需要在对应系统或 CI 中分别执行。

仅调试前端界面：

```bash
cd frontend
pnpm install
pnpm dev
```

> 浏览器中直接运行时没有 Wails 运行时，Go 服务调用、系统对话框、剪贴板等能力不可用。
> 页面可通过 `isWailsRuntime()` 判断并展示降级状态。

### 常用脚本

在 `frontend` 目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm build:dev` | 类型检查 + 开发模式构建（不压缩） |
| `pnpm typecheck` | Vue/TS 类型检查 |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest 单元测试 / 监听模式 / 带覆盖率 |
| `pnpm lint` / `pnpm lint:fix` | ESLint 检查 / 自动修复 |
| `pnpm stylelint` / `pnpm stylelint:fix` | Stylelint 检查 / 自动修复 |
| `pnpm format` / `pnpm format:check` | Prettier 格式化 / 校验 |

也可以在项目根目录使用 Task：`wails3 task lint`、`wails3 task format`、`wails3 task typecheck`、`wails3 task test`、`wails3 task vet`、`wails3 task check`、`wails3 task generate:bindings`。

包管理器默认 `pnpm`，如需切换：`wails3 dev PACKAGE_MANAGER=npm`。

### 测试

```bash
cd frontend
pnpm test             # Vitest 单元测试
pnpm test:coverage    # 单元测试 + 覆盖率（核心模块带阈值门禁）

cd ..
wails3 task test   # 前端 + Go 测试
wails3 task check  # lint / format / typecheck / vet / test
```

前端单元测试统一放在 `frontend/src/tests/`，按模块分子目录（如 `bridge/`、`utils/`、`store/`），与源码分开管理；子目录尚不存在时新建即可。Go 测试与源码同目录（`*_test.go`，Go 惯例）；根目录 `tests/` 预留给未来的集成 / E2E 测试。

## 目录结构

```text
.
├── internal/
│   └── apperr/                # AppError + MarshalError（业务错误契约，服务包可导入）
├── logging.go                 # slog + 运行时日志轮转（LOG_LEVEL 可配）
├── version.go                 # 版本号/构建时间（ldflags 注入）
├── window_state.go            # 窗口状态记忆（大小/位置/最大化持久化）
├── theme_windows.go           # 系统深色模式探测（Windows 注册表；其他平台见 theme_other.go）
├── main.go                    # 应用入口、窗口配置、退出确认
├── LICENSE                    # MIT（占位信息由 scripts/init.mjs 一并替换）
├── docs/optional-features.md  # 可选功能与优化的实现示例（示例服务、Demo 页、托盘等）
├── scripts/clean.mjs          # 新项目裁剪（删除模板自述文档与本地构建产物）
├── scripts/init.mjs           # 模板初始化（替换模块名/产品信息占位符）
├── tests/                     # 集成 / E2E 测试预留目录
├── Taskfile.yml               # 构建/开发/lint/format 任务
└── frontend
    ├── .env / .env.development / .env.production
    ├── bindings/              # wails3 generate bindings 生成（勿手改）
    └── src
        ├── api/               # 业务 API 域模块统一出口（HTTP）
        ├── bridge/            # Wails 桥接层（核心）
        │   ├── call.ts        # 统一调用包装：环境校验 + 错误归一化
        │   ├── error.ts       # BridgeError / 业务错误码
        │   ├── runtime.ts     # 运行环境检测与就绪等待
        │   ├── window.ts      # 窗口控制
        │   ├── dialog.ts      # 系统原生对话框
        │   └── system.ts      # 外链、剪贴板、环境信息
        ├── constant/          # 存储前缀、主题默认值、路由名常量
        ├── router/            # 路由与守卫
        ├── store/             # Pinia（setting）
        ├── styles/            # 全局样式与主题变量
        ├── tests/             # 单元测试（按模块分子目录，与源码分开）
        ├── types/             # 环境变量、自动导入类型声明
        ├── utils/             # request / error / message / storage / color
        └── views/             # 页面（home 空白页 / 404）
```

> `bridge/services.ts` 不预置：接入 Go 服务后按需新建（见下文「调用 Go 服务」）。

## Wails 桥接层

所有本地能力统一从 `@/bridge` 导入，错误类型均为 `BridgeError`（`code` 可取 `not-ready` / `runtime` / `business` / `validation` / `unknown`）。Go 侧返回 `*AppError` 时，`businessCode` 会保留在错误对象上。

> Wails 会在页面加载完成后才注入运行环境。启动阶段如果需要在首屏立即调用 Go 服务，
> 先 `await whenWailsRuntimeReady()` 再发起调用；用户交互触发的调用通常不受影响。

### 1. 调用 Go 服务

模板不预置业务服务，按以下步骤接入：

1. 在 Go 中定义结构体方法，并注册到 `main.go` 的 `Services`；
2. 执行 `wails3 task generate:bindings`；
3. 在 `src/bridge/services.ts` 中封装一层（文件按需新建）：

```ts
import { UserService } from '@bindings/changeme';
import { createBridgeCall } from './call';

export const listUsers = createBridgeCall(UserService.List, {
  fallback: '获取用户列表失败',
});
```

> `@bindings/changeme` 中的 `changeme` 来自 `go.mod` 的 module 名称。
> 修改 module 后，同步修改 `services.ts` 的导入路径即可。

### 2. 订阅事件（按需使用）

模板未预置事件。需要 Go → 前端推送时：

1. Go 侧注册事件：`application.RegisterEvent[T]("domain:event")`（命名空间风格，如 `user:changed`）；
2. 执行 `wails3 task generate:bindings`，`@bindings/events` 会生成强类型事件名；
3. 前端订阅（返回值即取消订阅函数，组件卸载时记得调用）：

```ts
import { UserChanged } from '@bindings/events';
import { Events } from '@wailsio/runtime';

const off = Events.On(UserChanged, (event) => {
  console.log(event.data);
});
off();
```

Go 侧用 `app.Event.Emit("user:changed", payload)` 推送。

### 3. 窗口 / 对话框 / 系统能力

```ts
import { appWindow, openFile, saveFile, confirm, copyText, openExternal } from '@/bridge';

await appWindow.minimize();
await appWindow.toggleMaximise();

const file = await openFile({ Title: '选择文件' });
const target = await saveFile({ Filename: 'export.csv' });
const ok = await confirm({ Title: '提示', Message: '确认删除？' });

await copyText('hello');
await openExternal('https://v3.wails.io');
```

## 退出确认

用户点击关闭按钮（含 Alt+F4）时，Go 侧弹出系统确认框，确认后退出；系统关机/注销不拦截。
实现在 `main.go` 的 `WindowClosing` 钩子里，约 30 行：`event.Cancel()` 后用
`app.Dialog.Question()` 弹原生确认框，确认则 `app.Quit()`。调整文案改钩子中的
`SetTitle` / `SetMessage` 即可。

> 应用内新增菜单/托盘退出入口时，复用同样的「确认后再退出」逻辑，不要直接 `app.Quit()`。

## 窗口状态记忆

窗口大小、位置与最大化状态在退出时保存到 `<数据目录>/<appID>/window-state.json`（与日志同目录，NSIS 卸载时一并清理），下次启动自动恢复：

- 用户确认关闭时保存；系统关机等路径在 `OnShutdown` 补存；
- 保存的位置因显示器拔出 / 分辨率变化落到屏幕外时，启动后自动回退为居中；
- 最大化状态下退出沿用上次的普通窗口边界，「取消最大化」不会回到最大化尺寸；
- 全屏状态下退出不保存（避免把全屏尺寸写入普通状态）；
- 删除该文件即可重置窗口状态。

实现见 `window_state.go`；窗口初始背景色跟随系统深色模式（`theme_windows.go`），避免深色系统下启动闪白。

## 请求封装

HTTP 请求保留为普通前后端分离模式：`src/utils/request.ts` 提供 Axios 基座，`src/api/` 放业务域请求模块，组件不直接发请求。

```ts
// src/api/<domain>.ts
import { http } from '@/api';

export interface User {
  id: number;
  name: string;
}

export function listUsers(page = 1) {
  return http.get<User[]>('/users', { page });
}

export function createUser(name: string) {
  return http.post<User>('/users', { name });
}
```

```ts
// 使用
import { listUsers } from '@/api/<domain>';

const users = await listUsers();
```

- 默认按 `{ code, message, data }` 解包，`code` 为 `0` 或 `200` 视为成功；
- 非该结构（如第三方接口）会原样返回；
- 业务/HTTP 错误统一抛 `ApiError`（保留 `code`）；
- 文件下载使用 `http.download()`，返回完整 `AxiosResponse`，可读取 `Content-Disposition`；
- 401 通过 `setUnauthorizedHandler` 注册处理逻辑（模板不含登录页）：

```ts
import { setUnauthorizedHandler } from '@/api';

setUnauthorizedHandler(() => {
  // 例如：router.replace('/login')
});
```

请求前缀在 `.env.development` / `.env.production` 的 `VITE_API_BASE_URL` 中配置。

> 桌面端没有同源后端，生产环境的 `VITE_API_BASE_URL` 请填完整的后端地址（如 `https://api.example.com`），
> 或留空并全部走 Go 服务 / Wails 绑定。桌面端直连 HTTP 后端时，需要后端允许 WebView 来源的跨域请求。

### 错误模型

- `ApiError`：HTTP/业务接口错误，保留 `code`；
- `BridgeError`：Go binding / Wails runtime 错误，`code` 为 `not-ready`、`runtime`、`business`、`validation`、`unknown`；
- Go 侧返回 `*AppError` 时会通过 `MarshalError` 序列化，前端在 `businessCode` 中拿到业务码；
- `handleError()` 会把原始错误写入控制台，只向用户展示受控文案，避免把 Go 方法名、堆栈等内部细节弹到界面。

## 主题

- 明暗模式：`light` / `dark` / `system`，跟随系统变化；
- 主题色：运行时写入 Element Plus 的 `--el-color-primary*` 变量，无需重新编译；
- 两者均持久化到 localStorage。

```ts
import { useSettingStore } from '@/store';

const settingStore = useSettingStore();
settingStore.toggleTheme();
settingStore.setThemeMode('dark');
settingStore.setPrimaryColor('#7c3aed');
```

业务样式可直接使用以下 CSS 变量：

`--app-bg-color`、`--app-card-color`、`--app-text-color`、`--app-text-color-secondary`、`--app-border-color`、`--app-primary-color`、`--app-primary-color-rgb`。

## 打包安装程序

### Windows（NSIS）

需要安装 NSIS 3.x：

```bash
winget install NSIS.NSIS
```

```bash
wails3 package
```

产物：`bin/wails3-vue3-template-amd64-installer.exe`

安装界面包含目录选择页，用户可以自行选择安装位置。首次打包会下载 `build/windows/nsis/MicrosoftEdgeWebview2Setup.exe`（已加入 `.gitignore`），安装包用它给缺少 WebView2 的机器自动安装运行时，不需要手动运行。

安装范围默认 `INSTALL_SCOPE=machine`（装到 Program Files，需要 UAC 授权）；面向个人用户分发时建议改为每用户安装（装到 `%LOCALAPPDATA%`，无 UAC 提示）：

```bash
wails3 package INSTALL_SCOPE=user
```

卸载时会一并清理 WebView2 数据目录与 `%LOCALAPPDATA%\<appID>`（日志等应用数据）。

### MSIX

```bash
wails3 package FORMAT=msix
```

MSIX 的安装位置由 Windows 统一管理（`WindowsApps`），不支持自定义安装路径。

### macOS / Linux

- macOS：`wails3 package` 生成 `.app`；`wails3 task darwin:package:dmg` 生成 DMG
- Linux：`wails3 package` 生成 AppImage、deb、rpm 与 AUR 包

### 修改产品信息

推荐使用初始化脚本一键替换模块名与产品占位符（交互式提示，支持 `--dry-run` 预览）：

```bash
node scripts/init.mjs
# 或指定参数：node scripts/init.mjs --module github.com/acme/app --product-name "My App" ...
```

脚本会同步替换 `go.mod` 模块名、`@bindings/<module>` 导入路径、`build/config.yml`、`main.go`、
`Taskfile.yml`、`frontend/package.json`、`frontend/.env`、NSIS `INFO_PRODUCTID` 等位置，
并把 `frontend/bindings/<旧模块>` 目录移动到新模块名下。

手动修改时，编辑 `build/config.yml` 的 `info`（公司名、产品名、应用标识、版本、版权），并同步以下位置：

- 根目录 `Taskfile.yml` 的 `APP_NAME`
- `main.go` 的 `appName` 与 `appID`（`appID` 需要与 `productIdentifier` 一致）
- `frontend/package.json` 的 `name`（可选）
- `frontend/.env` 的 `VITE_APP_TITLE`
- `build/windows/nsis/project.nsi` 的 `INFO_PRODUCTID`（与 `productIdentifier` 一致）

然后重新生成构建资产与绑定：

```bash
wails3 task common:update:build-assets
```

该命令会更新 Windows 版本信息与 NSIS 变量、macOS `Info.plist`、Linux desktop/nfpm 配置。`build/windows/nsis/project.nsi` 不在更新范围内，需要调整安装脚本时直接修改它。`build/config.yml` 中的版本号会通过 ldflags 注入到 `main.Version`。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `VITE_APP_TITLE` | 应用标题（页面标题、界面展示） |
| `VITE_APP_ENV` | 环境标识 |
| `VITE_API_BASE_URL` | Axios 请求前缀；桌面构建建议填完整 URL，或留空 |

类型声明位于 `src/types/env.d.ts`，新增变量时同步补充。

## Go 端约定

业务能力通过 Go 服务暴露给前端：定义结构体方法 → 注册到 `main.go` 的 `Services` → 生成绑定 → 前端封装调用。

业务错误统一返回 `*apperr.AppError`，由 `application.Options.MarshalError` 序列化给前端。
契约类型放在 `internal/apperr`（main 包无法被导入，独立成包后服务拆到任何子包都能复用）：

```go
import "changeme/internal/apperr" // changeme 替换为你的 go.mod 模块名

func (s *XService) Do(name string) (string, error) {
    if name == "" {
        return "", &apperr.AppError{Code: "invalid_name", Message: "名称不能为空"}
    }
    return "ok", nil
}
```

> 服务数量少时直接写在 package main 即可；拆分到独立包（如 `internal/<domain>`）后
> 依然导入 apperr 即可保持错误契约，绑定路径会镜像 Go 包路径
> （`@bindings/<module>/internal/<domain>/...`）。

前端会得到 `BridgeError`，`code === 'business'`，业务码在 `businessCode`。

在 `main.go` 的 `Services` 中注册（当前为空），然后执行 `wails3 task generate:bindings`：

```go
Services: []application.Service{
    application.NewService(&XService{}),
},
```

版本号与构建时间由 Taskfile 自动注入：

- `APP_VERSION`：从 `build/config.yml` 的 `info.version` 读取；
- `BUILD_TIME`：构建时的 UTC 时间。

手动构建时可以覆盖：

```bash
go build -ldflags "-X main.Version=1.0.0 -X main.BuildTime=2026-01-01T00:00:00Z"
```

`app_meta_test.go` 会比对 `build/config.yml` 与 Go 常量，防止产品名、应用标识、默认版本漂移。

日志同时输出到 stderr 和 `application.Path(PathDataHome)/<appID>/logs/app.log`；单文件超过 5MB 轮转，保留 `app.log.1`～`app.log.3` 三份历史。日志级别通过环境变量 `LOG_LEVEL` 控制（`debug` / `info` / `warn` / `error`，默认 `info`）。Wails 的 `ErrorHandler` / `PanicHandler` 已接入同一 logger。

## 代码规范

```bash
cd frontend
pnpm install   # git 仓库中会自动安装 husky 钩子
```

如果项目还没有 git 仓库，先执行 `git init`，否则 husky 会跳过安装。

提交时 `lint-staged` 会对暂存文件执行 ESLint / Stylelint / Prettier；
提交信息由 commitlint 校验（Conventional Commits，如 `feat: 新增登录页`），不符合规范会被 `commit-msg` 钩子拦截。
`src/types/auto-imports.d.ts`、`src/types/components.d.ts` 由 unplugin 生成，已加入 ESLint/Prettier 忽略列表。
`bindings/` 为生成代码，请勿手动修改；修改 Go 服务后执行 `wails3 task generate:bindings` 重新生成。
GitHub 上仅保留一条流水线：推送 `v*` 标签触发 `.github/workflows/release.yml`，
在 Windows / macOS / Linux 三平台打包并发布到 GitHub Release。

## 可选功能示例

模板刻意保持精简。以下内容不预置代码，完整实现示例（可直接复制）见 `docs/optional-features.md`：

- 示例 Go 服务（打通 绑定生成 → 前端调用 → 业务错误 全链路）
- 首页 Demo 页（主题切换 / 窗口控制 / 系统信息）
- 自定义标题栏（frameless 窗口）
- 系统托盘
- i18n 接入
- CSP 收紧、PR CI、macOS 签名公证等优化项

## 常见问题

**Q：`vue-tsc` 报找不到 `ref`、`ElMessage` 等？**
A：先执行一次 `pnpm dev`（或 `pnpm exec vite build`）生成 `src/types/auto-imports.d.ts`。
`pnpm build` 会先执行 `vue-tsc`，类型声明缺失时无法用它来补生成。

**Q：启动阶段调用 Go 服务报 `not-ready`？**
A：Wails 在页面加载完成后才注入运行环境。启动阶段先 `await whenWailsRuntimeReady()` 再发起调用；
用户交互触发的调用通常不受影响。

**Q：修改 `go.mod` 的 module 名称后，前端编译失败？**
A：推荐直接运行 `node scripts/init.mjs`，它会同步模块名、`@bindings/<module>` 导入路径与绑定目录；
手动处理的话：重新执行 `wails3 task generate:bindings`，并更新 `src/bridge/services.ts`、`src/bridge/call.ts` 中的导入路径。

**Q：`wails3 build` 提示 `frontend/dist` 不存在？**
A：直接执行 `wails3 build` 会自动构建前端；单独执行 `go build` 前需先 `pnpm build`。

**Q：`go build ./...` 提示 `build/ios: function main is undeclared`？**
A：预期现象。`build/ios` 是 iOS 专用脚手架包，其入口带 `//go:build ios` 约束，
其他平台上 `go build ./...` 链接该包必然报错（官方脚手架限制）。
日常验证用 `go build .`（根包）、`go vet ./...` 或 `go test ./...`，构建应用用 `wails3 build`。

**Q：IDE 报 `pattern all:frontend/dist: no matching files found`？**
A：模板已通过 `frontend/dist/.gitkeep` 保证该目录始终存在，构建时也会自动补回占位文件。
若仍报错，请重新加载 Go 语言服务器（`go build ./...` 可先确认命令行是否正常）。

**Q：pnpm 安装时提示 `ERR_PNPM_IGNORED_BUILDS`？**
A：已在 `frontend/pnpm-workspace.yaml` 的 `allowBuilds` 中放行 `@parcel/watcher`；新增依赖按提示执行 `pnpm approve-builds`。
