import { promises as fs } from 'fs';
import { glob } from 'glob';
import { builtinRules } from '../rules/index.js';
import { runLint } from './runner.js';
import type { Linter, LintOptions, LintResult, LintResults } from './types.js';
import type { LintConfig } from '../config/types.js';
import type { RuleDefinition } from '../rules/types.js';

/**
 * Create a linter instance with configuration.
 *
 * @param config - Lint configuration including rules, ignore patterns, and options
 * @returns A configured Linter instance
 *
 * @example
 * ```typescript
 * const linter = createLinter({
 *   extends: 'recommended',
 *   rules: {
 *     'no-empty-effects': 'error',
 *     'description-quality': ['warn', { minLength: 20 }],
 *   },
 * });
 *
 * const result = await linter.lintFile('tool.json');
 * console.log(`Found ${result.errorCount} errors`);
 * ```
 */
export function createLinter(config: LintConfig = {}): Linter {
  const rules = new Map(builtinRules);

  return {
    /**
     * Lint a single file.
     *
     * @param filePath - Absolute path to ATIP JSON file
     * @param options - Lint options (fix, quiet, etc.)
     * @returns Lint result for the file
     */
    async lintFile(filePath: string, options: LintOptions = {}): Promise<LintResult> {
      const source = await fs.readFile(filePath, 'utf-8');
      return this.lintText(source, filePath, options);
    },

    /**
     * Lint a string of ATIP JSON.
     *
     * @param source - ATIP JSON source text
     * @param filePath - Virtual file path (for config matching and error reporting)
     * @param options - Lint options
     * @returns Lint result
     */
    async lintText(
      source: string,
      filePath: string = '<input>',
      options: LintOptions = {}
    ): Promise<LintResult> {
      const effectiveConfig = {
        ...config,
        ...(options.configOverrides || {}),
      };

      return runLint(source, filePath, effectiveConfig, rules, options);
    },

    /**
     * Lint multiple files using glob patterns.
     *
     * @param patterns - File paths or glob patterns (e.g., *.json, examples/**\/*.json)
     * @param options - Lint options
     * @returns Aggregated results for all files
     */
    async lintFiles(patterns: string[], options: LintOptions = {}): Promise<LintResults> {
      const results: LintResult[] = [];

      // Resolve glob patterns to file paths
      const files: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(pattern, {
          ignore: config.ignorePatterns || [],
          absolute: true,
        });
        files.push(...matches);
      }

      // Lint each file
      for (const filePath of files) {
        try {
          const result = await this.lintFile(filePath, options);
          results.push(result);
        } catch (e) {
          // File not found or read error
          results.push({
            filePath,
            messages: [
              {
                ruleId: 'file-error',
                severity: 2,
                message: `Failed to read file: ${(e as Error).message}`,
                line: 0,
                column: 0,
              },
            ],
            errorCount: 1,
            warningCount: 0,
            fixableErrorCount: 0,
            fixableWarningCount: 0,
          });
        }
      }

      // Aggregate counts
      let totalErrors = 0;
      let totalWarnings = 0;
      let totalFixableErrors = 0;
      let totalFixableWarnings = 0;

      for (const result of results) {
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
        totalFixableErrors += result.fixableErrorCount;
        totalFixableWarnings += result.fixableWarningCount;
      }

      return {
        results,
        errorCount: totalErrors,
        warningCount: totalWarnings,
        fixableErrorCount: totalFixableErrors,
        fixableWarningCount: totalFixableWarnings,
      };
    },

    /**
     * Get the effective configuration for a file.
     * In the current implementation, this returns the linter's config.
     * Future versions may support per-directory overrides.
     *
     * @param _filePath - Path to check (currently unused)
     * @returns Resolved configuration
     */
    async getConfigForFile(_filePath: string): Promise<LintConfig> {
      return config;
    },

    /**
     * Get all available rules.
     * Returns a copy of the rules map to prevent external modification.
     *
     * @returns Map of rule ID to rule definition
     */
    getRules(): Map<string, RuleDefinition> {
      return new Map(rules);
    },
  };
}

export type * from './types.js';
