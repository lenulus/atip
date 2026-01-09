import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('destructive-needs-reversible rule', () => {
  describe('basic check', () => {
    test('should warn when destructive without reversible', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': 'warn',
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
        "network": true
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.warningCount).toBe(1);
      expect(result.messages[0].ruleId).toBe('destructive-needs-reversible');
      expect(result.messages[0].message).toContain('reversible');
    });

    test('should pass when destructive with reversible declared', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': 'warn',
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
        "reversible": false,
        "network": true
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.warningCount).toBe(0);
    });

    test('should pass when not destructive', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': 'warn',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "list": {
      "description": "List items",
      "effects": {
        "network": true
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.warningCount).toBe(0);
    });
  });

  describe('unusual combination detection', () => {
    test('should warn on destructive AND reversible true', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': ['warn', { checkUnusualCombination: true }],
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
        "reversible": true
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.warningCount).toBeGreaterThan(0);
      const warning = result.messages.find(m => m.message.includes('unusual'));
      expect(warning).toBeDefined();
    });
  });

  describe('auto-fix functionality', () => {
    test('should add reversible: false for destructive operations', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': 'warn',
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
        "destructive": true
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json', { fix: true });

      expect(result.fixableWarningCount).toBe(1);
      expect(result.output).toContain('"reversible": false');
    });
  });

  describe('nested commands', () => {
    test('should check nested commands', async () => {
      const linter = createLinter({
        rules: {
          'destructive-needs-reversible': 'error',
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
          "description": "Delete repository",
          "effects": {
            "destructive": true
          }
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].jsonPath).toEqual(['commands', 'repo', 'commands', 'delete', 'effects']);
    });
  });
});
