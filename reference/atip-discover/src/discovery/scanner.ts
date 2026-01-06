/**
 * Discovery scanner - main scan algorithm
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import pLimit from 'p-limit';
import type {
  ScanOptions,
  ScanResult,
  AtipPaths,
  DiscoveredTool,
  ScanError,
} from '../types';
import { getAtipPaths } from '../xdg';
import { isSafePath, matchesSkipList } from '../safety';
import { loadRegistry, saveRegistry } from '../registry';
import { probe } from './prober';
import { DEFAULT_TIMEOUT_MS, DEFAULT_PARALLELISM } from '../config';

/**
 * Enumerate executable files in a directory
 */
async function enumerateExecutables(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const executables: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() || entry.isSymbolicLink()) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          // Check if file is executable
          await fs.access(fullPath, fs.constants.X_OK);
          executables.push(fullPath);
        } catch {
          // Not executable, skip
        }
      }
    }

    return executables;
  } catch (error) {
    // Directory doesn't exist or can't be read
    return [];
  }
}

/**
 * Scan for ATIP-compatible tools on the system.
 *
 * Performs a complete scan of safe directories (or specified paths) to discover
 * tools that support the --agent flag. Updates the registry with discovered tools
 * and caches their metadata.
 *
 * Security: By default, only scans known-safe PATH prefixes (per spec section 5.2).
 * Skips world-writable directories and current directory.
 *
 * @param options - Optional scan configuration:
 *   - `safePathsOnly`: Only scan known-safe PATH prefixes (default: true)
 *   - `allowPaths`: Additional directories to scan
 *   - `skipList`: Tool names/patterns to skip
 *   - `timeoutMs`: Timeout for probing each tool (default: 2000ms)
 *   - `parallelism`: Number of parallel probes (default: 4)
 *   - `incremental`: Only scan new/changed executables (default: true)
 *   - `includeShims`: Include shim files (default: true)
 *   - `onProgress`: Callback for progress updates
 * @param paths - Optional custom paths for registry and cache location
 * @returns Promise resolving to scan results with counts and discovered tools
 *
 * @example
 * ```typescript
 * // Scan safe paths with progress updates
 * const result = await scan({
 *   safePathsOnly: true,
 *   onProgress: (p) => console.log(`${p.current}/${p.total}`)
 * });
 * console.log(`Discovered ${result.discovered} new tools`);
 * ```
 */
export async function scan(
  options?: ScanOptions,
  paths?: AtipPaths
): Promise<ScanResult> {
  const startTime = Date.now();
  const resolvedPaths = paths || getAtipPaths();

  // Default options
  const safePathsOnly = options?.safePathsOnly ?? true;
  const allowPaths = options?.allowPaths || [];
  const skipList = options?.skipList || [];
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
  const parallelism = options?.parallelism || DEFAULT_PARALLELISM;
  const incremental = options?.incremental ?? true;
  const onProgress = options?.onProgress;

  // Load existing registry
  const registry = await loadRegistry(resolvedPaths);

  // Determine directories to scan
  let dirsToScan: string[] = [];

  if (!safePathsOnly) {
    // Use allowPaths if provided
    dirsToScan = [...allowPaths];
  } else {
    // Use safe paths only
    const { DEFAULT_SAFE_PATHS } = await import('../config');
    const safePaths = [...DEFAULT_SAFE_PATHS];

    // Filter to only safe directories
    for (const dir of safePaths) {
      const expandedDir = dir.startsWith('~/')
        ? path.join(process.env.HOME || '', dir.slice(2))
        : dir;

      const safety = await isSafePath(expandedDir);
      if (safety.safe) {
        dirsToScan.push(expandedDir);
      }
    }

    // Add allowPaths
    dirsToScan.push(...allowPaths);
  }

  // Enumerate executables
  onProgress?.({
    phase: 'enumerating',
    current: 0,
    total: dirsToScan.length,
  });

  const allExecutables: string[] = [];
  for (let i = 0; i < dirsToScan.length; i++) {
    const dir = dirsToScan[i];
    const executables = await enumerateExecutables(dir);
    allExecutables.push(...executables);

    onProgress?.({
      phase: 'enumerating',
      current: i + 1,
      total: dirsToScan.length,
      currentItem: dir,
    });
  }

  // Filter by skip list and incremental mode
  const toProbe: string[] = [];
  let skipped = 0;

  for (const execPath of allExecutables) {
    const basename = path.basename(execPath);

    // Check skip list
    if (matchesSkipList(basename, skipList)) {
      skipped++;
      continue;
    }

    // Check if already in registry (incremental mode)
    if (incremental) {
      const existing = registry.tools.find((t) => t.path === execPath);
      if (existing && existing.modTime) {
        // Check if file has been modified
        try {
          const stats = await fs.stat(execPath);
          // Compare mtime with some tolerance (1ms) due to precision loss in JSON serialization
          const timeDiff = Math.abs(stats.mtimeMs - existing.modTime.getTime());
          if (timeDiff < 1) {
            skipped++;
            continue;
          }
        } catch {
          // File no longer exists, probe anyway
        }
      }
    }

    toProbe.push(execPath);
  }

  // Probe tools in parallel
  const discovered: DiscoveredTool[] = [];
  const updated: string[] = [];
  const errors: ScanError[] = [];

  const limit = pLimit(parallelism);
  let probed = 0;

  onProgress?.({
    phase: 'probing',
    current: 0,
    total: toProbe.length,
  });

  const probePromises = toProbe.map((execPath) =>
    limit(async () => {
      try {
        const metadata = await probe(execPath, { timeoutMs });

        if (metadata) {
          const discoveredTool: DiscoveredTool = {
            name: metadata.name,
            version: metadata.version,
            path: execPath,
            source: 'native',
            discoveredAt: new Date(),
          };

          const existing = registry.tools.find((t) => t.name === metadata.name);
          if (existing) {
            updated.push(metadata.name);
            // Update existing entry
            existing.version = metadata.version;
            existing.path = execPath;
            existing.lastVerified = new Date();
            existing.modTime = (await fs.stat(execPath)).mtime;
          } else {
            discovered.push(discoveredTool);
            // Add new entry
            registry.tools.push({
              name: metadata.name,
              version: metadata.version,
              path: execPath,
              source: 'native',
              discoveredAt: new Date(),
              lastVerified: new Date(),
              modTime: (await fs.stat(execPath)).mtime,
            });
          }

          // Cache metadata
          await fs.mkdir(resolvedPaths.toolsDir, { recursive: true });
          const metadataPath = path.join(
            resolvedPaths.toolsDir,
            `${metadata.name}.json`
          );
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        }
      } catch (error) {
        // Record error but continue scanning
        errors.push({
          path: execPath,
          error: (error as Error).message,
        });
      } finally {
        probed++;
        onProgress?.({
          phase: 'probing',
          current: probed,
          total: toProbe.length,
          currentItem: execPath,
        });
      }
    })
  );

  await Promise.all(probePromises);

  // Update registry
  registry.lastScan = new Date();
  await saveRegistry(registry, resolvedPaths);

  const durationMs = Date.now() - startTime;

  return {
    discovered: discovered.length,
    updated: updated.length,
    failed: errors.length,
    skipped,
    durationMs,
    tools: discovered,
    errors,
  };
}
