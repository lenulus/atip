import type { AtipTool } from './types/atip';
import type { Provider, ProviderTool, ProviderTools } from './types/providers';
import { toOpenAI } from './transformers/openai';
import { toGemini } from './transformers/gemini';
import { toAnthropic } from './transformers/anthropic';

/**
 * Extract the tool name from a provider tool.
 * Handles different provider tool formats.
 */
function getToolName(tool: ProviderTool): string {
  // OpenAI tools have tool.function.name
  if ('function' in tool) {
    return tool.function.name;
  }
  // Gemini and Anthropic tools have tool.name
  return tool.name;
}

/**
 * Compile multiple ATIP tools to a specific provider format.
 *
 * @param tools - Array of ATIP tool metadata to compile
 * @param provider - Target provider format ('openai', 'gemini', or 'anthropic')
 * @param options - Provider-specific options
 * @param options.strict - Enable OpenAI strict mode (only applies to 'openai' provider)
 * @returns Compiled tools for the specified provider
 *
 * @remarks
 * - Aggregates results from individual transformer calls
 * - Deduplicates tool names (later tools override earlier ones)
 * - Validates all tools before transformation
 * - Provider-specific options only apply to relevant providers
 *
 * @throws {AtipValidationError} If any tool metadata is invalid
 *
 * @example
 * ```typescript
 * const result = compileTools([ghTool, kubectlTool], 'openai', { strict: true });
 * // Returns { provider: 'openai', tools: OpenAITool[] }
 * ```
 */
export function compileTools(
  tools: AtipTool[],
  provider: Provider,
  options?: { strict?: boolean }
): ProviderTools {
  // Use a map to deduplicate by tool name (later overrides earlier)
  const toolMap = new Map<string, ProviderTool>();

  for (const tool of tools) {
    let transformed: ProviderTool[];
    switch (provider) {
      case 'openai':
        transformed = toOpenAI(tool, options);
        break;
      case 'gemini':
        transformed = toGemini(tool);
        break;
      case 'anthropic':
        transformed = toAnthropic(tool);
        break;
    }

    // Add to map, deduplicating by name
    for (const t of transformed) {
      const name = getToolName(t);
      toolMap.set(name, t);
    }
  }

  return {
    provider,
    tools: Array.from(toolMap.values()),
  };
}
