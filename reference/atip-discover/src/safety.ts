/**
 * Path safety checks for discovery
 */

import * as fs from 'fs/promises';
import { minimatch } from 'minimatch';

/**
 * Check if a path is safe to scan for tools.
 *
 * Per ATIP spec section 5.2, unsafe paths include:
 * - Current directory (.) to prevent scanning arbitrary locations
 * - World-writable directories (mode & 0o002) that could contain malicious executables
 * - Paths that don't exist or are inaccessible
 * - Non-directory paths
 *
 * @param dirPath - Directory path to check
 * @returns Promise resolving to object with:
 *   - `safe`: boolean indicating if path is safe to scan
 *   - `reason`: optional string describing why path is unsafe
 *
 * @example
 * ```typescript
 * const result = await isSafePath('/usr/local/bin');
 * if (!result.safe) {
 *   console.log(`Unsafe: ${result.reason}`);
 * }
 * ```
 */
export async function isSafePath(
  dirPath: string
): Promise<{ safe: boolean; reason?: string }> {
  // Reject current directory
  if (dirPath === '.' || dirPath === '') {
    return { safe: false, reason: 'current-directory' };
  }

  // Check if path exists
  try {
    const stats = await fs.stat(dirPath);

    if (!stats.isDirectory()) {
      return { safe: false, reason: 'not a directory' };
    }

    // On Unix-like systems, check for world-writable permissions
    if (process.platform !== 'win32') {
      // Check if other-writable bit is set (mode & 0o002)
      if (stats.mode & 0o002) {
        return { safe: false, reason: 'world-writable' };
      }
    }

    return { safe: true };
  } catch (error: unknown) {
    // Path doesn't exist or is inaccessible
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { safe: false, reason: 'path does not exist' };
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      return { safe: false, reason: 'permission denied' };
    }
    return { safe: false, reason: 'not found' };
  }
}

/**
 * Check if a tool name matches any pattern in the skip list.
 *
 * Supports both exact matches and glob patterns (using minimatch):
 * - Exact: "dangerous-tool"
 * - Wildcard: "test*", "*-dev"
 * - Character class: "tool[123]"
 *
 * @param toolName - Name of the tool to check
 * @param skipList - Array of exact names or glob patterns to match against
 * @returns `true` if tool name matches any pattern and should be skipped, `false` otherwise
 *
 * @example
 * ```typescript
 * const skip = matchesSkipList('test-runner', ['test*', 'debug*']);
 * console.log(skip);  // true
 *
 * const skip2 = matchesSkipList('production-tool', ['test*', 'debug*']);
 * console.log(skip2); // false
 * ```
 */
export function matchesSkipList(toolName: string, skipList: string[]): boolean {
  for (const pattern of skipList) {
    if (minimatch(toolName, pattern)) {
      return true;
    }
  }
  return false;
}
