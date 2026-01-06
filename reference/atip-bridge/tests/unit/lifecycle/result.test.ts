import { describe, test, expect } from 'vitest';
import { handleToolResult } from '../../../src/index';

describe('handleToolResult', () => {
  describe('OpenAI format', () => {
    test('should format result for OpenAI', () => {
      const result = handleToolResult('openai', 'call_abc123', {
        prs: [{ number: 42, title: 'Fix bug' }],
      });

      expect(result).toEqual({
        role: 'tool',
        tool_call_id: 'call_abc123',
        content: '{"prs":[{"number":42,"title":"Fix bug"}]}',
      });
    });

    test('should stringify object results', () => {
      const result = handleToolResult('openai', 'call_1', { status: 'ok' });

      expect(result.content).toBe('{"status":"ok"}');
      expect(typeof result.content).toBe('string');
    });

    test('should handle string results', () => {
      const result = handleToolResult('openai', 'call_1', 'success');

      expect(result.content).toBe('"success"');
    });

    test('should handle null results', () => {
      const result = handleToolResult('openai', 'call_1', null);

      expect(result.content).toBe('null');
    });

    test('should set role to tool', () => {
      const result = handleToolResult('openai', 'call_1', {});

      expect(result.role).toBe('tool');
    });

    test('should use provided tool_call_id', () => {
      const result = handleToolResult('openai', 'my_custom_id', {});

      expect(result.tool_call_id).toBe('my_custom_id');
    });
  });

  describe('Gemini format', () => {
    test('should format result for Gemini', () => {
      const result = handleToolResult('gemini', 'gh_pr_list', {
        prs: [{ number: 42, title: 'Fix bug' }],
      });

      expect(result).toEqual({
        role: 'user',
        parts: [
          {
            function_response: {
              name: 'gh_pr_list',
              response: { prs: [{ number: 42, title: 'Fix bug' }] },
            },
          },
        ],
      });
    });

    test('should NOT stringify response for Gemini', () => {
      const resultData = { status: 'ok', count: 5 };
      const result = handleToolResult('gemini', 'test_func', resultData);

      expect(result.parts[0].function_response.response).toEqual(resultData);
      expect(typeof result.parts[0].function_response.response).toBe('object');
    });

    test('should use function name as id', () => {
      const result = handleToolResult('gemini', 'my_function', {});

      expect(result.parts[0].function_response.name).toBe('my_function');
    });

    test('should set role to user', () => {
      const result = handleToolResult('gemini', 'func', {});

      expect(result.role).toBe('user');
    });

    test('should handle primitive results', () => {
      const result = handleToolResult('gemini', 'func', 'text result');

      expect(result.parts[0].function_response.response).toBe('text result');
    });
  });

  describe('Anthropic format', () => {
    test('should format result for Anthropic', () => {
      const result = handleToolResult('anthropic', 'toolu_01XYZ', {
        prs: [{ number: 42, title: 'Fix bug' }],
      });

      expect(result).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_01XYZ',
            content: '{"prs":[{"number":42,"title":"Fix bug"}]}',
          },
        ],
      });
    });

    test('should stringify object results', () => {
      const result = handleToolResult('anthropic', 'toolu_1', { status: 'ok' });

      expect(result.content[0].content).toBe('{"status":"ok"}');
      expect(typeof result.content[0].content).toBe('string');
    });

    test('should use provided tool_use_id', () => {
      const result = handleToolResult('anthropic', 'my_tool_id', {});

      expect(result.content[0].tool_use_id).toBe('my_tool_id');
    });

    test('should set role to user', () => {
      const result = handleToolResult('anthropic', 'toolu_1', {});

      expect(result.role).toBe('user');
    });

    test('should set type to tool_result', () => {
      const result = handleToolResult('anthropic', 'toolu_1', {});

      expect(result.content[0].type).toBe('tool_result');
    });

    test('should handle string results', () => {
      const result = handleToolResult('anthropic', 'toolu_1', 'success');

      expect(result.content[0].content).toBe('"success"');
    });
  });

  describe('result types', () => {
    test('should handle object results', () => {
      const resultData = { items: [1, 2, 3], total: 3 };

      const openai = handleToolResult('openai', 'id1', resultData);
      const gemini = handleToolResult('gemini', 'id2', resultData);
      const anthropic = handleToolResult('anthropic', 'id3', resultData);

      expect(openai.content).toBe(JSON.stringify(resultData));
      expect(gemini.parts[0].function_response.response).toEqual(resultData);
      expect(anthropic.content[0].content).toBe(JSON.stringify(resultData));
    });

    test('should handle array results', () => {
      const resultData = [1, 2, 3];

      const openai = handleToolResult('openai', 'id1', resultData);
      const anthropic = handleToolResult('anthropic', 'id2', resultData);

      expect(openai.content).toBe('[1,2,3]');
      expect(anthropic.content[0].content).toBe('[1,2,3]');
    });

    test('should handle number results', () => {
      const openai = handleToolResult('openai', 'id', 42);

      expect(openai.content).toBe('42');
    });

    test('should handle boolean results', () => {
      const openai = handleToolResult('openai', 'id', true);

      expect(openai.content).toBe('true');
    });

    test('should handle undefined results', () => {
      const openai = handleToolResult('openai', 'id', undefined);

      expect(openai.content).toContain('undefined');
    });
  });

  describe('edge cases', () => {
    test('should handle empty object', () => {
      const openai = handleToolResult('openai', 'id', {});

      expect(openai.content).toBe('{}');
    });

    test('should handle empty array', () => {
      const openai = handleToolResult('openai', 'id', []);

      expect(openai.content).toBe('[]');
    });

    test('should handle nested complex structures', () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', tags: ['admin', 'dev'] },
          { id: 2, name: 'Bob', tags: ['user'] },
        ],
        meta: {
          total: 2,
          page: 1,
        },
      };

      const openai = handleToolResult('openai', 'id', complexData);
      const gemini = handleToolResult('gemini', 'id', complexData);

      expect(JSON.parse(openai.content)).toEqual(complexData);
      expect(gemini.parts[0].function_response.response).toEqual(complexData);
    });
  });
});
