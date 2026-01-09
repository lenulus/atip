/**
 * Breaking change detection and explanation logic
 */

import type { ChangeType } from '../types.js';
import { BREAKING_CHANGE_TYPES } from '../constants.js';

/**
 * Check if a change type is breaking
 * @param changeType - The type of change
 * @returns True if the change is breaking
 */
export function isBreakingChange(changeType: ChangeType): boolean {
  return BREAKING_CHANGE_TYPES.includes(changeType);
}

/**
 * Get human-readable explanation of why a change is breaking
 * @param changeType - The type of change
 * @param path - Path in metadata where change occurred
 * @returns Explanation of why the change is breaking
 */
export function getBreakingReason(changeType: ChangeType, path: string[]): string {
  const pathStr = path.join('.');

  switch (changeType) {
    case 'command-removed':
      return `Agents calling this command will fail. Command no longer exists: ${pathStr}`;

    case 'required-argument-added':
      return `Existing calls missing arg will fail. Required argument added: ${pathStr}`;

    case 'required-option-added':
      return `Existing calls missing option will fail. Required option added: ${pathStr}`;

    case 'type-made-stricter':
      return `Previously valid values may be rejected. Type became more restrictive: ${pathStr}`;

    case 'enum-values-removed':
      return `Previously valid enum values are no longer valid: ${pathStr}`;

    case 'argument-removed':
      return `Existing calls with arg may fail or behave differently. Argument removed: ${pathStr}`;

    case 'option-removed':
      return `Existing calls with option will fail. Option removed: ${pathStr}`;

    case 'option-flags-changed':
      return `Existing calls with old flag will fail. Option flags changed: ${pathStr}`;

    case 'argument-made-required':
      return `Existing calls without arg will fail. Argument now required: ${pathStr}`;

    case 'option-made-required':
      return `Existing calls without option will fail. Option now required: ${pathStr}`;

    default:
      return `Breaking change detected at: ${pathStr}`;
  }
}
