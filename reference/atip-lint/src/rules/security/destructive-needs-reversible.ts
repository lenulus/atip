import type { RuleDefinition } from '../types.js';

export const destructiveNeedsReversible: RuleDefinition = {
  meta: {
    category: 'security',
    description: 'Destructive operations should declare reversibility',
    fixable: true,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      checkUnusualCombination?: boolean;
    };

    const checkUnusualCombination = options.checkUnusualCombination ?? false;

    return {
      Effects(node, path) {
        if (node.destructive === true) {
          if (node.reversible === undefined) {
            context.report({
              message: 'Destructive operations should declare reversible field',
              path,
              fix: (fixer) => fixer.insertAt(path, 'reversible', false),
            });
          } else if (node.reversible === true && checkUnusualCombination) {
            context.report({
              message: 'Destructive operation marked as reversible (unusual combination)',
              path,
            });
          }
        }
      },
    };
  },
};
