package main

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// 单个日志文件的大小上限，超过后轮转。
var maxLogSize int64 = 5 << 20

// maxLogBackups 是保留的历史日志份数（app.log.1 为最近一份）。
const maxLogBackups = 3

// parseLogLevel 从 LOG_LEVEL 环境变量解析日志级别，默认 info。
// 取值：debug / info / warn / error（大小写不敏感）。
func parseLogLevel() slog.Level {
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// newAppLogger 输出到 stderr，并尽量追加到应用数据目录的 app.log。
// 文件不可写时退回 stderr，不影响应用启动。
func newAppLogger() (*slog.Logger, func()) {
	writers := []io.Writer{os.Stderr}
	closeLog := func() {}

	if base := application.Path(application.PathDataHome); base != "" {
		logDir := filepath.Join(base, appID, "logs")
		if err := os.MkdirAll(logDir, 0o755); err == nil {
			logPath := filepath.Join(logDir, "app.log")
			if writer, err := newRotatingWriter(logPath); err == nil {
				writers = append(writers, writer)
				closeLog = func() { _ = writer.Close() }
			}
		}
	}

	return slog.New(slog.NewTextHandler(io.MultiWriter(writers...), &slog.HandlerOptions{
		Level: parseLogLevel(),
	})), closeLog
}

// rotatingWriter 追加写入日志文件，写入时检查大小并在超过 maxLogSize 后轮转，
// 保证长时间运行的进程日志体积有界。轮转复用 rotateLog（保留 maxLogBackups 份历史）。
type rotatingWriter struct {
	mu   sync.Mutex
	path string
	file *os.File
	size int64
}

// newRotatingWriter 打开（或创建）日志文件，并在启动时先做一次历史轮转。
func newRotatingWriter(path string) (*rotatingWriter, error) {
	rotateLog(path, maxLogBackups)

	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}

	size := int64(0)
	if info, err := file.Stat(); err == nil {
		size = info.Size()
	}

	return &rotatingWriter{path: path, file: file, size: size}, nil
}

func (w *rotatingWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// 写入前检查：超过上限先轮转，保证会话内文件体积有界。
	// 历史超限内容已在 newRotatingWriter 打开文件时由 rotateLog 处理。
	if w.size > 0 && w.size+int64(len(p)) > maxLogSize {
		w.rotate()
	}

	if w.file == nil {
		// 重新打开失败：丢弃本次日志（stderr 仍有输出），不影响应用运行。
		return len(p), nil
	}

	n, err := w.file.Write(p)
	w.size += int64(n)
	return n, err
}

// rotate 关闭当前文件并轮转；重新打开失败时置空 file，后续写入被丢弃。
func (w *rotatingWriter) rotate() {
	_ = w.file.Close()
	w.file = nil
	w.size = 0

	rotateLog(w.path, maxLogBackups)
	if file, err := os.OpenFile(w.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
		w.file = file
	}
}

// Close 关闭底层文件。
func (w *rotatingWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.file == nil {
		return nil
	}

	err := w.file.Close()
	w.file = nil
	return err
}

// rotateLog 在日志超过 maxLogSize 时轮转，保留 keep 份历史日志。
func rotateLog(path string, keep int) {
	info, err := os.Stat(path)
	if err != nil || info.Size() <= maxLogSize {
		return
	}

	_ = os.Remove(fmt.Sprintf("%s.%d", path, keep))
	for i := keep - 1; i >= 1; i-- {
		_ = os.Rename(fmt.Sprintf("%s.%d", path, i), fmt.Sprintf("%s.%d", path, i+1))
	}
	_ = os.Rename(path, path+".1")
}
