import type { Provider, Message } from '../types/providers';

/**
 * Format a tool execution result for sending back to the LLM.
 */
export function handleToolResult(provider: Provider, id: string, result: unknown): Message {
  // Helper to stringify result for providers that need strings
  // Note: strings get JSON.stringify to add quotes, per API requirements
  const stringify = (r: unknown): string => {
    if (r === undefined) return 'undefined';
    return typeof r === 'string' ? JSON.stringify(r) : JSON.stringify(r);
  };

  switch (provider) {
    case 'openai':
      return {
        role: 'tool',
        tool_call_id: id,
        content: stringify(result),
      };

    case 'gemini':
      return {
        role: 'user',
        parts: [
          {
            function_response: {
              name: id, // For Gemini, id is the function name
              response: result, // Not stringified for Gemini
            },
          },
        ],
      };

    case 'anthropic':
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: id,
            content: stringify(result),
          },
        ],
      };
  }
}
