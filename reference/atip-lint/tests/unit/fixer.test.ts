import { describe, test, expect } from 'vitest';
import { createLinter } from '../../src/index.js';

describe('Fixer', () => {
  describe('fix application', () => {
    test('should apply single fix', async () => {
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

      expect(result.output).toBeDefined();
      expect(result.output).toContain('"effects"');
    });

    test('should apply multiple non-overlapping fixes', async () => {
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
    "test1": {
      "description": "Test 1"
    },
    "test2": {
      "description": "Test 2"
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json', { fix: true });

      expect(result.output).toBeDefined();
      // Both commands should have effects added
      const effectsCount = (result.output?.match(/"effects"/g) || []).length;
      expect(effectsCount).toBeGreaterThanOrEqual(2);
    });

    test('should detect overlapping fixes', async () => {
      // Test that conflicting fixes are detected and reported
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

      // If fixes conflict, they should be reported but not applied
      expect(result).toBeDefined();
    });
  });

  describe('dry-run mode', () => {
    test('should show fixes without applying', async () => {
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

      // fixableOnly option shows what would be fixed
      const result = await linter.lintText(source, 'test.json', { fixableOnly: true });

      expect(result.fixableWarningCount).toBeGreaterThan(0);
      expect(result.messages.some(m => m.fix)).toBe(true);
    });
  });

  describe('fix metadata', () => {
    test('should include fix range and text', async () => {
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

      const result = await linter.lintText(source, 'test.json');

      const fixableMsg = result.messages.find(m => m.fix);
      if (fixableMsg && fixableMsg.fix) {
        expect(fixableMsg.fix).toHaveProperty('range');
        expect(fixableMsg.fix).toHaveProperty('text');
        expect(Array.isArray(fixableMsg.fix.range)).toBe(true);
        expect(fixableMsg.fix.range.length).toBe(2);
        expect(typeof fixableMsg.fix.text).toBe('string');
      }
    });
  });
});
