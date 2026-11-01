package main

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// minVisiblePixels 是恢复位置时要求窗口在屏幕上至少保留的可见像素，
// 避免恢复到几乎完全在屏幕外的位置。
const minVisiblePixels = 100

// windowState 是退出时持久化的主窗口状态（DIP 坐标，与窗口选项一致）。
// 最大化退出且没有普通边界记录时，宽高允许为 0（恢复时用模板默认尺寸）。
type windowState struct {
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Maximised bool `json:"maximised"`
}

// windowStatePath 返回状态文件路径：<DataHome>/<appID>/window-state.json，
// 与日志同目录，NSIS 卸载时会一并清理；无法定位数据目录时返回空串。
func windowStatePath() string {
	base := application.Path(application.PathDataHome)
	if base == "" {
		return ""
	}

	return filepath.Join(base, appID, "window-state.json")
}

// loadWindowState 读取上次退出时的窗口状态；无文件或内容非法时返回 nil。
func loadWindowState() *windowState {
	path := windowStatePath()
	if path == "" {
		return nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var state windowState
	if json.Unmarshal(data, &state) != nil || state.Width < 0 || state.Height < 0 {
		return nil
	}

	// 非最大化记录必须携带有效尺寸；最大化记录允许尺寸为 0（无普通边界记录）。
	if !state.Maximised && (state.Width <= 0 || state.Height <= 0) {
		return nil
	}

	return &state
}

// saveWindowState 尽力保存主窗口当前状态。
// 窗口未就绪 / 已销毁（尺寸为 0）、处于全屏时跳过，避免写入无效尺寸。
// 注意：内部通过 InvokeSync 读取窗口属性，只能在主循环运行期间调用
// （事件钩子或异步 goroutine），不要在 OnShutdown 的主线程上直接调用。
func saveWindowState(app *application.App) {
	path := windowStatePath()
	if path == "" || app == nil {
		return
	}

	window, ok := app.Window.GetByName(mainWindowName)
	if !ok {
		return
	}

	width, height := window.Size()
	if width <= 0 || height <= 0 || window.IsFullscreen() {
		return
	}

	x, y := window.Position()
	maximised := window.IsMaximised()

	// 最大化时 Size/Position 读到的是最大化状态的值，不代表普通窗口边界；
	// 原样保存会让下次「取消最大化」回到最大化尺寸（占满全屏）。
	// 这里沿用上一次保存的普通边界，只更新最大化标志。
	if maximised {
		width, height, x, y = normalBounds(loadWindowState())
	}

	data, err := json.Marshal(windowState{
		Width:     width,
		Height:    height,
		X:         x,
		Y:         y,
		Maximised: maximised,
	})
	if err != nil {
		return
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}

	// 先写临时文件再改名，避免写入中途被杀导致状态文件损坏。
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		slog.Debug("save window state failed", "error", err)
	}
}

// applyWindowState 把保存的尺寸与位置写入窗口选项，返回是否需要启动即最大化。
// 宽高为 0 表示没有普通边界记录（首次运行即最大化的场景），保持模板默认尺寸。
func applyWindowState(options *application.WebviewWindowOptions, state *windowState) bool {
	if state.Width > 0 && state.Height > 0 {
		options.Width = state.Width
		options.Height = state.Height
		options.X = state.X
		options.Y = state.Y
	}

	return state.Maximised
}

// normalBounds 返回最大化退出时应保存的普通窗口边界。
// prev 携带有效尺寸时沿用历史值；否则返回 0 值，
// 恢复时按模板默认尺寸最大化。
func normalBounds(prev *windowState) (width, height, x, y int) {
	if prev == nil || prev.Width <= 0 || prev.Height <= 0 {
		return 0, 0, 0, 0
	}

	return prev.Width, prev.Height, prev.X, prev.Y
}

// ensureWindowOnScreen 校验窗口位置：保存的位置可能因显示器拔出、分辨率变化而
// 落在屏幕外，当没有屏幕能容纳足够的窗口矩形时回退为居中。
// 由 WindowRuntimeReady 钩子调用（此时平台后端与屏幕列表已就绪）。
func ensureWindowOnScreen(app *application.App) {
	window, ok := app.Window.GetByName(mainWindowName)
	if !ok || window.IsMaximised() || window.IsFullscreen() {
		return
	}

	screens := app.Screen.GetAll()
	if len(screens) == 0 {
		return
	}

	x, y := window.Position()
	width, height := window.Size()
	for _, screen := range screens {
		if overlapsScreen(x, y, width, height, screen.Bounds) {
			return
		}
	}

	window.Center()
}

// overlapsScreen 判断窗口矩形与屏幕矩形的重叠是否达到 minVisiblePixels。
func overlapsScreen(x, y, width, height int, bounds application.Rect) bool {
	overlapX := min(x+width, bounds.X+bounds.Width) - max(x, bounds.X)
	overlapY := min(y+height, bounds.Y+bounds.Height) - max(y, bounds.Y)

	return overlapX >= minVisiblePixels && overlapY >= minVisiblePixels
}
