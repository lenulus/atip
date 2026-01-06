import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { probe } from '../../src/discovery/prober';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Tool Probing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-probe-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('probe', () => {
    it('should return null for non-ATIP tools (non-zero exit)', async () => {
      // Tool that exits with non-zero when called with --agent
      const toolPath = path.join(tmpDir, 'non-atip-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\nexit 1',
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).toBeNull();
    });

    it('should return null for tools without --agent flag support', async () => {
      const toolPath = path.join(tmpDir, 'legacy-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\necho "usage: legacy-tool <command>"',
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).toBeNull();
    });

    it('should parse and return valid ATIP metadata', async () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'mock-tool',
        version: '1.0.0',
        description: 'A mock ATIP tool',
        commands: {
          run: {
            description: 'Run the tool',
            effects: { network: false },
          },
        },
      };

      const toolPath = path.join(tmpDir, 'atip-tool');
      await fs.writeFile(
        toolPath,
        `#!/bin/sh\necho '${JSON.stringify(metadata)}'`,
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('mock-tool');
      expect(result?.version).toBe('1.0.0');
      expect(result?.commands).toBeDefined();
    });

    it('should throw ProbeTimeoutError on timeout', async () => {
      const toolPath = path.join(tmpDir, 'slow-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\nsleep 10\necho "{}"',
        { mode: 0o755 }
      );

      await expect(
        probe(toolPath, { timeoutMs: 100 })
      ).rejects.toThrow(/timeout|ProbeTimeoutError/i);
    });

    it('should throw ProbeError on invalid JSON', async () => {
      const toolPath = path.join(tmpDir, 'broken-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\necho "{ invalid json }"',
        { mode: 0o755 }
      );

      await expect(probe(toolPath)).rejects.toThrow(/invalid.*json|parse/i);
    });

    it('should respect custom timeout', async () => {
      const toolPath = path.join(tmpDir, 'quick-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\nsleep 0.5\necho \'{"atip":"0.4","name":"test","version":"1.0.0","description":"test"}\'',
        { mode: 0o755 }
      );

      const result = await probe(toolPath, { timeoutMs: 5000 });

      expect(result).not.toBeNull();
    });

    it('should handle large JSON output (up to 10MB)', async () => {
      const largeCommands: any = {};
      for (let i = 0; i < 1000; i++) {
        largeCommands[`cmd${i}`] = {
          description: `Command ${i}`,
          effects: { network: false },
        };
      }

      const metadata = {
        atip: { version: '0.4' },
        name: 'large-tool',
        version: '1.0.0',
        description: 'Tool with many commands',
        commands: largeCommands,
      };

      const toolPath = path.join(tmpDir, 'large-tool');
      await fs.writeFile(
        toolPath,
        `#!/bin/sh\necho '${JSON.stringify(metadata)}'`,
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).not.toBeNull();
      expect(Object.keys(result?.commands || {})).toHaveLength(1000);
    });

    it('should handle tools that write to stderr', async () => {
      const metadata = {
        atip: { version: '0.4' },
        name: 'verbose-tool',
        version: '1.0.0',
        description: 'Verbose tool',
      };

      const toolPath = path.join(tmpDir, 'verbose-tool');
      await fs.writeFile(
        toolPath,
        `#!/bin/sh\necho "Warning: something" >&2\necho '${JSON.stringify(metadata)}'`,
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('verbose-tool');
    });

    it('should handle empty stdout', async () => {
      const toolPath = path.join(tmpDir, 'empty-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\n# No output',
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).toBeNull();
    });

    it('should validate metadata against ATIP schema', async () => {
      // Missing required fields
      const invalidMetadata = {
        name: 'incomplete-tool',
        // Missing atip, version, description
      };

      const toolPath = path.join(tmpDir, 'invalid-tool');
      await fs.writeFile(
        toolPath,
        `#!/bin/sh\necho '${JSON.stringify(invalidMetadata)}'`,
        { mode: 0o755 }
      );

      await expect(probe(toolPath)).rejects.toThrow(/validation|schema/i);
    });

    it('should not execute tool with any flags other than --agent', async () => {
      // This is a security requirement
      const toolPath = path.join(tmpDir, 'test-tool');
      await fs.writeFile(
        toolPath,
        '#!/bin/sh\nif [ "$1" = "--agent" ]; then echo \'{"atip":"0.4","name":"test","version":"1.0.0","description":"test"}\'; else exit 1; fi',
        { mode: 0o755 }
      );

      const result = await probe(toolPath);

      expect(result).not.toBeNull();
      // The test ensures only --agent flag is passed
    });

    it('should handle non-executable files', async () => {
      const toolPath = path.join(tmpDir, 'not-executable');
      await fs.writeFile(toolPath, 'not a script', { mode: 0o644 });

      await expect(probe(toolPath)).rejects.toThrow();
    });
  });
});
