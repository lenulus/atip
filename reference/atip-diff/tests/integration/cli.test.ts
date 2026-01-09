import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);
const CLI_PATH = join(__dirname, '../../dist/cli.js');
const FIXTURES_PATH = join(__dirname, '../fixtures');

describe('CLI Integration', () => {
  describe('diff command', () => {
    it('should execute diff command successfully', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json');

      const { stdout, stderr } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile}`);

      expect(stderr).toBe('');
      expect(stdout).toContain('NON-BREAKING CHANGES');
      expect(stdout).toContain('optional-argument-added');
    });

    it('should detect breaking changes', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'breaking/required-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile}`);

      expect(stdout).toContain('BREAKING CHANGES');
      expect(stdout).toContain('required-argument-added');
    });

    it('should output JSON format with --output json', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --output json`);

      const parsed = JSON.parse(stdout);
      expect(parsed.summary).toBeDefined();
      expect(parsed.changes).toBeDefined();
      expect(parsed.semverRecommendation).toBeDefined();
    });

    it('should output markdown format with --output markdown', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --output markdown`);

      expect(stdout).toContain('##');
      expect(stdout).toContain('###');
      expect(stdout).toContain('Non-Breaking Changes');
    });

    it('should filter with --breaking-only', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/complete.json');
      const newFile = join(FIXTURES_PATH, 'complex/multi-change.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --breaking-only`);

      expect(stdout).toContain('BREAKING CHANGES');
      expect(stdout).not.toContain('NON-BREAKING CHANGES');
    });

    it('should filter with --effects-only', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/complete.json');
      const newFile = join(FIXTURES_PATH, 'effects/destructive-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --effects-only`);

      expect(stdout).toContain('EFFECTS CHANGES');
    });

    it('should exit with code 1 when --fail-on-breaking and breaking changes exist', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'breaking/required-arg-added.json');

      try {
        await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --fail-on-breaking`);
        expect.fail('Should have exited with code 1');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });

    it('should exit with code 0 when --fail-on-breaking and no breaking changes', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --fail-on-breaking`);

      expect(stdout).toBeDefined();
    });

    it('should output semver recommendation with --semver', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'breaking/required-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --semver`);

      expect(stdout.trim()).toBe('major');
    });

    it('should handle --ignore-version flag', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'base/minimal.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --ignore-version`);

      expect(stdout).toContain('No changes');
    });

    it('should handle --quiet flag', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --quiet`);

      expect(stdout).toBe('');
    });

    it('should handle --verbose flag', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newFile = join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json');

      const { stdout } = await execAsync(`node ${CLI_PATH} ${oldFile} ${newFile} --verbose`);

      expect(stdout).toContain('Loading');
      expect(stdout).toContain('Comparing');
    });
  });

  describe('stdin command', () => {
    it('should read from stdin', async () => {
      const oldFile = join(FIXTURES_PATH, 'base/minimal.json');
      const newContent = JSON.stringify({
        atip: { version: '0.6' },
        name: 'mytool',
        version: '2.0.0',
        description: 'Updated',
        commands: {},
      });

      const { stdout } = await execAsync(`echo '${newContent}' | node ${CLI_PATH} stdin ${oldFile}`);

      expect(stdout).toContain('version-changed');
    });
  });

  describe('--agent flag', () => {
    it('should output ATIP metadata for atip-diff itself', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --agent`);

      const metadata = JSON.parse(stdout);
      expect(metadata.atip).toBeDefined();
      expect(metadata.name).toBe('atip-diff');
      expect(metadata.commands.diff).toBeDefined();
      expect(metadata.commands.stdin).toBeDefined();
    });

    it('should have valid effects metadata', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --agent`);

      const metadata = JSON.parse(stdout);
      expect(metadata.commands.diff.effects).toBeDefined();
      expect(metadata.commands.diff.effects.filesystem.read).toBe(true);
      expect(metadata.commands.diff.effects.destructive).toBe(false);
      expect(metadata.commands.diff.effects.idempotent).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should error on missing file', async () => {
      try {
        await execAsync(`node ${CLI_PATH} nonexistent.json new.json`);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(2);
        expect(error.stderr).toContain('Cannot read file');
      }
    });

    it('should error on invalid JSON', async () => {
      const invalidFile = join(FIXTURES_PATH, 'invalid.json');
      const validFile = join(FIXTURES_PATH, 'base/minimal.json');

      try {
        await execAsync(`node ${CLI_PATH} ${invalidFile} ${validFile}`);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(2);
      }
    });

    it('should error on schema validation failure', async () => {
      const invalidSchemaFile = join(FIXTURES_PATH, 'missing-name.json');
      const validFile = join(FIXTURES_PATH, 'base/minimal.json');

      try {
        await execAsync(`node ${CLI_PATH} ${invalidSchemaFile} ${validFile}`);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(2);
        expect(error.stderr).toContain('Schema validation');
      }
    });
  });
});
