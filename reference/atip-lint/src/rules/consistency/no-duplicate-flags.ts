import type { RuleDefinition } from '../types.js';

export const noDuplicateFlags: RuleDefinition = {
  meta: {
    category: 'consistency',
    description: 'Options should not have duplicate flags',
    fixable: false,
    defaultSeverity: 'error',
  },

  create(context) {
    // Track global flags across the entire metadata
    const globalFlags = new Set<string>();

    return {
      // First, collect global option flags
      AtipMetadata(node) {
        if (!node.globalOptions || !Array.isArray(node.globalOptions)) {
          return;
        }

        const seenFlags = new Map<string, number>();

        for (let i = 0; i < node.globalOptions.length; i++) {
          const option = node.globalOptions[i];
          if (!option.flags || !Array.isArray(option.flags)) {
            continue;
          }

          // Check for duplicates within the option
          const optionFlags = new Set<string>();
          for (const flag of option.flags) {
            if (optionFlags.has(flag)) {
              context.report({
                message: `duplicate flag "${flag}" within global option`,
                path: ['globalOptions', String(i), 'flags'],
              });
            }
            optionFlags.add(flag);
            globalFlags.add(flag);
          }

          // Check for duplicates across global options
          for (const flag of option.flags) {
            if (seenFlags.has(flag)) {
              const firstIndex = seenFlags.get(flag)!;
              context.report({
                message: `duplicate flag "${flag}" already used by global option at index ${firstIndex}`,
                path: ['globalOptions', String(i), 'flags'],
              });
            } else {
              seenFlags.set(flag, i);
            }
          }
        }
      },

      Command(node, path) {
        if (!node.options || !Array.isArray(node.options)) {
          return;
        }

        const seenFlags = new Map<string, number>();

        for (let i = 0; i < node.options.length; i++) {
          const option = node.options[i];
          if (!option.flags || !Array.isArray(option.flags)) {
            continue;
          }

          // Check for duplicates within the option first
          const optionFlags = new Set<string>();
          let hasDuplicateWithin = false;
          for (const flag of option.flags) {
            if (optionFlags.has(flag)) {
              context.report({
                message: `duplicate flag "${flag}" within option`,
                path: [...path, 'options', String(i), 'flags'],
              });
              hasDuplicateWithin = true;
            }
            optionFlags.add(flag);
          }

          // Only check across options if no duplicates within
          if (hasDuplicateWithin) {
            continue;
          }

          // Check for conflicts with global options
          for (const flag of option.flags) {
            if (globalFlags.has(flag)) {
              context.report({
                message: `Flag "${flag}" conflicts with global option`,
                path: [...path, 'options', String(i), 'flags'],
              });
            }
          }

          // Check for duplicates across command options
          for (const flag of option.flags) {
            if (seenFlags.has(flag)) {
              const firstIndex = seenFlags.get(flag)!;
              context.report({
                message: `duplicate flag "${flag}" already used by option at index ${firstIndex}`,
                path: [...path, 'options', String(i), 'flags'],
              });
            } else {
              seenFlags.set(flag, i);
            }
          }
        }
      },
    };
  },
};
