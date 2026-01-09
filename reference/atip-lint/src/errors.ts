/**
 * Base error class for all atip-lint errors.
 * Provides a consistent error code for programmatic handling.
 */
export class LintError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'LintError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Configuration loading or validation error.
 * Includes the config path and underlying cause for debugging.
 */
export class ConfigError extends LintError {
  constructor(
    message: string,
    public readonly configPath?: string,
    public readonly cause?: Error
  ) {
    const fullMessage = configPath
      ? `${message} (config: ${configPath})`
      : message;
    const finalMessage = cause
      ? `${fullMessage}: ${cause.message}`
      : fullMessage;

    super(finalMessage, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * File access error (not found, permission denied, etc.).
 * Includes the file path and underlying cause.
 */
export class FileError extends LintError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    const fullMessage = `${message} (file: ${filePath})`;
    const finalMessage = cause
      ? `${fullMessage}: ${cause.message}`
      : fullMessage;

    super(finalMessage, 'FILE_ERROR');
    this.name = 'FileError';
  }
}

/**
 * Schema validation error.
 * Contains detailed validation errors from JSON Schema validation.
 */
export class SchemaError extends LintError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly schemaErrors: SchemaValidationError[]
  ) {
    const errorCount = schemaErrors.length;
    const fullMessage = `${message} (file: ${filePath}, ${errorCount} error${errorCount !== 1 ? 's' : ''})`;

    super(fullMessage, 'SCHEMA_ERROR');
    this.name = 'SchemaError';
  }
}

/**
 * Schema validation error detail.
 * Provides structured information about a specific validation failure.
 */
export interface SchemaValidationError {
  path: string;
  message: string;
  keyword: string;
}

/**
 * Executable check error.
 * Occurs when binary probing fails or produces invalid output.
 */
export class ExecutableError extends LintError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly cause?: Error
  ) {
    const fullMessage = `${message} (tool: ${toolName})`;
    const finalMessage = cause
      ? `${fullMessage}: ${cause.message}`
      : fullMessage;

    super(finalMessage, 'EXECUTABLE_ERROR');
    this.name = 'ExecutableError';
  }
}
