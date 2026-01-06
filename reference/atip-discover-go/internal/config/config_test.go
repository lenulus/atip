package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefault(t *testing.T) {
	cfg := Default()

	assert.NotNil(t, cfg)
	assert.Equal(t, "1", cfg.Version)

	// Discovery defaults
	assert.Contains(t, cfg.Discovery.SafePaths, "/usr/bin")
	assert.Contains(t, cfg.Discovery.SafePaths, "/usr/local/bin")
	assert.Contains(t, cfg.Discovery.SafePaths, "/opt/homebrew/bin")
	assert.Equal(t, 2*time.Second, cfg.Discovery.ScanTimeout)
	assert.Equal(t, 4, cfg.Discovery.Parallelism)

	// Cache defaults
	assert.Equal(t, 24*time.Hour, cfg.Cache.MaxAge)
	assert.Equal(t, 100, cfg.Cache.MaxSizeMB)

	// Output defaults
	assert.Equal(t, "json", cfg.Output.DefaultFormat)
	assert.Equal(t, "auto", cfg.Output.Color)
}

func TestLoad_FileNotExists(t *testing.T) {
	// When file doesn't exist, should return default config
	cfg, err := Load("/nonexistent/config.json")
	require.NoError(t, err)
	assert.NotNil(t, cfg)
	assert.Equal(t, "1", cfg.Version)
}

func TestLoad_ValidConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	configJSON := `{
		"version": "1",
		"discovery": {
			"safe_paths": ["/custom/bin"],
			"additional_paths": ["/opt/tools"],
			"skip_list": ["dangerous-tool"],
			"scan_timeout": "5s",
			"parallelism": 8
		},
		"cache": {
			"max_age": "48h",
			"max_size_mb": 200
		},
		"output": {
			"default_format": "table",
			"color": "always"
		}
	}`

	err := os.WriteFile(configPath, []byte(configJSON), 0644)
	require.NoError(t, err)

	cfg, err := Load(configPath)
	require.NoError(t, err)
	assert.Equal(t, "1", cfg.Version)
	assert.Equal(t, []string{"/custom/bin"}, cfg.Discovery.SafePaths)
	assert.Equal(t, []string{"/opt/tools"}, cfg.Discovery.AdditionalPaths)
	assert.Equal(t, []string{"dangerous-tool"}, cfg.Discovery.SkipList)
	assert.Equal(t, 5*time.Second, cfg.Discovery.ScanTimeout)
	assert.Equal(t, 8, cfg.Discovery.Parallelism)
	assert.Equal(t, 48*time.Hour, cfg.Cache.MaxAge)
	assert.Equal(t, 200, cfg.Cache.MaxSizeMB)
	assert.Equal(t, "table", cfg.Output.DefaultFormat)
	assert.Equal(t, "always", cfg.Output.Color)
}

func TestLoad_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	err := os.WriteFile(configPath, []byte("invalid json"), 0644)
	require.NoError(t, err)

	_, err = Load(configPath)
	assert.Error(t, err)
}

func TestLoad_MissingFields(t *testing.T) {
	// Partial config should be merged with defaults
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	configJSON := `{
		"version": "1",
		"discovery": {
			"safe_paths": ["/custom/bin"]
		}
	}`

	err := os.WriteFile(configPath, []byte(configJSON), 0644)
	require.NoError(t, err)

	cfg, err := Load(configPath)
	require.NoError(t, err)
	assert.Equal(t, []string{"/custom/bin"}, cfg.Discovery.SafePaths)
	// Other fields should have defaults
	assert.Equal(t, 4, cfg.Discovery.Parallelism)
	assert.Equal(t, 2*time.Second, cfg.Discovery.ScanTimeout)
}

func TestMerge_EnvironmentVariables(t *testing.T) {
	cfg := Default()

	env := map[string]string{
		"ATIP_DISCOVER_TIMEOUT":  "10s",
		"ATIP_DISCOVER_PARALLEL": "16",
		"ATIP_DISCOVER_SKIP":     "tool1,tool2",
	}

	err := cfg.Merge(env, nil)
	require.NoError(t, err)

	assert.Equal(t, 10*time.Second, cfg.Discovery.ScanTimeout)
	assert.Equal(t, 16, cfg.Discovery.Parallelism)
	assert.Contains(t, cfg.Discovery.SkipList, "tool1")
	assert.Contains(t, cfg.Discovery.SkipList, "tool2")
}

func TestMerge_CLIFlags(t *testing.T) {
	cfg := Default()

	flags := map[string]interface{}{
		"timeout":  "3s",
		"parallel": 6,
		"skip":     []string{"tool-a", "tool-b"},
	}

	err := cfg.Merge(nil, flags)
	require.NoError(t, err)

	assert.Equal(t, 3*time.Second, cfg.Discovery.ScanTimeout)
	assert.Equal(t, 6, cfg.Discovery.Parallelism)
	assert.Contains(t, cfg.Discovery.SkipList, "tool-a")
	assert.Contains(t, cfg.Discovery.SkipList, "tool-b")
}

func TestMerge_Precedence(t *testing.T) {
	// Flags should override environment, which overrides config
	cfg := Default()
	cfg.Discovery.ScanTimeout = 1 * time.Second // Config value

	env := map[string]string{
		"ATIP_DISCOVER_TIMEOUT": "2s", // Env value
	}

	flags := map[string]interface{}{
		"timeout": "3s", // Flag value (highest priority)
	}

	err := cfg.Merge(env, flags)
	require.NoError(t, err)

	// Flag should win
	assert.Equal(t, 3*time.Second, cfg.Discovery.ScanTimeout)
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name      string
		cfg       *Config
		expectErr bool
	}{
		{
			name:      "valid config",
			cfg:       Default(),
			expectErr: false,
		},
		{
			name: "invalid parallelism",
			cfg: &Config{
				Version: "1",
				Discovery: DiscoveryConfig{
					Parallelism: 0,
				},
			},
			expectErr: true,
		},
		{
			name: "negative timeout",
			cfg: &Config{
				Version: "1",
				Discovery: DiscoveryConfig{
					ScanTimeout: -1 * time.Second,
					Parallelism: 4,
				},
			},
			expectErr: true,
		},
		{
			name: "invalid output format",
			cfg: &Config{
				Version: "1",
				Discovery: DiscoveryConfig{
					ScanTimeout: 2 * time.Second,
					Parallelism: 4,
				},
				Output: OutputConfig{
					DefaultFormat: "invalid",
				},
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate()
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestMerge_SafePaths(t *testing.T) {
	cfg := Default()

	env := map[string]string{
		"ATIP_DISCOVER_SAFE_PATHS": "/bin:/usr/bin:/custom/bin",
	}

	err := cfg.Merge(env, nil)
	require.NoError(t, err)

	assert.Contains(t, cfg.Discovery.SafePaths, "/bin")
	assert.Contains(t, cfg.Discovery.SafePaths, "/usr/bin")
	assert.Contains(t, cfg.Discovery.SafePaths, "/custom/bin")
}
