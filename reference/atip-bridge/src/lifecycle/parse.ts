import type { Provider, ToolCall } from '../types/providers';
import { AtipParseError } from '../errors';

/**
 * Parse tool calls from a provider's response.
 *
 * @param provider - Source provider ('openai', 'gemini', or 'anthropic')
 * @param response - Raw API response object
 * @returns Array of parsed tool calls
 *
 * @remarks
 * - Handles provider-specific response structures
 * - Returns empty array if no tool calls in response
 * - Arguments are parsed from JSON strings where applicable (OpenAI)
 * - Tool call ID is populated from provider-specific field:
 *   - OpenAI: tool_calls[].id
 *   - Gemini: function name (no explicit ID)
 *   - Anthropic: content[].id where type === 'tool_use'
 *
 * @throws {AtipParseError} If response structure is invalid or doesn't match expected provider format
 *
 * @example
 * ```typescript
 * // OpenAI response
 * const calls = parseToolCall('openai', response);
 * // Extracts from response.choices[0].message.tool_calls
 *
 * // Anthropic response
 * const calls = parseToolCall('anthropic', response);
 * // Extracts from response.content blocks where type === 'tool_use'
 * ```
 */
export function parseToolCall(provider: Provider, response: unknown): ToolCall[] {
  if (!response || typeof response !== 'object') {
    throw new AtipParseError('AtipParseError: Response must be an object', provider, response);
  }

  switch (provider) {
    case 'openai':
      return parseOpenAI(response, provider);
    case 'gemini':
      return parseGemini(response, provider);
    case 'anthropic':
      return parseAnthropic(response, provider);
  }
}

function parseOpenAI(response: any, provider: Provider): ToolCall[] {
  if (!response.choices || !Array.isArray(response.choices)) {
    throw new AtipParseError(
      'AtipParseError: Expected choices array in OpenAI response',
      provider,
      response
    );
  }

  const message = response.choices[0]?.message;
  if (!message?.tool_calls || !Array.isArray(message.tool_calls)) {
    return [];
  }

  return message.tool_calls.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments:
      typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
  }));
}

function parseGemini(response: any, provider: Provider): ToolCall[] {
  if (!response.candidates || !Array.isArray(response.candidates)) {
    throw new AtipParseError(
      'AtipParseError: Expected candidates array in Gemini response',
      provider,
      response
    );
  }

  const content = response.candidates[0]?.content;
  if (!content?.parts || !Array.isArray(content.parts)) {
    return [];
  }

  const calls: ToolCall[] = [];
  for (const part of content.parts) {
    // Gemini uses camelCase: functionCall
    if (part.functionCall) {
      calls.push({
        id: part.functionCall.name, // Gemini uses function name as ID
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return calls;
}

function parseAnthropic(response: any, provider: Provider): ToolCall[] {
  if (!response.content || !Array.isArray(response.content)) {
    throw new AtipParseError(
      'AtipParseError: Expected content array in Anthropic response',
      provider,
      response
    );
  }

  const calls: ToolCall[] = [];
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      calls.push({
        id: block.id,
        name: block.name,
        arguments: block.input || {},
      });
    }
  }

  return calls;
}
