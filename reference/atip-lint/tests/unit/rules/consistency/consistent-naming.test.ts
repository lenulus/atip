import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('consistent-naming rule', () => {
  describe('kebab-case convention (default)', () => {
    test('should pass on kebab-case commands', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "list-items": {
      "description": "List items",
      "effects": {}
    },
    "delete-item": {
      "description": "Delete item",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });

    test('should error on mixed naming styles', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "listItems": {
      "description": "List items (camelCase)",
      "effects": {}
    },
    "delete-item": {
      "description": "Delete item (kebab-case)",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.messages.some(m => m.message.includes('naming'))).toBe(true);
    });

    test('should error on snake_case when kebab-case expected', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': ['error', { commandCase: 'kebab-case' }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "list_items": {
      "description": "List items",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('kebab-case');
    });
  });

  describe('camelCase convention', () => {
    test('should pass on camelCase commands', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': ['error', { commandCase: 'camelCase' }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "listItems": {
      "description": "List items",
      "effects": {}
    },
    "deleteItem": {
      "description": "Delete item",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });

  describe('option naming consistency', () => {
    test('should check option name conventions', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': ['error', { optionCase: 'kebab-case' }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "description": "Test",
      "options": [
        {
          "name": "outputFile",
          "flags": ["--output-file"],
          "type": "string",
          "description": "Output file"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('option');
    });
  });

  describe('allow numbers option', () => {
    test('should allow numbers when enabled', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': ['error', { allowNumbers: true }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "ipv4-address": {
      "description": "Get IPv4 address",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });

    test('should reject numbers when disabled', async () => {
      const linter = createLinter({
        rules: {
          'consistent-naming': ['error', { allowNumbers: false }],
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test2": {
      "description": "Test 2",
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
    });
  });
});
