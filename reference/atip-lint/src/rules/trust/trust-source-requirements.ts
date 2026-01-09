import type { RuleDefinition } from '../types.js';

export const trustSourceRequirements: RuleDefinition = {
  meta: {
    category: 'trust',
    description: 'Trust source should match metadata completeness',
    fixable: false,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      nativeRequires?: string[];
      vendorRequires?: string[];
    };

    const nativeRequires = options.nativeRequires ?? ['effects', 'description'];
    const vendorRequires = options.vendorRequires ?? ['homepage', 'version'];

    return {
      AtipMetadata(node) {
        if (!node.trust) {
          return;
        }

        const source = node.trust.source;

        if (source === 'native') {
          // Check all commands have effects and descriptions
          if (nativeRequires.includes('effects') && node.commands) {
            checkCommandsHaveEffects(node.commands, ['commands']);
          }
        } else if (source === 'vendor') {
          // Check for homepage and version
          for (const field of vendorRequires) {
            if (!node[field]) {
              context.report({
                message: `Vendor trust requires field: ${field}`,
                path: [field],
              });
            }
          }
        } else if (source === 'inferred') {
          // Check verified is false
          if (node.trust.verified !== false) {
            context.report({
              message: 'Inferred trust should have verified: false',
              path: ['trust', 'verified'],
            });
          }
        }
      },
    };

    function checkCommandsHaveEffects(commands: any, path: string[]): void {
      for (const [name, command] of Object.entries(commands)) {
        if (!(command as any).effects) {
          context.report({
            message: 'Native trust requires all commands to have effects',
            path: [...path, name, 'effects'],
          });
        }

        // Recursively check nested commands
        if ((command as any).commands) {
          checkCommandsHaveEffects((command as any).commands, [...path, name, 'commands']);
        }
      }
    }
  },
};
