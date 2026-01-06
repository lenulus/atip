# API Specification: atip-discover

## Overview

`atip-discover` is a Go CLI tool that discovers ATIP-compatible tools on a system. It provides:

1. **Discovery** - Scan PATH and canonical directories for ATIP tools
2. **Registry management** - Maintain a local index of discovered tools
3. **Caching** - Cache tool metadata for performance
4. **Querying** - Retrieve metadata for specific tools

The tool outputs JSON by default, making it suitable for agent integration. It follows XDG Base Directory conventions for file storage.

---

## CLI Interface

### Global Flags

```
atip-discover [global-flags] <command> [command-flags] [arguments]
```

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--output` | `-o` | enum | `json` | Output format: `json`, `table`, `quiet` |
| `--config` | `-c` | string | `$XDG_CONFIG_HOME/agent-tools/config.json` | Path to config file |
| `--data-dir` | | string | `$XDG_DATA_HOME/agent-tools` | Path to data directory |
| `--verbose` | `-v` | bool | `false` | Enable verbose logging to stderr |
| `--help` | `-h` | bool | `false` | Show help message |
| `--version` | | bool | `false` | Show version information |

**Output formats**:
- `json` - Machine-readable JSON (default, recommended for agents)
- `table` - Human-readable table format
- `quiet` - Minimal output (tool names only for `list`, counts for `scan`)

---

## Commands

### scan

Scan for ATIP-compatible tools on the system.

```
atip-discover scan [flags]
```

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--safe-paths-only` | | bool | `true` | Only scan known-safe PATH prefixes |
| `--allow-path` | `-a` | []string | `[]` | Additional directories to scan |
| `--skip` | `-s` | []string | `[]` | Tools to skip during scan |
| `--timeout` | `-t` | duration | `2s` | Timeout for probing each tool |
| `--parallel` | `-p` | int | `4` | Number of parallel probes |
| `--incremental` | `-i` | bool | `true` | Only scan new/changed executables |
| `--full` | `-f` | bool | `false` | Force full scan (ignore cache) |
| `--include-shims` | | bool | `true` | Include shim files in discovery |
| `--dry-run` | `-n` | bool | `false` | Show what would be scanned without executing |

**Safe PATH Prefixes** (per spec section 5.2):
```
/usr/bin
/usr/local/bin
/opt/homebrew/bin
~/.local/bin
```

**Behavior**:
1. Load existing registry if present
2. Determine directories to scan based on flags
3. Filter executables by skip list and modification time (incremental mode)
4. Probe each executable with `--agent` flag
5. Validate response against ATIP schema
6. Update registry with discovered tools
7. Output scan results

**JSON Output Schema**:
```json
{
  "discovered": 12,
  "updated": 3,
  "failed": 2,
  "skipped": 45,
  "duration_ms": 1234,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    }
  ],
  "errors": [
    {
      "path": "/usr/local/bin/broken-tool",
      "error": "timeout after 2s"
    }
  ]
}
```

**Exit Codes**:
- `0` - Scan completed successfully
- `1` - Scan completed with errors (some tools failed to probe)
- `2` - Configuration or permission error
- `3` - Fatal error (cannot write registry)

---

### list

List known ATIP tools from the registry.

```
atip-discover list [flags] [pattern]
```

**Arguments**:
- `pattern` (optional) - Glob pattern to filter tool names (e.g., `gh*`, `kube*`)

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--source` | | enum | `all` | Filter by source: `all`, `native`, `shim` |
| `--sort` | | enum | `name` | Sort by: `name`, `discovered`, `path` |
| `--limit` | `-l` | int | `0` | Maximum tools to list (0 = unlimited) |
| `--show-path` | | bool | `false` | Include executable path in output |
| `--stale` | | bool | `false` | Only show tools that may need refresh |

**JSON Output Schema**:
```json
{
  "count": 5,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "description": "GitHub CLI",
      "source": "native",
      "path": "/usr/local/bin/gh",
      "discovered_at": "2026-01-05T10:30:00Z",
      "last_verified": "2026-01-05T10:30:00Z",
      "stale": false
    }
  ]
}
```

**Table Output**:
```
NAME       VERSION  SOURCE  DESCRIPTION
gh         2.45.0   native  GitHub CLI
kubectl    1.28.0   native  Kubernetes CLI
curl       8.4.0    shim    Transfer data from or to a server
```

**Quiet Output**:
```
gh
kubectl
curl
```

**Exit Codes**:
- `0` - Success
- `1` - No tools found matching criteria
- `2` - Registry not found or unreadable

---

### get

Get full ATIP metadata for a specific tool.

```
atip-discover get <tool-name> [flags]
```

**Arguments**:
- `tool-name` (required) - Name of the tool to retrieve

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--refresh` | `-r` | bool | `false` | Force refresh from tool before returning |
| `--cached` | | bool | `true` | Use cached metadata if available |
| `--commands` | | []string | `[]` | Filter to specific command subtrees |
| `--depth` | `-d` | int | `0` | Limit command nesting depth (0 = unlimited) |
| `--compact` | | bool | `false` | Omit optional fields from output |

**Behavior**:
1. Look up tool in registry by name
2. If `--refresh`, probe tool with `--agent` and update cache
3. Load metadata from cache file
4. Apply `--commands` and `--depth` filters if specified
5. Output metadata

**JSON Output**:
Full ATIP metadata as defined in spec section 3.2:
```json
{
  "atip": {"version": "0.4"},
  "name": "gh",
  "version": "2.45.0",
  "description": "GitHub CLI",
  "commands": {
    "pr": {
      "description": "Manage pull requests",
      "commands": {
        "list": {...},
        "create": {...}
      }
    }
  }
}
```

**Exit Codes**:
- `0` - Success
- `1` - Tool not found in registry
- `2` - Tool found but metadata unavailable
- `3` - Refresh requested but probe failed

---

### refresh

Force refresh cached metadata for one or more tools.

```
atip-discover refresh [flags] [tool-names...]
```

**Arguments**:
- `tool-names` (optional) - Specific tools to refresh (default: all)

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--stale-only` | | bool | `false` | Only refresh tools marked as stale |
| `--parallel` | `-p` | int | `4` | Number of parallel refreshes |
| `--timeout` | `-t` | duration | `2s` | Timeout for probing each tool |

**JSON Output Schema**:
```json
{
  "refreshed": 5,
  "failed": 1,
  "unchanged": 2,
  "duration_ms": 890,
  "tools": [
    {
      "name": "gh",
      "status": "updated",
      "old_version": "2.44.0",
      "new_version": "2.45.0"
    }
  ],
  "errors": [
    {
      "name": "broken-tool",
      "error": "exit code 1"
    }
  ]
}
```

**Exit Codes**:
- `0` - All tools refreshed successfully
- `1` - Some tools failed to refresh
- `2` - Registry not found

---

### registry

Manage the tool registry.

#### registry show

Display registry information and statistics.

```
atip-discover registry show
```

**JSON Output Schema**:
```json
{
  "path": "/home/user/.local/share/agent-tools/registry.json",
  "tools_dir": "/home/user/.local/share/agent-tools/tools",
  "shims_dir": "/home/user/.local/share/agent-tools/shims",
  "tool_count": 12,
  "shim_count": 5,
  "last_scan": "2026-01-05T10:30:00Z",
  "cache_size_bytes": 45678,
  "config": {
    "safe_paths": ["/usr/bin", "/usr/local/bin", "~/.local/bin"],
    "skip_list": ["dangerous-tool"],
    "scan_timeout": "2s"
  }
}
```

#### registry clear

Clear cached metadata.

```
atip-discover registry clear [flags]
```

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--all` | | bool | `false` | Clear registry and all cached metadata |
| `--tools` | | []string | `[]` | Clear only specific tools |
| `--older-than` | | duration | `0` | Clear entries older than duration |

**JSON Output Schema**:
```json
{
  "cleared": 12,
  "freed_bytes": 45678
}
```

**Exit Codes**:
- `0` - Clear completed
- `1` - Nothing to clear
- `2` - Permission error

#### registry export

Export registry for backup or transfer.

```
atip-discover registry export [flags] [file]
```

**Arguments**:
- `file` (optional) - Output file (default: stdout)

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--include-metadata` | | bool | `false` | Include full tool metadata |

#### registry import

Import registry from backup.

```
atip-discover registry import [flags] <file>
```

**Arguments**:
- `file` (required) - Input file to import

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--merge` | | bool | `true` | Merge with existing registry |
| `--replace` | | bool | `false` | Replace existing registry |

---

## Data Types

### RegistryEntry

Entry in the tool registry (`registry.json`).

```go
// RegistryEntry represents a discovered tool in the registry.
type RegistryEntry struct {
    // Name is the tool's command name (e.g., "gh").
    Name string `json:"name"`

    // Version is the tool's version string.
    Version string `json:"version"`

    // Path is the absolute path to the executable.
    Path string `json:"path"`

    // Source indicates how the tool was discovered.
    // Values: "native" (--agent flag), "shim" (shim file).
    Source string `json:"source"`

    // DiscoveredAt is when the tool was first discovered.
    DiscoveredAt time.Time `json:"discovered_at"`

    // LastVerified is when the tool was last probed successfully.
    LastVerified time.Time `json:"last_verified"`

    // MetadataFile is the path to cached metadata (relative to tools_dir).
    MetadataFile string `json:"metadata_file,omitempty"`

    // Checksum is the SHA256 hash of the executable for change detection.
    Checksum string `json:"checksum,omitempty"`
}
```

### Registry

The full registry structure.

```go
// Registry is the index of discovered ATIP tools.
type Registry struct {
    // Version is the registry format version.
    Version string `json:"version"`

    // LastScan is when the registry was last updated by a scan.
    LastScan time.Time `json:"last_scan"`

    // Tools is the list of discovered tools.
    Tools []RegistryEntry `json:"tools"`

    // Config is the discovery configuration used.
    Config DiscoveryConfig `json:"config,omitempty"`
}
```

### DiscoveryConfig

Configuration for discovery operations.

```go
// DiscoveryConfig holds discovery settings.
type DiscoveryConfig struct {
    // SafePaths are directories safe to scan.
    SafePaths []string `json:"safe_paths"`

    // SkipList are tool names to never scan.
    SkipList []string `json:"skip_list"`

    // ScanTimeout is the per-tool probe timeout.
    ScanTimeout time.Duration `json:"scan_timeout"`

    // Parallelism is the number of concurrent probes.
    Parallelism int `json:"parallelism"`
}
```

### ScanResult

Result of a scan operation.

```go
// ScanResult holds the outcome of a discovery scan.
type ScanResult struct {
    // Discovered is the count of newly discovered tools.
    Discovered int `json:"discovered"`

    // Updated is the count of tools with updated metadata.
    Updated int `json:"updated"`

    // Failed is the count of tools that failed to probe.
    Failed int `json:"failed"`

    // Skipped is the count of executables skipped.
    Skipped int `json:"skipped"`

    // DurationMs is the scan duration in milliseconds.
    DurationMs int64 `json:"duration_ms"`

    // Tools lists successfully discovered/updated tools.
    Tools []DiscoveredTool `json:"tools"`

    // Errors lists tools that failed.
    Errors []ScanError `json:"errors"`
}

// DiscoveredTool represents a tool found during scanning.
type DiscoveredTool struct {
    Name         string    `json:"name"`
    Version      string    `json:"version"`
    Path         string    `json:"path"`
    Source       string    `json:"source"`
    DiscoveredAt time.Time `json:"discovered_at"`
}

// ScanError represents a failed probe.
type ScanError struct {
    Path  string `json:"path"`
    Error string `json:"error"`
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `XDG_DATA_HOME` | Base data directory | `~/.local/share` |
| `XDG_CONFIG_HOME` | Base config directory | `~/.config` |
| `ATIP_DISCOVER_CONFIG` | Override config file path | (none) |
| `ATIP_DISCOVER_DATA_DIR` | Override data directory path | (none) |
| `ATIP_DISCOVER_SAFE_PATHS` | Colon-separated safe paths | (none, uses defaults) |
| `ATIP_DISCOVER_SKIP` | Comma-separated skip list | (none) |
| `ATIP_DISCOVER_TIMEOUT` | Default probe timeout | `2s` |
| `ATIP_DISCOVER_PARALLEL` | Default parallelism | `4` |
| `NO_COLOR` | Disable colored output | (none) |

---

## Configuration File

Located at `$XDG_CONFIG_HOME/agent-tools/config.json`:

```json
{
  "version": "1",
  "discovery": {
    "safe_paths": [
      "/usr/bin",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "~/.local/bin"
    ],
    "additional_paths": [],
    "skip_list": [
      "dangerous-tool",
      "interactive-only"
    ],
    "scan_timeout": "2s",
    "parallelism": 4
  },
  "cache": {
    "max_age": "24h",
    "max_size_mb": 100
  },
  "output": {
    "default_format": "json",
    "color": "auto"
  }
}
```

---

## Exit Codes Summary

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Partial success (some operations failed) |
| `2` | Input/configuration error |
| `3` | Fatal error (unrecoverable) |

---

## Version Output

```
atip-discover --version
```

**Output**:
```json
{
  "version": "0.1.0",
  "go_version": "go1.22.0",
  "build_date": "2026-01-05T10:00:00Z",
  "commit": "abc1234"
}
```

For table format:
```
atip-discover 0.1.0 (abc1234) built with go1.22.0 on 2026-01-05
```
