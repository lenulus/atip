/**
 * Path safety checks for discovery
 */

import * as fs from 'fs/promises';
import { minimatch } from 'minimatch';

/**
 * Check if a path is safe to scan.
 *
 * @param dirPath - Directory path to check
 * @returns Object with safety status and reason
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
 * @param toolName - Name to check
 * @param skipList - Patterns to match against
 * @returns True if tool should be skipped
 */
export function matchesSkipList(toolName: string, skipList: string[]): boolean {
  for (const pattern of skipList) {
    if (minimatch(toolName, pattern)) {
      return true;
    }
  }
  return false;
}
