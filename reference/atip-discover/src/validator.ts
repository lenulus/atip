/**
 * ATIP metadata validation
 */

import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import type { ValidationResult, ValidationError } from './types';

// Load the ATIP schema
const schemaPath = path.join(__dirname, '../../../schema/0.4.json');
let schema: unknown;

try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
} catch (error) {
  // Fallback: try relative to project root
  const fallbackPath = path.join(process.cwd(), 'schema', '0.4.json');
  try {
    schema = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
  } catch {
    // If schema can't be loaded, we'll create a minimal validator
    schema = null;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
let validateFn: ReturnType<typeof ajv.compile> | null = null;

if (schema) {
  validateFn = ajv.compile(schema);
}

/**
 * Validate ATIP metadata against the schema.
 *
 * @param metadata - Parsed JSON to validate
 * @returns Validation result with errors if invalid
 */
export function validateMetadata(metadata: unknown): ValidationResult {
  // If we couldn't load the schema, do minimal validation
  if (!validateFn) {
    return validateMinimal(metadata);
  }

  const valid = validateFn(metadata);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validateFn.errors || []).map((err) => ({
    path: err.instancePath
      ? err.instancePath.split('/').filter((p) => p)
      : err.params?.missingProperty
      ? [err.params.missingProperty]
      : [],
    message: err.message || 'Validation error',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Minimal validation when schema is not available
 */
function validateMinimal(metadata: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof metadata !== 'object' || metadata === null) {
    errors.push({
      path: [],
      message: 'Metadata must be an object',
    });
    return { valid: false, errors };
  }

  const obj = metadata as Record<string, unknown>;

  // Check required fields
  if (!obj.atip) {
    errors.push({
      path: ['atip'],
      message: 'Required property missing',
    });
  }
  if (!obj.name) {
    errors.push({
      path: ['name'],
      message: 'Required property missing',
    });
  }
  if (!obj.version) {
    errors.push({
      path: ['version'],
      message: 'Required property missing',
    });
  }
  if (!obj.description) {
    errors.push({
      path: ['description'],
      message: 'Required property missing',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
