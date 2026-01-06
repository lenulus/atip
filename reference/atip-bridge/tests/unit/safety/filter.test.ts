import { describe, test, expect } from 'vitest';
import { createResultFilter, DEFAULT_REDACT_PATTERNS } from '../../../src/index';
import type { AtipTool } from '../../../src/index';

describe('createResultFilter', () => {
  describe('basic filtering', () => {
    test('should create a filter instance', () => {
      const filter = createResultFilter([]);

      expect(filter).toHaveProperty('filter');
      expect(typeof filter.filter).toBe('function');
    });

    test('should pass through safe content unchanged', () => {
      const filter = createResultFilter([]);
      const safeContent = 'This is safe output with no secrets';

      const result = filter.filter(safeContent, 'test_tool');

      expect(result).toBe(safeContent);
    });
  });

  describe('secret redaction', () => {
    test('should redact GitHub tokens (ghp_ prefix)', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Token: ghp_1234567890abcdef1234567890abcdef12';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('ghp_');
    });

    test('should redact GitHub OAuth tokens (gho_ prefix)', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'OAuth: gho_1234567890abcdef1234567890abcdef12';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('gho_');
    });

    test('should redact GitHub refresh tokens (ghr_ prefix)', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Refresh: ghs_1234567890abcdef1234567890abcdef12';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('ghs_');
    });

    test('should redact GitHub user tokens (ghu_ prefix)', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'User: ghu_1234567890abcdef1234567890abcdef12';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('ghu_');
    });

    test('should redact AWS access keys', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Access Key: AKIAIOSFODNN7EXAMPLE';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('AKIA');
    });

    test('should redact Bearer tokens', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('Bearer ey');
    });

    test('should redact Basic auth credentials', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Authorization: Basic dXNlcjpwYXNzd29yZA==';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('Basic d');
    });

    test('should redact password values', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Config: password=secret123';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('secret123');
    });

    test('should redact secret values', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Secret: secret=mysecret';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('mysecret');
    });

    test('should redact token values', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'Auth token=abc123xyz';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('abc123xyz');
    });

    test('should redact api_key values', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = 'API key: api_key=sk-1234567890';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('sk-1234567890');
    });

    test('should not redact when redactSecrets is false', () => {
      const filter = createResultFilter([], { redactSecrets: false });
      const output = 'Token: ghp_1234567890abcdef1234567890abcdef12';

      const result = filter.filter(output, 'test_tool');

      expect(result).toBe(output);
      expect(result).toContain('ghp_');
    });
  });

  describe('custom patterns', () => {
    test('should apply custom redaction patterns', () => {
      const customPattern = /SSN:\s*\d{3}-\d{2}-\d{4}/g;
      const filter = createResultFilter([], {
        redactPatterns: [customPattern],
      });
      const output = 'User SSN: 123-45-6789';

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('123-45-6789');
    });

    test('should combine default and custom patterns', () => {
      const customPattern = /credit_card=\d{16}/gi;
      const filter = createResultFilter([], {
        redactSecrets: true,
        redactPatterns: [...DEFAULT_REDACT_PATTERNS, customPattern],
      });
      const output = `
        GitHub token: ghp_1234567890abcdef1234567890abcdef12
        Credit: credit_card=4111111111111111
      `;

      const result = filter.filter(output, 'test_tool');

      expect(result).not.toContain('ghp_');
      expect(result).not.toContain('4111111111111111');
      expect(result.match(/\[REDACTED\]/g)?.length).toBeGreaterThan(1);
    });
  });

  describe('length truncation', () => {
    test('should truncate results exceeding maxLength', () => {
      const filter = createResultFilter([], { maxLength: 100 });
      const longOutput = 'A'.repeat(200);

      const result = filter.filter(longOutput, 'test_tool');

      expect(result.length).toBeLessThanOrEqual(100 + '[TRUNCATED]'.length);
      expect(result).toContain('[TRUNCATED]');
    });

    test('should not truncate results under maxLength', () => {
      const filter = createResultFilter([], { maxLength: 1000 });
      const shortOutput = 'A'.repeat(100);

      const result = filter.filter(shortOutput, 'test_tool');

      expect(result).toBe(shortOutput);
      expect(result).not.toContain('[TRUNCATED]');
    });

    test('should use default maxLength of 100000', () => {
      const filter = createResultFilter([]);
      const normalOutput = 'A'.repeat(50000);

      const result = filter.filter(normalOutput, 'test_tool');

      expect(result).toBe(normalOutput);
    });

    test('should append truncation marker at end', () => {
      const filter = createResultFilter([], { maxLength: 50 });
      const longOutput = 'A'.repeat(100);

      const result = filter.filter(longOutput, 'test_tool');

      expect(result.endsWith('[TRUNCATED]')).toBe(true);
    });
  });

  describe('combined filtering', () => {
    test('should redact secrets and truncate in one pass', () => {
      const filter = createResultFilter([], {
        maxLength: 100,
        redactSecrets: true,
      });
      const output = 'Token: ghp_1234567890abcdef1234567890abcdef12\n' + 'A'.repeat(200);

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('[REDACTED]');
      expect(result).toContain('[TRUNCATED]');
      expect(result).not.toContain('ghp_');
      expect(result.length).toBeLessThanOrEqual(120); // maxLength + markers
    });

    test('should redact multiple secrets in same output', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = `
        GitHub: ghp_1234567890abcdef1234567890abcdef12
        AWS: AKIAIOSFODNN7EXAMPLE
        Password: password=secret123
      `;

      const result = filter.filter(output, 'test_tool');

      expect(result.match(/\[REDACTED\]/g)?.length).toBe(3);
      expect(result).not.toContain('ghp_');
      expect(result).not.toContain('AKIA');
      expect(result).not.toContain('secret123');
    });
  });

  describe('tool-specific filtering', () => {
    test('should accept tool metadata for tool-specific rules', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          auth: {
            description: 'Auth',
            commands: {
              token: {
                description: 'Get token',
                effects: {},
              },
            },
          },
        },
      };

      const filter = createResultFilter([tool]);
      const output = 'Token: ghp_1234567890abcdef1234567890abcdef12';

      const result = filter.filter(output, 'gh_auth_token');

      expect(result).toContain('[REDACTED]');
    });
  });

  describe('edge cases', () => {
    test('should handle empty output', () => {
      const filter = createResultFilter([]);
      const result = filter.filter('', 'test_tool');

      expect(result).toBe('');
    });

    test('should handle output with only whitespace', () => {
      const filter = createResultFilter([]);
      const output = '   \n\t  \n  ';
      const result = filter.filter(output, 'test_tool');

      expect(result).toBe(output);
    });

    test('should preserve structure when redacting', () => {
      const filter = createResultFilter([], { redactSecrets: true });
      const output = `{
  "token": "ghp_1234567890abcdef1234567890abcdef12",
  "user": "alice"
}`;

      const result = filter.filter(output, 'test_tool');

      expect(result).toContain('"user": "alice"');
      expect(result).not.toContain('ghp_');
      // Should maintain JSON structure
      expect(result).toMatch(/\{[\s\S]*\}/);
    });
  });
});
