/**
 * Configuration loading and defaults
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DiscoverConfig } from './types';
import { ConfigError } from './errors';
import { getAtipPaths } from './xdg';
import { expandTilde, parseDuration } from './utils';

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
 * Default maximum cache age (24 hours).
 */
export const DEFAULT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Default maximum cache size (100 MB).
 */
export const DEFAULT_CACHE_MAX_SIZE_BYTES = 100 * 1024 * 1024;

/**
 * Get default configuration for discovery operations.
 *
 * Returns a configuration object with safe defaults as specified in the ATIP spec.
 * This configuration can be customized via config file or environment variables.
 *
 * @returns Default discovery configuration with safe defaults
 *
 * @example
 * ```typescript
 * const config = getDefaultConfig();
 * console.log(config.scanTimeoutMs);  // 2000
 * console.log(config.parallelism);    // 4
 * ```
 */
export function getDefaultConfig(): DiscoverConfig {
  return {
    safePaths: [...DEFAULT_SAFE_PATHS],
    additionalPaths: [],
    skipList: [],
    scanTimeoutMs: DEFAULT_TIMEOUT_MS,
    parallelism: DEFAULT_PARALLELISM,
    cacheMaxAgeMs: DEFAULT_CACHE_MAX_AGE_MS,
    cacheMaxSizeBytes: DEFAULT_CACHE_MAX_SIZE_BYTES,
    outputFormat: 'json',
  };
}

/**
 * Load configuration from file and environment variables.
 *
 * Configuration priority (highest to lowest):
 * 1. Environment variables (ATIP_DISCOVER_*)
 * 2. Config file (JSON)
 * 3. Default values
 *
 * Config file locations (in order of precedence):
 * - Explicit path via `configPath` parameter
 * - ATIP_DISCOVER_CONFIG environment variable
 * - $XDG_CONFIG_HOME/agent-tools/config.json (default)
 *
 * @param configPath - Optional explicit config file path
 * @returns Promise resolving to merged configuration
 *
 * @throws {ConfigError} If config file exists but contains invalid JSON
 * @throws {ConfigError} If configuration values are invalid (e.g., negative timeout)
 *
 * @example
 * ```typescript
 * // Load from default location
 * const config = await loadConfig();
 *
 * // Load from specific file
 * const config = await loadConfig('/path/to/config.json');
 * ```
 */
export async function loadConfig(configPath?: string): Promise<DiscoverConfig> {
  const config = getDefaultConfig();

  // Determine config file path
  let resolvedConfigPath = configPath;
  if (!resolvedConfigPath) {
    const envConfigPath = process.env.ATIP_DISCOVER_CONFIG;
    if (envConfigPath) {
      resolvedConfigPath = envConfigPath;
    } else {
      const paths = getAtipPaths();
      resolvedConfigPath = path.join(paths.configDir, 'config.json');
    }
  }

  // Try to load config file
  try {
    const fileContent = await fs.readFile(resolvedConfigPath, 'utf-8');
    const fileConfig = JSON.parse(fileContent);

    // Merge discovery settings
    if (fileConfig.discovery) {
      if (fileConfig.discovery.safe_paths) {
        config.safePaths = fileConfig.discovery.safe_paths.map(expandTilde);
      }
      if (fileConfig.discovery.additional_paths) {
        config.additionalPaths = fileConfig.discovery.additional_paths.map(expandTilde);
      }
      if (fileConfig.discovery.skip_list) {
        config.skipList = fileConfig.discovery.skip_list;
      }
      if (fileConfig.discovery.scan_timeout) {
        config.scanTimeoutMs = parseDuration(fileConfig.discovery.scan_timeout);
      }
      if (fileConfig.discovery.parallelism !== undefined) {
        config.parallelism = fileConfig.discovery.parallelism;
      }
    }

    // Merge cache settings
    if (fileConfig.cache) {
      if (fileConfig.cache.max_age) {
        config.cacheMaxAgeMs = parseDuration(fileConfig.cache.max_age);
      }
      if (fileConfig.cache.max_size_mb !== undefined) {
        config.cacheMaxSizeBytes = fileConfig.cache.max_size_mb * 1024 * 1024;
      }
    }

    // Merge output settings
    if (fileConfig.output) {
      if (fileConfig.output.default_format) {
        config.outputFormat = fileConfig.output.default_format;
      }
    }
  } catch (error: unknown) {
    // If file doesn't exist, use defaults
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      // For other errors (like invalid JSON), throw
      if (error instanceof SyntaxError) {
        throw new ConfigError(
          `Invalid JSON in config file: ${(error as Error).message}`,
          'config',
          resolvedConfigPath
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  // Override with environment variables (highest priority)
  if (process.env.ATIP_DISCOVER_SAFE_PATHS) {
    config.safePaths = process.env.ATIP_DISCOVER_SAFE_PATHS
      .split(':')
      .map(expandTilde);
  }
  if (process.env.ATIP_DISCOVER_SKIP) {
    config.skipList = process.env.ATIP_DISCOVER_SKIP.split(',');
  }
  if (process.env.ATIP_DISCOVER_TIMEOUT) {
    config.scanTimeoutMs = parseDuration(process.env.ATIP_DISCOVER_TIMEOUT);
  }
  if (process.env.ATIP_DISCOVER_PARALLEL) {
    config.parallelism = parseInt(process.env.ATIP_DISCOVER_PARALLEL, 10);
  }

  // Validate configuration
  if (config.parallelism <= 0) {
    throw new ConfigError(
      'Parallelism must be greater than 0',
      'parallelism',
      config.parallelism
    );
  }
  if (config.scanTimeoutMs <= 0) {
    throw new ConfigError(
      'Timeout must be greater than 0',
      'scanTimeoutMs',
      config.scanTimeoutMs
    );
  }

  return config;
}
