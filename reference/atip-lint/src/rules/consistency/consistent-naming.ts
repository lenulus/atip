import type { RuleDefinition } from '../types.js';

export const consistentNaming: RuleDefinition = {
  meta: {
    category: 'consistency',
    description: 'Command and option names should follow consistent conventions',
    fixable: false,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      commandCase?: 'kebab-case' | 'camelCase' | 'snake_case';
      optionCase?: 'kebab-case' | 'camelCase' | 'snake_case';
      allowUppercase?: boolean;
      allowNumbers?: boolean;
    };

    const commandCase = options.commandCase ?? 'kebab-case';
    const optionCase = options.optionCase ?? 'kebab-case';
    const allowUppercase = options.allowUppercase ?? false;
    const allowNumbers = options.allowNumbers ?? true;

    function checkCase(name: string, expectedCase: string): boolean {
      switch (expectedCase) {
        case 'kebab-case':
          // Single words or hyphenated words, all lowercase with optional numbers
          return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
        case 'camelCase':
          return /^[a-z][a-zA-Z0-9]*$/.test(name);
        case 'snake_case':
          // Single words or underscored words, all lowercase with optional numbers
          return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
        default:
          return true;
      }
    }

    function checkName(name: string, expectedCase: string, path: string[], type: string): void {
      const typeLower = type.toLowerCase();

      if (!allowNumbers && /\d/.test(name)) {
        context.report({
          message: `${typeLower} naming should not contain numbers`,
          path,
        });
        return;
      }

      if (!allowUppercase && /[A-Z]/.test(name) && expectedCase !== 'camelCase') {
        context.report({
          message: `${typeLower} naming should follow ${expectedCase} convention (contains uppercase)`,
          path,
        });
        return;
      }

      if (!checkCase(name, expectedCase)) {
        context.report({
          message: `${typeLower} naming should follow ${expectedCase} convention`,
          path,
        });
      }
    }

    return {
      Command(node, path) {
        const commandName = path[path.length - 1];
        if (typeof commandName === 'string') {
          checkName(commandName, commandCase, path, 'Command');
        }
      },

      Option(node, path) {
        if (node.name) {
          checkName(node.name, optionCase, [...path, 'name'], 'Option');
        }
      },
    };
  },
};
