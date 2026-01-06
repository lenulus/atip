import type { AtipTool } from '../types/atip';
import type { Policy, Validator, ValidationResult, PolicyViolation } from '../types/safety';
import { flattenCommands, type FlattenedCommand } from '../internal/flatten';

/**
 * Create a validator for checking tool calls against a safety policy.
 *
 * @param tools - ATIP tools that may be called
 * @param policy - Safety policy to enforce
 * @returns Validator instance for checking calls
 *
 * @remarks
 * - Validator caches tool metadata for fast lookups
 * - Unknown tools are flagged with UNKNOWN_COMMAND violation
 * - All policy violations are returned (not just first)
 * - Policy defaults: all operations allowed
 * - Destructive/non-reversible violations have severity 'error'
 * - Network/filesystem violations have severity 'warning'
 *
 * @example
 * ```typescript
 * const validator = createValidator([ghTool], {
 *   allowDestructive: false,
 *   allowBillable: false
 * });
 *
 * const result = validator.validate('gh_repo_delete', { repo: 'test' });
 * // result.valid === false
 * // result.violations includes DESTRUCTIVE_OPERATION
 * ```
 */
export function createValidator(tools: AtipTool[], policy: Policy): Validator {
  // Build index of flattened commands and tool metadata
  const commandMap = new Map<string, { fc: FlattenedCommand; tool: AtipTool }>();

  for (const tool of tools) {
    const flattened = flattenCommands(tool);
    for (const fc of flattened) {
      commandMap.set(fc.name, { fc, tool });
    }
  }

  return {
    validate(toolName: string, _args: Record<string, unknown>): ValidationResult {
      const violations: PolicyViolation[] = [];

      // Check if command exists
      const entry = commandMap.get(toolName);
      if (!entry) {
        violations.push({
          code: 'UNKNOWN_COMMAND',
          message: `Command ${toolName} not found in tool metadata`,
          severity: 'error',
          toolName,
          commandPath: undefined,
        });
        return {
          valid: false,
          violations,
        };
      }

      const { fc, tool } = entry;

      // Check trust level
      if (policy.minTrustLevel && tool.trust) {
        const trustOrder = ['inferred', 'user', 'community', 'org', 'vendor', 'native'];
        const actualIndex = trustOrder.indexOf(tool.trust.source);
        const minIndex = trustOrder.indexOf(policy.minTrustLevel);

        if (actualIndex < minIndex) {
          violations.push({
            code: 'TRUST_BELOW_THRESHOLD',
            message: `Tool ${tool.name} trust level (${tool.trust.source}) is below threshold (${policy.minTrustLevel})`,
            severity: 'error',
            toolName,
            commandPath: fc.path,
          });
        }
      }

      const effects = fc.command.effects;
      if (!effects) {
        return {
          valid: violations.length === 0,
          violations,
        };
      }

      // Check destructive - also check non-reversible if destructive
      if (effects.destructive === true && policy.allowDestructive === false) {
        violations.push({
          code: 'DESTRUCTIVE_OPERATION',
          message: `Operation ${toolName} is destructive`,
          severity: 'error',
          toolName,
          commandPath: fc.path,
        });

        // If also non-reversible, add that violation too
        if (effects.reversible === false) {
          violations.push({
            code: 'NON_REVERSIBLE_OPERATION',
            message: `Operation ${toolName} cannot be reversed`,
            severity: 'error',
            toolName,
            commandPath: fc.path,
          });
        }
      }
      // Check reversible independently (if destructive wasn't checked)
      else if (effects.reversible === false && policy.allowNonReversible === false) {
        violations.push({
          code: 'NON_REVERSIBLE_OPERATION',
          message: `Operation ${toolName} cannot be reversed`,
          severity: 'error',
          toolName,
          commandPath: fc.path,
        });
      }

      // Check billable
      if (effects.cost?.billable === true && policy.allowBillable === false) {
        violations.push({
          code: 'BILLABLE_OPERATION',
          message: `Operation ${toolName} is billable`,
          severity: 'error',
          toolName,
          commandPath: fc.path,
        });
      }

      // Check network
      if (effects.network === true && policy.allowNetwork === false) {
        violations.push({
          code: 'NETWORK_OPERATION',
          message: `Operation ${toolName} requires network access`,
          severity: 'warning',
          toolName,
          commandPath: fc.path,
        });
      }

      // Check filesystem write
      if (effects.filesystem?.write === true && policy.allowFilesystemWrite === false) {
        violations.push({
          code: 'FILESYSTEM_WRITE',
          message: `Operation ${toolName} writes to filesystem`,
          severity: 'warning',
          toolName,
          commandPath: fc.path,
        });
      }

      // Check filesystem delete
      if (effects.filesystem?.delete === true && policy.allowFilesystemDelete === false) {
        violations.push({
          code: 'FILESYSTEM_DELETE',
          message: `Operation ${toolName} deletes files`,
          severity: 'warning',
          toolName,
          commandPath: fc.path,
        });
      }

      // Check cost estimate
      if (effects.cost?.estimate && policy.maxCostEstimate) {
        const costOrder = ['free', 'low', 'medium', 'high'];
        const actualIndex = costOrder.indexOf(effects.cost.estimate);
        const maxIndex = costOrder.indexOf(policy.maxCostEstimate);
        if (actualIndex > maxIndex) {
          violations.push({
            code: 'COST_EXCEEDS_LIMIT',
            message: `Operation ${toolName} cost estimate (${effects.cost.estimate}) exceeds limit (${policy.maxCostEstimate})`,
            severity: 'error',
            toolName,
            commandPath: fc.path,
          });
        }
      }

      return {
        valid: violations.length === 0,
        violations,
      };
    },
  };
}
