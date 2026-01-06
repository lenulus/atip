import { describe, test, expect } from 'vitest';
import { toOpenAI, OPENAI_DESCRIPTION_MAX_LENGTH } from '../../../src/index';
import type { AtipTool } from '../../../src/index';

describe('toOpenAI', () => {
  describe('basic transformation', () => {
    test('should transform minimal ATIP tool to OpenAI format', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'greet',
        version: '1.0.0',
        description: 'A greeting tool',
        commands: {
          hello: {
            description: 'Say hello to someone',
            arguments: [
              {
                name: 'name',
                type: 'string',
                description: 'Name to greet',
                required: true,
              },
            ],
            effects: {
              idempotent: true,
              network: false,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'greet_hello',
          description: 'Say hello to someone',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name to greet',
              },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      });
    });

    test('should flatten nested subcommands with underscores', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          pr: {
            description: 'Pull requests',
            commands: {
              create: {
                description: 'Create a PR',
                effects: { network: true },
              },
              list: {
                description: 'List PRs',
                effects: { network: true },
              },
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe('gh_pr_create');
      expect(result[1].function.name).toBe('gh_pr_list');
    });

    test('should return empty array when no commands defined', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'empty',
        version: '1.0.0',
        description: 'Empty tool',
      };

      const result = toOpenAI(tool);

      expect(result).toEqual([]);
    });
  });

  describe('safety suffix generation', () => {
    test('should add DESTRUCTIVE flag when destructive is true', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'rm',
        version: '1.0.0',
        description: 'Remove files',
        commands: {
          delete: {
            description: 'Delete a file',
            effects: {
              destructive: true,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toContain('⚠️ DESTRUCTIVE');
    });

    test('should add NOT REVERSIBLE flag when reversible is false', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'deploy',
        version: '1.0.0',
        description: 'Deploy app',
        commands: {
          run: {
            description: 'Run deployment',
            effects: {
              reversible: false,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toContain('⚠️ NOT REVERSIBLE');
    });

    test('should add NOT IDEMPOTENT flag when idempotent is false', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'create',
        version: '1.0.0',
        description: 'Create resource',
        commands: {
          run: {
            description: 'Create a resource',
            effects: {
              idempotent: false,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toContain('⚠️ NOT IDEMPOTENT');
    });

    test('should add BILLABLE flag when cost is billable', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'api',
        version: '1.0.0',
        description: 'API call',
        commands: {
          call: {
            description: 'Make API call',
            effects: {
              cost: {
                billable: true,
              },
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toContain('💰 BILLABLE');
    });

    test('should add READ-ONLY flag when no write operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'list',
        version: '1.0.0',
        description: 'List items',
        commands: {
          run: {
            description: 'List all items',
            effects: {
              filesystem: {
                read: true,
                write: false,
              },
              network: false,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toContain('🔒 READ-ONLY');
    });

    test('should combine multiple safety flags with pipe separator', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'dangerous',
        version: '1.0.0',
        description: 'Dangerous operation',
        commands: {
          run: {
            description: 'Dangerous command',
            effects: {
              destructive: true,
              reversible: false,
              idempotent: false,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      const desc = result[0].function.description;
      expect(desc).toContain('[');
      expect(desc).toContain(']');
      expect(desc).toContain('⚠️ DESTRUCTIVE');
      expect(desc).toContain('⚠️ NOT REVERSIBLE');
      expect(desc).toContain('⚠️ NOT IDEMPOTENT');
      expect(desc).toContain('|');
    });
  });

  describe('strict mode', () => {
    test('should set strict: true when strict mode enabled', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test tool',
        commands: {
          run: {
            description: 'Run test',
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool, { strict: true });

      expect(result[0].function.strict).toBe(true);
    });

    test('should transform optional parameters to nullable types in strict mode', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test tool',
        commands: {
          run: {
            description: 'Run test',
            options: [
              {
                name: 'verbose',
                flags: ['-v', '--verbose'],
                type: 'boolean',
                description: 'Verbose output',
                required: false,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool, { strict: true });

      expect(result[0].function.parameters.properties.verbose.type).toEqual([
        'boolean',
        'null',
      ]);
    });

    test('should add all parameters to required array in strict mode', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test tool',
        commands: {
          run: {
            description: 'Run test',
            options: [
              {
                name: 'output',
                flags: ['-o', '--output'],
                type: 'string',
                description: 'Output file',
                required: false,
              },
              {
                name: 'format',
                flags: ['-f', '--format'],
                type: 'string',
                description: 'Output format',
                required: true,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool, { strict: true });

      expect(result[0].function.parameters.required).toEqual([
        'output',
        'format',
      ]);
    });

    test('should not set strict or use nullable types in non-strict mode', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test tool',
        commands: {
          run: {
            description: 'Run test',
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

      const result = toOpenAI(tool);

      expect(result[0].function.strict).toBeUndefined();
      expect(result[0].function.parameters.properties.verbose.type).toBe(
        'boolean'
      );
      expect(result[0].function.parameters.required).toEqual([]);
    });
  });

  describe('description truncation', () => {
    test('should truncate descriptions exceeding 1024 characters', () => {
      const longDesc = 'A'.repeat(1100);
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

      const result = toOpenAI(tool);

      expect(result[0].function.description.length).toBeLessThanOrEqual(
        OPENAI_DESCRIPTION_MAX_LENGTH
      );
      expect(result[0].function.description).toMatch(/\.\.\.$/);
    });

    test('should preserve safety suffix when truncating', () => {
      const longDesc = 'A'.repeat(1100);
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: longDesc,
            effects: {
              destructive: true,
            },
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toContain('⚠️ DESTRUCTIVE');
      expect(result[0].function.description.length).toBeLessThanOrEqual(
        OPENAI_DESCRIPTION_MAX_LENGTH
      );
    });

    test('should not truncate descriptions under 1024 characters', () => {
      const normalDesc = 'This is a normal length description';
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: normalDesc,
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.description).toBe(normalDesc);
    });
  });

  describe('type coercion', () => {
    test('should coerce file type to string with hint', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Process file',
            arguments: [
              {
                name: 'input',
                type: 'file',
                description: 'Input file',
                required: true,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.properties.input.type).toBe(
        'string'
      );
      expect(result[0].function.parameters.properties.input.description).toBe(
        'Input file (file path)'
      );
    });

    test('should coerce directory type to string with hint', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Process directory',
            arguments: [
              {
                name: 'output',
                type: 'directory',
                description: 'Output directory',
                required: true,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.properties.output.type).toBe(
        'string'
      );
      expect(result[0].function.parameters.properties.output.description).toBe(
        'Output directory (directory path)'
      );
    });

    test('should coerce url type to string with hint', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Fetch URL',
            options: [
              {
                name: 'url',
                flags: ['-u', '--url'],
                type: 'url',
                description: 'Remote URL',
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.properties.url.type).toBe('string');
      expect(result[0].function.parameters.properties.url.description).toBe(
        'Remote URL (URL)'
      );
    });

    test('should preserve enum types', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run test',
            options: [
              {
                name: 'env',
                flags: ['-e', '--env'],
                type: 'enum',
                enum: ['dev', 'staging', 'prod'],
                description: 'Environment',
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.properties.env.enum).toEqual([
        'dev',
        'staging',
        'prod',
      ]);
    });
  });

  describe('parameter transformation', () => {
    test('should merge arguments and options into properties', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run command',
            arguments: [
              {
                name: 'target',
                type: 'string',
                description: 'Target',
                required: true,
              },
            ],
            options: [
              {
                name: 'verbose',
                flags: ['-v'],
                type: 'boolean',
                description: 'Verbose',
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.properties).toHaveProperty('target');
      expect(result[0].function.parameters.properties).toHaveProperty(
        'verbose'
      );
    });

    test('should handle required arguments correctly', () => {
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
                name: 'arg1',
                type: 'string',
                description: 'First arg',
                required: true,
              },
              {
                name: 'arg2',
                type: 'string',
                description: 'Second arg',
                required: false,
              },
            ],
            effects: {},
          },
        },
      };

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.required).toContain('arg1');
      expect(result[0].function.parameters.required).not.toContain('arg2');
    });

    test('should set additionalProperties to false', () => {
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

      const result = toOpenAI(tool);

      expect(result[0].function.parameters.additionalProperties).toBe(false);
    });
  });

  describe('legacy ATIP version support', () => {
    test('should accept legacy string version format', () => {
      const tool = {
        atip: '0.3',
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: {},
          },
        },
      } as AtipTool;

      const result = toOpenAI(tool);

      expect(result).toHaveLength(1);
      expect(result[0].function.name).toBe('test_run');
    });

    test('should accept current object version format', () => {
      const tool: AtipTool = {
        atip: {
          version: '0.4',
          features: ['trust-v1'],
        },
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

      const result = toOpenAI(tool);

      expect(result).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('should throw AtipValidationError when name is missing', () => {
      const tool = {
        atip: { version: '0.4' },
        version: '1.0.0',
        description: 'Test',
      } as unknown as AtipTool;

      expect(() => toOpenAI(tool)).toThrow('Missing required field');
    });

    test('should throw AtipValidationError when version is missing', () => {
      const tool = {
        atip: { version: '0.4' },
        name: 'test',
        description: 'Test',
      } as unknown as AtipTool;

      expect(() => toOpenAI(tool)).toThrow('Missing required field');
    });

    test('should throw AtipValidationError when description is missing', () => {
      const tool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
      } as unknown as AtipTool;

      expect(() => toOpenAI(tool)).toThrow('Missing required field');
    });

    test('should throw AtipValidationError when atip version is missing', () => {
      const tool = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
      } as unknown as AtipTool;

      expect(() => toOpenAI(tool)).toThrow('Missing required field');
    });
  });
});
