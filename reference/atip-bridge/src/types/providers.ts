/**
 * Supported LLM providers.
 */
export type Provider = 'openai' | 'gemini' | 'anthropic';

/**
 * OpenAI function calling format.
 * Per OpenAI API documentation.
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict?: boolean;
    parameters: {
      type: 'object';
      properties: Record<string, OpenAIParameter>;
      required: string[];
      additionalProperties: false;
    };
  };
}

export interface OpenAIParameter {
  type: string | string[]; // string or ["string", "null"] for nullable
  description: string;
  enum?: (string | number)[];
}

/**
 * Gemini function declaration format.
 * Per Google AI documentation.
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, GeminiParameter>;
    required: string[];
  };
}

export interface GeminiParameter {
  type: string;
  description: string;
  enum?: (string | number)[];
}

/**
 * Anthropic tool definition format.
 * Per Anthropic API documentation.
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, AnthropicParameter>;
    required: string[];
  };
}

export interface AnthropicParameter {
  type: string;
  description: string;
  enum?: (string | number)[];
}

/**
 * Union type for compiled provider tools.
 */
export type ProviderTool = OpenAITool | GeminiFunctionDeclaration | AnthropicTool;

/**
 * Result of batch compilation.
 */
export type ProviderTools = {
  provider: Provider;
  tools: ProviderTool[];
};

/**
 * Parsed tool call from provider response.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Provider-specific message format for returning results.
 */
export type Message =
  | OpenAIToolMessage
  | GeminiToolMessage
  | AnthropicToolMessage;

export interface OpenAIToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

export interface GeminiToolMessage {
  role: 'user';
  parts: Array<{
    function_response: {
      name: string;
      response: unknown;
    };
  }>;
}

export interface AnthropicToolMessage {
  role: 'user';
  content: Array<{
    type: 'tool_result';
    tool_use_id: string;
    content: string;
  }>;
}
