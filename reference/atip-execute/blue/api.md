# API Specification: atip-execute

## Overview

`atip-execute` is a TypeScript library for safe execution of LLM tool calls against CLI tools described by ATIP metadata. It bridges the gap between LLM provider responses and actual subprocess execution, providing:

1. **Tool Call Parsing** - Extract tool calls from OpenAI, Gemini, and Anthropic response formats (via atip-bridge)
2. **Command Mapping** - Map flattened tool names back to CLI command arrays (inverse of atip-bridge flattening)
3. **Validation** - Validate tool call arguments against ATIP schema and apply safety policies
4. **Execution** - Safe subprocess execution with timeout, output capture, and error handling
5. **Result Formatting** - Format execution results for return to LLM providers

The library works alongside `atip-bridge` (which handles compilation) to complete the ATIP execution lifecycle per spec section 7 (Function Calling Lifecycle).

---

## Core Types

### Execution Configuration

```typescript
/**
 * Configuration for creating an executor instance.
 */
export interface ExecutorConfig {
  /**
   * ATIP tool metadata for available tools.
   * Used for validation, command mapping, and effects checking.
   */
  tools: AtipTool[];

  /**
   * Execution policy controlling what operations are allowed.
   * @default Allows all operations
   */
  policy?: ExecutionPolicy;

  /**
   * Options controlling subprocess execution behavior.
   */
  execution?: ExecutionOptions;

  /**
   * Options for filtering/sanitizing output before returning to LLM.
   */
  output?: OutputOptions;
}

/**
 * Execution policy controlling what operations are allowed.
 * More restrictive than atip-bridge's Policy as it controls actual execution.
 */
export interface ExecutionPolicy {
  /**
   * Allow execution of destructive operations.
   * When false, destructive operations throw RequiresConfirmationError.
   * @default false
   */
  allowDestructive?: boolean;

  /**
   * Allow execution of non-reversible operations.
   * @default true
   */
  allowNonReversible?: boolean;

  /**
   * Allow execution of billable operations.
   * @default true
   */
  allowBillable?: boolean;

  /**
   * Allow operations requiring network access.
   * @default true
   */
  allowNetwork?: boolean;

  /**
   * Allow operations that write to filesystem.
   * @default true
   */
  allowFilesystemWrite?: boolean;

  /**
   * Allow operations that delete files.
   * @default true
   */
  allowFilesystemDelete?: boolean;

  /**
   * Minimum trust level required for execution.
   * Operations from tools below this level throw InsufficientTrustError.
   * @default 'inferred'
   */
  minTrustLevel?: TrustSource;

  /**
   * Maximum cost estimate allowed.
   * Operations exceeding this throw CostExceededError.
   * @default 'high'
   */
  maxCostEstimate?: CostEstimate;

  /**
   * Handler called when operation requires confirmation.
   * If not provided, RequiresConfirmationError is thrown.
   * Return true to proceed, false to abort.
   */
  confirmationHandler?: (context: ConfirmationContext) => Promise<boolean>;

  /**
   * Allow execution of interactive commands (stdin required, prompts, tty).
   * When false, interactive commands throw InteractiveNotSupportedError.
   * @default false
   */
  allowInteractive?: boolean;
}

/**
 * Trust source levels from ATIP spec section 3.2.2.
 */
export type TrustSource =
  | 'native'      // HIGH trust
  | 'vendor'      // HIGH trust
  | 'org'         // MEDIUM trust
  | 'community'   // LOW trust
  | 'user'        // LOW trust
  | 'inferred';   // VERY LOW trust

/**
 * Cost estimate levels from ATIP spec section 3.6.
 */
export type CostEstimate = 'free' | 'low' | 'medium' | 'high';

/**
 * Context provided when confirmation is required.
 */
export interface ConfirmationContext {
  /** The flattened tool name (e.g., "gh_repo_delete") */
  toolName: string;

  /** The CLI command that would be executed */
  command: string[];

  /** Arguments from the tool call */
  arguments: Record<string, unknown>;

  /** Reasons confirmation is required */
  reasons: ConfirmationReason[];

  /** Effects metadata for the command */
  effects: AtipEffects;

  /** Trust information for the tool */
  trust?: AtipTrust;
}

/**
 * Reasons why confirmation might be required.
 */
export type ConfirmationReason =
  | 'destructive'
  | 'non-reversible'
  | 'billable'
  | 'low-trust'
  | 'filesystem-delete'
  | 'cost-high';

/**
 * Options controlling subprocess execution.
 */
export interface ExecutionOptions {
  /**
   * Default timeout for command execution in milliseconds.
   * Can be overridden per-command by effects.duration.timeout.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum output size in bytes before truncation.
   * @default 1048576 (1MB)
   */
  maxOutputSize?: number;

  /**
   * Working directory for command execution.
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Environment variables to pass to subprocess.
   * Merged with process.env.
   */
  env?: Record<string, string>;

  /**
   * Shell to use for execution.
   * When undefined, commands are executed directly (recommended).
   * @default undefined
   */
  shell?: string | boolean;

  /**
   * Enable streaming of stdout/stderr.
   * When true, output handlers are called incrementally.
   * @default false
   */
  streaming?: boolean;

  /**
   * Handler for stdout data when streaming is enabled.
   */
  onStdout?: (data: Buffer) => void;

  /**
   * Handler for stderr data when streaming is enabled.
   */
  onStderr?: (data: Buffer) => void;
}

/**
 * Options for output filtering and formatting.
 */
export interface OutputOptions {
  /**
   * Maximum result length in characters for LLM output.
   * @default 100000
   */
  maxLength?: number;

  /**
   * Whether to redact common secret patterns.
   * @default true
   */
  redactSecrets?: boolean;

  /**
   * Additional patterns to redact from output.
   */
  redactPatterns?: RegExp[];

  /**
   * Whether to include stderr in the result.
   * @default true
   */
  includeStderr?: boolean;

  /**
   * Whether to include exit code in the result.
   * @default true
   */
  includeExitCode?: boolean;

  /**
   * Custom formatter for results.
   * If not provided, default JSON format is used.
   */
  formatter?: (result: ExecutionResult) => string;
}
```

### Execution Result Types

```typescript
/**
 * Result of executing a tool call.
 */
export interface ExecutionResult {
  /** Whether execution completed successfully (exit code 0) */
  success: boolean;

  /** Exit code from the subprocess */
  exitCode: number;

  /** Standard output from the command */
  stdout: string;

  /** Standard error from the command */
  stderr: string;

  /** Execution duration in milliseconds */
  duration: number;

  /** Whether output was truncated due to size limits */
  truncated: boolean;

  /** Whether execution was terminated due to timeout */
  timedOut: boolean;

  /** The actual command that was executed */
  command: string[];

  /** Tool call ID for correlation */
  toolCallId: string;

  /** Tool name for reference */
  toolName: string;
}

/**
 * Formatted result ready for return to LLM.
 */
export interface FormattedResult {
  /** Human-readable summary for LLM */
  content: string;

  /** Whether the operation succeeded */
  success: boolean;

  /** Original execution result (for agent use) */
  raw: ExecutionResult;
}

/**
 * Result of batch execution.
 */
export interface BatchExecutionResult {
  /** Results for each tool call, in order */
  results: FormattedResult[];

  /** Total execution duration in milliseconds */
  totalDuration: number;

  /** Number of successful executions */
  successCount: number;

  /** Number of failed executions */
  failureCount: number;
}
```

### Command Mapping Types

```typescript
/**
 * Result of mapping a flattened tool name to a CLI command.
 */
export interface CommandMapping {
  /** The CLI command as an array (e.g., ["gh", "pr", "create"]) */
  command: string[];

  /** The ATIP command metadata for this command */
  metadata: AtipCommand;

  /** The root tool metadata */
  tool: AtipTool;

  /** Path to the command in the ATIP metadata tree */
  path: string[];

  /** Merged effects (command effects with tool-level defaults) */
  effects: AtipEffects;
}

/**
 * Options for command mapping.
 */
export interface MapOptions {
  /**
   * Separator used in flattened tool names.
   * @default '_'
   */
  separator?: string;
}

/**
 * Parsed tool call with command mapping.
 */
export interface MappedToolCall {
  /** Original tool call from LLM response */
  toolCall: ToolCall;

  /** Mapped CLI command information */
  mapping: CommandMapping;

  /** Validated and typed arguments */
  validatedArgs: Record<string, unknown>;
}
```

### Validation Types

```typescript
/**
 * Result of validating a tool call.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors (if any) */
  errors: ValidationError[];

  /** Validation warnings (non-blocking issues) */
  warnings: ValidationWarning[];

  /** Coerced/normalized arguments (if valid) */
  normalizedArgs?: Record<string, unknown>;
}

/**
 * A validation error that prevents execution.
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: ValidationErrorCode;

  /** Human-readable error message */
  message: string;

  /** Parameter name that caused the error */
  parameter?: string;

  /** The invalid value */
  value?: unknown;

  /** Expected type or format */
  expected?: string;
}

/**
 * Validation error codes.
 */
export type ValidationErrorCode =
  | 'MISSING_REQUIRED'      // Required parameter not provided
  | 'INVALID_TYPE'          // Wrong type for parameter
  | 'INVALID_ENUM'          // Value not in allowed enum
  | 'INVALID_FORMAT'        // Value doesn't match format (file, url, etc.)
  | 'UNKNOWN_PARAMETER'     // Parameter not in schema
  | 'UNKNOWN_COMMAND';      // Tool name not found in metadata

/**
 * A validation warning (non-blocking).
 */
export interface ValidationWarning {
  /** Warning code */
  code: ValidationWarningCode;

  /** Human-readable message */
  message: string;

  /** Parameter name */
  parameter?: string;
}

/**
 * Validation warning codes.
 */
export type ValidationWarningCode =
  | 'EXTRA_PARAMETER'       // Parameter provided but not in schema
  | 'DEPRECATED_PARAMETER'  // Parameter is deprecated
  | 'MISSING_OPTIONAL';     // Optional parameter not provided (informational)
```

---

## Core Functions

### createExecutor

```typescript
/**
 * Create an executor instance configured for safe tool execution.
 *
 * @param config - Executor configuration
 * @returns Configured Executor instance
 *
 * @remarks
 * - The executor caches command mappings for fast lookups
 * - Policy is evaluated before each execution
 * - Results are automatically filtered for secrets
 *
 * @example
 * ```typescript
 * const executor = createExecutor({
 *   tools: [ghTool, kubectlTool],
 *   policy: {
 *     allowDestructive: false,
 *     confirmationHandler: async (ctx) => {
 *       return await askUser(`Execute ${ctx.command.join(' ')}?`);
 *     },
 *   },
 *   execution: {
 *     timeout: 60000,
 *     cwd: '/project',
 *   },
 * });
 * ```
 */
export function createExecutor(config: ExecutorConfig): Executor;

/**
 * Executor instance for running tool calls.
 */
export interface Executor {
  /**
   * Execute a single tool call.
   *
   * @param toolCall - Parsed tool call from LLM response
   * @returns Formatted result ready for LLM
   *
   * @throws {UnknownCommandError} Tool name not found in metadata
   * @throws {ValidationError} Arguments don't match schema
   * @throws {RequiresConfirmationError} Operation requires confirmation (if no handler)
   * @throws {PolicyViolationError} Operation blocked by policy
   * @throws {ExecutionError} Subprocess execution failed
   * @throws {TimeoutError} Command exceeded timeout
   */
  execute(toolCall: ToolCall): Promise<FormattedResult>;

  /**
   * Execute multiple tool calls (potentially in parallel).
   *
   * @param toolCalls - Array of parsed tool calls
   * @param options - Batch execution options
   * @returns Results for all tool calls
   *
   * @remarks
   * - By default, executes sequentially for safety
   * - Set `parallel: true` to execute non-conflicting operations concurrently
   * - If any call throws a blocking error, subsequent calls are skipped
   */
  executeBatch(
    toolCalls: ToolCall[],
    options?: BatchOptions
  ): Promise<BatchExecutionResult>;

  /**
   * Validate a tool call without executing it.
   *
   * @param toolCall - Tool call to validate
   * @returns Validation result
   */
  validate(toolCall: ToolCall): ValidationResult;

  /**
   * Map a flattened tool name to CLI command.
   *
   * @param toolName - Flattened tool name (e.g., "gh_pr_create")
   * @returns Command mapping or undefined if not found
   */
  mapCommand(toolName: string): CommandMapping | undefined;

  /**
   * Check if a tool call would be allowed by the current policy.
   *
   * @param toolCall - Tool call to check
   * @returns Policy check result
   */
  checkPolicy(toolCall: ToolCall): PolicyCheckResult;

  /**
   * Get the ATIP metadata for a flattened tool name.
   *
   * @param toolName - Flattened tool name
   * @returns ATIP command metadata or undefined
   */
  getMetadata(toolName: string): AtipCommand | undefined;
}

/**
 * Options for batch execution.
 */
export interface BatchOptions {
  /**
   * Execute non-conflicting operations in parallel.
   * Operations are considered conflicting if they both write to filesystem.
   * @default false
   */
  parallel?: boolean;

  /**
   * Continue execution if a tool call fails.
   * When false, stops at first failure.
   * @default true
   */
  continueOnError?: boolean;

  /**
   * Maximum concurrent executions when parallel is true.
   * @default 4
   */
  maxConcurrency?: number;
}

/**
 * Result of a policy check.
 */
export interface PolicyCheckResult {
  /** Whether execution would be allowed */
  allowed: boolean;

  /** Whether confirmation would be required */
  requiresConfirmation: boolean;

  /** Reasons for blocking or requiring confirmation */
  reasons: ConfirmationReason[];

  /** Policy violations (if not allowed) */
  violations: PolicyViolation[];
}

/**
 * A policy violation.
 */
export interface PolicyViolation {
  /** Violation code */
  code: PolicyViolationCode;

  /** Human-readable message */
  message: string;

  /** Severity level */
  severity: 'error' | 'warning';
}

/**
 * Policy violation codes.
 */
export type PolicyViolationCode =
  | 'DESTRUCTIVE_BLOCKED'
  | 'NON_REVERSIBLE_BLOCKED'
  | 'BILLABLE_BLOCKED'
  | 'NETWORK_BLOCKED'
  | 'FILESYSTEM_WRITE_BLOCKED'
  | 'FILESYSTEM_DELETE_BLOCKED'
  | 'TRUST_INSUFFICIENT'
  | 'COST_EXCEEDED'
  | 'INTERACTIVE_BLOCKED';
```

### mapToCommand

```typescript
/**
 * Map a flattened tool name back to a CLI command array.
 *
 * @param toolName - Flattened tool name (e.g., "gh_pr_create")
 * @param tools - ATIP tool metadata to search
 * @param options - Mapping options
 * @returns Command mapping or undefined if not found
 *
 * @remarks
 * - Reverses the flattening done by atip-bridge
 * - Searches all provided tools for a match
 * - Returns the first match if multiple tools have the same flattened name
 *
 * @example
 * ```typescript
 * const mapping = mapToCommand('gh_pr_create', [ghTool]);
 * // mapping.command = ['gh', 'pr', 'create']
 * // mapping.path = ['pr', 'create']
 * // mapping.metadata = { description: 'Create a pull request', ... }
 * ```
 */
export function mapToCommand(
  toolName: string,
  tools: AtipTool[],
  options?: MapOptions
): CommandMapping | undefined;
```

### validateToolCall

```typescript
/**
 * Validate a tool call's arguments against ATIP metadata.
 *
 * @param toolCall - The tool call to validate
 * @param mapping - Command mapping from mapToCommand
 * @returns Validation result with errors, warnings, and normalized arguments
 *
 * @remarks
 * - Checks required parameters are present
 * - Validates types (string, integer, boolean, etc.)
 * - Checks enum values against allowed list
 * - Coerces types where safe (string "42" to integer 42)
 * - Reports unknown parameters as warnings
 *
 * @example
 * ```typescript
 * const mapping = mapToCommand('gh_pr_create', tools);
 * const validation = validateToolCall(
 *   { id: '1', name: 'gh_pr_create', arguments: { title: 'Fix bug' } },
 *   mapping
 * );
 * if (!validation.valid) {
 *   console.error('Validation failed:', validation.errors);
 * }
 * ```
 */
export function validateToolCall(
  toolCall: ToolCall,
  mapping: CommandMapping
): ValidationResult;
```

### buildCommandArray

```typescript
/**
 * Build the final command array with arguments.
 *
 * @param mapping - Command mapping from mapToCommand
 * @param args - Validated arguments from the tool call
 * @returns Command array ready for subprocess execution
 *
 * @remarks
 * - Handles different argument styles (flags, positional, variadic)
 * - Properly escapes values with special characters
 * - Respects ATIP option flags (short vs long form)
 * - Boolean flags are included without value when true
 *
 * @example
 * ```typescript
 * const cmd = buildCommandArray(mapping, {
 *   title: 'Fix bug',
 *   draft: true,
 *   reviewer: ['alice', 'bob'],
 * });
 * // ['gh', 'pr', 'create', '--title', 'Fix bug', '--draft', '--reviewer', 'alice', '--reviewer', 'bob']
 * ```
 */
export function buildCommandArray(
  mapping: CommandMapping,
  args: Record<string, unknown>
): string[];
```

### executeCommand

```typescript
/**
 * Execute a CLI command as a subprocess.
 *
 * @param command - Command array to execute
 * @param options - Execution options
 * @returns Execution result with stdout, stderr, exit code
 *
 * @remarks
 * - Does NOT validate or check policy - use Executor for that
 * - Handles timeout enforcement
 * - Captures stdout/stderr with size limits
 * - Supports streaming output
 *
 * @throws {ExecutionError} If subprocess fails to start
 * @throws {TimeoutError} If command exceeds timeout
 *
 * @example
 * ```typescript
 * const result = await executeCommand(
 *   ['gh', 'pr', 'list', '--json', 'number,title'],
 *   { timeout: 30000, cwd: '/project' }
 * );
 * console.log('Exit code:', result.exitCode);
 * console.log('Output:', result.stdout);
 * ```
 */
export function executeCommand(
  command: string[],
  options?: ExecutionOptions
): Promise<ExecutionResult>;
```

### formatResult

```typescript
/**
 * Format an execution result for return to LLM.
 *
 * @param result - Raw execution result
 * @param options - Output formatting options
 * @returns Formatted result with filtered content
 *
 * @remarks
 * - Redacts secrets from output
 * - Truncates long output
 * - Combines stdout/stderr as configured
 * - Includes error information for failed executions
 *
 * @example
 * ```typescript
 * const formatted = formatResult(result, {
 *   maxLength: 10000,
 *   redactSecrets: true,
 *   includeExitCode: true,
 * });
 * // formatted.content is ready for LLM consumption
 * ```
 */
export function formatResult(
  result: ExecutionResult,
  options?: OutputOptions
): FormattedResult;
```

---

## Re-exported from atip-bridge

The following are re-exported from `atip-bridge` for convenience:

```typescript
// Lifecycle helpers (used for parsing LLM responses)
export { parseToolCall } from 'atip-bridge';
export { handleToolResult } from 'atip-bridge';

// Types
export type {
  ToolCall,
  Provider,
  Message,
  AtipTool,
  AtipCommand,
  AtipEffects,
  AtipTrust,
  AtipArgument,
  AtipOption,
} from 'atip-bridge';
```

---

## Error Types

```typescript
/**
 * Base class for atip-execute errors.
 */
export class AtipExecuteError extends Error {
  constructor(
    message: string,
    public readonly code: string
  );
}

/**
 * Thrown when a tool name is not found in the provided metadata.
 */
export class UnknownCommandError extends AtipExecuteError {
  constructor(
    public readonly toolName: string
  );
  // code: 'UNKNOWN_COMMAND'
}

/**
 * Thrown when tool call arguments fail validation.
 */
export class ArgumentValidationError extends AtipExecuteError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly errors: ValidationError[]
  );
  // code: 'VALIDATION_FAILED'
}

/**
 * Thrown when an operation is blocked by policy.
 */
export class PolicyViolationError extends AtipExecuteError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly violations: PolicyViolation[]
  );
  // code: 'POLICY_VIOLATION'
}

/**
 * Thrown when an operation requires user confirmation.
 * This is recoverable - agents can prompt user and retry.
 */
export class RequiresConfirmationError extends AtipExecuteError {
  constructor(
    public readonly context: ConfirmationContext
  );
  // code: 'REQUIRES_CONFIRMATION'
}

/**
 * Thrown when tool trust level is below policy minimum.
 */
export class InsufficientTrustError extends AtipExecuteError {
  constructor(
    public readonly toolName: string,
    public readonly actualTrust: TrustSource,
    public readonly requiredTrust: TrustSource
  );
  // code: 'INSUFFICIENT_TRUST'
}

/**
 * Thrown when subprocess execution fails.
 */
export class ExecutionError extends AtipExecuteError {
  constructor(
    message: string,
    public readonly command: string[],
    public readonly cause?: Error
  );
  // code: 'EXECUTION_FAILED'
}

/**
 * Thrown when command exceeds timeout.
 */
export class TimeoutError extends AtipExecuteError {
  constructor(
    public readonly command: string[],
    public readonly timeout: number
  );
  // code: 'TIMEOUT'
}

/**
 * Thrown when interactive command is not supported.
 */
export class InteractiveNotSupportedError extends AtipExecuteError {
  constructor(
    public readonly toolName: string,
    public readonly interactiveEffects: {
      stdin?: string;
      prompts?: boolean;
      tty?: boolean;
    }
  );
  // code: 'INTERACTIVE_NOT_SUPPORTED'
}
```

---

## Constants

```typescript
/**
 * Default timeout for command execution (30 seconds).
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default maximum output size (1MB).
 */
export const DEFAULT_MAX_OUTPUT_SIZE = 1048576;

/**
 * Default maximum result length for LLM (100K characters).
 */
export const DEFAULT_MAX_RESULT_LENGTH = 100000;

/**
 * Default separator used in flattened tool names.
 */
export const DEFAULT_SEPARATOR = '_';

/**
 * Trust level ordering for comparison.
 */
export const TRUST_LEVEL_ORDER: Record<TrustSource, number> = {
  native: 6,
  vendor: 5,
  org: 4,
  community: 3,
  user: 2,
  inferred: 1,
};

/**
 * Patterns for secret redaction (re-exported from atip-bridge).
 */
export { DEFAULT_REDACT_PATTERNS } from 'atip-bridge';
```

---

## Module Exports

```typescript
// Factory function
export { createExecutor } from './executor';

// Core functions
export { mapToCommand } from './mapping';
export { validateToolCall } from './validation';
export { buildCommandArray } from './command-builder';
export { executeCommand } from './execution';
export { formatResult } from './formatting';

// Re-exports from atip-bridge
export { parseToolCall, handleToolResult } from 'atip-bridge';

// Types
export type {
  // Configuration
  ExecutorConfig,
  ExecutionPolicy,
  ExecutionOptions,
  OutputOptions,

  // Execution
  Executor,
  ExecutionResult,
  FormattedResult,
  BatchExecutionResult,
  BatchOptions,

  // Command mapping
  CommandMapping,
  MapOptions,
  MappedToolCall,

  // Validation
  ValidationResult,
  ValidationError,
  ValidationErrorCode,
  ValidationWarning,
  ValidationWarningCode,

  // Policy
  PolicyCheckResult,
  PolicyViolation,
  PolicyViolationCode,
  ConfirmationContext,
  ConfirmationReason,

  // Trust and cost
  TrustSource,
  CostEstimate,
};

// Error types
export {
  AtipExecuteError,
  UnknownCommandError,
  ArgumentValidationError,
  PolicyViolationError,
  RequiresConfirmationError,
  InsufficientTrustError,
  ExecutionError,
  TimeoutError,
  InteractiveNotSupportedError,
} from './errors';

// Constants
export {
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_OUTPUT_SIZE,
  DEFAULT_MAX_RESULT_LENGTH,
  DEFAULT_SEPARATOR,
  TRUST_LEVEL_ORDER,
  DEFAULT_REDACT_PATTERNS,
} from './constants';

// Re-export types from atip-bridge for convenience
export type {
  ToolCall,
  Provider,
  Message,
  AtipTool,
  AtipCommand,
  AtipEffects,
  AtipTrust,
  AtipArgument,
  AtipOption,
} from 'atip-bridge';
```
