import { describe, it, expect } from 'vitest';
import { mapToCommand } from '../../src/index.js';

/**
 * Unit tests for command mapping functionality.
 *
 * Tests the inverse operation of atip-bridge flattening:
 * - gh_pr_create → ["gh", "pr", "create"]
 * - Nested command resolution
 * - Effects merging (command + tool level)
 */

describe('mapToCommand', () => {
  const ghTool = {
    atip: { version: '0.4' },
    name: 'gh',
    version: '2.45.0',
    description: 'GitHub CLI',
    effects: {
      network: true,
      idempotent: true,
      reversible: true,
      destructive: false,
    },
    commands: {
      pr: {
        description: 'Pull request commands',
        commands: {
          create: {
            description: 'Create a pull request',
            effects: {
              network: true,
              idempotent: false,
              reversible: false,
              destructive: false,
            },
            options: [
              {
                name: 'title',
                flags: ['-t', '--title'],
                type: 'string',
                required: true,
                description: 'Pull request title',
              },
              {
                name: 'draft',
                flags: ['-d', '--draft'],
                type: 'boolean',
                required: false,
                description: 'Mark as draft',
              },
            ],
          },
          list: {
            description: 'List pull requests',
            effects: {
              network: true,
              idempotent: true,
              reversible: true,
              destructive: false,
            },
          },
        },
      },
      repo: {
        description: 'Repository commands',
        commands: {
          delete: {
            description: 'Delete a repository',
            effects: {
              network: true,
              idempotent: false,
              reversible: false,
              destructive: true,
            },
          },
        },
      },
    },
  };

  describe('basic mapping', () => {
    it('should map flattened name to command array', () => {
      const mapping = mapToCommand('gh_pr_create', [ghTool]);

      expect(mapping).toBeDefined();
      expect(mapping.command).toEqual(['gh', 'pr', 'create']);
      expect(mapping.tool.name).toBe('gh');
      expect(mapping.path).toEqual(['pr', 'create']);
    });

    it('should map nested commands correctly', () => {
      const mapping = mapToCommand('gh_pr_list', [ghTool]);

      expect(mapping).toBeDefined();
      expect(mapping.command).toEqual(['gh', 'pr', 'list']);
      expect(mapping.path).toEqual(['pr', 'list']);
    });

    it('should return undefined for unknown commands', () => {
      const mapping = mapToCommand('gh_unknown_command', [ghTool]);

      expect(mapping).toBeUndefined();
    });

    it('should return undefined for unknown tools', () => {
      const mapping = mapToCommand('kubectl_get_pods', [ghTool]);

      expect(mapping).toBeUndefined();
    });
  });

  describe('metadata extraction', () => {
    it('should include command metadata', () => {
      const mapping = mapToCommand('gh_pr_create', [ghTool]);

      expect(mapping.metadata.description).toBe('Create a pull request');
      expect(mapping.metadata.options).toHaveLength(2);
    });

    it('should include tool metadata', () => {
      const mapping = mapToCommand('gh_pr_create', [ghTool]);

      expect(mapping.tool.name).toBe('gh');
      expect(mapping.tool.version).toBe('2.45.0');
    });
  });

  describe('effects merging', () => {
    it('should merge command and tool-level effects', () => {
      const mapping = mapToCommand('gh_pr_create', [ghTool]);

      // Command effects should take precedence
      expect(mapping.effects.idempotent).toBe(false);
      expect(mapping.effects.reversible).toBe(false);

      // Network is true in both, should be true
      expect(mapping.effects.network).toBe(true);
    });

    it('should use conservative merging (most restrictive wins)', () => {
      const mapping = mapToCommand('gh_repo_delete', [ghTool]);

      // destructive: true should win
      expect(mapping.effects.destructive).toBe(true);
    });
  });

  describe('custom separator', () => {
    it('should support custom separator in options', () => {
      const mapping = mapToCommand('gh.pr.create', [ghTool], { separator: '.' });

      expect(mapping).toBeDefined();
      expect(mapping.command).toEqual(['gh', 'pr', 'create']);
    });

    it('should support hyphen separator', () => {
      const mapping = mapToCommand('gh-pr-create', [ghTool], { separator: '-' });

      expect(mapping).toBeDefined();
      expect(mapping.command).toEqual(['gh', 'pr', 'create']);
    });
  });

  describe('multiple tools', () => {
    const kubectlTool = {
      atip: { version: '0.4' },
      name: 'kubectl',
      version: '1.28.0',
      description: 'Kubernetes CLI',
      commands: {
        get: {
          description: 'Get resources',
          commands: {
            pods: {
              description: 'Get pods',
              effects: {
                network: true,
                idempotent: true,
              },
            },
          },
        },
      },
    };

    it('should search multiple tools and find correct one', () => {
      const mapping = mapToCommand('kubectl_get_pods', [ghTool, kubectlTool]);

      expect(mapping).toBeDefined();
      expect(mapping.tool.name).toBe('kubectl');
      expect(mapping.command).toEqual(['kubectl', 'get', 'pods']);
    });

    it('should return first match if multiple tools have same command', () => {
      const tools = [ghTool, ghTool]; // Duplicate for testing
      const mapping = mapToCommand('gh_pr_create', tools);

      expect(mapping).toBeDefined();
      expect(mapping.tool).toBe(tools[0]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty tools array', () => {
      const mapping = mapToCommand('gh_pr_create', []);

      expect(mapping).toBeUndefined();
    });

    it('should handle root-level commands (no nesting)', () => {
      const simpleTool = {
        atip: { version: '0.4' },
        name: 'echo',
        version: '1.0.0',
        description: 'Echo command',
        commands: {
          run: {
            description: 'Echo text',
            effects: { network: false },
          },
        },
      };

      const mapping = mapToCommand('echo_run', [simpleTool]);

      expect(mapping).toBeDefined();
      expect(mapping.command).toEqual(['echo', 'run']);
      expect(mapping.path).toEqual(['run']);
    });

    it('should handle deeply nested commands', () => {
      const deepTool = {
        atip: { version: '0.4' },
        name: 'tool',
        version: '1.0.0',
        description: 'Deep tool',
        commands: {
          level1: {
            description: 'Level 1',
            commands: {
              level2: {
                description: 'Level 2',
                commands: {
                  level3: {
                    description: 'Level 3',
                    effects: { network: false },
                  },
                },
              },
            },
          },
        },
      };

      const mapping = mapToCommand('tool_level1_level2_level3', [deepTool]);

      expect(mapping).toBeDefined();
      expect(mapping.command).toEqual(['tool', 'level1', 'level2', 'level3']);
      expect(mapping.path).toEqual(['level1', 'level2', 'level3']);
    });
  });
});
