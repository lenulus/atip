import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toOpenAI, toGemini, toAnthropic } from '../../src/index';
import type { AtipTool } from '../../src/index';

describe('Minimal Example Integration', () => {
  let minimalTool: AtipTool;

  test('should load minimal.json example', () => {
    const minimalPath = join(__dirname, '../../../../examples/minimal.json');
    const minimalJson = readFileSync(minimalPath, 'utf-8');
    minimalTool = JSON.parse(minimalJson);

    expect(minimalTool.name).toBe('hello');
    expect(minimalTool.commands).toBeDefined();
  });

  describe('minimal tool transformation', () => {
    test('should compile minimal.json to OpenAI format', () => {
      const result = toOpenAI(minimalTool);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('function');
      expect(result[0].function.name).toBe('hello_');
      expect(result[0].function.description).toBe('Say hello');
      expect(result[0].function.parameters.properties).toHaveProperty('name');
      expect(result[0].function.parameters.required).toContain('name');
    });

    test('should compile minimal.json to Gemini format', () => {
      const result = toGemini(minimalTool);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('hello_');
      expect(result[0].description).toBe('Say hello');
      expect(result[0].parameters.properties).toHaveProperty('name');
    });

    test('should compile minimal.json to Anthropic format', () => {
      const result = toAnthropic(minimalTool);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('hello_');
      expect(result[0].description).toBe('Say hello');
      expect(result[0].input_schema.properties).toHaveProperty('name');
    });
  });

  describe('minimal tool safety', () => {
    test('should recognize minimal as safe (no warnings)', () => {
      const result = toOpenAI(minimalTool);

      // No destructive flags
      expect(result[0].function.description).not.toContain('⚠️ DESTRUCTIVE');
      expect(result[0].function.description).not.toContain('⚠️ NOT REVERSIBLE');

      // Should NOT have READ-ONLY flag because filesystem.write is not explicitly false
      // An empty filesystem object {} means "unspecified", not "read-only"
      // READ-ONLY requires: network === false AND filesystem.write === false (explicit)
      expect(result[0].function.description).not.toContain('🔒 READ-ONLY');
    });
  });

  describe('empty command name handling', () => {
    test('should handle empty string command name correctly', () => {
      // minimal.json has commands: { "": { ... } }
      const result = toOpenAI(minimalTool);

      // Empty command should be flattened to just tool name + _
      expect(result[0].function.name).toBe('hello_');
    });
  });

  describe('parameter handling', () => {
    test('should correctly transform required argument', () => {
      const result = toOpenAI(minimalTool);

      const params = result[0].function.parameters;
      expect(params.properties.name).toEqual({
        type: 'string',
        description: 'Name to greet',
      });
      expect(params.required).toEqual(['name']);
    });

    test('should handle argument with required: true', () => {
      const result = toGemini(minimalTool);

      expect(result[0].parameters.required).toContain('name');
    });
  });
});
