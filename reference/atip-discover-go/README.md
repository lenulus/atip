# atip-discover-go

Go implementation of the ATIP discovery tool.

`atip-discover` scans for CLI tools that implement the ATIP `--agent` flag, maintains a registry of discovered tools, and caches their metadata for fast access.

> **Note:** The canonical implementation is the [TypeScript version](../atip-discover/). This Go version provides a single-binary alternative with fast startup time.

## Installation

```bash
# Install to $GOPATH/bin
go install ./cmd/atip-discover

# Or build locally
go build -o atip-discover ./cmd/atip-discover
```

## CLI Usage

### Scan for Tools

```bash
# Scan safe system paths (default)
atip-discover scan

# Scan specific directories only
atip-discover scan --allow-path ~/bin,/opt/tools/bin

# Skip specific tools
atip-discover scan --skip slow-tool,broken-tool

# Preview what would be scanned
atip-discover scan --dry-run

# Output formats: json (default), table, quiet
atip-discover scan -o table
```

### List Discovered Tools

```bash
# List all tools (JSON)
atip-discover list

# Human-readable table
atip-discover list -o table

# Filter by source type
atip-discover list --source native
atip-discover list --source shim
```

### Get Tool Metadata

```bash
# Get full ATIP metadata for a tool
atip-discover get gh

# Force refresh from the tool
atip-discover get --refresh gh
```

### Manage Registry

```bash
# Show registry stats
atip-discover registry show

# Clear all cached data
atip-discover registry clear

# Refresh stale entries
atip-discover refresh --all
```

## Configuration

Config file: `~/.config/agent-tools/config.json`

```json
{
  "discovery": {
    "safe_paths": ["/usr/bin", "/usr/local/bin", "~/.local/bin"],
    "skip_list": ["slow-tool"],
    "scan_timeout": "2s",
    "parallelism": 4
  },
  "cache": {
    "ttl": "24h",
    "max_size_mb": 100
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ATIP_DISCOVER_TIMEOUT` | Probe timeout (e.g., "5s") |
| `ATIP_DISCOVER_PARALLEL` | Parallelism level |
| `ATIP_DISCOVER_SKIP` | Comma-separated skip list |
| `ATIP_DISCOVER_SAFE_PATHS` | Colon-separated safe paths |

## File Locations

Following [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/) conventions:

```
~/.local/share/agent-tools/
├── registry.json          # Index of discovered tools
├── tools/                 # Cached ATIP metadata
│   ├── gh.json
│   └── kubectl.json
└── shims/                 # Metadata for legacy tools

~/.config/agent-tools/
└── config.json            # User configuration
```

## Security

By default, `atip-discover` only scans known-safe directories:

- `/usr/bin`
- `/usr/local/bin`
- `/opt/homebrew/bin`
- `~/.local/bin`

It automatically skips:
- World-writable directories
- Directories owned by other users
- Current directory (`.`) in PATH

Use `--allow-path` to explicitly scan additional directories.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Partial success / no results |
| 2 | Configuration error |
| 3 | Fatal error |

## Development

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Build
go build -o atip-discover ./cmd/atip-discover

# Install locally
go install ./cmd/atip-discover
```

## License

MIT - See [LICENSE](../../LICENSE)
