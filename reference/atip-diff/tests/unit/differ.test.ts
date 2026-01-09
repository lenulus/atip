import { describe, it, expect } from 'vitest';
import { createDiffer } from '../../src/differ/differ';
import type { AtipTool, DiffConfig } from '../../src/types';

describe('differ', () => {
  describe('createDiffer', () => {
    it('should create a differ instance', () => {
      const differ = createDiffer();
      expect(differ).toBeDefined();
      expect(differ.diff).toBeDefined();
      expect(differ.diffFiles).toBeDefined();
      expect(differ.diffStrings).toBeDefined();
    });

    it('should accept configuration', () => {
      const config: DiffConfig = {
        ignoreVersion: true,
        ignoreDescription: true,
      };
      const differ = createDiffer(config);
      expect(differ).toBeDefined();
    });
  });

  describe('differ.diff', () => {
    it('should diff two metadata objects', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        version: '2.0.0',
      };

      const result = differ.diff(old, newMeta);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.changes).toBeDefined();
      expect(result.semverRecommendation).toBeDefined();
    });

    it('should return empty changes for identical metadata', () => {
      const differ = createDiffer();
      const meta: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };

      const result = differ.diff(meta, meta);

      expect(result.changes).toHaveLength(0);
      expect(result.summary.totalChanges).toBe(0);
    });
  });

  describe('differ.diffFiles', () => {
    it('should diff two files', async () => {
      const differ = createDiffer();
      const oldPath = 'tests/fixtures/base/minimal.json';
      const newPath = 'tests/fixtures/non-breaking/optional-arg-added.json';

      const result = await differ.diffFiles(oldPath, newPath);

      expect(result).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should throw error for missing file', async () => {
      const differ = createDiffer();

      await expect(
        differ.diffFiles('nonexistent.json', 'tests/fixtures/base/minimal.json')
      ).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      const differ = createDiffer();

      await expect(
        differ.diffFiles('tests/fixtures/invalid.json', 'tests/fixtures/base/minimal.json')
      ).rejects.toThrow();
    });
  });

  describe('differ.diffStrings', () => {
    it('should diff two JSON strings', () => {
      const differ = createDiffer();
      const oldJson = JSON.stringify({
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Old',
        commands: {},
      });
      const newJson = JSON.stringify({
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'New',
        commands: {},
      });

      const result = differ.diffStrings(oldJson, newJson);

      expect(result).toBeDefined();
      expect(result.changes.some(c => c.type === 'description-changed')).toBe(true);
    });

    it('should throw error for invalid JSON string', () => {
      const differ = createDiffer();
      const invalidJson = '{ invalid json }';
      const validJson = JSON.stringify({ atip: { version: '0.6' }, name: 'test', version: '1.0.0', description: 'Test', commands: {} });

      expect(() => differ.diffStrings(invalidJson, validJson)).toThrow();
    });
  });

  describe('differ.getRecommendedBump', () => {
    it('should return correct semver bump', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: { run: { description: 'Run' } },
      };
      const newMeta: AtipTool = {
        ...old,
        commands: {},
      };

      const result = differ.diff(old, newMeta);
      const bump = differ.getRecommendedBump(result);

      expect(bump).toBe('major');
    });
  });

  describe('differ.filterByCategory', () => {
    it('should filter breaking changes', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: { description: 'Run' },
          build: { description: 'Build' },
        },
      };
      const newMeta: AtipTool = {
        ...old,
        commands: { run: { description: 'Run' } },
      };

      const result = differ.diff(old, newMeta);
      const breaking = differ.filterByCategory(result, 'breaking');

      expect(breaking.length).toBeGreaterThan(0);
      expect(breaking.every(c => c.category === 'breaking')).toBe(true);
    });

    it('should filter non-breaking changes', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        commands: { test: { description: 'Test' } },
      };

      const result = differ.diff(old, newMeta);
      const nonBreaking = differ.filterByCategory(result, 'non-breaking');

      expect(nonBreaking.length).toBeGreaterThan(0);
      expect(nonBreaking.every(c => c.category === 'non-breaking')).toBe(true);
    });

    it('should filter effects changes', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          delete: {
            description: 'Delete',
            effects: { network: true },
          },
        },
      };
      const newMeta: AtipTool = {
        ...old,
        commands: {
          delete: {
            description: 'Delete',
            effects: { network: true, destructive: true },
          },
        },
      };

      const result = differ.diff(old, newMeta);
      const effects = differ.filterByCategory(result, 'effects');

      expect(effects.length).toBeGreaterThan(0);
      expect(effects.every(c => c.category === 'effects')).toBe(true);
    });
  });

  describe('differ.hasBreakingChanges', () => {
    it('should return true for breaking changes', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: { run: { description: 'Run' } },
      };
      const newMeta: AtipTool = {
        ...old,
        commands: {},
      };

      const result = differ.diff(old, newMeta);

      expect(differ.hasBreakingChanges(result)).toBe(true);
    });

    it('should return false for no breaking changes', () => {
      const differ = createDiffer();
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        commands: { test: { description: 'Test' } },
      };

      const result = differ.diff(old, newMeta);

      expect(differ.hasBreakingChanges(result)).toBe(false);
    });
  });

  describe('configuration options', () => {
    it('should ignore version when configured', () => {
      const differ = createDiffer({ ignoreVersion: true });
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        version: '2.0.0',
      };

      const result = differ.diff(old, newMeta);

      expect(result.changes.some(c => c.type === 'version-changed')).toBe(false);
    });

    it('should ignore description when configured', () => {
      const differ = createDiffer({ ignoreDescription: true });
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Old',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        description: 'New',
      };

      const result = differ.diff(old, newMeta);

      expect(result.changes.some(c => c.type === 'description-changed')).toBe(false);
    });

    it('should filter with breakingOnly', () => {
      const differ = createDiffer({ breakingOnly: true });
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: { run: { description: 'Run' } },
      };
      const newMeta: AtipTool = {
        ...old,
        version: '2.0.0',
        commands: {},
      };

      const result = differ.diff(old, newMeta);

      expect(result.changes.every(c => c.category === 'breaking')).toBe(true);
    });

    it('should filter with effectsOnly', () => {
      const differ = createDiffer({ effectsOnly: true });
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          delete: {
            description: 'Delete',
            effects: { network: true },
          },
        },
      };
      const newMeta: AtipTool = {
        ...old,
        version: '2.0.0',
        commands: {
          delete: {
            description: 'Delete',
            effects: { network: true, destructive: true },
          },
        },
      };

      const result = differ.diff(old, newMeta);

      expect(result.changes.every(c => c.category === 'effects')).toBe(true);
    });
  });
});
