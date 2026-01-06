import type { Provider, Message } from '../types/providers';

/**
 * Format a tool execution result for sending back to the LLM.
 *
 * @param provider - Target provider ('openai', 'gemini', or 'anthropic')
 * @param id - Tool call ID from the provider (or function name for Gemini)
 * @param result - Tool execution result (will be stringified for OpenAI/Anthropic)
 * @returns Provider-specific message format
 *
 * @remarks
 * - OpenAI: Returns role="tool" message with tool_call_id
 * - Gemini: Returns role="user" message with function_response part (result not stringified)
 * - Anthropic: Returns role="user" message with tool_result content block
 *
 * @example
 * ```typescript
 * // OpenAI
 * const msg = handleToolResult('openai', 'call_abc123', { status: 'ok' });
 * // { role: 'tool', tool_call_id: 'call_abc123', content: '{"status":"ok"}' }
 *
 * // Gemini
 * const msg = handleToolResult('gemini', 'list_prs', { prs: [...] });
 * // { role: 'user', parts: [{ function_response: { name: 'list_prs', response: {...} } }] }
 * ```
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
