/**
 * Error types for atip-diff
 */

import type { SchemaValidationError } from './types.js';

/**
 * Base error for atip-diff operations.
 */
export class DiffError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'DiffError';
    Object.setPrototypeOf(this, DiffError.prototype);
  }
}

/**
 * File access error.
 * Thrown when files cannot be read or accessed.
 */
export class FileError extends DiffError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message, 'FILE_ERROR');
    this.name = 'FileError';
    Object.setPrototypeOf(this, FileError.prototype);
  }
}

/**
 * Validation error for invalid ATIP JSON.
 * Thrown when ATIP metadata fails schema validation.
 */
export class ValidationError extends DiffError {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly schemaErrors?: SchemaValidationError[]
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Parse error for malformed JSON.
 * Thrown when JSON parsing fails.
 */
export class ParseError extends DiffError {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}
