/**
 * Subprocess execution
 */

import { spawn } from 'child_process';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_OUTPUT_SIZE } from './constants.js';
import { ExecutionError, TimeoutError } from './errors.js';

/**
 * Options for subprocess execution.
 */
export interface ExecutionOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum output size in bytes (default: 1MB) */
  maxOutputSize?: number;
  /** Working directory for command execution */
  cwd?: string;
  /** Environment variables (merged with process.env) */
  env?: Record<string, string>;
  /** Shell to use for execution (or true for default shell) */
  shell?: string | boolean;
  /** Enable streaming callbacks for stdout/stderr */
  streaming?: boolean;
  /** Callback for stdout chunks (requires streaming: true) */
  onStdout?: (data: Buffer) => void;
  /** Callback for stderr chunks (requires streaming: true) */
  onStderr?: (data: Buffer) => void;
}

/**
 * Result of subprocess execution.
 */
export interface ExecutionResult {
  /** True if command exited with code 0 */
  success: boolean;
  /** Exit code from the process */
  exitCode: number;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** True if output was truncated due to size limit */
  truncated: boolean;
  /** True if command was killed due to timeout */
  timedOut: boolean;
  /** Command array that was executed */
  command: string[];
  /** Tool call ID (set by executor) */
  toolCallId: string;
  /** Tool name (set by executor) */
  toolName: string;
}

/**
 * Execute a CLI command as a subprocess.
 *
 * @param command - Command array to execute
 * @param options - Execution options
 * @returns Execution result with stdout, stderr, exit code
 */
export function executeCommand(
  command: string[],
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const maxOutputSize = options?.maxOutputSize ?? DEFAULT_MAX_OUTPUT_SIZE;
    const cwd = options?.cwd;
    const env = options?.env ? { ...process.env, ...options.env } : process.env;
    const shell = options?.shell;

    const startTime = Date.now();
    let stdoutChunks: Buffer[] = [];
    let stderrChunks: Buffer[] = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let truncated = false;
    let timedOut = false;

    // Spawn the process
    const [cmd, ...args] = command;
    const proc = spawn(cmd, args, {
      cwd,
      env: env as NodeJS.ProcessEnv,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'], // No stdin, pipe stdout/stderr
    });

    // Timeout timer
    let timeoutTimer: NodeJS.Timeout | null = null;
    if (timeout > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        // Force kill after 1 second
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 1000);
      }, timeout);
    }

    // Capture stdout
    proc.stdout?.on('data', (chunk: Buffer) => {
      if (options?.streaming && options.onStdout) {
        options.onStdout(chunk);
      }

      if (stdoutSize < maxOutputSize) {
        const remaining = maxOutputSize - stdoutSize;
        if (chunk.length > remaining) {
          stdoutChunks.push(chunk.slice(0, remaining));
          stdoutSize += remaining;
          truncated = true;
        } else {
          stdoutChunks.push(chunk);
          stdoutSize += chunk.length;
        }
      } else {
        truncated = true;
      }
    });

    // Capture stderr
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (options?.streaming && options.onStderr) {
        options.onStderr(chunk);
      }

      if (stderrSize < maxOutputSize) {
        const remaining = maxOutputSize - stderrSize;
        if (chunk.length > remaining) {
          stderrChunks.push(chunk.slice(0, remaining));
          stderrSize += remaining;
          truncated = true;
        } else {
          stderrChunks.push(chunk);
          stderrSize += chunk.length;
        }
      } else {
        truncated = true;
      }
    });

    // Handle process errors
    proc.on('error', (err) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      reject(new ExecutionError(`Failed to execute command: ${err.message}`, command, err));
    });

    // Handle process exit
    proc.on('close', (exitCode) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);

      const duration = Date.now() - startTime;
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      if (timedOut) {
        reject(new TimeoutError(command, timeout));
        return;
      }

      const result: ExecutionResult = {
        success: exitCode === 0,
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
        duration,
        truncated,
        timedOut: false,
        command,
        toolCallId: '',
        toolName: '',
      };

      resolve(result);
    });
  });
}
