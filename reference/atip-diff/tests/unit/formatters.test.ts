import { describe, it, expect } from 'vitest';
import { formatSummary, formatJson, formatMarkdown } from '../../src/formatters';
import type { DiffResult } from '../../src/types';

describe('formatters', () => {
  const mockResult: DiffResult = {
    summary: {
      totalChanges: 3,
      breakingChanges: 1,
      nonBreakingChanges: 1,
      effectsChanges: 1,
      hasBreakingChanges: true,
      hasEffectsChanges: true,
    },
    changes: [
      {
        type: 'command-removed',
        category: 'breaking',
        message: "Command 'deploy' was removed",
        path: ['commands', 'deploy'],
      },
      {
        type: 'command-added',
        category: 'non-breaking',
        message: "Command 'test' was added",
        path: ['commands', 'test'],
      },
      {
        type: 'destructive-added',
        category: 'effects',
        severity: 'high',
        message: "'delete' now marked as destructive",
        path: ['commands', 'delete', 'effects', 'destructive'],
      },
    ],
    semverRecommendation: 'major',
    oldMetadata: {} as any,
    newMetadata: {} as any,
  };

  describe('formatSummary', () => {
    it('should format summary output with breaking changes section', () => {
      const output = formatSummary(mockResult, { color: false });
      expect(output).toContain('BREAKING CHANGES');
      expect(output).toContain("Command 'deploy' was removed");
    });

    it('should format summary output with non-breaking changes section', () => {
      const output = formatSummary(mockResult, { color: false });
      expect(output).toContain('NON-BREAKING CHANGES');
      expect(output).toContain("Command 'test' was added");
    });

    it('should format summary output with effects changes section', () => {
      const output = formatSummary(mockResult, { color: false });
      expect(output).toContain('EFFECTS CHANGES');
      expect(output).toContain("'delete' now marked as destructive");
    });

    it('should include semver recommendation', () => {
      const output = formatSummary(mockResult, { color: false });
      expect(output).toContain('Recommended version bump: MAJOR');
    });

    it('should include summary statistics', () => {
      const output = formatSummary(mockResult, { color: false });
      expect(output).toContain('3 changes');
      expect(output).toContain('1 breaking');
    });

    it('should handle no changes', () => {
      const emptyResult: DiffResult = {
        summary: {
          totalChanges: 0,
          breakingChanges: 0,
          nonBreakingChanges: 0,
          effectsChanges: 0,
          hasBreakingChanges: false,
          hasEffectsChanges: false,
        },
        changes: [],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const output = formatSummary(emptyResult, { color: false });
      expect(output).toContain('No changes detected');
    });
  });

  describe('formatJson', () => {
    it('should format as valid JSON', () => {
      const output = formatJson(mockResult);
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include summary in JSON output', () => {
      const output = formatJson(mockResult);
      const parsed = JSON.parse(output);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.totalChanges).toBe(3);
    });

    it('should include changes in JSON output', () => {
      const output = formatJson(mockResult);
      const parsed = JSON.parse(output);
      expect(parsed.changes).toHaveLength(3);
    });

    it('should include semver recommendation in JSON output', () => {
      const output = formatJson(mockResult);
      const parsed = JSON.parse(output);
      expect(parsed.semverRecommendation).toBe('major');
    });

    it('should pretty print when option is set', () => {
      const output = formatJson(mockResult, { pretty: true });
      expect(output).toContain('\n');
      expect(output).toContain('  ');
    });

    it('should minify when pretty is false', () => {
      const output = formatJson(mockResult, { pretty: false });
      expect(output).not.toContain('\n  ');
    });
  });

  describe('formatMarkdown', () => {
    it('should format as markdown with headers', () => {
      const output = formatMarkdown(mockResult);
      expect(output).toContain('##');
      expect(output).toContain('###');
    });

    it('should include breaking changes section', () => {
      const output = formatMarkdown(mockResult);
      expect(output).toContain('Breaking Changes');
      expect(output).toContain("Command 'deploy' was removed");
    });

    it('should include non-breaking changes section', () => {
      const output = formatMarkdown(mockResult);
      expect(output).toContain('Non-Breaking Changes');
      expect(output).toContain("Command 'test' was added");
    });

    it('should include effects changes section', () => {
      const output = formatMarkdown(mockResult);
      expect(output).toContain('Effects Changes');
      expect(output).toContain("'delete' now marked as destructive");
    });

    it('should include warning for breaking changes', () => {
      const output = formatMarkdown(mockResult);
      expect(output).toContain('Warning');
    });

    it('should include semver recommendation', () => {
      const output = formatMarkdown(mockResult);
      expect(output).toContain('Recommended version bump');
      expect(output).toContain('MAJOR');
    });

    it('should include header when option is set', () => {
      const output = formatMarkdown(mockResult, {
        includeHeader: true,
        version: '2.0.0',
        date: '2026-01-08',
      });
      expect(output).toContain('2.0.0');
      expect(output).toContain('2026-01-08');
    });
  });
});
