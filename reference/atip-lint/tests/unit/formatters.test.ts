import { describe, test, expect } from 'vitest';
import { formatters } from '../../src/index.js';
import type { LintResults } from '../../src/index.js';

describe('Formatters', () => {
  const sampleResults: LintResults = {
    results: [
      {
        filePath: '/path/to/test.json',
        messages: [
          {
            ruleId: 'no-empty-effects',
            severity: 2,
            message: 'Command missing effects',
            line: 10,
            column: 5,
          },
          {
            ruleId: 'description-quality',
            severity: 1,
            message: 'Description too short',
            line: 15,
            column: 3,
          },
        ],
        errorCount: 1,
        warningCount: 1,
        fixableErrorCount: 0,
        fixableWarningCount: 1,
      },
    ],
    errorCount: 1,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 1,
  };

  describe('stylish formatter', () => {
    test('should format results in stylish format', () => {
      const output = formatters.stylish(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      expect(typeof output).toBe('string');
      expect(output).toContain('test.json');
      expect(output).toContain('no-empty-effects');
      expect(output).toContain('error');
      expect(output).toContain('warning');
    });

    test('should include line and column numbers', () => {
      const output = formatters.stylish(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      expect(output).toContain('10:5');
      expect(output).toContain('15:3');
    });

    test('should show summary', () => {
      const output = formatters.stylish(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      expect(output).toContain('1 error');
      expect(output).toContain('1 warning');
    });
  });

  describe('json formatter', () => {
    test('should format results as JSON', () => {
      const output = formatters.json(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('results');
      expect(parsed).toHaveProperty('errorCount');
      expect(parsed).toHaveProperty('warningCount');
    });

    test('should preserve all message metadata', () => {
      const output = formatters.json(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      const parsed = JSON.parse(output);
      const firstMessage = parsed.results[0].messages[0];

      expect(firstMessage).toHaveProperty('ruleId');
      expect(firstMessage).toHaveProperty('severity');
      expect(firstMessage).toHaveProperty('message');
      expect(firstMessage).toHaveProperty('line');
      expect(firstMessage).toHaveProperty('column');
    });
  });

  describe('sarif formatter', () => {
    test('should format results as SARIF 2.1.0', () => {
      const output = formatters.sarif(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.version).toBe('2.1.0');
      expect(parsed).toHaveProperty('runs');
      expect(Array.isArray(parsed.runs)).toBe(true);
    });

    test('should include tool information', () => {
      const output = formatters.sarif(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      const parsed = JSON.parse(output);
      const tool = parsed.runs[0].tool;

      expect(tool).toHaveProperty('driver');
      expect(tool.driver.name).toBe('atip-lint');
    });

    test('should include rule definitions', () => {
      const output = formatters.sarif(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      const parsed = JSON.parse(output);
      const rules = parsed.runs[0].tool.driver.rules;

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    test('should map severity correctly', () => {
      const output = formatters.sarif(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      const parsed = JSON.parse(output);
      const results = parsed.runs[0].results;

      // Severity 2 = error in lint, error in SARIF
      const errorResult = results.find((r: any) => r.ruleId === 'no-empty-effects');
      expect(errorResult.level).toBe('error');

      // Severity 1 = warning in lint, warning in SARIF
      const warningResult = results.find((r: any) => r.ruleId === 'description-quality');
      expect(warningResult.level).toBe('warning');
    });
  });

  describe('compact formatter', () => {
    test('should format results as one-line-per-issue', () => {
      const output = formatters.compact(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      const lines = output.trim().split('\n');
      expect(lines.length).toBe(2); // 2 messages
    });

    test('should include file path, position, severity, and message', () => {
      const output = formatters.compact(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      expect(output).toContain('test.json:10:5');
      expect(output).toContain('error');
      expect(output).toContain('no-empty-effects');
    });

    test('should be grep-friendly', () => {
      const output = formatters.compact(sampleResults, {
        cwd: process.cwd(),
        color: false,
        config: {},
      });

      // Each line should be parseable
      const lines = output.trim().split('\n');
      lines.forEach(line => {
        expect(line).toMatch(/.*:\d+:\d+:/);
      });
    });
  });
});
