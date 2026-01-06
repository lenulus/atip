/**
 * XDG Base Directory path resolution
 */

import * as os from 'os';
import * as path from 'path';
import type { AtipPaths } from './types';

/**
 * Expand tilde in path to home directory
 */
function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

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
 * @param overrides - Optional path overrides
 * @returns Resolved paths for data, config, and cache directories
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
