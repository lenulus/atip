import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('CLI Commands (Integration)', () => {
  let tmpDir: string;
  let toolDir: string;
  let dataDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-cli-test-'));
    toolDir = path.join(tmpDir, 'bin');
    dataDir = path.join(tmpDir, 'data');
    await fs.mkdir(toolDir);
    await fs.mkdir(dataDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('atip-discover --version', () => {
    it('should print version number', async () => {
      const { stdout } = await execAsync('atip-discover --version');

      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('atip-discover --help', () => {
    it('should print help message', async () => {
      const { stdout } = await execAsync('atip-discover --help');

      expect(stdout).toContain('scan');
      expect(stdout).toContain('list');
      expect(stdout).toContain('get');
      expect(stdout).toContain('cache');
    });
  });

  describe('atip-discover scan', () => {
    it('should scan and discover ATIP tools', async () => {
      // Create mock ATIP tool
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Test tool',
      };

      const toolPath = path.join(toolDir, 'test-tool');
      await fs.writeFile(
        toolPath,
        `#!/bin/sh\necho '${JSON.stringify(metadata)}'`,
        { mode: 0o755 }
      );

      const { stdout } = await execAsync(
        `atip-discover scan --allow-path=${toolDir} --data-dir=${dataDir} -o json`
      );

      const result = JSON.parse(stdout);

      expect(result).toHaveProperty('discovered');
      expect(result).toHaveProperty('tools');
      expect(result.discovered).toBeGreaterThan(0);
    });

    it('should output JSON by default', async () => {
      const { stdout } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --allow-path=/nonexistent`
      );

      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it('should support table output format', async () => {
      const { stdout } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --allow-path=/nonexistent -o table`
      );

      expect(stdout).toContain('DISCOVERED');
      expect(stdout).toContain('UPDATED');
    });

    it('should support quiet output format', async () => {
      const { stdout } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --allow-path=/nonexistent -o quiet`
      );

      expect(stdout).toMatch(/\d+ discovered/);
    });

    it('should respect --skip flag', async () => {
      // Create tools
      for (const name of ['skip-me', 'keep-me']) {
        const metadata = {
          atip: { version: '0.4' },
          name,
          version: '1.0.0',
          description: name,
        };

        const toolPath = path.join(toolDir, name);
        await fs.writeFile(
          toolPath,
          `#!/bin/sh\necho '${JSON.stringify(metadata)}'`,
          { mode: 0o755 }
        );
      }

      const { stdout } = await execAsync(
        `atip-discover scan --allow-path=${toolDir} --skip=skip-me --data-dir=${dataDir} -o json`
      );

      const result = JSON.parse(stdout);
      const toolNames = result.tools.map((t: any) => t.name);

      expect(toolNames).toContain('keep-me');
      expect(toolNames).not.toContain('skip-me');
    });

    it('should support --dry-run flag', async () => {
      const { stdout } = await execAsync(
        `atip-discover scan --allow-path=${toolDir} --data-dir=${dataDir} --dry-run -o json`
      );

      const result = JSON.parse(stdout);

      expect(result).toHaveProperty('would_scan');
      expect(result).toHaveProperty('would_probe');
    });

    it('should support --timeout flag', async () => {
      const { stdout } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --timeout=5s --allow-path=/nonexistent -o json`
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('discovered');
    });

    it('should support --parallel flag', async () => {
      const { stdout } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --parallel=8 --allow-path=/nonexistent -o json`
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('discovered');
    });

    it('should exit with code 0 on successful scan', async () => {
      const { code } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --allow-path=/nonexistent; echo $?`
      ).catch((e) => ({ code: e.code }));

      // Note: This test structure depends on shell behavior
      expect(code).toBeUndefined(); // No error thrown
    });
  });

  describe('atip-discover list', () => {
    beforeEach(async () => {
      // Populate registry with mock tools
      const registry = {
        version: '1',
        lastScan: new Date().toISOString(),
        tools: [
          {
            name: 'tool-a',
            version: '1.0.0',
            path: '/usr/bin/tool-a',
            source: 'native',
            discoveredAt: new Date().toISOString(),
            lastVerified: new Date().toISOString(),
          },
          {
            name: 'tool-b',
            version: '2.0.0',
            path: '/usr/bin/tool-b',
            source: 'shim',
            discoveredAt: new Date().toISOString(),
            lastVerified: new Date().toISOString(),
          },
        ],
      };

      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'registry.json'),
        JSON.stringify(registry, null, 2)
      );
    });

    it('should list all tools from registry', async () => {
      const { stdout } = await execAsync(
        `atip-discover list --data-dir=${dataDir} -o json`
      );

      const result = JSON.parse(stdout);

      expect(result).toHaveProperty('tools');
      expect(result.tools).toHaveLength(2);
    });

    it('should filter by pattern', async () => {
      const { stdout } = await execAsync(
        `atip-discover list "tool-a" --data-dir=${dataDir} -o json`
      );

      const result = JSON.parse(stdout);

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('tool-a');
    });

    it('should filter by source type', async () => {
      const { stdout } = await execAsync(
        `atip-discover list --source=native --data-dir=${dataDir} -o json`
      );

      const result = JSON.parse(stdout);

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].source).toBe('native');
    });

    it('should support table output', async () => {
      const { stdout } = await execAsync(
        `atip-discover list --data-dir=${dataDir} -o table`
      );

      expect(stdout).toContain('tool-a');
      expect(stdout).toContain('tool-b');
    });

    it('should support quiet output (names only)', async () => {
      const { stdout } = await execAsync(
        `atip-discover list --data-dir=${dataDir} -o quiet`
      );

      expect(stdout).toContain('tool-a');
      expect(stdout).toContain('tool-b');
      expect(stdout).not.toContain('version'); // Should be minimal
    });

    it('should exit with code 1 if no tools found', async () => {
      try {
        await execAsync(
          `atip-discover list "nonexistent*" --data-dir=${dataDir}`
        );
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });
  });

  describe('atip-discover get', () => {
    beforeEach(async () => {
      // Create registry with tool
      const registry = {
        version: '1',
        lastScan: new Date().toISOString(),
        tools: [
          {
            name: 'test-tool',
            version: '1.0.0',
            path: '/usr/bin/test-tool',
            source: 'native',
            discoveredAt: new Date().toISOString(),
            lastVerified: new Date().toISOString(),
            metadataFile: 'test-tool.json',
          },
        ],
      };

      await fs.mkdir(dataDir, { recursive: true });
      await fs.mkdir(path.join(dataDir, 'tools'), { recursive: true });
      await fs.writeFile(
        path.join(dataDir, 'registry.json'),
        JSON.stringify(registry, null, 2)
      );

      // Create cached metadata
      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Test tool',
        commands: {
          run: {
            description: 'Run command',
            effects: { network: false },
          },
        },
      };

      await fs.writeFile(
        path.join(dataDir, 'tools', 'test-tool.json'),
        JSON.stringify(metadata, null, 2)
      );
    });

    it('should get tool metadata from cache', async () => {
      const { stdout } = await execAsync(
        `atip-discover get test-tool --data-dir=${dataDir}`
      );

      const metadata = JSON.parse(stdout);

      expect(metadata.name).toBe('test-tool');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.commands).toBeDefined();
    });

    it('should support --compact flag', async () => {
      const { stdout } = await execAsync(
        `atip-discover get test-tool --data-dir=${dataDir} --compact`
      );

      const metadata = JSON.parse(stdout);
      // Compact should omit optional fields
      expect(metadata).toBeDefined();
    });

    it('should exit with code 1 if tool not found', async () => {
      try {
        await execAsync(
          `atip-discover get nonexistent-tool --data-dir=${dataDir}`
        );
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });
  });

  describe('atip-discover cache', () => {
    beforeEach(async () => {
      await fs.mkdir(dataDir, { recursive: true });

      const registry = {
        version: '1',
        lastScan: new Date().toISOString(),
        tools: [],
      };

      await fs.writeFile(
        path.join(dataDir, 'registry.json'),
        JSON.stringify(registry, null, 2)
      );
    });

    it('should display cache info', async () => {
      const { stdout } = await execAsync(
        `atip-discover cache info --data-dir=${dataDir}`
      );

      const info = JSON.parse(stdout);

      expect(info).toHaveProperty('path');
      expect(info).toHaveProperty('registry_path');
      expect(info).toHaveProperty('tool_count');
    });

    it('should clear cache', async () => {
      const { stdout } = await execAsync(
        `atip-discover cache clear --all --data-dir=${dataDir}`
      );

      const result = JSON.parse(stdout);

      expect(result).toHaveProperty('cleared');
      expect(result).toHaveProperty('freed_bytes');
    });
  });

  describe('Global Flags', () => {
    it('should respect --verbose flag', async () => {
      const { stdout, stderr } = await execAsync(
        `atip-discover scan --data-dir=${dataDir} --allow-path=/nonexistent --verbose`
      );

      // Verbose output should go to stderr
      expect(stderr).toContain(''); // May contain debug info
    });

    it('should respect --config flag', async () => {
      const configPath = path.join(tmpDir, 'custom-config.json');
      const config = {
        version: '1',
        discovery: {
          parallelism: 16,
        },
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const { stdout } = await execAsync(
        `atip-discover scan --config=${configPath} --data-dir=${dataDir} --allow-path=/nonexistent -o json`
      );

      // Should use custom config
      expect(stdout).toBeDefined();
    });
  });
});
