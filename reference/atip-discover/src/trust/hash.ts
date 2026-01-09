/**
 * Binary hash computation for content-addressable storage and integrity verification
 */

import { createHash } from 'crypto';
import { createReadStream, stat } from 'fs';
import type { HashResult } from './types';
import { TrustError } from './errors';

/**
 * Compute SHA-256 hash of a binary file for integrity verification.
 *
 * @param binaryPath - Absolute path to the binary file
 * @returns Hash result with algorithm, raw hash, and formatted string
 *
 * @remarks
 * - Reads file in streaming chunks for memory efficiency (8KB chunks)
 * - Uses Node.js crypto module (no external dependencies)
 * - Returns lowercase hex encoding for consistency
 * - Formatted output is suitable for content-addressable storage (e.g., "sha256:abc123...")
 *
 * @throws {TrustError} With code BINARY_NOT_FOUND if file does not exist
 * @throws {TrustError} With code PERMISSION_DENIED if file cannot be read
 * @throws {TrustError} With code HASH_COMPUTATION_FAILED for other errors
 *
 * @example
 * ```typescript
 * const result = await computeBinaryHash('/usr/local/bin/gh');
 * console.log(result.formatted); // "sha256:a1b2c3d4..."
 * ```
 */
export async function computeBinaryHash(
  binaryPath: string
): Promise<HashResult> {
  return new Promise((resolve, reject) => {
    // First check if file exists and is not a directory
    stat(binaryPath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          reject(
            new TrustError(
              `TrustError: Binary file not found (ENOENT): ${binaryPath}`,
              'BINARY_NOT_FOUND',
              err
            )
          );
        } else if (err.code === 'EACCES') {
          reject(
            new TrustError(
              `TrustError: Permission denied reading binary (EACCES): ${binaryPath}`,
              'PERMISSION_DENIED',
              err
            )
          );
        } else {
          reject(
            new TrustError(
              `TrustError: Failed to stat binary: ${err.message}`,
              'HASH_COMPUTATION_FAILED',
              err
            )
          );
        }
        return;
      }

      if (stats.isDirectory()) {
        reject(
          new TrustError(
            `Cannot hash directory: ${binaryPath}`,
            'HASH_COMPUTATION_FAILED'
          )
        );
        return;
      }

      // Compute hash
      const hash = createHash('sha256');
      const stream = createReadStream(binaryPath, { highWaterMark: 8192 });

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        const hex = hash.digest('hex');
        resolve({
          algorithm: 'sha256',
          hash: hex,
          formatted: `sha256:${hex}`,
        });
      });

      stream.on('error', (err) => {
        reject(
          new TrustError(
            `Failed to read binary for hashing: ${err.message}`,
            'HASH_COMPUTATION_FAILED',
            err
          )
        );
      });
    });
  });
}
