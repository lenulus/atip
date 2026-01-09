/**
 * atip-diff - Compare ATIP metadata versions and categorize breaking changes
 * Main library exports
 */

// Factory function and convenience functions
export { createDiffer, diff, diffFiles, Differ } from './differ/differ.js';

// Categorization functions
export { categorizeChange, getEffectsSeverity } from './categorizer/categorizer.js';

// Formatters
export { formatSummary, formatJson, formatMarkdown } from './formatters/index.js';

// Constants
export {
  BREAKING_CHANGE_TYPES,
  NON_BREAKING_CHANGE_TYPES,
  EFFECTS_CHANGE_TYPES,
  EFFECTS_SEVERITY_MAP,
  SEMVER_RULES,
} from './constants.js';

// Error classes
export {
  DiffError,
  FileError,
  ValidationError,
  ParseError,
} from './errors.js';

// Type exports
export type {
  // Core types
  DiffResult,
  DiffSummary,
  Change,
  ChangeType,
  ChangeCategory,
  ChangeSeverity,
  ChangeContext,
  SemverBump,

  // Configuration
  DiffConfig,
  CustomDiffRule,

  // Format options
  FormatOptions,
  JsonFormatOptions,
  MarkdownFormatOptions,

  // ATIP types
  AtipTool,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
  AtipParamType,
  AtipVersion,

  // Schema validation
  SchemaValidationError,
} from './types.js';
