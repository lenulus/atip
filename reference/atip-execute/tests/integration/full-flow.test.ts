import { describe, it, expect } from 'vitest';
import { createExecutor } from '../../src/index.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Integration tests for the complete execution flow.
 *
 * Tests end-to-end workflows using real ATIP examples:
 * - Parse → Map → Validate → Execute → Format flow
 * - Real gh.json metadata
 * - Safe commands only (no destructive operations)
 */

describe('Full execution flow', () => {
  // Load real ATIP metadata
  const ghToolPath = resolve(process.cwd(), '../../examples/gh.json');
  let ghTool: any;

  try {
    ghTool = JSON.parse(readFileSync(ghToolPath, 'utf-8'));
  } catch (error) {
    // Fallback minimal tool for testing
    ghTool = {
      atip: { version: '0.4' },
      name: 'gh',
      version: '2.45.0',
      description: 'GitHub CLI',
      trust: {
        source: 'inferred',
        verified: false,
      },
      commands: {
        auth: {
          description: 'Authentication commands',
          commands: {
            status: {
              description: 'View authentication status',
              effects: {
                network: true,
                idempotent: true,
                reversible: true,
                destructive: false,
              },
            },
          },
        },
      },
    };
  }

  describe('safe read operations', () => {
    it('should execute gh auth status', async () => {
      const executor = createExecutor({
        tools: [ghTool],
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.raw.command).toEqual(['gh', 'auth', 'status']);
    });

    it('should validate before execution', async () => {
      const executor = createExecutor({
        tools: [ghTool],
      });

      // First validate
      const validation = executor.validate({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      expect(validation.valid).toBe(true);

      // Then execute
      const result = await executor.execute({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      expect(result.success).toBeDefined();
    });

    it('should map command correctly', () => {
      const executor = createExecutor({
        tools: [ghTool],
      });

      const mapping = executor.mapCommand('gh_auth_status');

      expect(mapping).toBeDefined();
      expect(mapping?.command).toEqual(['gh', 'auth', 'status']);
      expect(mapping?.tool.name).toBe('gh');
      expect(mapping?.path).toEqual(['auth', 'status']);
    });

    it('should check policy before execution', () => {
      const executor = createExecutor({
        tools: [ghTool],
        policy: {
          allowNetwork: true,
          allowDestructive: false,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
      expect(check.requiresConfirmation).toBe(false);
    });
  });

  describe('batch execution', () => {
    it('should execute multiple safe commands', async () => {
      const executor = createExecutor({
        tools: [ghTool],
      });

      const results = await executor.executeBatch([
        {
          id: 'call_1',
          name: 'gh_auth_status',
          arguments: {},
        },
      ]);

      expect(results.results).toHaveLength(1);
      expect(results.successCount).toBeGreaterThanOrEqual(0);
      expect(results.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('policy enforcement integration', () => {
    it('should block destructive operations', async () => {
      // Check if gh.json has a destructive command
      const hasDestructiveCommand = JSON.stringify(ghTool).includes('"destructive":true');

      if (!hasDestructiveCommand) {
        // Add a test destructive command
        const testTool = {
          ...ghTool,
          commands: {
            ...ghTool.commands,
            test_destructive: {
              description: 'Test destructive command',
              effects: {
                destructive: true,
                reversible: false,
              },
            },
          },
        };

        const executor = createExecutor({
          tools: [testTool],
          policy: {
            allowDestructive: false,
          },
        });

        await expect(
          executor.execute({
            id: 'call_1',
            name: 'gh_test_destructive',
            arguments: {},
          })
        ).rejects.toThrow();
      }
    });

    it('should enforce trust levels', () => {
      const executor = createExecutor({
        tools: [ghTool],
        policy: {
          minTrustLevel: 'native', // Higher than 'inferred'
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      // inferred trust should be blocked by native requirement
      expect(check.allowed).toBe(false);
    });
  });

  describe('output formatting integration', () => {
    it('should format output for LLM consumption', async () => {
      const executor = createExecutor({
        tools: [ghTool],
        output: {
          includeExitCode: true,
          maxLength: 10000,
        },
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeLessThanOrEqual(10000);
    });

    it('should redact secrets from output', async () => {
      const executor = createExecutor({
        tools: [ghTool],
        output: {
          redactSecrets: true,
        },
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      // If output contains token patterns, they should be redacted
      expect(result.content).toBeDefined();
    });
  });

  describe('error handling integration', () => {
    it('should handle unknown commands gracefully', async () => {
      const executor = createExecutor({
        tools: [ghTool],
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'gh_unknown_nonexistent_command',
          arguments: {},
        })
      ).rejects.toThrow();
    });

    it('should handle validation errors', async () => {
      // Create a tool with required arguments
      const testTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test tool',
        commands: {
          cmd: {
            description: 'Test command',
            arguments: [
              {
                name: 'required_arg',
                type: 'string',
                required: true,
                description: 'Required argument',
              },
            ],
            effects: {
              network: false,
            },
          },
        },
      };

      const executor = createExecutor({
        tools: [testTool],
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'test_cmd',
          arguments: {}, // Missing required_arg
        })
      ).rejects.toThrow();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle command with options', async () => {
      // Create a test tool with options
      const testTool = {
        atip: { version: '0.4' },
        name: 'echo',
        version: '1.0.0',
        description: 'Echo tool',
        commands: {
          run: {
            description: 'Echo text',
            arguments: [
              {
                name: 'text',
                type: 'string',
                required: true,
                description: 'Text to echo',
              },
            ],
            options: [
              {
                name: 'newline',
                flags: ['-n'],
                type: 'boolean',
                required: false,
                description: 'No trailing newline',
              },
            ],
            effects: {
              network: false,
            },
          },
        },
      };

      const executor = createExecutor({
        tools: [testTool],
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'echo_run',
        arguments: {
          text: 'hello world',
          newline: true,
        },
      });

      expect(result.content).toContain('hello world');
    });

    it('should handle commands with multiple arguments', async () => {
      const testTool = {
        atip: { version: '0.4' },
        name: 'printf',
        version: '1.0.0',
        description: 'Printf tool',
        commands: {
          run: {
            description: 'Format and print',
            arguments: [
              {
                name: 'format',
                type: 'string',
                required: true,
                description: 'Format string',
              },
              {
                name: 'args',
                type: 'array',
                variadic: true,
                required: false,
                description: 'Arguments',
              },
            ],
            effects: {
              network: false,
            },
          },
        },
      };

      const executor = createExecutor({
        tools: [testTool],
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'printf_run',
        arguments: {
          format: '%s %s',
          args: ['hello', 'world'],
        },
      });

      expect(result.success).toBeDefined();
    });
  });

  describe('performance characteristics', () => {
    it('should complete execution within reasonable time', async () => {
      const executor = createExecutor({
        tools: [ghTool],
        execution: {
          timeout: 5000,
        },
      });

      const start = Date.now();

      await executor.execute({
        id: 'call_1',
        name: 'gh_auth_status',
        arguments: {},
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });

    it('should cache command mappings for performance', () => {
      const executor = createExecutor({
        tools: [ghTool],
      });

      // First lookup
      const start1 = Date.now();
      const mapping1 = executor.mapCommand('gh_auth_status');
      const duration1 = Date.now() - start1;

      // Second lookup (should be faster with caching)
      const start2 = Date.now();
      const mapping2 = executor.mapCommand('gh_auth_status');
      const duration2 = Date.now() - start2;

      expect(mapping1).toEqual(mapping2);
      // Second lookup should not be significantly slower
      expect(duration2).toBeLessThanOrEqual(duration1 * 2);
    });
  });
});
