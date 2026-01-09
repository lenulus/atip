import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scan, list, get, loadRegistry } from '../../src';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Create a two-phase compliant mock ATIP tool.
 * The tool responds to --help with --agent documented, and --agent with JSON metadata.
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

describe('Discovery Workflow (Integration)', () => {
  let tmpDir: string;
  let toolDir: string;
  let paths: any;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-discovery-test-'));
    toolDir = path.join(tmpDir, 'bin');
    await fs.mkdir(toolDir);

    paths = {
      dataDir: tmpDir,
      configDir: tmpDir,
      registryPath: path.join(tmpDir, 'registry.json'),
      toolsDir: path.join(tmpDir, 'tools'),
      shimsDir: path.join(tmpDir, 'shims'),
    };
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('End-to-End Discovery', () => {
    it('should discover, cache, and retrieve tool metadata', async () => {
      // Create mock ATIP tool
      const metadata = {
        atip: { version: '0.4' },
        name: 'example-tool',
        version: '2.5.0',
        description: 'Example ATIP tool for testing',
        homepage: 'https://example.com',
        commands: {
          run: {
            description: 'Run the tool',
            options: [
              {
                name: 'verbose',
                flags: ['-v', '--verbose'],
                type: 'boolean',
                description: 'Enable verbose output',
              },
            ],
            effects: {
              network: true,
              idempotent: false,
            },
          },
          status: {
            description: 'Check status',
            effects: {
              network: false,
              idempotent: true,
            },
          },
        },
      };

      const toolPath = path.join(toolDir, 'example-tool');
      await createMockAtipTool(toolPath, metadata);

      // Step 1: Scan for tools
      const scanResult = await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
        },
        paths
      );

      expect(scanResult.discovered).toBe(1);
      expect(scanResult.tools[0].name).toBe('example-tool');
      expect(scanResult.tools[0].version).toBe('2.5.0');

      // Step 2: List tools
      const tools = await list({}, paths);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('example-tool');

      // Step 3: Get full metadata
      const fullMetadata = await get('example-tool', {}, paths);

      expect(fullMetadata.name).toBe('example-tool');
      expect(fullMetadata.commands).toBeDefined();
      expect(fullMetadata.commands.run).toBeDefined();
      expect(fullMetadata.commands.status).toBeDefined();
    });

    it('should handle multiple tools with different sources', async () => {
      // Create native tool
      const nativeTool = {
        atip: { version: '0.4' },
        name: 'native-tool',
        version: '1.0.0',
        description: 'Native ATIP tool',
        trust: {
          source: 'native',
          verified: true,
        },
      };

      const nativePath = path.join(toolDir, 'native-tool');
      await createMockAtipTool(nativePath, nativeTool);

      // Create shim tool metadata
      const shimTool = {
        atip: { version: '0.4' },
        name: 'shim-tool',
        version: '1.0.0',
        description: 'Community shim',
        trust: {
          source: 'community',
          verified: false,
        },
      };

      await fs.mkdir(paths.shimsDir, { recursive: true });
      await fs.writeFile(
        path.join(paths.shimsDir, 'shim-tool.json'),
        JSON.stringify(shimTool, null, 2)
      );

      // Scan
      const scanResult = await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
          includeShims: true,
        },
        paths
      );

      expect(scanResult.discovered).toBeGreaterThan(0);

      // List by source
      const allTools = await list({}, paths);
      const nativeTools = await list({ source: 'native' }, paths);
      const shimTools = await list({ source: 'shim' }, paths);

      expect(allTools.length).toBeGreaterThanOrEqual(1);
      expect(nativeTools.length).toBeGreaterThan(0);
      expect(nativeTools[0].source).toBe('native');
    });

    it('should handle incremental scans correctly', async () => {
      // Create initial tool
      const tool1 = {
        atip: { version: '0.4' },
        name: 'tool-1',
        version: '1.0.0',
        description: 'First tool',
      };

      const tool1Path = path.join(toolDir, 'tool-1');
      await createMockAtipTool(tool1Path, tool1);

      // First scan
      const scan1 = await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
          incremental: true,
        },
        paths
      );

      expect(scan1.discovered).toBe(1);

      // Add second tool
      const tool2 = {
        atip: { version: '0.4' },
        name: 'tool-2',
        version: '1.0.0',
        description: 'Second tool',
      };

      const tool2Path = path.join(toolDir, 'tool-2');
      await createMockAtipTool(tool2Path, tool2);

      // Wait a bit to ensure mtime differs
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second scan (incremental)
      const scan2 = await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
          incremental: true,
        },
        paths
      );

      expect(scan2.discovered).toBe(1); // Only new tool
      expect(scan2.tools[0].name).toBe('tool-2');

      // Verify both tools in registry
      const allTools = await list({}, paths);
      expect(allTools).toHaveLength(2);
    });

    it('should detect tool version updates', async () => {
      // Create tool v1
      const toolV1 = {
        atip: { version: '0.4' },
        name: 'updating-tool',
        version: '1.0.0',
        description: 'Tool that updates',
      };

      const toolPath = path.join(toolDir, 'updating-tool');
      await createMockAtipTool(toolPath, toolV1);

      // First scan
      await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
        },
        paths
      );

      // Update tool to v2
      const toolV2 = {
        atip: { version: '0.4' },
        name: 'updating-tool',
        version: '2.0.0',
        description: 'Tool that updated',
      };

      await createMockAtipTool(toolPath, toolV2);

      // Wait to ensure mtime changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second scan (should detect update)
      const scan2 = await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
          incremental: true,
        },
        paths
      );

      expect(scan2.updated).toBeGreaterThan(0);

      // Verify version updated
      const metadata = await get('updating-tool', {}, paths);
      expect(metadata.version).toBe('2.0.0');
    });

    it('should handle tool failures gracefully', async () => {
      // Create one good tool and one broken tool
      const goodTool = {
        atip: { version: '0.4' },
        name: 'good-tool',
        version: '1.0.0',
        description: 'Good tool',
      };

      await createMockAtipTool(path.join(toolDir, 'good-tool'), goodTool);

      // Create broken tool that returns invalid JSON (but still supports --agent in help)
      await fs.writeFile(
        path.join(toolDir, 'broken-tool'),
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

      const scanResult = await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
        },
        paths
      );

      expect(scanResult.discovered).toBe(1);
      expect(scanResult.failed).toBe(1);
      expect(scanResult.tools[0].name).toBe('good-tool');
      expect(scanResult.errors).toHaveLength(1);
      expect(scanResult.errors[0].path).toContain('broken-tool');
    });

    it('should persist registry across operations', async () => {
      // Create tool
      const metadata = {
        atip: { version: '0.4' },
        name: 'persistent-tool',
        version: '1.0.0',
        description: 'Tool that persists',
      };

      const toolPath = path.join(toolDir, 'persistent-tool');
      await createMockAtipTool(toolPath, metadata);

      // Scan
      await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
        },
        paths
      );

      // Load registry directly
      const registry = await loadRegistry(paths);

      expect(registry.tools).toHaveLength(1);
      expect(registry.tools[0].name).toBe('persistent-tool');
      expect(registry.lastScan).toBeInstanceOf(Date);
    });

    it('should support filtering tools by pattern', async () => {
      // Create multiple tools with different names
      for (const name of ['kubectl', 'kubectx', 'docker', 'docker-compose']) {
        const metadata = {
          atip: { version: '0.4' },
          name,
          version: '1.0.0',
          description: name,
        };

        await createMockAtipTool(path.join(toolDir, name), metadata);
      }

      // Scan all
      await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
        },
        paths
      );

      // Filter by pattern
      const kubeTools = await list({ pattern: 'kube*' }, paths);
      const dockerTools = await list({ pattern: 'docker*' }, paths);

      expect(kubeTools).toHaveLength(2);
      expect(dockerTools).toHaveLength(2);
    });

    it('should cache metadata with all fields', async () => {
      // Create tool with rich metadata
      const richMetadata = {
        atip: { version: '0.4', features: ['trust-v1'] },
        name: 'rich-tool',
        version: '3.2.1',
        description: 'Tool with rich metadata',
        homepage: 'https://example.com',
        authentication: {
          required: true,
          methods: [
            {
              type: 'oauth',
              setupCommand: 'rich-tool auth login',
            },
          ],
        },
        trust: {
          source: 'native',
          verified: true,
        },
        commands: {
          deploy: {
            description: 'Deploy application',
            effects: {
              network: true,
              destructive: true,
              reversible: false,
              cost: {
                billable: true,
                estimated: 'variable',
              },
            },
          },
        },
      };

      const toolPath = path.join(toolDir, 'rich-tool');
      await createMockAtipTool(toolPath, richMetadata);

      // Scan
      await scan(
        {
          safePathsOnly: false,
          allowPaths: [toolDir],
        },
        paths
      );

      // Get and verify all fields preserved
      const retrieved = await get('rich-tool', {}, paths);

      expect(retrieved.homepage).toBe('https://example.com');
      expect(retrieved.authentication).toBeDefined();
      expect(retrieved.authentication?.required).toBe(true);
      expect(retrieved.trust?.source).toBe('native');
      expect(retrieved.commands?.deploy?.effects?.destructive).toBe(true);
      expect(retrieved.commands?.deploy?.effects?.cost).toBeDefined();
    });
  });
});
