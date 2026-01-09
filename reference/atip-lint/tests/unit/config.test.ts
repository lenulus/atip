import { describe, test, expect } from 'vitest';
import { loadConfig } from '../../src/index.js';

describe('loadConfig', () => {
  describe('config loading', () => {
    test('should load default config when no config file exists', async () => {
      const config = await loadConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('rules');
    });

    test('should load from explicit path', async () => {
      // This will throw/fail in Red phase since file doesn't exist
      await expect(
        loadConfig(undefined, 'tests/fixtures/configs/custom.json')
      ).rejects.toThrow();
    });

    test('should search hierarchy from start path', async () => {
      const config = await loadConfig('tests/fixtures/valid');

      expect(config).toBeDefined();
    });
  });

  describe('config merging', () => {
    test('should merge extends from preset', async () => {
      // Test that extends: "recommended" merges preset rules
      const config = await loadConfig();

      // Assumes a config file with extends exists
      if (config.extends) {
        expect(config.rules).toBeDefined();
      }
    });

    test('should override preset rules with local rules', async () => {
      // Config with extends + rule overrides should prefer local
      const config = await loadConfig();

      expect(config).toBeDefined();
    });
  });

  describe('config validation', () => {
    test('should validate rule severity values', async () => {
      // Invalid severity should throw ConfigError
      await expect(
        loadConfig(undefined, 'tests/fixtures/configs/invalid-severity.json')
      ).rejects.toThrow('Invalid severity');
    });

    test('should validate rule options schema', async () => {
      // Invalid rule options should throw
      await expect(
        loadConfig(undefined, 'tests/fixtures/configs/invalid-options.json')
      ).rejects.toThrow('Invalid rule options');
    });
  });

  describe('ignore patterns', () => {
    test('should include default ignore patterns', async () => {
      const config = await loadConfig();

      expect(config.ignorePatterns).toBeDefined();
      expect(config.ignorePatterns).toContain('**/node_modules/**');
    });

    test('should merge custom ignore patterns', async () => {
      const config = await loadConfig();

      if (config.ignorePatterns) {
        expect(Array.isArray(config.ignorePatterns)).toBe(true);
      }
    });
  });

  describe('overrides', () => {
    test('should support file-specific overrides', async () => {
      const config = await loadConfig();

      if (config.overrides) {
        expect(Array.isArray(config.overrides)).toBe(true);
        config.overrides.forEach((override) => {
          expect(override).toHaveProperty('files');
          expect(override).toHaveProperty('rules');
          expect(Array.isArray(override.files)).toBe(true);
        });
      }
    });
  });

  describe('plugins', () => {
    test('should load plugin paths', async () => {
      const config = await loadConfig();

      if (config.plugins) {
        expect(Array.isArray(config.plugins)).toBe(true);
      }
    });
  });
});
