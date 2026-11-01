# 可选功能与优化示例

模板刻意保持精简，本文档收录**未预置**的功能与优化的完整实现示例，按需复制即可。
所有代码均已对照 Wails v3.0.0 API 验证。

目录：

- [功能示例](#功能示例)
  - [1. 示例 Go 服务（打通绑定全链路）](#1-示例-go-服务打通绑定全链路)
  - [2. 首页 Demo 页](#2-首页-demo-页)
  - [3. 自定义标题栏（frameless）](#3-自定义标题栏frameless)
  - [4. 系统托盘](#4-系统托盘)
  - [5. i18n 接入](#5-i18n-接入)
- [优化项](#优化项)
  - [6. 收紧生产 CSP 的 connect-src](#6-收紧生产-csp-的-connect-src)
  - [7. PR / push CI 流水线](#7-pr--push-ci-流水线)
  - [8. macOS 签名与公证](#8-macos-签名与公证)
  - [9. 生产构建保留隐藏 sourcemap](#9-生产构建保留隐藏-sourcemap)
- [已知限制与扩展](#已知限制与扩展)
  - [10. 深色模式首帧闪烁（macOS / Linux 扩展）](#10-深色模式首帧闪烁macos--linux-扩展)

---

## 功能示例

### 1. 示例 Go 服务（打通绑定全链路）

模板 `main.go` 的 `Services` 为空，绑定目录里只有 Wails 内部事件。接入业务服务前，
可以先用下面这个最小示例跑通 **定义服务 → 注册 → 生成绑定 → 前端调用 → 业务错误** 全链路。

**① 新建 `greet.go`（根目录）：**

```go
package main

import (
	"fmt"

	"changeme/internal/apperr"
)

// GreetService 是示例服务：演示绑定方法、结构化入参与 *apperr.AppError 业务错误。
type GreetService struct{}

func (s *GreetService) Greet(name string) (string, error) {
	if name == "" {
		return "", &apperr.AppError{Code: "empty_name", Message: "名字不能为空"}
	}
	return fmt.Sprintf("Hello, %s!", name), nil
}
```

**② 注册到 `main.go` 的 `application.Options`：**

```go
Services: []application.Service{
	application.NewService(&GreetService{}),
},
```

**③ 生成绑定：**

```bash
wails3 task generate:bindings
```

生成 `frontend/bindings/<module>/greetservice.ts`。

**④ 新建 `frontend/src/bridge/services.ts`（bridge 层约定文件，模板按需新建）：**

```ts
import { GreetService } from '@bindings/changeme/greetservice';
import { createBridgeCall } from './call';

/** 调用失败时抛出 BridgeError：业务错误 code === 'business'，业务码在 businessCode */
export const greet = createBridgeCall(GreetService.Greet, { fallback: '调用问候服务失败' });
```

> `@bindings/changeme` 的 `changeme` 是 `go.mod` 的模块名，init 脚本会自动同步。

**⑤ 在组件中使用：**

```vue
<script setup lang="ts">
import { greet } from '@/bridge/services';
import { handleError } from '@/utils/error';
import { message } from '@/utils/message';
import { ref } from 'vue';

const greeting = ref('');
const name = ref('Wails');

async function onGreet(): Promise<void> {
  try {
    greeting.value = await greet(name.value);
  } catch (error) {
    // business 错误会展示 Go 侧的受控文案（"名字不能为空"）
    handleError(error, '问候失败');
    return;
  }
  message.success(greeting.value);
}
</script>

<template>
  <el-input v-model="name" placeholder="输入名字" />
  <el-button type="primary" @click="onGreet">打招呼</el-button>
  <p>{{ greeting }}</p>
</template>
```

### 2. 首页 Demo 页

模板首页是空白页。以下是一个最小 Demo（主题切换、窗口控制、系统信息），
可直接替换 `frontend/src/views/home/index.vue`，或放到 `views/demo/` 下加路由：

```vue
<script setup lang="ts">
import { appWindow, getEnvironment } from '@/bridge';
import type { EnvironmentInfo } from '@/bridge';
import { useSettingStore, type ThemeMode } from '@/store';
import { handleError } from '@/utils/error';
import { onMounted, ref } from 'vue';

defineOptions({ name: 'Demo' });

const settingStore = useSettingStore();
const env = ref<EnvironmentInfo>();

function onThemeChange(value: string | number | boolean | undefined): void {
  settingStore.setThemeMode(value as ThemeMode);
}

onMounted(async () => {
  try {
    env.value = await getEnvironment();
  } catch (error) {
    handleError(error, '获取环境信息失败');
  }
});
</script>

<template>
  <main class="demo">
    <h2>主题</h2>
    <el-radio-group :model-value="settingStore.themeMode" @change="onThemeChange">
      <el-radio-button value="light">浅色</el-radio-button>
      <el-radio-button value="dark">深色</el-radio-button>
      <el-radio-button value="system">跟随系统</el-radio-button>
    </el-radio-group>
    <el-color-picker
      :model-value="settingStore.primaryColor"
      @change="(v?: string) => v && settingStore.setPrimaryColor(v)"
    />

    <h2>窗口</h2>
    <el-space>
      <el-button @click="appWindow.minimize()">最小化</el-button>
      <el-button @click="appWindow.toggleMaximise()">最大化切换</el-button>
      <el-button @click="appWindow.toggleFullscreen()">全屏切换</el-button>
      <el-button @click="appWindow.center()">居中</el-button>
    </el-space>

    <h2>系统信息</h2>
    <pre v-if="env">{{ JSON.stringify(env, null, 2) }}</pre>
  </main>
</template>
```

### 3. 自定义标题栏（frameless）

模板默认用系统标题栏；`bridge/window.ts` 的 `appWindow` 就是为自定义标题栏准备的。

**① `main.go` 窗口选项打开无边框**（Windows / Linux；macOS 建议保持 `MacTitleBarHiddenInset`）：

```go
WebviewWindowOptions{
	// ...
	Frameless: true,
	Windows: application.WindowsWindow{
		// 可选：去掉 Aero 阴影与圆角（部分场景需要）
		// DisableFramelessWindowDecorations: true,
	},
}
```

**② 新建 `frontend/src/components/TitleBar.vue`：**

拖拽区域由 CSS 变量 `--wails-draggable: drag` 声明，按钮区域显式 `no-drag`。

```vue
<script setup lang="ts">
import { appWindow } from '@/bridge';
import { isWindows } from '@/bridge/system';
import { computed } from 'vue';

const title = computed(() => import.meta.env.VITE_APP_TITLE);

function onDoubleClick(): void {
  void appWindow.toggleMaximise();
}
</script>

<template>
  <!-- macOS 用 HiddenInset 保留红绿灯，无需本组件；此处仅 Windows / Linux 挂载 -->
  <header
    v-if="isWindows()"
    class="title-bar"
    style="--wails-draggable: drag"
    @dblclick="onDoubleClick"
  >
    <span class="title-bar__title">{{ title }}</span>
    <div class="title-bar__actions" style="--wails-draggable: no-drag">
      <button class="tb-btn" title="最小化" @click="appWindow.minimize()">─</button>
      <button class="tb-btn" title="最大化" @click="appWindow.toggleMaximise()">□</button>
      <button class="tb-btn tb-btn--close" title="关闭" @click="appWindow.close()">✕</button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding-left: 12px;
  user-select: none;
  background: var(--app-card-color);

  &__actions {
    display: flex;
    height: 100%;
  }
}

.tb-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--app-text-color-secondary);
  cursor: pointer;

  &:hover {
    background: var(--app-border-color);
  }

  &--close:hover {
    background: #e81123;
    color: #fff;
  }
}
</style>
```

**③ 在 `App.vue` 挂载**（布局可自行扩展为侧栏 + 内容区）：

```vue
<template>
  <el-config-provider :locale="zhCn">
    <TitleBar />
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </el-config-provider>
</template>
```

> 关闭按钮会触发 `main.go` 的退出确认钩子，行为与系统标题栏一致。

### 4. 系统托盘

**① `main.go` 嵌入图标并创建托盘**（放在 `app.Run()` 之前）：

```go
import _ "embed"

// 复用模板自带的应用图标
//
//go:embed build/appicon.png
var trayIcon []byte

func setupSystemTray(app *application.App) {
	tray := app.SystemTray.New()
	tray.SetIcon(trayIcon)
	tray.SetTooltip(appName)

	menu := application.NewMenu()
	menu.Add("显示主窗口").OnClick(func(*application.Context) {
		if window, ok := app.Window.GetByName(mainWindowName); ok {
			window.Restore()
			window.Show()
			window.Focus()
		}
	})
	menu.AddSeparator()
	menu.Add("退出").OnClick(func(*application.Context) {
		// 与窗口关闭共用「确认后退出」：置位 allowExit 跳过确认，或复用确认对话框
		allowExit.Store(true)
		app.Quit()
	})

	tray.SetMenu(menu)
}
```

**② 在 `main()` 中 `app.Run()` 前调用 `setupSystemTray(app)`。**

> - 若希望关闭按钮最小化到托盘而不是弹确认框：把 `WindowClosing` 钩子里的确认逻辑
>   换成 `window.Hide()`，并在托盘菜单「退出」里走确认流程；
> - 托盘退出直接 `app.Quit()` 会跳过确认框，建议弹确认对话框后再退出（与 README 约定一致）。

### 5. i18n 接入

模板文案目前硬编码中文。需要多语言时接入 `vue-i18n`：

```bash
cd frontend && pnpm add vue-i18n@11
```

**`src/i18n/index.ts`：**

```ts
import { createI18n } from 'vue-i18n';

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': { common: { confirm: '确定', cancel: '取消' } },
    'en-US': { common: { confirm: 'OK', cancel: 'Cancel' } },
  },
});
```

**`main.ts`：** `app.use(i18n)`（`setupRouter` 之前）。语言偏好可加入 setting store 的
`persist.pick` 列表持久化。Go 侧对话框文案（如退出确认）需要语言时，可通过服务方法传参或在
Go 侧读取同一偏好。

---

## 优化项

### 6. 收紧生产 CSP 的 connect-src

`vite.config.ts` 生产 CSP 目前 `connect-src *`（为保留直连任意后端的能力）。
若后端地址构建期已知，可从环境变量注入：

```ts
const apiBase = process.env.VITE_API_BASE_URL?.trim();
const connectSrc = ["'self'", apiBase].filter(Boolean).join(' ');
// PRODUCTION_CSP 中替换 "connect-src *" 为 `connect-src ${connectSrc}`
```

运行时才允许用户改后端地址的应用保持 `*` 即可（并保留注释说明取舍）。

### 7. PR / push CI 流水线

模板仅有 release 流水线。新增 `.github/workflows/ci.yml`：

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
          cache: true
      - uses: pnpm/action-setup@v4
        with:
          version: 12.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - name: Install wails3 CLI
        run: go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0
      - run: wails3 task check
```

> Go 侧没有独立 lint 工具链时，`check` 已覆盖 lint / format / typecheck / vet / test。

### 8. macOS 签名与公证

release.yml 打出的 dmg 未签名，用户首次打开需右键 → 打开。有 Apple 开发者账号后，
在 macos job 的「Build packages」前插入：

```yaml
- name: Import signing identity
  env:
    MACOS_CERT_P12: ${{ secrets.MACOS_CERT_P12 }}       # base64 的 .p12 证书
    MACOS_CERT_PASSWORD: ${{ secrets.MACOS_CERT_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    echo "$MACOS_CERT_P12" | base64 --decode > cert.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security import cert.p12 -k build.keychain -P "$MACOS_CERT_PASSWORD" -T /usr/bin/codesign
    security list-keychains -d user -s build.keychain
    security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" build.keychain
- name: Build packages
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    CODESIGN_IDENTITY: "Developer ID Application: Your Name (TEAMID)"
  run: wails3 task darwin:package:dmg INSTALL_SCOPE=user
```

> 签名/公证参数是否由 wails3 CLI 原生透传，以所用版本的 `wails3 package --help` 为准；
> 也可以在打包后单独对 `.app` 执行 `codesign --deep --force` 与 `xcrun notarytool submit`。

### 9. 生产构建保留隐藏 sourcemap

线上崩溃无法符号化时，把 `vite.config.ts` 的

```ts
sourcemap: false,
```

改为：

```ts
// hidden：生成 .map 但产物不引用，不暴露源码，可用于崩溃还原
sourcemap: 'hidden',
```

需要上传到错误监控平台（Sentry 等）时配合其上传脚本使用。

---

## 已知限制与扩展

### 10. 深色模式首帧闪烁（macOS / Linux 扩展）

窗口初始背景色在 Windows 上通过注册表跟随系统深色模式（`theme_windows.go`）。
darwin/linux 的 Wails 平台后端在 `app.Run()` 之后才初始化，`app.Run` 前无法探测，
因此 `theme_other.go` 固定返回浅色。

如需覆盖这两个平台，常见做法是在 `WindowRuntimeReady` 之前（即平台后端就绪后）用
`app.Env.IsDarkMode()` 创建窗口——即把主窗口的创建从 `app.Run` 之前挪到
`ApplicationStarted` 事件回调中，代价是窗口出现稍晚、`main.go` 流程变长，模板未采用。

用户**显式**选择的深色主题不受此影响：前端在 `main.ts` 挂载前同步应用主题类，
HTML 首帧即是正确配色，闪烁仅存在于 WebView 初始化的短暂窗口期。
