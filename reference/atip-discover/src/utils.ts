/**
 * Shared utility functions
 */

import * as os from 'os';
import * as path from 'path';

/**
 * Expand tilde (~) in file path to home directory.
 *
 * @param filepath - Path that may contain tilde
 * @returns Expanded path with home directory
 *
 * @example
 * ```typescript
 * expandTilde('~/Documents')  // '/Users/name/Documents'
 * expandTilde('~')            // '/Users/name'
 * expandTilde('/absolute')    // '/absolute'
 * ```
 */
export function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Parse duration string to milliseconds.
 *
 * Supports common time units:
 * - ms: milliseconds
 * - s: seconds
 * - m: minutes
 * - h: hours
 *
 * @param duration - Duration string (e.g., "2s", "5m", "24h", "100ms")
 * @returns Duration in milliseconds
 *
 * @throws {Error} If duration format is invalid or unit is unknown
 *
 * @example
 * ```typescript
 * parseDuration('2s')    // 2000
 * parseDuration('5m')    // 300000
 * parseDuration('24h')   // 86400000
 * parseDuration('100ms') // 100
 * ```
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|ms)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}
