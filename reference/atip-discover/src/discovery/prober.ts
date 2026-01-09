/**
 * Tool probing functionality
 */

import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';
import type { AtipMetadata } from '../types';
import { ProbeError, ProbeTimeoutError } from '../errors';
import { validateMetadata } from '../validator';

/**
 * Check if a tool's --help output documents an --agent flag.
 *
 * @param executablePath - Absolute path to the executable
 * @param options - Check options
 * @returns True if --agent appears to be a supported option
 *
 * @remarks
 * This is the first phase of safe probing. Running `--help` is universally
 * safe and allows us to verify --agent support before executing it.
 */
export async function checkHelpForAgent(
  executablePath: string,
  options?: { timeoutMs?: number }
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs || 2000;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let errorOccurred = false;
    let spawnError: Error | null = null;

    const child = spawn(executablePath, ['--help'], {
      timeout: timeoutMs,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Timeout = cannot verify --agent support
      resolve(false);
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      errorOccurred = true;
      spawnError = err;
      clearTimeout(timer);
      if (!timedOut) {
        // Execution error = cannot verify --agent support
        resolve(false);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut || errorOccurred) {
        return; // Already handled
      }

      // Combine stdout and stderr (some tools output help to stderr)
      const helpText = (stdout + stderr).toLowerCase();

      // Check if --agent appears as a documented option
      const hasAgentOption =
        /--agent\b/.test(helpText) ||
        /\s-agent\b/.test(helpText) ||
        /\batip\b.*\bagent\b/.test(helpText);

      resolve(hasAgentOption);
    });
  });
}

/**
 * Probe a single executable for ATIP support using two-phase detection.
 *
 * @param executablePath - Absolute path to the executable
 * @param options - Probe options
 * @returns Parsed ATIP metadata if tool supports --agent, null otherwise
 *
 * @throws {ProbeTimeoutError} If timeout exceeded
 * @throws {ProbeError} If invalid JSON or validation fails
 *
 * @remarks
 * Uses a two-phase approach:
 * 1. Check --help for --agent support (safe)
 * 2. Execute --agent only if Phase 1 passes
 */
export async function probe(
  executablePath: string,
  options?: { timeoutMs?: number }
): Promise<AtipMetadata | null> {
  const timeoutMs = options?.timeoutMs || 2000;

  // Pre-check: Verify file exists and is executable
  try {
    await access(executablePath, constants.F_OK | constants.X_OK);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    throw new ProbeError(
      `File is not executable or doesn't exist: ${nodeError.message}`,
      executablePath,
      error as Error
    );
  }

  // Phase 1: Check --help for --agent support
  // Use a reasonable timeout for --help (at least 1 second, or the full timeout if longer)
  const helpTimeoutMs = Math.max(1000, timeoutMs);

  let supportsAgent: boolean;
  try {
    supportsAgent = await checkHelpForAgent(executablePath, { timeoutMs: helpTimeoutMs });
  } catch (error) {
    // checkHelpForAgent doesn't throw, but if it did, propagate
    throw error;
  }

  if (!supportsAgent) {
    return null; // Tool doesn't support --agent
  }

  // Phase 2: Execute --agent (now safe)
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
