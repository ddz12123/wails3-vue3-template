package main

var (
	// Version 与 BuildTime 由 Taskfile 从 build/config.yml 读取，
	// 构建时通过 ldflags 注入；直接 go build 时使用默认值。
	Version   = "0.1.0"
	BuildTime = "unknown"
)
