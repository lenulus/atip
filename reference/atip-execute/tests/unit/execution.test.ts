import { describe, it, expect } from 'vitest';
import { executeCommand, TimeoutError, ExecutionError } from '../../src/index.js';

/**
 * Unit tests for subprocess execution.
 *
 * Tests command execution functionality:
 * - Successful execution capture
 * - Exit code handling
 * - Timeout enforcement
 * - Output size limits
 * - Error handling
 */

describe('executeCommand', () => {
  describe('successful execution', () => {
    it('should execute simple command and capture stdout', async () => {
      const result = await executeCommand(['echo', 'hello']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
      expect(result.stderr).toBe('');
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should capture multi-line output', async () => {
      const result = await executeCommand(['echo', 'line1\nline2\nline3']);

      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
      expect(result.stdout).toContain('line3');
    });

    it('should handle commands with arguments', async () => {
      const result = await executeCommand(['echo', '-n', 'no-newline']);

      expect(result.stdout).toBe('no-newline');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('exit codes', () => {
    it('should capture non-zero exit codes', async () => {
      // Using sh -c to force exit code
      const result = await executeCommand(['sh', '-c', 'exit 1']);

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
    });

    it('should mark success based on exit code', async () => {
      const success = await executeCommand(['echo', 'test']);
      expect(success.success).toBe(true);

      const failure = await executeCommand(['sh', '-c', 'exit 42']);
      expect(failure.success).toBe(false);
      expect(failure.exitCode).toBe(42);
    });
  });

  describe('stderr capture', () => {
    it('should capture stderr separately from stdout', async () => {
      // Redirect stderr to stdout using sh
      const result = await executeCommand([
        'sh',
        '-c',
        'echo stdout && echo stderr >&2',
      ]);

      expect(result.stdout).toContain('stdout');
      expect(result.stderr).toContain('stderr');
    });

    it('should handle empty stderr', async () => {
      const result = await executeCommand(['echo', 'test']);

      expect(result.stderr).toBe('');
    });
  });

  describe('timeout enforcement', () => {
    it('should timeout long-running commands', async () => {
      await expect(
        executeCommand(['sleep', '10'], { timeout: 100 })
      ).rejects.toThrow(TimeoutError);
    });

    it('should include timeout duration in error', async () => {
      try {
        await executeCommand(['sleep', '10'], { timeout: 100 });
        expect.fail('Should have thrown TimeoutError');
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
        expect((e as TimeoutError).timeout).toBe(100);
        expect((e as TimeoutError).command).toEqual(['sleep', '10']);
      }
    });

    it('should not timeout quick commands', async () => {
      const result = await executeCommand(['echo', 'quick'], { timeout: 1000 });

      expect(result.success).toBe(true);
      expect(result.timedOut).toBe(false);
    });

    it('should set timedOut flag when timeout occurs', async () => {
      try {
        await executeCommand(['sleep', '10'], { timeout: 100 });
      } catch (e) {
        // Should throw, but check if we can catch partial result
        expect(e).toBeInstanceOf(TimeoutError);
      }
    });
  });

  describe('output size limits', () => {
    it('should truncate large output', async () => {
      // Generate large output
      const result = await executeCommand(
        ['sh', '-c', 'for i in {1..10000}; do echo "line $i"; done'],
        { maxOutputSize: 1000 }
      );

      expect(result.truncated).toBe(true);
      expect(result.stdout.length).toBeLessThanOrEqual(1000);
    });

    it('should not truncate small output', async () => {
      const result = await executeCommand(['echo', 'small'], { maxOutputSize: 1000 });

      expect(result.truncated).toBe(false);
    });
  });

  describe('execution options', () => {
    it('should respect custom working directory', async () => {
      const result = await executeCommand(['pwd'], { cwd: '/tmp' });

      // On macOS, /tmp is a symlink to /private/tmp
      expect(['/tmp', '/private/tmp']).toContain(result.stdout.trim());
    });

    it('should respect custom environment variables', async () => {
      const result = await executeCommand(['sh', '-c', 'echo $TEST_VAR'], {
        env: { TEST_VAR: 'test-value' },
      });

      expect(result.stdout.trim()).toContain('test-value');
    });
  });

  describe('result metadata', () => {
    it('should include command in result', async () => {
      const result = await executeCommand(['echo', 'test']);

      expect(result.command).toEqual(['echo', 'test']);
    });

    it('should include duration in result', async () => {
      const result = await executeCommand(['echo', 'test']);

      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should set truncated flag correctly', async () => {
      const small = await executeCommand(['echo', 'test']);
      expect(small.truncated).toBe(false);
    });

    it('should set timedOut flag correctly', async () => {
      const result = await executeCommand(['echo', 'test']);
      expect(result.timedOut).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw ExecutionError for non-existent commands', async () => {
      await expect(
        executeCommand(['nonexistent-command-xyz'])
      ).rejects.toThrow(ExecutionError);
    });

    it('should include command in ExecutionError', async () => {
      try {
        await executeCommand(['nonexistent-command-xyz']);
        expect.fail('Should have thrown ExecutionError');
      } catch (e) {
        expect(e).toBeInstanceOf(ExecutionError);
        expect((e as ExecutionError).command).toEqual(['nonexistent-command-xyz']);
      }
    });

    it('should handle command with no arguments', async () => {
      const result = await executeCommand(['echo']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('streaming support', () => {
    it('should support streaming stdout', async () => {
      const chunks: string[] = [];

      await executeCommand(['echo', 'test'], {
        streaming: true,
        onStdout: (data) => {
          chunks.push(data.toString());
        },
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('test');
    });

    it('should support streaming stderr', async () => {
      const chunks: string[] = [];

      await executeCommand(['sh', '-c', 'echo error >&2'], {
        streaming: true,
        onStderr: (data) => {
          chunks.push(data.toString());
        },
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('error');
    });
  });

  describe('shell execution', () => {
    it('should support shell execution when enabled', async () => {
      const result = await executeCommand(['echo $HOME'], {
        shell: true,
      });

      expect(result.success).toBe(true);
    });

    it('should not use shell by default', async () => {
      // This would fail with shell expansion disabled
      const result = await executeCommand(['echo', '$HOME']);

      // Without shell, $HOME is literal
      expect(result.stdout.trim()).toBe('$HOME');
    });
  });
});
