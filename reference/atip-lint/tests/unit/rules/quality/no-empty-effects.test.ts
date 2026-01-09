import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('no-empty-effects rule', () => {
  describe('rule triggers on missing effects', () => {
    test('should error when command has no effects', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "delete": {
      "description": "Delete something"
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].ruleId).toBe('no-empty-effects');
      expect(result.messages[0].severity).toBe(2); // error
      expect(result.messages[0].message).toContain('effects');
    });

    test('should pass when command has effects', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "delete": {
      "description": "Delete something",
      "effects": {
        "destructive": true,
        "reversible": false
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
      expect(result.messages).toHaveLength(0);
    });
  });

  describe('rule options - minFields', () => {
    test('should require minimum number of effect fields', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': ['error', { minFields: 2 }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "description": "Test command",
      "effects": {
        "network": false
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('at least 2');
    });
  });

  describe('rule options - requiredFields', () => {
    test('should require specific effect fields', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': ['error', { requiredFields: ['network', 'idempotent'] }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "description": "Test command",
      "effects": {
        "network": false
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('idempotent');
    });
  });

  describe('auto-fix functionality', () => {
    test('should add empty effects object', async () => {
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
      "description": "Test command"
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json', { fix: true });

      expect(result.fixableWarningCount).toBe(1);
      expect(result.output).toContain('"effects": {}');
    });
  });

  describe('nested commands', () => {
    test('should check effects in nested commands', async () => {
      const linter = createLinter({
        rules: {
          'no-empty-effects': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "repo": {
      "description": "Repository commands",
      "commands": {
        "delete": {
          "description": "Delete repository"
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].jsonPath).toEqual(['commands', 'repo', 'commands', 'delete']);
    });
  });
});
