import { describe, test, expect } from 'vitest';
import { toGemini } from '../../../src/index';
import type { AtipTool } from '../../../src/index';

describe('toGemini', () => {
  describe('basic transformation', () => {
    test('should transform minimal ATIP tool to Gemini format', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'greet',
        version: '1.0.0',
        description: 'A greeting tool',
        commands: {
          hello: {
            description: 'Say hello',
            arguments: [
              {
                name: 'name',
                type: 'string',
                description: 'Name',
                required: true,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'greet_hello',
        description: 'Say hello',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name',
            },
          },
          required: ['name'],
        },
      });
    });

    test('should flatten nested subcommands', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          pr: {
            description: 'Pull requests',
            commands: {
              list: {
                description: 'List PRs',
                effects: { network: true },
              },
            },
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].name).toBe('gh_pr_list');
    });

    test('should not include function wrapper like OpenAI', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0]).not.toHaveProperty('type');
      expect(result[0]).not.toHaveProperty('function');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('parameters');
    });
  });

  describe('safety suffix generation', () => {
    test('should add destructive flag in description', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'rm',
        version: '1.0.0',
        description: 'Remove',
        commands: {
          delete: {
            description: 'Delete file',
            effects: {
              destructive: true,
            },
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].description).toContain('⚠️ DESTRUCTIVE');
    });

    test('should add multiple safety flags with pipe separator', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'deploy',
        version: '1.0.0',
        description: 'Deploy',
        commands: {
          run: {
            description: 'Run deployment',
            effects: {
              destructive: true,
              reversible: false,
            },
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].description).toContain('⚠️ DESTRUCTIVE');
      expect(result[0].description).toContain('⚠️ NOT REVERSIBLE');
      expect(result[0].description).toContain('|');
    });
  });

  describe('parameter transformation', () => {
    test('should only include required parameters in required array', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            arguments: [
              {
                name: 'required_arg',
                type: 'string',
                description: 'Required',
                required: true,
              },
            ],
            options: [
              {
                name: 'optional_flag',
                flags: ['-o'],
                type: 'boolean',
                description: 'Optional',
                required: false,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].parameters.required).toEqual(['required_arg']);
      expect(result[0].parameters.required).not.toContain('optional_flag');
    });

    test('should not transform optional parameters to nullable types', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            options: [
              {
                name: 'verbose',
                flags: ['-v'],
                type: 'boolean',
                description: 'Verbose',
                required: false,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].parameters.properties.verbose.type).toBe('boolean');
      expect(result[0].parameters.properties.verbose.type).not.toEqual([
        'boolean',
        'null',
      ]);
    });

    test('should not have additionalProperties field', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].parameters).not.toHaveProperty('additionalProperties');
    });
  });

  describe('type coercion', () => {
    test('should coerce file type to string', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            arguments: [
              {
                name: 'input',
                type: 'file',
                description: 'Input',
                required: true,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].parameters.properties.input.type).toBe('string');
      expect(result[0].parameters.properties.input.description).toContain(
        '(file path)'
      );
    });

    test('should preserve enum values', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            options: [
              {
                name: 'level',
                flags: ['-l'],
                type: 'enum',
                enum: ['low', 'medium', 'high'],
                description: 'Level',
              },
            ],
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].parameters.properties.level.enum).toEqual([
        'low',
        'medium',
        'high',
      ]);
    });
  });

  describe('description length', () => {
    test('should not truncate long descriptions (no Gemini limit)', () => {
      const longDesc = 'A'.repeat(2000);
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: longDesc,
            effects: {},
          },
        },
      };

      const result = toGemini(tool);

      expect(result[0].description.length).toBeGreaterThan(1024);
      expect(result[0].description).toContain('A'.repeat(100));
    });
  });

  describe('error handling', () => {
    test('should throw AtipValidationError for invalid tool', () => {
      const tool = {
        atip: { version: '0.4' },
        // missing name, version, description
      } as unknown as AtipTool;

      expect(() => toGemini(tool)).toThrow();
    });
  });
});
