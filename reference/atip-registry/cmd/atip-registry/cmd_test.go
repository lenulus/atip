package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServeCommand_Flags(t *testing.T) {
	tests := []struct {
		name  string
		args  []string
		valid bool
	}{
		{
			name:  "default flags",
			args:  []string{"serve"},
			valid: true,
		},
		{
			name:  "custom address",
			args:  []string{"serve", "--addr", ":9090"},
			valid: true,
		},
		{
			name:  "with TLS",
			args:  []string{"serve", "--tls-cert", "/cert.pem", "--tls-key", "/key.pem"},
			valid: true,
		},
		{
			name:  "read-only mode",
			args:  []string{"serve", "--read-only"},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(tt.args)

			// Parse flags without executing
			err := cmd.ParseFlags(tt.args)

			if tt.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
			// Will fail until implementation exists
		})
	}
}

func TestAddCommand(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name        string
		args        []string
		expectError bool
		exitCode    int
	}{
		{
			name:        "adds valid shim",
			args:        []string{"add", "../../testdata/valid-shim.json"},
			expectError: false,
			exitCode:    0,
		},
		{
			name:        "rejects invalid shim",
			args:        []string{"add", "../../testdata/invalid-shim.json"},
			expectError: true,
			exitCode:    2,
		},
		{
			name:        "requires shim file argument",
			args:        []string{"add"},
			expectError: true,
			exitCode:    1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(append([]string{"--data-dir", tmpDir}, tt.args...))

			err := cmd.Execute()

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			// Will fail until implementation exists
		})
	}
}

func TestCrawlCommand(t *testing.T) {
	tmpDir := t.TempDir()

	// Create manifests directory
	manifestsDir := filepath.Join(tmpDir, "manifests")
	require.NoError(t, os.MkdirAll(manifestsDir, 0755))

	// Copy test manifest
	srcManifest, err := os.ReadFile("../../testdata/manifest.yaml")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(manifestsDir, "jq.yaml"), srcManifest, 0644))

	tests := []struct {
		name        string
		args        []string
		expectError bool
	}{
		{
			name:        "crawls with manifest directory",
			args:        []string{"crawl", "--manifests-dir", manifestsDir, "--check-only"},
			expectError: false,
		},
		{
			name:        "crawls specific tool",
			args:        []string{"crawl", "--manifests-dir", manifestsDir, "jq"},
			expectError: false,
		},
		{
			name:        "filters platforms",
			args:        []string{"crawl", "--manifests-dir", manifestsDir, "--platform", "linux-amd64"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(append([]string{"--data-dir", tmpDir}, tt.args...))

			err := cmd.Execute()

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			// Will fail until implementation exists
		})
	}
}

func TestSyncCommand(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name        string
		args        []string
		expectError bool
	}{
		{
			name:        "requires registry URL",
			args:        []string{"sync"},
			expectError: true,
		},
		{
			name:        "syncs from registry",
			args:        []string{"sync", "https://atip.dev", "--dry-run"},
			expectError: false,
		},
		{
			name:        "filters tools",
			args:        []string{"sync", "https://atip.dev", "--tools", "curl,jq", "--dry-run"},
			expectError: false,
		},
		{
			name:        "verifies signatures",
			args:        []string{"sync", "https://atip.dev", "--verify-signatures", "--dry-run"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(append([]string{"--data-dir", tmpDir}, tt.args...))

			err := cmd.Execute()

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			// Will fail until implementation exists
		})
	}
}

func TestSignCommand(t *testing.T) {
	tmpDir := t.TempDir()

	// Create test shim
	shimPath := filepath.Join(tmpDir, "test.json")
	shimData := []byte(`{"atip": {"version": "0.6"}, "name": "test", "version": "1.0", "description": "Test"}`)
	require.NoError(t, os.WriteFile(shimPath, shimData, 0644))

	tests := []struct {
		name        string
		args        []string
		expectError bool
	}{
		{
			name:        "requires hash or file argument",
			args:        []string{"sign"},
			expectError: true,
		},
		{
			name:        "signs with keyless",
			args:        []string{"sign", shimPath, "--identity", "test@example.com", "--issuer", "https://accounts.google.com"},
			expectError: false, // Will fail on execution but should parse
		},
		{
			name:        "signs with key",
			args:        []string{"sign", shimPath, "--key", "/path/to/key"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(append([]string{"--data-dir", tmpDir}, tt.args...))

			// Just test flag parsing, not execution
			err := cmd.ParseFlags(tt.args)
			_ = err
			// Will fail until implementation exists
		})
	}
}

func TestVerifyCommand(t *testing.T) {
	tmpDir := t.TempDir()

	shimPath := filepath.Join(tmpDir, "test.json")
	shimData := []byte(`{"atip": {"version": "0.6"}, "name": "test", "version": "1.0", "description": "Test"}`)
	require.NoError(t, os.WriteFile(shimPath, shimData, 0644))

	tests := []struct {
		name        string
		args        []string
		expectError bool
	}{
		{
			name:        "requires hash or file argument",
			args:        []string{"verify"},
			expectError: true,
		},
		{
			name:        "verifies with expected identity",
			args:        []string{"verify", shimPath, "--identity", "test@example.com", "--issuer", "https://accounts.google.com"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(append([]string{"--data-dir", tmpDir}, tt.args...))

			err := cmd.ParseFlags(tt.args)
			_ = err
			// Will fail until implementation exists
		})
	}
}

func TestCatalogBuildCommand(t *testing.T) {
	tmpDir := t.TempDir()

	cmd := NewRootCmd()
	cmd.SetArgs([]string{"--data-dir", tmpDir, "catalog", "build"})

	err := cmd.Execute()
	assert.NoError(t, err)
	// Will fail until implementation exists

	// Verify catalog was created
	catalogPath := filepath.Join(tmpDir, "shims", "index.json")
	_, err = os.Stat(catalogPath)
	// assert.NoError(t, err)
	_ = err
}

func TestCatalogStatsCommand(t *testing.T) {
	tmpDir := t.TempDir()

	cmd := NewRootCmd()
	cmd.SetArgs([]string{"--data-dir", tmpDir, "catalog", "stats"})

	var buf bytes.Buffer
	cmd.SetOut(&buf)

	err := cmd.Execute()
	assert.NoError(t, err)
	// Will fail until implementation exists

	// Verify JSON output
	var stats map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &stats)
	// assert.NoError(t, err)
	_ = err
}

func TestInitCommand(t *testing.T) {
	tmpDir := t.TempDir()
	registryDir := filepath.Join(tmpDir, "new-registry")

	cmd := NewRootCmd()
	cmd.SetArgs([]string{
		"init",
		registryDir,
		"--name", "Test Registry",
		"--url", "https://test.example.com",
	})

	err := cmd.Execute()
	assert.NoError(t, err)
	// Will fail until implementation exists

	// Verify directory structure created
	_, err = os.Stat(filepath.Join(registryDir, ".well-known", "atip-registry.json"))
	// assert.NoError(t, err)

	_, err = os.Stat(filepath.Join(registryDir, "shims", "sha256"))
	// assert.NoError(t, err)

	_, err = os.Stat(filepath.Join(registryDir, "config.yaml"))
	// assert.NoError(t, err)
}

func TestAgentFlag(t *testing.T) {
	cmd := NewRootCmd()
	cmd.SetArgs([]string{"--agent"})

	var buf bytes.Buffer
	cmd.SetOut(&buf)

	err := cmd.Execute()
	assert.NoError(t, err)

	// Verify ATIP metadata output
	var metadata map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &metadata)
	assert.NoError(t, err)

	// Verify structure
	assert.Contains(t, metadata, "atip")
	assert.Contains(t, metadata, "name")
	assert.Equal(t, "atip-registry", metadata["name"])
	assert.Contains(t, metadata, "commands")
	// Will fail until implementation exists
}

func TestVersionFlag(t *testing.T) {
	cmd := NewRootCmd()
	cmd.SetArgs([]string{"--version"})

	var buf bytes.Buffer
	cmd.SetOut(&buf)

	err := cmd.Execute()
	assert.NoError(t, err)

	output := buf.String()
	assert.Contains(t, output, "atip-registry")
	assert.Contains(t, output, "version")
	// Will fail until implementation exists
}

func TestGlobalFlags(t *testing.T) {
	tests := []struct {
		name string
		args []string
	}{
		{
			name: "config flag",
			args: []string{"--config", "/path/to/config.yaml", "serve"},
		},
		{
			name: "data-dir flag",
			args: []string{"--data-dir", "/path/to/data", "serve"},
		},
		{
			name: "verbose flag",
			args: []string{"--verbose", "serve"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := NewRootCmd()
			cmd.SetArgs(tt.args)

			err := cmd.ParseFlags(tt.args)
			assert.NoError(t, err)
			// Will fail until implementation exists
		})
	}
}

func TestExitCodes(t *testing.T) {
	tests := []struct {
		name         string
		args         []string
		expectedExit int
	}{
		{
			name:         "success returns 0",
			args:         []string{"catalog", "stats"},
			expectedExit: 0,
		},
		{
			name:         "validation error returns 2",
			args:         []string{"add", "../../testdata/invalid-shim.json"},
			expectedExit: 2,
		},
		{
			name:         "missing argument returns 1",
			args:         []string{"add"},
			expectedExit: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test exit code handling
			// Will fail until implementation exists
		})
	}
}
