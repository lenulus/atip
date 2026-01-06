import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadRegistry, saveRegistry } from '../../src/registry';
import type { Registry, RegistryEntry } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Registry Operations', () => {
  let tmpDir: string;
  let registryPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-registry-test-'));
    registryPath = path.join(tmpDir, 'registry.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('loadRegistry', () => {
    it('should return empty registry if file does not exist', async () => {
      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const registry = await loadRegistry(paths);

      expect(registry).toBeDefined();
      expect(registry.version).toBe('1');
      expect(registry.tools).toEqual([]);
      expect(registry.lastScan).toBeNull();
    });

    it('should load existing registry from disk', async () => {
      const mockRegistry: Registry = {
        version: '1',
        lastScan: new Date('2026-01-05T10:00:00Z'),
        tools: [
          {
            name: 'gh',
            version: '2.45.0',
            path: '/usr/local/bin/gh',
            source: 'native',
            discoveredAt: new Date('2026-01-05T10:00:00Z'),
            lastVerified: new Date('2026-01-05T10:00:00Z'),
          },
        ],
      };

      await fs.writeFile(registryPath, JSON.stringify(mockRegistry, null, 2));

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const registry = await loadRegistry(paths);

      expect(registry.version).toBe('1');
      expect(registry.tools).toHaveLength(1);
      expect(registry.tools[0].name).toBe('gh');
      expect(registry.tools[0].version).toBe('2.45.0');
      expect(registry.lastScan).toBeInstanceOf(Date);
    });

    it('should throw RegistryError if registry is corrupted', async () => {
      // Write invalid JSON
      await fs.writeFile(registryPath, '{ invalid json }');

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await expect(loadRegistry(paths)).rejects.toThrow(/RegistryError|corrupted|invalid/i);
    });

    it('should parse ISO date strings to Date objects', async () => {
      const mockRegistry = {
        version: '1',
        lastScan: '2026-01-05T10:00:00.000Z',
        tools: [
          {
            name: 'gh',
            version: '2.45.0',
            path: '/usr/local/bin/gh',
            source: 'native',
            discoveredAt: '2026-01-05T10:00:00.000Z',
            lastVerified: '2026-01-05T10:00:00.000Z',
          },
        ],
      };

      await fs.writeFile(registryPath, JSON.stringify(mockRegistry, null, 2));

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const registry = await loadRegistry(paths);

      expect(registry.lastScan).toBeInstanceOf(Date);
      expect(registry.tools[0].discoveredAt).toBeInstanceOf(Date);
      expect(registry.tools[0].lastVerified).toBeInstanceOf(Date);
    });

    it('should preserve unknown fields for forward compatibility', async () => {
      const mockRegistry = {
        version: '1',
        lastScan: '2026-01-05T10:00:00.000Z',
        tools: [],
        futureField: 'should be preserved',
      };

      await fs.writeFile(registryPath, JSON.stringify(mockRegistry, null, 2));

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      const registry = await loadRegistry(paths);

      expect((registry as any).futureField).toBe('should be preserved');
    });
  });

  describe('saveRegistry', () => {
    it('should save registry to disk', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date('2026-01-05T10:00:00Z'),
        tools: [
          {
            name: 'gh',
            version: '2.45.0',
            path: '/usr/local/bin/gh',
            source: 'native',
            discoveredAt: new Date('2026-01-05T10:00:00Z'),
            lastVerified: new Date('2026-01-05T10:00:00Z'),
          },
        ],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await saveRegistry(registry, paths);

      const content = await fs.readFile(registryPath, 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.version).toBe('1');
      expect(saved.tools).toHaveLength(1);
      expect(saved.tools[0].name).toBe('gh');
    });

    it('should create parent directories if needed', async () => {
      const nestedPath = path.join(tmpDir, 'nested', 'dir', 'registry.json');
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [],
      };

      const paths = {
        dataDir: path.join(tmpDir, 'nested', 'dir'),
        configDir: tmpDir,
        registryPath: nestedPath,
        toolsDir: path.join(tmpDir, 'nested', 'dir', 'tools'),
        shimsDir: path.join(tmpDir, 'nested', 'dir', 'shims'),
      };

      await saveRegistry(registry, paths);

      const exists = await fs
        .access(nestedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should perform atomic write (temp file + rename)', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await saveRegistry(registry, paths);

      // Temp file should not exist after save
      const tmpPath = `${registryPath}.tmp`;
      const tmpExists = await fs
        .access(tmpPath)
        .then(() => true)
        .catch(() => false);

      expect(tmpExists).toBe(false);
      expect(await fs.access(registryPath)).toBeUndefined(); // Should exist
    });

    it('should serialize dates as ISO strings', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date('2026-01-05T10:00:00Z'),
        tools: [
          {
            name: 'gh',
            version: '2.45.0',
            path: '/usr/local/bin/gh',
            source: 'native',
            discoveredAt: new Date('2026-01-05T10:00:00Z'),
            lastVerified: new Date('2026-01-05T10:00:00Z'),
          },
        ],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await saveRegistry(registry, paths);

      const content = await fs.readFile(registryPath, 'utf-8');
      expect(content).toContain('2026-01-05T10:00:00');
    });

    it('should write formatted JSON with indentation', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [],
      };

      const paths = {
        dataDir: tmpDir,
        configDir: tmpDir,
        registryPath,
        toolsDir: path.join(tmpDir, 'tools'),
        shimsDir: path.join(tmpDir, 'shims'),
      };

      await saveRegistry(registry, paths);

      const content = await fs.readFile(registryPath, 'utf-8');
      expect(content).toContain('\n  '); // Should have indentation
    });

    it('should throw RegistryError if write fails', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [],
      };

      // Use a read-only path
      const readOnlyPath = '/nonexistent/readonly/registry.json';
      const paths = {
        dataDir: '/nonexistent/readonly',
        configDir: tmpDir,
        registryPath: readOnlyPath,
        toolsDir: '/nonexistent/readonly/tools',
        shimsDir: '/nonexistent/readonly/shims',
      };

      await expect(saveRegistry(registry, paths)).rejects.toThrow();
    });
  });

  describe('Registry Entry Operations', () => {
    it('should support adding tools to registry', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [],
      };

      const newTool: RegistryEntry = {
        name: 'kubectl',
        version: '1.28.0',
        path: '/usr/local/bin/kubectl',
        source: 'native',
        discoveredAt: new Date(),
        lastVerified: new Date(),
      };

      registry.tools.push(newTool);

      expect(registry.tools).toHaveLength(1);
      expect(registry.tools[0].name).toBe('kubectl');
    });

    it('should support updating existing tools', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [
          {
            name: 'gh',
            version: '2.44.0',
            path: '/usr/local/bin/gh',
            source: 'native',
            discoveredAt: new Date('2026-01-01T00:00:00Z'),
            lastVerified: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      };

      const tool = registry.tools.find((t) => t.name === 'gh');
      if (tool) {
        tool.version = '2.45.0';
        tool.lastVerified = new Date();
      }

      expect(registry.tools[0].version).toBe('2.45.0');
    });

    it('should support filtering tools by source', async () => {
      const registry: Registry = {
        version: '1',
        lastScan: new Date(),
        tools: [
          {
            name: 'gh',
            version: '2.45.0',
            path: '/usr/local/bin/gh',
            source: 'native',
            discoveredAt: new Date(),
            lastVerified: new Date(),
          },
          {
            name: 'curl',
            version: '8.4.0',
            path: '/usr/bin/curl',
            source: 'shim',
            discoveredAt: new Date(),
            lastVerified: new Date(),
          },
        ],
      };

      const nativeTools = registry.tools.filter((t) => t.source === 'native');
      const shimTools = registry.tools.filter((t) => t.source === 'shim');

      expect(nativeTools).toHaveLength(1);
      expect(shimTools).toHaveLength(1);
    });
  });
});
