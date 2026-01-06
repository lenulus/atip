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
 * List tools from the registry with optional filtering and sorting.
 *
 * Returns an array of registry entries that match the specified criteria.
 * If no registry exists, returns an empty array.
 *
 * @param options - Optional list options for filtering and sorting:
 *   - `pattern`: Glob pattern to filter tool names (e.g., "gh*", "kube*")
 *   - `source`: Filter by source type ("all", "native", "shim")
 *   - `sortBy`: Sort field ("name", "discovered", "path")
 *   - `limit`: Maximum number of results (0 = unlimited)
 *   - `staleOnly`: Only show tools that may need refresh
 * @param paths - Optional custom paths for registry location
 * @returns Promise resolving to array of registry entries matching criteria
 *
 * @example
 * ```typescript
 * // List all tools
 * const all = await list();
 *
 * // List tools matching pattern
 * const ghTools = await list({ pattern: 'gh*' });
 *
 * // List native tools only, sorted by discovery time
 * const native = await list({ source: 'native', sortBy: 'discovered' });
 * ```
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
 * Retrieves the complete ATIP metadata for a tool from the cache.
 * Can optionally refresh the metadata by re-probing the tool.
 *
 * @param toolName - Name of the tool to retrieve (must be in registry)
 * @param options - Optional get options:
 *   - `refresh`: If true, probe tool first and update cache before returning
 *   - `commands`: Array of command subtrees to filter (not yet implemented)
 *   - `depth`: Limit command nesting depth (not yet implemented)
 * @param paths - Optional custom paths for registry and cache location
 * @returns Promise resolving to full ATIP metadata for the tool
 *
 * @throws {ToolNotFoundError} If tool not found in registry
 * @throws {MetadataNotFoundError} If cached metadata file is missing
 * @throws {ProbeError} If refresh is requested but probe fails
 *
 * @example
 * ```typescript
 * // Get cached metadata
 * const metadata = await get('gh');
 * console.log(metadata.version);
 *
 * // Force refresh from tool
 * const fresh = await get('gh', { refresh: true });
 * ```
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
