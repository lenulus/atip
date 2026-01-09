# Usage Examples: atip-execute

## Basic Usage

### Example 1: Execute a Simple Tool Call

```typescript
import { createExecutor, parseToolCall } from 'atip-execute';
import ghTool from './atip/gh.json';

// Create an executor with ATIP metadata
const executor = createExecutor({
  tools: [ghTool],
});

// Parse a tool call from OpenAI response
const openaiResponse = {
  choices: [{
    message: {
      tool_calls: [{
        id: 'call_123',
        type: 'function',
        function: {
          name: 'gh_pr_list',
          arguments: '{"state": "open"}',
        },
      }],
    },
  }],
};

const toolCalls = parseToolCall('openai', openaiResponse);
const result = await executor.execute(toolCalls[0]);

console.log(result.content);
```

**Expected Output**:
```
Showing 3 of 3 open pull requests in owner/repo

#42  Fix authentication bug     feature/auth-fix    OPEN
#41  Add dark mode toggle       feature/dark-mode   OPEN
#40  Update dependencies        chore/deps          OPEN

[Exit code: 0]
```

**Explanation**: The executor maps `gh_pr_list` to `["gh", "pr", "list"]`, validates the arguments, executes the command, and formats the result for LLM consumption.

---

### Example 2: Map Flattened Name to CLI Command

```typescript
import { mapToCommand } from 'atip-execute';
import ghTool from './atip/gh.json';

// Map a flattened tool name back to CLI command
const mapping = mapToCommand('gh_pr_create', [ghTool]);

console.log('Tool name:', mapping.tool.name);
console.log('Command path:', mapping.path);
console.log('CLI command:', mapping.command);
console.log('Effects:', mapping.effects);
```

**Expected Output**:
```typescript
Tool name: 'gh'
Command path: ['pr', 'create']
CLI command: ['gh', 'pr', 'create']
Effects: {
  network: true,
  idempotent: false,
  reversible: false,
  destructive: false
}
```

**Explanation**: This is the inverse of atip-bridge's flattening (spec section 8.2 Rule 3). The flattened name `gh_pr_create` becomes the command array `["gh", "pr", "create"]`.

---

### Example 3: Validate Tool Call Arguments

```typescript
import { createExecutor } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({ tools: [ghTool] });

// Valid tool call
const validResult = executor.validate({
  id: 'call_1',
  name: 'gh_pr_create',
  arguments: { title: 'Fix bug', draft: true },
});

console.log('Valid:', validResult.valid);
console.log('Normalized:', validResult.normalizedArgs);

// Invalid tool call - missing required argument
const invalidResult = executor.validate({
  id: 'call_2',
  name: 'gh_issue_create',
  arguments: {}, // Missing required 'title'
});

console.log('Valid:', invalidResult.valid);
console.log('Errors:', invalidResult.errors);
```

**Expected Output**:
```typescript
Valid: true
Normalized: { title: 'Fix bug', draft: true }

Valid: false
Errors: [
  {
    code: 'MISSING_REQUIRED',
    message: 'Required argument "title" is missing',
    parameter: 'title',
    expected: 'string'
  }
]
```

**Explanation**: Validation checks required parameters, types, and enum values against the ATIP schema before execution.

---

## Policy Configuration

### Example 4: Restrictive Policy for Destructive Operations

```typescript
import { createExecutor, RequiresConfirmationError } from 'atip-execute';
import ghTool from './atip/gh.json';

// Create executor with restrictive policy
const executor = createExecutor({
  tools: [ghTool],
  policy: {
    allowDestructive: false,  // Block destructive operations
    allowBillable: false,     // Block billable operations
  },
});

// Try to execute a destructive operation
const toolCall = {
  id: 'call_1',
  name: 'gh_repo_delete',
  arguments: { repo: 'owner/dangerous-repo' },
};

try {
  await executor.execute(toolCall);
} catch (e) {
  if (e instanceof RequiresConfirmationError) {
    console.log('Blocked - requires confirmation');
    console.log('Reasons:', e.context.reasons);
    console.log('Command:', e.context.command);
    console.log('Effects:', e.context.effects);
  }
}
```

**Expected Output**:
```typescript
Blocked - requires confirmation
Reasons: ['destructive', 'non-reversible']
Command: ['gh', 'repo', 'delete', 'owner/dangerous-repo']
Effects: {
  network: true,
  destructive: true,
  reversible: false,
  idempotent: false
}
```

**Explanation**: Per spec section 3.6, destructive operations with `effects.destructive: true` require confirmation. The executor blocks execution and throws an error with context.

---

### Example 5: Confirmation Handler for Dangerous Operations

```typescript
import { createExecutor } from 'atip-execute';
import ghTool from './atip/gh.json';
import { prompt } from 'inquirer';

// Create executor with confirmation handler
const executor = createExecutor({
  tools: [ghTool],
  policy: {
    allowDestructive: false,
    confirmationHandler: async (ctx) => {
      // Show warning to user
      console.log('\n[WARNING] Dangerous operation detected!');
      console.log('Command:', ctx.command.join(' '));
      console.log('Reasons:', ctx.reasons.join(', '));

      if (ctx.effects.destructive) {
        console.log('[!] This operation permanently destroys data');
      }
      if (!ctx.effects.reversible) {
        console.log('[!] This operation cannot be undone');
      }

      // Ask for confirmation
      const { confirmed } = await prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Do you want to proceed?',
        default: false,
      }]);

      return confirmed;
    },
  },
});

// Now destructive operations will prompt for confirmation
const result = await executor.execute({
  id: 'call_1',
  name: 'gh_repo_delete',
  arguments: { repo: 'owner/temp-repo' },
});
```

**Expected Output** (if user confirms):
```
[WARNING] Dangerous operation detected!
Command: gh repo delete owner/temp-repo
Reasons: destructive, non-reversible
[!] This operation permanently destroys data
[!] This operation cannot be undone
? Do you want to proceed? Yes

Deleted repository owner/temp-repo

[Exit code: 0]
```

**Explanation**: The confirmation handler allows custom UI for dangerous operations. If the handler returns `true`, execution proceeds. If `false`, execution is aborted.

---

### Example 6: Trust Level Policy

```typescript
import { createExecutor, InsufficientTrustError } from 'atip-execute';

// Tool with low trust
const inferredTool = {
  atip: { version: '0.4' },
  name: 'untrusted-tool',
  version: '1.0.0',
  description: 'Tool with inferred metadata',
  trust: {
    source: 'inferred',  // VERY LOW trust
    verified: false,
  },
  commands: {
    run: {
      description: 'Run something',
      effects: { network: true },
    },
  },
};

// Create executor requiring high trust
const executor = createExecutor({
  tools: [inferredTool],
  policy: {
    minTrustLevel: 'vendor',  // Require HIGH trust
  },
});

try {
  await executor.execute({
    id: 'call_1',
    name: 'untrusted-tool_run',
    arguments: {},
  });
} catch (e) {
  if (e instanceof InsufficientTrustError) {
    console.log('Blocked due to insufficient trust');
    console.log('Tool trust:', e.actualTrust);
    console.log('Required trust:', e.requiredTrust);
  }
}
```

**Expected Output**:
```typescript
Blocked due to insufficient trust
Tool trust: 'inferred'
Required trust: 'vendor'
```

**Explanation**: Per spec section 3.2.2, trust levels affect what operations are allowed. Tools with `inferred` trust are blocked when `vendor` or higher is required.

---

## Advanced Usage

### Example 7: Batch Execution

```typescript
import { createExecutor, parseToolCall } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({ tools: [ghTool] });

// Multiple tool calls from LLM
const toolCalls = parseToolCall('openai', {
  choices: [{
    message: {
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'gh_pr_list',
            arguments: '{"state": "open"}',
          },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'gh_issue_list',
            arguments: '{"state": "open", "limit": 5}',
          },
        },
        {
          id: 'call_3',
          type: 'function',
          function: {
            name: 'gh_repo_view',
            arguments: '{}',
          },
        },
      ],
    },
  }],
});

// Execute all in sequence
const results = await executor.executeBatch(toolCalls, {
  parallel: false,        // Sequential execution
  continueOnError: true,  // Continue if one fails
});

console.log('Total duration:', results.totalDuration, 'ms');
console.log('Success:', results.successCount);
console.log('Failure:', results.failureCount);

for (const result of results.results) {
  console.log('---');
  console.log('Success:', result.success);
  console.log('Content:', result.content.slice(0, 100) + '...');
}
```

**Expected Output**:
```
Total duration: 2341 ms
Success: 3
Failure: 0
---
Success: true
Content: Showing 2 of 2 open pull requests in owner/repo

#42  Fix authentication bug...
---
Success: true
Content: Showing 5 of 12 open issues in owner/repo

#100  Add dark mode support...
---
Success: true
Content: owner/repo

Description: A sample repository for testing

Languages: TypeScript, JavaScript...
```

**Explanation**: Batch execution runs multiple tool calls efficiently. Sequential execution is safe; parallel execution is faster but may have race conditions.

---

### Example 8: Streaming Output for Long-Running Commands

```typescript
import { createExecutor } from 'atip-execute';
import kubectlTool from './atip/kubectl.json';

const executor = createExecutor({
  tools: [kubectlTool],
  execution: {
    streaming: true,
    timeout: 300000,  // 5 minutes
    onStdout: (data) => {
      process.stdout.write(data);
    },
    onStderr: (data) => {
      process.stderr.write(data);
    },
  },
});

// Long-running command with streaming output
const result = await executor.execute({
  id: 'call_1',
  name: 'kubectl_logs',
  arguments: {
    pod: 'my-pod',
    follow: true,
    'tail-lines': 100,
  },
});
```

**Expected Output** (streams as logs come in):
```
2024-01-15T10:30:01Z Starting application...
2024-01-15T10:30:02Z Connecting to database...
2024-01-15T10:30:03Z Database connected
2024-01-15T10:30:04Z Listening on port 3000
...
```

**Explanation**: Streaming mode sends output incrementally to handlers, useful for long-running commands like log tailing or builds.

---

### Example 9: Custom Output Filtering

```typescript
import { createExecutor } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({
  tools: [ghTool],
  output: {
    maxLength: 50000,
    redactSecrets: true,
    // Add custom redaction patterns
    redactPatterns: [
      /GITHUB_TOKEN=\S+/g,          // GitHub tokens in output
      /Bearer [A-Za-z0-9\-._~+/]+=*/g,  // Bearer tokens
      /password:\s*\S+/gi,          // Password fields
      /api[_-]?key[=:]\s*\S+/gi,    // API keys
    ],
    includeExitCode: true,
  },
});

const result = await executor.execute({
  id: 'call_1',
  name: 'gh_auth_status',
  arguments: { 'show-token': true },
});

console.log(result.content);
```

**Expected Output**:
```
github.com
  Logged in to github.com as username (oauth_token)
  Token: [REDACTED]
  Token scopes: repo, read:org

[Exit code: 0]
```

**Explanation**: Output filtering prevents sensitive data from being returned to the LLM. Both built-in patterns (tokens, API keys) and custom patterns are supported.

---

### Example 10: Building Command Arrays

```typescript
import { buildCommandArray, mapToCommand } from 'atip-execute';
import ghTool from './atip/gh.json';

const mapping = mapToCommand('gh_pr_create', [ghTool]);

// Build with various argument types
const command = buildCommandArray(mapping, {
  // String argument
  title: 'Fix authentication bug',

  // Boolean flag
  draft: true,

  // Variadic option (array)
  reviewer: ['alice', 'bob', 'charlie'],

  // String option
  base: 'main',

  // Omitted boolean (will not appear in command)
  web: false,
});

console.log('Command:', command.join(' '));
```

**Expected Output**:
```
Command: gh pr create --title "Fix authentication bug" --draft --reviewer alice --reviewer bob --reviewer charlie --base main
```

**Explanation**: The command builder translates ATIP arguments to proper CLI syntax:
- String values are quoted if they contain spaces
- Boolean `true` adds the flag, `false` omits it
- Arrays repeat the flag for each value
- Options use long-form flags by preference

---

## Error Handling

### Example 11: Handling Validation Errors

```typescript
import { createExecutor, ArgumentValidationError } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({ tools: [ghTool] });

try {
  await executor.execute({
    id: 'call_1',
    name: 'gh_pr_create',
    arguments: {
      title: 123,  // Should be string
      draft: 'yes',  // Should be boolean
    },
  });
} catch (e) {
  if (e instanceof ArgumentValidationError) {
    console.log('Validation failed for:', e.toolName);
    for (const error of e.errors) {
      console.log(`  ${error.parameter}: ${error.message}`);
      console.log(`    Expected: ${error.expected}, Got: ${typeof error.value}`);
    }
  }
}
```

**Expected Output**:
```
Validation failed for: gh_pr_create
  title: Invalid type for argument "title"
    Expected: string, Got: number
  draft: Invalid type for option "draft"
    Expected: boolean, Got: string
```

**Explanation**: Validation errors are specific and actionable, helping the agent understand what to fix.

---

### Example 12: Handling Unknown Commands

```typescript
import { createExecutor, UnknownCommandError } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({ tools: [ghTool] });

try {
  await executor.execute({
    id: 'call_1',
    name: 'gh_unknown_command',
    arguments: {},
  });
} catch (e) {
  if (e instanceof UnknownCommandError) {
    console.log('Unknown command:', e.toolName);

    // Could suggest similar commands
    const available = executor.getAvailableCommands();
    console.log('Available commands:', available.slice(0, 5).join(', '), '...');
  }
}
```

**Expected Output**:
```
Unknown command: gh_unknown_command
Available commands: gh_auth_login, gh_auth_logout, gh_pr_list, gh_pr_create, gh_issue_list ...
```

**Explanation**: Unknown commands are caught before execution. The error includes context for debugging or suggesting alternatives.

---

### Example 13: Handling Execution Errors

```typescript
import { createExecutor, ExecutionError, TimeoutError } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({
  tools: [ghTool],
  execution: {
    timeout: 5000,  // 5 second timeout
  },
});

try {
  // This might fail if not authenticated
  await executor.execute({
    id: 'call_1',
    name: 'gh_pr_list',
    arguments: {},
  });
} catch (e) {
  if (e instanceof TimeoutError) {
    console.log('Command timed out after', e.timeout, 'ms');
    console.log('Command was:', e.command.join(' '));
  } else if (e instanceof ExecutionError) {
    console.log('Execution failed:', e.message);
    console.log('Command was:', e.command.join(' '));
    if (e.cause) {
      console.log('Cause:', e.cause.message);
    }
  }
}
```

**Expected Output** (if not authenticated):
```
Execution failed: Command exited with code 1
Command was: gh pr list
Cause: exit code 1
```

**Explanation**: Execution errors capture command context and any underlying cause for debugging.

---

## Integration Examples

### Example 14: Full Agent Loop with OpenAI

```typescript
import { createExecutor, parseToolCall, handleToolResult } from 'atip-execute';
import { toOpenAI } from 'atip-bridge';
import OpenAI from 'openai';
import ghTool from './atip/gh.json';

// Setup
const openai = new OpenAI();
const executor = createExecutor({
  tools: [ghTool],
  policy: {
    allowDestructive: false,
    confirmationHandler: async (ctx) => {
      console.log(`[CONFIRM] Execute: ${ctx.command.join(' ')}?`);
      // In production, prompt user here
      return false;  // Reject for safety
    },
  },
});

// Compile ATIP to OpenAI format
const tools = toOpenAI(ghTool);

async function agentLoop(userMessage: string) {
  const messages = [{ role: 'user', content: userMessage }];

  while (true) {
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      tools,
    });

    const choice = response.choices[0];

    // If no tool calls, we're done
    if (!choice.message.tool_calls) {
      return choice.message.content;
    }

    // Add assistant message
    messages.push(choice.message);

    // Parse and execute tool calls
    const toolCalls = parseToolCall('openai', response);

    for (const call of toolCalls) {
      try {
        const result = await executor.execute(call);

        // Format result for OpenAI
        const toolMessage = handleToolResult('openai', call.id, {
          success: result.success,
          output: result.content,
        });

        messages.push(toolMessage);
      } catch (e) {
        // Handle errors as tool results
        const toolMessage = handleToolResult('openai', call.id, {
          error: e.message,
        });
        messages.push(toolMessage);
      }
    }
  }
}

// Run agent
const response = await agentLoop('List my open pull requests');
console.log('Agent response:', response);
```

**Expected Output**:
```
Agent response: You have 2 open pull requests:

1. #42 "Fix authentication bug" - Ready for review
2. #41 "Add dark mode toggle" - Draft, needs more work

Would you like me to do anything with these PRs?
```

**Explanation**: This shows the complete lifecycle:
1. Compile ATIP metadata to OpenAI format (atip-bridge)
2. Send tools with request
3. Parse tool calls from response
4. Execute each tool call with safety policies
5. Format results and add to conversation
6. Continue until no more tool calls

---

### Example 15: Multi-Provider Support

```typescript
import { createExecutor, parseToolCall, handleToolResult } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({ tools: [ghTool] });

// Handle responses from any provider
async function executeFromProvider(provider, response) {
  const toolCalls = parseToolCall(provider, response);
  const messages = [];

  for (const call of toolCalls) {
    const result = await executor.execute(call);

    // Format for the same provider
    const message = handleToolResult(provider, call.id, {
      output: result.content,
    });

    messages.push(message);
  }

  return messages;
}

// OpenAI response
const openaiMessages = await executeFromProvider('openai', {
  choices: [{
    message: {
      tool_calls: [{
        id: 'call_abc',
        type: 'function',
        function: {
          name: 'gh_pr_list',
          arguments: '{}',
        },
      }],
    },
  }],
});

console.log('OpenAI format:', JSON.stringify(openaiMessages[0], null, 2));

// Anthropic response
const anthropicMessages = await executeFromProvider('anthropic', {
  content: [{
    type: 'tool_use',
    id: 'toolu_xyz',
    name: 'gh_pr_list',
    input: {},
  }],
});

console.log('Anthropic format:', JSON.stringify(anthropicMessages[0], null, 2));
```

**Expected Output**:
```json
OpenAI format: {
  "role": "tool",
  "tool_call_id": "call_abc",
  "content": "{\"output\":\"Showing 2 PRs...\"}"
}

Anthropic format: {
  "role": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_xyz",
    "content": "{\"output\":\"Showing 2 PRs...\"}"
  }]
}
```

**Explanation**: The executor is provider-agnostic. It parses from any provider format and can format results for any provider.

---

### Example 16: Working with Partial Discovery

```typescript
import { createExecutor, mapToCommand } from 'atip-execute';

// Partial ATIP metadata (only selected commands)
const partialGhTool = {
  atip: { version: '0.4', features: ['partial-discovery'] },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  partial: true,
  omitted: {
    reason: 'filtered',
    safetyAssumption: 'unknown',  // Treat unlisted as potentially unsafe
  },
  commands: {
    pr: {
      description: 'Pull request commands',
      commands: {
        list: {
          description: 'List PRs',
          effects: { network: true, idempotent: true },
        },
        // create, merge, etc. are omitted
      },
    },
  },
};

const executor = createExecutor({
  tools: [partialGhTool],
  policy: {
    allowDestructive: false,
  },
});

// Listed command - works
const listResult = executor.validate({
  id: '1',
  name: 'gh_pr_list',
  arguments: {},
});
console.log('gh_pr_list valid:', listResult.valid);

// Unlisted command - treated as unknown
const createMapping = mapToCommand('gh_pr_create', [partialGhTool]);
console.log('gh_pr_create mapping:', createMapping);

// Validation will fail for unlisted
const createResult = executor.validate({
  id: '2',
  name: 'gh_pr_create',
  arguments: { title: 'Test' },
});
console.log('gh_pr_create valid:', createResult.valid);
if (!createResult.valid) {
  console.log('Errors:', createResult.errors.map(e => e.code));
}
```

**Expected Output**:
```
gh_pr_list valid: true
gh_pr_create mapping: undefined
gh_pr_create valid: false
Errors: ['UNKNOWN_COMMAND']
```

**Explanation**: Per spec section 4.1, partial discovery means only listed commands are available. Unlisted commands are treated as unknown, which is safe given `safetyAssumption: 'unknown'`.

---

### Example 17: Interactive Command Handling

```typescript
import {
  createExecutor,
  InteractiveNotSupportedError
} from 'atip-execute';

// Tool with interactive command
const authTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    auth: {
      description: 'Authentication',
      commands: {
        login: {
          description: 'Login to GitHub',
          effects: {
            network: true,
            interactive: {
              stdin: 'required',  // Needs user input
              prompts: true,       // Will ask questions
              tty: true,          // Needs terminal
            },
          },
        },
      },
    },
  },
};

// Standard executor doesn't support interactive
const executor = createExecutor({
  tools: [authTool],
  policy: {
    allowInteractive: false,  // Block interactive commands
  },
});

try {
  await executor.execute({
    id: 'call_1',
    name: 'gh_auth_login',
    arguments: {},
  });
} catch (e) {
  if (e instanceof InteractiveNotSupportedError) {
    console.log('Cannot execute interactive command:', e.toolName);
    console.log('Interactive requirements:', e.interactiveEffects);
    console.log('Consider using: gh auth login --with-token');
  }
}
```

**Expected Output**:
```
Cannot execute interactive command: gh_auth_login
Interactive requirements: { stdin: 'required', prompts: true, tty: true }
Consider using: gh auth login --with-token
```

**Explanation**: Per spec section 3.6, tools can declare interactive requirements. When `allowInteractive: false`, such commands are blocked with a helpful error.

---

### Example 18: Type Coercion in Arguments

```typescript
import { validateToolCall, mapToCommand } from 'atip-execute';

const tool = {
  atip: { version: '0.4' },
  name: 'api',
  version: '1.0.0',
  description: 'API tool',
  commands: {
    request: {
      description: 'Make API request',
      options: [
        {
          name: 'port',
          flags: ['-p', '--port'],
          type: 'integer',
          description: 'Port number',
        },
        {
          name: 'timeout',
          flags: ['-t', '--timeout'],
          type: 'number',
          description: 'Timeout in seconds',
        },
        {
          name: 'verbose',
          flags: ['-v', '--verbose'],
          type: 'boolean',
          description: 'Verbose output',
        },
      ],
    },
  },
};

const mapping = mapToCommand('api_request', [tool]);

// LLMs often return numbers as strings
const result = validateToolCall(
  {
    id: '1',
    name: 'api_request',
    arguments: {
      port: '8080',      // String, should be integer
      timeout: '30.5',   // String, should be number
      verbose: 'true',   // String, should be boolean
    },
  },
  mapping
);

console.log('Valid:', result.valid);
console.log('Coerced arguments:', result.normalizedArgs);
```

**Expected Output**:
```typescript
Valid: true
Coerced arguments: {
  port: 8080,        // Coerced to integer
  timeout: 30.5,     // Coerced to number
  verbose: true      // Coerced to boolean
}
```

**Explanation**: Safe type coercion handles common LLM output variations. String "8080" becomes integer 8080. String "true" becomes boolean true.

---

## Performance Examples

### Example 19: Parallel Batch Execution

```typescript
import { createExecutor, parseToolCall } from 'atip-execute';
import ghTool from './atip/gh.json';

const executor = createExecutor({ tools: [ghTool] });

// Multiple independent read operations
const toolCalls = [
  { id: '1', name: 'gh_pr_list', arguments: { state: 'open' } },
  { id: '2', name: 'gh_issue_list', arguments: { state: 'open' } },
  { id: '3', name: 'gh_repo_view', arguments: {} },
  { id: '4', name: 'gh_workflow_list', arguments: {} },
];

// Sequential execution (safe, slow)
console.time('Sequential');
const seqResults = await executor.executeBatch(toolCalls, {
  parallel: false,
});
console.timeEnd('Sequential');

// Parallel execution (fast, for idempotent operations)
console.time('Parallel');
const parResults = await executor.executeBatch(toolCalls, {
  parallel: true,
  maxConcurrency: 4,
});
console.timeEnd('Parallel');

console.log('Sequential success:', seqResults.successCount);
console.log('Parallel success:', parResults.successCount);
```

**Expected Output**:
```
Sequential: 4523ms
Parallel: 1234ms
Sequential success: 4
Parallel success: 4
```

**Explanation**: Parallel execution is faster for independent, idempotent operations. Use with caution for operations that might conflict.

---

### Example 20: Command Map Caching

```typescript
import { createExecutor, mapToCommand } from 'atip-execute';

// Load many tools
const tools = [
  require('./atip/gh.json'),
  require('./atip/kubectl.json'),
  require('./atip/docker.json'),
  // ... many more
];

// First mapping - builds cache
console.time('First mapping');
const mapping1 = mapToCommand('kubectl_get_pods', tools);
console.timeEnd('First mapping');

// Subsequent mappings - uses cache
console.time('Cached mapping');
const mapping2 = mapToCommand('docker_container_ls', tools);
console.timeEnd('Cached mapping');

// Executor caches on creation
console.time('Create executor');
const executor = createExecutor({ tools });
console.timeEnd('Create executor');

// Executor lookups are O(1)
console.time('Executor lookup');
const mapping3 = executor.mapCommand('gh_pr_list');
console.timeEnd('Executor lookup');
```

**Expected Output**:
```
First mapping: 15ms
Cached mapping: 2ms
Create executor: 25ms
Executor lookup: <1ms
```

**Explanation**: The executor pre-builds a flattened command map on creation, making subsequent lookups O(1) instead of O(n * d).
