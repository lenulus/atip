import { describe, test, expect } from 'vitest';
import { createLinter } from '../../../../src/index.js';

describe('valid-effects-values rule', () => {
  describe('boolean field validation', () => {
    test('should error on non-boolean destructive', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "destructive": "yes"
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('boolean');
    });

    test('should error on non-boolean network', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "network": 1
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('boolean');
    });

    test('should pass on valid boolean values', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "destructive": true,
        "reversible": false,
        "network": true,
        "idempotent": false
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });

  describe('enum field validation', () => {
    test('should error on invalid cost.estimate', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "cost": {
          "estimate": "expensive"
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('estimate');
    });

    test('should pass on valid cost.estimate', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
        },
      });

      const validValues = ['free', 'low', 'medium', 'high'];

      for (const value of validValues) {
        const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "description": "Test",
      "effects": {
        "cost": {
          "estimate": "${value}"
        }
      }
    }
  }
}`;

        const result = await linter.lintText(source, 'test.json');
        expect(result.errorCount).toBe(0);
      }
    });

    test('should error on invalid interactive.stdin', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "interactive": {
          "stdin": "always"
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('stdin');
    });

    test('should pass on valid interactive.stdin', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
        },
      });

      const validValues = ['none', 'optional', 'required', 'password'];

      for (const value of validValues) {
        const source = `{
  "atip": { "version": "0.4" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "test": {
      "description": "Test",
      "effects": {
        "interactive": {
          "stdin": "${value}"
        }
      }
    }
  }
}`;

        const result = await linter.lintText(source, 'test.json');
        expect(result.errorCount).toBe(0);
      }
    });
  });

  describe('filesystem nested fields', () => {
    test('should validate filesystem.read is boolean', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "filesystem": {
          "read": "true"
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(1);
      expect(result.messages[0].message).toContain('boolean');
    });
  });

  describe('duration format validation', () => {
    test('should validate duration strings', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "duration": {
          "typical": "fast"
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      // Should error on invalid duration format
      expect(result.errorCount).toBeGreaterThan(0);
    });

    test('should pass on valid duration format', async () => {
      const linter = createLinter({
        rules: {
          'valid-effects-values': 'error',
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
      "effects": {
        "duration": {
          "typical": "5s",
          "timeout": "30s"
        }
      }
    }
  }
}`;

      const result = await linter.lintText(source, 'test.json');

      expect(result.errorCount).toBe(0);
    });
  });
});
