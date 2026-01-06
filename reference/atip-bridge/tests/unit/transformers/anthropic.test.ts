import { describe, test, expect } from 'vitest';
import { toAnthropic } from '../../../src/index';
import type { AtipTool } from '../../../src/index';

describe('toAnthropic', () => {
  describe('basic transformation', () => {
    test('should transform minimal ATIP tool to Anthropic format', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'greet',
        version: '1.0.0',
        description: 'Greeting tool',
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

      const result = toAnthropic(tool);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'greet_hello',
        description: 'Say hello',
        input_schema: {
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

    test('should use input_schema instead of parameters', () => {
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

      const result = toAnthropic(tool);

      expect(result[0]).toHaveProperty('input_schema');
      expect(result[0]).not.toHaveProperty('parameters');
    });

    test('should flatten nested subcommands', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          repo: {
            description: 'Repositories',
            commands: {
              delete: {
                description: 'Delete repository',
                effects: {
                  destructive: true,
                },
              },
            },
          },
        },
      };

      const result = toAnthropic(tool);

      expect(result[0].name).toBe('gh_repo_delete');
    });
  });

  describe('safety suffix generation', () => {
    test('should add destructive and not reversible flags', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          repo: {
            description: 'Repositories',
            commands: {
              delete: {
                description: 'Delete a repository permanently',
                effects: {
                  network: true,
                  destructive: true,
                  reversible: false,
                },
              },
            },
          },
        },
      };

      const result = toAnthropic(tool);

      expect(result[0].description).toContain('⚠️ DESTRUCTIVE');
      expect(result[0].description).toContain('⚠️ NOT REVERSIBLE');
    });

    test('should combine multiple flags', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: {
              destructive: true,
              reversible: false,
              idempotent: false,
              cost: {
                billable: true,
              },
            },
          },
        },
      };

      const result = toAnthropic(tool);

      const desc = result[0].description;
      expect(desc).toContain('[');
      expect(desc).toContain(']');
      expect(desc).toContain('⚠️ DESTRUCTIVE');
      expect(desc).toContain('⚠️ NOT REVERSIBLE');
      expect(desc).toContain('⚠️ NOT IDEMPOTENT');
      expect(desc).toContain('💰 BILLABLE');
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
                name: 'target',
                type: 'string',
                description: 'Target',
                required: true,
              },
              {
                name: 'source',
                type: 'string',
                description: 'Source',
                required: false,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toAnthropic(tool);

      expect(result[0].input_schema.required).toEqual(['target']);
      expect(result[0].input_schema.required).not.toContain('source');
    });

    test('should not transform to nullable types', () => {
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

      const result = toAnthropic(tool);

      expect(result[0].input_schema.properties.verbose.type).toBe('boolean');
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

      const result = toAnthropic(tool);

      expect(result[0].input_schema).not.toHaveProperty(
        'additionalProperties'
      );
    });
  });

  describe('type coercion', () => {
    test('should coerce file, directory, url types to string', () => {
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
                name: 'file',
                type: 'file',
                description: 'File',
                required: true,
              },
              {
                name: 'dir',
                type: 'directory',
                description: 'Directory',
                required: true,
              },
            ],
            options: [
              {
                name: 'url',
                flags: ['-u'],
                type: 'url',
                description: 'URL',
              },
            ],
            effects: {},
          },
        },
      };

      const result = toAnthropic(tool);

      expect(result[0].input_schema.properties.file.type).toBe('string');
      expect(result[0].input_schema.properties.dir.type).toBe('string');
      expect(result[0].input_schema.properties.url.type).toBe('string');
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
                name: 'env',
                flags: ['-e'],
                type: 'enum',
                enum: ['dev', 'staging', 'prod'],
                description: 'Environment',
              },
            ],
            effects: {},
          },
        },
      };

      const result = toAnthropic(tool);

      expect(result[0].input_schema.properties.env.enum).toEqual([
        'dev',
        'staging',
        'prod',
      ]);
    });
  });

  describe('error handling', () => {
    test('should throw AtipValidationError for missing required fields', () => {
      const tool = {
        atip: { version: '0.4' },
        name: 'test',
        // missing version and description
      } as unknown as AtipTool;

      expect(() => toAnthropic(tool)).toThrow();
    });
  });
});
