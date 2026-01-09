/**
 * Semantic version bump recommendation logic
 */

import type { DiffResult, SemverBump, Change } from '../types.js';

/**
 * Get recommended semantic version bump based on changes
 * @param result - The diff result
 * @returns Recommended version bump
 */
export function getRecommendedBump(result: DiffResult): SemverBump {
  // Breaking changes always require major bump
  if (result.summary.hasBreakingChanges) {
    return 'major';
  }

  // Check effects changes by severity
  const effectsChanges = result.changes.filter(
    (c) => c.category === 'effects'
  );
  const hasHighSeverity = effectsChanges.some((c) => c.severity === 'high');

  // High-severity effects changes warrant minor bump
  if (hasHighSeverity) {
    return 'minor';
  }

  // Non-breaking changes (additions, relaxed types) require minor bump
  if (result.summary.nonBreakingChanges > 0) {
    return 'minor';
  }

  // Low/medium effects only require patch bump
  if (effectsChanges.length > 0) {
    return 'patch';
  }

  // No changes
  return 'none';
}

/**
 * Calculate semver bump from changes array
 * @param changes - Array of changes or DiffResult
 * @returns Recommended version bump
 */
export function calculateSemverBump(changes: Change[] | DiffResult): SemverBump {
  // If it's a DiffResult, delegate to getRecommendedBump
  if ('summary' in changes) {
    return getRecommendedBump(changes);
  }

  // Build a minimal DiffResult from changes array
  const breakingChanges = changes.filter(c => c.category === 'breaking').length;
  const nonBreakingChanges = changes.filter(c => c.category === 'non-breaking').length;
  const effectsChanges = changes.filter(c => c.category === 'effects').length;

  // Create minimal empty metadata for DiffResult interface compliance
  const emptyMetadata = {
    atip: { version: '0.6' },
    name: '',
    version: '',
    description: '',
  };

  const result: DiffResult = {
    summary: {
      totalChanges: changes.length,
      breakingChanges,
      nonBreakingChanges,
      effectsChanges,
      hasBreakingChanges: breakingChanges > 0,
      hasEffectsChanges: effectsChanges > 0,
    },
    changes,
    semverRecommendation: 'none',
    oldMetadata: emptyMetadata,
    newMetadata: emptyMetadata,
  };

  return getRecommendedBump(result);
}
