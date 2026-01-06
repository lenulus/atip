# atip-discover

A Go CLI tool for discovering ATIP-compatible tools on your system.

## Overview

`atip-discover` scans your system for tools that implement the ATIP `--agent` flag convention, maintains a local registry of discovered tools, and provides fast cached access to tool metadata.

**Key Features:**

- **Discovery** - Scan PATH for ATIP-compatible tools
- **Registry** - Maintain a local index of discovered tools
- **Caching** - Cache metadata for fast repeated access
- **Security** - Safe defaults, respects XDG conventions

## Installation

```bash
# Build from source
cd reference/atip-discover
go build -o atip-discover ./cmd/atip-discover

# Install to PATH
go install ./cmd/atip-discover
```

## Quick Start

```bash
# Discover ATIP tools on your system
atip-discover scan

# List all known tools
atip-discover list

# Get metadata for a specific tool
atip-discover get gh

# Refresh cached metadata
atip-discover refresh gh
```

## Commands

### scan

Scan for ATIP-compatible tools.

```bash
# Default incremental scan (safe paths only)
atip-discover scan

# Full scan, ignoring cache
atip-discover scan --full

# Include additional directories
atip-discover scan --allow-path ~/bin --allow-path /opt/tools/bin

# Skip specific tools
atip-discover scan --skip slow-tool --skip broken-tool

# Dry run (show what would be scanned)
atip-discover scan --dry-run
```

### list

List discovered tools from the registry.

```bash
# JSON output (default)
atip-discover list

# Human-readable table
atip-discover list -o table

# Just tool names
atip-discover list -o quiet

# Filter by source
atip-discover list --source native
atip-discover list --source shim
```

### get

Get metadata for a specific tool.

```bash
# Get full metadata as JSON
atip-discover get gh

# Get specific field
atip-discover get gh --field commands

# Force refresh from tool
atip-discover get gh --refresh
```

### refresh

Refresh cached metadata for tools.

```bash
# Refresh specific tool
atip-discover refresh gh

# Refresh all tools
atip-discover refresh --all
```

### registry

Manage the local registry.

```bash
# Show registry location and stats
atip-discover registry show

# Clear all cached data
atip-discover registry clear

# Export registry to file
atip-discover registry export > backup.json

# Import registry from file
atip-discover registry import < backup.json
```

## Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| `json` | `-o json` | Agent integration, scripting (default) |
| `table` | `-o table` | Human-readable display |
| `quiet` | `-o quiet` | Minimal output (names/counts only) |

## Configuration

Configuration file: `$XDG_CONFIG_HOME/agent-tools/config.json`

```json
{
  "scan": {
    "timeout": "2s",
    "parallel": 4,
    "safe_paths_only": true,
    "additional_paths": [],
    "skip_tools": []
  },
  "cache": {
    "ttl": "24h",
    "max_size_mb": 100
  }
}
```

## File Locations

Following XDG Base Directory conventions:

```
$XDG_DATA_HOME/agent-tools/     # ~/.local/share/agent-tools/
├── registry.json               # Tool registry index
├── tools/                      # Cached tool metadata
│   ├── gh.json
│   └── kubectl.json
└── shims/                      # Shim files for legacy tools
    └── curl.json

$XDG_CONFIG_HOME/agent-tools/   # ~/.config/agent-tools/
├── config.json                 # User configuration
└── overrides/                  # Per-tool overrides
    └── gh.json
```

## Security

`atip-discover` follows security best practices from the ATIP spec:

- **Safe PATH prefixes** - By default, only scans known-safe directories:
  - `/usr/bin`
  - `/usr/local/bin`
  - `/opt/homebrew/bin`
  - `~/.local/bin`

- **Skips dangerous paths**:
  - World-writable directories
  - Directories owned by other users
  - Current directory (`.`) in PATH

- **Timeouts** - 2 second default timeout for probing tools

Use `--allow-path` to explicitly add additional directories when needed.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Partial success (some tools failed) |
| 2 | Configuration error |
| 3 | Fatal error |

## Agent Integration

### Shell Script

```bash
#!/bin/bash
# Get all ATIP tools as JSON for agent consumption
tools=$(atip-discover list)

# Get specific tool metadata
gh_meta=$(atip-discover get gh)

# Check if tool exists
if atip-discover get mytool >/dev/null 2>&1; then
  echo "mytool is ATIP-compatible"
fi
```

### Go

```go
import (
    "encoding/json"
    "os/exec"
)

// Discover ATIP tools
cmd := exec.Command("atip-discover", "list")
output, err := cmd.Output()
if err != nil {
    log.Fatal(err)
}

var tools []Tool
json.Unmarshal(output, &tools)
```

## Development

```bash
# Run tests
go test ./...

# Build
go build -o atip-discover ./cmd/atip-discover

# Install locally
go install ./cmd/atip-discover
```

## Design Documentation

See the `blue/` directory for detailed design documentation:

- [`blue/api.md`](blue/api.md) - CLI interface specification
- [`blue/design.md`](blue/design.md) - Architecture and design decisions
- [`blue/examples.md`](blue/examples.md) - Usage examples

## License

MIT - See [LICENSE](../../LICENSE) for details.
