import type { RuleDefinition } from '../types.js';

export const noEmptyEffects: RuleDefinition = {
  meta: {
    category: 'quality',
    description: 'Commands should declare effects metadata',
    fixable: true,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      minFields?: number;
      requiredFields?: string[];
    };

    const minFields = options.minFields ?? 1;
    const requiredFields = options.requiredFields ?? [];

    return {
      Command(node, path) {
        // Skip parent commands that have nested commands (they don't need their own effects)
        if (node.commands && Object.keys(node.commands).length > 0) {
          return;
        }

        if (!node.effects) {
          context.report({
            message: 'Command should declare effects metadata',
            path,
            fix: (fixer) => fixer.insertAt(path, 'effects', {}),
          });
          return;
        }

        const effectFields = Object.keys(node.effects);

        if (effectFields.length < minFields) {
          context.report({
            message: `Command effects should have at least ${minFields} field(s), but has ${effectFields.length}`,
            path: [...path, 'effects'],
            fix: (fixer) => fixer.setAt([...path, 'effects'], { network: false, idempotent: true }),
          });
        }

        if (requiredFields.length > 0) {
          for (const field of requiredFields) {
            if (!(field in node.effects)) {
              context.report({
                message: `Command effects should include required field: ${field}`,
                path: [...path, 'effects'],
              });
            }
          }
        }
      },
    };
  },
};
