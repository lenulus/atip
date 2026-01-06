import type { AtipTool } from '../types/atip';
import type { AnthropicTool } from '../types/providers';
import { validateAtipTool } from '../internal/validate';
import { flattenCommands } from '../internal/flatten';
import { buildSafetySuffix } from '../internal/safety';
import { transformToAnthropicParams } from '../internal/params';

/**
 * Transform ATIP tool metadata to Anthropic tool definition format.
 *
 * @param tool - ATIP tool metadata to transform
 * @returns Array of Anthropic tool definitions (one per flattened command)
 *
 * @remarks
 * - Flattens nested subcommands (gh pr create -> gh_pr_create)
 * - Embeds safety metadata in descriptions per spec section 8.2
 * - Uses input_schema instead of parameters
 * - Only required parameters added to required array
 *
 * @throws {AtipValidationError} If tool metadata is invalid (missing required fields)
 *
 * @example
 * ```typescript
 * const tools = toAnthropic(ghTool);
 * // Returns AnthropicTool[] with flattened commands
 * ```
 */
export function toAnthropic(tool: AtipTool): AnthropicTool[] {
  validateAtipTool(tool);

  const flattened = flattenCommands(tool);

  return flattened.map((fc) => {
    const { properties, required } = transformToAnthropicParams(
      fc.command.arguments,
      fc.command.options
    );

    // Build description with safety suffix
    const safetySuffix = buildSafetySuffix(fc.command.effects);
    let description = fc.command.description;

    if (safetySuffix) {
      description = `${description} ${safetySuffix}`;
    }

    return {
      name: fc.name,
      description,
      input_schema: {
        type: 'object',
        properties,
        required,
      },
    };
  });
}
