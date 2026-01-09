import type { RuleDefinition } from '../types.js';

export const validEffectsValues: RuleDefinition = {
  meta: {
    category: 'consistency',
    description: 'Effects values should be valid and consistent',
    fixable: false,
    defaultSeverity: 'error',
  },

  create(context) {
    function checkBoolean(value: any, fieldPath: string[], fieldName: string): void {
      if (value !== undefined && typeof value !== 'boolean') {
        context.report({
          message: `Field "${fieldName}" must be a boolean`,
          path: fieldPath,
        });
      }
    }

    function checkEnum(value: any, fieldPath: string[], fieldName: string, validValues: string[]): void {
      if (value !== undefined && !validValues.includes(value)) {
        context.report({
          message: `Field "${fieldName}" must be one of: ${validValues.join(', ')}`,
          path: fieldPath,
        });
      }
    }

    return {
      Effects(node, path) {
        // Check boolean fields
        checkBoolean(node.destructive, [...path, 'destructive'], 'destructive');
        checkBoolean(node.reversible, [...path, 'reversible'], 'reversible');
        checkBoolean(node.idempotent, [...path, 'idempotent'], 'idempotent');
        checkBoolean(node.network, [...path, 'network'], 'network');
        checkBoolean(node.subprocess, [...path, 'subprocess'], 'subprocess');

        // Check filesystem fields
        if (node.filesystem) {
          checkBoolean(node.filesystem.read, [...path, 'filesystem', 'read'], 'filesystem.read');
          checkBoolean(node.filesystem.write, [...path, 'filesystem', 'write'], 'filesystem.write');
          checkBoolean(node.filesystem.delete, [...path, 'filesystem', 'delete'], 'filesystem.delete');
        }

        // Check cost fields
        if (node.cost) {
          checkBoolean(node.cost.billable, [...path, 'cost', 'billable'], 'cost.billable');
          checkEnum(node.cost.estimate, [...path, 'cost', 'estimate'], 'cost.estimate', ['free', 'low', 'medium', 'high']);
        }

        // Check interactive fields
        if (node.interactive) {
          checkEnum(node.interactive.stdin, [...path, 'interactive', 'stdin'], 'interactive.stdin', ['none', 'optional', 'required', 'password']);
          checkBoolean(node.interactive.prompts, [...path, 'interactive', 'prompts'], 'interactive.prompts');
          checkBoolean(node.interactive.tty, [...path, 'interactive', 'tty'], 'interactive.tty');
        }

        // Check duration fields with format validation
        // Valid formats: "5s", "30s", "1-5s", "1m", "2h", etc.
        const durationPattern = /^(\d+(-\d+)?[smh]|instant)$/;

        function checkDuration(value: any, fieldPath: string[], fieldName: string): void {
          if (value === undefined) return;
          if (typeof value !== 'string') {
            context.report({
              message: `Field "${fieldName}" must be a string`,
              path: fieldPath,
            });
            return;
          }
          if (!durationPattern.test(value)) {
            context.report({
              message: `Field "${fieldName}" has invalid duration format. Expected format like "5s", "30s", "1-5s"`,
              path: fieldPath,
            });
          }
        }

        if (node.duration) {
          checkDuration(node.duration.typical, [...path, 'duration', 'typical'], 'duration.typical');
          checkDuration(node.duration.timeout, [...path, 'duration', 'timeout'], 'duration.timeout');
        }
      },
    };
  },
};
