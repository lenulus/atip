/**
 * Type definitions for atip-diff
 */

/**
 * ATIP parameter types
 */
export type AtipParamType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'file'
  | 'directory'
  | 'url'
  | 'enum'
  | 'array';

/**
 * ATIP version field
 */
export type AtipVersion = string | { version: string; features?: string[] };

/**
 * ATIP tool metadata
 */
export interface AtipTool {
  atip: AtipVersion;
  name: string;
  version: string;
  description: string;
  homepage?: string;
  commands?: Record<string, AtipCommand>;
  globalOptions?: AtipOption[];
  arguments?: AtipArgument[];
  options?: AtipOption[];
  effects?: AtipEffects;
  patterns?: string[];
  trust?: {
    source?: string;
    verified?: boolean;
  };
}

/**
 * ATIP command definition
 */
export interface AtipCommand {
  description: string;
  commands?: Record<string, AtipCommand>;
  arguments?: AtipArgument[];
  options?: AtipOption[];
  effects?: AtipEffects;
  examples?: string[];
}

/**
 * ATIP argument definition
 */
export interface AtipArgument {
  name: string;
  type?: AtipParamType;
  description?: string;
  required?: boolean;
  variadic?: boolean;
  default?: unknown;
  enum?: unknown[];
}

/**
 * ATIP option definition
 */
export interface AtipOption {
  name: string;
  flags?: string[];
  type?: AtipParamType;
  description?: string;
  required?: boolean;
  variadic?: boolean;
  default?: unknown;
  enum?: unknown[];
}

/**
 * ATIP effects metadata
 */
export interface AtipEffects {
  destructive?: boolean;
  reversible?: boolean;
  idempotent?: boolean;
  network?: boolean;
  filesystem?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  interactive?: {
    stdin?: 'none' | 'optional' | 'required';
    prompts?: boolean;
    tty?: boolean;
  };
  cost?: {
    billable?: boolean;
    estimate?: string;
  };
  duration?: {
    typical?: string;
    timeout?: string;
  };
}

/**
 * Category of a change
 */
export type ChangeCategory = 'breaking' | 'non-breaking' | 'effects';

/**
 * Severity level for effects changes
 */
export type ChangeSeverity = 'high' | 'medium' | 'low';

/**
 * Specific change types
 */
export type ChangeType =
  // Breaking changes
  | 'command-removed'
  | 'required-argument-added'
  | 'required-option-added'
  | 'type-made-stricter'
  | 'enum-values-removed'
  | 'argument-removed'
  | 'option-removed'
  | 'option-flags-changed'
  | 'argument-made-required'
  | 'option-made-required'
  // Non-breaking changes
  | 'command-added'
  | 'optional-argument-added'
  | 'optional-option-added'
  | 'type-relaxed'
  | 'enum-values-added'
  | 'description-changed'
  | 'default-value-changed'
  | 'examples-changed'
  | 'argument-made-optional'
  | 'option-made-optional'
  | 'homepage-changed'
  | 'version-changed'
  | 'patterns-changed'
  // Effects changes
  | 'destructive-added'
  | 'destructive-removed'
  | 'reversible-changed'
  | 'idempotent-changed'
  | 'network-changed'
  | 'filesystem-changed'
  | 'cost-changed'
  | 'interactive-changed'
  | 'duration-changed';

/**
 * Additional context for a change
 */
export interface ChangeContext {
  command?: string;
  commandPath?: string[];
  argument?: string;
  option?: string;
  effectField?: string;
}

/**
 * A single detected change
 */
export interface Change {
  type: ChangeType;
  category: ChangeCategory;
  message: string;
  path: string[];
  oldValue?: unknown;
  newValue?: unknown;
  severity?: ChangeSeverity;
  context?: ChangeContext;
}

/**
 * Summary statistics for a diff
 */
export interface DiffSummary {
  totalChanges: number;
  breakingChanges: number;
  nonBreakingChanges: number;
  effectsChanges: number;
  hasBreakingChanges: boolean;
  hasEffectsChanges: boolean;
}

/**
 * Semantic version bump recommendation
 */
export type SemverBump = 'major' | 'minor' | 'patch' | 'none';

/**
 * Result of comparing two ATIP metadata files
 */
export interface DiffResult {
  summary: DiffSummary;
  changes: Change[];
  semverRecommendation: SemverBump;
  oldMetadata: AtipTool;
  newMetadata: AtipTool;
}

/**
 * Custom rule for categorizing changes
 */
export interface CustomDiffRule {
  pathPattern: string;
  category?: ChangeCategory;
  severity?: ChangeSeverity;
  ignore?: boolean;
}

/**
 * Configuration for the diff operation
 */
export interface DiffConfig {
  breakingOnly?: boolean;
  effectsOnly?: boolean;
  includeUnchanged?: boolean;
  ignoreVersion?: boolean;
  ignoreDescription?: boolean;
  customRules?: CustomDiffRule[];
}

/**
 * Common format options
 */
export interface FormatOptions {
  color?: boolean;
  includeUnchanged?: boolean;
  verbose?: boolean;
}

/**
 * JSON format options
 */
export interface JsonFormatOptions {
  pretty?: boolean;
  indent?: number;
  includeMetadata?: boolean;
}

/**
 * Markdown format options
 */
export interface MarkdownFormatOptions {
  includeHeader?: boolean;
  version?: string;
  date?: string;
  includeToc?: boolean;
  groupByCommand?: boolean;
}

/**
 * Schema validation error detail
 */
export interface SchemaValidationError {
  path: string;
  message: string;
  keyword: string;
}
