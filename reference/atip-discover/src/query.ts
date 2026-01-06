/**
 * Query functions for registry and cached metadata
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import type { ListOptions, AtipPaths, RegistryEntry, AtipMetadata } from './types';
import { loadRegistry } from './registry';
import { getAtipPaths } from './xdg';
import { ToolNotFoundError, MetadataNotFoundError } from './errors';
import { probe } from './discovery/prober';

/**
 * List tools from the registry with optional filtering.
 *
 * @param options - List options for filtering and sorting
 * @param paths - Optional custom paths
 * @returns Array of registry entries matching criteria
 */
export async function list(
  options?: ListOptions,
  paths?: AtipPaths
): Promise<RegistryEntry[]> {
  const resolvedPaths = paths || getAtipPaths();
  const registry = await loadRegistry(resolvedPaths);

  let tools = [...registry.tools];

  // Filter by pattern
  if (options?.pattern) {
    tools = tools.filter((t) => minimatch(t.name, options.pattern!));
  }

  // Filter by source
  if (options?.source && options.source !== 'all') {
    tools = tools.filter((t) => t.source === options.source);
  }

  // Sort
  const sortBy = options?.sortBy || 'name';
  if (sortBy === 'discovered') {
    tools.sort((a, b) => b.discoveredAt.getTime() - a.discoveredAt.getTime());
  } else if (sortBy === 'path') {
    tools.sort((a, b) => a.path.localeCompare(b.path));
  } else {
    tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Limit
  if (options?.limit && options.limit > 0) {
    tools = tools.slice(0, options.limit);
  }

  return tools;
}

/**
 * Get full ATIP metadata for a specific tool.
 *
 * @param toolName - Name of the tool to retrieve
 * @param options - Get options
 * @param paths - Optional custom paths
 * @returns Full ATIP metadata for the tool
 *
 * @throws {ToolNotFoundError} If tool not in registry
 * @throws {MetadataNotFoundError} If cache file missing
 * @throws {ProbeError} If refresh fails
 */
export async function get(
  toolName: string,
  options?: {
    refresh?: boolean;
    commands?: string[];
    depth?: number;
  },
  paths?: AtipPaths
): Promise<AtipMetadata> {
  const resolvedPaths = paths || getAtipPaths();
  const registry = await loadRegistry(resolvedPaths);

  const tool = registry.tools.find((t) => t.name === toolName);
  if (!tool) {
    throw new ToolNotFoundError(toolName);
  }

  // Refresh if requested
  if (options?.refresh) {
    const metadata = await probe(tool.path, { timeoutMs: 2000 });
    if (!metadata) {
      throw new MetadataNotFoundError(toolName, tool.path);
    }

    // Save refreshed metadata
    const metadataPath = path.join(resolvedPaths.toolsDir, `${toolName}.json`);
    await fs.mkdir(resolvedPaths.toolsDir, { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  // Load from cache
  const metadataPath = path.join(resolvedPaths.toolsDir, `${toolName}.json`);
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content) as AtipMetadata;
    return metadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new MetadataNotFoundError(toolName, metadataPath);
    }
    throw error;
  }
}
