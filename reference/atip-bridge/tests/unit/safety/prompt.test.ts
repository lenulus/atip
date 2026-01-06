import { describe, test, expect } from 'vitest';
import { generateSafetyPrompt } from '../../../src/index';
import type { AtipTool } from '../../../src/index';

describe('generateSafetyPrompt', () => {
  describe('basic prompt generation', () => {
    test('should generate safety prompt for destructive operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          repo: {
            description: 'Repositories',
            commands: {
              delete: {
                description: 'Delete a repository',
                effects: {
                  destructive: true,
                  reversible: false,
                },
              },
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('## Tool Safety Summary');
      expect(prompt).toContain('### Destructive Operations');
      expect(prompt).toContain('gh_repo_delete');
      expect(prompt).toContain('Delete a repository');
    });

    test('should return empty string when no tools provided', () => {
      const prompt = generateSafetyPrompt([]);

      expect(prompt).toBe('');
    });

    test('should return empty string when no unsafe operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'list',
        version: '1.0.0',
        description: 'List tool',
        commands: {
          all: {
            description: 'List all',
            effects: {
              idempotent: true,
              reversible: true,
              destructive: false,
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      // Should have minimal or no content since everything is safe
      expect(prompt).not.toContain('Destructive Operations');
    });
  });

  describe('category grouping', () => {
    test('should group destructive operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          repo: {
            description: 'Repositories',
            commands: {
              delete: {
                description: 'Delete repository',
                effects: { destructive: true },
              },
            },
          },
          gist: {
            description: 'Gists',
            commands: {
              delete: {
                description: 'Delete gist',
                effects: { destructive: true },
              },
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('### Destructive Operations');
      expect(prompt).toContain('gh_repo_delete');
      expect(prompt).toContain('gh_gist_delete');
    });

    test('should group non-reversible operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          repo: {
            description: 'Repos',
            commands: {
              delete: {
                description: 'Delete',
                effects: { reversible: false },
              },
              archive: {
                description: 'Archive',
                effects: { reversible: false },
              },
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('### Non-Reversible Operations');
      expect(prompt).toContain('gh_repo_delete');
      expect(prompt).toContain('gh_repo_archive');
    });

    test('should group non-idempotent operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          pr: {
            description: 'Pull requests',
            commands: {
              create: {
                description: 'Create PR',
                effects: { idempotent: false },
              },
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('### Non-Idempotent Operations');
      expect(prompt).toContain('gh_pr_create');
    });

    test('should group billable operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'api',
        version: '1.0.0',
        description: 'API',
        commands: {
          call: {
            description: 'Make API call',
            effects: {
              cost: {
                billable: true,
              },
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('### Billable Operations');
      expect(prompt).toContain('api_call');
    });

    test('should group network operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'fetch',
        version: '1.0.0',
        description: 'Fetch',
        commands: {
          url: {
            description: 'Fetch URL',
            effects: {
              network: true,
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('### Network Operations');
      expect(prompt).toContain('fetch_url');
    });

    test('should group interactive operations', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'editor',
        version: '1.0.0',
        description: 'Editor',
        commands: {
          open: {
            description: 'Open editor',
            effects: {
              interactive: {
                stdin: 'required',
                prompts: true,
              },
            },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('### Interactive Operations');
      expect(prompt).toContain('editor_open');
    });
  });

  describe('format', () => {
    test('should use markdown format', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: { destructive: true },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toMatch(/^##\s+Tool Safety Summary/);
      expect(prompt).toMatch(/###\s+Destructive Operations/);
      expect(prompt).toMatch(/^-\s+`test_run`:/m);
    });

    test('should include guidance for each category', () => {
      const tool: AtipTool = {
        atip: { version: '0.4' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: { destructive: true },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool]);

      expect(prompt).toContain('permanently destroy data');
      expect(prompt).toContain('confirm with the user');
    });
  });

  describe('multiple tools', () => {
    test('should aggregate safety information from multiple tools', () => {
      const tool1: AtipTool = {
        atip: { version: '0.4' },
        name: 'gh',
        version: '2.45.0',
        description: 'GitHub CLI',
        commands: {
          repo: {
            description: 'Repos',
            commands: {
              delete: {
                description: 'Delete repo',
                effects: { destructive: true },
              },
            },
          },
        },
      };

      const tool2: AtipTool = {
        atip: { version: '0.4' },
        name: 'kubectl',
        version: '1.28.0',
        description: 'Kubernetes CLI',
        commands: {
          delete: {
            description: 'Delete resource',
            effects: { destructive: true },
          },
        },
      };

      const prompt = generateSafetyPrompt([tool1, tool2]);

      expect(prompt).toContain('gh_repo_delete');
      expect(prompt).toContain('kubectl_delete');
    });
  });
});
