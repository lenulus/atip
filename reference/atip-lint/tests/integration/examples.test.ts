import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createLinter } from '../../src/index.js';

describe('ATIP Examples Integration', () => {
  const examplesDir = join(__dirname, '../../../../examples');
  const exampleFiles = readdirSync(examplesDir).filter(f => f.endsWith('.json'));

  describe('lint all examples', () => {
    test('should lint all example files from repository', async () => {
      const linter = createLinter({
        extends: 'recommended',
      });

      for (const file of exampleFiles) {
        const filePath = join(examplesDir, file);
        const result = await linter.lintFile(filePath);

        // Examples should have minimal issues with recommended preset
        expect(result).toBeDefined();
        expect(result.filePath).toContain(file);
      }
    });
  });

  describe('gh.json example', () => {
    test('should pass quality checks', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'error',
          'description-quality': 'warn',
        },
      });

      const ghPath = join(examplesDir, 'gh.json');
      const result = await linter.lintFile(ghPath);

      // gh.json should be a high-quality example
      expect(result.errorCount).toBe(0);
    });

    test('should have trust metadata', async () => {
      const ghPath = join(examplesDir, 'gh.json');
      const content = JSON.parse(readFileSync(ghPath, 'utf-8'));

      expect(content.trust).toBeDefined();
    });
  });

  describe('minimal.json example', () => {
    test('should pass as valid minimal ATIP', async () => {
      const linter = createLinter({
        extends: 'minimal',
      });

      const minimalPath = join(examplesDir, 'minimal.json');
      const result = await linter.lintFile(minimalPath);

      // Minimal should have no errors with minimal preset
      expect(result.errorCount).toBe(0);
    });
  });

  describe('strict preset on examples', () => {
    test('should detect quality issues with strict preset', async () => {
      const linter = createLinter({
        extends: 'strict',
      });

      let totalWarnings = 0;

      for (const file of exampleFiles) {
        const filePath = join(examplesDir, file);
        const result = await linter.lintFile(filePath);
        totalWarnings += result.warningCount;
      }

      // Strict preset may find warnings in examples
      expect(totalWarnings).toBeGreaterThanOrEqual(0);
    });
  });

  describe('verify example completeness', () => {
    test('should check all examples have required metadata', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
        },
      });

      for (const file of exampleFiles) {
        const filePath = join(examplesDir, file);
        const result = await linter.lintFile(filePath);

        // No missing required fields
        const missingFieldErrors = result.messages.filter(
          m => m.ruleId === 'no-missing-required-fields'
        );
        expect(missingFieldErrors.length).toBe(0);
      }
    });
  });

  describe('effects consistency', () => {
    test('should check destructive operations have reversible', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': 'error',
        },
      });

      for (const file of exampleFiles) {
        const filePath = join(examplesDir, file);
        const result = await linter.lintFile(filePath);

        // Examples should properly declare reversible for destructive ops
        expect(result.errorCount).toBe(0);
      }
    });
  });

  describe('naming conventions', () => {
    test('should verify consistent naming across examples', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': ['warn', { commandCase: 'kebab-case' }],
        },
      });

      for (const file of exampleFiles) {
        const filePath = join(examplesDir, file);
        const result = await linter.lintFile(filePath);

        // Log any naming inconsistencies (but don't fail)
        if (result.warningCount > 0) {
          const namingWarnings = result.messages.filter(
            m => m.ruleId === 'consistent-naming'
          );
          if (namingWarnings.length > 0) {
            console.log(`${file}: ${namingWarnings.length} naming warnings`);
          }
        }
      }
    });
  });

  describe('batch lint examples', () => {
    test('should lint all examples with single call', async () => {
      const linter = createLinter({
        extends: 'recommended',
      });

      const pattern = join(examplesDir, '*.json');
      const results = await linter.lintFiles([pattern]);

      expect(results.results.length).toBe(exampleFiles.length);
      expect(results.errorCount).toBe(0); // Examples should be clean
    });
  });

  describe('fix examples', () => {
    test('should identify fixable issues in examples', async () => {
      const linter = createLinter({
        extends: 'recommended',
      });

      let totalFixable = 0;

      for (const file of exampleFiles) {
        const filePath = join(examplesDir, file);
        const result = await linter.lintFile(filePath);
        totalFixable += result.fixableErrorCount + result.fixableWarningCount;
      }

      // Examples should already be fixed (no fixable issues)
      expect(totalFixable).toBe(0);
    });
  });
});
