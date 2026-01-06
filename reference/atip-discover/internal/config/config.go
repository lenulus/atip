// Package config provides configuration management for atip-discover,
// supporting configuration files, environment variables, and CLI flags.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
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

// configJSON is used for JSON marshaling/unmarshaling with duration as strings
type configJSON struct {
	Version   string             `json:"version"`
	Discovery discoveryConfigJSON `json:"discovery"`
	Cache     cacheConfigJSON     `json:"cache"`
	Output    OutputConfig        `json:"output"`
}

type discoveryConfigJSON struct {
	SafePaths       []string `json:"safe_paths"`
	AdditionalPaths []string `json:"additional_paths"`
	SkipList        []string `json:"skip_list"`
	ScanTimeout     string   `json:"scan_timeout"`
	Parallelism     int      `json:"parallelism"`
}

type cacheConfigJSON struct {
	MaxAge    string `json:"max_age"`
	MaxSizeMB int    `json:"max_size_mb"`
}

// Load loads configuration from the specified file.
// If the file doesn't exist, returns default configuration.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Default(), nil
		}
		return nil, err
	}

	var cj configJSON
	if err := json.Unmarshal(data, &cj); err != nil {
		return nil, err
	}

	// Parse durations
	scanTimeout, err := time.ParseDuration(cj.Discovery.ScanTimeout)
	if err != nil && cj.Discovery.ScanTimeout != "" {
		return nil, fmt.Errorf("invalid scan_timeout: %w", err)
	}

	maxAge, err := time.ParseDuration(cj.Cache.MaxAge)
	if err != nil && cj.Cache.MaxAge != "" {
		return nil, fmt.Errorf("invalid max_age: %w", err)
	}

	cfg := &Config{
		Version: cj.Version,
		Discovery: DiscoveryConfig{
			SafePaths:       cj.Discovery.SafePaths,
			AdditionalPaths: cj.Discovery.AdditionalPaths,
			SkipList:        cj.Discovery.SkipList,
			ScanTimeout:     scanTimeout,
			Parallelism:     cj.Discovery.Parallelism,
		},
		Cache: CacheConfig{
			MaxAge:    maxAge,
			MaxSizeMB: cj.Cache.MaxSizeMB,
		},
		Output: cj.Output,
	}

	// Merge with defaults for missing fields
	defaults := Default()
	if cfg.Discovery.ScanTimeout == 0 {
		cfg.Discovery.ScanTimeout = defaults.Discovery.ScanTimeout
	}
	if cfg.Discovery.Parallelism == 0 {
		cfg.Discovery.Parallelism = defaults.Discovery.Parallelism
	}
	if cfg.Cache.MaxAge == 0 {
		cfg.Cache.MaxAge = defaults.Cache.MaxAge
	}
	if cfg.Cache.MaxSizeMB == 0 {
		cfg.Cache.MaxSizeMB = defaults.Cache.MaxSizeMB
	}
	if cfg.Output.DefaultFormat == "" {
		cfg.Output.DefaultFormat = defaults.Output.DefaultFormat
	}
	if cfg.Output.Color == "" {
		cfg.Output.Color = defaults.Output.Color
	}

	return cfg, nil
}

// Default returns the default configuration.
func Default() *Config {
	return &Config{
		Version: "1",
		Discovery: DiscoveryConfig{
			SafePaths: []string{
				"/usr/bin",
				"/usr/local/bin",
				"/opt/homebrew/bin",
			},
			AdditionalPaths: []string{},
			SkipList:        []string{},
			ScanTimeout:     2 * time.Second,
			Parallelism:     4,
		},
		Cache: CacheConfig{
			MaxAge:    24 * time.Hour,
			MaxSizeMB: 100,
		},
		Output: OutputConfig{
			DefaultFormat: "json",
			Color:         "auto",
		},
	}
}

// Merge merges the config with environment variables and CLI flags.
func (c *Config) Merge(env map[string]string, flags map[string]interface{}) error {
	// Apply environment variables first
	if env != nil {
		if timeout := env["ATIP_DISCOVER_TIMEOUT"]; timeout != "" {
			d, err := time.ParseDuration(timeout)
			if err != nil {
				return fmt.Errorf("invalid ATIP_DISCOVER_TIMEOUT: %w", err)
			}
			c.Discovery.ScanTimeout = d
		}

		if parallel := env["ATIP_DISCOVER_PARALLEL"]; parallel != "" {
			p, err := strconv.Atoi(parallel)
			if err != nil {
				return fmt.Errorf("invalid ATIP_DISCOVER_PARALLEL: %w", err)
			}
			c.Discovery.Parallelism = p
		}

		if skip := env["ATIP_DISCOVER_SKIP"]; skip != "" {
			c.Discovery.SkipList = strings.Split(skip, ",")
		}

		if safePaths := env["ATIP_DISCOVER_SAFE_PATHS"]; safePaths != "" {
			c.Discovery.SafePaths = strings.Split(safePaths, ":")
		}
	}

	// Apply CLI flags (override environment)
	if flags != nil {
		if timeout, ok := flags["timeout"].(string); ok {
			d, err := time.ParseDuration(timeout)
			if err != nil {
				return fmt.Errorf("invalid timeout flag: %w", err)
			}
			c.Discovery.ScanTimeout = d
		}

		if parallel, ok := flags["parallel"].(int); ok {
			c.Discovery.Parallelism = parallel
		}

		if skip, ok := flags["skip"].([]string); ok {
			c.Discovery.SkipList = skip
		}
	}

	return nil
}

// Validate validates the configuration.
func (c *Config) Validate() error {
	if c.Discovery.Parallelism <= 0 {
		return errors.New("parallelism must be greater than 0")
	}

	if c.Discovery.ScanTimeout < 0 {
		return errors.New("scan_timeout must be non-negative")
	}

	validFormats := map[string]bool{
		"json":  true,
		"table": true,
		"quiet": true,
	}
	if !validFormats[c.Output.DefaultFormat] {
		return fmt.Errorf("invalid output format: %s", c.Output.DefaultFormat)
	}

	return nil
}
