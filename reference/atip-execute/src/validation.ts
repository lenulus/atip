/**
 * Argument validation against ATIP metadata
 */

/**
 * Result of validating a tool call's arguments.
 */
export interface ValidationResult {
  /** True if validation passed with no errors */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
  /** List of warnings (non-blocking issues) */
  warnings: ValidationWarning[];
  /** Normalized/coerced arguments (only present if valid) */
  normalizedArgs?: Record<string, unknown>;
}

/**
 * A validation error for a specific parameter.
 */
export interface ValidationError {
  /** Error code identifying the type of validation failure */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
  /** Name of the parameter that failed validation */
  parameter?: string;
  /** Actual value that was provided */
  value?: unknown;
  /** Expected type or format */
  expected?: string;
}

/**
 * Types of validation errors.
 */
export type ValidationErrorCode =
  | 'MISSING_REQUIRED'
  | 'INVALID_TYPE'
  | 'INVALID_ENUM'
  | 'INVALID_FORMAT'
  | 'UNKNOWN_PARAMETER'
  | 'UNKNOWN_COMMAND';

/**
 * A validation warning for a parameter (non-blocking).
 */
export interface ValidationWarning {
  /** Warning code identifying the type of issue */
  code: ValidationWarningCode;
  /** Human-readable warning message */
  message: string;
  /** Name of the parameter that triggered the warning */
  parameter?: string;
}

/**
 * Types of validation warnings.
 */
export type ValidationWarningCode =
  | 'EXTRA_PARAMETER'
  | 'DEPRECATED_PARAMETER'
  | 'MISSING_OPTIONAL';

/**
 * Validate a tool call's arguments against ATIP metadata.
 *
 * Performs type checking, required field validation, and type coercion
 * (e.g., string "123" to integer 123) according to ATIP argument schemas.
 *
 * @param toolCall - Tool call object with name and arguments
 * @param mapping - Command mapping containing metadata with argument schemas
 * @returns Validation result with errors, warnings, and normalized arguments
 *
 * @example
 * ```typescript
 * const result = validateToolCall(
 *   { name: 'gh_pr_create', arguments: { title: 'Fix', draft: 'true' } },
 *   mapping
 * );
 *
 * if (result.valid) {
 *   console.log(result.normalizedArgs); // { title: 'Fix', draft: true }
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateToolCall(
  toolCall: any,
  mapping: any
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const normalizedArgs: Record<string, unknown> = {};

  const args = toolCall.arguments || {};
  const metadata = mapping.metadata;

  // Get schema from arguments and options
  const argumentsSchema = metadata.arguments || [];
  const optionsSchema = metadata.options || [];

  // Track which parameters we've seen
  const seenParams = new Set<string>();

  // Validate arguments (positional)
  for (const argSchema of argumentsSchema) {
    const paramName = argSchema.name;
    const value = args[paramName];
    seenParams.add(paramName);

    // Check required (undefined means missing, null is present but invalid)
    if (argSchema.required && value === undefined) {
      errors.push({
        code: 'MISSING_REQUIRED',
        message: `Required parameter '${paramName}' is missing`,
        parameter: paramName,
      });
      continue;
    }

    // Skip validation if value not provided and not required
    if (value === undefined) {
      continue;
    }

    // null is treated as invalid type (present but wrong type)
    if (value === null) {
      errors.push({
        code: 'INVALID_TYPE',
        message: `Parameter '${paramName}' cannot be null`,
        parameter: paramName,
        value,
        expected: argSchema.type,
      });
      continue;
    }

    // Validate type
    const validation = validateValue(value, argSchema);
    if (!validation.valid) {
      errors.push({
        code: validation.error!.code,
        message: validation.error!.message,
        parameter: paramName,
        value,
        expected: validation.error!.expected,
      });
    } else {
      normalizedArgs[paramName] = validation.normalizedValue;
    }
  }

  // Validate options (flagged)
  for (const optionSchema of optionsSchema) {
    const paramName = optionSchema.name;
    const value = args[paramName];
    seenParams.add(paramName);

    // Check required (undefined means missing, null is present but invalid)
    if (optionSchema.required && value === undefined) {
      errors.push({
        code: 'MISSING_REQUIRED',
        message: `Required parameter '${paramName}' is missing`,
        parameter: paramName,
      });
      continue;
    }

    // Skip validation if value not provided and not required
    if (value === undefined) {
      continue;
    }

    // null is treated as invalid type (present but wrong type)
    if (value === null) {
      errors.push({
        code: 'INVALID_TYPE',
        message: `Parameter '${paramName}' cannot be null`,
        parameter: paramName,
        value,
        expected: optionSchema.type,
      });
      continue;
    }

    // Validate type
    const validation = validateValue(value, optionSchema);
    if (!validation.valid) {
      errors.push({
        code: validation.error!.code,
        message: validation.error!.message,
        parameter: paramName,
        value,
        expected: validation.error!.expected,
      });
    } else {
      normalizedArgs[paramName] = validation.normalizedValue;
    }
  }

  // Check for unknown parameters (warn but don't error)
  for (const paramName of Object.keys(args)) {
    if (!seenParams.has(paramName)) {
      warnings.push({
        code: 'EXTRA_PARAMETER',
        message: `Unknown parameter '${paramName}'`,
        parameter: paramName,
      });
      // Still include in normalized args
      normalizedArgs[paramName] = args[paramName];
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedArgs: errors.length === 0 ? normalizedArgs : undefined,
  };
}

/**
 * Validate a single value against a schema.
 */
function validateValue(
  value: unknown,
  schema: any
): {
  valid: boolean;
  normalizedValue?: unknown;
  error?: { code: ValidationErrorCode; message: string; expected?: string };
} {
  const type = schema.type;

  // Handle enum validation
  if (type === 'enum' || schema.enum) {
    if (!schema.enum.includes(value)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_ENUM',
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          expected: schema.enum.join(', '),
        },
      };
    }
    return { valid: true, normalizedValue: value };
  }

  // Handle array type
  if (type === 'array') {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Expected array',
          expected: 'array',
        },
      };
    }
    return { valid: true, normalizedValue: value };
  }

  // Handle string type
  if (type === 'string') {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Expected string',
          expected: 'string',
        },
      };
    }
    return { valid: true, normalizedValue: value };
  }

  // Handle integer type (with coercion)
  if (type === 'integer') {
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        return {
          valid: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Expected integer',
            expected: 'integer',
          },
        };
      }
      return { valid: true, normalizedValue: value };
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed.toString() !== value) {
        return {
          valid: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Expected integer',
            expected: 'integer',
          },
        };
      }
      return { valid: true, normalizedValue: parsed };
    }
    return {
      valid: false,
      error: {
        code: 'INVALID_TYPE',
        message: 'Expected integer',
        expected: 'integer',
      },
    };
  }

  // Handle number type (with coercion)
  if (type === 'number') {
    if (typeof value === 'number') {
      return { valid: true, normalizedValue: value };
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        return {
          valid: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Expected number',
            expected: 'number',
          },
        };
      }
      return { valid: true, normalizedValue: parsed };
    }
    return {
      valid: false,
      error: {
        code: 'INVALID_TYPE',
        message: 'Expected number',
        expected: 'number',
      },
    };
  }

  // Handle boolean type (with coercion)
  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return { valid: true, normalizedValue: value };
    }
    if (typeof value === 'string') {
      if (value === 'true') {
        return { valid: true, normalizedValue: true };
      }
      if (value === 'false') {
        return { valid: true, normalizedValue: false };
      }
    }
    return {
      valid: false,
      error: {
        code: 'INVALID_TYPE',
        message: 'Expected boolean',
        expected: 'boolean',
      },
    };
  }

  // Unknown type - accept as-is
  return { valid: true, normalizedValue: value };
}
