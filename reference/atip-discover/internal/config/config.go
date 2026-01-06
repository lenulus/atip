package config

import (
	"time"
)

// Config represents the complete configuration for atip-discover.
type Config struct {
	Version   string          `json:"version"`
	Discovery DiscoveryConfig `json:"discovery"`
	Cache     CacheConfig     `json:"cache"`
	Output    OutputConfig    `json:"output"`
}

// DiscoveryConfig holds discovery settings.
type DiscoveryConfig struct {
	SafePaths       []string      `json:"safe_paths"`
	AdditionalPaths []string      `json:"additional_paths"`
	SkipList        []string      `json:"skip_list"`
	ScanTimeout     time.Duration `json:"scan_timeout"`
	Parallelism     int           `json:"parallelism"`
}

// CacheConfig holds cache settings.
type CacheConfig struct {
	MaxAge    time.Duration `json:"max_age"`
	MaxSizeMB int           `json:"max_size_mb"`
}

// OutputConfig holds output settings.
type OutputConfig struct {
	DefaultFormat string `json:"default_format"`
	Color         string `json:"color"`
}

// Load loads configuration from the specified file.
// If the file doesn't exist, returns default configuration.
func Load(path string) (*Config, error) {
	// TODO: Implement
	panic("not implemented")
}

// Default returns the default configuration.
func Default() *Config {
	// TODO: Implement
	panic("not implemented")
}

// Merge merges the config with environment variables and CLI flags.
func (c *Config) Merge(env map[string]string, flags map[string]interface{}) error {
	// TODO: Implement
	panic("not implemented")
}

// Validate validates the configuration.
func (c *Config) Validate() error {
	// TODO: Implement
	panic("not implemented")
}
