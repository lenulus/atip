import type { AtipTool } from '../types/atip';
import type { ResultFilter, ResultFilterOptions } from '../types/safety';
import { DEFAULT_REDACT_PATTERNS } from '../constants';

/**
 * Create a filter for sanitizing tool results before sending to LLM.
 */
export function createResultFilter(
  _tools: AtipTool[],
  options?: ResultFilterOptions
): ResultFilter {
  const maxLength = options?.maxLength ?? 100000;
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
