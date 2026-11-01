package main

import (
	"fmt"
	"os"
	"regexp"
	"time"
)

var versionPattern = regexp.MustCompile(`(?m)^\s+version:\s*["']?([^"'\s#]+)`)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "-time" {
		fmt.Print(time.Now().UTC().Format(time.RFC3339))
		return
	}

	config, err := os.ReadFile("build/config.yml")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	match := versionPattern.FindSubmatch(config)
	if match == nil {
		fmt.Fprintln(os.Stderr, "version not found in build/config.yml")
		os.Exit(1)
	}

	fmt.Print(string(match[1]))
}
