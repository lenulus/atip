# API Specification: atip-lint

## Overview

`atip-lint` is a TypeScript CLI tool and library for validating ATIP metadata quality beyond what JSON Schema can check. While `atip-validate` ensures structural correctness against the schema, `atip-lint` checks semantic quality and best practices.

It provides:

1. **Quality Rules** - Check description quality, naming conventions, effects completeness
2. **Executable Validation** - Verify tool binaries exist and `--agent` flag works
3. **Extensibility** - User-defined rules via configuration or plugins
4. **Auto-fixing** - Automatic fixes for simple issues
5. **CI/CD Integration** - JSON/SARIF output, configurable exit codes
6. **Dogfooding** - Implements `--agent` flag itself

The tool is designed to work alongside `atip-validate` and can optionally run schema validation first.

---

## CLI Interface

### Global Structure

```
atip-lint [global-flags] <command> [command-flags] [files...]
```

### Global Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--config` | `-c` | string | auto-detect | Path to config file (`.atiplintrc.json`) |
| `--output` | `-o` | enum | `stylish` | Output format: `stylish`, `json`, `sarif`, `compact` |
| `--color` | | bool | auto | Force colored output |
| `--no-color` | | bool | false | Disable colored output |
| `--quiet` | `-q` | bool | false | Only show errors, suppress warnings |
| `--verbose` | `-v` | bool | false | Show debug information |
| `--help` | `-h` | bool | false | Show help message |
| `--version` | | bool | false | Show version information |
| `--agent` | | bool | false | Output ATIP metadata for this tool |

**Output formats**:
- `stylish` - Human-readable with colors (like ESLint)
- `json` - Machine-readable JSON array
- `sarif` - SARIF 2.1.0 for GitHub Code Scanning
- `compact` - One-line per issue (grep-friendly)

---

## Commands

### lint (default)

Lint ATIP metadata files for quality issues.

```
atip-lint [lint] [flags] <files...>
```

**Arguments**:
- `files...` (required) - ATIP JSON files or glob patterns to lint

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--fix` | | bool | false | Automatically fix issues when possible |
| `--fix-dry-run` | | bool | false | Show fixes without applying |
| `--schema-validate` | | bool | true | Run JSON Schema validation first |
| `--max-warnings` | | number | -1 | Exit with error if warnings exceed limit (-1 = unlimited) |
| `--rule` | | string[] | [] | Enable/configure specific rules (e.g., `--rule "no-empty-effects:error"`) |
| `--disable-rule` | | string[] | [] | Disable specific rules |
| `--executable-check` | | bool | false | Verify tool binaries exist and work |
| `--ignore-pattern` | | string[] | [] | Patterns to ignore (globs) |
| `--cache` | | bool | false | Cache results for unchanged files |
| `--cache-location` | | string | `.atiplintcache` | Path to cache file |

**Behavior**:
1. Load configuration from file hierarchy
2. Resolve file patterns to absolute paths
3. Filter by ignore patterns
4. Optionally run JSON Schema validation
5. Run configured lint rules
6. Optionally check executables
7. Optionally apply auto-fixes
8. Output results in requested format
9. Exit with appropriate code

**JSON Output Schema**:
```json
{
  "results": [
    {
      "filePath": "/path/to/tool.json",
      "messages": [
        {
          "ruleId": "no-empty-description",
          "severity": 2,
          "message": "Description is too short (minimum 10 characters)",
          "line": 5,
          "column": 17,
          "nodeType": "description",
          "fix": {
            "range": [45, 52],
            "text": "\"A longer description\""
          }
        }
      ],
      "errorCount": 1,
      "warningCount": 0,
      "fixableErrorCount": 1,
      "fixableWarningCount": 0
    }
  ],
  "errorCount": 1,
  "warningCount": 0
}
```

**Exit Codes**:
- `0` - No errors (warnings allowed unless `--max-warnings` exceeded)
- `1` - Lint errors found
- `2` - Configuration or file access error

---

### init

Initialize a lint configuration file.

```
atip-lint init [flags]
```

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--format` | `-f` | enum | `json` | Config format: `json`, `yaml` |
| `--preset` | `-p` | enum | `recommended` | Rule preset: `recommended`, `strict`, `minimal` |
| `--path` | | string | `.atiplintrc.json` | Output path for config file |

**Behavior**:
1. Check if config already exists (prompt to overwrite)
2. Generate config from preset
3. Write config file

---

### list-rules

List available lint rules.

```
atip-lint list-rules [flags]
```

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--format` | `-f` | enum | `table` | Output format: `table`, `json` |
| `--category` | | string | | Filter by category |
| `--fixable` | | bool | | Only show fixable rules |

**JSON Output Schema**:
```json
{
  "rules": [
    {
      "id": "no-empty-effects",
      "category": "quality",
      "description": "Commands should declare effects metadata",
      "fixable": true,
      "defaultSeverity": "warn",
      "options": {}
    }
  ]
}
```

---

## Lint Rules

### Rule Categories

| Category | Description |
|----------|-------------|
| `quality` | Metadata quality (descriptions, completeness) |
| `consistency` | Naming conventions and style |
| `security` | Safety-related checks |
| `executable` | Binary existence and behavior |
| `trust` | Trust level requirements |

### Rule Severity Levels

| Level | Value | Description |
|-------|-------|-------------|
| `off` | 0 | Rule disabled |
| `warn` | 1 | Warning (non-blocking) |
| `error` | 2 | Error (blocks CI) |

---

## Quality Rules

### no-empty-effects

Commands should declare effects metadata.

**Default severity**: `warn`

**What it checks**:
- Every command should have an `effects` object
- Top-level `effects` don't count (must be per-command)

**Options**:
```typescript
{
  /** Minimum number of effect fields required */
  minFields?: number;  // default: 1

  /** Required effect fields */
  requiredFields?: ('network' | 'idempotent' | 'destructive' | 'reversible')[];
}
```

**Examples**:
```json
// Bad
{
  "commands": {
    "delete": {
      "description": "Delete resource"
      // No effects declared
    }
  }
}

// Good
{
  "commands": {
    "delete": {
      "description": "Delete resource",
      "effects": {
        "destructive": true,
        "reversible": false
      }
    }
  }
}
```

**Fixable**: Yes - adds empty `effects: {}` object

---

### description-quality

Descriptions should be meaningful and properly formatted.

**Default severity**: `warn`

**What it checks**:
- Minimum length (default: 10 characters)
- Maximum length (default: 200 characters for root)
- No placeholder text ("TODO", "Description here", "FIXME", etc.)
- Starts with uppercase letter
- Ends with period or question mark (optional)
- No leading/trailing whitespace

**Options**:
```typescript
{
  /** Minimum description length */
  minLength?: number;  // default: 10

  /** Maximum description length */
  maxLength?: number;  // default: 200

  /** Placeholder patterns to reject */
  placeholderPatterns?: string[];  // default: ['TODO', 'FIXME', 'Description', 'TBD']

  /** Require sentence case */
  requireSentenceCase?: boolean;  // default: true

  /** Require ending punctuation */
  requireEndingPunctuation?: boolean;  // default: false
}
```

**Examples**:
```json
// Bad - too short
{ "description": "Does stuff" }

// Bad - placeholder
{ "description": "TODO: add description" }

// Good
{ "description": "Manage GitHub pull requests from the command line" }
```

**Fixable**: Partial - can trim whitespace, cannot improve content

---

### consistent-naming

Command and option names should follow consistent conventions.

**Default severity**: `warn`

**What it checks**:
- Command names: kebab-case (default) or configurable
- Option names: kebab-case (default) or configurable
- Flag consistency: short flags are single character
- No duplicate option names within a command

**Options**:
```typescript
{
  /** Naming convention for commands */
  commandCase?: 'kebab-case' | 'camelCase' | 'snake_case';  // default: 'kebab-case'

  /** Naming convention for options */
  optionCase?: 'kebab-case' | 'camelCase' | 'snake_case';  // default: 'kebab-case'

  /** Allow uppercase in names */
  allowUppercase?: boolean;  // default: false

  /** Allow numbers in names */
  allowNumbers?: boolean;  // default: true
}
```

**Examples**:
```json
// Bad - inconsistent
{
  "commands": {
    "listItems": { },      // camelCase
    "delete-item": { }     // kebab-case
  }
}

// Good - consistent
{
  "commands": {
    "list-items": { },
    "delete-item": { }
  }
}
```

**Fixable**: No - requires manual intervention

---

### no-missing-required-fields

Required fields should be present based on context.

**Default severity**: `error`

**What it checks**:
- Arguments have `name`, `type`, `description`
- Options have `name`, `flags`, `type`, `description`
- Commands have `description`
- Enum types have `enum` array

**Examples**:
```json
// Bad - missing type
{
  "arguments": [
    { "name": "file", "description": "Input file" }
  ]
}

// Good
{
  "arguments": [
    { "name": "file", "type": "file", "description": "Input file" }
  ]
}
```

**Fixable**: No

---

### valid-effects-values

Effects values should be valid and consistent.

**Default severity**: `error`

**What it checks**:
- `destructive`, `reversible`, `idempotent`, `network`, `subprocess` are boolean
- `filesystem.read`, `filesystem.write`, `filesystem.delete` are boolean
- `cost.billable` is boolean
- `cost.estimate` is enum: `free`, `low`, `medium`, `high`
- `interactive.stdin` is enum: `none`, `optional`, `required`, `password`
- `interactive.prompts`, `interactive.tty` are boolean
- `duration.typical`, `duration.timeout` are duration strings

**Examples**:
```json
// Bad - wrong type
{
  "effects": {
    "destructive": "yes"  // should be boolean
  }
}

// Good
{
  "effects": {
    "destructive": true
  }
}
```

**Fixable**: No

---

### no-duplicate-flags

Options should not have duplicate flags.

**Default severity**: `error`

**What it checks**:
- No duplicate flags within an option
- No duplicate flags across options in the same command
- No conflicts between global options and command options

**Examples**:
```json
// Bad - duplicate
{
  "options": [
    { "name": "output", "flags": ["-o", "--output"], ... },
    { "name": "open", "flags": ["-o", "--open"], ... }  // -o conflicts
  ]
}
```

**Fixable**: No

---

## Security Rules

### destructive-needs-reversible

Destructive operations should declare reversibility.

**Default severity**: `warn`

**What it checks**:
- If `effects.destructive: true`, then `effects.reversible` should be declared
- Alerts if destructive but reversible (unusual combination)

**Examples**:
```json
// Bad - missing reversible
{
  "effects": {
    "destructive": true
    // Should declare reversible: false
  }
}

// Good
{
  "effects": {
    "destructive": true,
    "reversible": false
  }
}
```

**Fixable**: Yes - adds `reversible: false` for destructive operations

---

### billable-needs-confirmation

Billable operations should be marked non-idempotent.

**Default severity**: `warn`

**What it checks**:
- If `effects.cost.billable: true`, warn if `effects.idempotent: true`
- Billable idempotent is suspicious (usually incurs cost per call)

---

## Trust Rules

### trust-source-requirements

Trust source should match metadata completeness.

**Default severity**: `warn`

**What it checks**:
- `trust.source: "native"` should have complete effects on all commands
- `trust.source: "vendor"` should have `homepage` and `version`
- `trust.source: "inferred"` should have `trust.verified: false`

**Options**:
```typescript
{
  /** Fields required for native trust */
  nativeRequires?: string[];  // default: ['effects', 'description']

  /** Fields required for vendor trust */
  vendorRequires?: string[];  // default: ['homepage', 'version']
}
```

---

## Executable Rules

### binary-exists

Tool binary should exist at expected path.

**Default severity**: `warn`

**What it checks**:
- Binary can be found in PATH
- Or at path specified in config

**Options**:
```typescript
{
  /** Custom binary paths mapping */
  binaryPaths?: Record<string, string>;

  /** Whether to fail if binary not found */
  failOnMissing?: boolean;  // default: false
}
```

**Requires**: `--executable-check` flag

---

### agent-flag-works

Native tools should respond correctly to `--agent`.

**Default severity**: `warn`

**What it checks**:
- For tools with `trust.source: "native"`, verify `--agent` works
- Output should be valid JSON
- Output should pass schema validation
- Output should match the file being linted (name, version)

**Options**:
```typescript
{
  /** Timeout for probing (ms) */
  timeout?: number;  // default: 2000

  /** Skip if binary not found */
  skipIfMissing?: boolean;  // default: true
}
```

**Requires**: `--executable-check` flag

---

## Programmatic API

### Core Types

```typescript
/**
 * Lint rule severity levels.
 */
export type Severity = 'off' | 'warn' | 'error';
export type SeverityValue = 0 | 1 | 2;

/**
 * Configuration for a single rule.
 * Can be severity only or [severity, options].
 */
export type RuleConfig = Severity | SeverityValue | [Severity | SeverityValue, Record<string, unknown>];

/**
 * Full lint configuration.
 */
export interface LintConfig {
  /** Extends another config (preset name or path) */
  extends?: string | string[];

  /** Rule configurations */
  rules?: Record<string, RuleConfig>;

  /** Patterns to ignore (globs) */
  ignorePatterns?: string[];

  /** Run schema validation first */
  schemaValidation?: boolean;

  /** Enable executable checks */
  executableChecks?: boolean;

  /** Override rule categories */
  overrides?: Array<{
    files: string[];
    rules: Record<string, RuleConfig>;
  }>;

  /** Plugin names or paths to load */
  plugins?: string[];

  /** Environment-specific settings */
  env?: {
    /** Binary path mappings */
    binaryPaths?: Record<string, string>;
  };
}

/**
 * A lint message (error or warning).
 */
export interface LintMessage {
  /** Rule that generated this message */
  ruleId: string;

  /** Severity: 1 = warning, 2 = error */
  severity: SeverityValue;

  /** Human-readable message */
  message: string;

  /** Line number (1-indexed) */
  line: number;

  /** Column number (1-indexed) */
  column: number;

  /** End line (for range) */
  endLine?: number;

  /** End column (for range) */
  endColumn?: number;

  /** JSON node type (for context) */
  nodeType?: string;

  /** JSON path to the issue */
  jsonPath?: string[];

  /** Fix information (if auto-fixable) */
  fix?: LintFix;

  /** Suggested fixes (alternatives) */
  suggestions?: LintSuggestion[];
}

/**
 * An auto-fix for a lint issue.
 */
export interface LintFix {
  /** Character range to replace [start, end) */
  range: [number, number];

  /** Replacement text */
  text: string;
}

/**
 * A suggested fix (requires user confirmation).
 */
export interface LintSuggestion {
  /** Description of the fix */
  desc: string;

  /** The fix to apply */
  fix: LintFix;
}

/**
 * Result for a single file.
 */
export interface LintResult {
  /** Absolute path to the file */
  filePath: string;

  /** Lint messages */
  messages: LintMessage[];

  /** Count of errors */
  errorCount: number;

  /** Count of warnings */
  warningCount: number;

  /** Count of fixable errors */
  fixableErrorCount: number;

  /** Count of fixable warnings */
  fixableWarningCount: number;

  /** Original source (for fix application) */
  source?: string;

  /** Fixed source (if fixes applied) */
  output?: string;
}

/**
 * Aggregated results for a lint run.
 */
export interface LintResults {
  /** Results per file */
  results: LintResult[];

  /** Total errors across all files */
  errorCount: number;

  /** Total warnings across all files */
  warningCount: number;

  /** Total fixable errors */
  fixableErrorCount: number;

  /** Total fixable warnings */
  fixableWarningCount: number;
}
```

### Rule Definition Types

```typescript
/**
 * Context provided to rule implementations.
 */
export interface RuleContext {
  /** Path to the file being linted */
  filePath: string;

  /** Parsed ATIP metadata */
  metadata: AtipMetadata;

  /** Raw source text */
  source: string;

  /** Parsed JSON AST for location mapping */
  ast: JsonAst;

  /** Report a lint issue */
  report(issue: RuleIssue): void;

  /** Get configured options for this rule */
  options: Record<string, unknown>;

  /** Get lint configuration */
  config: LintConfig;
}

/**
 * Issue reported by a rule.
 */
export interface RuleIssue {
  /** Human-readable message */
  message: string;

  /** JSON path to the issue (e.g., ['commands', 'delete', 'effects']) */
  path: string[];

  /** Optional fix */
  fix?: (fixer: Fixer) => LintFix | LintFix[];

  /** Optional suggestions */
  suggest?: Array<{
    desc: string;
    fix: (fixer: Fixer) => LintFix | LintFix[];
  }>;
}

/**
 * Fixer helper for creating fixes.
 */
export interface Fixer {
  /** Replace text at JSON path with new value */
  replaceAt(path: string[], value: unknown): LintFix;

  /** Insert property at JSON path */
  insertAt(path: string[], key: string, value: unknown): LintFix;

  /** Remove property at JSON path */
  removeAt(path: string[]): LintFix;

  /** Replace text in source by character range */
  replaceRange(range: [number, number], text: string): LintFix;
}

/**
 * Rule definition.
 */
export interface RuleDefinition {
  /** Rule metadata */
  meta: RuleMeta;

  /** Rule implementation */
  create(context: RuleContext): RuleVisitor;
}

/**
 * Rule metadata.
 */
export interface RuleMeta {
  /** Rule category */
  category: 'quality' | 'consistency' | 'security' | 'executable' | 'trust';

  /** Human-readable description */
  description: string;

  /** Whether rule supports auto-fix */
  fixable?: boolean;

  /** Whether rule has suggestions */
  hasSuggestions?: boolean;

  /** Default severity */
  defaultSeverity: Severity;

  /** Schema for rule options */
  schema?: JsonSchema;

  /** Documentation URL */
  docs?: string;
}

/**
 * Visitor pattern for traversing ATIP metadata.
 */
export interface RuleVisitor {
  /** Called for root metadata */
  AtipMetadata?(node: AtipMetadata, path: string[]): void;

  /** Called for each command */
  Command?(node: AtipCommand, path: string[]): void;

  /** Called for each argument */
  Argument?(node: AtipArgument, path: string[]): void;

  /** Called for each option */
  Option?(node: AtipOption, path: string[]): void;

  /** Called for effects blocks */
  Effects?(node: AtipEffects, path: string[]): void;

  /** Called for trust blocks */
  Trust?(node: AtipTrust, path: string[]): void;

  /** Called for patterns */
  Pattern?(node: AtipPattern, path: string[]): void;
}
```

---

## Core Functions

### createLinter

```typescript
/**
 * Create a linter instance with configuration.
 *
 * @param config - Lint configuration
 * @returns Configured Linter instance
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
 * ```
 */
export function createLinter(config?: LintConfig): Linter;

/**
 * Linter instance for running lint checks.
 */
export interface Linter {
  /**
   * Lint a single file.
   *
   * @param filePath - Path to ATIP JSON file
   * @param options - Lint options
   * @returns Lint result for the file
   */
  lintFile(filePath: string, options?: LintOptions): Promise<LintResult>;

  /**
   * Lint a string of ATIP JSON.
   *
   * @param source - ATIP JSON source
   * @param filePath - Virtual file path (for config matching)
   * @param options - Lint options
   * @returns Lint result
   */
  lintText(source: string, filePath?: string, options?: LintOptions): Promise<LintResult>;

  /**
   * Lint multiple files.
   *
   * @param patterns - File paths or glob patterns
   * @param options - Lint options
   * @returns Results for all files
   */
  lintFiles(patterns: string[], options?: LintOptions): Promise<LintResults>;

  /**
   * Get the effective configuration for a file.
   *
   * @param filePath - Path to check
   * @returns Resolved configuration
   */
  getConfigForFile(filePath: string): Promise<LintConfig>;

  /**
   * Get all available rules.
   *
   * @returns Map of rule ID to definition
   */
  getRules(): Map<string, RuleDefinition>;
}

/**
 * Options for lint operations.
 */
export interface LintOptions {
  /** Apply auto-fixes */
  fix?: boolean;

  /** Only report fixable issues */
  fixableOnly?: boolean;

  /** Run executable checks */
  executableCheck?: boolean;

  /** Report only errors (suppress warnings) */
  quiet?: boolean;

  /** Override configuration */
  configOverrides?: Partial<LintConfig>;
}
```

### loadConfig

```typescript
/**
 * Load lint configuration from file hierarchy.
 *
 * @param startPath - Starting directory for config search
 * @param configPath - Optional explicit config path
 * @returns Loaded and merged configuration
 *
 * @remarks
 * Searches for configuration in this order:
 * 1. Explicit path if provided
 * 2. `.atiplintrc.json` in current directory
 * 3. `.atiplintrc.yaml` in current directory
 * 4. `.atiplintrc.js` in current directory
 * 5. `atiplint.config.js` in current directory
 * 6. `package.json` `atiplint` field
 * 7. Parent directories (up to root)
 *
 * @example
 * ```typescript
 * const config = await loadConfig('/project/examples');
 * console.log('Rules:', config.rules);
 * ```
 */
export function loadConfig(startPath?: string, configPath?: string): Promise<LintConfig>;
```

### defineRule

```typescript
/**
 * Define a custom lint rule.
 *
 * @param definition - Rule definition
 * @returns Validated rule definition
 *
 * @example
 * ```typescript
 * const noTodoDescription = defineRule({
 *   meta: {
 *     category: 'quality',
 *     description: 'Descriptions should not contain TODO',
 *     fixable: false,
 *     defaultSeverity: 'warn',
 *   },
 *   create(context) {
 *     return {
 *       AtipMetadata(node) {
 *         if (node.description?.includes('TODO')) {
 *           context.report({
 *             message: 'Description contains TODO',
 *             path: ['description'],
 *           });
 *         }
 *       },
 *       Command(node, path) {
 *         if (node.description?.includes('TODO')) {
 *           context.report({
 *             message: 'Command description contains TODO',
 *             path: [...path, 'description'],
 *           });
 *         }
 *       },
 *     };
 *   },
 * });
 * ```
 */
export function defineRule(definition: RuleDefinition): RuleDefinition;
```

---

## Formatter Types

```typescript
/**
 * Formatter function signature.
 */
export type Formatter = (results: LintResults, context: FormatterContext) => string;

/**
 * Context provided to formatters.
 */
export interface FormatterContext {
  /** Current working directory */
  cwd: string;

  /** Whether colors are enabled */
  color: boolean;

  /** Linter configuration */
  config: LintConfig;
}

/**
 * Built-in formatters.
 */
export const formatters: {
  stylish: Formatter;
  json: Formatter;
  sarif: Formatter;
  compact: Formatter;
};
```

---

## Error Types

```typescript
/**
 * Base error for atip-lint.
 */
export class LintError extends Error {
  constructor(
    message: string,
    public readonly code: string
  );
}

/**
 * Configuration loading error.
 */
export class ConfigError extends LintError {
  constructor(
    message: string,
    public readonly configPath?: string,
    public readonly cause?: Error
  );
  // code: 'CONFIG_ERROR'
}

/**
 * File access error.
 */
export class FileError extends LintError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  );
  // code: 'FILE_ERROR'
}

/**
 * Schema validation error (if schema validation enabled).
 */
export class SchemaError extends LintError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly schemaErrors: SchemaValidationError[]
  );
  // code: 'SCHEMA_ERROR'
}

/**
 * Executable check error.
 */
export class ExecutableError extends LintError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly cause?: Error
  );
  // code: 'EXECUTABLE_ERROR'
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

## Configuration Presets

### recommended

Balanced rules for most projects.

```typescript
{
  rules: {
    // Quality
    'no-empty-effects': 'warn',
    'description-quality': ['warn', { minLength: 10, maxLength: 200 }],
    'no-missing-required-fields': 'error',
    'valid-effects-values': 'error',

    // Consistency
    'consistent-naming': ['warn', { commandCase: 'kebab-case' }],
    'no-duplicate-flags': 'error',

    // Security
    'destructive-needs-reversible': 'warn',
    'billable-needs-confirmation': 'warn',

    // Trust
    'trust-source-requirements': 'warn',
  },
  schemaValidation: true,
  executableChecks: false,
}
```

### strict

Stricter rules for production tools.

```typescript
{
  extends: 'recommended',
  rules: {
    'no-empty-effects': ['error', { minFields: 2 }],
    'description-quality': ['error', { minLength: 20, requireEndingPunctuation: true }],
    'destructive-needs-reversible': 'error',
    'trust-source-requirements': 'error',
  },
}
```

### minimal

Only critical rules.

```typescript
{
  rules: {
    'no-missing-required-fields': 'error',
    'valid-effects-values': 'error',
    'no-duplicate-flags': 'error',
  },
  schemaValidation: true,
}
```

---

## Module Exports

```typescript
// Factory function
export { createLinter } from './linter';

// Configuration
export { loadConfig } from './config';
export { defineRule } from './rules';

// Formatters
export { formatters } from './formatters';

// Presets
export { presets } from './presets';

// Types
export type {
  // Configuration
  LintConfig,
  RuleConfig,
  Severity,
  SeverityValue,

  // Results
  LintResult,
  LintResults,
  LintMessage,
  LintFix,
  LintSuggestion,

  // Rules
  RuleDefinition,
  RuleMeta,
  RuleContext,
  RuleVisitor,
  RuleIssue,
  Fixer,

  // Linter
  Linter,
  LintOptions,

  // Formatters
  Formatter,
  FormatterContext,
};

// Error types
export {
  LintError,
  ConfigError,
  FileError,
  SchemaError,
  ExecutableError,
} from './errors';

// Constants
export {
  RULE_CATEGORIES,
  SEVERITY_VALUES,
  DEFAULT_CONFIG_FILES,
} from './constants';
```

---

## Constants

```typescript
/**
 * Rule category identifiers.
 */
export const RULE_CATEGORIES = [
  'quality',
  'consistency',
  'security',
  'executable',
  'trust',
] as const;

/**
 * Severity value mapping.
 */
export const SEVERITY_VALUES = {
  off: 0,
  warn: 1,
  error: 2,
} as const;

/**
 * Default configuration file names (in priority order).
 */
export const DEFAULT_CONFIG_FILES = [
  '.atiplintrc.json',
  '.atiplintrc.yaml',
  '.atiplintrc.yml',
  '.atiplintrc.js',
  'atiplint.config.js',
] as const;

/**
 * Default ignore patterns.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
] as const;
```

---

## ATIP Metadata for atip-lint (Dogfooding)

When run with `--agent`, atip-lint outputs its own ATIP metadata:

```json
{
  "atip": { "version": "0.6" },
  "name": "atip-lint",
  "version": "0.1.0",
  "description": "Lint ATIP metadata for quality issues beyond schema validation",
  "homepage": "https://github.com/atip-dev/atip",
  "trust": {
    "source": "native",
    "verified": true
  },
  "commands": {
    "lint": {
      "description": "Lint ATIP metadata files for quality issues",
      "arguments": [
        {
          "name": "files",
          "type": "string",
          "description": "Files or glob patterns to lint",
          "required": true,
          "variadic": true
        }
      ],
      "options": [
        {
          "name": "fix",
          "flags": ["--fix"],
          "type": "boolean",
          "description": "Automatically fix issues when possible"
        },
        {
          "name": "config",
          "flags": ["-c", "--config"],
          "type": "file",
          "description": "Path to config file"
        },
        {
          "name": "output",
          "flags": ["-o", "--output"],
          "type": "enum",
          "enum": ["stylish", "json", "sarif", "compact"],
          "description": "Output format"
        }
      ],
      "effects": {
        "filesystem": { "read": true, "write": false },
        "network": false,
        "idempotent": true
      }
    },
    "init": {
      "description": "Initialize a lint configuration file",
      "options": [
        {
          "name": "preset",
          "flags": ["-p", "--preset"],
          "type": "enum",
          "enum": ["recommended", "strict", "minimal"],
          "description": "Rule preset to use"
        }
      ],
      "effects": {
        "filesystem": { "read": false, "write": true },
        "network": false,
        "idempotent": false
      }
    },
    "list-rules": {
      "description": "List available lint rules",
      "effects": {
        "network": false,
        "idempotent": true
      }
    }
  },
  "globalOptions": [
    {
      "name": "quiet",
      "flags": ["-q", "--quiet"],
      "type": "boolean",
      "description": "Only show errors, suppress warnings"
    },
    {
      "name": "verbose",
      "flags": ["-v", "--verbose"],
      "type": "boolean",
      "description": "Show debug information"
    }
  ]
}
```
