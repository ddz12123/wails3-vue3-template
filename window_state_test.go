package main

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestNormalBounds(t *testing.T) {
	// 有历史记录：沿用上次的普通边界
	w, h, x, y := normalBounds(&windowState{Width: 1100, Height: 720, X: 40, Y: 60})
	if w != 1100 || h != 720 || x != 40 || y != 60 {
		t.Fatalf("normalBounds(prev) = %d,%d,%d,%d; want 1100,720,40,60", w, h, x, y)
	}

	// 无历史记录：返回 0 值，恢复时用模板默认尺寸
	w, h, x, y = normalBounds(nil)
	if w != 0 || h != 0 || x != 0 || y != 0 {
		t.Fatalf("normalBounds(nil) = %d,%d,%d,%d; want zeros", w, h, x, y)
	}

	// 历史记录损坏（尺寸非法）：同样返回 0 值
	w, h, _, _ = normalBounds(&windowState{Width: -1, Height: 0})
	if w != 0 || h != 0 {
		t.Fatalf("normalBounds(invalid) = %d,%d; want zeros", w, h)
	}
}

func TestApplyWindowState(t *testing.T) {
	// 普通记录：恢复尺寸与位置
	options := application.WebviewWindowOptions{Width: 1100, Height: 720}
	if applyWindowState(&options, &windowState{Width: 1280, Height: 800, X: 100, Y: 50}) {
		t.Fatal("applyWindowState() = true, want false")
	}
	if options.Width != 1280 || options.Height != 800 || options.X != 100 || options.Y != 50 {
		t.Fatalf("options = %+v, want restored bounds", options)
	}

	// 最大化记录且无普通边界（宽高为 0）：保留默认尺寸，仅恢复最大化标志
	options = application.WebviewWindowOptions{Width: 1100, Height: 720}
	if !applyWindowState(&options, &windowState{Maximised: true}) {
		t.Fatal("applyWindowState() = false, want true")
	}
	if options.Width != 1100 || options.Height != 720 {
		t.Fatalf("options = %+v, want default size kept", options)
	}
}
