import { describe, it, expect } from 'vitest';
import { categorizeChange, getEffectsSeverity } from '../../src/categorizer/categorizer';
import type { ChangeType, ChangeCategory, ChangeSeverity } from '../../src/types';

describe('categorizer', () => {
  describe('categorizeChange', () => {
    it('should categorize command-removed as breaking', () => {
      const category = categorizeChange('command-removed', ['commands', 'deploy']);
      expect(category).toBe('breaking');
    });

    it('should categorize command-added as non-breaking', () => {
      const category = categorizeChange('command-added', ['commands', 'test']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize required-argument-added as breaking', () => {
      const category = categorizeChange('required-argument-added', ['commands', 'run', 'arguments', 'file']);
      expect(category).toBe('breaking');
    });

    it('should categorize optional-argument-added as non-breaking', () => {
      const category = categorizeChange('optional-argument-added', ['commands', 'run', 'arguments', 'output']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize type-made-stricter as breaking', () => {
      const category = categorizeChange('type-made-stricter', ['commands', 'set', 'options', 'value', 'type']);
      expect(category).toBe('breaking');
    });

    it('should categorize type-relaxed as non-breaking', () => {
      const category = categorizeChange('type-relaxed', ['commands', 'set', 'options', 'value', 'type']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize enum-values-removed as breaking', () => {
      const category = categorizeChange('enum-values-removed', ['commands', 'deploy', 'arguments', 'env', 'enum']);
      expect(category).toBe('breaking');
    });

    it('should categorize enum-values-added as non-breaking', () => {
      const category = categorizeChange('enum-values-added', ['commands', 'deploy', 'arguments', 'env', 'enum']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize argument-removed as breaking', () => {
      const category = categorizeChange('argument-removed', ['commands', 'run', 'arguments', 'file']);
      expect(category).toBe('breaking');
    });

    it('should categorize option-removed as breaking', () => {
      const category = categorizeChange('option-removed', ['commands', 'run', 'options', 'force']);
      expect(category).toBe('breaking');
    });

    it('should categorize option-flags-changed as breaking', () => {
      const category = categorizeChange('option-flags-changed', ['commands', 'run', 'options', 'verbose', 'flags']);
      expect(category).toBe('breaking');
    });

    it('should categorize argument-made-required as breaking', () => {
      const category = categorizeChange('argument-made-required', ['commands', 'run', 'arguments', 'file', 'required']);
      expect(category).toBe('breaking');
    });

    it('should categorize option-made-required as breaking', () => {
      const category = categorizeChange('option-made-required', ['commands', 'run', 'options', 'format', 'required']);
      expect(category).toBe('breaking');
    });

    it('should categorize argument-made-optional as non-breaking', () => {
      const category = categorizeChange('argument-made-optional', ['commands', 'run', 'arguments', 'file', 'required']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize option-made-optional as non-breaking', () => {
      const category = categorizeChange('option-made-optional', ['commands', 'run', 'options', 'format', 'required']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize description-changed as non-breaking', () => {
      const category = categorizeChange('description-changed', ['commands', 'run', 'description']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize version-changed as non-breaking', () => {
      const category = categorizeChange('version-changed', ['version']);
      expect(category).toBe('non-breaking');
    });

    it('should categorize destructive-added as effects', () => {
      const category = categorizeChange('destructive-added', ['commands', 'delete', 'effects', 'destructive']);
      expect(category).toBe('effects');
    });

    it('should categorize destructive-removed as effects', () => {
      const category = categorizeChange('destructive-removed', ['commands', 'delete', 'effects', 'destructive']);
      expect(category).toBe('effects');
    });

    it('should categorize reversible-changed as effects', () => {
      const category = categorizeChange('reversible-changed', ['commands', 'deploy', 'effects', 'reversible']);
      expect(category).toBe('effects');
    });

    it('should categorize idempotent-changed as effects', () => {
      const category = categorizeChange('idempotent-changed', ['commands', 'run', 'effects', 'idempotent']);
      expect(category).toBe('effects');
    });

    it('should categorize network-changed as effects', () => {
      const category = categorizeChange('network-changed', ['commands', 'fetch', 'effects', 'network']);
      expect(category).toBe('effects');
    });

    it('should categorize filesystem-changed as effects', () => {
      const category = categorizeChange('filesystem-changed', ['commands', 'write', 'effects', 'filesystem']);
      expect(category).toBe('effects');
    });

    it('should categorize cost-changed as effects', () => {
      const category = categorizeChange('cost-changed', ['commands', 'deploy', 'effects', 'cost']);
      expect(category).toBe('effects');
    });

    it('should categorize interactive-changed as effects', () => {
      const category = categorizeChange('interactive-changed', ['commands', 'prompt', 'effects', 'interactive']);
      expect(category).toBe('effects');
    });
  });

  describe('getEffectsSeverity', () => {
    it('should return high severity for destructive', () => {
      const severity = getEffectsSeverity('destructive', false, true);
      expect(severity).toBe('high');
    });

    it('should return high severity for cost.billable', () => {
      const severity = getEffectsSeverity('cost.billable', false, true);
      expect(severity).toBe('high');
    });

    it('should return medium severity for reversible', () => {
      const severity = getEffectsSeverity('reversible', true, false);
      expect(severity).toBe('medium');
    });

    it('should return medium severity for idempotent', () => {
      const severity = getEffectsSeverity('idempotent', true, false);
      expect(severity).toBe('medium');
    });

    it('should return medium severity for interactive.stdin', () => {
      const severity = getEffectsSeverity('interactive.stdin', 'none', 'required');
      expect(severity).toBe('medium');
    });

    it('should return medium severity for filesystem.write', () => {
      const severity = getEffectsSeverity('filesystem.write', false, true);
      expect(severity).toBe('medium');
    });

    it('should return low severity for network', () => {
      const severity = getEffectsSeverity('network', false, true);
      expect(severity).toBe('low');
    });

    it('should return low severity for duration.typical', () => {
      const severity = getEffectsSeverity('duration.typical', 100, 200);
      expect(severity).toBe('low');
    });
  });
});
