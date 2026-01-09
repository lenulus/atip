/**
 * JSON formatter for diff results
 */

import type { DiffResult, JsonFormatOptions } from '../types.js';

/**
 * Format diff result as JSON
 * @param result - Diff result to format
 * @param options - Formatting options
 * @returns JSON string
 */
export function formatJson(
  result: DiffResult,
  options?: JsonFormatOptions
): string {
  const pretty = options?.pretty ?? true;
  const indent = options?.indent ?? 2;
  const includeMetadata = options?.includeMetadata ?? false;

  type JsonOutput = Pick<DiffResult, 'summary' | 'semverRecommendation' | 'changes'> & {
    oldMetadata?: DiffResult['oldMetadata'];
    newMetadata?: DiffResult['newMetadata'];
  };

  const output: JsonOutput = {
    summary: result.summary,
    semverRecommendation: result.semverRecommendation,
    changes: result.changes,
  };

  if (includeMetadata) {
    output.oldMetadata = result.oldMetadata;
    output.newMetadata = result.newMetadata;
  }

  return pretty
    ? JSON.stringify(output, null, indent)
    : JSON.stringify(output);
}
