import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('description-quality rule', () => {
  describe('minimum length check', () => {
    test('should error on too short description', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { minLength: 10 }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Short",
  "commands": {
    "test": {
      "description": "Test",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBeGreaterThan(0);
      const descErrors = result.messages.filter(m => m.message.includes('too short'));
      expect(descErrors.length).toBeGreaterThan(0);
    });

    test('should pass on sufficient length', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { minLength: 10 }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "This is a properly sized description",
  "commands": {
    "test": {
      "description": "Test command description",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });

  describe('maximum length check', () => {
    test('should error on too long description', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { maxLength: 50 }],
        },
      });

      const longDesc = 'This is an extremely long description that exceeds the maximum allowed length';
      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "${longDesc}",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('too long');
    });
  });

  describe('placeholder detection', () => {
    test('should detect TODO placeholder', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "TODO: add description",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('placeholder');
    });

    test('should detect FIXME placeholder', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "FIXME: needs work",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('placeholder');
    });

    test('should allow custom placeholder patterns', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { placeholderPatterns: ['DRAFT', 'WIP'] }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "DRAFT: work in progress",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
    });
  });

  describe('sentence case check', () => {
    test('should require uppercase first letter', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { requireSentenceCase: true }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "lowercase start is bad",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('uppercase');
    });
  });

  describe('ending punctuation check', () => {
    test('should require ending punctuation when enabled', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { requireEndingPunctuation: true }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Missing punctuation",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('punctuation');
    });

    test('should pass with period', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': ['error', { requireEndingPunctuation: true }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Has proper punctuation.",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });

  describe('whitespace trimming', () => {
    test('should detect leading/trailing whitespace', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': 'warn',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "  Whitespace problem  ",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.warningCount).toBeGreaterThan(0);
      const wsWarning = result.messages.find(m => m.message.includes('whitespace'));
      expect(wsWarning).toBeDefined();
    });

    test('should auto-fix whitespace', async () => {
      const linter = createLinter({
        rules: {
          'description-quality': 'warn',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "  Trimmed  ",
  "commands": {}
}`;

      const result = await linter.lintText(source, 'test.json', { fix: true });

      expect(result.output).toContain('"Trimmed"');
      expect(result.output).not.toContain('"  Trimmed  "');
    });
  });
});
