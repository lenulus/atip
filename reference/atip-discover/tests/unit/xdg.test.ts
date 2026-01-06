import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAtipPaths } from '../../src/xdg';
import * as os from 'os';
import * as path from 'path';

describe('XDG Path Resolution', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getAtipPaths', () => {
    it('should use XDG_DATA_HOME when set', () => {
      process.env.XDG_DATA_HOME = '/custom/data';
      const paths = getAtipPaths();

      expect(paths.dataDir).toBe('/custom/data/agent-tools');
      expect(paths.registryPath).toBe('/custom/data/agent-tools/registry.json');
      expect(paths.toolsDir).toBe('/custom/data/agent-tools/tools');
      expect(paths.shimsDir).toBe('/custom/data/agent-tools/shims');
    });

    it('should use XDG_CONFIG_HOME when set', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const paths = getAtipPaths();

      expect(paths.configDir).toBe('/custom/config/agent-tools');
    });

    it('should fall back to default data dir when XDG_DATA_HOME not set', () => {
      delete process.env.XDG_DATA_HOME;
      const paths = getAtipPaths();

      const expectedDataDir = path.join(os.homedir(), '.local', 'share', 'agent-tools');
      expect(paths.dataDir).toBe(expectedDataDir);
    });

    it('should fall back to default config dir when XDG_CONFIG_HOME not set', () => {
      delete process.env.XDG_CONFIG_HOME;
      const paths = getAtipPaths();

      const expectedConfigDir = path.join(os.homedir(), '.config', 'agent-tools');
      expect(paths.configDir).toBe(expectedConfigDir);
    });

    it('should expand tilde in custom paths', () => {
      const paths = getAtipPaths({ dataDir: '~/custom/data' });

      expect(paths.dataDir).toBe(path.join(os.homedir(), 'custom', 'data'));
    });

    it('should allow full path override', () => {
      const customPaths = {
        dataDir: '/custom/data',
        configDir: '/custom/config',
      };

      const paths = getAtipPaths(customPaths);

      expect(paths.dataDir).toBe('/custom/data');
      expect(paths.configDir).toBe('/custom/config');
      expect(paths.registryPath).toBe('/custom/data/registry.json');
    });

    it('should handle Windows paths on Windows', () => {
      if (process.platform === 'win32') {
        delete process.env.XDG_DATA_HOME;
        const paths = getAtipPaths();

        // On Windows, should use LOCALAPPDATA
        expect(paths.dataDir).toContain('AppData');
      }
    });

    it('should return absolute paths', () => {
      const paths = getAtipPaths();

      expect(path.isAbsolute(paths.dataDir)).toBe(true);
      expect(path.isAbsolute(paths.configDir)).toBe(true);
      expect(path.isAbsolute(paths.registryPath)).toBe(true);
      expect(path.isAbsolute(paths.toolsDir)).toBe(true);
      expect(path.isAbsolute(paths.shimsDir)).toBe(true);
    });

    it('should include all required paths', () => {
      const paths = getAtipPaths();

      expect(paths).toHaveProperty('dataDir');
      expect(paths).toHaveProperty('configDir');
      expect(paths).toHaveProperty('registryPath');
      expect(paths).toHaveProperty('toolsDir');
      expect(paths).toHaveProperty('shimsDir');
    });

    it('should use ATIP_DISCOVER_DATA_DIR environment variable', () => {
      process.env.ATIP_DISCOVER_DATA_DIR = '/override/data';
      const paths = getAtipPaths();

      expect(paths.dataDir).toBe('/override/data');
    });
  });
});
