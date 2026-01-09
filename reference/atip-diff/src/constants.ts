/**
 * Constants for atip-diff
 */

import type { ChangeType, ChangeSeverity, SemverBump } from './types.js';

/**
 * Change types that are considered breaking
 */
export const BREAKING_CHANGE_TYPES: readonly ChangeType[] = [
  'command-removed',
  'required-argument-added',
  'required-option-added',
  'type-made-stricter',
  'enum-values-removed',
  'argument-removed',
  'option-removed',
  'option-flags-changed',
  'argument-made-required',
  'option-made-required',
];

/**
 * Change types that are non-breaking
 */
export const NON_BREAKING_CHANGE_TYPES: readonly ChangeType[] = [
  'command-added',
  'optional-argument-added',
  'optional-option-added',
  'type-relaxed',
  'enum-values-added',
  'description-changed',
  'default-value-changed',
  'examples-changed',
  'argument-made-optional',
  'option-made-optional',
  'homepage-changed',
  'version-changed',
  'patterns-changed',
];

/**
 * Change types that are effects-related
 */
export const EFFECTS_CHANGE_TYPES: readonly ChangeType[] = [
  'destructive-added',
  'destructive-removed',
  'reversible-changed',
  'idempotent-changed',
  'network-changed',
  'filesystem-changed',
  'cost-changed',
  'interactive-changed',
  'duration-changed',
];

/**
 * Severity mapping for effects changes
 */
export const EFFECTS_SEVERITY_MAP: Record<string, ChangeSeverity> = {
  destructive: 'high',
  'cost.billable': 'high',
  reversible: 'medium',
  idempotent: 'medium',
  'interactive.stdin': 'medium',
  'interactive.prompts': 'medium',
  'interactive.tty': 'medium',
  'filesystem.write': 'medium',
  'filesystem.delete': 'medium',
  'filesystem.read': 'low',
  network: 'low',
  'duration.typical': 'low',
  'duration.timeout': 'low',
  'cost.estimate': 'low',
};

/**
 * Semver bump rules based on change categories
 */
export const SEMVER_RULES = {
  breaking: 'major' as SemverBump,
  effectsHigh: 'minor' as SemverBump,
  nonBreaking: 'minor' as SemverBump,
  effectsLowMedium: 'patch' as SemverBump,
  none: 'none' as SemverBump,
};
