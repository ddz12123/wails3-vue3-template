package main

import (
	"embed"
	"log/slog"
	"os"
	"sync/atomic"

	"changeme/internal/apperr"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// appName 是展示名称，同时用于应用元信息与窗口标题。
// 可执行文件名由 Taskfile.yml 的 APP_NAME 控制，两者可以不同。
const appName = "Wails3 Vue3 Template"

// appID 用于单实例锁，需要与 build/config.yml 的 productIdentifier 保持一致。
const appID = "com.example.wails3vue3template"

// mainWindowName 用于按名获取主窗口，避免在 goroutine 间共享窗口变量。
const mainWindowName = "main"

var (
	// allowExit 为 true 时放行窗口关闭（已确认退出 / 系统关机）。
	allowExit atomic.Bool
	// exitPrompting 防止重复弹出退出确认框。
	exitPrompting atomic.Bool
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.
//
// frontend/dist/.gitkeep 用于保证目录在未构建前端时也存在，
// 否则 go list（IDE 语言服务器）会报 "pattern all:frontend/dist: no matching files found".
//
//go:embed all:frontend/dist
var assets embed.FS

// initialBackgroundColour 返回窗口初始背景色，跟随系统深色模式，
// 避免深色系统下启动瞬间闪白。色值与 styles/index.scss 保持一致
// （#f5f7fa / 深色 #141414）。用户显式选择的主题由前端在挂载前应用（main.ts），
// 窗口创建发生在 app.Run 之前，Go 侧读不到 localStorage。
func initialBackgroundColour() application.RGBA {
	if systemPrefersDark() {
		return application.NewRGB(20, 20, 20)
	}

	return application.NewRGB(245, 247, 250)
}

// main function serves as the application's entry point.
func main() {
	logger, closeLog := newAppLogger()
	slog.SetDefault(logger)

	app := application.New(application.Options{
		Name:        appName,
		Description: "Wails 3 + Vue 3 + TypeScript + Element Plus desktop app",
		Logger:      logger,
		ErrorHandler: func(err error) {
			logger.Error("wails error", "error", err)
		},
		PanicHandler: func(details *application.PanicDetails) {
			logger.Error("panic in application", "error", details.Error, "stack", details.StackTrace)
		},
		// AppError 会被序列化给前端；普通 error 返回 nil 走 Wails 默认处理。
		MarshalError: apperr.MarshalError,
		// 按需注册业务服务，新增后执行 wails3 task generate:bindings（见 README）
		Services: []application.Service{},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: appID,
			OnSecondInstanceLaunch: func(_ application.SecondInstanceData) {
				currentApp := application.Get()
				if currentApp == nil {
					return
				}

				window, ok := currentApp.Window.GetByName(mainWindowName)
				if !ok {
					return
				}

				window.Restore()
				window.Show()
				window.Focus()
			},
		},
		// 不设置 ShouldQuit：Windows 的 WM_ENDSESSION（关机/注销）也会走 App.Quit，
		// 这里只拦截用户关闭主窗口，避免阻塞系统关机。
		OnShutdown: func() {
			// 应用已开始退出（含系统关机），不再弹退出确认框。
			allowExit.Store(true)

			// 系统关机等不走确认框的退出路径补存窗口状态（用户确认关闭时已保存过）。
			// 异步执行：darwin/linux 的主循环退出后主线程不再派发跨线程调用，
			// 文件很小，极端情况下丢失也只是回退到上一次保存的状态。
			if currentApp := application.Get(); currentApp != nil {
				go saveWindowState(currentApp)
			}
		},
	})

	// 恢复上次退出时的窗口尺寸与位置（首次运行使用默认值，由系统居中）。
	restoreMaximised := false
	windowOptions := application.WebviewWindowOptions{
		Name:      mainWindowName,
		Title:     appName,
		Width:     1100,
		Height:    720,
		MinWidth:  900,
		MinHeight: 600,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: initialBackgroundColour(),
		URL:              "/",
	}
	if state := loadWindowState(); state != nil {
		restoreMaximised = applyWindowState(&windowOptions, state)
	}

	mainWindow := app.Window.NewWithOptions(windowOptions)

	// 上次退出时是最大化：窗口尚未显示时置 StartState，启动即最大化。
	if restoreMaximised {
		mainWindow.Maximise()
	}

	// 窗口就绪后校验位置：保存的位置可能因显示器变化落到屏幕外，回退居中。
	mainWindow.RegisterHook(events.Common.WindowRuntimeReady, func(_ *application.WindowEvent) {
		ensureWindowOnScreen(app)
	})

	// 用户点击关闭按钮时先弹系统确认框，确认后退出；不拦截系统关机/注销。
	mainWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		if allowExit.Load() {
			return
		}

		event.Cancel()

		go func() {
			if !exitPrompting.CompareAndSwap(false, true) {
				return
			}
			defer exitPrompting.Store(false)

			// 按名获取主窗口，避免跨 goroutine 捕获窗口变量。
			currentApp := application.Get()
			if currentApp == nil {
				return
			}
			window, ok := currentApp.Window.GetByName(mainWindowName)
			if !ok {
				return
			}

			confirmed := false
			currentApp.Dialog.Question().
				SetTitle("确认退出").
				SetMessage("确定要退出应用吗？").
				AttachToWindow(window).
				AddButtons([]*application.Button{
					{Label: "取消", IsCancel: true},
					{Label: "退出", IsDefault: true, Callback: func() { confirmed = true }},
				}).
				Show()

			if confirmed {
				saveWindowState(currentApp)
				allowExit.Store(true)
				currentApp.Quit()
			}
		}()
	})

	if err := app.Run(); err != nil {
		logger.Error("application run failed", "error", err)
		closeLog()
		os.Exit(1)
	}

	closeLog()
}
