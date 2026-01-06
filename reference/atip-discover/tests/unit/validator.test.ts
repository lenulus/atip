import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../../src/validator';

describe('ATIP Metadata Validation', () => {
  describe('validateMetadata', () => {
    it('should accept minimal valid ATIP metadata', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'A test tool',
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept legacy ATIP version format', () => {
      const metadata = {
        atip: '0.3',
        name: 'legacy-tool',
        version: '1.0.0',
        description: 'Legacy tool',
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should reject metadata without atip field', () => {
      const metadata = {
        name: 'test-tool',
        version: '1.0.0',
        description: 'Missing atip field',
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: ['atip'],
          message: expect.stringMatching(/required/i),
        })
      );
    });

    it('should reject metadata without name field', () => {
      const metadata = {
        atip: { version: '0.4' },
        version: '1.0.0',
        description: 'Missing name',
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: ['name'],
        })
      );
    });

    it('should reject metadata without version field', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        description: 'Missing version',
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: ['version'],
        })
      );
    });

    it('should reject metadata without description field', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: ['description'],
        })
      );
    });

    it('should accept metadata with commands', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Tool with commands',
        commands: {
          run: {
            description: 'Run command',
            effects: { network: false },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should validate command effects', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Tool with effects',
        commands: {
          delete: {
            description: 'Delete data',
            effects: {
              destructive: true,
              reversible: false,
              network: false,
            },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should reject commands with invalid effect types', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Invalid effects',
        commands: {
          run: {
            description: 'Run',
            effects: {
              destructive: 'maybe', // Should be boolean
            },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
    });

    it('should accept nested commands', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Tool with nested commands',
        commands: {
          pr: {
            description: 'Pull request commands',
            commands: {
              list: {
                description: 'List PRs',
                effects: { network: true },
              },
            },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should validate option types', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Tool with options',
        commands: {
          run: {
            description: 'Run',
            options: [
              {
                name: 'output',
                flags: ['-o', '--output'],
                type: 'string',
                description: 'Output file',
              },
            ],
            effects: { network: false },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid option type', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Invalid option',
        commands: {
          run: {
            description: 'Run',
            options: [
              {
                name: 'bad',
                flags: ['--bad'],
                type: 'invalid-type', // Not a valid type
                description: 'Bad option',
              },
            ],
            effects: { network: false },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
    });

    it('should validate authentication metadata', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Tool with auth',
        authentication: {
          required: true,
          methods: [
            {
              type: 'oauth',
              setupCommand: 'test-tool auth login',
            },
          ],
          checkCommand: 'test-tool auth status',
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should validate trust metadata', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Tool with trust info',
        trust: {
          source: 'native',
          verified: true,
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid trust source', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Invalid trust',
        trust: {
          source: 'unknown', // Should be 'native' or 'community'
          verified: true,
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
    });

    it('should validate partial discovery metadata', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Partial metadata',
        partial: true,
        filter: {
          commands: ['cmd1', 'cmd2'],
          depth: 2,
        },
        omitted: {
          reason: 'filtered',
          safetyAssumption: 'unknown',
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should handle validation errors with multiple issues', () => {
      const metadata = {
        atip: { version: '0.4' },
        // Missing name, version, description
        commands: {
          bad: {
            // Missing description
            effects: {
              destructive: 'not-a-boolean', // Invalid type
            },
          },
        },
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should provide detailed error messages', () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        // Missing description
      };

      const result = validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toHaveProperty('path');
      expect(result.errors[0]).toHaveProperty('message');
      expect(result.errors[0].message).toBeTruthy();
    });

    it('should reject non-object input', () => {
      const result = validateMetadata('not an object');

      expect(result.valid).toBe(false);
    });

    it('should reject null input', () => {
      const result = validateMetadata(null);

      expect(result.valid).toBe(false);
    });

    it('should reject array input', () => {
      const result = validateMetadata([]);

      expect(result.valid).toBe(false);
    });
  });
});
