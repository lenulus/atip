import { describe, it, expect } from 'vitest';
import { validateToolCall, mapToCommand } from '../../src/index.js';

/**
 * Unit tests for argument validation.
 *
 * Tests validation of tool call arguments against ATIP schemas:
 * - Required parameter checking
 * - Type validation (string, integer, boolean, enum)
 * - Type coercion (safe conversions)
 * - Unknown parameter warnings
 */

describe('validateToolCall', () => {
  const tool = {
    atip: { version: '0.4' },
    name: 'api',
    version: '1.0.0',
    description: 'API tool',
    commands: {
      request: {
        description: 'Make API request',
        arguments: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'URL to request',
          },
          {
            name: 'method',
            type: 'enum',
            enum: ['GET', 'POST', 'PUT', 'DELETE'],
            required: false,
            description: 'HTTP method',
          },
        ],
        options: [
          {
            name: 'port',
            flags: ['-p', '--port'],
            type: 'integer',
            required: false,
            description: 'Port number',
          },
          {
            name: 'timeout',
            flags: ['-t', '--timeout'],
            type: 'number',
            required: false,
            description: 'Timeout in seconds',
          },
          {
            name: 'verbose',
            flags: ['-v', '--verbose'],
            type: 'boolean',
            required: false,
            description: 'Verbose output',
          },
          {
            name: 'headers',
            flags: ['-H', '--header'],
            type: 'array',
            variadic: true,
            required: false,
            description: 'HTTP headers',
          },
        ],
        effects: {
          network: true,
        },
      },
    },
  };

  const mapping = mapToCommand('api_request', [tool]);

  describe('required parameters', () => {
    it('should pass validation with all required parameters', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com' },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when required parameter is missing', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: {},
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_REQUIRED');
      expect(result.errors[0].parameter).toBe('url');
      expect(result.errors[0].message).toContain('url');
    });

    it('should fail with multiple missing required parameters', () => {
      const strictTool = {
        atip: { version: '0.4' },
        name: 'strict',
        version: '1.0.0',
        description: 'Strict tool',
        commands: {
          cmd: {
            description: 'Command',
            arguments: [
              { name: 'arg1', type: 'string', required: true },
              { name: 'arg2', type: 'string', required: true },
            ],
            effects: {},
          },
        },
      };

      const strictMapping = mapToCommand('strict_cmd', [strictTool]);
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'strict_cmd',
          arguments: {},
        },
        strictMapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.map((e) => e.parameter)).toContain('arg1');
      expect(result.errors.map((e) => e.parameter)).toContain('arg2');
    });
  });

  describe('type validation', () => {
    it('should validate string type', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com' },
        },
        mapping
      );

      expect(result.valid).toBe(true);
    });

    it('should reject non-string for string type', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 12345 },
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
      expect(result.errors[0].parameter).toBe('url');
      expect(result.errors[0].expected).toBe('string');
    });

    it('should validate integer type', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', port: 8080 },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.port).toBe(8080);
    });

    it('should validate number type', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', timeout: 30.5 },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.timeout).toBe(30.5);
    });

    it('should validate boolean type', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', verbose: true },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.verbose).toBe(true);
    });

    it('should validate array type', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: {
            url: 'https://example.com',
            headers: ['Accept: application/json', 'Authorization: Bearer token'],
          },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.headers).toHaveLength(2);
    });
  });

  describe('enum validation', () => {
    it('should accept valid enum value', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', method: 'POST' },
        },
        mapping
      );

      expect(result.valid).toBe(true);
    });

    it('should reject invalid enum value', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', method: 'INVALID' },
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ENUM');
      expect(result.errors[0].parameter).toBe('method');
      expect(result.errors[0].expected).toContain('GET');
    });

    it('should be case-sensitive for enum values', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', method: 'get' },
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ENUM');
    });
  });

  describe('type coercion', () => {
    it('should coerce string to integer', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', port: '8080' },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.port).toBe(8080);
      expect(typeof result.normalizedArgs?.port).toBe('number');
    });

    it('should coerce string to number', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', timeout: '30.5' },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.timeout).toBe(30.5);
    });

    it('should coerce string to boolean', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', verbose: 'true' },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs?.verbose).toBe(true);

      const result2 = validateToolCall(
        {
          id: 'call_2',
          name: 'api_request',
          arguments: { url: 'https://example.com', verbose: 'false' },
        },
        mapping
      );

      expect(result2.valid).toBe(true);
      expect(result2.normalizedArgs?.verbose).toBe(false);
    });

    it('should reject invalid coercion attempts', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: 'https://example.com', port: 'not-a-number' },
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });
  });

  describe('unknown parameters', () => {
    it('should warn about unknown parameters', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: {
            url: 'https://example.com',
            unknownParam: 'value',
          },
        },
        mapping
      );

      expect(result.valid).toBe(true); // Still valid
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('EXTRA_PARAMETER');
      expect(result.warnings[0].parameter).toBe('unknownParam');
    });

    it('should warn about multiple unknown parameters', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: {
            url: 'https://example.com',
            unknown1: 'value1',
            unknown2: 'value2',
          },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('normalized arguments', () => {
    it('should return normalized arguments when valid', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: {
            url: 'https://example.com',
            port: '8080',
            verbose: 'true',
          },
        },
        mapping
      );

      expect(result.valid).toBe(true);
      expect(result.normalizedArgs).toBeDefined();
      expect(result.normalizedArgs?.url).toBe('https://example.com');
      expect(result.normalizedArgs?.port).toBe(8080);
      expect(result.normalizedArgs?.verbose).toBe(true);
    });

    it('should not return normalized arguments when invalid', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: {},
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.normalizedArgs).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null values', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: null },
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should handle undefined values', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: undefined },
        },
        mapping
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_REQUIRED');
    });

    it('should handle empty string for required parameter', () => {
      const result = validateToolCall(
        {
          id: 'call_1',
          name: 'api_request',
          arguments: { url: '' },
        },
        mapping
      );

      // Empty string is still a string, should be valid
      expect(result.valid).toBe(true);
    });
  });
});
