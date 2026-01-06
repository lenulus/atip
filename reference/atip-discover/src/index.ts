/**
 * atip-discover - Discover ATIP-compatible tools on your system
 * Public API exports
 */

// Core functions
export { getAtipPaths } from './xdg';
export { loadRegistry, saveRegistry, REGISTRY_VERSION } from './registry';
export { scan } from './discovery/scanner';
export { probe } from './discovery/prober';
export { list, get } from './query';
export {
  loadConfig,
  DEFAULT_SAFE_PATHS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_PARALLELISM,
} from './config';

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
  AtipVersion,
  AtipTrust,
  AtipEffects,
  AtipOption,
  AtipCommand,
  AtipAuthentication,
  AtipPattern,
  AtipOmitted,
  RefreshResult,
  RefreshToolResult,
  RefreshError,
} from './types';

// Error types
export {
  DiscoverError,
  RegistryError,
  ToolNotFoundError,
  MetadataNotFoundError,
  ProbeError,
  ProbeTimeoutError,
  ConfigError,
} from './errors';
