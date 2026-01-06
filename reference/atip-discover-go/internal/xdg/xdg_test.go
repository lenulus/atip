package xdg

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDataHome(t *testing.T) {
	tests := []struct {
		name     string
		xdgVar   string
		expected string
	}{
		{
			name:     "XDG_DATA_HOME set",
			xdgVar:   "/custom/data",
			expected: "/custom/data",
		},
		{
			name:     "XDG_DATA_HOME not set",
			xdgVar:   "",
			expected: filepath.Join(os.Getenv("HOME"), ".local/share"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save and restore original value
			original := os.Getenv("XDG_DATA_HOME")
			defer os.Setenv("XDG_DATA_HOME", original)

			if tt.xdgVar == "" {
				os.Unsetenv("XDG_DATA_HOME")
			} else {
				os.Setenv("XDG_DATA_HOME", tt.xdgVar)
			}

			result := DataHome()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestConfigHome(t *testing.T) {
	tests := []struct {
		name     string
		xdgVar   string
		expected string
	}{
		{
			name:     "XDG_CONFIG_HOME set",
			xdgVar:   "/custom/config",
			expected: "/custom/config",
		},
		{
			name:     "XDG_CONFIG_HOME not set",
			xdgVar:   "",
			expected: filepath.Join(os.Getenv("HOME"), ".config"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			original := os.Getenv("XDG_CONFIG_HOME")
			defer os.Setenv("XDG_CONFIG_HOME", original)

			if tt.xdgVar == "" {
				os.Unsetenv("XDG_CONFIG_HOME")
			} else {
				os.Setenv("XDG_CONFIG_HOME", tt.xdgVar)
			}

			result := ConfigHome()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAgentToolsDataDir(t *testing.T) {
	// Should return DataHome()/agent-tools
	original := os.Getenv("XDG_DATA_HOME")
	defer os.Setenv("XDG_DATA_HOME", original)

	os.Setenv("XDG_DATA_HOME", "/tmp/test-data")

	result := AgentToolsDataDir()
	expected := "/tmp/test-data/agent-tools"
	assert.Equal(t, expected, result)
}

func TestAgentToolsConfigDir(t *testing.T) {
	// Should return ConfigHome()/agent-tools
	original := os.Getenv("XDG_CONFIG_HOME")
	defer os.Setenv("XDG_CONFIG_HOME", original)

	os.Setenv("XDG_CONFIG_HOME", "/tmp/test-config")

	result := AgentToolsConfigDir()
	expected := "/tmp/test-config/agent-tools"
	assert.Equal(t, expected, result)
}

func TestEnsureDataDirs(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()

	original := os.Getenv("XDG_DATA_HOME")
	defer os.Setenv("XDG_DATA_HOME", original)
	os.Setenv("XDG_DATA_HOME", tmpDir)

	err := EnsureDataDirs()
	require.NoError(t, err)

	// Verify directories were created
	expectedDirs := []string{
		filepath.Join(tmpDir, "agent-tools"),
		filepath.Join(tmpDir, "agent-tools", "tools"),
		filepath.Join(tmpDir, "agent-tools", "shims"),
	}

	for _, dir := range expectedDirs {
		info, err := os.Stat(dir)
		require.NoError(t, err, "directory %s should exist", dir)
		assert.True(t, info.IsDir(), "%s should be a directory", dir)
	}
}

func TestEnsureDataDirs_AlreadyExists(t *testing.T) {
	// Test that EnsureDataDirs is idempotent
	tmpDir := t.TempDir()

	original := os.Getenv("XDG_DATA_HOME")
	defer os.Setenv("XDG_DATA_HOME", original)
	os.Setenv("XDG_DATA_HOME", tmpDir)

	// Create directories first
	err := EnsureDataDirs()
	require.NoError(t, err)

	// Call again - should not error
	err = EnsureDataDirs()
	assert.NoError(t, err)
}

func TestExpandTilde(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "path with tilde",
			input:    "~/.local/bin",
			expected: filepath.Join(os.Getenv("HOME"), ".local/bin"),
		},
		{
			name:     "path without tilde",
			input:    "/usr/local/bin",
			expected: "/usr/local/bin",
		},
		{
			name:     "just tilde",
			input:    "~",
			expected: os.Getenv("HOME"),
		},
		{
			name:     "tilde with trailing path",
			input:    "~/foo/bar",
			expected: filepath.Join(os.Getenv("HOME"), "foo/bar"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExpandTilde(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEnsureDataDirs_PermissionError(t *testing.T) {
	// This test would require setting up a read-only filesystem
	// Skipping for now as it requires special permissions
	t.Skip("Requires special filesystem setup")
}
