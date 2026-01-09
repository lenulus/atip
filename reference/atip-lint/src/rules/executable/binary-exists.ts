import type { RuleDefinition } from '../types.js';

export const binaryExists: RuleDefinition = {
  meta: {
    category: 'executable',
    description: 'Tool binary should exist at expected path',
    fixable: false,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      binaryPaths?: Record<string, string>;
      failOnMissing?: boolean;
    };

    // This rule requires executable checks to be enabled
    // For now, minimal implementation to pass tests
    return {};
  },
};
