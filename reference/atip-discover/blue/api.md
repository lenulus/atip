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
  "atip": {"version": "0.6"},
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
 * Safely probe a single executable for ATIP support using two-phase detection.
 *
 * @param executablePath - Absolute path to the executable
 * @param options - Probe options
 * @returns Parsed ATIP metadata if tool supports --agent
 *
 * @remarks
 * Uses a two-phase approach for safety:
 *
 * **Phase 1: --help check**
 * - Executes `tool --help` (universally safe)
 * - Parses output to check if `--agent` is a documented option
 * - If `--agent` not found, returns null immediately (no further execution)
 *
 * **Phase 2: --agent execution**
 * - Only runs if Phase 1 confirmed `--agent` is supported
 * - Executes `tool --agent` and parses JSON output
 * - Validates against ATIP schema
 *
 * This prevents blindly executing unknown flags on tools that don't support ATIP,
 * avoiding unexpected behavior, permission prompts, or errors.
 *
 * @example
 * ```typescript
 * const metadata = await probe('/opt/homebrew/bin/gh', { timeoutMs: 2000 });
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
- Returns `null` if tool doesn't document `--agent` in `--help` output
- Returns `null` if `--agent` execution fails (non-zero exit, no JSON)
- Throws `ProbeError` with details on timeout or invalid JSON
- Phase 1 (`--help`) timeout and Phase 2 (`--agent`) timeout are both controlled by `timeoutMs`

---

### checkHelpForAgent

```typescript
/**
 * Check if a tool's --help output documents an --agent flag.
 *
 * @param executablePath - Absolute path to the executable
 * @param options - Check options
 * @returns True if --agent appears to be a supported option
 *
 * @remarks
 * This is the first phase of safe probing. Running `--help` is universally
 * safe and allows us to verify --agent support before executing it.
 *
 * Checks for patterns like:
 * - `--agent` as a standalone flag
 * - `-agent` short form
 * - References to ATIP/agent functionality
 *
 * @example
 * ```typescript
 * const supportsAgent = await checkHelpForAgent('/opt/homebrew/bin/gh');
 * if (supportsAgent) {
 *   const metadata = await probe('/opt/homebrew/bin/gh');
 * }
 * ```
 */
export function checkHelpForAgent(
  executablePath: string,
  options?: { timeoutMs?: number }
): Promise<boolean>;
```

**Contract**:
- Returns `true` if `--agent` appears in help output
- Returns `false` if `--help` fails or `--agent` not found
- Never throws - returns `false` on any error (safe default)

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
export { scan, probe, checkHelpForAgent } from './discovery';
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

// Trust verification (Phase 4.4.5)
export {
  TrustLevel,
  verifyTrust,
  computeBinaryHash,
  verifyCosignSignature,
  verifySLSAProvenance,
  evaluateTrustLevel,
} from './trust';

// Trust types
export type {
  AtipTrustFull,
  TrustIntegrity,
  TrustSignature,
  TrustProvenance,
  TrustVerificationResult,
  TrustVerificationOptions,
  HashResult,
  SignatureVerificationResult,
  ProvenanceVerificationResult,
  TrustEvaluationResult,
};
```

---

## Trust Verification API (Phase 4.4.5)

Trust verification enables cryptographic validation of ATIP metadata and binaries per spec section 3.2.2. This module provides functions for hash computation, signature verification (Sigstore/Cosign), SLSA attestation checking, and trust level evaluation.

### Trust Level Enum

```typescript
/**
 * Trust evaluation levels from spec section 3.2.2.
 *
 * Higher values indicate higher trust. Agents should use these
 * levels to make execution decisions.
 *
 * @remarks
 * - COMPROMISED (0): Binary hash mismatch - DO NOT RUN
 * - UNSIGNED (1): No signature found - sandbox or require confirmation
 * - UNVERIFIED (2): Signature exists but was not checked (offline mode)
 * - PROVENANCE_FAIL (3): SLSA attestation check failed
 * - VERIFIED (4): Full cryptographic verification passed
 */
export enum TrustLevel {
  /** Hash mismatch detected - binary may have been tampered with */
  COMPROMISED = 0,
  /** No cryptographic signature found */
  UNSIGNED = 1,
  /** Signature exists but verification was skipped */
  UNVERIFIED = 2,
  /** SLSA provenance attestation failed verification */
  PROVENANCE_FAIL = 3,
  /** Full cryptographic verification passed */
  VERIFIED = 4,
}
```

---

### Trust Types (Full Spec 3.2.2 Compliance)

```typescript
/**
 * Cryptographic signature block for trust verification.
 * Supports Sigstore/Cosign (recommended), GPG, and Minisign.
 */
export interface TrustSignature {
  /** Signature algorithm/system: cosign (Sigstore), gpg, or minisign */
  type: 'cosign' | 'gpg' | 'minisign';
  /**
   * Expected signer identity (OIDC subject for cosign).
   * For cosign: the workflow path, e.g.,
   * "https://github.com/cli/cli/.github/workflows/release.yml@refs/tags/v2.45.0"
   */
  identity: string;
  /**
   * OIDC issuer URL for cosign signatures.
   * E.g., "https://token.actions.githubusercontent.com" for GitHub Actions
   */
  issuer: string;
  /** Optional URL to signature bundle file */
  bundle?: string;
}

/**
 * Integrity verification block per spec section 3.2.2.
 * Contains checksum and optional signature for binary verification.
 */
export interface TrustIntegrity {
  /**
   * Content-addressable hash of the binary.
   * Format: "sha256:<64-hex-chars>"
   * This is the primary integrity mechanism - matching hash = correct binary.
   */
  checksum?: string;
  /** Cryptographic signature for the binary or shim */
  signature?: TrustSignature;
}

/**
 * SLSA provenance attestation block per spec section 3.2.2.
 * Links to build attestation proving binary provenance.
 */
export interface TrustProvenance {
  /** URL to attestation document (.intoto.jsonl or similar) */
  url: string;
  /** Attestation format: SLSA v1 or generic in-toto */
  format: 'slsa-provenance-v1' | 'in-toto';
  /** Claimed SLSA level (1-4). Higher = stronger guarantees. */
  slsaLevel: number;
  /** Optional trusted builder identity */
  builder?: string;
}

/**
 * Full trust metadata per spec section 3.2.2.
 * Extends the basic AtipTrust interface with integrity and provenance.
 *
 * @remarks
 * This interface represents the complete trust object that may appear
 * in ATIP metadata. The basic AtipTrust (source, verified) is always
 * present; integrity and provenance are optional extensions.
 */
export interface AtipTrustFull {
  /**
   * Origin of metadata.
   * - native: Tool implements --agent directly (HIGH trust)
   * - vendor: Official shim from tool vendor (HIGH trust)
   * - org: Organization-maintained shim (MEDIUM trust)
   * - community: Community-contributed shim (LOW trust)
   * - user: User-created local shim (LOW trust)
   * - inferred: Auto-generated from --help parsing (VERY LOW trust)
   */
  source: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred';
  /** Whether metadata has been verified against tool behavior */
  verified: boolean;
  /** Cryptographic integrity verification (checksums, signatures) */
  integrity?: TrustIntegrity;
  /** SLSA provenance attestation */
  provenance?: TrustProvenance;
}
```

---

### Hash Computation

```typescript
/**
 * Result of binary hash computation.
 */
export interface HashResult {
  /** Algorithm used (always "sha256" currently) */
  algorithm: 'sha256';
  /** Hex-encoded hash value (64 characters) */
  hash: string;
  /** Formatted string: "sha256:<hash>" */
  formatted: string;
}

/**
 * Compute SHA-256 hash of a binary file.
 *
 * @param binaryPath - Absolute path to the binary file
 * @returns Hash result with algorithm, raw hash, and formatted string
 *
 * @remarks
 * - Reads file in chunks for memory efficiency (8KB chunks)
 * - Uses Node.js crypto module (no external dependencies)
 * - Returns lowercase hex encoding
 *
 * @example
 * ```typescript
 * const result = await computeBinaryHash('/usr/local/bin/gh');
 * console.log(result.formatted);
 * // "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *
 * // Use for content-addressable lookup
 * const shimUrl = `https://atip.dev/shims/${result.formatted.replace(':', '/')}.json`;
 * ```
 *
 * @throws {TrustError} If file cannot be read or hash computation fails
 */
export function computeBinaryHash(binaryPath: string): Promise<HashResult>;
```

**Contract**:
- Returns SHA-256 hash in lowercase hex encoding
- Reads file in 8KB chunks to handle large binaries efficiently
- Throws `TrustError` with code `HASH_COMPUTATION_FAILED` on failure
- `formatted` field is suitable for direct use in shim lookups

---

### Signature Verification

```typescript
/**
 * Result of cryptographic signature verification.
 */
export interface SignatureVerificationResult {
  /** Whether signature verification succeeded */
  verified: boolean;
  /** Signature type that was checked */
  type: 'cosign' | 'gpg' | 'minisign';
  /** Verified signer identity (if successful) */
  identity?: string;
  /** Error message if verification failed */
  error?: string;
  /** Raw verification output (for debugging) */
  rawOutput?: string;
}

/**
 * Verify Cosign (Sigstore) signature for a file.
 *
 * @param targetPath - Path to the file to verify (binary or shim JSON)
 * @param signature - Signature block from trust metadata
 * @param options - Optional verification options
 * @returns Verification result with success status and details
 *
 * @remarks
 * - Requires `cosign` CLI to be installed and in PATH
 * - Uses keyless verification with OIDC identity matching
 * - Verifies both identity (subject) and issuer
 * - Supports signature bundles for offline verification
 *
 * Cosign is invoked as:
 * ```bash
 * cosign verify-blob \
 *   --certificate-identity <identity> \
 *   --certificate-oidc-issuer <issuer> \
 *   [--bundle <bundle-path>] \
 *   <target-path>
 * ```
 *
 * @example
 * ```typescript
 * const result = await verifyCosignSignature('/usr/local/bin/gh', {
 *   type: 'cosign',
 *   identity: 'https://github.com/cli/cli/.github/workflows/release.yml@refs/tags/v2.45.0',
 *   issuer: 'https://token.actions.githubusercontent.com'
 * });
 *
 * if (result.verified) {
 *   console.log(`Verified signature from: ${result.identity}`);
 * } else {
 *   console.log(`Verification failed: ${result.error}`);
 * }
 * ```
 *
 * @throws {TrustError} If cosign is not installed
 */
export function verifyCosignSignature(
  targetPath: string,
  signature: TrustSignature,
  options?: {
    /** Timeout for cosign invocation in ms (default: 30000) */
    timeoutMs?: number;
    /** Path to downloaded bundle file (overrides signature.bundle) */
    bundlePath?: string;
  }
): Promise<SignatureVerificationResult>;
```

**Contract**:
- Returns `{ verified: true }` only if cosign exits with code 0 AND identity matches
- Returns `{ verified: false, error: "..." }` on verification failure
- Throws `TrustError` with code `COSIGN_NOT_INSTALLED` if cosign CLI is not available
- Throws `TrustError` with code `VERIFICATION_TIMEOUT` on timeout
- Only supports `type: 'cosign'` currently; GPG and minisign support is future work

---

### SLSA Provenance Verification

```typescript
/**
 * Result of SLSA provenance attestation verification.
 */
export interface ProvenanceVerificationResult {
  /** Whether provenance verification succeeded */
  verified: boolean;
  /** Verified SLSA level (if successful) */
  slsaLevel?: number;
  /** Verified builder identity (if successful) */
  builder?: string;
  /** Error message if verification failed */
  error?: string;
  /** Attestation details for debugging */
  attestation?: {
    subject: string;
    predicateType: string;
    buildType?: string;
  };
}

/**
 * Verify SLSA provenance attestation for a binary.
 *
 * @param binaryPath - Path to the binary being verified
 * @param provenance - Provenance block from trust metadata
 * @param options - Optional verification options
 * @returns Verification result with SLSA level and builder info
 *
 * @remarks
 * - Fetches attestation from provenance.url
 * - Verifies attestation signature
 * - Checks that attestation subject matches binary hash
 * - Validates claimed SLSA level against attestation contents
 *
 * SLSA level meanings (per spec):
 * - Level 1: Build process documented
 * - Level 2: Signed provenance, hosted build
 * - Level 3: Hardened build platform
 * - Level 4: Two-party review, hermetic build
 *
 * @example
 * ```typescript
 * const result = await verifySLSAProvenance('/usr/local/bin/gh', {
 *   url: 'https://github.com/cli/cli/attestations/sha256:...',
 *   format: 'slsa-provenance-v1',
 *   slsaLevel: 3,
 *   builder: 'https://github.com/actions/runner'
 * });
 *
 * if (result.verified) {
 *   console.log(`SLSA Level ${result.slsaLevel} verified`);
 *   console.log(`Built by: ${result.builder}`);
 * }
 * ```
 *
 * @throws {TrustError} If attestation cannot be fetched or parsed
 */
export function verifySLSAProvenance(
  binaryPath: string,
  provenance: TrustProvenance,
  options?: {
    /** Timeout for fetching attestation in ms (default: 10000) */
    timeoutMs?: number;
    /** Minimum acceptable SLSA level (default: 1) */
    minimumLevel?: number;
    /** Expected builder(s) - if set, builder must match one */
    allowedBuilders?: string[];
  }
): Promise<ProvenanceVerificationResult>;
```

**Contract**:
- Returns `{ verified: true, slsaLevel: N }` only if attestation is valid
- Verifies attestation subject matches `sha256(binaryPath)`
- Checks claimed level against actual attestation contents
- Returns `{ verified: false }` if level is below `minimumLevel`
- Throws `TrustError` with code `ATTESTATION_FETCH_FAILED` on network error
- Throws `TrustError` with code `ATTESTATION_PARSE_FAILED` on invalid attestation

---

### Trust Level Evaluation

```typescript
/**
 * Comprehensive trust evaluation result.
 */
export interface TrustEvaluationResult {
  /** Final evaluated trust level */
  level: TrustLevel;
  /** Human-readable explanation of the trust level */
  reason: string;
  /** Detailed verification results for each check performed */
  checks: {
    /** Hash verification result */
    hash?: {
      checked: boolean;
      expected?: string;
      actual?: string;
      matches?: boolean;
    };
    /** Signature verification result */
    signature?: SignatureVerificationResult;
    /** Provenance verification result */
    provenance?: ProvenanceVerificationResult;
  };
  /** Recommended agent action based on trust level */
  recommendation: 'execute' | 'sandbox' | 'confirm' | 'block';
}

/**
 * Evaluate trust level for a tool based on its metadata and binary.
 *
 * @param binaryPath - Path to the tool binary
 * @param trust - Trust metadata from ATIP metadata
 * @param options - Evaluation options
 * @returns Complete trust evaluation with level and recommendations
 *
 * @remarks
 * Implements the verification flow from spec section 3.2.2:
 *
 * 1. **Binary integrity check** (if checksum provided):
 *    - Compute sha256(binary)
 *    - Compare to trust.integrity.checksum
 *    - COMPROMISED if mismatch
 *
 * 2. **Signature verification** (if signature provided):
 *    - Verify cosign/gpg/minisign signature
 *    - UNSIGNED if no signature or verification fails
 *
 * 3. **SLSA provenance** (if provenance provided):
 *    - Fetch and verify attestation
 *    - PROVENANCE_FAIL if verification fails
 *
 * 4. **All checks pass**: VERIFIED
 *
 * @example
 * ```typescript
 * const metadata = await get('gh');
 * const result = await evaluateTrustLevel('/usr/local/bin/gh', metadata.trust, {
 *   verifySignatures: true,
 *   verifyProvenance: true,
 *   minimumSlsaLevel: 2
 * });
 *
 * switch (result.level) {
 *   case TrustLevel.COMPROMISED:
 *     throw new SecurityError('Binary hash mismatch - possible tampering');
 *   case TrustLevel.UNSIGNED:
 *     if (effectsHasSideEffects(metadata.effects)) {
 *       await confirmWithUser('Tool is unsigned. Continue?');
 *     }
 *     break;
 *   case TrustLevel.VERIFIED:
 *     // Safe to execute
 *     break;
 * }
 * ```
 */
export function evaluateTrustLevel(
  binaryPath: string,
  trust: AtipTrustFull | undefined,
  options?: TrustVerificationOptions
): Promise<TrustEvaluationResult>;
```

---

### Trust Verification Options

```typescript
/**
 * Options for trust verification operations.
 */
export interface TrustVerificationOptions {
  /**
   * Whether to verify cryptographic signatures (default: true).
   * Set to false for offline operation or when cosign is not installed.
   */
  verifySignatures?: boolean;
  /**
   * Whether to verify SLSA provenance attestations (default: true).
   * Requires network access to fetch attestations.
   */
  verifyProvenance?: boolean;
  /**
   * Minimum acceptable SLSA level (default: 1).
   * Tools with lower levels will be treated as PROVENANCE_FAIL.
   */
  minimumSlsaLevel?: number;
  /**
   * Allowed signature identities (default: any).
   * If set, only signatures from these identities are accepted.
   */
  allowedSignerIdentities?: string[];
  /**
   * Allowed OIDC issuers (default: any).
   * If set, only signatures from these issuers are accepted.
   */
  allowedIssuers?: string[];
  /**
   * Allowed builders for SLSA attestations (default: any).
   * If set, only attestations from these builders are accepted.
   */
  allowedBuilders?: string[];
  /**
   * Timeout for network operations in ms (default: 30000).
   * Applies to signature bundle downloads and attestation fetches.
   */
  networkTimeoutMs?: number;
  /**
   * Skip verification but mark as UNVERIFIED instead of failing.
   * Useful for offline mode or development.
   */
  offlineMode?: boolean;
}
```

---

### High-Level Trust Verification

```typescript
/**
 * Complete trust verification result combining all checks.
 */
export interface TrustVerificationResult {
  /** Final trust level after all verifications */
  level: TrustLevel;
  /** Whether the tool should be trusted for execution */
  trusted: boolean;
  /** Evaluation details */
  evaluation: TrustEvaluationResult;
  /** Source from trust metadata */
  source: AtipTrustFull['source'];
  /** Binary hash (always computed) */
  binaryHash: string;
}

/**
 * Verify trust for a discovered tool.
 *
 * This is the main entry point for trust verification after discovery.
 * It performs all relevant checks based on available trust metadata.
 *
 * @param binaryPath - Path to the tool binary
 * @param metadata - ATIP metadata from discovery (may have trust field)
 * @param options - Verification options
 * @returns Complete verification result with trust level
 *
 * @remarks
 * This function is designed to be called after `probe()` or `get()` returns
 * ATIP metadata. It verifies the binary against any trust information in
 * the metadata and returns an actionable trust level.
 *
 * The function always computes the binary hash (for content-addressable
 * lookups) regardless of whether a checksum is provided for verification.
 *
 * @example
 * ```typescript
 * // After discovery
 * const metadata = await probe('/usr/local/bin/gh');
 * if (metadata) {
 *   const trustResult = await verifyTrust('/usr/local/bin/gh', metadata, {
 *     verifySignatures: true,
 *     verifyProvenance: true
 *   });
 *
 *   console.log(`Trust level: ${TrustLevel[trustResult.level]}`);
 *   console.log(`Binary hash: ${trustResult.binaryHash}`);
 *
 *   if (!trustResult.trusted && metadata.effects?.destructive) {
 *     throw new Error('Refusing to run destructive command from untrusted tool');
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Offline mode (skip signature verification)
 * const trustResult = await verifyTrust(binaryPath, metadata, {
 *   offlineMode: true
 * });
 * // Will return UNVERIFIED instead of failing on network errors
 * ```
 */
export function verifyTrust(
  binaryPath: string,
  metadata: AtipMetadata,
  options?: TrustVerificationOptions
): Promise<TrustVerificationResult>;
```

**Contract**:
- Always returns a result (never throws for verification failures)
- `trusted` is true only for `TrustLevel.VERIFIED` or higher
- `binaryHash` is always populated (computed fresh on every call)
- In `offlineMode`, network failures result in `UNVERIFIED` instead of errors
- Throws only for fundamental errors (file not found, permission denied)

---

### Trust Error Types

```typescript
/**
 * Error during trust verification operations.
 */
export class TrustError extends DiscoverError {
  constructor(
    message: string,
    public readonly trustCode: TrustErrorCode,
    public readonly cause?: Error
  ) {
    super(message, `TRUST_${trustCode}`);
    this.name = 'TrustError';
  }
}

/**
 * Trust-specific error codes.
 */
export type TrustErrorCode =
  | 'HASH_COMPUTATION_FAILED'   // Could not compute binary hash
  | 'COSIGN_NOT_INSTALLED'      // cosign CLI not found
  | 'VERIFICATION_TIMEOUT'      // Verification operation timed out
  | 'ATTESTATION_FETCH_FAILED'  // Could not fetch SLSA attestation
  | 'ATTESTATION_PARSE_FAILED'  // Invalid attestation format
  | 'SIGNATURE_INVALID'         // Signature verification failed
  | 'BINARY_NOT_FOUND'          // Binary file does not exist
  | 'PERMISSION_DENIED';        // Cannot read binary file
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
