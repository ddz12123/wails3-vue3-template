package main

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseLogLevel(t *testing.T) {
	tests := []struct {
		env  string
		want slog.Level
	}{
		{"", slog.LevelInfo},
		{"debug", slog.LevelDebug},
		{"DEBUG", slog.LevelDebug},
		{"info", slog.LevelInfo},
		{"warn", slog.LevelWarn},
		{"warning", slog.LevelWarn},
		{"error", slog.LevelError},
		{"nonsense", slog.LevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.env, func(t *testing.T) {
			t.Setenv("LOG_LEVEL", tt.env)
			if got := parseLogLevel(); got != tt.want {
				t.Fatalf("parseLogLevel() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRotateLogKeepsBackups(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "app.log")

	writeLog := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	// 低于上限：不轮转
	writeLog("app.log", "small")
	rotateLog(path, maxLogBackups)
	if _, err := os.Stat(path + ".1"); !os.IsNotExist(err) {
		t.Fatal("expected no rotation for small log")
	}

	// 高于上限：轮转并保留 keep 份
	writeLog("app.log", strings.Repeat("x", int(maxLogSize)+1))
	writeLog("app.log.1", "old-1")
	writeLog("app.log.2", "old-2")
	writeLog("app.log.3", "old-3")

	rotateLog(path, maxLogBackups)

	if _, err := os.Stat(path + ".4"); !os.IsNotExist(err) {
		t.Fatal("backup beyond keep count should be removed")
	}

	content, err := os.ReadFile(path + ".3")
	if err != nil || string(content) != "old-2" {
		t.Fatalf("app.log.3 = %q, %v; want old-2", content, err)
	}

	content, err = os.ReadFile(path + ".1")
	if err != nil || len(content) <= int(maxLogSize) {
		t.Fatalf("app.log.1 should hold the rotated oversized log, got %d bytes, %v", len(content), err)
	}

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("current log should be renamed away")
	}
}
