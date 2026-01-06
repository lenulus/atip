import { describe, test, expect } from 'vitest';
import { parseToolCall } from '../../../src/index';

describe('parseToolCall', () => {
  describe('OpenAI format', () => {
    test('should parse OpenAI tool calls', () => {
      const response = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'gh_pr_list',
                    arguments: '{"state": "open"}',
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('openai', response);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'call_abc123',
        name: 'gh_pr_list',
        arguments: { state: 'open' },
      });
    });

    test('should parse multiple tool calls', () => {
      const response = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'gh_pr_list',
                    arguments: '{}',
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'gh_pr_create',
                    arguments: '{"title": "Fix bug"}',
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('openai', response);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('call_1');
      expect(result[1].id).toBe('call_2');
    });

    test('should return empty array when no tool calls', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Just a text response',
            },
          },
        ],
      };

      const result = parseToolCall('openai', response);

      expect(result).toEqual([]);
    });

    test('should parse JSON arguments correctly', () => {
      const response = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'test',
                    arguments: '{"key": "value", "number": 42, "nested": {"a": 1}}',
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('openai', response);

      expect(result[0].arguments).toEqual({
        key: 'value',
        number: 42,
        nested: { a: 1 },
      });
    });

    test('should throw AtipParseError for invalid structure', () => {
      const response = { invalid: 'structure' };

      expect(() => parseToolCall('openai', response)).toThrow('AtipParseError');
    });

    test('should throw AtipParseError for missing choices', () => {
      const response = { notChoices: [] };

      expect(() => parseToolCall('openai', response)).toThrow();
    });
  });

  describe('Gemini format', () => {
    test('should parse Gemini function calls', () => {
      const response = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'gh_pr_list',
                    args: { state: 'open' },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('gemini', response);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'gh_pr_list', // Gemini uses function name as ID
        name: 'gh_pr_list',
        arguments: { state: 'open' },
      });
    });

    test('should handle arguments as object (not JSON string)', () => {
      const response = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'test',
                    args: { key: 'value', number: 42 },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('gemini', response);

      expect(result[0].arguments).toEqual({ key: 'value', number: 42 });
    });

    test('should return empty array when no function calls', () => {
      const response = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Just text response',
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('gemini', response);

      expect(result).toEqual([]);
    });

    test('should parse multiple function calls', () => {
      const response = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'func1',
                    args: {},
                  },
                },
                {
                  functionCall: {
                    name: 'func2',
                    args: { arg: 'value' },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseToolCall('gemini', response);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('func1');
      expect(result[1].name).toBe('func2');
    });

    test('should throw AtipParseError for invalid structure', () => {
      const response = { invalid: 'structure' };

      expect(() => parseToolCall('gemini', response)).toThrow();
    });
  });

  describe('Anthropic format', () => {
    test('should parse Anthropic tool use blocks', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Let me check that for you.',
          },
          {
            type: 'tool_use',
            id: 'toolu_01XYZ',
            name: 'gh_pr_list',
            input: { state: 'open' },
          },
        ],
      };

      const result = parseToolCall('anthropic', response);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'toolu_01XYZ',
        name: 'gh_pr_list',
        arguments: { state: 'open' },
      });
    });

    test('should filter out text blocks and only parse tool_use', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'First some text',
          },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'tool1',
            input: {},
          },
          {
            type: 'text',
            text: 'More text',
          },
          {
            type: 'tool_use',
            id: 'toolu_2',
            name: 'tool2',
            input: { arg: 'value' },
          },
        ],
      };

      const result = parseToolCall('anthropic', response);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('tool1');
      expect(result[1].name).toBe('tool2');
    });

    test('should handle input as object (not JSON string)', () => {
      const response = {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01',
            name: 'test',
            input: {
              key: 'value',
              nested: { a: 1, b: 2 },
            },
          },
        ],
      };

      const result = parseToolCall('anthropic', response);

      expect(result[0].arguments).toEqual({
        key: 'value',
        nested: { a: 1, b: 2 },
      });
    });

    test('should return empty array when no tool_use blocks', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Just a text response',
          },
        ],
      };

      const result = parseToolCall('anthropic', response);

      expect(result).toEqual([]);
    });

    test('should throw AtipParseError for invalid structure', () => {
      const response = { invalid: 'structure' };

      expect(() => parseToolCall('anthropic', response)).toThrow();
    });

    test('should throw AtipParseError for missing content array', () => {
      const response = { notContent: [] };

      expect(() => parseToolCall('anthropic', response)).toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle empty tool_calls array', () => {
      const response = {
        choices: [
          {
            message: {
              tool_calls: [],
            },
          },
        ],
      };

      const result = parseToolCall('openai', response);

      expect(result).toEqual([]);
    });

    test('should handle response with no relevant fields', () => {
      const openaiResponse = {
        choices: [{ message: {} }],
      };

      const result = parseToolCall('openai', openaiResponse);

      expect(result).toEqual([]);
    });
  });

  describe('error context', () => {
    test('should include provider in error', () => {
      const response = { invalid: 'structure' };

      try {
        parseToolCall('openai', response);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.provider).toBe('openai');
      }
    });

    test('should include response in error', () => {
      const response = { invalid: 'structure' };

      try {
        parseToolCall('anthropic', response);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.response).toEqual(response);
      }
    });
  });
});
