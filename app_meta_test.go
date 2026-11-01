package main

import (
	"os"
	"regexp"
	"testing"
)

// TestAppIdentityMatchesBuildConfig 防止 Go 常量与 build/config.yml 漂移。
func TestAppIdentityMatchesBuildConfig(t *testing.T) {
	data, err := os.ReadFile("build/config.yml")
	if err != nil {
		t.Fatalf("read build/config.yml: %v", err)
	}

	tests := []struct {
		name    string
		pattern string
		want    string
	}{
		{"productName", `(?m)^\s+productName:\s*"([^"]+)"`, appName},
		{"productIdentifier", `(?m)^\s+productIdentifier:\s*"([^"]+)"`, appID},
		{"version", `(?m)^\s+version:\s*["']?([^"'\s#]+)`, Version},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			match := regexp.MustCompile(tt.pattern).FindStringSubmatch(string(data))
			if match == nil {
				t.Fatalf("%s not found in build/config.yml", tt.name)
			}

			if match[1] != tt.want {
				t.Fatalf("%s = %q, want %q", tt.name, match[1], tt.want)
			}
		})
	}
}
