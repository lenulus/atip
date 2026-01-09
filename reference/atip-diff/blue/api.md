# API Specification: atip-diff

## Overview

`atip-diff` is a TypeScript CLI tool and library for comparing two versions of ATIP metadata and categorizing the differences. It helps users understand breaking changes, new features, and effects modifications between versions of a tool's ATIP metadata.

It provides:

1. **Change Detection** - Deep comparison of ATIP metadata structures
2. **Change Categorization** - Classify changes as breaking, non-breaking, or effects-related
3. **Semantic Versioning Guidance** - Recommend version bump based on changes
4. **Multiple Output Formats** - Human-readable, JSON, and Markdown formats
5. **CI/CD Integration** - Exit codes for breaking change detection
6. **Dogfooding** - Implements `--agent` flag itself (per spec convention)

The tool is designed for use in release workflows, changelog generation, and CI pipelines to catch unintended breaking changes.

---

## CLI Interface

### Global Structure

```
atip-diff [global-flags] <command> [command-flags] [args...]
```

### Global Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--output` | `-o` | enum | `summary` | Output format: `summary`, `json`, `markdown` |
| `--color` | | bool | auto | Force colored output |
| `--no-color` | | bool | false | Disable colored output |
| `--quiet` | `-q` | bool | false | Only output on breaking changes |
| `--verbose` | `-v` | bool | false | Show detailed change information |
| `--help` | `-h` | bool | false | Show help message |
| `--version` | | bool | false | Show version information |
| `--agent` | | bool | false | Output ATIP metadata for this tool |

**Output formats**:
- `summary` - Human-readable summary with colors (default)
- `json` - Machine-readable JSON structure
- `markdown` - Markdown format for changelogs and documentation

---

## Commands

### diff (default)

Compare two ATIP metadata files and report differences.

```
atip-diff [diff] [flags] <old> <new>
```

**Arguments**:
- `old` (required) - Path to the old/base ATIP JSON file
- `new` (required) - Path to the new/updated ATIP JSON file

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--breaking-only` | `-b` | bool | false | Only report breaking changes |
| `--effects-only` | `-e` | bool | false | Only report effects changes |
| `--include-unchanged` | | bool | false | Include unchanged elements in output |
| `--fail-on-breaking` | | bool | false | Exit with code 1 if breaking changes detected |
| `--ignore-version` | | bool | false | Ignore version field changes |
| `--ignore-description` | | bool | false | Ignore description-only changes |
| `--semver` | | bool | false | Output recommended semantic version bump |

**Behavior**:
1. Load and validate both ATIP JSON files
2. Parse and normalize metadata structures
3. Perform deep comparison
4. Categorize each difference
5. Output results in requested format
6. Exit with appropriate code

**Exit Codes**:
- `0` - No breaking changes (or no differences with `--quiet`)
- `1` - Breaking changes detected (when `--fail-on-breaking` is set)
- `2` - File access or validation error

---

### stdin

Compare ATIP metadata from stdin (for piping).

```
atip-diff stdin [flags] <old>
```

**Arguments**:
- `old` (required) - Path to the old/base ATIP JSON file

**Behavior**:
Reads the new ATIP JSON from stdin, useful for comparing against tool output:
```bash
mytool --agent | atip-diff stdin old-version.json
```

---

## Change Categories

Per TODO.md specification, changes are categorized into three types.

### Breaking Changes

Changes that may break existing agent integrations or cause unexpected behavior.

| Change Type | Example | Rationale |
|-------------|---------|-----------|
| Command removed | `pr.merge` deleted | Agents calling this command will fail |
| Required argument added | `file` now required | Existing calls missing arg will fail |
| Required option added | `--format` now required | Existing calls missing option will fail |
| Type made stricter | `string` to `enum` | Previously valid values may be rejected |
| Enum values removed | `["a","b","c"]` to `["a","b"]` | Value "c" no longer valid |
| Argument removed | `file` arg removed | Existing calls with arg may fail |
| Option flags changed | `-o` changed to `-O` | Existing calls with old flag will fail |

### Non-Breaking Changes

Changes that are backward compatible and additive.

| Change Type | Example | Rationale |
|-------------|---------|-----------|
| Command added | New `pr.rebase` command | No impact on existing calls |
| Optional argument added | New optional `comment` arg | Existing calls still work |
| Optional option added | New `--verbose` flag | Existing calls still work |
| Type relaxed | `enum` to `string` | Existing values still valid |
| Enum values added | `["a","b"]` to `["a","b","c"]` | Existing values still valid |
| Description changed | Updated help text | No functional impact |
| Default value changed | `timeout: 30` to `timeout: 60` | May affect behavior but not break |
| Examples added/changed | New usage examples | No functional impact |

### Effects Changes

Changes to safety metadata that affect agent decision-making.

| Change Type | Severity | Rationale |
|-------------|----------|-----------|
| `destructive: true` added | High | Agents should now require confirmation |
| `destructive: true` removed | Medium | Agents may stop requiring confirmation |
| `reversible` changed | Medium | Affects undo capability expectations |
| `idempotent` changed | Medium | Affects retry safety |
| `network` added | Low | May affect offline-mode agents |
| `cost.billable` changed | High | Affects cost estimation |
| `interactive` changed | Medium | Affects execution strategy |
| `filesystem.write/delete` changed | Medium | Affects sandboxing decisions |

---

## Diff Result Types

### Core Types

```typescript
/**
 * Result of comparing two ATIP metadata files.
 */
export interface DiffResult {
  /** Summary statistics */
  summary: DiffSummary;

  /** All detected changes, categorized */
  changes: Change[];

  /** Recommended semantic version bump based on changes */
  semverRecommendation: SemverBump;

  /** The old metadata (for reference) */
  oldMetadata: AtipTool;

  /** The new metadata (for reference) */
  newMetadata: AtipTool;
}

/**
 * Summary statistics for a diff.
 */
export interface DiffSummary {
  /** Total number of changes */
  totalChanges: number;

  /** Number of breaking changes */
  breakingChanges: number;

  /** Number of non-breaking changes */
  nonBreakingChanges: number;

  /** Number of effects changes */
  effectsChanges: number;

  /** Whether any breaking changes were detected */
  hasBreakingChanges: boolean;

  /** Whether any effects changes were detected */
  hasEffectsChanges: boolean;
}

/**
 * Semantic version bump recommendation.
 */
export type SemverBump = 'major' | 'minor' | 'patch' | 'none';

/**
 * A single detected change.
 */
export interface Change {
  /** Unique identifier for this change type */
  type: ChangeType;

  /** Category of change */
  category: ChangeCategory;

  /** Human-readable description of the change */
  message: string;

  /** Path in ATIP metadata where change occurred */
  path: string[];

  /** Old value (undefined if added) */
  oldValue?: unknown;

  /** New value (undefined if removed) */
  newValue?: unknown;

  /** Severity for effects changes */
  severity?: ChangeSeverity;

  /** Additional context for the change */
  context?: ChangeContext;
}

/**
 * Category of a change.
 */
export type ChangeCategory = 'breaking' | 'non-breaking' | 'effects';

/**
 * Severity level for effects changes.
 */
export type ChangeSeverity = 'high' | 'medium' | 'low';

/**
 * Specific change types.
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
 * Additional context for a change.
 */
export interface ChangeContext {
  /** Command name if change is within a command */
  command?: string;

  /** Full command path for nested commands */
  commandPath?: string[];

  /** Argument name if change is to an argument */
  argument?: string;

  /** Option name if change is to an option */
  option?: string;

  /** Effect field name if effects change */
  effectField?: string;
}
```

### Diff Configuration

```typescript
/**
 * Configuration for the diff operation.
 */
export interface DiffConfig {
  /**
   * Only detect breaking changes.
   * @default false
   */
  breakingOnly?: boolean;

  /**
   * Only detect effects changes.
   * @default false
   */
  effectsOnly?: boolean;

  /**
   * Include unchanged elements in the result.
   * @default false
   */
  includeUnchanged?: boolean;

  /**
   * Ignore version field changes.
   * @default false
   */
  ignoreVersion?: boolean;

  /**
   * Ignore description-only changes.
   * @default false
   */
  ignoreDescription?: boolean;

  /**
   * Custom rules for change categorization.
   */
  customRules?: CustomDiffRule[];
}

/**
 * Custom rule for categorizing changes.
 */
export interface CustomDiffRule {
  /** Path pattern to match (supports wildcards) */
  pathPattern: string;

  /** Override category for matching changes */
  category?: ChangeCategory;

  /** Override severity for matching effects changes */
  severity?: ChangeSeverity;

  /** Ignore changes matching this pattern */
  ignore?: boolean;
}
```

---

## Core Functions

### createDiffer

```typescript
/**
 * Create a differ instance with configuration.
 *
 * @param config - Diff configuration
 * @returns Configured Differ instance
 *
 * @example
 * ```typescript
 * const differ = createDiffer({
 *   ignoreVersion: true,
 *   ignoreDescription: true,
 * });
 * ```
 */
export function createDiffer(config?: DiffConfig): Differ;

/**
 * Differ instance for comparing ATIP metadata.
 */
export interface Differ {
  /**
   * Compare two ATIP metadata objects.
   *
   * @param oldMetadata - The old/base metadata
   * @param newMetadata - The new/updated metadata
   * @returns Diff result with categorized changes
   */
  diff(oldMetadata: AtipTool, newMetadata: AtipTool): DiffResult;

  /**
   * Compare two ATIP JSON files.
   *
   * @param oldPath - Path to old ATIP JSON file
   * @param newPath - Path to new ATIP JSON file
   * @returns Diff result with categorized changes
   *
   * @throws {FileError} If files cannot be read
   * @throws {ValidationError} If files are not valid ATIP JSON
   */
  diffFiles(oldPath: string, newPath: string): Promise<DiffResult>;

  /**
   * Compare ATIP JSON strings.
   *
   * @param oldJson - Old ATIP JSON string
   * @param newJson - New ATIP JSON string
   * @returns Diff result with categorized changes
   *
   * @throws {ValidationError} If strings are not valid ATIP JSON
   */
  diffStrings(oldJson: string, newJson: string): DiffResult;

  /**
   * Get the semantic version bump recommendation.
   *
   * @param result - Diff result to analyze
   * @returns Recommended version bump
   */
  getRecommendedBump(result: DiffResult): SemverBump;

  /**
   * Filter changes by category.
   *
   * @param result - Diff result to filter
   * @param category - Category to filter by
   * @returns Filtered changes
   */
  filterByCategory(result: DiffResult, category: ChangeCategory): Change[];

  /**
   * Check if there are any breaking changes.
   *
   * @param result - Diff result to check
   * @returns True if breaking changes exist
   */
  hasBreakingChanges(result: DiffResult): boolean;
}
```

### diff

```typescript
/**
 * Compare two ATIP metadata objects (convenience function).
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
): DiffResult;
```

### diffFiles

```typescript
/**
 * Compare two ATIP JSON files (convenience function).
 *
 * @param oldPath - Path to old ATIP JSON file
 * @param newPath - Path to new ATIP JSON file
 * @param config - Optional diff configuration
 * @returns Diff result with categorized changes
 *
 * @throws {FileError} If files cannot be read
 * @throws {ValidationError} If files are not valid ATIP JSON
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
export function diffFiles(
  oldPath: string,
  newPath: string,
  config?: DiffConfig
): Promise<DiffResult>;
```

### categorizeChange

```typescript
/**
 * Categorize a single change based on ATIP schema semantics.
 *
 * @param changeType - The type of change detected
 * @param path - Path in metadata where change occurred
 * @param oldValue - Old value (undefined if added)
 * @param newValue - New value (undefined if removed)
 * @returns Categorized change information
 *
 * @remarks
 * This function implements the change categorization rules from the
 * ATIP spec and TODO.md. It considers:
 * - Whether a change affects required vs optional fields
 * - Whether type changes are widening (relaxing) or narrowing (stricter)
 * - Safety implications of effects changes
 *
 * @example
 * ```typescript
 * const category = categorizeChange(
 *   'enum-values-removed',
 *   ['commands', 'deploy', 'options', 'env', 'enum'],
 *   ['dev', 'staging', 'prod'],
 *   ['dev', 'prod']
 * );
 * // category = 'breaking'
 * ```
 */
export function categorizeChange(
  changeType: ChangeType,
  path: string[],
  oldValue?: unknown,
  newValue?: unknown
): ChangeCategory;
```

### getEffectsSeverity

```typescript
/**
 * Determine severity of an effects change.
 *
 * @param effectField - The effects field that changed
 * @param oldValue - Old value
 * @param newValue - New value
 * @returns Severity level
 *
 * @remarks
 * Severity is determined by the safety implications:
 * - High: destructive added, billable added
 * - Medium: reversible/idempotent changed, interactive changed
 * - Low: network changed, duration changed
 *
 * @example
 * ```typescript
 * const severity = getEffectsSeverity('destructive', false, true);
 * // severity = 'high'
 * ```
 */
export function getEffectsSeverity(
  effectField: string,
  oldValue: unknown,
  newValue: unknown
): ChangeSeverity;
```

---

## Output Formatters

### formatSummary

```typescript
/**
 * Format diff result as human-readable summary.
 *
 * @param result - Diff result to format
 * @param options - Formatting options
 * @returns Formatted string for terminal output
 *
 * @example
 * ```typescript
 * const output = formatSummary(result, { color: true });
 * console.log(output);
 * ```
 */
export function formatSummary(
  result: DiffResult,
  options?: FormatOptions
): string;
```

### formatJson

```typescript
/**
 * Format diff result as JSON.
 *
 * @param result - Diff result to format
 * @param options - Formatting options
 * @returns JSON string
 *
 * @example
 * ```typescript
 * const json = formatJson(result, { pretty: true });
 * fs.writeFileSync('diff.json', json);
 * ```
 */
export function formatJson(
  result: DiffResult,
  options?: JsonFormatOptions
): string;
```

### formatMarkdown

```typescript
/**
 * Format diff result as Markdown.
 *
 * @param result - Diff result to format
 * @param options - Formatting options
 * @returns Markdown string suitable for changelogs
 *
 * @remarks
 * The Markdown output is structured for direct inclusion in CHANGELOGs:
 * - Breaking changes listed first with warning
 * - Effects changes in separate section
 * - Non-breaking changes grouped by type
 *
 * @example
 * ```typescript
 * const markdown = formatMarkdown(result, {
 *   includeHeader: true,
 *   version: '2.46.0',
 * });
 * fs.appendFileSync('CHANGELOG.md', markdown);
 * ```
 */
export function formatMarkdown(
  result: DiffResult,
  options?: MarkdownFormatOptions
): string;

/**
 * Options for formatMarkdown.
 */
export interface MarkdownFormatOptions {
  /** Include header with version */
  includeHeader?: boolean;

  /** Version string for header */
  version?: string;

  /** Date for header (default: today) */
  date?: string;

  /** Include table of contents */
  includeToc?: boolean;

  /** Group changes by command */
  groupByCommand?: boolean;
}
```

### Format Options

```typescript
/**
 * Common format options.
 */
export interface FormatOptions {
  /** Enable colored output */
  color?: boolean;

  /** Include unchanged elements */
  includeUnchanged?: boolean;

  /** Verbose output with full details */
  verbose?: boolean;
}

/**
 * JSON format options.
 */
export interface JsonFormatOptions {
  /** Pretty-print with indentation */
  pretty?: boolean;

  /** Indentation level (default: 2) */
  indent?: number;

  /** Include metadata about the diff operation */
  includeMetadata?: boolean;
}
```

---

## Error Types

```typescript
/**
 * Base error for atip-diff.
 */
export class DiffError extends Error {
  constructor(
    message: string,
    public readonly code: string
  );
}

/**
 * File access error.
 */
export class FileError extends DiffError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  );
  // code: 'FILE_ERROR'
}

/**
 * Validation error for invalid ATIP JSON.
 */
export class ValidationError extends DiffError {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly schemaErrors?: SchemaValidationError[]
  );
  // code: 'VALIDATION_ERROR'
}

/**
 * Parse error for malformed JSON.
 */
export class ParseError extends DiffError {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly line?: number,
    public readonly column?: number
  );
  // code: 'PARSE_ERROR'
}

/**
 * Schema validation error detail.
 */
export interface SchemaValidationError {
  path: string;
  message: string;
  keyword: string;
}
```

---

## Constants

```typescript
/**
 * Change types that are considered breaking.
 */
export const BREAKING_CHANGE_TYPES: readonly ChangeType[] = [
  'command-removed',
  'required-argument-added',
  'required-option-added',
  'type-made-stricter',
  'enum-values-removed',
  'argument-removed',
  'option-removed',
  'option-flags-changed',
  'argument-made-required',
  'option-made-required',
];

/**
 * Change types that are non-breaking.
 */
export const NON_BREAKING_CHANGE_TYPES: readonly ChangeType[] = [
  'command-added',
  'optional-argument-added',
  'optional-option-added',
  'type-relaxed',
  'enum-values-added',
  'description-changed',
  'default-value-changed',
  'examples-changed',
  'argument-made-optional',
  'option-made-optional',
  'homepage-changed',
  'version-changed',
  'patterns-changed',
];

/**
 * Change types that are effects-related.
 */
export const EFFECTS_CHANGE_TYPES: readonly ChangeType[] = [
  'destructive-added',
  'destructive-removed',
  'reversible-changed',
  'idempotent-changed',
  'network-changed',
  'filesystem-changed',
  'cost-changed',
  'interactive-changed',
  'duration-changed',
];

/**
 * Severity mapping for effects changes.
 */
export const EFFECTS_SEVERITY_MAP: Record<string, ChangeSeverity> = {
  destructive: 'high',
  'cost.billable': 'high',
  reversible: 'medium',
  idempotent: 'medium',
  'interactive.stdin': 'medium',
  'interactive.prompts': 'medium',
  'interactive.tty': 'medium',
  'filesystem.write': 'medium',
  'filesystem.delete': 'medium',
  network: 'low',
  'duration.typical': 'low',
  'duration.timeout': 'low',
};

/**
 * Semver bump rules based on change categories.
 */
export const SEMVER_RULES = {
  /** Breaking changes require major bump */
  breaking: 'major' as SemverBump,
  /** Effects changes with high severity require minor bump */
  effectsHigh: 'minor' as SemverBump,
  /** Non-breaking changes require minor bump */
  nonBreaking: 'minor' as SemverBump,
  /** Effects changes with low/medium severity require patch bump */
  effectsLowMedium: 'patch' as SemverBump,
  /** No changes */
  none: 'none' as SemverBump,
};
```

---

## Module Exports

```typescript
// Factory function
export { createDiffer } from './differ';

// Convenience functions
export { diff, diffFiles } from './diff';
export { categorizeChange, getEffectsSeverity } from './categorize';

// Formatters
export { formatSummary, formatJson, formatMarkdown } from './formatters';

// Types
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

  // Differ interface
  Differ,

  // Format options
  FormatOptions,
  JsonFormatOptions,
  MarkdownFormatOptions,
};

// Error types
export {
  DiffError,
  FileError,
  ValidationError,
  ParseError,
} from './errors';

// Constants
export {
  BREAKING_CHANGE_TYPES,
  NON_BREAKING_CHANGE_TYPES,
  EFFECTS_CHANGE_TYPES,
  EFFECTS_SEVERITY_MAP,
  SEMVER_RULES,
} from './constants';

// Re-export ATIP types for convenience
export type {
  AtipTool,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
} from './types';
```

---

## ATIP Metadata for atip-diff (Dogfooding)

When run with `--agent`, atip-diff outputs its own ATIP metadata:

```json
{
  "atip": { "version": "0.6" },
  "name": "atip-diff",
  "version": "0.1.0",
  "description": "Compare ATIP metadata versions and categorize breaking changes",
  "homepage": "https://github.com/atip-dev/atip",
  "trust": {
    "source": "native",
    "verified": true
  },
  "commands": {
    "diff": {
      "description": "Compare two ATIP metadata files and report differences",
      "arguments": [
        {
          "name": "old",
          "type": "file",
          "description": "Path to old/base ATIP JSON file",
          "required": true
        },
        {
          "name": "new",
          "type": "file",
          "description": "Path to new/updated ATIP JSON file",
          "required": true
        }
      ],
      "options": [
        {
          "name": "output",
          "flags": ["-o", "--output"],
          "type": "enum",
          "enum": ["summary", "json", "markdown"],
          "default": "summary",
          "description": "Output format"
        },
        {
          "name": "breaking-only",
          "flags": ["-b", "--breaking-only"],
          "type": "boolean",
          "description": "Only report breaking changes"
        },
        {
          "name": "effects-only",
          "flags": ["-e", "--effects-only"],
          "type": "boolean",
          "description": "Only report effects changes"
        },
        {
          "name": "fail-on-breaking",
          "flags": ["--fail-on-breaking"],
          "type": "boolean",
          "description": "Exit with code 1 if breaking changes detected"
        },
        {
          "name": "semver",
          "flags": ["--semver"],
          "type": "boolean",
          "description": "Output recommended semantic version bump"
        }
      ],
      "effects": {
        "filesystem": { "read": true, "write": false },
        "network": false,
        "idempotent": true,
        "destructive": false
      }
    },
    "stdin": {
      "description": "Compare ATIP metadata from stdin against a file",
      "arguments": [
        {
          "name": "old",
          "type": "file",
          "description": "Path to old/base ATIP JSON file",
          "required": true
        }
      ],
      "effects": {
        "filesystem": { "read": true, "write": false },
        "network": false,
        "idempotent": true,
        "interactive": { "stdin": "required" }
      }
    }
  },
  "globalOptions": [
    {
      "name": "output",
      "flags": ["-o", "--output"],
      "type": "enum",
      "enum": ["summary", "json", "markdown"],
      "description": "Output format"
    },
    {
      "name": "quiet",
      "flags": ["-q", "--quiet"],
      "type": "boolean",
      "description": "Only output on breaking changes"
    },
    {
      "name": "verbose",
      "flags": ["-v", "--verbose"],
      "type": "boolean",
      "description": "Show detailed change information"
    },
    {
      "name": "color",
      "flags": ["--color"],
      "type": "boolean",
      "description": "Force colored output"
    },
    {
      "name": "no-color",
      "flags": ["--no-color"],
      "type": "boolean",
      "description": "Disable colored output"
    }
  ]
}
```
