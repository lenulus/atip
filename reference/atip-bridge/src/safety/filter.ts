import type { AtipTool } from '../types/atip';
import type { ResultFilter, ResultFilterOptions } from '../types/safety';
import { DEFAULT_MAX_RESULT_LENGTH, DEFAULT_REDACT_PATTERNS } from '../constants';

/**
 * Create a filter for sanitizing tool results before sending to LLM.
 *
 * @param _tools - ATIP tools (reserved for future tool-specific filtering rules)
 * @param options - Filtering options
 * @param options.maxLength - Maximum result length in characters (default: 100,000)
 * @param options.redactSecrets - Whether to redact common secret patterns (default: true)
 * @param options.redactPatterns - Additional patterns to redact (applied after built-in patterns)
 * @returns ResultFilter instance
 *
 * @remarks
 * - Default patterns redact common secrets (API keys, tokens, passwords)
 * - Truncates results exceeding maxLength with '[TRUNCATED]' marker
 * - Built-in patterns include: Bearer tokens, GitHub tokens, AWS keys, generic secrets
 *
 * @example
 * ```typescript
 * const filter = createResultFilter([ghTool], {
 *   maxLength: 10000,
 *   redactSecrets: true
 * });
 *
 * const safeResult = filter.filter(rawOutput, 'gh_auth_token');
 * // Tokens and secrets are replaced with [REDACTED]
 * ```
 */
export function createResultFilter(
  _tools: AtipTool[],
  options?: ResultFilterOptions
): ResultFilter {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_RESULT_LENGTH;
  const redactSecrets = options?.redactSecrets ?? true;

  // Build pattern list
  const patterns: RegExp[] = [];
  if (redactSecrets) {
    patterns.push(...DEFAULT_REDACT_PATTERNS);
  }
  if (options?.redactPatterns) {
    patterns.push(...options.redactPatterns);
  }

  return {
    filter(result: string, _toolName: string): string {
      let filtered = result;

      // Apply redaction patterns
      for (const pattern of patterns) {
        filtered = filtered.replace(pattern, '[REDACTED]');
      }

      // Truncate if too long
      if (filtered.length > maxLength) {
        filtered = filtered.slice(0, maxLength) + '[TRUNCATED]';
      }

      return filtered;
    },
  };
}
