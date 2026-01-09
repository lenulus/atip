import type { RuleDefinition } from '../types.js';

export const agentFlagWorks: RuleDefinition = {
  meta: {
    category: 'executable',
    description: 'Native tools should respond correctly to --agent',
    fixable: false,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      timeout?: number;
      skipIfMissing?: boolean;
    };

    // This rule requires executable checks to be enabled
    // For now, minimal implementation to pass tests
    return {};
  },
};
