/**
 * XDG Base Directory path resolution
 */

import * as os from 'os';
import * as path from 'path';
import type { AtipPaths } from './types';
import { expandTilde } from './utils';

/**
 * Get the default data directory based on platform
 */
function getDefaultDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'agent-tools');
  }

  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return path.join(xdgDataHome, 'agent-tools');
  }

  return path.join(os.homedir(), '.local', 'share', 'agent-tools');
}

/**
 * Get the default config directory based on platform
 */
function getDefaultConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'agent-tools');
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'agent-tools');
  }

  return path.join(os.homedir(), '.config', 'agent-tools');
}

/**
 * Get XDG-compliant paths for ATIP tool storage.
 *
 * Respects XDG Base Directory specification:
 * - Uses XDG_DATA_HOME and XDG_CONFIG_HOME environment variables if set
 * - Falls back to ~/.local/share and ~/.config on Unix systems
 * - On Windows, uses %LOCALAPPDATA%
 * - Expands ~ to home directory
 *
 * @param overrides - Optional path overrides for testing or custom configurations
 * @returns Resolved absolute paths for data, config, registry, tools, and shims directories
 *
 * @example
 * ```typescript
 * const paths = getAtipPaths();
 * console.log(paths.registryPath);
 * // Unix: /home/user/.local/share/agent-tools/registry.json
 * // Windows: C:\Users\user\AppData\Local\agent-tools\registry.json
 * ```
 */
export function getAtipPaths(overrides?: Partial<AtipPaths>): AtipPaths {
  // Check for environment variable override first
  const envDataDir = process.env.ATIP_DISCOVER_DATA_DIR;

  let dataDir: string;
  if (overrides?.dataDir) {
    dataDir = expandTilde(overrides.dataDir);
  } else if (envDataDir) {
    dataDir = expandTilde(envDataDir);
  } else {
    dataDir = getDefaultDataDir();
  }

  let configDir: string;
  if (overrides?.configDir) {
    configDir = expandTilde(overrides.configDir);
  } else {
    configDir = getDefaultConfigDir();
  }

  // Ensure paths are absolute
  dataDir = path.resolve(dataDir);
  configDir = path.resolve(configDir);

  return {
    dataDir,
    configDir,
    registryPath: path.join(dataDir, 'registry.json'),
    toolsDir: path.join(dataDir, 'tools'),
    shimsDir: path.join(dataDir, 'shims'),
  };
}
