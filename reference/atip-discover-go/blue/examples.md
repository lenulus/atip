# Usage Examples: atip-discover

## Basic Usage

### Example 1: First-Time Discovery

Scan the system for ATIP-compatible tools on first run.

```bash
atip-discover scan
```

**Expected Output** (JSON):
```json
{
  "discovered": 3,
  "updated": 0,
  "failed": 0,
  "skipped": 127,
  "duration_ms": 4523,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    },
    {
      "name": "kubectl",
      "version": "1.28.0",
      "path": "/usr/local/bin/kubectl",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    },
    {
      "name": "terraform",
      "version": "1.6.0",
      "path": "/usr/local/bin/terraform",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    }
  ],
  "errors": []
}
```

**Explanation**: The scan discovers 3 ATIP-compatible tools in the safe PATH directories. 127 executables were checked but skipped because they don't implement `--agent`.

---

### Example 2: List Discovered Tools

View all tools in the registry.

```bash
atip-discover list
```

**Expected Output** (JSON):
```json
{
  "count": 3,
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
    },
    {
      "name": "kubectl",
      "version": "1.28.0",
      "description": "Kubernetes CLI",
      "source": "native",
      "path": "/usr/local/bin/kubectl",
      "discovered_at": "2026-01-05T10:30:00Z",
      "last_verified": "2026-01-05T10:30:00Z",
      "stale": false
    },
    {
      "name": "terraform",
      "version": "1.6.0",
      "description": "Infrastructure as Code",
      "source": "native",
      "path": "/usr/local/bin/terraform",
      "discovered_at": "2026-01-05T10:30:00Z",
      "last_verified": "2026-01-05T10:30:00Z",
      "stale": false
    }
  ]
}
```

**Table Output** (`-o table`):
```bash
atip-discover list -o table
```
```
NAME       VERSION  SOURCE  DESCRIPTION
gh         2.45.0   native  GitHub CLI
kubectl    1.28.0   native  Kubernetes CLI
terraform  1.6.0    native  Infrastructure as Code
```

**Quiet Output** (`-o quiet`):
```bash
atip-discover list -o quiet
```
```
gh
kubectl
terraform
```

**Explanation**: The list command shows all tools in the registry. Different output formats serve different use cases: JSON for agents, table for humans, quiet for shell scripts.

---

### Example 3: Get Tool Metadata

Retrieve full ATIP metadata for a specific tool.

```bash
atip-discover get gh
```

**Expected Output**:
```json
{
  "atip": {"version": "0.6"},
  "name": "gh",
  "version": "2.45.0",
  "description": "Work seamlessly with GitHub from the command line",
  "homepage": "https://cli.github.com",
  "trust": {
    "source": "native",
    "verified": true
  },
  "commands": {
    "pr": {
      "description": "Manage pull requests",
      "commands": {
        "list": {
          "description": "List pull requests",
          "options": [
            {
              "name": "state",
              "flags": ["-s", "--state"],
              "type": "enum",
              "enum": ["open", "closed", "merged", "all"],
              "default": "open",
              "description": "Filter by state"
            }
          ],
          "effects": {
            "network": true,
            "idempotent": true
          }
        },
        "create": {
          "description": "Create a pull request",
          "effects": {
            "network": true,
            "idempotent": false
          }
        }
      }
    },
    "repo": {
      "description": "Manage repositories",
      "commands": {
        "delete": {
          "description": "Delete a repository",
          "effects": {
            "network": true,
            "destructive": true,
            "reversible": false
          }
        }
      }
    }
  }
}
```

**Explanation**: Full ATIP metadata is returned, matching what the tool outputs via `--agent`. This can be piped to `atip-bridge` for compilation to LLM formats.

---

### Example 4: Filter Specific Commands

Get only specific command subtrees for large tools.

```bash
atip-discover get kubectl --commands=pods,deployments --depth=1
```

**Expected Output**:
```json
{
  "atip": {"version": "0.6"},
  "name": "kubectl",
  "version": "1.28.0",
  "description": "Kubernetes CLI",
  "partial": true,
  "filter": {
    "commands": ["pods", "deployments"],
    "depth": 1
  },
  "totalCommands": 347,
  "includedCommands": 24,
  "omitted": {
    "reason": "filtered",
    "safetyAssumption": "unknown"
  },
  "commands": {
    "get": {
      "description": "Display resources",
      "commands": {
        "pods": {
          "description": "List pods"
        },
        "deployments": {
          "description": "List deployments"
        }
      }
    }
  }
}
```

**Explanation**: For large tools like kubectl, filtering reduces context size. The `omitted` field tells agents that unlisted commands should be treated with caution per spec section 3.1.1.

---

## Advanced Usage

### Example 5: Scan Custom Directories

Add a custom directory to the safe paths.

```bash
atip-discover scan --allow-path=/opt/custom-tools
```

**Expected Output**:
```json
{
  "discovered": 2,
  "updated": 0,
  "failed": 0,
  "skipped": 15,
  "duration_ms": 890,
  "tools": [
    {
      "name": "company-deploy",
      "version": "3.2.1",
      "path": "/opt/custom-tools/company-deploy",
      "source": "native",
      "discovered_at": "2026-01-05T11:00:00Z"
    },
    {
      "name": "internal-cli",
      "version": "1.0.0",
      "path": "/opt/custom-tools/internal-cli",
      "source": "native",
      "discovered_at": "2026-01-05T11:00:00Z"
    }
  ],
  "errors": []
}
```

**Explanation**: The `--allow-path` flag adds `/opt/custom-tools` to the scan. Default safe paths are still included unless `--safe-paths-only=false` is set.

---

### Example 6: Skip Problematic Tools

Skip tools known to hang or misbehave.

```bash
atip-discover scan --skip=slow-tool,broken-tool
```

**Expected Output**:
```json
{
  "discovered": 3,
  "updated": 0,
  "failed": 0,
  "skipped": 129,
  "duration_ms": 3200,
  "tools": [...],
  "errors": []
}
```

**Explanation**: Tools in the skip list are not probed. This is useful for tools that take too long or have bugs in their `--agent` implementation.

---

### Example 7: Incremental vs Full Scan

Incremental scan (default) only probes changed executables:

```bash
atip-discover scan
```

```json
{
  "discovered": 0,
  "updated": 1,
  "failed": 0,
  "skipped": 130,
  "duration_ms": 450,
  "tools": [
    {
      "name": "gh",
      "version": "2.46.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    }
  ],
  "errors": []
}
```

Force full scan with `--full`:

```bash
atip-discover scan --full
```

```json
{
  "discovered": 0,
  "updated": 0,
  "failed": 0,
  "skipped": 127,
  "duration_ms": 4100,
  "tools": [],
  "errors": []
}
```

**Explanation**: Incremental mode detects that `gh` was updated (mtime changed) and re-probes only that tool. Full scan re-probes everything but finds no changes.

---

### Example 8: Dry Run

Preview what would be scanned without executing:

```bash
atip-discover scan --dry-run
```

**Expected Output**:
```json
{
  "would_scan": [
    "/usr/local/bin/gh",
    "/usr/local/bin/kubectl",
    "/usr/local/bin/terraform"
  ],
  "skipped_paths": [
    "/tmp",
    "/home/user/.npm/bin"
  ],
  "skipped_tools": [
    "dangerous-tool"
  ],
  "scan_paths": [
    "/usr/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/home/user/.local/bin"
  ]
}
```

**Explanation**: Dry run shows what executables would be probed and which paths were excluded for safety. Useful for debugging configuration.

---

### Example 9: Adjust Parallelism and Timeout

For slow networks or systems, adjust scan parameters:

```bash
atip-discover scan --parallel=2 --timeout=5s
```

**Expected Output**:
```json
{
  "discovered": 3,
  "updated": 0,
  "failed": 0,
  "skipped": 127,
  "duration_ms": 8900,
  "tools": [...],
  "errors": []
}
```

**Explanation**: Reduced parallelism (`2`) and longer timeout (`5s`) are useful for resource-constrained environments or tools that are slow to respond.

---

### Example 10: Include Shim Files

Shim files provide ATIP metadata for legacy tools:

```bash
# First, add a shim file
cat > ~/.local/share/agent-tools/shims/curl.json << 'EOF'
{
  "atip": {"version": "0.6"},
  "name": "curl",
  "version": "8.4.0",
  "description": "Transfer data from or to a server",
  "trust": {"source": "community", "verified": false},
  "commands": {
    "": {
      "description": "Make HTTP request",
      "options": [
        {"name": "request", "flags": ["-X"], "type": "enum",
         "enum": ["GET", "POST", "PUT", "DELETE"],
         "description": "HTTP method"}
      ],
      "effects": {"network": true, "idempotent": false}
    }
  }
}
EOF

# Scan will pick up the shim
atip-discover scan --include-shims
```

**Expected Output**:
```json
{
  "discovered": 4,
  "updated": 0,
  "failed": 0,
  "skipped": 127,
  "duration_ms": 4600,
  "tools": [
    {
      "name": "curl",
      "version": "8.4.0",
      "path": "",
      "source": "shim",
      "discovered_at": "2026-01-05T12:00:00Z"
    },
    ...
  ],
  "errors": []
}
```

**Explanation**: Shims are loaded from `$XDG_DATA_HOME/agent-tools/shims/` and treated as first-class tools. The `source: "shim"` field indicates these are community-provided metadata.

---

## Registry Management

### Example 11: View Registry Statistics

```bash
atip-discover registry show
```

**Expected Output**:
```json
{
  "path": "/home/user/.local/share/agent-tools/registry.json",
  "tools_dir": "/home/user/.local/share/agent-tools/tools",
  "shims_dir": "/home/user/.local/share/agent-tools/shims",
  "tool_count": 3,
  "shim_count": 1,
  "last_scan": "2026-01-05T12:00:00Z",
  "cache_size_bytes": 45678,
  "config": {
    "safe_paths": [
      "/usr/bin",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "~/.local/bin"
    ],
    "skip_list": [],
    "scan_timeout": "2s"
  }
}
```

**Explanation**: Shows registry location, statistics, and current configuration. Useful for debugging path issues.

---

### Example 12: Clear Specific Tools

Remove cached metadata for specific tools:

```bash
atip-discover registry clear --tools=gh,kubectl
```

**Expected Output**:
```json
{
  "cleared": 2,
  "freed_bytes": 15234
}
```

**Explanation**: Removes only the specified tools from the registry and cache. They will be re-discovered on the next scan.

---

### Example 13: Clear Old Entries

Remove entries older than a specific duration:

```bash
atip-discover registry clear --older-than=7d
```

**Expected Output**:
```json
{
  "cleared": 1,
  "freed_bytes": 5678
}
```

**Explanation**: Removes tools that haven't been verified in 7 days. Useful for cleaning up tools that may have been uninstalled.

---

### Example 14: Export and Import Registry

Backup the registry:

```bash
atip-discover registry export --include-metadata > backup.json
```

Restore on another machine:

```bash
atip-discover registry import --merge backup.json
```

**Expected Output**:
```json
{
  "imported": 3,
  "skipped": 0,
  "merged": 2
}
```

**Explanation**: Registry can be exported for backup or transfer between machines. The `--merge` flag combines with existing entries.

---

## Refresh Operations

### Example 15: Refresh All Tools

Force re-probe all registered tools:

```bash
atip-discover refresh
```

**Expected Output**:
```json
{
  "refreshed": 3,
  "failed": 0,
  "unchanged": 0,
  "duration_ms": 2100,
  "tools": [
    {
      "name": "gh",
      "status": "updated",
      "old_version": "2.44.0",
      "new_version": "2.45.0"
    },
    {
      "name": "kubectl",
      "status": "unchanged"
    },
    {
      "name": "terraform",
      "status": "unchanged"
    }
  ],
  "errors": []
}
```

**Explanation**: All tools are re-probed. Shows which tools had version updates.

---

### Example 16: Refresh Stale Tools Only

Refresh only tools that may be outdated:

```bash
atip-discover refresh --stale-only
```

**Expected Output**:
```json
{
  "refreshed": 1,
  "failed": 0,
  "unchanged": 0,
  "duration_ms": 450,
  "tools": [
    {
      "name": "gh",
      "status": "updated",
      "old_version": "2.44.0",
      "new_version": "2.45.0"
    }
  ],
  "errors": []
}
```

**Explanation**: Only tools with changed mtimes or marked as stale are refreshed. Much faster than full refresh.

---

## Error Handling

### Example 17: Handle Probe Failures

When a tool fails to respond to `--agent`:

```bash
atip-discover scan
```

**Expected Output**:
```json
{
  "discovered": 2,
  "updated": 0,
  "failed": 1,
  "skipped": 127,
  "duration_ms": 4800,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    },
    {
      "name": "kubectl",
      "version": "1.28.0",
      "path": "/usr/local/bin/kubectl",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00Z"
    }
  ],
  "errors": [
    {
      "path": "/usr/local/bin/broken-tool",
      "error": "exit code 1: unknown flag: --agent"
    }
  ]
}
```

**Exit Code**: `1` (partial success)

**Explanation**: The scan continues despite failures. Errors are collected and reported. Exit code 1 indicates partial success.

---

### Example 18: Handle Timeout

When a tool takes too long to respond:

```bash
atip-discover scan --timeout=1s
```

**Expected Output**:
```json
{
  "discovered": 2,
  "updated": 0,
  "failed": 1,
  "skipped": 127,
  "duration_ms": 2200,
  "tools": [...],
  "errors": [
    {
      "path": "/usr/local/bin/slow-tool",
      "error": "timeout after 1s"
    }
  ]
}
```

**Explanation**: Tools exceeding the timeout are killed and reported as failures. Consider adding slow tools to the skip list.

---

### Example 19: Handle Missing Tool

When requesting a tool not in the registry:

```bash
atip-discover get nonexistent-tool
```

**Expected Output** (stderr):
```
Error: tool 'nonexistent-tool' not found in registry
```

**Exit Code**: `1`

**JSON Error Output** (`-o json`):
```json
{
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "tool 'nonexistent-tool' not found in registry",
    "suggestions": [
      "Run 'atip-discover scan' to discover tools",
      "Check tool name spelling"
    ]
  }
}
```

**Explanation**: Clear error message with suggestions for resolution.

---

## Integration Examples

### Example 20: Agent Integration (Shell)

Use atip-discover with an LLM agent:

```bash
#!/bin/bash

# Discover available tools
atip-discover scan -o quiet >/dev/null 2>&1

# Get tool list for agent
TOOLS=$(atip-discover list -o json)

# Get specific tool metadata for compilation
GH_METADATA=$(atip-discover get gh)

# Pipe to atip-bridge for OpenAI format
echo "$GH_METADATA" | atip-bridge compile --provider=openai --strict
```

**Explanation**: Discovery can be integrated into agent startup scripts. Tools are discovered once and cached for fast subsequent access.

---

### Example 21: Agent Integration (Go)

Use atip-discover programmatically:

```go
package main

import (
    "encoding/json"
    "os/exec"
)

type Tool struct {
    Name        string `json:"name"`
    Description string `json:"description"`
}

type ListResult struct {
    Count int    `json:"count"`
    Tools []Tool `json:"tools"`
}

func GetAvailableTools() ([]Tool, error) {
    cmd := exec.Command("atip-discover", "list", "-o", "json")
    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }

    var result ListResult
    if err := json.Unmarshal(output, &result); err != nil {
        return nil, err
    }

    return result.Tools, nil
}

func GetToolMetadata(name string) (json.RawMessage, error) {
    cmd := exec.Command("atip-discover", "get", name)
    return cmd.Output()
}
```

**Explanation**: The JSON output makes programmatic integration straightforward. Agents can list available tools and fetch metadata on demand.

---

### Example 22: CI/CD Integration

Use atip-discover in CI to validate tool availability:

```yaml
# .github/workflows/check-tools.yml
name: Check ATIP Tools

on: [push]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install atip-discover
        run: go install github.com/atip/atip-discover@latest

      - name: Scan for tools
        run: |
          atip-discover scan --safe-paths-only=false --allow-path=$PWD/bin

      - name: Verify required tools
        run: |
          for tool in gh kubectl terraform; do
            if ! atip-discover get $tool >/dev/null 2>&1; then
              echo "Missing required tool: $tool"
              exit 1
            fi
          done
```

**Explanation**: CI pipelines can use atip-discover to verify required tools are available and have valid ATIP metadata.

---

### Example 23: Configuration File

Create a persistent configuration:

```bash
mkdir -p ~/.config/agent-tools

cat > ~/.config/agent-tools/config.json << 'EOF'
{
  "version": "1",
  "discovery": {
    "safe_paths": [
      "/usr/bin",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "~/.local/bin"
    ],
    "additional_paths": [
      "/opt/company-tools"
    ],
    "skip_list": [
      "slow-internal-tool",
      "deprecated-cli"
    ],
    "scan_timeout": "3s",
    "parallelism": 8
  },
  "cache": {
    "max_age": "168h",
    "max_size_mb": 200
  },
  "output": {
    "default_format": "json",
    "color": "auto"
  }
}
EOF

# Now scans use these settings by default
atip-discover scan
```

**Explanation**: Configuration file provides persistent settings. Command-line flags override config file values.

---

### Example 24: Environment Variable Override

Override settings via environment:

```bash
# Set scan timeout via environment
export ATIP_DISCOVER_TIMEOUT=5s

# Add paths via environment (colon-separated)
export ATIP_DISCOVER_SAFE_PATHS="/usr/bin:/usr/local/bin:/opt/tools"

# Set skip list via environment (comma-separated)
export ATIP_DISCOVER_SKIP="slow-tool,broken-tool"

# Run with environment settings
atip-discover scan
```

**Explanation**: Environment variables are useful for containerized environments or temporary overrides without modifying config files.

---

## Security Scenarios

### Example 25: Safe Path Enforcement

Attempting to scan unsafe directories:

```bash
# Create a world-writable directory
mkdir /tmp/unsafe-tools
chmod 777 /tmp/unsafe-tools

# Try to scan it (fails by default)
atip-discover scan --allow-path=/tmp/unsafe-tools
```

**Expected Output** (stderr):
```
Warning: Skipping unsafe path /tmp/unsafe-tools: directory is world-writable
```

```json
{
  "discovered": 0,
  "updated": 0,
  "failed": 0,
  "skipped": 0,
  "duration_ms": 12,
  "tools": [],
  "errors": [],
  "warnings": [
    {
      "path": "/tmp/unsafe-tools",
      "reason": "world-writable directory"
    }
  ]
}
```

**Explanation**: Even with `--allow-path`, world-writable directories are rejected for security. This prevents attackers from placing malicious tools in writable directories.

---

### Example 26: Disable Safe Path Checking

For testing or trusted environments, disable safety checks:

```bash
# NOT RECOMMENDED for production
atip-discover scan --safe-paths-only=false --allow-path=/tmp/unsafe-tools
```

**Expected Output** (stderr):
```
Warning: Scanning without safe path enforcement. This may execute untrusted code.
```

**Explanation**: Safety checks can be disabled but require explicit opt-out and display a warning. This is for development/testing only.

---

### Example 27: Verbose Security Logging

Enable verbose mode to see security decisions:

```bash
atip-discover scan -v
```

**stderr Output**:
```
[DEBUG] Loading config from /home/user/.config/agent-tools/config.json
[DEBUG] Safe paths: [/usr/bin /usr/local/bin /opt/homebrew/bin /home/user/.local/bin]
[DEBUG] Scanning /usr/bin...
[DEBUG] Skipping /usr/bin/vim: not executable or not regular file
[DEBUG] Probing /usr/local/bin/gh...
[DEBUG] /usr/local/bin/gh: valid ATIP response (347 bytes)
[DEBUG] Skipping /tmp: path not in safe list
[DEBUG] Skipping /home/user/.npm/bin: directory owned by other user
[DEBUG] Scan complete: 3 discovered, 0 failed, 127 skipped
```

**Explanation**: Verbose mode shows why paths are included or excluded, useful for debugging security configuration.
