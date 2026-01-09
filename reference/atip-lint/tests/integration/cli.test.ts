import { describe, test, expect, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { copyFile, unlink } from 'fs/promises';

const execFileAsync = promisify(execFile);

describe('CLI Integration', () => {
  const cliPath = join(__dirname, '../../dist/cli.js');

  describe('basic invocation', () => {
    test('should run without errors on valid file', async () => {
      const { stdout, stderr } = await execFileAsync('node', [
        cliPath,
        'tests/fixtures/valid/minimal.json'
      ]);

      expect(stdout).toBeDefined();
      expect(stderr).toBe('');
    });

    test('should show help with --help', async () => {
      const { stdout } = await execFileAsync('node', [cliPath, '--help']);

      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('atip-lint');
      expect(stdout).toContain('Commands:');
    });

    test('should show version with --version', async () => {
      const { stdout } = await execFileAsync('node', [cliPath, '--version']);

      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('lint command', () => {
    test('should lint single file', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/valid/minimal.json'
      ]);

      expect(stdout).toBeDefined();
    });

    test('should lint multiple files with glob', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/valid/*.json'
      ]);

      expect(stdout).toBeDefined();
    });

    test('should exit 0 on no errors', async () => {
      try {
        await execFileAsync('node', [
          cliPath,
          'lint',
          'tests/fixtures/valid/complete.json'
        ]);
      } catch (err: any) {
        expect(err.code).toBe(0);
      }
    });

    test('should exit 1 on errors', async () => {
      try {
        await execFileAsync('node', [
          cliPath,
          'lint',
          'tests/fixtures/invalid/missing-required-fields.json',
          '--rule',
          'no-missing-required-fields:error'
        ]);
        // Should not reach here
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe(1);
      }
    });

    test('should exit 2 on config error', async () => {
      try {
        await execFileAsync('node', [
          cliPath,
          'lint',
          'test.json',
          '--config',
          'nonexistent.json'
        ]);
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe(2);
      }
    });
  });

  describe('output formats', () => {
    test('should output stylish format by default', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/invalid/no-empty-effects.json'
      ]);

      expect(stdout).toContain('warning');
      expect(stdout).toMatch(/\d+:\d+/); // line:col
    });

    test('should output JSON with --output json', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/invalid/no-empty-effects.json',
        '--output',
        'json'
      ]);

      expect(() => JSON.parse(stdout)).not.toThrow();
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty('results');
    });

    test('should output SARIF with --output sarif', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/invalid/no-empty-effects.json',
        '--output',
        'sarif'
      ]);

      expect(() => JSON.parse(stdout)).not.toThrow();
      const parsed = JSON.parse(stdout);
      expect(parsed.version).toBe('2.1.0');
    });

    test('should output compact with --output compact', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/invalid/no-empty-effects.json',
        '--output',
        'compact'
      ]);

      const lines = stdout.trim().split('\n');
      lines.forEach(line => {
        expect(line).toMatch(/.*:\d+:\d+:/);
      });
    });
  });

  describe('fix mode', () => {
    const tempFixFile = '/tmp/test-fix-reversible.json';

    beforeEach(async () => {
      // Copy fixture to temp location before each test
      await copyFile('tests/fixtures/fixable/auto-fix-reversible.json', tempFixFile);
    });

    test('should apply fixes with --fix', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        tempFixFile,
        '--fix'
      ]);

      expect(stdout).toContain('fix');

      // Clean up
      await unlink(tempFixFile);
    });

    test('should show fixes without applying with --fix-dry-run', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        tempFixFile,
        '--fix-dry-run'
      ]);

      expect(stdout).toContain('Would fix');

      // Clean up
      await unlink(tempFixFile);
    });
  });

  describe('rule configuration', () => {
    test('should enable rule with --rule', async () => {
      try {
        await execFileAsync('node', [
          cliPath,
          'lint',
          'tests/fixtures/invalid/no-empty-effects.json',
          '--rule',
          'no-empty-effects:error'
        ]);
        expect(true).toBe(false); // Should not reach here
      } catch (err: any) {
        expect(err.stdout).toContain('error');
      }
    });

    test('should disable rule with --disable-rule', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/invalid/no-empty-effects.json',
        '--disable-rule',
        'no-empty-effects'
      ]);

      expect(stdout).not.toContain('no-empty-effects');
    });
  });

  describe('quiet mode', () => {
    test('should suppress warnings with --quiet', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'lint',
        'tests/fixtures/invalid/bad-description.json',
        '--quiet'
      ]);

      expect(stdout).not.toContain('warning');
    });
  });

  describe('max-warnings', () => {
    test('should exit 1 when warnings exceed limit', async () => {
      try {
        await execFileAsync('node', [
          cliPath,
          'lint',
          'tests/fixtures/invalid/bad-description.json',
          '--max-warnings',
          '0'
        ]);
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe(1);
      }
    });
  });

  describe('init command', () => {
    test('should create config file with init', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'init',
        '--path',
        '/tmp/test-atiplintrc.json'
      ]);

      expect(stdout).toContain('Created');
    });

    test('should use preset with --preset', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'init',
        '--preset',
        'strict',
        '--path',
        '/tmp/test-strict.json'
      ]);

      expect(stdout).toContain('strict');
    });
  });

  describe('list-rules command', () => {
    test('should list all rules', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'list-rules'
      ]);

      expect(stdout).toContain('no-empty-effects');
      expect(stdout).toContain('description-quality');
    });

    test('should filter by category', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'list-rules',
        '--category',
        'security'
      ]);

      expect(stdout).toContain('destructive-needs-reversible');
      expect(stdout).not.toContain('no-empty-effects');
    });

    test('should output JSON with --format json', async () => {
      const { stdout } = await execFileAsync('node', [
        cliPath,
        'list-rules',
        '--format',
        'json'
      ]);

      expect(() => JSON.parse(stdout)).not.toThrow();
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty('rules');
    });
  });

  describe('--agent flag (dogfooding)', () => {
    test('should output ATIP metadata', async () => {
      const { stdout } = await execFileAsync('node', [cliPath, '--agent']);

      expect(() => JSON.parse(stdout)).not.toThrow();
      const parsed = JSON.parse(stdout);

      expect(parsed.atip).toBeDefined();
      expect(parsed.name).toBe('atip-lint');
      expect(parsed.commands).toHaveProperty('lint');
      expect(parsed.commands).toHaveProperty('init');
      expect(parsed.commands).toHaveProperty('list-rules');
    });

    test('should include effects metadata', async () => {
      const { stdout } = await execFileAsync('node', [cliPath, '--agent']);

      const parsed = JSON.parse(stdout);

      expect(parsed.commands.lint.effects).toBeDefined();
      expect(parsed.commands.init.effects).toBeDefined();
    });

    test('should declare filesystem read for lint', async () => {
      const { stdout } = await execFileAsync('node', [cliPath, '--agent']);

      const parsed = JSON.parse(stdout);

      expect(parsed.commands.lint.effects.filesystem.read).toBe(true);
    });

    test('should declare filesystem write for init', async () => {
      const { stdout } = await execFileAsync('node', [cliPath, '--agent']);

      const parsed = JSON.parse(stdout);

      expect(parsed.commands.init.effects.filesystem.write).toBe(true);
    });
  });
});
