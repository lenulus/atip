import { describe, it, expect } from 'vitest';
import { getRecommendedBump, calculateSemverBump } from '../../src/semver/semver';
import type { DiffResult, Change, SemverBump } from '../../src/types';

describe('semver', () => {
  describe('getRecommendedBump', () => {
    it('should recommend major for breaking changes', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 1,
          breakingChanges: 1,
          nonBreakingChanges: 0,
          effectsChanges: 0,
          hasBreakingChanges: true,
          hasEffectsChanges: false,
        },
        changes: [
          {
            type: 'command-removed',
            category: 'breaking',
            message: 'Command removed',
            path: ['commands', 'deploy'],
          },
        ],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('major');
    });

    it('should recommend minor for non-breaking changes', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 1,
          breakingChanges: 0,
          nonBreakingChanges: 1,
          effectsChanges: 0,
          hasBreakingChanges: false,
          hasEffectsChanges: false,
        },
        changes: [
          {
            type: 'command-added',
            category: 'non-breaking',
            message: 'Command added',
            path: ['commands', 'test'],
          },
        ],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('minor');
    });

    it('should recommend minor for high-severity effects changes', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 1,
          breakingChanges: 0,
          nonBreakingChanges: 0,
          effectsChanges: 1,
          hasBreakingChanges: false,
          hasEffectsChanges: true,
        },
        changes: [
          {
            type: 'destructive-added',
            category: 'effects',
            severity: 'high',
            message: 'Destructive flag added',
            path: ['commands', 'delete', 'effects', 'destructive'],
          },
        ],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('minor');
    });

    it('should recommend patch for low-severity effects changes only', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 1,
          breakingChanges: 0,
          nonBreakingChanges: 0,
          effectsChanges: 1,
          hasBreakingChanges: false,
          hasEffectsChanges: true,
        },
        changes: [
          {
            type: 'network-changed',
            category: 'effects',
            severity: 'low',
            message: 'Network flag changed',
            path: ['commands', 'fetch', 'effects', 'network'],
          },
        ],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('patch');
    });

    it('should recommend none for no changes', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 0,
          breakingChanges: 0,
          nonBreakingChanges: 0,
          effectsChanges: 0,
          hasBreakingChanges: false,
          hasEffectsChanges: false,
        },
        changes: [],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('none');
    });

    it('should prioritize breaking over non-breaking changes', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 2,
          breakingChanges: 1,
          nonBreakingChanges: 1,
          effectsChanges: 0,
          hasBreakingChanges: true,
          hasEffectsChanges: false,
        },
        changes: [
          {
            type: 'command-removed',
            category: 'breaking',
            message: 'Command removed',
            path: ['commands', 'deploy'],
          },
          {
            type: 'command-added',
            category: 'non-breaking',
            message: 'Command added',
            path: ['commands', 'test'],
          },
        ],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('major');
    });

    it('should recommend minor for medium-severity effects changes', () => {
      const result: DiffResult = {
        summary: {
          totalChanges: 1,
          breakingChanges: 0,
          nonBreakingChanges: 0,
          effectsChanges: 1,
          hasBreakingChanges: false,
          hasEffectsChanges: true,
        },
        changes: [
          {
            type: 'reversible-changed',
            category: 'effects',
            severity: 'medium',
            message: 'Reversible changed',
            path: ['commands', 'deploy', 'effects', 'reversible'],
          },
        ],
        semverRecommendation: 'none',
        oldMetadata: {} as any,
        newMetadata: {} as any,
      };
      const bump = getRecommendedBump(result);
      expect(bump).toBe('patch');
    });
  });

  describe('calculateSemverBump', () => {
    it('should calculate major bump correctly', () => {
      const changes: Change[] = [
        {
          type: 'command-removed',
          category: 'breaking',
          message: 'Breaking change',
          path: ['commands', 'test'],
        },
      ];
      const bump = calculateSemverBump(changes);
      expect(bump).toBe('major');
    });

    it('should calculate minor bump correctly', () => {
      const changes: Change[] = [
        {
          type: 'command-added',
          category: 'non-breaking',
          message: 'New command',
          path: ['commands', 'test'],
        },
      ];
      const bump = calculateSemverBump(changes);
      expect(bump).toBe('minor');
    });

    it('should calculate patch bump correctly', () => {
      const changes: Change[] = [
        {
          type: 'network-changed',
          category: 'effects',
          severity: 'low',
          message: 'Network changed',
          path: ['commands', 'fetch', 'effects', 'network'],
        },
      ];
      const bump = calculateSemverBump(changes);
      expect(bump).toBe('patch');
    });
  });
});
