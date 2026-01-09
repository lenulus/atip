import { describe, it, expect } from 'vitest';
import { createExecutor, UnknownCommandError } from '../../src/index.js';

/**
 * Unit tests for the Executor class.
 *
 * Tests the high-level executor API:
 * - Executor creation and configuration
 * - execute() method
 * - executeBatch() method
 * - validate() method
 * - checkPolicy() method
 * - mapCommand() method
 */

describe('Executor', () => {
  const tool = {
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
        effects: {
          network: false,
          destructive: false,
        },
      },
    },
  };

  describe('createExecutor', () => {
    it('should create executor with tools', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe('function');
      expect(typeof executor.executeBatch).toBe('function');
      expect(typeof executor.validate).toBe('function');
      expect(typeof executor.checkPolicy).toBe('function');
      expect(typeof executor.mapCommand).toBe('function');
    });

    it('should accept policy configuration', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
          minTrustLevel: 'vendor',
        },
      });

      expect(executor).toBeDefined();
    });

    it('should accept execution options', () => {
      const executor = createExecutor({
        tools: [tool],
        execution: {
          timeout: 60000,
          maxOutputSize: 2000000,
          cwd: '/tmp',
        },
      });

      expect(executor).toBeDefined();
    });

    it('should accept output options', () => {
      const executor = createExecutor({
        tools: [tool],
        output: {
          maxLength: 50000,
          redactSecrets: true,
          includeExitCode: true,
        },
      });

      expect(executor).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute a tool call', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'echo_run',
        arguments: { text: 'hello' },
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('hello');
      expect(result.raw.exitCode).toBe(0);
    });

    it('should throw UnknownCommandError for unknown commands', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'unknown_command',
          arguments: {},
        })
      ).rejects.toThrow(UnknownCommandError);
    });

    it('should validate arguments before execution', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'echo_run',
          arguments: {}, // Missing required 'text'
        })
      ).rejects.toThrow();
    });

    it('should enforce policy before execution', async () => {
      const destructiveTool = {
        ...tool,
        commands: {
          delete: {
            description: 'Delete something',
            effects: {
              destructive: true,
              reversible: false,
            },
          },
        },
      };

      const executor = createExecutor({
        tools: [destructiveTool],
        policy: {
          allowDestructive: false,
        },
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'echo_delete',
          arguments: {},
        })
      ).rejects.toThrow();
    });

    it('should apply output formatting', async () => {
      const executor = createExecutor({
        tools: [tool],
        output: {
          includeExitCode: true,
        },
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'echo_run',
        arguments: { text: 'test' },
      });

      expect(result.content).toContain('Exit code:');
    });
  });

  describe('executeBatch', () => {
    it('should execute multiple tool calls sequentially', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const results = await executor.executeBatch(
        [
          { id: 'call_1', name: 'echo_run', arguments: { text: 'first' } },
          { id: 'call_2', name: 'echo_run', arguments: { text: 'second' } },
          { id: 'call_3', name: 'echo_run', arguments: { text: 'third' } },
        ],
        { parallel: false }
      );

      expect(results.results).toHaveLength(3);
      expect(results.successCount).toBe(3);
      expect(results.failureCount).toBe(0);
      expect(results.results[0].content).toContain('first');
      expect(results.results[1].content).toContain('second');
      expect(results.results[2].content).toContain('third');
    });

    it('should execute multiple tool calls in parallel', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const results = await executor.executeBatch(
        [
          { id: 'call_1', name: 'echo_run', arguments: { text: 'first' } },
          { id: 'call_2', name: 'echo_run', arguments: { text: 'second' } },
        ],
        { parallel: true, maxConcurrency: 2 }
      );

      expect(results.results).toHaveLength(2);
      expect(results.successCount).toBe(2);
    });

    it('should continue on error when configured', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const results = await executor.executeBatch(
        [
          { id: 'call_1', name: 'echo_run', arguments: { text: 'valid' } },
          { id: 'call_2', name: 'unknown_cmd', arguments: {} },
          { id: 'call_3', name: 'echo_run', arguments: { text: 'also valid' } },
        ],
        { continueOnError: true }
      );

      expect(results.results).toHaveLength(3);
      expect(results.successCount).toBe(2);
      expect(results.failureCount).toBe(1);
    });

    it('should stop on first error when configured', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const results = await executor.executeBatch(
        [
          { id: 'call_1', name: 'echo_run', arguments: { text: 'valid' } },
          { id: 'call_2', name: 'echo_run', arguments: {} }, // Missing required arg
          { id: 'call_3', name: 'echo_run', arguments: { text: 'never reached' } },
        ],
        { continueOnError: false }
      );

      expect(results.results.length).toBeLessThan(3);
    });

    it('should track total duration', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const results = await executor.executeBatch([
        { id: 'call_1', name: 'echo_run', arguments: { text: 'test' } },
      ]);

      expect(results.totalDuration).toBeGreaterThan(0);
      expect(typeof results.totalDuration).toBe('number');
    });
  });

  describe('validate', () => {
    it('should validate tool call without executing', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const result = executor.validate({
        id: 'call_1',
        name: 'echo_run',
        arguments: { text: 'hello' },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const result = executor.validate({
        id: 'call_1',
        name: 'echo_run',
        arguments: {}, // Missing required 'text'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return normalized arguments when valid', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const result = executor.validate({
        id: 'call_1',
        name: 'echo_run',
        arguments: { text: 'hello' },
      });

      expect(result.normalizedArgs).toEqual({ text: 'hello' });
    });
  });

  describe('checkPolicy', () => {
    it('should check policy without executing', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
        },
      });

      const result = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_run',
        arguments: {},
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect policy violations', () => {
      const destructiveTool = {
        ...tool,
        commands: {
          delete: {
            description: 'Delete something',
            effects: {
              destructive: true,
            },
          },
        },
      };

      const executor = createExecutor({
        tools: [destructiveTool],
        policy: {
          allowDestructive: false,
        },
      });

      const result = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_delete',
        arguments: {},
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.reasons).toContain('destructive');
    });
  });

  describe('mapCommand', () => {
    it('should map flattened tool name to command', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const mapping = executor.mapCommand('echo_run');

      expect(mapping).toBeDefined();
      expect(mapping?.command).toEqual(['echo', 'run']);
      expect(mapping?.tool.name).toBe('echo');
    });

    it('should return undefined for unknown commands', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const mapping = executor.mapCommand('unknown_command');

      expect(mapping).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should get metadata for a tool', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const metadata = executor.getMetadata('echo_run');

      expect(metadata).toBeDefined();
      expect(metadata?.description).toBe('Echo text');
    });

    it('should return undefined for unknown tools', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const metadata = executor.getMetadata('unknown_command');

      expect(metadata).toBeUndefined();
    });
  });

  describe('configuration defaults', () => {
    it('should use default policy when not provided', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      // Default policy should allow safe operations
      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_run',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
    });

    it('should use default execution options', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'echo_run',
        arguments: { text: 'test' },
      });

      expect(result.raw.duration).toBeLessThan(30000); // Default timeout
    });

    it('should use default output options', async () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const result = await executor.execute({
        id: 'call_1',
        name: 'echo_run',
        arguments: { text: 'test' },
      });

      expect(typeof result.content).toBe('string');
    });
  });
});
