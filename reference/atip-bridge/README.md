# atip-bridge

TypeScript library to compile [ATIP (Agent Tool Introspection Protocol)](../../spec/rfc.md) metadata into provider-specific function calling formats for OpenAI, Gemini, and Anthropic.

## Features

- **Multi-provider support**: OpenAI, Gemini, and Anthropic
- **Zero dependencies**: Pure TypeScript implementation
- **Type-safe**: Full TypeScript types for all providers
- **Tree-shakeable**: Import only what you need
- **Safety-first**: Embeds ATIP effects metadata in tool descriptions
- **Well-tested**: 201 tests with comprehensive coverage

## Installation

```bash
npm install atip-bridge
```

## Quick Start

```typescript
import { toOpenAI, compileTools } from 'atip-bridge';
import type { AtipTool } from 'atip-bridge';

// Load your ATIP metadata
const ghTool: AtipTool = {
  atip: { version: '0.6' },
  name: 'gh',
  version: '2.40.0',
  description: 'GitHub CLI tool',
  commands: {
    pr: {
      description: 'Manage pull requests',
      commands: {
        create: {
          description: 'Create a pull request',
          options: [
            {
              name: 'title',
              flags: ['-t', '--title'],
              type: 'string',
              description: 'Pull request title',
              required: true
            }
          ],
          effects: {
            network: true,
            idempotent: false
          }
        }
      }
    }
  }
};

// Transform for a specific provider
const openaiTools = toOpenAI(ghTool, { strict: true });
console.log(openaiTools);
// [{ type: 'function', function: { name: 'gh_pr_create', ... } }]

// Or compile multiple tools at once
const result = compileTools([ghTool], 'openai', { strict: true });
console.log(result);
// { provider: 'openai', tools: [...] }
```

## API Documentation

### Core Transformers

#### `toOpenAI(tool, options?)`

Transform ATIP tool to OpenAI function calling format.

```typescript
import { toOpenAI } from 'atip-bridge';

const tools = toOpenAI(ghTool, { strict: true });
// Returns OpenAITool[]
```

**Options:**
- `strict?: boolean` - Enable OpenAI strict mode (makes optional params nullable)

**Returns:** Array of OpenAI tool definitions (one per flattened command)

#### `toGemini(tool)`

Transform ATIP tool to Gemini function declaration format.

```typescript
import { toGemini } from 'atip-bridge';

const tools = toGemini(ghTool);
// Returns GeminiFunctionDeclaration[]
```

#### `toAnthropic(tool)`

Transform ATIP tool to Anthropic tool definition format.

```typescript
import { toAnthropic } from 'atip-bridge';

const tools = toAnthropic(ghTool);
// Returns AnthropicTool[]
```

### Batch Operations

#### `compileTools(tools, provider, options?)`

Compile multiple ATIP tools to a specific provider format.

```typescript
import { compileTools } from 'atip-bridge';

const result = compileTools(
  [ghTool, kubectlTool],
  'openai',
  { strict: true }
);
// Returns { provider: 'openai', tools: OpenAITool[] }
```

**Parameters:**
- `tools: AtipTool[]` - Array of ATIP tool metadata
- `provider: 'openai' | 'gemini' | 'anthropic'` - Target provider
- `options?: { strict?: boolean }` - Provider-specific options

### Safety Utilities

#### `generateSafetyPrompt(tools)`

Generate a system prompt section describing tool safety properties.

```typescript
import { generateSafetyPrompt } from 'atip-bridge';

const prompt = generateSafetyPrompt([ghTool]);
console.log(prompt);
// ## Tool Safety Summary
//
// ### Destructive Operations
// The following commands permanently destroy data:
// - gh_repo_delete: Delete a repository
// ...
```

#### `createValidator(tools, policy)`

Create a validator for checking tool calls against a safety policy.

```typescript
import { createValidator } from 'atip-bridge';

const validator = createValidator([ghTool], {
  allowDestructive: false,
  allowBillable: false,
  allowNetwork: true
});

const result = validator.validate('gh_repo_delete', { repo: 'test' });
console.log(result);
// {
//   valid: false,
//   violations: [
//     {
//       code: 'DESTRUCTIVE_OPERATION',
//       message: 'Operation gh_repo_delete is destructive',
//       severity: 'error',
//       toolName: 'gh_repo_delete',
//       commandPath: ['repo', 'delete']
//     }
//   ]
// }
```

**Policy Options:**
- `allowDestructive?: boolean` - Allow destructive operations
- `allowNonReversible?: boolean` - Allow non-reversible operations
- `allowBillable?: boolean` - Allow billable operations
- `allowNetwork?: boolean` - Allow network operations
- `allowFilesystemWrite?: boolean` - Allow filesystem write operations
- `allowFilesystemDelete?: boolean` - Allow filesystem delete operations
- `maxCostEstimate?: 'free' | 'low' | 'medium' | 'high'` - Maximum allowed cost
- `minTrustLevel?: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred'` - Minimum trust level

#### `createResultFilter(tools, options?)`

Create a filter for sanitizing tool results before sending to LLM.

```typescript
import { createResultFilter } from 'atip-bridge';

const filter = createResultFilter([ghTool], {
  maxLength: 10000,
  redactSecrets: true,
  redactPatterns: [/custom-secret-\w+/g]
});

const rawOutput = 'Bearer abc123 and password=secret123';
const safeOutput = filter.filter(rawOutput, 'gh_auth_token');
console.log(safeOutput);
// "Bearer [REDACTED] and password=[REDACTED]"
```

**Options:**
- `maxLength?: number` - Maximum result length (default: 100,000)
- `redactSecrets?: boolean` - Redact common secret patterns (default: true)
- `redactPatterns?: RegExp[]` - Additional patterns to redact

### Lifecycle Helpers

#### `handleToolResult(provider, id, result)`

Format a tool execution result for sending back to the LLM.

```typescript
import { handleToolResult } from 'atip-bridge';

// OpenAI
const msg = handleToolResult('openai', 'call_abc123', { status: 'ok' });
// { role: 'tool', tool_call_id: 'call_abc123', content: '{"status":"ok"}' }

// Gemini
const msg = handleToolResult('gemini', 'list_prs', { prs: [...] });
// { role: 'user', parts: [{ function_response: { name: 'list_prs', response: {...} } }] }

// Anthropic
const msg = handleToolResult('anthropic', 'toolu_123', { data: [...] });
// { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_123', content: '{"data":[...]}' }] }
```

#### `parseToolCall(provider, response)`

Parse tool calls from a provider's response.

```typescript
import { parseToolCall } from 'atip-bridge';

// OpenAI
const calls = parseToolCall('openai', openaiResponse);
// [{ id: 'call_123', name: 'gh_pr_create', arguments: { title: 'Fix bug' } }]

// Gemini
const calls = parseToolCall('gemini', geminiResponse);
// [{ id: 'gh_pr_create', name: 'gh_pr_create', arguments: { title: 'Fix bug' } }]

// Anthropic
const calls = parseToolCall('anthropic', anthropicResponse);
// [{ id: 'toolu_123', name: 'gh_pr_create', arguments: { title: 'Fix bug' } }]
```

## Complete Example: Agent Workflow

Here's a complete example showing how to use atip-bridge in an agent workflow:

```typescript
import {
  compileTools,
  generateSafetyPrompt,
  createValidator,
  createResultFilter,
  parseToolCall,
  handleToolResult
} from 'atip-bridge';
import type { AtipTool } from 'atip-bridge';

// 1. Load ATIP metadata
const ghTool: AtipTool = /* ... */;
const kubectlTool: AtipTool = /* ... */;

// 2. Compile tools for your provider
const { tools } = compileTools([ghTool, kubectlTool], 'openai', { strict: true });

// 3. Generate safety prompt
const safetyPrompt = generateSafetyPrompt([ghTool, kubectlTool]);

// 4. Create safety validator
const validator = createValidator([ghTool, kubectlTool], {
  allowDestructive: false,
  allowBillable: false
});

// 5. Create result filter
const filter = createResultFilter([ghTool, kubectlTool], {
  maxLength: 50000,
  redactSecrets: true
});

// 6. Send to LLM with tools
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: `You are a helpful assistant.\n\n${safetyPrompt}` },
    { role: 'user', content: 'List my pull requests' }
  ],
  tools
});

// 7. Parse tool calls from response
const toolCalls = parseToolCall('openai', response);

// 8. Validate and execute each call
for (const call of toolCalls) {
  // Validate against policy
  const validation = validator.validate(call.name, call.arguments);
  if (!validation.valid) {
    console.error('Validation failed:', validation.violations);
    continue;
  }

  // Execute tool (your implementation)
  const rawResult = await executeTool(call.name, call.arguments);

  // Filter result
  const safeResult = filter.filter(rawResult, call.name);

  // Format for LLM
  const message = handleToolResult('openai', call.id, safeResult);

  // Send back to LLM
  // ... continue conversation
}
```

## Subcommand Flattening

ATIP tools with nested subcommands are flattened into individual tool definitions:

```typescript
// ATIP metadata
{
  name: 'gh',
  commands: {
    pr: {
      commands: {
        create: { /* ... */ },
        list: { /* ... */ }
      }
    },
    repo: {
      commands: {
        clone: { /* ... */ }
      }
    }
  }
}

// Compiles to 3 separate tools:
// - gh_pr_create
// - gh_pr_list
// - gh_repo_clone
```

## Safety Metadata

ATIP effects metadata is embedded in tool descriptions using safety flags:

```typescript
{
  description: 'Delete a repository',
  effects: {
    destructive: true,
    reversible: false,
    network: true
  }
}

// Compiles to:
{
  description: 'Delete a repository [⚠️ DESTRUCTIVE | ⚠️ NOT REVERSIBLE]'
}
```

**Safety Flags:**
- `⚠️ DESTRUCTIVE` - Permanently destroys data
- `⚠️ NOT REVERSIBLE` - Cannot be undone
- `⚠️ NOT IDEMPOTENT` - Different effects on repeated execution
- `💰 BILLABLE` - May incur costs
- `🔒 READ-ONLY` - No side effects

## Error Handling

The library throws two error types:

### `AtipValidationError`

Thrown when ATIP metadata is invalid (missing required fields).

```typescript
import { AtipValidationError } from 'atip-bridge';

try {
  toOpenAI(invalidTool);
} catch (error) {
  if (error instanceof AtipValidationError) {
    console.error('Invalid ATIP metadata:', error.message);
    console.error('Path:', error.path);
    console.error('Value:', error.value);
  }
}
```

### `AtipParseError`

Thrown when parsing provider responses fails.

```typescript
import { AtipParseError } from 'atip-bridge';

try {
  parseToolCall('openai', invalidResponse);
} catch (error) {
  if (error instanceof AtipParseError) {
    console.error('Parse error:', error.message);
    console.error('Provider:', error.provider);
    console.error('Response:', error.response);
  }
}
```

## Constants

The library exports useful constants:

```typescript
import {
  OPENAI_DESCRIPTION_MAX_LENGTH,
  DEFAULT_MAX_RESULT_LENGTH,
  SAFETY_FLAGS,
  DEFAULT_REDACT_PATTERNS
} from 'atip-bridge';

console.log(OPENAI_DESCRIPTION_MAX_LENGTH); // 1024
console.log(DEFAULT_MAX_RESULT_LENGTH); // 100000
console.log(SAFETY_FLAGS.DESTRUCTIVE); // '⚠️ DESTRUCTIVE'
console.log(DEFAULT_REDACT_PATTERNS); // Array of RegExp patterns
```

## TypeScript Types

All ATIP and provider types are exported:

```typescript
import type {
  // Input types
  AtipTool,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
  AtipTrust,
  AtipPattern,

  // Provider types
  Provider,
  OpenAITool,
  GeminiFunctionDeclaration,
  AnthropicTool,
  ProviderTools,

  // Lifecycle types
  ToolCall,
  Message,

  // Safety types
  Policy,
  ValidationResult,
  PolicyViolation,
  Validator,
  ResultFilter
} from 'atip-bridge';
```

## Design Rationale

See the [design documentation](./blue/design.md) for architecture decisions and implementation details.

## Contributing

This is a reference implementation for the ATIP specification. See the [main ATIP repository](../../) for contribution guidelines.

## License

MIT
