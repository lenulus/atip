import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scan } from '../../src/discovery/scanner';
import type { ScanOptions } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Create a two-phase compliant mock ATIP tool.
 */
async function createMockAtipTool(
  toolPath: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const script = `#!/bin/sh
if [ "$1" = "--help" ]; then
  echo "Usage: ${path.basename(toolPath)} [--agent] [command]"
  echo "  --agent    Output ATIP metadata as JSON"
  exit 0
fi
if [ "$1" = "--agent" ]; then
  echo '${JSON.stringify(metadata)}'
  exit 0
fi
exit 1`;
  await fs.writeFile(toolPath, script, { mode: 0o755 });
}

describe('Discovery Scanner', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-scanner-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('scan', () => {
    it('should discover ATIP-compatible tools', async () => {
      // Create mock ATIP tool
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      const metadata = {
        atip: { version: '0.4' },
        name: 'mock-tool',
        version: '1.0.0',
        description: 'Mock ATIP tool',
      };

      const toolPath = path.join(toolDir, 'mock-tool');
      await createMockAtipTool(toolPath, metadata);

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
        skipList: [],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const result = await scan(options, paths);

      expect(result.discovered).toBeGreaterThan(0);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('mock-tool');
    });

    it('should skip tools in skip list', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      // Create two tools
      for (const name of ['keep-tool', 'skip-tool']) {
        const metadata = {
          atip: { version: '0.4' },
          name,
          version: '1.0.0',
          description: name,
        };

        const toolPath = path.join(toolDir, name);
        await createMockAtipTool(toolPath, metadata);
      }

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
        skipList: ['skip-tool'],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const result = await scan(options, paths);

      expect(result.discovered).toBe(1);
      expect(result.tools[0].name).toBe('keep-tool');
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('should skip tools matching glob patterns', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      for (const name of ['test-runner', 'test-helper', 'prod-tool']) {
        const metadata = {
          atip: { version: '0.4' },
          name,
          version: '1.0.0',
          description: name,
        };

        const toolPath = path.join(toolDir, name);
        await createMockAtipTool(toolPath, metadata);
      }

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
        skipList: ['test*'],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const result = await scan(options, paths);

      expect(result.discovered).toBe(1);
      expect(result.tools[0].name).toBe('prod-tool');
    });

    it('should handle probe failures gracefully', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      // Create broken tool that advertises --agent but returns invalid JSON
      const brokenPath = path.join(toolDir, 'broken-tool');
      await fs.writeFile(
        brokenPath,
        `#!/bin/sh
if [ "$1" = "--help" ]; then
  echo "Usage: broken-tool [--agent]"
  echo "  --agent    Output ATIP metadata"
  exit 0
fi
if [ "$1" = "--agent" ]; then
  echo "{ invalid json }"
  exit 0
fi
exit 1`,
        { mode: 0o755 }
      );

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const result = await scan(options, paths);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toContain('broken-tool');
    });

    it('should use parallel probing with configurable concurrency', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      // Create multiple tools
      for (let i = 0; i < 10; i++) {
        const metadata = {
          atip: { version: '0.4' },
          name: `tool-${i}`,
          version: '1.0.0',
          description: `Tool ${i}`,
        };

        const toolPath = path.join(toolDir, `tool-${i}`);
        await createMockAtipTool(toolPath, metadata);
      }

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
        parallelism: 4,
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const result = await scan(options, paths);

      expect(result.discovered).toBe(10);
    });

    it('should report progress via callback', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      const metadata = {
        atip: { version: '0.4' },
        name: 'test-tool',
        version: '1.0.0',
        description: 'Test',
      };

      const toolPath = path.join(toolDir, 'test-tool');
      await createMockAtipTool(toolPath, metadata);

      const progressUpdates: any[] = [];
      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await scan(options, paths);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('phase');
      expect(progressUpdates[0]).toHaveProperty('current');
      expect(progressUpdates[0]).toHaveProperty('total');
    });

    it('should update registry with discovered tools', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      const metadata = {
        atip: { version: '0.4' },
        name: 'new-tool',
        version: '1.0.0',
        description: 'New tool',
      };

      const toolPath = path.join(toolDir, 'new-tool');
      await createMockAtipTool(toolPath, metadata);

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
      };

      const registryPath = path.join(tmpDir, 'registry.json');
      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await scan(options, paths);

      // Check registry was created
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(registryContent);

      expect(registry.tools).toHaveLength(1);
      expect(registry.tools[0].name).toBe('new-tool');
    });

    it('should cache metadata for discovered tools', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      const metadata = {
        atip: { version: '0.4' },
        name: 'cached-tool',
        version: '1.0.0',
        description: 'Tool with cached metadata',
        commands: {
          run: {
            description: 'Run command',
            effects: { network: false },
          },
        },
      };

      const toolPath = path.join(toolDir, 'cached-tool');
      await createMockAtipTool(toolPath, metadata);

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await scan(options, paths);

      // Check cache file exists
      const cacheFile = path.join(paths.toolsDir, 'cached-tool.json');
      const cacheExists = await fs
        .access(cacheFile)
        .then(() => true)
        .catch(() => false);

      expect(cacheExists).toBe(true);
    });

    it('should perform incremental scan by default', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      const metadata = {
        atip: { version: '0.4' },
        name: 'existing-tool',
        version: '1.0.0',
        description: 'Existing tool',
      };

      const toolPath = path.join(toolDir, 'existing-tool');
      await createMockAtipTool(toolPath, metadata);

      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [toolDir],
        incremental: true,
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      // First scan
      await scan(options, paths);

      // Second scan (incremental)
      const result = await scan(options, paths);

      // Should skip unchanged tools
      expect(result.discovered).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('should force full scan when incremental is false', async () => {
      const toolDir = path.join(tmpDir, 'bin');
      await fs.mkdir(toolDir);

      const metadata = {
        atip: { version: '0.4' },
        name: 'tool',
        version: '1.0.0',
        description: 'Tool',
      };

      const toolPath = path.join(toolDir, 'tool');
      await createMockAtipTool(toolPath, metadata);

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      // First scan
      await scan({ safePathsOnly: false, allowPaths: [toolDir] }, paths);

      // Full rescan
      const result = await scan(
        { safePathsOnly: false, allowPaths: [toolDir], incremental: false },
        paths
      );

      // Should re-probe all tools
      expect(result.discovered + result.updated).toBeGreaterThan(0);
    });

    it('should measure and report scan duration', async () => {
      const options: ScanOptions = {
        safePathsOnly: false,
        allowPaths: [],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath: path.join(tmpDir, 'registry.json'),
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const result = await scan(options, paths);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });
  });
});
