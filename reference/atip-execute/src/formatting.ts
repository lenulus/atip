/**
 * Result formatting for LLM consumption
 */

import { DEFAULT_MAX_RESULT_LENGTH } from './constants.js';

/**
 * Options for formatting execution results.
 */
export interface OutputOptions {
  /** Maximum length of formatted output in characters (default: 100K) */
  maxLength?: number;
  /** Automatically redact secrets using built-in patterns (default: true) */
  redactSecrets?: boolean;
  /** Additional regex patterns to redact */
  redactPatterns?: RegExp[];
  /** Include stderr in formatted output (default: true) */
  includeStderr?: boolean;
  /** Include exit code in formatted output (default: false) */
  includeExitCode?: boolean;
  /** Custom formatter function (overrides default formatting) */
  formatter?: (result: any) => string;
}

/**
 * Formatted result ready for LLM consumption.
 */
export interface FormattedResult {
  /** Formatted content string to send to LLM */
  content: string;
  /** True if execution succeeded */
  success: boolean;
  /** Raw execution result (for debugging) */
  raw: any;
}

// Common secret patterns to redact
const DEFAULT_REDACT_PATTERNS = [
  // GitHub tokens
  /ghp_[a-zA-Z0-9]{36,}/g,
  /gho_[a-zA-Z0-9]{36,}/g,
  /ghu_[a-zA-Z0-9]{36,}/g,
  /ghs_[a-zA-Z0-9]{36,}/g,
  /ghr_[a-zA-Z0-9]{36,}/g,

  // Generic API keys
  /sk-[a-zA-Z0-9]{20,}/g,
  /[Aa][Pp][Ii][-_]?[Kk][Ee][Yy]\s*[:=]\s*['"']?[a-zA-Z0-9]{16,}['"']?/g,

  // Bearer tokens
  /[Bb]earer\s+[a-zA-Z0-9._-]{20,}/g,

  // AWS keys
  /AKIA[0-9A-Z]{16}/g,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,

  // Generic secrets in env var format
  /[A-Z_]{3,}_(SECRET|KEY|TOKEN|PASSWORD)\s*=\s*['"']?[a-zA-Z0-9+/=._-]{16,}['"']?/gi,
];

/**
 * Format an execution result for return to LLM.
 *
 * Processes raw subprocess output into LLM-friendly format with:
 * - Secret redaction using regex patterns
 * - Length truncation to stay within token limits
 * - Optional stderr and exit code inclusion
 * - Custom formatting support
 *
 * @param result - Raw execution result from executeCommand
 * @param options - Output formatting options
 * @returns Formatted result with filtered content ready for LLM
 *
 * @example
 * ```typescript
 * const formatted = formatResult(executionResult, {
 *   maxLength: 50000,
 *   redactSecrets: true,
 *   includeStderr: true,
 * });
 *
 * console.log(formatted.content); // Safe to send to LLM
 * ```
 */
export function formatResult(
  result: any,
  options?: OutputOptions
): FormattedResult {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_RESULT_LENGTH;
  const redactSecrets = options?.redactSecrets ?? true;
  const includeStderr = options?.includeStderr ?? true;
  const includeExitCode = options?.includeExitCode ?? false;

  // Use custom formatter if provided
  if (options?.formatter) {
    return {
      content: options.formatter(result),
      success: result.success,
      raw: result,
    };
  }

  let content = '';

  // Calculate how much space we need for stderr and exit code
  let reservedSpace = 0;
  if (result.stderr && includeStderr) {
    reservedSpace += result.stderr.length + 1; // +1 for newline
  }
  if (includeExitCode) {
    reservedSpace += `Exit code: ${result.exitCode}`.length + 1; // +1 for newline
  }
  if (result.truncated) {
    reservedSpace += 14; // Length of "\n[TRUNCATED]"
  }

  // Build content string
  let stdoutWasTruncated = false;

  if (result.timedOut) {
    // Timeout case
    content += result.stdout || '';
    content += '\n[TIMEOUT]';
  } else {
    // Add stdout (potentially truncated to leave room for stderr/exit code)
    if (result.stdout) {
      const maxStdoutLength = maxLength - reservedSpace - 14; // Reserve space for [TRUNCATED] marker
      if (result.stdout.length > maxStdoutLength && maxStdoutLength > 0) {
        content += result.stdout.slice(0, maxStdoutLength);
        stdoutWasTruncated = true;
      } else {
        content += result.stdout;
      }
    }

    // Add stderr if configured
    if (result.stderr && includeStderr) {
      if (content) content += '\n';
      content += result.stderr;
    }

    // Add exit code if configured
    if (includeExitCode) {
      if (content) content += '\n';
      content += `Exit code: ${result.exitCode}`;
    }
  }

  // Redact secrets BEFORE truncation
  if (redactSecrets) {
    const patterns = [...DEFAULT_REDACT_PATTERNS, ...(options?.redactPatterns || [])];
    for (const pattern of patterns) {
      content = content.replace(pattern, '[REDACTED]');
    }
  }

  // Add truncation marker if output was truncated
  if ((result.truncated || stdoutWasTruncated) && !content.includes('[TRUNCATED]')) {
    content += '\n[TRUNCATED]';
  }

  // Final safety check - truncate if still too long
  if (content.length > maxLength) {
    content = content.slice(0, maxLength - 14) + '\n[TRUNCATED]';
  }

  return {
    content,
    success: result.success,
    raw: result,
  };
}
