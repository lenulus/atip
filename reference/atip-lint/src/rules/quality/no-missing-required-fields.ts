import type { RuleDefinition } from '../types.js';

export const noMissingRequiredFields: RuleDefinition = {
  meta: {
    category: 'quality',
    description: 'Required fields should be present based on context',
    fixable: false,
    defaultSeverity: 'error',
  },

  create(context) {
    return {
      Command(node, path) {
        if (!node.description) {
          context.report({
            message: 'Command is missing required field: description',
            path: [...path, 'description'],
          });
        }
      },

      Argument(node, path) {
        if (!node.name) {
          context.report({
            message: 'Argument is missing required field: name',
            path: [...path, 'name'],
          });
        }

        if (!node.type) {
          context.report({
            message: 'Argument is missing required field: type',
            path: [...path, 'type'],
          });
        }

        if (!node.description) {
          context.report({
            message: 'Argument is missing required field: description',
            path: [...path, 'description'],
          });
        }

        // Check enum type has enum array
        if (node.type === 'enum' && !node.enum) {
          context.report({
            message: 'Enum type is missing required field: enum',
            path: [...path, 'enum'],
          });
        }
      },

      Option(node, path) {
        if (!node.name) {
          context.report({
            message: 'Option is missing required field: name',
            path: [...path, 'name'],
          });
        }

        if (!node.flags) {
          context.report({
            message: 'Option is missing required field: flags',
            path: [...path, 'flags'],
          });
        }

        if (!node.type) {
          context.report({
            message: 'Option is missing required field: type',
            path: [...path, 'type'],
          });
        }

        if (!node.description) {
          context.report({
            message: 'Option is missing required field: description',
            path: [...path, 'description'],
          });
        }

        // Check enum type has enum array
        if (node.type === 'enum' && !node.enum) {
          context.report({
            message: 'Enum type is missing required field: enum',
            path: [...path, 'enum'],
          });
        }
      },
    };
  },
};
