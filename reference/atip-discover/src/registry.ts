/**
 * Registry management for discovered tools
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Registry, AtipPaths } from './types';
import { RegistryError } from './errors';
import { getAtipPaths } from './xdg';

/**
 * Registry format version.
 */
export const REGISTRY_VERSION = '1';

/**
 * Parse date fields in registry
 */
function parseDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Try to parse as ISO date
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
      return new Date(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(parseDates);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = parseDates(value);
    }
    return result;
  }

  return obj;
}

/**
 * Load the tool registry from disk.
 *
 * @param paths - Optional custom paths
 * @returns The loaded registry, or a new empty registry if not found
 *
 * @throws {RegistryError} If registry file is corrupted
 */
export async function loadRegistry(paths?: AtipPaths): Promise<Registry> {
  const resolvedPaths = paths || getAtipPaths();

  try {
    const content = await fs.readFile(resolvedPaths.registryPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Parse date strings to Date objects
    const withDates = parseDates(parsed) as Registry;

    return withDates;
  } catch (error: unknown) {
    // File doesn't exist - return empty registry
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        version: REGISTRY_VERSION,
        lastScan: null,
        tools: [],
      };
    }

    // File exists but is corrupted
    if (error instanceof SyntaxError) {
      throw new RegistryError(
        `Registry file is corrupted: ${error.message}`,
        resolvedPaths.registryPath,
        error
      );
    }

    // Other errors
    throw new RegistryError(
      `Failed to load registry: ${(error as Error).message}`,
      resolvedPaths.registryPath,
      error as Error
    );
  }
}

/**
 * Save the registry to disk atomically.
 *
 * @param registry - The registry to save
 * @param paths - Optional custom paths
 *
 * @throws {RegistryError} If write fails
 */
export async function saveRegistry(
  registry: Registry,
  paths?: AtipPaths
): Promise<void> {
  const resolvedPaths = paths || getAtipPaths();

  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(resolvedPaths.registryPath), {
      recursive: true,
      mode: 0o755,
    });

    // Atomic write: write to temp file, then rename
    const tempPath = resolvedPaths.registryPath + '.tmp';
    const content = JSON.stringify(registry, null, 2);

    await fs.writeFile(tempPath, content, { mode: 0o644 });
    await fs.rename(tempPath, resolvedPaths.registryPath);
  } catch (error: unknown) {
    throw new RegistryError(
      `Failed to save registry: ${(error as Error).message}`,
      resolvedPaths.registryPath,
      error as Error
    );
  }
}
