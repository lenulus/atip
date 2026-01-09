import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('no-missing-required-fields rule', () => {
  describe('argument validation', () => {
    test('should error when argument missing type', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
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
      "arguments": [
        {
          "name": "input",
          "description": "Input file"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('type');
      expect(result.messages[0].jsonPath).toContain('arguments');
    });

    test('should pass when argument has all required fields', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
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
      "arguments": [
        {
          "name": "input",
          "type": "string",
          "description": "Input file",
          "required": true
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });

  describe('option validation', () => {
    test('should error when option missing type', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
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
          "name": "output",
          "flags": ["-o", "--output"],
          "description": "Output file"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('type');
    });

    test('should error when option missing flags', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
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
          "name": "output",
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
      expect(result.messages[0].message).toContain('flags');
    });
  });

  describe('command validation', () => {
    test('should error when command missing description', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('description');
    });
  });

  describe('enum type validation', () => {
    test('should error when enum type missing enum array', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
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
          "name": "format",
          "flags": ["-f"],
          "type": "enum",
          "description": "Output format"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('enum');
    });

    test('should pass when enum has enum array', async () => {
      const linter = createLinter({
        rules: {
          'no-missing-required-fields': 'error',
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
          "name": "format",
          "flags": ["-f"],
          "type": "enum",
          "enum": ["json", "yaml", "toml"],
          "description": "Output format"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });
});
