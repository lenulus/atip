import { describe, it, expect } from 'vitest';
import { formatResult } from '../../src/index.js';

/**
 * Unit tests for result formatting.
 *
 * Tests output filtering and formatting for LLM consumption:
 * - Secret redaction
 * - Output truncation
 * - Exit code inclusion
 * - Error formatting
 */

describe('formatResult', () => {
  const baseResult = {
    success: true,
    exitCode: 0,
    stdout: 'command output',
    stderr: '',
    duration: 100,
    truncated: false,
    timedOut: false,
    command: ['echo', 'test'],
    toolCallId: 'call_123',
    toolName: 'test_command',
  };

  describe('basic formatting', () => {
    it('should format successful result', () => {
      const formatted = formatResult(baseResult);

      expect(formatted.success).toBe(true);
      expect(formatted.content).toContain('command output');
      expect(formatted.raw).toEqual(baseResult);
    });

    it('should include exit code when configured', () => {
      const formatted = formatResult(baseResult, {
        includeExitCode: true,
      });

      expect(formatted.content).toContain('Exit code: 0');
    });

    it('should omit exit code when configured', () => {
      const formatted = formatResult(baseResult, {
        includeExitCode: false,
      });

      expect(formatted.content).not.toContain('Exit code');
    });
  });

  describe('error formatting', () => {
    it('should format failed execution', () => {
      const failedResult = {
        ...baseResult,
        success: false,
        exitCode: 1,
        stderr: 'error message',
      };

      const formatted = formatResult(failedResult);

      expect(formatted.success).toBe(false);
      expect(formatted.content).toContain('error message');
    });

    it('should include both stdout and stderr on failure', () => {
      const failedResult = {
        ...baseResult,
        success: false,
        exitCode: 1,
        stdout: 'some output',
        stderr: 'error message',
      };

      const formatted = formatResult(failedResult, {
        includeStderr: true,
      });

      expect(formatted.content).toContain('some output');
      expect(formatted.content).toContain('error message');
    });

    it('should format timeout errors', () => {
      const timedOutResult = {
        ...baseResult,
        success: false,
        timedOut: true,
        stdout: 'partial output',
      };

      const formatted = formatResult(timedOutResult);

      expect(formatted.success).toBe(false);
      expect(formatted.content).toContain('TIMEOUT');
      expect(formatted.content).toContain('partial output');
    });
  });

  describe('secret redaction', () => {
    it('should redact common token patterns', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'Token: ghp_1234567890abcdef1234567890abcdef12345678',
      };

      const formatted = formatResult(resultWithSecrets, {
        redactSecrets: true,
      });

      expect(formatted.content).toContain('[REDACTED]');
      expect(formatted.content).not.toContain('ghp_1234567890');
    });

    it('should redact API keys', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'API_KEY=sk-1234567890abcdef',
      };

      const formatted = formatResult(resultWithSecrets, {
        redactSecrets: true,
      });

      expect(formatted.content).toContain('[REDACTED]');
      expect(formatted.content).not.toContain('sk-1234567890abcdef');
    });

    it('should redact Bearer tokens', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      };

      const formatted = formatResult(resultWithSecrets, {
        redactSecrets: true,
      });

      expect(formatted.content).toContain('[REDACTED]');
      expect(formatted.content).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should support custom redaction patterns', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'SECRET_VALUE=my-custom-secret',
      };

      const formatted = formatResult(resultWithSecrets, {
        redactSecrets: true,
        redactPatterns: [/SECRET_VALUE=\S+/g],
      });

      expect(formatted.content).toContain('[REDACTED]');
      expect(formatted.content).not.toContain('my-custom-secret');
    });

    it('should allow disabling secret redaction', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'Token: ghp_1234567890abcdef1234567890abcdef12345678',
      };

      const formatted = formatResult(resultWithSecrets, {
        redactSecrets: false,
      });

      expect(formatted.content).toContain('ghp_1234567890');
    });
  });

  describe('output truncation', () => {
    it('should truncate long output', () => {
      const longOutput = 'x'.repeat(200000);
      const resultWithLongOutput = {
        ...baseResult,
        stdout: longOutput,
      };

      const formatted = formatResult(resultWithLongOutput, {
        maxLength: 10000,
      });

      expect(formatted.content.length).toBeLessThanOrEqual(10000);
      expect(formatted.content).toContain('[TRUNCATED]');
    });

    it('should not truncate short output', () => {
      const formatted = formatResult(baseResult, {
        maxLength: 10000,
      });

      expect(formatted.content).not.toContain('[TRUNCATED]');
      expect(formatted.content).toBe(baseResult.stdout);
    });

    it('should indicate truncation in result', () => {
      const truncatedResult = {
        ...baseResult,
        truncated: true,
        stdout: 'x'.repeat(100),
      };

      const formatted = formatResult(truncatedResult);

      expect(formatted.content).toContain('[TRUNCATED]');
    });
  });

  describe('stderr handling', () => {
    it('should include stderr when configured', () => {
      const resultWithStderr = {
        ...baseResult,
        stderr: 'warning message',
      };

      const formatted = formatResult(resultWithStderr, {
        includeStderr: true,
      });

      expect(formatted.content).toContain('warning message');
    });

    it('should omit stderr when configured', () => {
      const resultWithStderr = {
        ...baseResult,
        stderr: 'warning message',
      };

      const formatted = formatResult(resultWithStderr, {
        includeStderr: false,
      });

      expect(formatted.content).not.toContain('warning message');
    });

    it('should handle empty stderr', () => {
      const formatted = formatResult(baseResult, {
        includeStderr: true,
      });

      expect(formatted.success).toBe(true);
      expect(formatted.content).not.toContain('stderr');
    });
  });

  describe('custom formatter', () => {
    it('should support custom formatter function', () => {
      const customFormatter = (result: any) => {
        return `Custom: ${result.stdout}`;
      };

      const formatted = formatResult(baseResult, {
        formatter: customFormatter,
      });

      expect(formatted.content).toBe('Custom: command output');
    });

    it('should pass full result to custom formatter', () => {
      const customFormatter = vi.fn((result) => result.stdout);

      formatResult(baseResult, {
        formatter: customFormatter,
      });

      expect(customFormatter).toHaveBeenCalledWith(baseResult);
    });
  });

  describe('combined filters', () => {
    it('should apply all filters together', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'Token: ghp_1234567890abcdef1234567890abcdef12345678\n' + 'x'.repeat(200000),
        stderr: 'warning',
        exitCode: 0,
      };

      const formatted = formatResult(resultWithSecrets, {
        redactSecrets: true,
        maxLength: 10000,
        includeStderr: true,
        includeExitCode: true,
      });

      expect(formatted.content).toContain('[REDACTED]');
      expect(formatted.content).toContain('[TRUNCATED]');
      expect(formatted.content).toContain('warning');
      expect(formatted.content).toContain('Exit code: 0');
      expect(formatted.content.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('default behavior', () => {
    it('should use sensible defaults when no options provided', () => {
      const resultWithSecrets = {
        ...baseResult,
        stdout: 'Token: ghp_1234567890abcdef1234567890abcdef12345678',
        stderr: 'warning',
      };

      const formatted = formatResult(resultWithSecrets);

      // Defaults: redact secrets, include stderr, include exit code
      expect(formatted.content).toContain('[REDACTED]');
    });
  });

  describe('edge cases', () => {
    it('should handle empty stdout', () => {
      const emptyResult = {
        ...baseResult,
        stdout: '',
      };

      const formatted = formatResult(emptyResult);

      expect(formatted.content).toBe('');
    });

    it('should handle null stdout', () => {
      const nullResult = {
        ...baseResult,
        stdout: null,
      };

      const formatted = formatResult(nullResult);

      expect(formatted.content).toBe('');
    });

    it('should handle binary output', () => {
      const binaryResult = {
        ...baseResult,
        stdout: Buffer.from([0x00, 0x01, 0x02, 0xff]).toString(),
      };

      const formatted = formatResult(binaryResult);

      expect(formatted.success).toBe(true);
      expect(typeof formatted.content).toBe('string');
    });
  });
});
