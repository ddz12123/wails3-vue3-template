//go:build !windows

package main

// systemPrefersDark 非 Windows 平台在 app.Run 前无法探测系统深色模式
// （Wails 平台后端尚未初始化），统一按浅色处理。
// macOS/Linux 如需消除深色模式首帧闪烁，见模板仓库 docs/optional-features.md 的
// 「深色模式首帧闪烁」一节（clean.mjs 裁剪新项目后该文档不在项目内）。
func systemPrefersDark() bool {
	return false
}
