import type { AtipTool } from './types/atip';
import type { Provider, ProviderTools } from './types/providers';
import { toOpenAI } from './transformers/openai';
import { toGemini } from './transformers/gemini';
import { toAnthropic } from './transformers/anthropic';

/**
 * Compile multiple ATIP tools to a specific provider format.
 */
export function compileTools(
  tools: AtipTool[],
  provider: Provider,
  options?: { strict?: boolean }
): ProviderTools {
  // Use a map to deduplicate by tool name (later overrides earlier)
  const toolMap = new Map<string, any>();

  for (const tool of tools) {
    let transformed;
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
      const name = 'name' in t ? t.name : t.function.name;
      toolMap.set(name, t);
    }
  }

  return {
    provider,
    tools: Array.from(toolMap.values()),
  };
}
