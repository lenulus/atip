/**
 * Tool probing functionality
 */

import { spawn } from 'child_process';
import type { AtipMetadata } from '../types';
import { ProbeError, ProbeTimeoutError } from '../errors';
import { validateMetadata } from '../validator';

/**
 * Probe a single executable for ATIP support.
 *
 * @param executablePath - Absolute path to the executable
 * @param options - Probe options
 * @returns Parsed ATIP metadata if tool supports --agent, null otherwise
 *
 * @throws {ProbeTimeoutError} If timeout exceeded
 * @throws {ProbeError} If invalid JSON or validation fails
 */
export async function probe(
  executablePath: string,
  options?: { timeoutMs?: number }
): Promise<AtipMetadata | null> {
  const timeoutMs = options?.timeoutMs || 2000;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(executablePath, ['--agent'], {
      timeout: timeoutMs,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new ProbeTimeoutError(executablePath, timeoutMs));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) {
        // Execution error (e.g., file not executable, not found, etc.)
        reject(
          new ProbeError(
            `Failed to execute: ${err.message}`,
            executablePath,
            err
          )
        );
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        return; // Already handled by timeout
      }

      // Non-zero exit code means tool doesn't support --agent
      if (code !== 0) {
        resolve(null);
        return;
      }

      // Empty output
      if (!stdout.trim()) {
        resolve(null);
        return;
      }

      // Try to parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch (error) {
        // If output looks like JSON (starts with {), it's an error
        // Otherwise, tool probably just doesn't support --agent
        if (stdout.trim().startsWith('{')) {
          reject(
            new ProbeError(
              `Invalid JSON output: ${(error as Error).message}`,
              executablePath,
              error as Error
            )
          );
        } else {
          resolve(null);
        }
        return;
      }

      // Validate against ATIP schema
      const validation = validateMetadata(parsed);
      if (!validation.valid) {
        // Schema validation failed - this should throw
        const errorMsg = validation.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        reject(
          new ProbeError(
            `ATIP validation failed: ${errorMsg}`,
            executablePath
          )
        );
        return;
      }

      resolve(parsed as AtipMetadata);
    });
  });
}
