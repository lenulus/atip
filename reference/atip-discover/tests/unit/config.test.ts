import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, DEFAULT_SAFE_PATHS, DEFAULT_TIMEOUT_MS, DEFAULT_PARALLELISM } from '../../src/config';
import type { DiscoverConfig } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Configuration Loading', () => {
  let tmpDir: string;
  let configPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-config-test-'));
    configPath = path.join(tmpDir, 'config.json');
    originalEnv = { ...process.env };
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should return defaults when no config file exists', async () => {
      const config = await loadConfig('/nonexistent/config.json');

      expect(config.safePaths).toEqual(DEFAULT_SAFE_PATHS);
      expect(config.scanTimeoutMs).toBe(DEFAULT_TIMEOUT_MS);
      expect(config.parallelism).toBe(DEFAULT_PARALLELISM);
      expect(config.skipList).toEqual([]);
      expect(config.additionalPaths).toEqual([]);
    });

    it('should load config from file', async () => {
      const fileConfig = {
        version: '1',
        discovery: {
          safe_paths: ['/usr/bin', '/custom/bin'],
          skip_list: ['python*', 'node'],
          scan_timeout: '5s',
          parallelism: 8,
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.safePaths).toContain('/custom/bin');
      expect(config.skipList).toContain('python*');
      expect(config.scanTimeoutMs).toBe(5000);
      expect(config.parallelism).toBe(8);
    });

    it('should merge config file with defaults', async () => {
      const fileConfig = {
        version: '1',
        discovery: {
          skip_list: ['test*'],
          // Other fields should use defaults
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.skipList).toEqual(['test*']);
      expect(config.safePaths).toEqual(DEFAULT_SAFE_PATHS);
      expect(config.scanTimeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    });

    it('should override config with environment variables', async () => {
      process.env.ATIP_DISCOVER_SAFE_PATHS = '/env/bin1:/env/bin2';
      process.env.ATIP_DISCOVER_SKIP = 'env-tool,test*';
      process.env.ATIP_DISCOVER_TIMEOUT = '10s';
      process.env.ATIP_DISCOVER_PARALLEL = '16';

      const config = await loadConfig();

      expect(config.safePaths).toContain('/env/bin1');
      expect(config.safePaths).toContain('/env/bin2');
      expect(config.skipList).toContain('env-tool');
      expect(config.skipList).toContain('test*');
      expect(config.scanTimeoutMs).toBe(10000);
      expect(config.parallelism).toBe(16);
    });

    it('should parse duration strings (s, m, h)', async () => {
      const fileConfig = {
        version: '1',
        discovery: {
          scan_timeout: '3s',
        },
        cache: {
          max_age: '24h',
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.scanTimeoutMs).toBe(3000);
      expect(config.cacheMaxAgeMs).toBe(24 * 60 * 60 * 1000);
    });

    it('should validate parallelism range', async () => {
      const fileConfig = {
        version: '1',
        discovery: {
          parallelism: 0, // Invalid: must be > 0
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      await expect(loadConfig(configPath)).rejects.toThrow(/parallelism|invalid/i);
    });

    it('should validate timeout range', async () => {
      const fileConfig = {
        version: '1',
        discovery: {
          scan_timeout: '0s', // Invalid: must be > 0
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      await expect(loadConfig(configPath)).rejects.toThrow(/timeout|invalid/i);
    });

    it('should expand tilde in paths', async () => {
      const fileConfig = {
        version: '1',
        discovery: {
          safe_paths: ['~/custom/bin'],
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.safePaths[0]).toBe(path.join(os.homedir(), 'custom', 'bin'));
    });

    it('should handle invalid JSON in config file', async () => {
      await fs.writeFile(configPath, '{ invalid json }');

      await expect(loadConfig(configPath)).rejects.toThrow(/json|parse/i);
    });

    it('should use ATIP_DISCOVER_CONFIG environment variable for config path', async () => {
      const customConfig = {
        version: '1',
        discovery: {
          parallelism: 32,
        },
      };

      await fs.writeFile(configPath, JSON.stringify(customConfig, null, 2));
      process.env.ATIP_DISCOVER_CONFIG = configPath;

      const config = await loadConfig();

      expect(config.parallelism).toBe(32);
    });

    it('should handle missing version field gracefully', async () => {
      const fileConfig = {
        discovery: {
          parallelism: 8,
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.parallelism).toBe(8);
    });

    it('should support output format configuration', async () => {
      const fileConfig = {
        version: '1',
        output: {
          default_format: 'table',
          color: 'always',
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.outputFormat).toBe('table');
    });

    it('should handle cache configuration', async () => {
      const fileConfig = {
        version: '1',
        cache: {
          max_age: '48h',
          max_size_mb: 200,
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fileConfig, null, 2));

      const config = await loadConfig(configPath);

      expect(config.cacheMaxAgeMs).toBe(48 * 60 * 60 * 1000);
      expect(config.cacheMaxSizeBytes).toBe(200 * 1024 * 1024);
    });
  });

  describe('Default Constants', () => {
    it('should export DEFAULT_SAFE_PATHS', () => {
      expect(DEFAULT_SAFE_PATHS).toBeInstanceOf(Array);
      expect(DEFAULT_SAFE_PATHS).toContain('/usr/bin');
      expect(DEFAULT_SAFE_PATHS).toContain('/usr/local/bin');
    });

    it('should export DEFAULT_TIMEOUT_MS', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(2000);
    });

    it('should export DEFAULT_PARALLELISM', () => {
      expect(DEFAULT_PARALLELISM).toBe(4);
    });
  });
});
