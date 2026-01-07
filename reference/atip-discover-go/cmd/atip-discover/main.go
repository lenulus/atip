package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/atip/atip-discover/internal/config"
	"github.com/atip/atip-discover/internal/discovery"
	"github.com/atip/atip-discover/internal/output"
	"github.com/atip/atip-discover/internal/registry"
	"github.com/atip/atip-discover/internal/validator"
	"github.com/atip/atip-discover/internal/xdg"
)

// Version information (set via build flags)
var (
	Version   = "0.1.0"
	GoVersion = "unknown"
	BuildDate = "unknown"
	Commit    = "unknown"
)

// ATIP metadata for atip-discover itself.
// This tool eats its own dogfood!
var atipMetadata = map[string]interface{}{
	"atip": map[string]interface{}{
		"version":  "0.6",
		"features": []string{"trust-v1"},
	},
	"name":        "atip-discover",
	"version":     Version,
	"description": "Discover ATIP-compatible tools on your system",
	"homepage":    "https://github.com/anthropics/atip",
	"trust": map[string]interface{}{
		"source":   "native",
		"verified": true,
	},
	"commands": map[string]interface{}{
		"scan": map[string]interface{}{
			"description": "Scan for ATIP-compatible tools in PATH",
			"options": []map[string]interface{}{
				{"name": "allow-path", "flags": []string{"--allow-path"}, "type": "string", "description": "Additional directory to scan"},
				{"name": "skip", "flags": []string{"--skip"}, "type": "string", "description": "Comma-separated list of tools to skip"},
				{"name": "timeout", "flags": []string{"--timeout", "-t"}, "type": "string", "default": "2s", "description": "Timeout for probing each tool"},
				{"name": "parallel", "flags": []string{"--parallel", "-p"}, "type": "integer", "default": 4, "description": "Number of parallel probes"},
				{"name": "dry-run", "flags": []string{"--dry-run", "-n"}, "type": "boolean", "description": "Show what would be scanned"},
				{"name": "safe-paths-only", "flags": []string{"--safe-paths-only"}, "type": "boolean", "default": true, "description": "Only scan safe paths"},
			},
			"effects": map[string]interface{}{
				"filesystem": map[string]interface{}{"read": true, "write": true, "paths": []string{"~/.local/share/agent-tools/"}},
				"network":    false,
				"idempotent": true,
			},
		},
		"list": map[string]interface{}{
			"description": "List discovered ATIP tools from the registry",
			"arguments":   []map[string]interface{}{{"name": "pattern", "type": "string", "required": false, "description": "Filter pattern for tool names"}},
			"options": []map[string]interface{}{
				{"name": "source", "flags": []string{"--source"}, "type": "enum", "enum": []string{"all", "native", "shim"}, "default": "all", "description": "Filter by source type"},
				{"name": "output", "flags": []string{"-o"}, "type": "enum", "enum": []string{"json", "table", "quiet"}, "default": "json", "description": "Output format"},
			},
			"effects": map[string]interface{}{
				"filesystem": map[string]interface{}{"read": true, "write": false},
				"network":    false,
				"idempotent": true,
			},
		},
		"get": map[string]interface{}{
			"description": "Get full ATIP metadata for a specific tool",
			"arguments":   []map[string]interface{}{{"name": "tool-name", "type": "string", "required": true, "description": "Name of the tool"}},
			"options": []map[string]interface{}{
				{"name": "output", "flags": []string{"-o"}, "type": "enum", "enum": []string{"json", "table", "quiet"}, "default": "json", "description": "Output format"},
			},
			"effects": map[string]interface{}{
				"filesystem": map[string]interface{}{"read": true, "write": false},
				"network":    false,
				"idempotent": true,
			},
		},
		"refresh": map[string]interface{}{
			"description": "Refresh cached metadata for tools",
			"effects": map[string]interface{}{
				"filesystem": map[string]interface{}{"read": true, "write": true},
				"network":    false,
				"idempotent": true,
			},
		},
	},
	"globalOptions": []map[string]interface{}{
		{"name": "output", "flags": []string{"-o"}, "type": "enum", "enum": []string{"json", "table", "quiet"}, "default": "json", "description": "Output format"},
		{"name": "verbose", "flags": []string{"-v"}, "type": "boolean", "description": "Enable verbose logging"},
	},
}

func main() {
	// Handle --agent flag before anything else
	for _, arg := range os.Args[1:] {
		if arg == "--agent" {
			// Update version in metadata to match current version
			atipMetadata["version"] = Version
			data, err := json.MarshalIndent(atipMetadata, "", "  ")
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: failed to marshal ATIP metadata: %v\n", err)
				os.Exit(1)
			}
			fmt.Println(string(data))
			os.Exit(0)
		}
	}

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}

	cmd := os.Args[1]

	switch cmd {
	case "--version":
		fmt.Printf("atip-discover %s\n", Version)
		os.Exit(0)
	case "-v":
		// Check if this is the only argument (version) or if there's a command
		if len(os.Args) == 2 {
			fmt.Printf("atip-discover %s\n", Version)
			os.Exit(0)
		}
		// Otherwise, it's the verbose flag for a command - let command handler deal with it
		printUsage()
		os.Exit(2)
	case "--help", "-h":
		printUsage()
		os.Exit(0)
	case "scan":
		runScan(os.Args[2:])
	case "list":
		runList(os.Args[2:])
	case "get":
		runGet(os.Args[2:])
	case "refresh":
		runRefresh(os.Args[2:])
	case "registry":
		runRegistry(os.Args[2:])
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", cmd)
		printUsage()
		os.Exit(2)
	}
}

func runScan(args []string) {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	allowPaths := fs.String("allow-path", "", "Additional path to scan (can be repeated)")
	skipList := fs.String("skip", "", "Comma-separated list of tools to skip")
	timeoutStr := fs.String("timeout", "2s", "Timeout for probing each tool")
	parallelism := fs.Int("parallel", 4, "Number of parallel probes")
	outputFormat := fs.String("o", "json", "Output format (json, table, quiet)")
	dryRun := fs.Bool("dry-run", false, "Show what would be scanned without scanning")
	verbose := fs.Bool("v", false, "Verbose output")
	safePathsOnly := fs.Bool("safe-paths-only", true, "Only scan safe paths")

	fs.Parse(args)

	// Ensure data directories exist
	if err := xdg.EnsureDataDirs(); err != nil {
		exitWithError("Failed to create data directories", err)
	}

	// Load config
	cfg := config.Default()
	configPath := filepath.Join(xdg.AgentToolsConfigDir(), "config.json")
	if loadedCfg, err := config.Load(configPath); err == nil {
		cfg = loadedCfg
	}

	// Apply environment variables
	envVars := map[string]string{
		"ATIP_DISCOVER_TIMEOUT":    os.Getenv("ATIP_DISCOVER_TIMEOUT"),
		"ATIP_DISCOVER_PARALLEL":   os.Getenv("ATIP_DISCOVER_PARALLEL"),
		"ATIP_DISCOVER_SKIP":       os.Getenv("ATIP_DISCOVER_SKIP"),
		"ATIP_DISCOVER_SAFE_PATHS": os.Getenv("ATIP_DISCOVER_SAFE_PATHS"),
	}
	if err := cfg.Merge(envVars, nil); err != nil {
		exitWithError("Invalid environment configuration", err)
	}

	// Parse timeout
	timeout, err := time.ParseDuration(*timeoutStr)
	if err != nil {
		exitWithError("Invalid timeout", err)
	}

	// Parse skip list
	var skipListSlice []string
	if *skipList != "" {
		skipListSlice = strings.Split(*skipList, ",")
	}

	// Determine paths to scan
	var scanPaths []string
	if *allowPaths != "" {
		scanPaths = strings.Split(*allowPaths, ",")
	} else if *safePathsOnly {
		scanPaths = cfg.Discovery.SafePaths
	}

	// Dry run mode
	if *dryRun {
		result := map[string]interface{}{
			"scan_paths": scanPaths,
			"would_scan": scanPaths,
		}
		writer, _ := output.NewWriter(output.Format(*outputFormat), os.Stdout)
		writer.Write(result)
		return
	}

	// Warn if safe-paths-only is disabled
	if !*safePathsOnly {
		fmt.Fprintf(os.Stderr, "Warning: Scanning without safe path enforcement. This may execute untrusted code.\n")
	}

	// Verbose: Show safe paths configuration
	if *verbose {
		fmt.Fprintf(os.Stderr, "[DEBUG] Safe paths: %v\n", scanPaths)
	}

	// Check path safety
	var safePaths []string
	for _, path := range scanPaths {
		if *verbose {
			fmt.Fprintf(os.Stderr, "[DEBUG] Checking path: %s\n", path)
		}
		safe, err := discovery.IsSafePath(path)
		if err != nil {
			// Always print verbose messages if -v flag is set
			if *verbose {
				fmt.Fprintf(os.Stderr, "DEBUG: Skipping unsafe path %s: %v\n", path, err)
			}
			// Check for specific errors and print to stderr
			if strings.Contains(err.Error(), "world-writable") {
				fmt.Fprintf(os.Stderr, "Skipping world-writable directory: %s\n", path)
			}
			if strings.Contains(err.Error(), "current directory") {
				fmt.Fprintf(os.Stderr, "Error: current directory not allowed: %s\n", path)
			}
			continue
		}
		if !safe && *safePathsOnly {
			if *verbose {
				fmt.Fprintf(os.Stderr, "DEBUG: Skipping unsafe path %s\n", path)
			}
			continue
		}
		if !safe {
			fmt.Fprintf(os.Stderr, "Warning: Scanning potentially unsafe path %s (safe-paths-only disabled)\n", path)
		}
		safePaths = append(safePaths, path)
	}

	// Load existing registry for incremental scan
	reg, err := loadRegistry()
	if err != nil {
		exitWithError("Failed to load registry", err)
	}

	// Build existing registry map for incremental scanning
	existingRegistry := make(map[string]time.Time)
	for _, entry := range reg.Tools {
		existingRegistry[entry.Path] = entry.ModTime
	}

	// Create scanner
	scanner, err := discovery.NewScanner(timeout, *parallelism, skipListSlice)
	if err != nil {
		exitWithError("Failed to create scanner", err)
	}

	// Scan
	ctx := context.Background()
	result, err := scanner.Scan(ctx, safePaths, true, existingRegistry)
	if err != nil {
		exitWithError("Scan failed", err)
	}

	// Update registry
	updated := 0
	discovered := 0

	for _, tool := range result.Tools {
		// Get mod time
		info, _ := os.Stat(tool.Path)
		var modTime time.Time
		if info != nil {
			modTime = info.ModTime()
		}

		// Check if tool exists in registry
		existing, err := reg.Get(tool.Name)
		isNew := (err != nil)

		if isNew {
			discovered++
		} else {
			// Tool exists - check if version changed
			if existing.Version != tool.Version {
				updated++
			}
		}

		// Add to registry
		entry := &registry.RegistryEntry{
			Name:         tool.Name,
			Version:      tool.Version,
			Path:         tool.Path,
			Source:       tool.Source,
			DiscoveredAt: tool.DiscoveredAt,
			LastVerified: time.Now(),
			ModTime:      modTime,
		}
		reg.Add(entry)

		// Cache metadata (ignore errors - caching is optional)
		_ = cacheMetadata(ctx, entry, timeout)
	}

	// Override result counts with CLI-level counts
	result.Discovered = discovered
	result.Updated = updated

	// Update registry metadata
	reg.LastScan = time.Now()

	// Save registry
	if err := reg.Save(); err != nil {
		exitWithError("Failed to save registry", err)
	}

	// Write output
	writer, err := createOutputWriter(*outputFormat)
	if err != nil {
		exitWithError("Invalid output format", err)
	}
	writer.Write(result)
}

func runList(args []string) {
	fs := flag.NewFlagSet("list", flag.ExitOnError)
	outputFormat := fs.String("o", "json", "Output format (json, table, quiet)")
	pattern := fs.String("pattern", "", "Filter by pattern")
	sourceFilter := fs.String("source", "all", "Filter by source (native, shim, all)")
	fs.Parse(args)

	// Load registry
	reg, err := loadRegistry()
	if err != nil {
		exitWithError("Failed to load registry", err)
	}
	dataDir := xdg.AgentToolsDataDir()

	// List tools
	tools, err := reg.List(*pattern, *sourceFilter)
	if err != nil {
		exitWithError("Failed to list tools", err)
	}

	// Load descriptions from cached metadata
	type ToolInfo struct {
		Name        string `json:"name"`
		Version     string `json:"version"`
		Description string `json:"description"`
		Source      string `json:"source"`
	}

	var toolInfos []ToolInfo
	for _, entry := range tools {
		description := ""

		// Try to load cached metadata
		cachePath := entry.CachePath(dataDir)
		if data, err := os.ReadFile(cachePath); err == nil {
			var metadata validator.AtipMetadata
			if err := json.Unmarshal(data, &metadata); err == nil {
				description = metadata.Description
			}
		}

		toolInfos = append(toolInfos, ToolInfo{
			Name:        entry.Name,
			Version:     entry.Version,
			Description: description,
			Source:      entry.Source,
		})
	}

	// Prepare result
	result := struct {
		Count int        `json:"count"`
		Tools []ToolInfo `json:"tools"`
	}{
		Count: len(toolInfos),
		Tools: toolInfos,
	}

	// Write output
	writer, err := createOutputWriter(*outputFormat)
	if err != nil {
		exitWithError("Invalid output format", err)
	}
	writer.Write(result)
}

func runGet(args []string) {
	fs := flag.NewFlagSet("get", flag.ExitOnError)
	outputFormat := fs.String("o", "json", "Output format (json, table, quiet)")
	fs.Parse(args)

	if len(fs.Args()) < 1 {
		fmt.Fprintf(os.Stderr, "Error: tool name required\n")
		os.Exit(1)
	}

	toolName := fs.Args()[0]

	// Load registry
	reg, err := loadRegistry()
	if err != nil {
		exitWithError("Failed to load registry", err)
	}
	dataDir := xdg.AgentToolsDataDir()

	// Get tool
	entry, err := reg.Get(toolName)
	if err != nil {
		// Output error in JSON format
		errorResult := map[string]interface{}{
			"error": map[string]string{
				"code":    "TOOL_NOT_FOUND",
				"message": fmt.Sprintf("Tool not found: %s", toolName),
			},
		}
		data, _ := json.MarshalIndent(errorResult, "", "  ")
		fmt.Println(string(data))
		os.Exit(1)
	}

	// Load cached metadata
	cachePath := entry.CachePath(dataDir)
	data, err := os.ReadFile(cachePath)
	if err != nil {
		exitWithError("Failed to load tool metadata", err)
	}

	// Output raw JSON metadata
	if *outputFormat == "json" {
		fmt.Println(string(data))
	} else {
		// For other formats, parse and write
		var metadata validator.AtipMetadata
		if err := json.Unmarshal(data, &metadata); err != nil {
			exitWithError("Failed to parse metadata", err)
		}
		writer, _ := createOutputWriter(*outputFormat)
		writer.Write(metadata)
	}
}

func runRefresh(args []string) {
	fs := flag.NewFlagSet("refresh", flag.ExitOnError)
	outputFormat := fs.String("o", "json", "Output format (json, table, quiet)")
	fs.Parse(args)

	// Load registry
	reg, err := loadRegistry()
	if err != nil {
		exitWithError("Failed to load registry", err)
	}

	ctx := context.Background()
	timeout := 2 * time.Second
	prober := discovery.NewProber(timeout)

	type RefreshTool struct {
		Name       string `json:"name"`
		Status     string `json:"status"`
		OldVersion string `json:"old_version,omitempty"`
		NewVersion string `json:"new_version,omitempty"`
	}

	var refreshed []RefreshTool
	refreshedCount := 0

	// Refresh each tool
	for _, entry := range reg.Tools {
		if entry.Source == "shim" {
			continue // Skip shims
		}

		oldVersion := entry.Version

		// Probe tool again
		metadata, err := prober.Probe(ctx, entry.Path)
		if err != nil {
			refreshed = append(refreshed, RefreshTool{
				Name:   entry.Name,
				Status: "failed",
			})
			continue
		}

		// Update registry entry with new version and mod time
		info, _ := os.Stat(entry.Path)
		var modTime time.Time
		if info != nil {
			modTime = info.ModTime()
		}

		entry.Version = metadata.Version
		entry.LastVerified = time.Now()
		entry.ModTime = modTime
		reg.Add(entry)

		// Update cache (ignore errors - caching is optional)
		_ = cacheMetadata(ctx, entry, timeout)

		status := "unchanged"
		if metadata.Version != oldVersion {
			status = "updated"
			refreshedCount++
		}

		refreshed = append(refreshed, RefreshTool{
			Name:       entry.Name,
			Status:     status,
			OldVersion: oldVersion,
			NewVersion: metadata.Version,
		})
	}

	// Save registry
	if err := reg.Save(); err != nil {
		exitWithError("Failed to save registry", err)
	}

	// Prepare result
	result := struct {
		Refreshed int           `json:"refreshed"`
		Tools     []RefreshTool `json:"tools"`
	}{
		Refreshed: refreshedCount,
		Tools:     refreshed,
	}

	// Write output
	writer, err := createOutputWriter(*outputFormat)
	if err != nil {
		exitWithError("Invalid output format", err)
	}
	writer.Write(result)
}

func runRegistry(args []string) {
	// Placeholder for registry subcommands
	fmt.Fprintf(os.Stderr, "registry command not yet implemented\n")
	os.Exit(1)
}

func printUsage() {
	fmt.Println("Usage: atip-discover [command] [flags]")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  scan      Scan for ATIP-compatible tools")
	fmt.Println("  list      List discovered tools")
	fmt.Println("  get       Get metadata for a specific tool")
	fmt.Println("  refresh   Refresh cached metadata")
	fmt.Println("  registry  Manage the registry")
	fmt.Println()
	fmt.Println("Flags:")
	fmt.Println("  -h, --help     Show this help")
	fmt.Println("  -v, --version  Show version")
	fmt.Println("  --agent        Output ATIP metadata (for agent discovery)")
}

func exitWithError(msg string, err error) {
	fmt.Fprintf(os.Stderr, "Error: %s: %v\n", msg, err)
	os.Exit(1)
}

// loadRegistry loads the registry from the standard location
func loadRegistry() (*registry.Registry, error) {
	dataDir := xdg.AgentToolsDataDir()
	registryPath := filepath.Join(dataDir, "registry.json")
	return registry.Load(registryPath, dataDir)
}

// createOutputWriter creates an output writer for the given format
func createOutputWriter(format string) (output.Writer, error) {
	return output.NewWriter(output.Format(format), os.Stdout)
}

// cacheMetadata saves tool metadata to the cache
func cacheMetadata(ctx context.Context, tool *registry.RegistryEntry, timeout time.Duration) error {
	dataDir := xdg.AgentToolsDataDir()
	cachePath := filepath.Join(dataDir, "tools", tool.Name+".json")

	if err := os.MkdirAll(filepath.Dir(cachePath), 0755); err != nil {
		return err
	}

	prober := discovery.NewProber(timeout)
	metadata, err := prober.Probe(ctx, tool.Path)
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(cachePath, data, 0644)
}
