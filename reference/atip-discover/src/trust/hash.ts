/**
 * Binary hash computation for content-addressable storage and integrity verification
 */

import { createHash } from 'crypto';
import { createReadStream, stat } from 'fs';
import type { HashResult } from './types';
import { TrustError } from './errors';

/**
 * Compute SHA-256 hash of a binary file.
 *
 * @param binaryPath - Absolute path to the binary file
 * @returns Hash result with algorithm, raw hash, and formatted string
 *
 * @remarks
 * - Reads file in chunks for memory efficiency (8KB chunks)
 * - Uses Node.js crypto module (no external dependencies)
 * - Returns lowercase hex encoding
 *
 * @throws {TrustError} If file cannot be read or hash computation fails
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
