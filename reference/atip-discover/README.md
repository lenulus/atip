# atip-discover

Discover ATIP-compatible CLI tools on your system.

`atip-discover` scans for tools that implement the ATIP `--agent` flag, maintains a registry of discovered tools, and caches their metadata for fast access.

## Installation

```bash
# Install globally via npm
npm install -g atip-discover

# Or run directly with npx
npx atip-discover scan
```

### From Source

```bash
cd reference/atip-discover
npm install
npm run build
npm link  # Makes 'atip-discover' available globally
```

## CLI Usage

### Scan for Tools

```bash
# Scan safe system paths (default)
atip-discover scan

# Scan specific directories only
atip-discover scan --allow-path ~/bin --allow-path /opt/tools/bin

# Skip specific tools
atip-discover scan --skip slow-tool --skip broken-tool

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

# Filter by name pattern
atip-discover list "gh*"

# Filter by source type
atip-discover list --source native
atip-discover list --source shim
```

### Get Tool Metadata

```bash
# Get full ATIP metadata for a tool
atip-discover get gh

# Force refresh from the tool
atip-discover get gh --refresh
```

### Manage Cache

```bash
# Show cache info
atip-discover cache info

# Clear all cached data
atip-discover cache clear --all

# Refresh stale entries
atip-discover cache refresh
```

## Programmatic API

Use `atip-discover` as a library in your TypeScript/JavaScript project:

```typescript
import { scan, list, get, getAtipPaths } from 'atip-discover';

// Scan for tools
const result = await scan({
  safePathsOnly: false,
  allowPaths: ['/usr/local/bin'],
  timeoutMs: 2000,
  parallelism: 4,
});
console.log(`Found ${result.discovered} tools`);

// List from registry
const tools = await list();
for (const tool of tools) {
  console.log(`${tool.name} v${tool.version}`);
}

// Get specific tool metadata
const metadata = await get('gh');
console.log(metadata.commands);
```

### Integration with atip-bridge

```typescript
import { get } from 'atip-discover';
import { toOpenAI } from 'atip-bridge';

// Get tool metadata and compile for OpenAI
const ghMetadata = await get('gh');
const openaiTools = toOpenAI(ghMetadata, { strict: true });
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
    "max_age": "24h",
    "max_size_mb": 100
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ATIP_DISCOVER_DATA_DIR` | Override data directory |
| `ATIP_DISCOVER_CONFIG` | Path to config file |
| `ATIP_DISCOVER_TIMEOUT` | Probe timeout (e.g., "5s") |
| `ATIP_DISCOVER_PARALLEL` | Parallelism level |
| `ATIP_DISCOVER_SKIP` | Comma-separated skip list |

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

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run only unit tests (fast)
npm run test:unit

# Build
npm run build

# Type check
npm run typecheck
```

## License

MIT - See [LICENSE](../../LICENSE)
