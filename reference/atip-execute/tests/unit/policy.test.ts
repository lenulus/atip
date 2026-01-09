import { describe, it, expect, vi } from 'vitest';
import { createExecutor, RequiresConfirmationError, InsufficientTrustError } from '../../src/index.js';

/**
 * Unit tests for policy enforcement.
 *
 * Tests execution policy validation:
 * - Destructive operation blocking
 * - Trust level enforcement
 * - Billable operation checks
 * - Confirmation handler invocation
 * - Interactive command blocking
 */

describe('Policy enforcement', () => {
  const tool = {
    atip: { version: '0.4' },
    name: 'echo',
    version: '1.0.0',
    description: 'Test tool',
    trust: {
      source: 'community',
      verified: false,
    },
    commands: {
      safe: {
        description: 'Safe command',
        effects: {
          network: false,
          destructive: false,
          reversible: true,
          idempotent: true,
        },
      },
      destructive: {
        description: 'Destructive command',
        effects: {
          network: true,
          destructive: true,
          reversible: false,
          idempotent: false,
        },
      },
      billable: {
        description: 'Billable command',
        effects: {
          network: true,
          cost: {
            billable: true,
            estimate: 'medium',
          },
        },
      },
      interactive: {
        description: 'Interactive command',
        effects: {
          interactive: {
            stdin: 'required',
            prompts: true,
            tty: false,
          },
        },
      },
    },
  };

  describe('destructive operations', () => {
    it('should allow destructive operations when allowDestructive is true', async () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: true,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
      expect(check.requiresConfirmation).toBe(false);
    });

    it('should block destructive operations when allowDestructive is false', async () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.requiresConfirmation).toBe(true);
      expect(check.reasons).toContain('destructive');
    });

    it('should throw RequiresConfirmationError when no handler provided', async () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
        },
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'echo_destructive',
          arguments: {},
        })
      ).rejects.toThrow(RequiresConfirmationError);
    });

    it('should invoke confirmation handler for destructive operations', async () => {
      const confirmationHandler = vi.fn().mockResolvedValue(true);

      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
          confirmationHandler,
        },
      });

      await executor.execute({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: {},
      });

      expect(confirmationHandler).toHaveBeenCalledOnce();
      expect(confirmationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'echo_destructive',
          reasons: expect.arrayContaining(['destructive']),
          effects: expect.objectContaining({ destructive: true }),
        })
      );
    });

    it('should abort when confirmation handler returns false', async () => {
      const confirmationHandler = vi.fn().mockResolvedValue(false);

      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
          confirmationHandler,
        },
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'echo_destructive',
          arguments: {},
        })
      ).rejects.toThrow();
    });
  });

  describe('trust level enforcement', () => {
    it('should allow execution when trust level meets minimum', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          minTrustLevel: 'community',
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_safe',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
    });

    it('should block execution when trust level below minimum', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          minTrustLevel: 'vendor', // Higher than 'community'
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_safe',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.violations).toContainEqual(
        expect.objectContaining({
          code: 'TRUST_INSUFFICIENT',
        })
      );
    });

    it('should throw InsufficientTrustError when trust too low', async () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          minTrustLevel: 'native',
        },
      });

      await expect(
        executor.execute({
          id: 'call_1',
          name: 'echo_safe',
          arguments: {},
        })
      ).rejects.toThrow(InsufficientTrustError);
    });

    it('should handle inferred trust level', () => {
      const inferredTool = {
        ...tool,
        trust: {
          source: 'inferred',
          verified: false,
        },
      };

      const executor = createExecutor({
        tools: [inferredTool],
        policy: {
          minTrustLevel: 'user',
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_safe',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
    });
  });

  describe('billable operations', () => {
    it('should allow billable operations by default', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_billable',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
    });

    it('should block billable operations when allowBillable is false', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowBillable: false,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_billable',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.violations).toContainEqual(
        expect.objectContaining({
          code: 'BILLABLE_BLOCKED',
        })
      );
    });

    it('should check cost estimate against maximum', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          maxCostEstimate: 'low',
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_billable',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.violations).toContainEqual(
        expect.objectContaining({
          code: 'COST_EXCEEDED',
        })
      );
    });
  });

  describe('network restrictions', () => {
    it('should allow network operations by default', () => {
      const executor = createExecutor({
        tools: [tool],
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
    });

    it('should block network operations when allowNetwork is false', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowNetwork: false,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.violations).toContainEqual(
        expect.objectContaining({
          code: 'NETWORK_BLOCKED',
        })
      );
    });
  });

  describe('interactive commands', () => {
    it('should block interactive commands by default', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowInteractive: false,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_interactive',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.violations).toContainEqual(
        expect.objectContaining({
          code: 'INTERACTIVE_BLOCKED',
        })
      );
    });

    it('should allow interactive commands when allowInteractive is true', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowInteractive: true,
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_interactive',
        arguments: {},
      });

      expect(check.allowed).toBe(true);
    });
  });

  describe('multiple policy violations', () => {
    it('should report all violations', () => {
      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
          allowNetwork: false,
          minTrustLevel: 'vendor',
        },
      });

      const check = executor.checkPolicy({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: {},
      });

      expect(check.allowed).toBe(false);
      expect(check.violations.length).toBeGreaterThan(1);
    });
  });

  describe('confirmation context', () => {
    it('should provide complete context to confirmation handler', async () => {
      const confirmationHandler = vi.fn().mockResolvedValue(true);

      const executor = createExecutor({
        tools: [tool],
        policy: {
          allowDestructive: false,
          confirmationHandler,
        },
      });

      await executor.execute({
        id: 'call_1',
        name: 'echo_destructive',
        arguments: { arg: 'value' },
      });

      expect(confirmationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'echo_destructive',
          command: expect.arrayContaining(['echo', 'destructive']),
          arguments: { arg: 'value' },
          reasons: expect.arrayContaining(['destructive']),
          effects: expect.objectContaining({
            destructive: true,
            reversible: false,
          }),
          trust: expect.objectContaining({
            source: 'community',
          }),
        })
      );
    });
  });
});
