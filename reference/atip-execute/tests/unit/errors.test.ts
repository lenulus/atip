import { describe, it, expect } from 'vitest';
import {
  AtipExecuteError,
  UnknownCommandError,
  ArgumentValidationError,
  PolicyViolationError,
  RequiresConfirmationError,
  InsufficientTrustError,
  ExecutionError,
  TimeoutError,
  InteractiveNotSupportedError,
} from '../../src/index.js';

/**
 * Unit tests for error types.
 *
 * Tests error class hierarchy and properties:
 * - Error codes
 * - Error inheritance
 * - Error context preservation
 */

describe('Error types', () => {
  describe('AtipExecuteError', () => {
    it('should be base error class', () => {
      const error = new AtipExecuteError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AtipExecuteError');
    });

    it('should have stack trace', () => {
      const error = new AtipExecuteError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AtipExecuteError');
    });
  });

  describe('UnknownCommandError', () => {
    it('should extend AtipExecuteError', () => {
      const error = new UnknownCommandError('test_command');

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(UnknownCommandError);
    });

    it('should have correct properties', () => {
      const error = new UnknownCommandError('test_command');

      expect(error.code).toBe('UNKNOWN_COMMAND');
      expect(error.toolName).toBe('test_command');
      expect(error.name).toBe('UnknownCommandError');
      expect(error.message).toContain('test_command');
    });
  });

  describe('ArgumentValidationError', () => {
    it('should extend AtipExecuteError', () => {
      const error = new ArgumentValidationError('Validation failed', 'test_tool', []);

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(ArgumentValidationError);
    });

    it('should preserve validation errors', () => {
      const validationErrors = [
        { code: 'MISSING_REQUIRED', parameter: 'arg1', message: 'Required' },
        { code: 'INVALID_TYPE', parameter: 'arg2', message: 'Wrong type' },
      ];

      const error = new ArgumentValidationError('Validation failed', 'test_tool', validationErrors);

      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.toolName).toBe('test_tool');
      expect(error.errors).toEqual(validationErrors);
      expect(error.name).toBe('ArgumentValidationError');
    });
  });

  describe('PolicyViolationError', () => {
    it('should extend AtipExecuteError', () => {
      const error = new PolicyViolationError('Policy violated', 'test_tool', []);

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(PolicyViolationError);
    });

    it('should preserve violations', () => {
      const violations = [
        { code: 'DESTRUCTIVE_BLOCKED', message: 'Destructive operation blocked' },
        { code: 'TRUST_INSUFFICIENT', message: 'Trust too low' },
      ];

      const error = new PolicyViolationError('Policy violated', 'test_tool', violations);

      expect(error.code).toBe('POLICY_VIOLATION');
      expect(error.toolName).toBe('test_tool');
      expect(error.violations).toEqual(violations);
      expect(error.name).toBe('PolicyViolationError');
    });
  });

  describe('RequiresConfirmationError', () => {
    it('should extend AtipExecuteError', () => {
      const context = {
        toolName: 'test_tool',
        command: ['test', 'command'],
        arguments: {},
        reasons: ['destructive'],
        effects: { destructive: true },
      };

      const error = new RequiresConfirmationError(context);

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(RequiresConfirmationError);
    });

    it('should preserve confirmation context', () => {
      const context = {
        toolName: 'test_tool',
        command: ['test', 'command'],
        arguments: { arg: 'value' },
        reasons: ['destructive', 'non-reversible'],
        effects: { destructive: true, reversible: false },
        trust: { source: 'community', verified: false },
      };

      const error = new RequiresConfirmationError(context);

      expect(error.code).toBe('REQUIRES_CONFIRMATION');
      expect(error.context).toEqual(context);
      expect(error.name).toBe('RequiresConfirmationError');
    });
  });

  describe('InsufficientTrustError', () => {
    it('should extend AtipExecuteError', () => {
      const error = new InsufficientTrustError('test_tool', 'inferred', 'vendor');

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(InsufficientTrustError);
    });

    it('should preserve trust levels', () => {
      const error = new InsufficientTrustError('test_tool', 'community', 'vendor');

      expect(error.code).toBe('INSUFFICIENT_TRUST');
      expect(error.toolName).toBe('test_tool');
      expect(error.actualTrust).toBe('community');
      expect(error.requiredTrust).toBe('vendor');
      expect(error.name).toBe('InsufficientTrustError');
      expect(error.message).toContain('community');
      expect(error.message).toContain('vendor');
    });
  });

  describe('ExecutionError', () => {
    it('should extend AtipExecuteError', () => {
      const error = new ExecutionError('Execution failed', ['echo', 'test']);

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(ExecutionError);
    });

    it('should preserve command', () => {
      const error = new ExecutionError('Execution failed', ['echo', 'test']);

      expect(error.code).toBe('EXECUTION_FAILED');
      expect(error.command).toEqual(['echo', 'test']);
      expect(error.name).toBe('ExecutionError');
    });

    it('should preserve cause', () => {
      const cause = new Error('Underlying error');
      const error = new ExecutionError('Execution failed', ['echo', 'test'], cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('TimeoutError', () => {
    it('should extend AtipExecuteError', () => {
      const error = new TimeoutError(['sleep', '10'], 1000);

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(TimeoutError);
    });

    it('should preserve timeout details', () => {
      const error = new TimeoutError(['sleep', '10'], 5000);

      expect(error.code).toBe('TIMEOUT');
      expect(error.command).toEqual(['sleep', '10']);
      expect(error.timeout).toBe(5000);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toContain('5000');
    });
  });

  describe('InteractiveNotSupportedError', () => {
    it('should extend AtipExecuteError', () => {
      const effects = { stdin: 'required', prompts: true };
      const error = new InteractiveNotSupportedError('test_tool', effects);

      expect(error).toBeInstanceOf(AtipExecuteError);
      expect(error).toBeInstanceOf(InteractiveNotSupportedError);
    });

    it('should preserve interactive effects', () => {
      const effects = { stdin: 'required', prompts: true, tty: false };
      const error = new InteractiveNotSupportedError('test_tool', effects);

      expect(error.code).toBe('INTERACTIVE_NOT_SUPPORTED');
      expect(error.toolName).toBe('test_tool');
      expect(error.interactiveEffects).toEqual(effects);
      expect(error.name).toBe('InteractiveNotSupportedError');
    });
  });

  describe('error handling patterns', () => {
    it('should support instanceof checks', () => {
      const errors = [
        new UnknownCommandError('test'),
        new ArgumentValidationError('test', 'tool', []),
        new PolicyViolationError('test', 'tool', []),
        new RequiresConfirmationError({}),
        new InsufficientTrustError('tool', 'low', 'high'),
        new ExecutionError('test', ['cmd']),
        new TimeoutError(['cmd'], 1000),
        new InteractiveNotSupportedError('tool', {}),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(AtipExecuteError);
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should support catch-all with base class', () => {
      const error = new UnknownCommandError('test');

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(AtipExecuteError);
        expect((e as AtipExecuteError).code).toBe('UNKNOWN_COMMAND');
      }
    });

    it('should support specific error catching', () => {
      const error = new TimeoutError(['cmd'], 1000);

      try {
        throw error;
      } catch (e) {
        if (e instanceof TimeoutError) {
          expect(e.timeout).toBe(1000);
        } else {
          expect.fail('Should be TimeoutError');
        }
      }
    });
  });
});
