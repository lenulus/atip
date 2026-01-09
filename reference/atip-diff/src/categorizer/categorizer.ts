/**
 * Change categorization logic
 */

import type { ChangeType, ChangeCategory, ChangeSeverity } from '../types.js';
import {
  BREAKING_CHANGE_TYPES,
  NON_BREAKING_CHANGE_TYPES,
  EFFECTS_CHANGE_TYPES,
  EFFECTS_SEVERITY_MAP,
} from '../constants.js';

/**
 * Categorize a single change based on ATIP schema semantics.
 *
 * Determines whether a change is breaking, non-breaking, or effects-related
 * based on the change type and context.
 *
 * @param changeType - The type of change detected
 * @param _path - Path in metadata where change occurred (unused, reserved for future use)
 * @param _oldValue - Old value (unused, reserved for future use)
 * @param _newValue - New value (unused, reserved for future use)
 * @returns Category of the change ('breaking', 'non-breaking', or 'effects')
 *
 * @example
 * ```typescript
 * const category = categorizeChange('command-removed', ['commands', 'deploy']);
 * console.log(category); // 'breaking'
 * ```
 */
export function categorizeChange(
  changeType: ChangeType,
  _path?: string[],
  _oldValue?: unknown,
  _newValue?: unknown
): ChangeCategory {
  if (BREAKING_CHANGE_TYPES.includes(changeType)) {
    return 'breaking';
  }
  if (NON_BREAKING_CHANGE_TYPES.includes(changeType)) {
    return 'non-breaking';
  }
  if (EFFECTS_CHANGE_TYPES.includes(changeType)) {
    return 'effects';
  }
  return 'non-breaking';
}

/**
 * Determine severity of an effects change.
 *
 * Severity is based on the safety implications:
 * - high: destructive added, billable added
 * - medium: reversible/idempotent changed, interactive changed
 * - low: network changed, duration changed
 *
 * @param effectField - The effects field that changed (e.g., 'destructive', 'cost.billable')
 * @param _oldValue - Old value (unused, reserved for future use)
 * @param _newValue - New value (unused, reserved for future use)
 * @returns Severity level ('high', 'medium', or 'low')
 *
 * @example
 * ```typescript
 * const severity = getEffectsSeverity('destructive', false, true);
 * console.log(severity); // 'high'
 * ```
 */
export function getEffectsSeverity(
  effectField: string,
  _oldValue?: unknown,
  _newValue?: unknown
): ChangeSeverity {
  // Check for exact match
  if (effectField in EFFECTS_SEVERITY_MAP) {
    return EFFECTS_SEVERITY_MAP[effectField];
  }

  // Check for nested fields (e.g., cost.billable, filesystem.write)
  for (const [key, severity] of Object.entries(EFFECTS_SEVERITY_MAP)) {
    if (effectField.endsWith(key) || effectField.includes(key)) {
      return severity;
    }
  }

  // Default to medium for unknown effects fields
  return 'medium';
}
