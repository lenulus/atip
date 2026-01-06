/**
 * Core type definitions for atip-discover
 */

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
  lastScan: Date | null;
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
 * ATIP version field (string or object)
 */
export type AtipVersion = string | { version: string; features?: string[]; minAgentVersion?: string };

/**
 * ATIP trust metadata
 */
export interface AtipTrust {
  source: 'native' | 'community' | 'vendor' | 'unknown';
  verified: boolean;
  verifiedBy?: string;
  signedBy?: string;
  signature?: string;
}

/**
 * ATIP effects metadata
 */
export interface AtipEffects {
  network?: boolean;
  filesystem?: boolean;
  destructive?: boolean;
  reversible?: boolean;
  idempotent?: boolean;
  cost?: { billable?: boolean; amount?: number; currency?: string };
}

/**
 * ATIP option definition
 */
export interface AtipOption {
  name: string;
  flags?: string[];
  type?: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
}

/**
 * ATIP command definition
 */
export interface AtipCommand {
  description: string;
  options?: AtipOption[];
  effects?: AtipEffects;
  commands?: Record<string, AtipCommand>;
  interactive?: {
    stdin?: 'optional' | 'required' | 'none';
    prompts?: boolean;
    tty?: boolean;
  };
}

/**
 * ATIP authentication metadata
 */
export interface AtipAuthentication {
  required: boolean;
  methods?: string[];
  configuration?: string;
}

/**
 * ATIP pattern definition
 */
export interface AtipPattern {
  name: string;
  pattern: string;
  description: string;
}

/**
 * ATIP omitted metadata for partial discovery
 */
export interface AtipOmitted {
  reason: 'filtered' | 'depth-limited' | 'size-limited' | 'deprecated';
  safetyAssumption?: string;
  count?: number;
  examples?: string[];
}

/**
 * Parsed ATIP metadata from a tool.
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

/**
 * Validation result for ATIP metadata
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string[];
  message: string;
  value?: unknown;
}

/**
 * Result of refresh operation
 */
export interface RefreshResult {
  refreshed: number;
  failed: number;
  unchanged: number;
  durationMs: number;
  tools: RefreshToolResult[];
  errors: RefreshError[];
}

/**
 * Individual tool refresh result
 */
export interface RefreshToolResult {
  name: string;
  status: 'updated' | 'unchanged' | 'failed';
  oldVersion?: string;
  newVersion?: string;
}

/**
 * Refresh error
 */
export interface RefreshError {
  name: string;
  error: string;
}
