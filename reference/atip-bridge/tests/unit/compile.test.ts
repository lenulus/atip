import { describe, test, expect } from 'vitest';
import { compileTools } from '../../src/index';
import type { AtipTool } from '../../src/index';

describe('compileTools', () => {
  const ghTool: AtipTool = {
    atip: { version: '0.6' },
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
          create: {
            description: 'Create PR',
            effects: { network: true, idempotent: false },
          },
        },
      },
    },
  };

  const kubectlTool: AtipTool = {
    atip: { version: '0.6' },
    name: 'kubectl',
    version: '1.28.0',
    description: 'Kubernetes CLI',
    commands: {
      get: {
        description: 'Get resources',
        arguments: [
          {
            name: 'resource',
            type: 'string',
            description: 'Resource type',
            required: true,
          },
        ],
        effects: { network: true, idempotent: true },
      },
    },
  };

  describe('basic compilation', () => {
    test('should compile multiple tools to OpenAI format', () => {
      const result = compileTools([ghTool, kubectlTool], 'openai');

      expect(result.provider).toBe('openai');
      expect(result.tools).toHaveLength(3); // gh_pr_list, gh_pr_create, kubectl_get
    });

    test('should compile to Gemini format', () => {
      const result = compileTools([ghTool], 'gemini');

      expect(result.provider).toBe('gemini');
      expect(result.tools).toHaveLength(2);
    });

    test('should compile to Anthropic format', () => {
      const result = compileTools([ghTool], 'anthropic');

      expect(result.provider).toBe('anthropic');
      expect(result.tools).toHaveLength(2);
    });

    test('should return empty array when no tools provided', () => {
      const result = compileTools([], 'openai');

      expect(result.provider).toBe('openai');
      expect(result.tools).toEqual([]);
    });
  });

  describe('strict mode support', () => {
    test('should pass strict option to OpenAI transformer', () => {
      const result = compileTools([ghTool], 'openai', { strict: true });

      expect(result.tools[0].function.strict).toBe(true);
    });

    test('should ignore strict option for Gemini', () => {
      const result = compileTools([ghTool], 'gemini', { strict: true });

      // Gemini doesn't have strict mode
      expect(result.tools[0]).not.toHaveProperty('strict');
    });

    test('should ignore strict option for Anthropic', () => {
      const result = compileTools([ghTool], 'anthropic', { strict: true });

      // Anthropic doesn't have strict mode
      expect(result.tools[0]).not.toHaveProperty('strict');
    });
  });

  describe('name deduplication', () => {
    test('should handle duplicate tool names (later overrides earlier)', () => {
      const tool1: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'First version',
        commands: {
          run: {
            description: 'First run',
            effects: {},
          },
        },
      };

      const tool2: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '2.0.0',
        description: 'Second version',
        commands: {
          run: {
            description: 'Second run',
            effects: {},
          },
        },
      };

      const result = compileTools([tool1, tool2], 'openai');

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.description).toBe('Second run');
    });
  });

  describe('error handling', () => {
    test('should throw if any tool is invalid', () => {
      const invalidTool = {
        atip: { version: '0.6' },
        name: 'invalid',
        // missing version and description
      } as unknown as AtipTool;

      expect(() => compileTools([ghTool, invalidTool], 'openai')).toThrow();
    });

    test('should throw for all invalid tools', () => {
      const invalidTool1 = {
        atip: { version: '0.6' },
        name: 'invalid1',
      } as unknown as AtipTool;

      const invalidTool2 = {
        atip: { version: '0.6' },
        version: '1.0.0',
      } as unknown as AtipTool;

      expect(() => compileTools([invalidTool1, invalidTool2], 'openai')).toThrow();
    });
  });

  describe('aggregation', () => {
    test('should aggregate tools from different sources', () => {
      const result = compileTools([ghTool, kubectlTool], 'openai');

      const names = result.tools.map((t) => t.function.name);
      expect(names).toContain('gh_pr_list');
      expect(names).toContain('gh_pr_create');
      expect(names).toContain('kubectl_get');
    });

    test('should preserve tool-specific configurations', () => {
      const result = compileTools([ghTool, kubectlTool], 'openai', {
        strict: true,
      });

      // All tools should have strict mode
      result.tools.forEach((tool) => {
        expect(tool.function.strict).toBe(true);
      });
    });
  });
});
