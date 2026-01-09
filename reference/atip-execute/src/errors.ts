/**
 * Error types for atip-execute
 */

/**
 * Base class for all atip-execute errors.
 *
 * Provides a consistent error code field for programmatic error handling.
 */
export class AtipExecuteError extends Error {
  constructor(
    message: string,
    /** Machine-readable error code */
    public readonly code: string
  ) {
    super(message);
    this.name = 'AtipExecuteError';
  }
}

/**
 * Thrown when a tool name is not found in the provided ATIP metadata.
 *
 * This indicates the LLM tried to call a tool that doesn't exist or
 * wasn't included in the executor configuration.
 */
export class UnknownCommandError extends AtipExecuteError {
  constructor(
    /** Name of the tool that was not found */
    public readonly toolName: string
  ) {
    super(`Unknown command: ${toolName}`, 'UNKNOWN_COMMAND');
    this.name = 'UnknownCommandError';
  }
}

/**
 * Thrown when tool call arguments fail validation against ATIP metadata.
 *
 * Contains detailed validation errors for debugging.
 */
export class ArgumentValidationError extends AtipExecuteError {
  constructor(
    message: string,
    /** Name of the tool being validated */
    public readonly toolName: string,
    /** Array of validation errors */
    public readonly errors: any[]
  ) {
    super(message, 'VALIDATION_FAILED');
    this.name = 'ArgumentValidationError';
  }
}

/**
 * Thrown when an operation is blocked by policy.
 *
 * Hard blocking violations that cannot be overridden by confirmation.
 */
export class PolicyViolationError extends AtipExecuteError {
  constructor(
    message: string,
    /** Name of the tool being blocked */
    public readonly toolName: string,
    /** Array of policy violations */
    public readonly violations: any[]
  ) {
    super(message, 'POLICY_VIOLATION');
    this.name = 'PolicyViolationError';
  }
}

/**
 * Thrown when an operation requires user confirmation.
 *
 * This is a recoverable error - agents can prompt the user and retry
 * with a confirmation handler.
 */
export class RequiresConfirmationError extends AtipExecuteError {
  constructor(
    /** Context information for confirmation prompt */
    public readonly context: any
  ) {
    super('Operation requires confirmation', 'REQUIRES_CONFIRMATION');
    this.name = 'RequiresConfirmationError';
  }
}

/**
 * Thrown when tool trust level is below policy minimum.
 *
 * Prevents execution of tools from untrusted sources.
 */
export class InsufficientTrustError extends AtipExecuteError {
  constructor(
    /** Name of the tool being blocked */
    public readonly toolName: string,
    /** Actual trust level of the tool */
    public readonly actualTrust: string,
    /** Required minimum trust level */
    public readonly requiredTrust: string
  ) {
    super(
      `Insufficient trust: ${actualTrust} < ${requiredTrust}`,
      'INSUFFICIENT_TRUST'
    );
    this.name = 'InsufficientTrustError';
  }
}

/**
 * Thrown when subprocess execution fails.
 *
 * This wraps underlying Node.js spawn errors.
 */
export class ExecutionError extends AtipExecuteError {
  constructor(
    message: string,
    /** Command that failed to execute */
    public readonly command: string[],
    /** Underlying error cause */
    public readonly cause?: Error
  ) {
    super(message, 'EXECUTION_FAILED');
    this.name = 'ExecutionError';
  }
}

/**
 * Thrown when command exceeds configured timeout.
 *
 * The process will be terminated with SIGTERM, followed by SIGKILL.
 */
export class TimeoutError extends AtipExecuteError {
  constructor(
    /** Command that timed out */
    public readonly command: string[],
    /** Timeout value in milliseconds */
    public readonly timeout: number
  ) {
    super(`Command timed out after ${timeout}ms`, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when an interactive command is attempted with allowInteractive: false.
 *
 * Interactive commands require stdin/TTY which may not be available in
 * automated environments.
 */
export class InteractiveNotSupportedError extends AtipExecuteError {
  constructor(
    /** Name of the interactive tool */
    public readonly toolName: string,
    /** Interactive effects from ATIP metadata */
    public readonly interactiveEffects: any
  ) {
    super('Interactive commands not supported', 'INTERACTIVE_NOT_SUPPORTED');
    this.name = 'InteractiveNotSupportedError';
  }
}
