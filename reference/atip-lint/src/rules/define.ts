import type { RuleDefinition } from './types.js';

/**
 * Define a custom lint rule.
 * Validates the rule definition and returns it for use in plugins or custom configs.
 *
 * @param definition - Rule definition with meta and create function
 * @returns Validated rule definition
 *
 * @example
 * ```typescript
 * const noTodoDescription = defineRule({
 *   meta: {
 *     category: 'quality',
 *     description: 'Descriptions should not contain TODO',
 *     fixable: false,
 *     defaultSeverity: 'warn',
 *   },
 *   create(context) {
 *     return {
 *       AtipMetadata(node) {
 *         if (node.description?.includes('TODO')) {
 *           context.report({
 *             message: 'Description contains TODO',
 *             path: ['description'],
 *           });
 *         }
 *       },
 *       Command(node, path) {
 *         if (node.description?.includes('TODO')) {
 *           context.report({
 *             message: 'Command description contains TODO',
 *             path: [...path, 'description'],
 *           });
 *         }
 *       },
 *     };
 *   },
 * });
 * ```
 */
export function defineRule(definition: RuleDefinition): RuleDefinition {
  // Validate rule definition
  if (!definition.meta) {
    throw new Error('Rule must have meta');
  }

  if (!definition.meta.category) {
    throw new Error('Rule must have category');
  }

  if (!definition.meta.description) {
    throw new Error('Rule must have description');
  }

  if (!definition.meta.defaultSeverity) {
    throw new Error('Rule must have defaultSeverity');
  }

  if (!definition.create) {
    throw new Error('Rule must have create function');
  }

  return definition;
}
