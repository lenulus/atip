# Usage Examples: atip-discover

## Basic CLI Usage

### Example 1: Scan for ATIP Tools

```bash
atip-discover scan
```

**Expected Output (JSON)**:
```json
{
  "discovered": 3,
  "updated": 0,
  "failed": 2,
  "skipped": 45,
  "duration_ms": 4523,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z"
    },
    {
      "name": "kubectl",
      "version": "1.28.0",
      "path": "/usr/local/bin/kubectl",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z"
    },
    {
      "name": "terraform",
      "version": "1.6.0",
      "path": "/opt/homebrew/bin/terraform",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z"
    }
  ],
  "errors": [
    {
      "path": "/usr/local/bin/slow-tool",
      "error": "timeout after 2s"
    },
    {
      "path": "/usr/local/bin/broken-tool",
      "error": "invalid JSON: unexpected token at position 0"
    }
  ]
}
```

**Explanation**: Scans default safe paths for ATIP-compatible tools. The scan discovered 3 tools, skipped 45 non-ATIP executables, and encountered 2 errors.

---

### Example 2: Scan with Custom Paths

```bash
atip-discover scan --allow-path=/opt/custom/bin --timeout=5s --parallel=8
```

**Expected Output**:
```json
{
  "discovered": 5,
  "updated": 0,
  "failed": 0,
  "skipped": 12,
  "duration_ms": 2341,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z"
    },
    {
      "name": "custom-tool",
      "version": "1.0.0",
      "path": "/opt/custom/bin/custom-tool",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z"
    }
  ],
  "errors": []
}
```

**Explanation**: Adds `/opt/custom/bin` to scan paths, increases timeout to 5 seconds, and uses 8 parallel probes for faster scanning.

---

### Example 3: Dry Run (Preview Scan)

```bash
atip-discover scan --dry-run
```

**Expected Output**:
```json
{
  "would_scan": [
    "/usr/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin"
  ],
  "executables_found": 156,
  "would_skip": [
    "python",
    "python3",
    "node"
  ],
  "would_probe": 153
}
```

**Explanation**: Shows what would be scanned without actually probing any tools. Useful for verifying configuration.

---

### Example 4: Scan with Skip List

```bash
atip-discover scan --skip=python*,node,npm
```

**Expected Output**:
```json
{
  "discovered": 2,
  "updated": 0,
  "failed": 0,
  "skipped": 48,
  "duration_ms": 3210,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z"
    }
  ],
  "errors": []
}
```

**Explanation**: Skips tools matching `python*`, `node`, and `npm`. The skip list supports glob patterns.

---

### Example 5: Table Output Format

```bash
atip-discover scan -o table
```

**Expected Output**:
```
Scanning for ATIP tools...

DISCOVERED  UPDATED  FAILED  SKIPPED  DURATION
3           0        2       45       4.5s

TOOLS:
NAME        VERSION  PATH                        SOURCE
gh          2.45.0   /usr/local/bin/gh           native
kubectl     1.28.0   /usr/local/bin/kubectl      native
terraform   1.6.0    /opt/homebrew/bin/terraform native

ERRORS:
PATH                         ERROR
/usr/local/bin/slow-tool     timeout after 2s
/usr/local/bin/broken-tool   invalid JSON
```

**Explanation**: Human-readable table format, suitable for terminal display.

---

### Example 6: Quiet Output (Counts Only)

```bash
atip-discover scan -o quiet
```

**Expected Output**:
```
3 discovered, 0 updated, 2 failed
```

**Explanation**: Minimal output showing only counts, useful for scripts.

---

## List Command Examples

### Example 7: List All Tools

```bash
atip-discover list
```

**Expected Output**:
```json
{
  "count": 5,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "description": "GitHub CLI",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z",
      "last_verified": "2026-01-05T10:30:00.000Z",
      "stale": false
    },
    {
      "name": "kubectl",
      "version": "1.28.0",
      "description": "Kubernetes command-line tool",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z",
      "last_verified": "2026-01-05T10:30:00.000Z",
      "stale": false
    },
    {
      "name": "curl",
      "version": "8.4.0",
      "description": "Transfer data from or to a server",
      "source": "shim",
      "discovered_at": "2026-01-05T10:30:00.000Z",
      "last_verified": "2026-01-05T10:30:00.000Z",
      "stale": false
    }
  ]
}
```

---

### Example 8: List with Pattern Filter

```bash
atip-discover list "kube*"
```

**Expected Output**:
```json
{
  "count": 2,
  "tools": [
    {
      "name": "kubectl",
      "version": "1.28.0",
      "description": "Kubernetes command-line tool",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z",
      "last_verified": "2026-01-05T10:30:00.000Z",
      "stale": false
    },
    {
      "name": "kubectx",
      "version": "0.9.5",
      "description": "Switch between Kubernetes contexts",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z",
      "last_verified": "2026-01-05T10:30:00.000Z",
      "stale": false
    }
  ]
}
```

---

### Example 9: List Native Tools Only

```bash
atip-discover list --source=native
```

**Expected Output**:
```json
{
  "count": 3,
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "description": "GitHub CLI",
      "source": "native",
      "discovered_at": "2026-01-05T10:30:00.000Z",
      "last_verified": "2026-01-05T10:30:00.000Z",
      "stale": false
    }
  ]
}
```

**Explanation**: Filters to only show tools discovered via `--agent` flag, excluding shims.

---

### Example 10: List Table Format

```bash
atip-discover list -o table
```

**Expected Output**:
```
NAME       VERSION  SOURCE  DESCRIPTION
gh         2.45.0   native  GitHub CLI
kubectl    1.28.0   native  Kubernetes command-line tool
terraform  1.6.0    native  Infrastructure as code
curl       8.4.0    shim    Transfer data from or to a server
jq         1.7      shim    JSON processor
```

---

### Example 11: List Quiet (Names Only)

```bash
atip-discover list -o quiet
```

**Expected Output**:
```
gh
kubectl
terraform
curl
jq
```

**Explanation**: Just tool names, one per line. Useful for piping to other commands.

---

## Get Command Examples

### Example 12: Get Tool Metadata

```bash
atip-discover get gh
```

**Expected Output**:
```json
{
  "atip": {
    "version": "0.6",
    "features": ["trust-v1"]
  },
  "name": "gh",
  "version": "2.45.0",
  "description": "GitHub CLI",
  "homepage": "https://cli.github.com",
  "trust": {
    "source": "native",
    "verified": true
  },
  "authentication": {
    "required": true,
    "methods": [
      {
        "type": "oauth",
        "setupCommand": "gh auth login"
      }
    ],
    "checkCommand": "gh auth status"
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
          "options": [
            {
              "name": "title",
              "flags": ["-t", "--title"],
              "type": "string",
              "description": "PR title"
            }
          ],
          "effects": {
            "network": true,
            "idempotent": false,
            "creates": ["pull_request"]
          }
        }
      }
    },
    "repo": {
      "description": "Manage repositories",
      "commands": {
        "delete": {
          "description": "Delete a repository",
          "arguments": [
            {
              "name": "repository",
              "type": "string",
              "description": "Repository in OWNER/REPO format",
              "required": true
            }
          ],
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

**Explanation**: Returns full ATIP metadata for the tool from cache.

---

### Example 13: Get with Refresh

```bash
atip-discover get gh --refresh
```

**Expected Output**: Same as Example 12, but metadata is freshly probed from the tool.

**Explanation**: Forces a fresh probe of the tool with `--agent`, updating the cache.

---

### Example 14: Get Specific Commands

```bash
atip-discover get gh --commands=pr
```

**Expected Output**:
```json
{
  "atip": {
    "version": "0.6"
  },
  "name": "gh",
  "version": "2.45.0",
  "description": "GitHub CLI",
  "partial": true,
  "filter": {
    "commands": ["pr"]
  },
  "commands": {
    "pr": {
      "description": "Manage pull requests",
      "commands": {
        "list": {
          "description": "List pull requests",
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
    }
  }
}
```

**Explanation**: Filters to only return the `pr` command subtree. Marks output as `partial: true`.

---

### Example 15: Get with Depth Limit

```bash
atip-discover get kubectl --depth=1
```

**Expected Output**:
```json
{
  "atip": {
    "version": "0.6"
  },
  "name": "kubectl",
  "version": "1.28.0",
  "description": "Kubernetes command-line tool",
  "partial": true,
  "filter": {
    "depth": 1
  },
  "commands": {
    "get": {
      "description": "Display resources"
    },
    "apply": {
      "description": "Apply configuration"
    },
    "delete": {
      "description": "Delete resources"
    },
    "describe": {
      "description": "Show details of resources"
    }
  }
}
```

**Explanation**: Returns only top-level commands without nested subcommands. Useful for large tools.

---

### Example 16: Tool Not Found

```bash
atip-discover get nonexistent-tool
```

**Expected Output**:
```json
{
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool not found: nonexistent-tool"
  }
}
```

**Exit Code**: `1`

---

## Cache Command Examples

### Example 17: Refresh All Tools

```bash
atip-discover cache refresh
```

**Expected Output**:
```json
{
  "refreshed": 2,
  "failed": 1,
  "unchanged": 2,
  "duration_ms": 3456,
  "tools": [
    {
      "name": "gh",
      "status": "updated",
      "old_version": "2.44.0",
      "new_version": "2.45.0"
    },
    {
      "name": "kubectl",
      "status": "unchanged",
      "old_version": "1.28.0",
      "new_version": "1.28.0"
    },
    {
      "name": "terraform",
      "status": "updated",
      "old_version": "1.5.0",
      "new_version": "1.6.0"
    }
  ],
  "errors": [
    {
      "name": "removed-tool",
      "error": "executable not found"
    }
  ]
}
```

---

### Example 18: Refresh Specific Tools

```bash
atip-discover cache refresh gh kubectl
```

**Expected Output**:
```json
{
  "refreshed": 1,
  "failed": 0,
  "unchanged": 1,
  "duration_ms": 1234,
  "tools": [
    {
      "name": "gh",
      "status": "updated",
      "old_version": "2.44.0",
      "new_version": "2.45.0"
    },
    {
      "name": "kubectl",
      "status": "unchanged",
      "old_version": "1.28.0",
      "new_version": "1.28.0"
    }
  ],
  "errors": []
}
```

---

### Example 19: Cache Info

```bash
atip-discover cache info
```

**Expected Output**:
```json
{
  "path": "/home/user/.local/share/agent-tools",
  "registry_path": "/home/user/.local/share/agent-tools/registry.json",
  "tools_dir": "/home/user/.local/share/agent-tools/tools",
  "shims_dir": "/home/user/.local/share/agent-tools/shims",
  "tool_count": 5,
  "shim_count": 2,
  "last_scan": "2026-01-05T10:30:00.000Z",
  "cache_size_bytes": 45678
}
```

---

### Example 20: Clear Cache

```bash
atip-discover cache clear --all
```

**Expected Output**:
```json
{
  "cleared": 5,
  "freed_bytes": 45678
}
```

---

## Programmatic API Examples

### Example 21: Basic Scan

```typescript
import { scan, loadRegistry } from 'atip-discover';

// Scan with default options
const result = await scan();

console.log(`Discovered ${result.discovered} new tools`);
console.log(`Updated ${result.updated} tools`);

for (const tool of result.tools) {
  console.log(`- ${tool.name} v${tool.version} (${tool.source})`);
}
```

**Expected Output**:
```
Discovered 3 new tools
Updated 0 tools
- gh v2.45.0 (native)
- kubectl v1.28.0 (native)
- terraform v1.6.0 (native)
```

---

### Example 22: Scan with Options and Progress

```typescript
import { scan } from 'atip-discover';

const result = await scan({
  safePathsOnly: true,
  parallelism: 8,
  timeoutMs: 5000,
  onProgress: (progress) => {
    console.log(`[${progress.phase}] ${progress.current}/${progress.total}: ${progress.currentItem}`);
  }
});

console.log(result);
```

**Expected Output**:
```
[enumerating] 1/3: /usr/bin
[enumerating] 2/3: /usr/local/bin
[enumerating] 3/3: /opt/homebrew/bin
[probing] 1/50: /usr/local/bin/gh
[probing] 2/50: /usr/local/bin/kubectl
...
[validating] 3/3: terraform
[caching] 3/3: terraform
{ discovered: 3, updated: 0, failed: 0, ... }
```

---

### Example 23: List and Filter Tools

```typescript
import { list } from 'atip-discover';

// List all tools
const allTools = await list();
console.log(`Total tools: ${allTools.length}`);

// List with pattern
const kubeTools = await list({ pattern: 'kube*' });
console.log(`Kube tools: ${kubeTools.map(t => t.name).join(', ')}`);

// List native tools only
const nativeTools = await list({ source: 'native' });
console.log(`Native tools: ${nativeTools.length}`);
```

**Expected Output**:
```
Total tools: 5
Kube tools: kubectl, kubectx
Native tools: 3
```

---

### Example 24: Get Tool Metadata

```typescript
import { get, ToolNotFoundError } from 'atip-discover';

try {
  // Get from cache
  const ghMetadata = await get('gh');
  console.log(`${ghMetadata.name} v${ghMetadata.version}`);
  console.log(`Commands: ${Object.keys(ghMetadata.commands || {}).join(', ')}`);

  // Get with refresh
  const freshMetadata = await get('gh', { refresh: true });
  console.log(`Refreshed: ${freshMetadata.version}`);

  // Get with filter
  const prOnly = await get('gh', { commands: ['pr'] });
  console.log(`PR commands: ${Object.keys(prOnly.commands?.pr?.commands || {}).join(', ')}`);

} catch (error) {
  if (error instanceof ToolNotFoundError) {
    console.error(`Tool not found: ${error.toolName}`);
  }
}
```

**Expected Output**:
```
gh v2.45.0
Commands: pr, repo, issue, gist
Refreshed: 2.45.0
PR commands: list, create, merge, view
```

---

### Example 25: Probe Single Tool

```typescript
import { probe } from 'atip-discover';

// Check if a tool supports ATIP
const metadata = await probe('/usr/local/bin/gh', { timeoutMs: 2000 });

if (metadata) {
  console.log(`${metadata.name} supports ATIP v${metadata.atip.version || metadata.atip}`);
  console.log(`Description: ${metadata.description}`);
} else {
  console.log('Tool does not support ATIP');
}
```

**Expected Output**:
```
gh supports ATIP v0.4
Description: GitHub CLI
```

---

### Example 26: XDG Paths

```typescript
import { getAtipPaths } from 'atip-discover';

const paths = getAtipPaths();

console.log(`Data dir: ${paths.dataDir}`);
console.log(`Config dir: ${paths.configDir}`);
console.log(`Registry: ${paths.registryPath}`);
console.log(`Tools cache: ${paths.toolsDir}`);
console.log(`Shims: ${paths.shimsDir}`);
```

**Expected Output**:
```
Data dir: /home/user/.local/share/agent-tools
Config dir: /home/user/.config/agent-tools
Registry: /home/user/.local/share/agent-tools/registry.json
Tools cache: /home/user/.local/share/agent-tools/tools
Shims: /home/user/.local/share/agent-tools/shims
```

---

### Example 27: Custom Paths (XDG Override)

```typescript
import { getAtipPaths, scan } from 'atip-discover';

// Override with custom paths
const customPaths = getAtipPaths({
  dataDir: '/custom/data/agent-tools'
});

// Use custom paths for scan
const result = await scan({}, customPaths);
```

---

### Example 28: Load Configuration

```typescript
import { loadConfig } from 'atip-discover';

const config = await loadConfig();

console.log(`Safe paths: ${config.safePaths.join(', ')}`);
console.log(`Timeout: ${config.scanTimeoutMs}ms`);
console.log(`Parallelism: ${config.parallelism}`);
console.log(`Skip list: ${config.skipList.join(', ')}`);
```

**Expected Output**:
```
Safe paths: /usr/bin, /usr/local/bin, /opt/homebrew/bin, ~/.local/bin
Timeout: 2000ms
Parallelism: 4
Skip list:
```

---

### Example 29: Safety Check

```typescript
import { isSafePath, matchesSkipList } from 'atip-discover';

// Check if path is safe to scan
const result = await isSafePath('/usr/local/bin');
if (result.safe) {
  console.log('Path is safe to scan');
} else {
  console.log(`Unsafe: ${result.reason}`);
}

// Check skip list
const skip = matchesSkipList('test-runner', ['test*', 'debug*']);
console.log(`Should skip: ${skip}`);
```

**Expected Output**:
```
Path is safe to scan
Should skip: true
```

---

### Example 30: Validate Metadata

```typescript
import { validateMetadata } from 'atip-discover';

const parsed = JSON.parse(jsonString);
const result = validateMetadata(parsed);

if (result.valid) {
  console.log('Metadata is valid ATIP');
} else {
  console.log('Validation errors:');
  for (const error of result.errors) {
    console.log(`  ${error.path.join('.')}: ${error.message}`);
  }
}
```

**Expected Output** (for invalid metadata):
```
Validation errors:
  atip: Required property
  name: Required property
```

---

## Integration Examples

### Example 31: Integration with atip-bridge

```typescript
import { get } from 'atip-discover';
import { toOpenAI, createValidator } from 'atip-bridge';

// Discover and get tool metadata
const ghMetadata = await get('gh');

// Compile to OpenAI format
const openaiTools = toOpenAI(ghMetadata, { strict: true });

// Create validator for safety
const validator = createValidator([ghMetadata], {
  allowDestructive: false,
  allowNonReversible: false
});

// Use in OpenAI request
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'List my open PRs' }],
  tools: openaiTools
});

// Validate tool calls
for (const call of response.choices[0].message.tool_calls || []) {
  const result = validator.validate(call.function.name, JSON.parse(call.function.arguments));
  if (!result.valid) {
    console.log(`Blocked: ${result.violations.map(v => v.message).join(', ')}`);
  }
}
```

---

### Example 32: Discover and Compile All Tools

```typescript
import { list, get } from 'atip-discover';
import { compileTools } from 'atip-bridge';

// Get all native tools
const tools = await list({ source: 'native' });

// Load full metadata for each
const metadata = await Promise.all(
  tools.map(t => get(t.name))
);

// Compile to Anthropic format
const anthropicTools = compileTools(metadata, 'anthropic');

console.log(`Compiled ${anthropicTools.tools.length} tools for Anthropic`);
```

---

### Example 33: Agent Integration Pattern

```typescript
import { scan, list, get } from 'atip-discover';
import { toOpenAI, parseToolCall, handleToolResult } from 'atip-bridge';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class AtipAgent {
  private tools: Map<string, any> = new Map();
  private openaiTools: any[] = [];

  async initialize() {
    // Initial scan
    await scan();

    // Load all discovered tools
    const entries = await list({ source: 'native' });

    for (const entry of entries) {
      const metadata = await get(entry.name);
      this.tools.set(entry.name, metadata);
    }

    // Compile to OpenAI format
    const allMetadata = Array.from(this.tools.values());
    this.openaiTools = allMetadata.flatMap(m => toOpenAI(m, { strict: true }));
  }

  getTools() {
    return this.openaiTools;
  }

  async executeTool(name: string, args: Record<string, unknown>) {
    // Convert flattened name back to CLI command
    // gh_pr_list -> gh pr list
    const parts = name.split('_');
    const command = parts.join(' ');

    // Build argument string
    const argString = Object.entries(args)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `--${k}=${v}`)
      .join(' ');

    const fullCommand = `${command} ${argString}`;

    try {
      const { stdout } = await execAsync(fullCommand);
      return { success: true, output: stdout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Usage
const agent = new AtipAgent();
await agent.initialize();

const tools = agent.getTools();
console.log(`Agent initialized with ${tools.length} tools`);
```

---

## Error Handling Examples

### Example 34: Handle Probe Errors

```typescript
import { probe, ProbeTimeoutError, ProbeError } from 'atip-discover';

try {
  const metadata = await probe('/usr/local/bin/slow-tool', { timeoutMs: 1000 });
} catch (error) {
  if (error instanceof ProbeTimeoutError) {
    console.log(`Probe timed out after ${error.timeoutMs}ms`);
    console.log(`Tool: ${error.executablePath}`);
  } else if (error instanceof ProbeError) {
    console.log(`Probe failed: ${error.message}`);
  }
}
```

---

### Example 35: Handle Registry Errors

```typescript
import { loadRegistry, saveRegistry, RegistryError } from 'atip-discover';

try {
  const registry = await loadRegistry();

  // Modify registry
  registry.lastScan = new Date();

  await saveRegistry(registry);
} catch (error) {
  if (error instanceof RegistryError) {
    console.log(`Registry error at ${error.path}: ${error.message}`);
    if (error.cause) {
      console.log(`Caused by: ${error.cause.message}`);
    }
  }
}
```

---

### Example 36: Handle Not Found Errors

```typescript
import { get, ToolNotFoundError, MetadataNotFoundError } from 'atip-discover';

try {
  const metadata = await get('nonexistent-tool');
} catch (error) {
  if (error instanceof ToolNotFoundError) {
    console.log(`Tool '${error.toolName}' not in registry`);
    console.log('Run "atip-discover scan" to discover tools');
  } else if (error instanceof MetadataNotFoundError) {
    console.log(`Metadata for '${error.toolName}' not found at ${error.expectedPath}`);
    console.log('Run "atip-discover cache refresh" to regenerate cache');
  }
}
```

---

## Configuration Examples

### Example 37: Environment Variable Configuration

```bash
# Set safe paths
export ATIP_DISCOVER_SAFE_PATHS="/usr/bin:/usr/local/bin:/custom/bin"

# Set skip list
export ATIP_DISCOVER_SKIP="python*,node,npm"

# Set timeout
export ATIP_DISCOVER_TIMEOUT="5s"

# Set parallelism
export ATIP_DISCOVER_PARALLEL="8"

# Run scan with env config
atip-discover scan
```

---

### Example 38: Configuration File

Create `~/.config/agent-tools/config.json`:

```json
{
  "version": "1",
  "discovery": {
    "safe_paths": [
      "/usr/bin",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "~/.local/bin",
      "/opt/custom/bin"
    ],
    "additional_paths": [],
    "skip_list": [
      "python*",
      "node",
      "npm",
      "test-*"
    ],
    "scan_timeout": "3s",
    "parallelism": 8
  },
  "cache": {
    "max_age": "48h",
    "max_size_mb": 200
  },
  "output": {
    "default_format": "json",
    "color": "auto"
  }
}
```

Then run:
```bash
atip-discover scan
```

Configuration from file is used, overridden by environment variables.

---

### Example 39: Verbose Debugging

```bash
atip-discover scan -v
```

**Expected Output (stderr)**:
```
[DEBUG] Loading config from /home/user/.config/agent-tools/config.json
[DEBUG] Safe paths: ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"]
[DEBUG] Checking path: /usr/bin
[DEBUG] Checking path: /usr/local/bin
[DEBUG] Checking path: /opt/homebrew/bin
[DEBUG] Found 156 executables
[DEBUG] After skip filter: 153 executables
[DEBUG] Starting parallel probe with parallelism=4
[DEBUG] Probing: /usr/local/bin/gh
[DEBUG] Probing: /usr/local/bin/kubectl
...
[DEBUG] Discovered: gh v2.45.0
[DEBUG] Saving registry
```

**stdout**: Normal JSON output

---

## Security Examples

### Example 40: Safe Path Checking

```typescript
import { isSafePath } from 'atip-discover';

// Check various paths
const paths = [
  '/usr/bin',           // Safe
  '/tmp/malicious',     // World-writable
  '.',                  // Current directory
  '/home/other/bin'     // Owned by other user
];

for (const path of paths) {
  const result = await isSafePath(path);
  console.log(`${path}: ${result.safe ? 'safe' : result.reason}`);
}
```

**Expected Output**:
```
/usr/bin: safe
/tmp/malicious: world-writable
.: current-directory
/home/other/bin: owned-by-other-user
```

---

### Example 41: Scan with Safety Warnings

```bash
atip-discover scan --allow-path=/tmp/untrusted --safe-paths-only=false
```

**Expected Output (stderr)**:
```
Warning: Scanning without safe path enforcement. This may execute untrusted code.
Warning: Scanning potentially unsafe path /tmp/untrusted (safe-paths-only disabled)
Skipping world-writable directory: /tmp/untrusted
```

**Explanation**: The tool warns about disabled safety checks and skips truly dangerous paths even when safety is disabled.
