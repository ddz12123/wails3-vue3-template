//go:build windows

package main

import "golang.org/x/sys/windows/registry"

// systemPrefersDark 读取系统「应用模式」的深色设置（设置 → 个性化 → 颜色）。
// 读取失败时按浅色处理。
//
// 只覆盖默认的「跟随系统」主题：窗口创建发生在 app.Run 之前，无法读取
// localStorage，用户显式选择的主题由前端在挂载前立即应用（main.ts）。
func systemPrefersDark() bool {
	key, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`,
		registry.QUERY_VALUE,
	)
	if err != nil {
		return false
	}
	defer key.Close()

	// AppsUseLightTheme：1 = 浅色，0 = 深色。
	value, _, err := key.GetIntegerValue("AppsUseLightTheme")
	if err != nil {
		return false
	}

	return value == 0
}
