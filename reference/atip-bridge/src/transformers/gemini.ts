import type { AtipTool } from '../types/atip';
import type { GeminiFunctionDeclaration } from '../types/providers';
import { validateAtipTool } from '../internal/validate';
import { flattenCommands } from '../internal/flatten';
import { buildSafetySuffix } from '../internal/safety';
import { transformToGeminiParams } from '../internal/params';

/**
 * Transform ATIP tool metadata to Gemini function declaration format.
 */
export function toGemini(tool: AtipTool): GeminiFunctionDeclaration[] {
  validateAtipTool(tool);

  const flattened = flattenCommands(tool);

  return flattened.map((fc) => {
    const { properties, required } = transformToGeminiParams(
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
      parameters: {
        type: 'object',
        properties,
        required,
      },
    };
  });
}
