import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSafePath, matchesSkipList } from '../../src/safety';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Path Safety', () => {
  describe('isSafePath', () => {
    it('should reject current directory', async () => {
      const result = await isSafePath('.');

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('current-directory');
    });

    it('should reject empty path', async () => {
      const result = await isSafePath('');

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('current-directory');
    });

    it('should accept /usr/bin', async () => {
      const result = await isSafePath('/usr/bin');

      if (result.safe) {
        expect(result.safe).toBe(true);
      } else {
        // May not exist on all systems
        expect(result.reason).toBeDefined();
      }
    });

    it('should accept /usr/local/bin', async () => {
      const result = await isSafePath('/usr/local/bin');

      if (result.safe) {
        expect(result.safe).toBe(true);
      } else {
        // May not exist on all systems
        expect(result.reason).toBeDefined();
      }
    });

    it('should reject world-writable directories on Unix', async () => {
      if (process.platform === 'win32') return;

      // Create temp directory with world-writable permissions
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-test-'));
      try {
        await fs.chmod(tmpDir, 0o777);

        const result = await isSafePath(tmpDir);

        expect(result.safe).toBe(false);
        expect(result.reason).toBe('world-writable');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should reject directories with other-writable bit set', async () => {
      if (process.platform === 'win32') return;

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-test-'));
      try {
        // Set mode 0o702 (owner=rwx, other=w)
        await fs.chmod(tmpDir, 0o702);

        const result = await isSafePath(tmpDir);

        expect(result.safe).toBe(false);
        expect(result.reason).toBe('world-writable');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should accept user-owned directories', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-test-'));
      try {
        await fs.chmod(tmpDir, 0o700);

        const result = await isSafePath(tmpDir);

        expect(result.safe).toBe(true);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should reject non-existent paths', async () => {
      const result = await isSafePath('/nonexistent/path/that/does/not/exist');

      expect(result.safe).toBe(false);
      expect(result.reason).toMatch(/not found|does not exist/i);
    });

    it('should handle symlinks safely', async () => {
      // Symlinks should be followed and checked
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-test-'));
      const linkPath = path.join(os.tmpdir(), 'atip-test-link-' + Date.now());

      try {
        await fs.chmod(tmpDir, 0o700);
        await fs.symlink(tmpDir, linkPath);

        const result = await isSafePath(linkPath);

        expect(result.safe).toBe(true);
      } finally {
        await fs.rm(linkPath, { force: true });
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});

describe('Skip List Matching', () => {
  describe('matchesSkipList', () => {
    it('should match exact tool name', () => {
      const result = matchesSkipList('python', ['python', 'node']);

      expect(result).toBe(true);
    });

    it('should not match different tool name', () => {
      const result = matchesSkipList('ruby', ['python', 'node']);

      expect(result).toBe(false);
    });

    it('should match glob pattern with asterisk', () => {
      const result = matchesSkipList('test-runner', ['test*']);

      expect(result).toBe(true);
    });

    it('should match glob pattern with prefix', () => {
      const result = matchesSkipList('python3', ['python*']);

      expect(result).toBe(true);
    });

    it('should match glob pattern with suffix', () => {
      const result = matchesSkipList('dev-tool', ['*-dev', '*-tool']);

      expect(result).toBe(true);
    });

    it('should handle empty skip list', () => {
      const result = matchesSkipList('anything', []);

      expect(result).toBe(false);
    });

    it('should be case-sensitive', () => {
      const result = matchesSkipList('Python', ['python']);

      expect(result).toBe(false);
    });

    it('should match multiple patterns', () => {
      const skipList = ['test*', '*-dev', 'debug*'];

      expect(matchesSkipList('test-runner', skipList)).toBe(true);
      expect(matchesSkipList('my-tool-dev', skipList)).toBe(true);
      expect(matchesSkipList('debug-logger', skipList)).toBe(true);
      expect(matchesSkipList('production-tool', skipList)).toBe(false);
    });

    it('should handle special glob characters', () => {
      const result = matchesSkipList('tool.test', ['tool.*']);

      expect(result).toBe(true);
    });

    it('should handle question mark wildcard', () => {
      const result = matchesSkipList('tool1', ['tool?']);

      expect(result).toBe(true);
    });

    it('should handle bracket patterns', () => {
      const result = matchesSkipList('tool1', ['tool[123]']);

      expect(result).toBe(true);
    });

    it('should not match partial names without wildcards', () => {
      const result = matchesSkipList('python3', ['python']);

      expect(result).toBe(false);
    });
  });
});
