# API Specification: atip-discover

## Overview

`atip-discover` is a TypeScript CLI tool and library for discovering ATIP-compatible tools on a system. It provides:

1. **Discovery** - Scan PATH and canonical directories for ATIP tools
2. **Registry management** - Maintain a local index of discovered tools
3. **Caching** - Cache tool metadata for performance
4. **Querying** - Retrieve metadata for specific tools
5. **Programmatic API** - Use as a library in Node.js/TypeScript applications

The tool outputs JSON by default, making it suitable for agent integration. It follows XDG Base Directory conventions for file storage. This is the canonical TypeScript implementation, matching major agent CLIs like Claude Code.

---

## CLI Interface

### Global Structure

```
atip-discover [global-flags] <command> [command-flags] [arguments]
```

### Global Flags

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
| `--allow-path` | `-a` | string[] | `[]` | Additional directories to scan |
| `--skip` | `-s` | string[] | `[]` | Tools to skip during scan |
| `--timeout` | `-t` | string | `2s` | Timeout for probing each tool |
| `--parallel` | `-p` | number | `4` | Number of parallel probes |
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
4. Probe each executable with `--agent` flag in parallel
5. Validate response against ATIP schema
6. Update registry with discovered tools
7. Cache full metadata to disk
8. Output scan results

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
| `--limit` | `-l` | number | `0` | Maximum tools to list (0 = unlimited) |
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
| `--commands` | | string[] | `[]` | Filter to specific command subtrees |
| `--depth` | `-d` | number | `0` | Limit command nesting depth (0 = unlimited) |
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

### cache (alias: refresh)

Force refresh cached metadata for one or more tools.

```
atip-discover cache refresh [flags] [tool-names...]
atip-discover cache clear [flags]
atip-discover cache info
```

#### cache refresh

**Arguments**:
- `tool-names` (optional) - Specific tools to refresh (default: all)

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--stale-only` | | bool | `false` | Only refresh tools marked as stale |
| `--parallel` | `-p` | number | `4` | Number of parallel refreshes |
| `--timeout` | `-t` | string | `2s` | Timeout for probing each tool |

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

#### cache clear

Clear cached metadata.

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--all` | | bool | `false` | Clear registry and all cached metadata |
| `--tools` | | string[] | `[]` | Clear only specific tools |
| `--older-than` | | string | `0` | Clear entries older than duration |

**JSON Output Schema**:
```json
{
  "cleared": 12,
  "freed_bytes": 45678
}
```

#### cache info

Display cache information and statistics.

**JSON Output Schema**:
```json
{
  "path": "/home/user/.local/share/agent-tools",
  "registry_path": "/home/user/.local/share/agent-tools/registry.json",
  "tools_dir": "/home/user/.local/share/agent-tools/tools",
  "shims_dir": "/home/user/.local/share/agent-tools/shims",
  "tool_count": 12,
  "shim_count": 5,
  "last_scan": "2026-01-05T10:30:00Z",
  "cache_size_bytes": 45678
}
```

**Exit Codes**:
- `0` - Operation completed successfully
- `1` - Some operations failed
- `2` - Registry not found

---

## Programmatic API

The library exports functions and types for programmatic use. All functions are async/Promise-based.

### Core Types

```typescript
/**
 * XDG-compliant directory paths for ATIP tool storage.
 */
export interface AtipPaths {
  /** Base data directory ($XDG_DATA_HOME/agent-tools) */
  dataDir: string;
  /** Base config directory ($XDG_CONFIG_HOME/agent-tools) */
  configDir: string;
  /** Registry file path */
  registryPath: string;
  /** Cached tool metadata directory */
  toolsDir: string;
  /** Shim files directory */
  shimsDir: string;
}

/**
 * Entry in the tool registry (registry.json).
 */
export interface RegistryEntry {
  /** Tool's command name (e.g., "gh") */
  name: string;
  /** Tool's version string */
  version: string;
  /** Absolute path to the executable */
  path: string;
  /** How the tool was discovered: "native" (--agent flag) or "shim" (shim file) */
  source: 'native' | 'shim';
  /** When the tool was first discovered */
  discoveredAt: Date;
  /** When the tool was last probed successfully */
  lastVerified: Date;
  /** Path to cached metadata (relative to toolsDir) */
  metadataFile?: string;
  /** Executable modification time for staleness detection */
  modTime?: Date;
  /** SHA256 hash of the executable for change detection */
  checksum?: string;
}

/**
 * The full registry structure.
 */
export interface Registry {
  /** Registry format version */
  version: string;
  /** When the registry was last updated by a scan */
  lastScan: Date;
  /** List of discovered tools */
  tools: RegistryEntry[];
}

/**
 * Result of a scan operation.
 */
export interface ScanResult {
  /** Count of newly discovered tools */
  discovered: number;
  /** Count of tools with updated metadata */
  updated: number;
  /** Count of tools that failed to probe */
  failed: number;
  /** Count of executables skipped */
  skipped: number;
  /** Scan duration in milliseconds */
  durationMs: number;
  /** Successfully discovered/updated tools */
  tools: DiscoveredTool[];
  /** Tools that failed */
  errors: ScanError[];
}

/**
 * A tool found during scanning.
 */
export interface DiscoveredTool {
  name: string;
  version: string;
  path: string;
  source: 'native' | 'shim';
  discoveredAt: Date;
}

/**
 * A failed probe during scanning.
 */
export interface ScanError {
  path: string;
  error: string;
}

/**
 * Options for scan operations.
 */
export interface ScanOptions {
  /** Only scan known-safe PATH prefixes (default: true) */
  safePathsOnly?: boolean;
  /** Additional directories to scan */
  allowPaths?: string[];
  /** Tools to skip during scan */
  skipList?: string[];
  /** Timeout for probing each tool (default: 2000ms) */
  timeoutMs?: number;
  /** Number of parallel probes (default: 4) */
  parallelism?: number;
  /** Only scan new/changed executables (default: true) */
  incremental?: boolean;
  /** Include shim files in discovery (default: true) */
  includeShims?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: ScanProgress) => void;
}

/**
 * Progress update during scanning.
 */
export interface ScanProgress {
  /** Current operation */
  phase: 'enumerating' | 'probing' | 'validating' | 'caching';
  /** Number of items processed */
  current: number;
  /** Total items to process */
  total: number;
  /** Current item being processed */
  currentItem?: string;
}

/**
 * Options for list operations.
 */
export interface ListOptions {
  /** Filter by glob pattern */
  pattern?: string;
  /** Filter by source type */
  source?: 'all' | 'native' | 'shim';
  /** Sort field */
  sortBy?: 'name' | 'discovered' | 'path';
  /** Maximum tools to return (0 = unlimited) */
  limit?: number;
  /** Only show stale tools */
  staleOnly?: boolean;
}

/**
 * Configuration for discovery operations.
 * Loaded from config file, environment variables, or provided directly.
 */
export interface DiscoverConfig {
  /** Directories safe to scan */
  safePaths: string[];
  /** Additional paths to scan */
  additionalPaths: string[];
  /** Tool names/patterns to never scan */
  skipList: string[];
  /** Per-tool probe timeout in milliseconds */
  scanTimeoutMs: number;
  /** Number of concurrent probes */
  parallelism: number;
  /** Maximum cache age in milliseconds */
  cacheMaxAgeMs: number;
  /** Maximum cache size in bytes */
  cacheMaxSizeBytes: number;
  /** Default output format */
  outputFormat: 'json' | 'table' | 'quiet';
}

/**
 * Parsed ATIP metadata from a tool.
 * Matches the schema defined in schema/0.4.json.
 */
export interface AtipMetadata {
  atip: AtipVersion;
  name: string;
  version: string;
  description: string;
  homepage?: string;
  trust?: AtipTrust;
  commands?: Record<string, AtipCommand>;
  globalOptions?: AtipOption[];
  authentication?: AtipAuthentication;
  effects?: AtipEffects;
  patterns?: AtipPattern[];
  partial?: boolean;
  filter?: { commands?: string[]; depth?: number | null };
  totalCommands?: number;
  includedCommands?: number;
  omitted?: AtipOmitted;
}

// Note: AtipVersion, AtipTrust, AtipCommand, AtipOption, AtipEffects, AtipPattern
// are the same types as defined in atip-bridge. These should be imported from a
// shared types package or defined in a common location.
```

---

## Core Functions

### getAtipPaths

```typescript
/**
 * Get XDG-compliant paths for ATIP tool storage.
 *
 * @param overrides - Optional path overrides
 * @returns Resolved paths for data, config, and cache directories
 *
 * @remarks
 * - Respects XDG_DATA_HOME and XDG_CONFIG_HOME environment variables
 * - Falls back to ~/.local/share and ~/.config on Unix
 * - On Windows, uses %LOCALAPPDATA%
 * - Expands ~ to home directory
 *
 * @example
 * ```typescript
 * const paths = getAtipPaths();
 * console.log(paths.registryPath);
 * // /home/user/.local/share/agent-tools/registry.json
 * ```
 */
export function getAtipPaths(overrides?: Partial<AtipPaths>): AtipPaths;
```

**Contract**:
- Always returns fully resolved absolute paths
- Creates directories if they don't exist (on first write operation)
- Respects XDG environment variables per spec section 4

---

### loadRegistry

```typescript
/**
 * Load the tool registry from disk.
 *
 * @param paths - Optional custom paths
 * @returns The loaded registry, or a new empty registry if not found
 *
 * @remarks
 * - Returns new empty registry if file doesn't exist
 * - Validates registry structure and version
 * - Migrates old registry formats if needed
 *
 * @example
 * ```typescript
 * const registry = await loadRegistry();
 * console.log(`Found ${registry.tools.length} tools`);
 * ```
 *
 * @throws {RegistryError} If registry file is corrupted
 */
export function loadRegistry(paths?: AtipPaths): Promise<Registry>;
```

**Contract**:
- Returns empty registry `{ version: '1', lastScan: null, tools: [] }` if not found
- Throws `RegistryError` if file exists but is corrupted
- Preserves unknown fields for forward compatibility

---

### saveRegistry

```typescript
/**
 * Save the registry to disk atomically.
 *
 * @param registry - The registry to save
 * @param paths - Optional custom paths
 *
 * @remarks
 * - Uses atomic write (temp file + rename) to prevent corruption
 * - Creates parent directories if needed
 * - Updates registry version field
 *
 * @example
 * ```typescript
 * registry.lastScan = new Date();
 * await saveRegistry(registry);
 * ```
 *
 * @throws {RegistryError} If write fails
 */
export function saveRegistry(registry: Registry, paths?: AtipPaths): Promise<void>;
```

**Contract**:
- Atomic write via temp-file-rename pattern
- Creates directories with mode 0755
- File written with mode 0644

---

### scan

```typescript
/**
 * Scan for ATIP-compatible tools on the system.
 *
 * @param options - Scan configuration options
 * @param paths - Optional custom paths
 * @returns Scan results including discovered tools and errors
 *
 * @remarks
 * - Enumerates executables in safe/allowed paths
 * - Filters by skip list and modification time
 * - Probes in parallel with configurable concurrency
 * - Validates responses against ATIP schema
 * - Updates registry and caches metadata
 *
 * Security considerations (per spec section 5.2):
 * - Skips world-writable directories
 * - Skips directories owned by other users
 * - Never scans current directory (.)
 * - Prefers explicit allowlists over full PATH scanning
 *
 * @example
 * ```typescript
 * const result = await scan({
 *   safePathsOnly: true,
 *   parallelism: 4,
 *   onProgress: (p) => console.log(`${p.current}/${p.total}`)
 * });
 * console.log(`Discovered ${result.discovered} new tools`);
 * ```
 *
 * @throws {DiscoveryError} If critical error occurs (cannot write registry)
 */
export function scan(
  options?: ScanOptions,
  paths?: AtipPaths
): Promise<ScanResult>;
```

**Contract**:
- Default `safePathsOnly: true` for security
- Returns partial results on individual tool failures
- Throws only on fatal errors (registry write failure)
- Progress callback is optional and non-blocking

---

### probe

```typescript
/**
 * Probe a single executable for ATIP support.
 *
 * @param executablePath - Absolute path to the executable
 * @param options - Probe options
 * @returns Parsed ATIP metadata if tool supports --agent
 *
 * @remarks
 * - Executes the tool with --agent flag
 * - Parses and validates JSON output
 * - Respects timeout
 *
 * @example
 * ```typescript
 * const metadata = await probe('/usr/local/bin/gh', { timeoutMs: 2000 });
 * if (metadata) {
 *   console.log(`Found ${metadata.name} v${metadata.version}`);
 * }
 * ```
 *
 * @throws {ProbeError} If timeout exceeded or invalid JSON
 */
export function probe(
  executablePath: string,
  options?: { timeoutMs?: number }
): Promise<AtipMetadata | null>;
```

**Contract**:
- Returns `null` if tool doesn't support `--agent` (non-zero exit, no JSON)
- Throws `ProbeError` with details on timeout or invalid JSON
- Never executes with any other flags

---

### list

```typescript
/**
 * List tools from the registry with optional filtering.
 *
 * @param options - List options for filtering and sorting
 * @param paths - Optional custom paths
 * @returns Array of registry entries matching criteria
 *
 * @example
 * ```typescript
 * const tools = await list({ pattern: 'gh*', source: 'native' });
 * for (const tool of tools) {
 *   console.log(`${tool.name} v${tool.version}`);
 * }
 * ```
 */
export function list(
  options?: ListOptions,
  paths?: AtipPaths
): Promise<RegistryEntry[]>;
```

**Contract**:
- Returns empty array if no matches
- Pattern uses glob matching (minimatch-compatible)
- Results sorted according to `sortBy` option

---

### get

```typescript
/**
 * Get full ATIP metadata for a specific tool.
 *
 * @param toolName - Name of the tool to retrieve
 * @param options - Get options
 * @param paths - Optional custom paths
 * @returns Full ATIP metadata for the tool
 *
 * @remarks
 * - Loads from cache by default
 * - With refresh: true, probes tool first and updates cache
 * - Applies command/depth filters if specified
 *
 * @example
 * ```typescript
 * const metadata = await get('gh', { refresh: false });
 * console.log(metadata.commands);
 * ```
 *
 * @throws {ToolNotFoundError} If tool not in registry
 * @throws {MetadataNotFoundError} If cache file missing
 * @throws {ProbeError} If refresh fails
 */
export function get(
  toolName: string,
  options?: {
    refresh?: boolean;
    commands?: string[];
    depth?: number;
  },
  paths?: AtipPaths
): Promise<AtipMetadata>;
```

**Contract**:
- Throws typed errors for different failure modes
- `commands` filter returns only matching subtrees
- `depth` filter limits command nesting

---

### refresh

```typescript
/**
 * Refresh cached metadata for one or more tools.
 *
 * @param toolNames - Tools to refresh (empty = all)
 * @param options - Refresh options
 * @param paths - Optional custom paths
 * @returns Refresh results
 *
 * @example
 * ```typescript
 * const result = await refresh(['gh', 'kubectl']);
 * console.log(`Refreshed ${result.refreshed} tools`);
 * ```
 */
export function refresh(
  toolNames?: string[],
  options?: {
    staleOnly?: boolean;
    parallelism?: number;
    timeoutMs?: number;
  },
  paths?: AtipPaths
): Promise<RefreshResult>;
```

---

### loadConfig

```typescript
/**
 * Load configuration from file and environment.
 *
 * @param configPath - Optional explicit config path
 * @returns Merged configuration
 *
 * @remarks
 * Priority (highest to lowest):
 * 1. Environment variables
 * 2. Config file
 * 3. Defaults
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * console.log(`Timeout: ${config.scanTimeoutMs}ms`);
 * ```
 */
export function loadConfig(configPath?: string): Promise<DiscoverConfig>;
```

---

## Safety Functions

### isSafePath

```typescript
/**
 * Check if a path is safe to scan.
 *
 * @param path - Directory path to check
 * @returns Object with safety status and reason
 *
 * @remarks
 * Per spec section 5.2, unsafe paths include:
 * - World-writable directories
 * - Directories owned by other users
 * - Current directory (.)
 * - PATH entries from untrusted sources
 *
 * @example
 * ```typescript
 * const result = await isSafePath('/usr/local/bin');
 * if (!result.safe) {
 *   console.log(`Unsafe: ${result.reason}`);
 * }
 * ```
 */
export function isSafePath(path: string): Promise<{
  safe: boolean;
  reason?: string;
}>;
```

**Contract**:
- Returns `{ safe: false, reason: 'world-writable' }` for 0777 directories
- Returns `{ safe: false, reason: 'owned-by-other-user' }` for foreign ownership
- Returns `{ safe: false, reason: 'current-directory' }` for `.`
- Returns `{ safe: true }` for safe directories

---

### matchesSkipList

```typescript
/**
 * Check if a tool name matches any pattern in the skip list.
 *
 * @param toolName - Name to check
 * @param skipList - Patterns to match against
 * @returns True if tool should be skipped
 *
 * @remarks
 * Supports:
 * - Exact matches: "dangerous-tool"
 * - Glob patterns: "test*", "*-dev"
 *
 * @example
 * ```typescript
 * const skip = matchesSkipList('test-runner', ['test*', 'debug*']);
 * console.log(skip); // true
 * ```
 */
export function matchesSkipList(toolName: string, skipList: string[]): boolean;
```

---

## Validation Functions

### validateMetadata

```typescript
/**
 * Validate ATIP metadata against the schema.
 *
 * @param metadata - Parsed JSON to validate
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validateMetadata(parsed);
 * if (!result.valid) {
 *   console.log('Errors:', result.errors);
 * }
 * ```
 */
export function validateMetadata(metadata: unknown): ValidationResult;

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
  value?: unknown;
}
```

---

## Error Types

```typescript
/**
 * Base error for all atip-discover errors.
 */
export class DiscoverError extends Error {
  constructor(message: string, public readonly code: string);
}

/**
 * Error during registry operations.
 */
export class RegistryError extends DiscoverError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: Error
  );
}

/**
 * Error when tool is not found in registry.
 */
export class ToolNotFoundError extends DiscoverError {
  constructor(public readonly toolName: string);
}

/**
 * Error when cached metadata is not found.
 */
export class MetadataNotFoundError extends DiscoverError {
  constructor(
    public readonly toolName: string,
    public readonly expectedPath: string
  );
}

/**
 * Error during tool probing.
 */
export class ProbeError extends DiscoverError {
  constructor(
    message: string,
    public readonly executablePath: string,
    public readonly cause?: Error
  );
}

/**
 * Error when probe times out.
 */
export class ProbeTimeoutError extends ProbeError {
  constructor(
    public readonly executablePath: string,
    public readonly timeoutMs: number
  );
}

/**
 * Error when configuration is invalid.
 */
export class ConfigError extends DiscoverError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  );
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

## Module Exports

```typescript
// Core functions
export { getAtipPaths } from './xdg';
export { loadRegistry, saveRegistry } from './registry';
export { scan, probe } from './discovery';
export { list, get, refresh } from './query';
export { loadConfig } from './config';

// Safety functions
export { isSafePath, matchesSkipList } from './safety';

// Validation
export { validateMetadata } from './validator';

// Types
export type {
  AtipPaths,
  RegistryEntry,
  Registry,
  ScanResult,
  ScanOptions,
  ScanProgress,
  DiscoveredTool,
  ScanError,
  ListOptions,
  DiscoverConfig,
  AtipMetadata,
  ValidationResult,
  ValidationError,
};

// Error types
export {
  DiscoverError,
  RegistryError,
  ToolNotFoundError,
  MetadataNotFoundError,
  ProbeError,
  ProbeTimeoutError,
  ConfigError,
};

// Constants
export {
  DEFAULT_SAFE_PATHS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_PARALLELISM,
};
```

---

## Constants

```typescript
/**
 * Default safe paths for scanning (per spec section 5.2).
 */
export const DEFAULT_SAFE_PATHS = [
  '/usr/bin',
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '~/.local/bin',
] as const;

/**
 * Default timeout for probing each tool (2 seconds).
 */
export const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Default number of parallel probes.
 */
export const DEFAULT_PARALLELISM = 4;

/**
 * Registry format version.
 */
export const REGISTRY_VERSION = '1';

/**
 * Default maximum cache age (24 hours).
 */
export const DEFAULT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
```
