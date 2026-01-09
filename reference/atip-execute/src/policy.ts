/**
 * Policy enforcement based on effects metadata
 */

import { TRUST_LEVEL_ORDER } from './constants.js';

/**
 * Policy configuration for controlling what operations are allowed.
 */
export interface ExecutionPolicy {
  /** Allow operations marked as destructive */
  allowDestructive?: boolean;
  /** Allow operations that cannot be reversed */
  allowNonReversible?: boolean;
  /** Allow operations that incur monetary cost */
  allowBillable?: boolean;
  /** Allow operations that make network requests */
  allowNetwork?: boolean;
  /** Allow operations that write to filesystem */
  allowFilesystemWrite?: boolean;
  /** Allow operations that delete from filesystem */
  allowFilesystemDelete?: boolean;
  /** Minimum required trust level (native, vendor, org, community, user, inferred) */
  minTrustLevel?: string;
  /** Maximum allowed cost estimate (free, low, medium, high) */
  maxCostEstimate?: string;
  /** Handler for requesting user confirmation */
  confirmationHandler?: (context: ConfirmationContext) => Promise<boolean>;
  /** Allow commands that require interactive input */
  allowInteractive?: boolean;
}

/**
 * Context provided to confirmation handler for user decision.
 */
export interface ConfirmationContext {
  /** Name of the tool being executed */
  toolName: string;
  /** Command array that will be executed */
  command: string[];
  /** Arguments provided by the LLM */
  arguments: Record<string, unknown>;
  /** Reasons why confirmation is required */
  reasons: ConfirmationReason[];
  /** Effects metadata from ATIP spec */
  effects: any;
  /** Trust metadata from ATIP spec */
  trust?: any;
}

/**
 * Reasons why an operation requires confirmation.
 */
export type ConfirmationReason =
  | 'destructive'
  | 'non-reversible'
  | 'billable'
  | 'low-trust'
  | 'filesystem-delete'
  | 'cost-high';

/**
 * Result of checking a tool call against policy.
 */
export interface PolicyCheckResult {
  /** True if operation is allowed (may still require confirmation) */
  allowed: boolean;
  /** True if operation requires user confirmation */
  requiresConfirmation: boolean;
  /** Reasons why confirmation is needed */
  reasons: ConfirmationReason[];
  /** Policy violations (errors block execution, warnings don't) */
  violations: PolicyViolation[];
}

/**
 * A policy violation that blocks or warns about an operation.
 */
export interface PolicyViolation {
  /** Violation code */
  code: PolicyViolationCode;
  /** Human-readable violation message */
  message: string;
  /** Severity: errors block execution, warnings don't */
  severity: 'error' | 'warning';
}

/**
 * Types of policy violations.
 */
export type PolicyViolationCode =
  | 'DESTRUCTIVE_BLOCKED'
  | 'NON_REVERSIBLE_BLOCKED'
  | 'BILLABLE_BLOCKED'
  | 'NETWORK_BLOCKED'
  | 'FILESYSTEM_WRITE_BLOCKED'
  | 'FILESYSTEM_DELETE_BLOCKED'
  | 'TRUST_INSUFFICIENT'
  | 'COST_EXCEEDED'
  | 'INTERACTIVE_BLOCKED';

/**
 * Check if a tool call would be allowed by the current policy.
 *
 * Evaluates effects metadata against policy constraints to determine if
 * execution should proceed. Returns violations and reasons for confirmation.
 *
 * Hard blocking violations (e.g., network when allowNetwork: false) cannot
 * be overridden. Soft violations (e.g., destructive operations) can be
 * confirmed by the user.
 *
 * @param _toolCall - Tool call to check (currently unused, reserved for future use)
 * @param mapping - Command mapping with effects metadata
 * @param policy - Execution policy with constraints
 * @returns Policy check result with violations and confirmation requirements
 *
 * @example
 * ```typescript
 * const result = checkPolicy(toolCall, mapping, {
 *   allowDestructive: false,
 *   minTrustLevel: 'community',
 * });
 *
 * if (!result.allowed) {
 *   console.error('Blocked:', result.violations);
 * } else if (result.requiresConfirmation) {
 *   // Prompt user for confirmation
 * }
 * ```
 */
export function checkPolicy(
  _toolCall: any,
  mapping: any,
  policy: ExecutionPolicy
): PolicyCheckResult {
  const reasons: ConfirmationReason[] = [];
  const violations: PolicyViolation[] = [];

  const effects = mapping.effects;
  const trust = mapping.tool.trust;

  // Check destructive operations
  if (effects.destructive) {
    if (policy.allowDestructive === false) {
      reasons.push('destructive');
      violations.push({
        code: 'DESTRUCTIVE_BLOCKED',
        message: 'Destructive operations are not allowed',
        severity: 'error',
      });
    }
  }

  // Check non-reversible operations
  if (effects.reversible === false) {
    if (policy.allowNonReversible === false) {
      reasons.push('non-reversible');
      violations.push({
        code: 'NON_REVERSIBLE_BLOCKED',
        message: 'Non-reversible operations are not allowed',
        severity: 'error',
      });
    }
  }

  // Check billable operations
  if (effects.cost?.billable) {
    if (policy.allowBillable === false) {
      reasons.push('billable');
      violations.push({
        code: 'BILLABLE_BLOCKED',
        message: 'Billable operations are not allowed',
        severity: 'error',
      });
    }
  }

  // Check network operations
  if (effects.network) {
    if (policy.allowNetwork === false) {
      violations.push({
        code: 'NETWORK_BLOCKED',
        message: 'Network operations are not allowed',
        severity: 'error',
      });
    }
  }

  // Check filesystem operations
  if (effects.filesystem?.write) {
    if (policy.allowFilesystemWrite === false) {
      violations.push({
        code: 'FILESYSTEM_WRITE_BLOCKED',
        message: 'Filesystem write operations are not allowed',
        severity: 'error',
      });
    }
  }

  if (effects.filesystem?.delete) {
    if (policy.allowFilesystemDelete === false) {
      reasons.push('filesystem-delete');
      violations.push({
        code: 'FILESYSTEM_DELETE_BLOCKED',
        message: 'Filesystem delete operations are not allowed',
        severity: 'error',
      });
    }
  }

  // Check trust level
  if (policy.minTrustLevel && trust) {
    const actualLevel = TRUST_LEVEL_ORDER[trust.source] || 0;
    const requiredLevel = TRUST_LEVEL_ORDER[policy.minTrustLevel] || 0;

    if (actualLevel < requiredLevel) {
      reasons.push('low-trust');
      violations.push({
        code: 'TRUST_INSUFFICIENT',
        message: `Trust level ${trust.source} is below required ${policy.minTrustLevel}`,
        severity: 'error',
      });
    }
  }

  // Check cost estimate
  if (policy.maxCostEstimate && effects.cost?.estimate) {
    const costOrder = { free: 0, low: 1, medium: 2, high: 3 };
    const actualCost = costOrder[effects.cost.estimate as keyof typeof costOrder] ?? 3;
    const maxCost = costOrder[policy.maxCostEstimate as keyof typeof costOrder] ?? 3;

    if (actualCost > maxCost) {
      reasons.push('cost-high');
      violations.push({
        code: 'COST_EXCEEDED',
        message: `Cost estimate ${effects.cost.estimate} exceeds maximum ${policy.maxCostEstimate}`,
        severity: 'error',
      });
    }
  }

  // Check interactive requirements
  if (effects.interactive) {
    if (policy.allowInteractive === false) {
      violations.push({
        code: 'INTERACTIVE_BLOCKED',
        message: 'Interactive commands are not allowed',
        severity: 'error',
      });
    }
  }

  // Determine if allowed
  // Policy violations that cannot be overridden by confirmation
  const hasHardBlockingViolations = violations.some(
    (v) =>
      v.severity === 'error' &&
      v.code !== 'DESTRUCTIVE_BLOCKED' &&
      v.code !== 'NON_REVERSIBLE_BLOCKED' &&
      v.code !== 'BILLABLE_BLOCKED' &&
      v.code !== 'FILESYSTEM_DELETE_BLOCKED' &&
      v.code !== 'TRUST_INSUFFICIENT' &&
      v.code !== 'COST_EXCEEDED'
  );

  const requiresConfirmation = reasons.length > 0;

  // If there are hard blocking violations, not allowed
  // If there are soft violations (that require confirmation), not allowed without confirmation
  const allowed = !hasHardBlockingViolations && violations.length === 0;

  return {
    allowed,
    requiresConfirmation,
    reasons,
    violations,
  };
}
