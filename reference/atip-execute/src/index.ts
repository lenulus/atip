/**
 * @atip/execute - Safe execution of LLM tool calls against CLI tools
 *
 * This library provides a complete pipeline for executing LLM tool calls
 * against CLI tools using ATIP metadata:
 *
 * 1. Command mapping - Map flattened tool names to CLI commands
 * 2. Argument validation - Validate arguments against ATIP schemas
 * 3. Policy enforcement - Check effects against safety policies
 * 4. Subprocess execution - Execute commands with timeouts and limits
 * 5. Result formatting - Format output for LLM consumption with secret redaction
 *
 * @example
 * ```typescript
 * import { createExecutor } from '@atip/execute';
 *
 * const executor = createExecutor({
 *   tools: [ghMetadata], // ATIP metadata
 *   policy: {
 *     allowDestructive: false,
 *     minTrustLevel: 'community',
 *   },
 * });
 *
 * const result = await executor.execute({
 *   id: '1',
 *   name: 'gh_pr_create',
 *   arguments: { title: 'Fix bug', draft: true },
 * });
 *
 * console.log(result.content); // Formatted output
 * ```
 *
 * @module @atip/execute
 */

// Factory function
export { createExecutor } from './executor.js';

// Core functions
export { mapToCommand } from './mapping.js';
export { validateToolCall } from './validation.js';
export { buildCommandArray } from './command-builder.js';
export { executeCommand } from './execution.js';
export { formatResult } from './formatting.js';

// Error classes
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
} from './errors.js';

// Constants
export {
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_OUTPUT_SIZE,
  DEFAULT_MAX_RESULT_LENGTH,
  DEFAULT_SEPARATOR,
  TRUST_LEVEL_ORDER,
} from './constants.js';

// Type exports
export type {
  ExecutorConfig,
  BatchOptions,
  BatchExecutionResult,
  Executor,
} from './executor.js';

export type {
  CommandMapping,
  MapOptions,
} from './mapping.js';

export type {
  ValidationResult,
  ValidationError,
  ValidationErrorCode,
  ValidationWarning,
  ValidationWarningCode,
} from './validation.js';

export type {
  ExecutionPolicy,
  ConfirmationContext,
  ConfirmationReason,
  PolicyCheckResult,
  PolicyViolation,
  PolicyViolationCode,
} from './policy.js';

export type {
  ExecutionOptions,
  ExecutionResult,
} from './execution.js';

export type {
  OutputOptions,
  FormattedResult,
} from './formatting.js';
