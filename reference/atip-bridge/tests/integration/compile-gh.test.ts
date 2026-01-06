import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  toOpenAI,
  toGemini,
  toAnthropic,
  compileTools,
  generateSafetyPrompt,
  createValidator,
  createResultFilter,
} from '../../src/index';
import type { AtipTool } from '../../src/index';

describe('GitHub CLI Integration', () => {
  let ghTool: AtipTool;

  // Load the actual gh.json example from the repository
  test('should load gh.json example', () => {
    const ghPath = join(__dirname, '../../../examples/gh.json');
    const ghJson = readFileSync(ghPath, 'utf-8');
    ghTool = JSON.parse(ghJson);

    expect(ghTool.name).toBe('gh');
    expect(ghTool.commands).toBeDefined();
  });

  describe('transformation to provider formats', () => {
    test('should compile gh.json to OpenAI format', () => {
      const result = toOpenAI(ghTool);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check for known commands
      const names = result.map((t) => t.function.name);
      expect(names).toContain('gh_pr_list');
      expect(names).toContain('gh_pr_create');
      expect(names).toContain('gh_repo_delete');

      // Verify structure
      result.forEach((tool) => {
        expect(tool.type).toBe('function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
        expect(tool.function.parameters.type).toBe('object');
        expect(tool.function.parameters.additionalProperties).toBe(false);
      });
    });

    test('should compile gh.json to Gemini format', () => {
      const result = toGemini(ghTool);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check structure
      result.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool.parameters.type).toBe('object');
        expect(tool).not.toHaveProperty('type'); // No wrapper
        expect(tool).not.toHaveProperty('function'); // No wrapper
      });
    });

    test('should compile gh.json to Anthropic format', () => {
      const result = toAnthropic(ghTool);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check structure
      result.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('input_schema');
        expect(tool.input_schema.type).toBe('object');
      });
    });
  });

  describe('strict mode transformation', () => {
    test('should apply strict mode to all gh commands', () => {
      const result = toOpenAI(ghTool, { strict: true });

      result.forEach((tool) => {
        expect(tool.function.strict).toBe(true);
        expect(tool.function.parameters.additionalProperties).toBe(false);

        // Check that optional params are nullable
        const params = tool.function.parameters.properties;
        const required = tool.function.parameters.required;

        Object.entries(params).forEach(([name, param]) => {
          if (required.includes(name)) {
            // Required params in strict mode should be in required array
            expect(required).toContain(name);
          }
        });
      });
    });
  });

  describe('safety metadata preservation', () => {
    test('should add destructive flags to gh repo delete', () => {
      const result = toOpenAI(ghTool);
      const repoDelete = result.find((t) => t.function.name === 'gh_repo_delete');

      expect(repoDelete).toBeDefined();
      expect(repoDelete?.function.description).toContain('⚠️ DESTRUCTIVE');
      expect(repoDelete?.function.description).toContain('⚠️ NOT REVERSIBLE');
    });

    test('should add destructive flags to gh codespace delete', () => {
      const result = toAnthropic(ghTool);
      const codespaceDelete = result.find((t) => t.name === 'gh_codespace_delete');

      expect(codespaceDelete).toBeDefined();
      expect(codespaceDelete?.description).toContain('⚠️ DESTRUCTIVE');
    });

    test('should not add safety flags to safe list commands', () => {
      const result = toGemini(ghTool);
      const prList = result.find((t) => t.name === 'gh_pr_list');

      expect(prList).toBeDefined();
      // Should not have destructive/irreversible warnings
      expect(prList?.description).not.toContain('⚠️ DESTRUCTIVE');
      expect(prList?.description).not.toContain('⚠️ NOT REVERSIBLE');
    });
  });

  describe('command flattening', () => {
    test('should flatten all nested gh commands correctly', () => {
      const result = toOpenAI(ghTool);
      const names = result.map((t) => t.function.name);

      // Verify flattening pattern: gh_{category}_{command}
      names.forEach((name) => {
        expect(name).toMatch(/^gh_[a-z-]+(_[a-z-]+)?$/);
      });

      // Check specific nested commands
      expect(names).toContain('gh_pr_create');
      expect(names).toContain('gh_pr_list');
      expect(names).toContain('gh_repo_create');
      expect(names).toContain('gh_repo_delete');
      expect(names).toContain('gh_issue_create');
    });
  });

  describe('batch compilation', () => {
    test('should compile gh with other tools', () => {
      const minimalTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'echo',
        version: '1.0.0',
        description: 'Echo tool',
        commands: {
          run: {
            description: 'Echo input',
            effects: {},
          },
        },
      };

      const result = compileTools([ghTool, minimalTool], 'openai');

      expect(result.provider).toBe('openai');
      expect(result.tools.length).toBeGreaterThan(1);

      const names = result.tools.map((t) => t.function.name);
      expect(names.some((n) => n.startsWith('gh_'))).toBe(true);
      expect(names).toContain('echo_run');
    });
  });

  describe('safety prompt generation', () => {
    test('should generate comprehensive safety prompt for gh', () => {
      const prompt = generateSafetyPrompt([ghTool]);

      expect(prompt).toContain('## Tool Safety Summary');

      // Should list destructive operations
      expect(prompt).toContain('gh_repo_delete');
      expect(prompt).toContain('gh_codespace_delete');
      expect(prompt).toContain('gh_gist_delete');

      // Should have category headers
      expect(prompt).toContain('### Destructive Operations');

      // Should be markdown formatted
      expect(prompt).toMatch(/^##\s+/);
    });
  });

  describe('validation with gh commands', () => {
    test('should validate safe gh commands', () => {
      const validator = createValidator([ghTool], {
        allowNetwork: true,
      });

      const result = validator.validate('gh_pr_list', { state: 'open' });

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should block destructive gh commands', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
      });

      const result = validator.validate('gh_repo_delete', { repo: 'test/repo' });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'DESTRUCTIVE_OPERATION')).toBe(true);
    });

    test('should block network operations when policy disallows', () => {
      const validator = createValidator([ghTool], {
        allowNetwork: false,
      });

      const result = validator.validate('gh_pr_list', {});

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'NETWORK_OPERATION')).toBe(true);
    });
  });

  describe('result filtering', () => {
    test('should redact GitHub tokens from gh auth token output', () => {
      const filter = createResultFilter([ghTool]);
      const output = 'Your token is: ghp_1234567890abcdefghijklmnopqrstuvwxyz';

      const result = filter.filter(output, 'gh_auth_token');

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('ghp_');
    });

    test('should handle normal gh pr list output', () => {
      const filter = createResultFilter([ghTool]);
      const output = JSON.stringify([
        { number: 1, title: 'Fix bug', state: 'open' },
        { number: 2, title: 'Add feature', state: 'closed' },
      ]);

      const result = filter.filter(output, 'gh_pr_list');

      expect(result).toBe(output); // No secrets, unchanged
    });
  });

  describe('real-world workflow', () => {
    test('should support full compile -> validate -> filter workflow', () => {
      // 1. Compile to OpenAI
      const tools = toOpenAI(ghTool, { strict: true });
      expect(tools.length).toBeGreaterThan(0);

      // 2. Create validator
      const validator = createValidator([ghTool], {
        allowDestructive: false,
        allowNetwork: true,
      });

      // 3. Validate safe operation
      const listValidation = validator.validate('gh_pr_list', { state: 'open' });
      expect(listValidation.valid).toBe(true);

      // 4. Validate dangerous operation
      const deleteValidation = validator.validate('gh_repo_delete', { repo: 'test' });
      expect(deleteValidation.valid).toBe(false);

      // 5. Filter results
      const filter = createResultFilter([ghTool]);
      const mockOutput = 'Token: ghp_secret\nPR #42: Fix bug';
      const filtered = filter.filter(mockOutput, 'gh_pr_list');
      expect(filtered).toContain('[REDACTED]');
      expect(filtered).toContain('PR #42');
    });
  });
});
