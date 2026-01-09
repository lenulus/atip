import type { RuleDefinition } from '../types.js';

export const descriptionQuality: RuleDefinition = {
  meta: {
    category: 'quality',
    description: 'Descriptions should be meaningful and properly formatted',
    fixable: true,
    defaultSeverity: 'warn',
  },

  create(context) {
    const options = context.options as {
      minLength?: number;
      maxLength?: number;
      placeholderPatterns?: string[];
      requireSentenceCase?: boolean;
      requireEndingPunctuation?: boolean;
    };

    const minLength = options.minLength ?? 10;
    const maxLength = options.maxLength ?? 200;
    const placeholderPatterns = options.placeholderPatterns ?? ['TODO', 'FIXME', 'Description', 'TBD'];
    const requireSentenceCase = options.requireSentenceCase ?? true;
    const requireEndingPunctuation = options.requireEndingPunctuation ?? false;

    function checkDescription(description: string | undefined, path: string[]): void {
      if (!description) {
        return;
      }

      // Check whitespace
      if (description !== description.trim()) {
        context.report({
          message: 'Description has leading or trailing whitespace',
          path,
          fix: (fixer) => fixer.replaceAt(path, description.trim()),
        });
        return; // Don't check other issues if whitespace present
      }

      // Check min length
      if (description.length < minLength) {
        context.report({
          message: `Description is too short (minimum ${minLength} characters)`,
          path,
        });
      }

      // Check max length
      if (description.length > maxLength) {
        context.report({
          message: `Description is too long (maximum ${maxLength} characters)`,
          path,
        });
      }

      // Check placeholder patterns
      for (const pattern of placeholderPatterns) {
        if (description.includes(pattern)) {
          context.report({
            message: `Description contains placeholder text: "${pattern}"`,
            path,
          });
        }
      }

      // Check sentence case
      if (requireSentenceCase && description.length > 0) {
        const firstChar = description[0];
        if (firstChar !== firstChar.toUpperCase()) {
          context.report({
            message: 'Description should start with an uppercase letter',
            path,
          });
        }
      }

      // Check ending punctuation
      if (requireEndingPunctuation) {
        const lastChar = description[description.length - 1];
        if (lastChar !== '.' && lastChar !== '?' && lastChar !== '!') {
          context.report({
            message: 'Description should end with punctuation',
            path,
          });
        }
      }
    }

    return {
      AtipMetadata(node) {
        checkDescription(node.description, ['description']);
      },

      Command(node, path) {
        checkDescription(node.description, [...path, 'description']);
      },

      Argument(node, path) {
        checkDescription(node.description, [...path, 'description']);
      },

      Option(node, path) {
        checkDescription(node.description, [...path, 'description']);
      },
    };
  },
};
