import type { AtipTool } from '../types/atip';
import type { OpenAITool } from '../types/providers';
import { validateAtipTool } from '../internal/validate';
import { flattenCommands } from '../internal/flatten';
import { buildSafetySuffix } from '../internal/safety';
import { transformToOpenAIParams } from '../internal/params';
import { OPENAI_DESCRIPTION_MAX_LENGTH } from '../constants';

/**
 * Transform ATIP tool metadata to OpenAI function calling format.
 */
export function toOpenAI(tool: AtipTool, options?: { strict?: boolean }): OpenAITool[] {
  validateAtipTool(tool);

  const strict = options?.strict || false;
  const flattened = flattenCommands(tool);

  return flattened.map((fc) => {
    const { properties, required } = transformToOpenAIParams(
      fc.command.arguments,
      fc.command.options,
      strict
    );

    // Build description with safety suffix
    const safetySuffix = buildSafetySuffix(fc.command.effects);
    let description = fc.command.description;

    // Add safety suffix
    if (safetySuffix) {
      description = `${description} ${safetySuffix}`;
    }

    // Truncate if exceeds OpenAI limit
    if (description.length > OPENAI_DESCRIPTION_MAX_LENGTH) {
      // Preserve safety suffix by truncating the base description
      const suffixLength = safetySuffix.length;
      const maxBaseLength = OPENAI_DESCRIPTION_MAX_LENGTH - suffixLength - 4; // -4 for " ..."
      const baseDesc = fc.command.description.slice(0, maxBaseLength) + '...';
      description = safetySuffix ? `${baseDesc} ${safetySuffix}` : baseDesc;
    }

    const result: OpenAITool = {
      type: 'function',
      function: {
        name: fc.name,
        description,
        parameters: {
          type: 'object',
          properties,
          required,
          additionalProperties: false,
        },
      },
    };

    if (strict) {
      result.function.strict = true;
    }

    return result;
  });
}
