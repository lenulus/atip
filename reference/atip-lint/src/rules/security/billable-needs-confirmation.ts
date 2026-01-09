import type { RuleDefinition } from '../types.js';

export const billableNeedsConfirmation: RuleDefinition = {
  meta: {
    category: 'security',
    description: 'Billable operations should be marked non-idempotent',
    fixable: false,
    defaultSeverity: 'warn',
  },

  create(context) {
    return {
      Effects(node, path) {
        if (node.cost?.billable === true && node.idempotent === true) {
          context.report({
            message: 'Billable operation marked as idempotent (may incur costs on retry)',
            path: [...path, 'idempotent'],
          });
        }
      },
    };
  },
};
