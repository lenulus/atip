import { describe, test, expect } from 'vitest';
import { createLinter } from '../../src/index.js';
import type { Linter, LintConfig } from '../../src/index.js';

describe('createLinter', () => {
  describe('linter creation', () => {
    test('should create a linter instance', () => {
      const linter = createLinter();

      expect(linter).toBeDefined();
      expect(linter).toHaveProperty('lintFile');
      expect(linter).toHaveProperty('lintText');
      expect(linter).toHaveProperty('lintFiles');
      expect(linter).toHaveProperty('getConfigForFile');
      expect(linter).toHaveProperty('getRules');
    });

    test('should create linter with config', () => {
      const config: LintConfig = {
        rules: {
          'no-empty-effects': 'error',
        },
      };

      const linter = createLinter(config);

      expect(linter).toBeDefined();
    });
  });

  describe('lintText', () => {
    test('should lint a text string', async () => {
      const linter = createLinter();

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {}
}`;

      const result = await linter.lintText(source);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('errorCount');
      expect(result).toHaveProperty('warningCount');
      expect(Array.isArray(result.messages)).toBe(true);
    });

    test('should accept virtual file path', async () => {
      const linter = createLinter();

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'virtual.json');

      expect(result.filePath).toBe('virtual.json');
    });

    test('should support fix option', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'warn',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "description": "Test"
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json', { fix: true });

      expect(result).toHaveProperty('output');
      if (result.fixableWarningCount > 0) {
        expect(result.output).toBeDefined();
        expect(result.output).not.toBe(source);
      }
    });
  });

  describe('lintFile', () => {
    test('should lint a file by path', async () => {
      const linter = createLinter();

      const result = await linter.lintFile('tests/fixtures/valid/minimal.json');

      expect(result).toBeDefined();
      expect(result.filePath).toContain('minimal.json');
      expect(result.messages).toBeDefined();
    });

    test('should throw on non-existent file', async () => {
      const linter = createLinter();

      await expect(
        linter.lintFile('nonexistent.json')
      ).rejects.toThrow();
    });
  });

  describe('lintFiles', () => {
    test('should lint multiple files', async () => {
      const linter = createLinter();

      const results = await linter.lintFiles(['tests/fixtures/valid/*.json']);

      expect(results).toBeDefined();
      expect(results).toHaveProperty('results');
      expect(results).toHaveProperty('errorCount');
      expect(results).toHaveProperty('warningCount');
      expect(Array.isArray(results.results)).toBe(true);
      expect(results.results.length).toBeGreaterThan(0);
    });

    test('should aggregate error counts', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'error',
        },
      });

      const results = await linter.lintFiles([
        'tests/fixtures/invalid/no-empty-effects.json'
      ]);

      expect(results.errorCount).toBeGreaterThan(0);
      const total = results.results.reduce((sum, r) => sum + r.errorCount, 0);
      expect(results.errorCount).toBe(total);
    });

    test('should support multiple patterns', async () => {
      const linter = createLinter();

      const results = await linter.lintFiles([
        'tests/fixtures/valid/*.json',
        'tests/fixtures/invalid/*.json'
      ]);

      expect(results.results.length).toBeGreaterThan(1);
    });
  });

  describe('getConfigForFile', () => {
    test('should return effective config for file', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'error',
        },
      });

      const config = await linter.getConfigForFile('test.json');

      expect(config).toBeDefined();
      expect(config).toHaveProperty('rules');
    });
  });

  describe('getRules', () => {
    test('should return available rules', () => {
      const linter = createLinter();

      const rules = linter.getRules();

      expect(rules).toBeInstanceOf(Map);
      expect(rules.size).toBeGreaterThan(0);
    });

    test('should include rule metadata', () => {
      const linter = createLinter();

      const rules = linter.getRules();
      const firstRule = rules.values().next().value;

      expect(firstRule).toHaveProperty('meta');
      expect(firstRule.meta).toHaveProperty('category');
      expect(firstRule.meta).toHaveProperty('description');
      expect(firstRule.meta).toHaveProperty('defaultSeverity');
    });
  });
});
