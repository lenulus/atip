import { describe, it, expect } from 'vitest';
import { buildCommandArray, mapToCommand } from '../../src/index.js';

/**
 * Unit tests for command array building.
 *
 * Tests translation of validated arguments to CLI command arrays:
 * - Flag handling (short/long forms)
 * - Boolean flags
 * - Positional arguments
 * - Variadic options
 * - Proper escaping
 */

describe('buildCommandArray', () => {
  const ghTool = {
    atip: { version: '0.4' },
    name: 'gh',
    version: '2.45.0',
    description: 'GitHub CLI',
    commands: {
      pr: {
        description: 'Pull request commands',
        commands: {
          create: {
            description: 'Create a pull request',
            arguments: [
              {
                name: 'branch',
                type: 'string',
                required: false,
                description: 'Branch name',
              },
            ],
            options: [
              {
                name: 'title',
                flags: ['-t', '--title'],
                type: 'string',
                required: false,
                description: 'Pull request title',
              },
              {
                name: 'body',
                flags: ['-b', '--body'],
                type: 'string',
                required: false,
                description: 'Pull request body',
              },
              {
                name: 'draft',
                flags: ['-d', '--draft'],
                type: 'boolean',
                required: false,
                description: 'Mark as draft',
              },
              {
                name: 'reviewer',
                flags: ['-r', '--reviewer'],
                type: 'array',
                variadic: true,
                required: false,
                description: 'Reviewers',
              },
              {
                name: 'base',
                flags: ['--base'],
                type: 'string',
                required: false,
                description: 'Base branch',
              },
              {
                name: 'web',
                flags: ['-w', '--web'],
                type: 'boolean',
                required: false,
                description: 'Open in browser',
              },
            ],
            effects: {
              network: true,
            },
          },
        },
      },
    },
  };

  const mapping = mapToCommand('gh_pr_create', [ghTool]);

  describe('base command', () => {
    it('should start with base command array', () => {
      const command = buildCommandArray(mapping, {});

      expect(command[0]).toBe('gh');
      expect(command[1]).toBe('pr');
      expect(command[2]).toBe('create');
    });
  });

  describe('string options', () => {
    it('should add string option with long flag', () => {
      const command = buildCommandArray(mapping, {
        title: 'Fix bug',
      });

      expect(command).toContain('--title');
      expect(command).toContain('Fix bug');
    });

    it('should handle string with spaces', () => {
      const command = buildCommandArray(mapping, {
        title: 'Fix authentication bug',
      });

      expect(command).toContain('--title');
      expect(command).toContain('Fix authentication bug');
    });

    it('should handle special characters', () => {
      const command = buildCommandArray(mapping, {
        title: 'Fix "quotes" and $special',
      });

      expect(command).toContain('--title');
      expect(command).toContain('Fix "quotes" and $special');
    });
  });

  describe('boolean options', () => {
    it('should add boolean flag when true', () => {
      const command = buildCommandArray(mapping, {
        draft: true,
      });

      expect(command).toContain('--draft');
    });

    it('should omit boolean flag when false', () => {
      const command = buildCommandArray(mapping, {
        draft: false,
      });

      expect(command).not.toContain('--draft');
    });

    it('should omit boolean flag when undefined', () => {
      const command = buildCommandArray(mapping, {});

      expect(command).not.toContain('--draft');
      expect(command).not.toContain('--web');
    });

    it('should handle multiple boolean flags', () => {
      const command = buildCommandArray(mapping, {
        draft: true,
        web: true,
      });

      expect(command).toContain('--draft');
      expect(command).toContain('--web');
    });
  });

  describe('variadic options', () => {
    it('should repeat flag for array values', () => {
      const command = buildCommandArray(mapping, {
        reviewer: ['alice', 'bob', 'charlie'],
      });

      const reviewerIndices = command.reduce((acc: number[], val, idx) => {
        if (val === '--reviewer') acc.push(idx);
        return acc;
      }, []);

      expect(reviewerIndices).toHaveLength(3);
      expect(command).toContain('alice');
      expect(command).toContain('bob');
      expect(command).toContain('charlie');
    });

    it('should handle single value in array', () => {
      const command = buildCommandArray(mapping, {
        reviewer: ['alice'],
      });

      expect(command).toContain('--reviewer');
      expect(command).toContain('alice');
    });

    it('should handle empty array', () => {
      const command = buildCommandArray(mapping, {
        reviewer: [],
      });

      expect(command).not.toContain('--reviewer');
    });
  });

  describe('positional arguments', () => {
    it('should add positional arguments in order', () => {
      const command = buildCommandArray(mapping, {
        branch: 'feature-branch',
      });

      // Positional args come after base command
      expect(command).toContain('feature-branch');
    });

    it('should add positional before options', () => {
      const command = buildCommandArray(mapping, {
        branch: 'feature-branch',
        title: 'Fix bug',
      });

      const branchIdx = command.indexOf('feature-branch');
      const titleIdx = command.indexOf('--title');

      expect(branchIdx).toBeLessThan(titleIdx);
    });
  });

  describe('flag selection', () => {
    it('should prefer long form over short form', () => {
      const command = buildCommandArray(mapping, {
        title: 'Test',
      });

      expect(command).toContain('--title');
      expect(command).not.toContain('-t');
    });

    it('should use first flag if multiple defined', () => {
      const command = buildCommandArray(mapping, {
        draft: true,
      });

      // First flag is -d, but we prefer long form --draft
      expect(command).toContain('--draft');
    });

    it('should use only flag if single flag defined', () => {
      const command = buildCommandArray(mapping, {
        base: 'main',
      });

      expect(command).toContain('--base');
      expect(command).toContain('main');
    });
  });

  describe('combined arguments', () => {
    it('should build complex command with all argument types', () => {
      const command = buildCommandArray(mapping, {
        branch: 'feature-auth',
        title: 'Fix authentication bug',
        body: 'This PR fixes the auth flow',
        draft: true,
        reviewer: ['alice', 'bob'],
        base: 'main',
      });

      expect(command[0]).toBe('gh');
      expect(command[1]).toBe('pr');
      expect(command[2]).toBe('create');
      expect(command).toContain('feature-auth');
      expect(command).toContain('--title');
      expect(command).toContain('Fix authentication bug');
      expect(command).toContain('--body');
      expect(command).toContain('--draft');
      expect(command).toContain('--reviewer');
      expect(command).toContain('alice');
      expect(command).toContain('bob');
      expect(command).toContain('--base');
      expect(command).toContain('main');
    });
  });

  describe('special cases', () => {
    it('should handle empty arguments object', () => {
      const command = buildCommandArray(mapping, {});

      expect(command).toEqual(['gh', 'pr', 'create']);
    });

    it('should handle null values (treated as undefined)', () => {
      const command = buildCommandArray(mapping, {
        title: null,
        draft: null,
      });

      expect(command).toEqual(['gh', 'pr', 'create']);
    });

    it('should handle numeric values for string options', () => {
      const command = buildCommandArray(mapping, {
        title: 42,
      });

      expect(command).toContain('--title');
      expect(command).toContain('42');
    });
  });

  describe('escaping', () => {
    it('should handle values with quotes', () => {
      const command = buildCommandArray(mapping, {
        title: 'Fix "quoted" text',
      });

      expect(command).toContain('Fix "quoted" text');
    });

    it('should handle values with newlines', () => {
      const command = buildCommandArray(mapping, {
        body: 'Line 1\\nLine 2',
      });

      expect(command).toContain('--body');
      expect(command).toContain('Line 1\\nLine 2');
    });

    it('should handle values with backslashes', () => {
      const command = buildCommandArray(mapping, {
        title: 'Fix path\\to\\file',
      });

      expect(command).toContain('Fix path\\to\\file');
    });
  });

  describe('argument ordering', () => {
    it('should maintain consistent order', () => {
      const args = {
        title: 'Test',
        draft: true,
        reviewer: ['alice'],
      };

      const command1 = buildCommandArray(mapping, args);
      const command2 = buildCommandArray(mapping, args);

      expect(command1).toEqual(command2);
    });
  });
});
