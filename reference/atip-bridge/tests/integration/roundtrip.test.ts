import { describe, test, expect } from 'vitest';
import {
  toOpenAI,
  toGemini,
  toAnthropic,
  parseToolCall,
  handleToolResult,
} from '../../src/index';
import type { AtipTool } from '../../src/index';

describe('Round-trip Integration Tests', () => {
  const testTool: AtipTool = {
    atip: { version: '0.6' },
    name: 'calc',
    version: '1.0.0',
    description: 'Calculator',
    commands: {
      add: {
        description: 'Add two numbers',
        arguments: [
          {
            name: 'a',
            type: 'number',
            description: 'First number',
            required: true,
          },
          {
            name: 'b',
            type: 'number',
            description: 'Second number',
            required: true,
          },
        ],
        effects: {
          idempotent: true,
          network: false,
        },
      },
    },
  };

  describe('OpenAI round-trip', () => {
    test('should complete full OpenAI workflow', () => {
      // 1. Compile to OpenAI format
      const tools = toOpenAI(testTool);
      expect(tools).toHaveLength(1);
      expect(tools[0].function.name).toBe('calc_add');

      // 2. Simulate LLM response with tool call
      const llmResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'calc_add',
                    arguments: '{"a": 5, "b": 3}',
                  },
                },
              ],
            },
          },
        ],
      };

      // 3. Parse tool call
      const toolCalls = parseToolCall('openai', llmResponse);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe('calc_add');
      expect(toolCalls[0].arguments).toEqual({ a: 5, b: 3 });

      // 4. Execute (mock)
      const executionResult = { result: 8 };

      // 5. Format result
      const resultMessage = handleToolResult(
        'openai',
        toolCalls[0].id,
        executionResult
      );

      expect(resultMessage).toEqual({
        role: 'tool',
        tool_call_id: 'call_123',
        content: '{"result":8}',
      });
    });

    test('should handle multiple tool calls in one response', () => {
      const tools = toOpenAI(testTool);

      const llmResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'calc_add',
                    arguments: '{"a": 1, "b": 2}',
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'calc_add',
                    arguments: '{"a": 10, "b": 20}',
                  },
                },
              ],
            },
          },
        ],
      };

      const toolCalls = parseToolCall('openai', llmResponse);
      expect(toolCalls).toHaveLength(2);

      const results = toolCalls.map((call) => {
        const sum = call.arguments.a + call.arguments.b;
        return handleToolResult('openai', call.id, { result: sum });
      });

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('{"result":3}');
      expect(results[1].content).toBe('{"result":30}');
    });
  });

  describe('Gemini round-trip', () => {
    test('should complete full Gemini workflow', () => {
      // 1. Compile
      const tools = toGemini(testTool);
      expect(tools[0].name).toBe('calc_add');

      // 2. Simulate Gemini response
      const llmResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'calc_add',
                    args: { a: 7, b: 3 },
                  },
                },
              ],
            },
          },
        ],
      };

      // 3. Parse
      const toolCalls = parseToolCall('gemini', llmResponse);
      expect(toolCalls[0].arguments).toEqual({ a: 7, b: 3 });

      // 4. Execute
      const result = { result: 10 };

      // 5. Format result
      const resultMessage = handleToolResult('gemini', 'calc_add', result);

      expect(resultMessage.parts[0].function_response).toEqual({
        name: 'calc_add',
        response: { result: 10 },
      });
    });
  });

  describe('Anthropic round-trip', () => {
    test('should complete full Anthropic workflow', () => {
      // 1. Compile
      const tools = toAnthropic(testTool);
      expect(tools[0].name).toBe('calc_add');

      // 2. Simulate Anthropic response
      const llmResponse = {
        content: [
          {
            type: 'text',
            text: 'I will add those numbers for you.',
          },
          {
            type: 'tool_use',
            id: 'toolu_abc',
            name: 'calc_add',
            input: { a: 15, b: 25 },
          },
        ],
      };

      // 3. Parse
      const toolCalls = parseToolCall('anthropic', llmResponse);
      expect(toolCalls[0].arguments).toEqual({ a: 15, b: 25 });

      // 4. Execute
      const result = { result: 40 };

      // 5. Format result
      const resultMessage = handleToolResult('anthropic', 'toolu_abc', result);

      expect(resultMessage.content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_abc',
        content: '{"result":40}',
      });
    });
  });

  describe('error handling in round-trip', () => {
    test('should handle execution errors in OpenAI flow', () => {
      const tools = toOpenAI(testTool);

      const llmResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_err',
                  type: 'function',
                  function: {
                    name: 'calc_add',
                    arguments: '{"a": "not a number", "b": 5}',
                  },
                },
              ],
            },
          },
        ],
      };

      const toolCalls = parseToolCall('openai', llmResponse);

      // Simulate execution error
      const errorResult = {
        error: 'Invalid input: a must be a number',
      };

      const resultMessage = handleToolResult(
        'openai',
        toolCalls[0].id,
        errorResult
      );

      expect(resultMessage.content).toContain('Invalid input');
    });

    test('should handle missing tool calls gracefully', () => {
      const llmResponse = {
        choices: [
          {
            message: {
              content: 'I cannot help with that.',
            },
          },
        ],
      };

      const toolCalls = parseToolCall('openai', llmResponse);

      expect(toolCalls).toEqual([]);
    });
  });

  describe('cross-provider consistency', () => {
    test('should produce equivalent results across providers', () => {
      const openaiTools = toOpenAI(testTool);
      const geminiTools = toGemini(testTool);
      const anthropicTools = toAnthropic(testTool);

      // All should produce one tool
      expect(openaiTools).toHaveLength(1);
      expect(geminiTools).toHaveLength(1);
      expect(anthropicTools).toHaveLength(1);

      // All should have same flattened name
      expect(openaiTools[0].function.name).toBe('calc_add');
      expect(geminiTools[0].name).toBe('calc_add');
      expect(anthropicTools[0].name).toBe('calc_add');

      // All should have same description
      const desc = 'Add two numbers';
      expect(openaiTools[0].function.description).toBe(desc);
      expect(geminiTools[0].description).toBe(desc);
      expect(anthropicTools[0].description).toBe(desc);
    });
  });
});
