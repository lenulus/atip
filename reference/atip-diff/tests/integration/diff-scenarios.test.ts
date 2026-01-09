import { describe, it, expect } from 'vitest';
import { diff, diffFiles } from '../../src';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AtipTool } from '../../src/types';

const FIXTURES_PATH = join(__dirname, '../fixtures');

function loadFixture(relativePath: string): AtipTool {
  const content = readFileSync(join(FIXTURES_PATH, relativePath), 'utf-8');
  return JSON.parse(content);
}

describe('Diff Scenarios Integration', () => {
  describe('Breaking Changes', () => {
    it('should detect command removed', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'breaking/command-removed.json')
      );

      expect(result.summary.hasBreakingChanges).toBe(true);
      expect(result.summary.breakingChanges).toBeGreaterThan(0);
      expect(result.changes.some(c => c.type === 'command-removed')).toBe(true);
      expect(result.semverRecommendation).toBe('major');
    });

    it('should detect required argument added', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/minimal.json'),
        join(FIXTURES_PATH, 'breaking/required-arg-added.json')
      );

      expect(result.summary.hasBreakingChanges).toBe(true);
      const change = result.changes.find(c => c.type === 'required-argument-added');
      expect(change).toBeDefined();
      expect(change?.category).toBe('breaking');
      expect(result.semverRecommendation).toBe('major');
    });

    it('should detect type made stricter (enum values removed)', async () => {
      const oldMeta = loadFixture('base/complete.json');
      const newMeta = loadFixture('breaking/type-stricter.json');

      const result = diff(oldMeta, newMeta);

      expect(result.summary.hasBreakingChanges).toBe(true);
      expect(result.changes.some(c =>
        c.type === 'enum-values-removed' || c.type === 'type-made-stricter'
      )).toBe(true);
    });
  });

  describe('Non-Breaking Changes', () => {
    it('should detect command added', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'non-breaking/command-added.json')
      );

      expect(result.summary.hasBreakingChanges).toBe(false);
      expect(result.changes.some(c => c.type === 'command-added')).toBe(true);
      expect(result.semverRecommendation).toBe('minor');
    });

    it('should detect optional argument added', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/minimal.json'),
        join(FIXTURES_PATH, 'non-breaking/optional-arg-added.json')
      );

      expect(result.summary.hasBreakingChanges).toBe(false);
      const change = result.changes.find(c => c.type === 'optional-argument-added');
      expect(change).toBeDefined();
      expect(change?.category).toBe('non-breaking');
    });

    it('should detect description changed', async () => {
      const oldMeta: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Old description',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...oldMeta,
        description: 'New description',
      };

      const result = diff(oldMeta, newMeta);

      expect(result.changes.some(c => c.type === 'description-changed')).toBe(true);
      expect(result.summary.nonBreakingChanges).toBeGreaterThan(0);
    });
  });

  describe('Effects Changes', () => {
    it('should detect destructive flag added with high severity', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'effects/destructive-added.json')
      );

      expect(result.summary.hasEffectsChanges).toBe(true);
      const change = result.changes.find(c => c.type === 'destructive-added');
      expect(change).toBeDefined();
      expect(change?.category).toBe('effects');
      expect(change?.severity).toBe('high');
    });

    it('should detect cost.billable changed with high severity', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'effects/destructive-added.json')
      );

      const costChange = result.changes.find(c =>
        c.type === 'cost-changed' && c.path.includes('billable')
      );
      expect(costChange).toBeDefined();
      expect(costChange?.severity).toBe('high');
    });

    it('should detect reversible changed with medium severity', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'effects/destructive-added.json')
      );

      const reversibleChange = result.changes.find(c => c.type === 'reversible-changed');
      expect(reversibleChange).toBeDefined();
      expect(reversibleChange?.severity).toBe('medium');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple changes correctly', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'complex/multi-change.json')
      );

      expect(result.summary.totalChanges).toBeGreaterThan(1);
      expect(result.summary.hasBreakingChanges).toBe(true);
      expect(result.summary.hasEffectsChanges).toBe(true);
      expect(result.semverRecommendation).toBe('major');
    });

    it('should categorize all changes correctly', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'complex/multi-change.json')
      );

      const breaking = result.changes.filter(c => c.category === 'breaking');
      const nonBreaking = result.changes.filter(c => c.category === 'non-breaking');
      const effects = result.changes.filter(c => c.category === 'effects');

      expect(breaking.length).toBe(result.summary.breakingChanges);
      expect(nonBreaking.length).toBe(result.summary.nonBreakingChanges);
      expect(effects.length).toBe(result.summary.effectsChanges);
    });

    it('should track paths correctly for nested commands', async () => {
      const oldMeta: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          pr: {
            description: 'Pull requests',
            commands: {
              create: {
                description: 'Create PR',
                effects: { network: true },
              },
            },
          },
        },
      };

      const newMeta: AtipTool = {
        ...oldMeta,
        commands: {
          pr: {
            description: 'Pull requests',
            commands: {
              create: {
                description: 'Create PR',
                effects: { network: true },
              },
              merge: {
                description: 'Merge PR',
                effects: { network: true, destructive: true },
              },
            },
          },
        },
      };

      const result = diff(oldMeta, newMeta);

      const addChange = result.changes.find(c => c.type === 'command-added');
      expect(addChange?.path).toEqual(['commands', 'pr', 'commands', 'merge']);
    });
  });

  describe('Semver Recommendations', () => {
    it('should recommend major for breaking changes', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'breaking/command-removed.json')
      );

      expect(result.semverRecommendation).toBe('major');
    });

    it('should recommend minor for non-breaking additions', async () => {
      const result = await diffFiles(
        join(FIXTURES_PATH, 'base/complete.json'),
        join(FIXTURES_PATH, 'non-breaking/command-added.json')
      );

      expect(result.semverRecommendation).toBe('minor');
    });

    it('should recommend minor for high-severity effects changes', async () => {
      const oldMeta: AtipTool = {
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
        ...oldMeta,
        commands: {
          delete: {
            description: 'Delete',
            effects: { network: true, destructive: true },
          },
        },
      };

      const result = diff(oldMeta, newMeta);

      expect(result.semverRecommendation).toBe('minor');
    });

    it('should recommend patch for low-severity effects changes only', async () => {
      const oldMeta: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          fetch: {
            description: 'Fetch',
            effects: { network: false },
          },
        },
      };

      const newMeta: AtipTool = {
        ...oldMeta,
        commands: {
          fetch: {
            description: 'Fetch',
            effects: { network: true },
          },
        },
      };

      const result = diff(oldMeta, newMeta);

      expect(result.semverRecommendation).toBe('patch');
    });

    it('should recommend none for no changes', async () => {
      const meta = loadFixture('base/minimal.json');
      const result = diff(meta, meta);

      expect(result.semverRecommendation).toBe('none');
    });
  });

  describe('Real ATIP Examples', () => {
    it('should successfully diff real ATIP files from examples/', async () => {
      const ghPath = join(__dirname, '../../../../examples/gh.json');
      const minimalPath = join(__dirname, '../../../../examples/minimal.json');

      const result = await diffFiles(minimalPath, ghPath);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.changes).toBeDefined();
    });

    it('should handle legacy atip format (string version)', async () => {
      const oldMeta: AtipTool = {
        atip: '0.4' as any,
        name: 'legacy',
        version: '1.0.0',
        description: 'Legacy format',
        commands: {},
      };

      const newMeta: AtipTool = {
        atip: { version: '0.6' },
        name: 'legacy',
        version: '1.0.0',
        description: 'Legacy format',
        commands: {},
      };

      const result = diff(oldMeta, newMeta);

      expect(result).toBeDefined();
    });
  });
});
