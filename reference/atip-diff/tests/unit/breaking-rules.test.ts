import { describe, it, expect } from 'vitest';
import { isBreakingChange, getBreakingReason } from '../../src/categorizer/breaking-rules';
import type { ChangeType } from '../../src/types';

describe('breaking-rules', () => {
  describe('isBreakingChange', () => {
    it('should identify command-removed as breaking', () => {
      expect(isBreakingChange('command-removed')).toBe(true);
    });

    it('should identify required-argument-added as breaking', () => {
      expect(isBreakingChange('required-argument-added')).toBe(true);
    });

    it('should identify required-option-added as breaking', () => {
      expect(isBreakingChange('required-option-added')).toBe(true);
    });

    it('should identify type-made-stricter as breaking', () => {
      expect(isBreakingChange('type-made-stricter')).toBe(true);
    });

    it('should identify enum-values-removed as breaking', () => {
      expect(isBreakingChange('enum-values-removed')).toBe(true);
    });

    it('should identify argument-removed as breaking', () => {
      expect(isBreakingChange('argument-removed')).toBe(true);
    });

    it('should identify option-removed as breaking', () => {
      expect(isBreakingChange('option-removed')).toBe(true);
    });

    it('should identify option-flags-changed as breaking', () => {
      expect(isBreakingChange('option-flags-changed')).toBe(true);
    });

    it('should identify argument-made-required as breaking', () => {
      expect(isBreakingChange('argument-made-required')).toBe(true);
    });

    it('should identify option-made-required as breaking', () => {
      expect(isBreakingChange('option-made-required')).toBe(true);
    });

    it('should not identify command-added as breaking', () => {
      expect(isBreakingChange('command-added')).toBe(false);
    });

    it('should not identify optional-argument-added as breaking', () => {
      expect(isBreakingChange('optional-argument-added')).toBe(false);
    });

    it('should not identify description-changed as breaking', () => {
      expect(isBreakingChange('description-changed')).toBe(false);
    });

    it('should not identify destructive-added as breaking', () => {
      expect(isBreakingChange('destructive-added')).toBe(false);
    });
  });

  describe('getBreakingReason', () => {
    it('should explain why command-removed is breaking', () => {
      const reason = getBreakingReason('command-removed', ['commands', 'deploy']);
      expect(reason).toContain('Agents calling this command will fail');
    });

    it('should explain why required-argument-added is breaking', () => {
      const reason = getBreakingReason('required-argument-added', ['commands', 'run', 'arguments', 'file']);
      expect(reason).toContain('Existing calls missing arg will fail');
    });

    it('should explain why type-made-stricter is breaking', () => {
      const reason = getBreakingReason('type-made-stricter', ['commands', 'set', 'options', 'value', 'type']);
      expect(reason).toContain('Previously valid values may be rejected');
    });

    it('should explain why enum-values-removed is breaking', () => {
      const reason = getBreakingReason('enum-values-removed', ['commands', 'deploy', 'arguments', 'env', 'enum']);
      expect(reason).toContain('no longer valid');
    });

    it('should explain why argument-removed is breaking', () => {
      const reason = getBreakingReason('argument-removed', ['commands', 'run', 'arguments', 'file']);
      expect(reason).toContain('Existing calls with arg may fail');
    });

    it('should explain why option-flags-changed is breaking', () => {
      const reason = getBreakingReason('option-flags-changed', ['commands', 'run', 'options', 'verbose', 'flags']);
      expect(reason).toContain('Existing calls with old flag will fail');
    });

    it('should provide default reason for unknown breaking change', () => {
      const reason = getBreakingReason('unknown-type' as ChangeType, ['test']);
      expect(reason).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle all breaking change types from constants', () => {
      const breakingTypes: ChangeType[] = [
        'command-removed',
        'required-argument-added',
        'required-option-added',
        'type-made-stricter',
        'enum-values-removed',
        'argument-removed',
        'option-removed',
        'option-flags-changed',
        'argument-made-required',
        'option-made-required',
      ];

      for (const type of breakingTypes) {
        expect(isBreakingChange(type)).toBe(true);
      }
    });

    it('should handle all non-breaking change types from constants', () => {
      const nonBreakingTypes: ChangeType[] = [
        'command-added',
        'optional-argument-added',
        'optional-option-added',
        'type-relaxed',
        'enum-values-added',
        'description-changed',
        'default-value-changed',
        'examples-changed',
        'argument-made-optional',
        'option-made-optional',
        'homepage-changed',
        'version-changed',
        'patterns-changed',
      ];

      for (const type of nonBreakingTypes) {
        expect(isBreakingChange(type)).toBe(false);
      }
    });

    it('should handle all effects change types', () => {
      const effectsTypes: ChangeType[] = [
        'destructive-added',
        'destructive-removed',
        'reversible-changed',
        'idempotent-changed',
        'network-changed',
        'filesystem-changed',
        'cost-changed',
        'interactive-changed',
        'duration-changed',
      ];

      for (const type of effectsTypes) {
        expect(isBreakingChange(type)).toBe(false);
      }
    });
  });
});
