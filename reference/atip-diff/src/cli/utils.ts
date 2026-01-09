/**
 * Utility functions for CLI operations
 */

import type { DiffConfig, DiffResult } from '../types.js';
import { formatSummary, formatJson, formatMarkdown } from '../formatters/index.js';

/**
 * Options from commander CLI parsing
 */
export interface CliOptions {
  output?: string;
  breakingOnly?: boolean;
  effectsOnly?: boolean;
  ignoreVersion?: boolean;
  ignoreDescription?: boolean;
  semver?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
  failOnBreaking?: boolean;
}

/**
 * Build DiffConfig from CLI options
 */
export function buildDiffConfig(options: CliOptions): DiffConfig {
  return {
    breakingOnly: options.breakingOnly,
    effectsOnly: options.effectsOnly,
    ignoreVersion: options.ignoreVersion,
    ignoreDescription: options.ignoreDescription,
  };
}

/**
 * Handle diff result output based on CLI options
 * @param result - Diff result to output
 * @param options - CLI options
 */
export function handleDiffOutput(result: DiffResult, options: CliOptions): void {
  // Handle --semver flag
  if (options.semver) {
    console.log(result.semverRecommendation);
    process.exit(0);
  }

  // Handle --quiet flag
  if (options.quiet && !result.summary.hasBreakingChanges) {
    process.exit(0);
  }

  // Format output
  const output = formatDiffResult(result, options);
  console.log(output);

  // Handle --fail-on-breaking flag
  if (options.failOnBreaking && result.summary.hasBreakingChanges) {
    process.exit(1);
  }

  process.exit(0);
}

/**
 * Format diff result based on output format option
 * @param result - Diff result to format
 * @param options - CLI options
 * @returns Formatted string
 */
export function formatDiffResult(result: DiffResult, options: CliOptions): string {
  const useColor = options.color !== false;

  switch (options.output) {
    case 'json':
      return formatJson(result, { pretty: true });
    case 'markdown':
      return formatMarkdown(result);
    case 'summary':
    default:
      return formatSummary(result, {
        color: useColor,
        verbose: options.verbose,
      });
  }
}

/**
 * Handle CLI errors consistently
 * @param error - Error to handle
 */
export function handleCliError(error: unknown): never {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(2);
}

/**
 * Log verbose message if verbose mode is enabled
 * @param message - Message to log
 * @param options - CLI options
 */
export function logVerbose(message: string, options: CliOptions): void {
  if (options.verbose) {
    console.log(message);
  }
}
