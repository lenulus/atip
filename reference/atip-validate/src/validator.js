import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ATIP Schema Validator
 * Validates ATIP metadata files against the JSON Schema
 */
export class AtipValidator {
  constructor(schemaPath = null) {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // Add format validators (uri, email, etc.)
    addFormats(this.ajv);

    // Load schema
    const defaultSchemaPath = path.join(__dirname, '../../../schema/0.4.json');
    this.schemaPath = schemaPath || defaultSchemaPath;
    this.schema = JSON.parse(fs.readFileSync(this.schemaPath, 'utf-8'));
    this.validate = this.ajv.compile(this.schema);
  }

  /**
   * Validate a single ATIP metadata file
   * @param {string} filePath - Path to JSON file
   * @returns {ValidationResult}
   */
  validateFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return this.validateData(data, filePath);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          valid: false,
          file: filePath,
          errors: [{
            type: 'parse-error',
            message: `Invalid JSON: ${error.message}`,
          }],
        };
      }
      return {
        valid: false,
        file: filePath,
        errors: [{
          type: 'file-error',
          message: error.message,
        }],
      };
    }
  }

  /**
   * Validate ATIP metadata object
   * @param {object} data - Parsed ATIP metadata
   * @param {string} source - Source identifier (file path, URL, etc.)
   * @returns {ValidationResult}
   */
  validateData(data, source = '<data>') {
    const valid = this.validate(data);

    if (valid) {
      return {
        valid: true,
        file: source,
        data,
      };
    }

    return {
      valid: false,
      file: source,
      errors: this.validate.errors.map(err => this.formatError(err, data)),
    };
  }

  /**
   * Validate multiple files
   * @param {string[]} filePaths - Array of file paths
   * @returns {ValidationResult[]}
   */
  validateFiles(filePaths) {
    return filePaths.map(filePath => this.validateFile(filePath));
  }

  /**
   * Validate all JSON files in a directory
   * @param {string} dirPath - Directory path
   * @param {boolean} recursive - Recursively scan subdirectories
   * @returns {ValidationResult[]}
   */
  validateDirectory(dirPath, recursive = false) {
    const files = this.findJsonFiles(dirPath, recursive);
    return this.validateFiles(files);
  }

  /**
   * Find all .json files in directory
   * @param {string} dirPath - Directory path
   * @param {boolean} recursive - Recursively scan subdirectories
   * @returns {string[]}
   */
  findJsonFiles(dirPath, recursive = false) {
    const results = [];

    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && recursive) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          results.push(fullPath);
        }
      }
    };

    scanDir(dirPath);
    return results;
  }

  /**
   * Format AJV error for human readability
   * @param {object} error - AJV error object
   * @param {object} data - Original data
   * @returns {FormattedError}
   */
  formatError(error, data) {
    const { instancePath, keyword, message, params } = error;

    let formatted = {
      type: 'schema-error',
      path: instancePath || '/',
      keyword,
      message,
      params,
    };

    // Add more context for specific error types
    if (keyword === 'required') {
      formatted.message = `Missing required field: ${params.missingProperty}`;
    } else if (keyword === 'enum') {
      formatted.message = `Invalid value. Allowed: ${params.allowedValues.join(', ')}`;
    } else if (keyword === 'type') {
      formatted.message = `Expected type ${params.type}, got ${typeof this.getValueAtPath(data, instancePath)}`;
    } else if (keyword === 'additionalProperties') {
      formatted.message = `Unexpected property: ${params.additionalProperty}`;
    }

    return formatted;
  }

  /**
   * Get value at JSON path
   * @param {object} obj - Object to traverse
   * @param {string} path - JSON pointer path
   * @returns {any}
   */
  getValueAtPath(obj, path) {
    if (!path || path === '/') return obj;

    const parts = path.split('/').filter(Boolean);
    let current = obj;

    for (const part of parts) {
      current = current?.[part];
    }

    return current;
  }
}

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} file - File path or source identifier
 * @property {object} [data] - Parsed data (if valid)
 * @property {FormattedError[]} [errors] - Array of errors (if invalid)
 */

/**
 * @typedef {Object} FormattedError
 * @property {string} type - Error type (schema-error, parse-error, file-error)
 * @property {string} [path] - JSON path where error occurred
 * @property {string} [keyword] - AJV keyword that failed
 * @property {string} message - Human-readable error message
 * @property {object} [params] - Additional error parameters
 */
