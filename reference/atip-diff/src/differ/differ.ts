/**
 * Main Differ class implementation
 */

import * as fs from 'fs/promises';
import type {
  AtipTool,
  DiffConfig,
  DiffResult,
  DiffSummary,
  Change,
  ChangeCategory,
  SemverBump,
} from '../types.js';
import { normalizeTool } from '../normalizer/normalizer.js';
import { compareMetadata } from '../comparator/comparator.js';
import { getRecommendedBump } from '../semver/semver.js';
import { FileError, ParseError, ValidationError } from '../errors.js';

/**
 * Differ instance for comparing ATIP metadata
 */
export class Differ {
  constructor(private config: DiffConfig = {}) {}

  /**
   * Compare two ATIP metadata objects.
   *
   * @param oldMetadata - The old/base metadata
   * @param newMetadata - The new/updated metadata
   * @returns Diff result with categorized changes
   *
   * @example
   * ```typescript
   * const differ = createDiffer();
   * const result = differ.diff(oldMetadata, newMetadata);
   * console.log(`Breaking changes: ${result.summary.breakingChanges}`);
   * ```
   */
  diff(oldMetadata: AtipTool, newMetadata: AtipTool): DiffResult {
    // Normalize both metadata objects
    const normalizedOld = normalizeTool(oldMetadata);
    const normalizedNew = normalizeTool(newMetadata);

    // Compare metadata
    let changes = compareMetadata(normalizedOld, normalizedNew);

    // Apply filters based on config
    if (this.config.ignoreVersion) {
      changes = changes.filter(c => c.type !== 'version-changed');
    }
    if (this.config.ignoreDescription) {
      changes = changes.filter(c => c.type !== 'description-changed');
    }
    if (this.config.breakingOnly) {
      changes = changes.filter(c => c.category === 'breaking');
    }
    if (this.config.effectsOnly) {
      changes = changes.filter(c => c.category === 'effects');
    }

    // Calculate summary
    const summary = this.calculateSummary(changes);

    // Build result
    const result: DiffResult = {
      summary,
      changes,
      semverRecommendation: 'none',
      oldMetadata: normalizedOld,
      newMetadata: normalizedNew,
    };

    // Calculate semver recommendation
    result.semverRecommendation = getRecommendedBump(result);

    return result;
  }

  /**
   * Compare two ATIP JSON files.
   *
   * Loads both files from disk, validates them against the ATIP schema,
   * and performs a deep comparison to detect all changes.
   *
   * @param oldPath - Path to old ATIP JSON file
   * @param newPath - Path to new ATIP JSON file
   * @returns Diff result with categorized changes
   *
   * @throws {FileError} If files cannot be read
   * @throws {ParseError} If JSON is malformed
   * @throws {ValidationError} If ATIP schema validation fails
   *
   * @example
   * ```typescript
   * const differ = createDiffer();
   * const result = await differ.diffFiles('old.json', 'new.json');
   * if (result.summary.hasBreakingChanges) {
   *   console.error('Breaking changes detected!');
   * }
   * ```
   */
  async diffFiles(oldPath: string, newPath: string): Promise<DiffResult> {
    // Read files with proper error handling
    let oldContent: string;
    let newContent: string;

    try {
      oldContent = await fs.readFile(oldPath, 'utf-8');
    } catch (error) {
      throw new FileError(
        `Cannot read file: ${oldPath}`,
        oldPath,
        error instanceof Error ? error : undefined
      );
    }

    try {
      newContent = await fs.readFile(newPath, 'utf-8');
    } catch (error) {
      throw new FileError(
        `Cannot read file: ${newPath}`,
        newPath,
        error instanceof Error ? error : undefined
      );
    }

    // Parse JSON with proper error handling
    let oldMetadata: AtipTool;
    let newMetadata: AtipTool;

    try {
      oldMetadata = JSON.parse(oldContent) as AtipTool;
    } catch (error) {
      throw new ParseError(
        `Invalid JSON in ${oldPath}`,
        oldPath
      );
    }

    try {
      newMetadata = JSON.parse(newContent) as AtipTool;
    } catch (error) {
      throw new ParseError(
        `Invalid JSON in ${newPath}`,
        newPath
      );
    }

    // Validate schema - check for required fields
    this.validateSchema(oldMetadata, oldPath);
    this.validateSchema(newMetadata, newPath);

    return this.diff(oldMetadata, newMetadata);
  }

  /**
   * Basic schema validation for ATIP metadata
   * @throws {ValidationError} If validation fails
   */
  private validateSchema(metadata: AtipTool, path: string): void {
    const errors: { path: string; message: string; keyword: string }[] = [];

    if (!metadata.name) {
      errors.push({ path: 'name', message: 'missing required field', keyword: 'required' });
    }
    if (!metadata.version) {
      errors.push({ path: 'version', message: 'missing required field', keyword: 'required' });
    }
    if (!metadata.description) {
      errors.push({ path: 'description', message: 'missing required field', keyword: 'required' });
    }
    if (!metadata.atip) {
      errors.push({ path: 'atip', message: 'missing required field', keyword: 'required' });
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `Schema validation failed for ${path}`,
        path,
        errors
      );
    }
  }

  /**
   * Compare ATIP JSON strings.
   *
   * Parses both JSON strings and performs a deep comparison.
   * No validation is performed - use diff() if you need validation.
   *
   * @param oldJson - Old ATIP JSON string
   * @param newJson - New ATIP JSON string
   * @returns Diff result with categorized changes
   *
   * @throws {SyntaxError} If JSON parsing fails
   *
   * @example
   * ```typescript
   * const differ = createDiffer();
   * const result = differ.diffStrings(oldJsonString, newJsonString);
   * ```
   */
  diffStrings(oldJson: string, newJson: string): DiffResult {
    const oldMetadata = JSON.parse(oldJson) as AtipTool;
    const newMetadata = JSON.parse(newJson) as AtipTool;
    return this.diff(oldMetadata, newMetadata);
  }

  /**
   * Get the semantic version bump recommendation.
   *
   * Analyzes changes to recommend major, minor, patch, or no version bump.
   * - major: Breaking changes detected
   * - minor: Non-breaking changes or high-severity effects changes
   * - patch: Low/medium-severity effects changes only
   * - none: No changes detected
   *
   * @param result - Diff result to analyze
   * @returns Recommended version bump
   *
   * @example
   * ```typescript
   * const bump = differ.getRecommendedBump(result);
   * console.log(`Recommended bump: ${bump}`);
   * ```
   */
  getRecommendedBump(result: DiffResult): SemverBump {
    return getRecommendedBump(result);
  }

  /**
   * Filter changes by category.
   *
   * @param result - Diff result to filter
   * @param category - Category to filter by ('breaking', 'non-breaking', or 'effects')
   * @returns Filtered changes matching the category
   *
   * @example
   * ```typescript
   * const breakingChanges = differ.filterByCategory(result, 'breaking');
   * console.log(`Found ${breakingChanges.length} breaking changes`);
   * ```
   */
  filterByCategory(result: DiffResult, category: ChangeCategory): Change[] {
    return result.changes.filter(c => c.category === category);
  }

  /**
   * Check if there are any breaking changes.
   *
   * @param result - Diff result to check
   * @returns True if breaking changes exist, false otherwise
   *
   * @example
   * ```typescript
   * if (differ.hasBreakingChanges(result)) {
   *   console.error('Cannot proceed: breaking changes detected');
   *   process.exit(1);
   * }
   * ```
   */
  hasBreakingChanges(result: DiffResult): boolean {
    return result.summary.hasBreakingChanges;
  }

  /**
   * Calculate summary statistics from changes
   */
  private calculateSummary(changes: Change[]): DiffSummary {
    const breakingChanges = changes.filter(c => c.category === 'breaking').length;
    const nonBreakingChanges = changes.filter(c => c.category === 'non-breaking').length;
    const effectsChanges = changes.filter(c => c.category === 'effects').length;

    return {
      totalChanges: changes.length,
      breakingChanges,
      nonBreakingChanges,
      effectsChanges,
      hasBreakingChanges: breakingChanges > 0,
      hasEffectsChanges: effectsChanges > 0,
    };
  }
}

/**
 * Create a differ instance with configuration.
 *
 * @param config - Optional diff configuration
 * @returns Configured Differ instance
 *
 * @example
 * ```typescript
 * const differ = createDiffer({
 *   ignoreVersion: true,
 *   ignoreDescription: true,
 * });
 * const result = differ.diff(oldMetadata, newMetadata);
 * ```
 */
export function createDiffer(config?: DiffConfig): Differ {
  return new Differ(config);
}

/**
 * Compare two ATIP metadata objects (convenience function).
 *
 * Creates a differ instance and performs a comparison in one call.
 *
 * @param oldMetadata - The old/base metadata
 * @param newMetadata - The new/updated metadata
 * @param config - Optional diff configuration
 * @returns Diff result with categorized changes
 *
 * @example
 * ```typescript
 * import { diff } from 'atip-diff';
 *
 * const oldTool = JSON.parse(fs.readFileSync('v1.json', 'utf-8'));
 * const newTool = JSON.parse(fs.readFileSync('v2.json', 'utf-8'));
 *
 * const result = diff(oldTool, newTool);
 * console.log(`Breaking changes: ${result.summary.breakingChanges}`);
 * ```
 */
export function diff(
  oldMetadata: AtipTool,
  newMetadata: AtipTool,
  config?: DiffConfig
): DiffResult {
  const differ = createDiffer(config);
  return differ.diff(oldMetadata, newMetadata);
}

/**
 * Compare two ATIP JSON files (convenience function).
 *
 * Loads files from disk and performs a comparison in one call.
 *
 * @param oldPath - Path to old ATIP JSON file
 * @param newPath - Path to new ATIP JSON file
 * @param config - Optional diff configuration
 * @returns Diff result with categorized changes
 *
 * @throws {FileError} If files cannot be read
 * @throws {ParseError} If JSON is malformed
 * @throws {ValidationError} If ATIP schema validation fails
 *
 * @example
 * ```typescript
 * import { diffFiles } from 'atip-diff';
 *
 * const result = await diffFiles('gh-v2.45.json', 'gh-v2.46.json');
 * if (result.summary.hasBreakingChanges) {
 *   console.error('Breaking changes detected!');
 *   process.exit(1);
 * }
 * ```
 */
export async function diffFiles(
  oldPath: string,
  newPath: string,
  config?: DiffConfig
): Promise<DiffResult> {
  const differ = createDiffer(config);
  return differ.diffFiles(oldPath, newPath);
}
