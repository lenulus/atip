import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('no-duplicate-flags rule', () => {
  describe('within same option', () => {
    test('should error on duplicate flags in same option', async () => {
      const linter = createLinter({
        rules: {
          'no-duplicate-flags': 'error',
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
          "flags": ["-o", "--output", "-o"],
          "type": "string",
          "description": "Output"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('duplicate');
    });
  });

  describe('across different options', () => {
    test('should error on duplicate flags across options', async () => {
      const linter = createLinter({
        rules: {
          'no-duplicate-flags': 'error',
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
          "type": "string",
          "description": "Output file"
        },
        {
          "name": "open",
          "flags": ["-o", "--open"],
          "type": "boolean",
          "description": "Open after"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('-o');
    });

    test('should pass on unique flags', async () => {
      const linter = createLinter({
        rules: {
          'no-duplicate-flags': 'error',
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
          "type": "string",
          "description": "Output file"
        },
        {
          "name": "force",
          "flags": ["-f", "--force"],
          "type": "boolean",
          "description": "Force operation"
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

  describe('global vs command options', () => {
    test('should detect conflicts between global and command options', async () => {
      const linter = createLinter({
        rules: {
          'no-duplicate-flags': 'error',
        },
      });

      const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "globalOptions": [
    {
      "name": "verbose",
      "flags": ["-v", "--verbose"],
      "type": "boolean",
      "description": "Verbose output"
    }
  ],
  "commands": {
    "test": {
      "description": "Test",
      "options": [
        {
          "name": "version",
          "flags": ["-v", "--version"],
          "type": "boolean",
          "description": "Show version"
        }
      ],
      "effects": {}
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('global');
    });
  });
});
