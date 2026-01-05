# Usage Examples: atip-bridge

## Basic Usage

### Example 1: Transform to OpenAI Format

```typescript
import { toOpenAI } from 'atip-bridge';

// Minimal ATIP tool
const myTool = {
  atip: { version: '0.4' },
  name: 'greet',
  version: '1.0.0',
  description: 'A greeting tool',
  commands: {
    hello: {
      description: 'Say hello to someone',
      arguments: [
        {
          name: 'name',
          type: 'string',
          description: 'Name to greet',
          required: true,
        },
      ],
      options: [
        {
          name: 'loud',
          flags: ['-l', '--loud'],
          type: 'boolean',
          description: 'Use uppercase',
          required: false,
        },
      ],
      effects: {
        idempotent: true,
        network: false,
      },
    },
  },
};

const openaiTools = toOpenAI(myTool);
console.log(JSON.stringify(openaiTools, null, 2));
```

**Expected Output**:
```json
[
  {
    "type": "function",
    "function": {
      "name": "greet_hello",
      "description": "Say hello to someone",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Name to greet"
          },
          "loud": {
            "type": "boolean",
            "description": "Use uppercase"
          }
        },
        "required": ["name"],
        "additionalProperties": false
      }
    }
  }
]
```

**Explanation**: The tool is flattened from `greet.hello` to `greet_hello`. Only the required `name` argument is in the `required` array. The `loud` option is optional.

---

### Example 2: Transform with Strict Mode (OpenAI)

```typescript
import { toOpenAI } from 'atip-bridge';

const myTool = {
  atip: { version: '0.4' },
  name: 'deploy',
  version: '2.0.0',
  description: 'Deployment tool',
  commands: {
    run: {
      description: 'Deploy the application',
      options: [
        {
          name: 'environment',
          flags: ['-e', '--env'],
          type: 'enum',
          enum: ['dev', 'staging', 'prod'],
          description: 'Target environment',
          required: true,
        },
        {
          name: 'dry-run',
          flags: ['--dry-run'],
          type: 'boolean',
          description: 'Simulate without changes',
          required: false,
        },
      ],
      effects: {
        network: true,
        idempotent: false,
        reversible: false,
      },
    },
  },
};

// Enable strict mode
const openaiTools = toOpenAI(myTool, { strict: true });
console.log(JSON.stringify(openaiTools, null, 2));
```

**Expected Output**:
```json
[
  {
    "type": "function",
    "function": {
      "name": "deploy_run",
      "description": "Deploy the application [WARNING NOT REVERSIBLE | WARNING NOT IDEMPOTENT]",
      "strict": true,
      "parameters": {
        "type": "object",
        "properties": {
          "environment": {
            "type": "string",
            "enum": ["dev", "staging", "prod"],
            "description": "Target environment"
          },
          "dry-run": {
            "type": ["boolean", "null"],
            "description": "Simulate without changes"
          }
        },
        "required": ["environment", "dry-run"],
        "additionalProperties": false
      }
    }
  }
]
```

**Explanation**:
- `strict: true` is set on the function
- Optional `dry-run` becomes nullable: `["boolean", "null"]`
- All parameters are in `required` array
- Safety suffix added for `reversible: false` and `idempotent: false`

---

### Example 3: Transform to Gemini Format

```typescript
import { toGemini } from 'atip-bridge';

const ghTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    pr: {
      description: 'Manage pull requests',
      commands: {
        list: {
          description: 'List pull requests',
          options: [
            {
              name: 'state',
              flags: ['-s', '--state'],
              type: 'enum',
              enum: ['open', 'closed', 'merged', 'all'],
              description: 'Filter by state',
              default: 'open',
            },
          ],
          effects: {
            network: true,
            idempotent: true,
          },
        },
      },
    },
  },
};

const geminiTools = toGemini(ghTool);
console.log(JSON.stringify(geminiTools, null, 2));
```

**Expected Output**:
```json
[
  {
    "name": "gh_pr_list",
    "description": "List pull requests",
    "parameters": {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "enum": ["open", "closed", "merged", "all"],
          "description": "Filter by state"
        }
      },
      "required": []
    }
  }
]
```

**Explanation**:
- Nested command `pr.list` becomes `gh_pr_list`
- No safety suffix (idempotent: true is positive, no warnings)
- Gemini format uses `parameters` directly (no wrapper)

---

### Example 4: Transform to Anthropic Format

```typescript
import { toAnthropic } from 'atip-bridge';

const repoTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    repo: {
      description: 'Manage repositories',
      commands: {
        delete: {
          description: 'Delete a repository permanently',
          arguments: [
            {
              name: 'repository',
              type: 'string',
              description: 'Repository in OWNER/REPO format',
              required: true,
            },
          ],
          effects: {
            network: true,
            destructive: true,
            reversible: false,
          },
        },
      },
    },
  },
};

const anthropicTools = toAnthropic(repoTool);
console.log(JSON.stringify(anthropicTools, null, 2));
```

**Expected Output**:
```json
[
  {
    "name": "gh_repo_delete",
    "description": "Delete a repository permanently [WARNING DESTRUCTIVE | WARNING NOT REVERSIBLE]",
    "input_schema": {
      "type": "object",
      "properties": {
        "repository": {
          "type": "string",
          "description": "Repository in OWNER/REPO format"
        }
      },
      "required": ["repository"]
    }
  }
]
```

**Explanation**:
- Anthropic uses `input_schema` instead of `parameters`
- Critical safety flags included for destructive operation
- Warning emojis make the danger obvious in the description

---

## Advanced Usage

### Example 5: Batch Compilation

```typescript
import { compileTools } from 'atip-bridge';

const ghTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    pr: {
      description: 'Manage pull requests',
      commands: {
        list: {
          description: 'List pull requests',
          effects: { network: true, idempotent: true },
        },
        create: {
          description: 'Create a pull request',
          options: [
            {
              name: 'title',
              flags: ['-t', '--title'],
              type: 'string',
              description: 'PR title',
              required: true,
            },
          ],
          effects: { network: true, idempotent: false },
        },
      },
    },
  },
};

const kubectlTool = {
  atip: { version: '0.4' },
  name: 'kubectl',
  version: '1.28.0',
  description: 'Kubernetes CLI',
  commands: {
    get: {
      description: 'Display resources',
      arguments: [
        {
          name: 'resource',
          type: 'string',
          description: 'Resource type (pods, services, etc.)',
          required: true,
        },
      ],
      effects: { network: true, idempotent: true },
    },
  },
};

const result = compileTools([ghTool, kubectlTool], 'openai', { strict: true });
console.log(result.provider); // 'openai'
console.log(result.tools.length); // 3 tools total
```

**Expected Output**:
```typescript
{
  provider: 'openai',
  tools: [
    // gh_pr_list
    { type: 'function', function: { name: 'gh_pr_list', ... } },
    // gh_pr_create
    { type: 'function', function: { name: 'gh_pr_create', ... } },
    // kubectl_get
    { type: 'function', function: { name: 'kubectl_get', ... } },
  ]
}
```

**Explanation**: Multiple tools compiled in one call, flattened into a single array of provider tools.

---

### Example 6: Generate Safety Prompt

```typescript
import { generateSafetyPrompt } from 'atip-bridge';

const ghTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    repo: {
      description: 'Manage repositories',
      commands: {
        delete: {
          description: 'Delete a repository',
          effects: { destructive: true, reversible: false },
        },
        archive: {
          description: 'Archive a repository',
          effects: { reversible: false },
        },
      },
    },
    pr: {
      description: 'Pull requests',
      commands: {
        create: {
          description: 'Create a PR',
          effects: { idempotent: false },
        },
        merge: {
          description: 'Merge a PR',
          effects: { reversible: false },
        },
      },
    },
  },
};

const prompt = generateSafetyPrompt([ghTool]);
console.log(prompt);
```

**Expected Output**:
```markdown
## Tool Safety Summary

### Destructive Operations
The following commands permanently destroy data. Always confirm with the user before executing:
- `gh_repo_delete`: Delete a repository

### Non-Reversible Operations
The following commands cannot be undone:
- `gh_repo_delete`: Delete a repository
- `gh_repo_archive`: Archive a repository
- `gh_pr_merge`: Merge a PR

### Non-Idempotent Operations
The following commands have different effects on repeated execution:
- `gh_pr_create`: Create a PR
```

**Explanation**: The prompt groups commands by safety category, making it suitable for LLM system prompts. Agents can include this to ensure the LLM understands which operations are dangerous.

---

### Example 7: Create and Use a Validator

```typescript
import { createValidator } from 'atip-bridge';

const ghTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    repo: {
      description: 'Manage repositories',
      commands: {
        delete: {
          description: 'Delete a repository',
          effects: { destructive: true, reversible: false, network: true },
        },
        list: {
          description: 'List repositories',
          effects: { network: true, idempotent: true },
        },
      },
    },
  },
};

// Create validator with restrictive policy
const validator = createValidator([ghTool], {
  allowDestructive: false,
  allowNonReversible: false,
  allowNetwork: true,
});

// Validate a safe operation
const listResult = validator.validate('gh_repo_list', {});
console.log('List valid:', listResult.valid);
// Output: List valid: true

// Validate a dangerous operation
const deleteResult = validator.validate('gh_repo_delete', { repo: 'owner/name' });
console.log('Delete valid:', deleteResult.valid);
console.log('Violations:', deleteResult.violations);
```

**Expected Output**:
```typescript
List valid: true

Delete valid: false
Violations: [
  {
    code: 'DESTRUCTIVE_OPERATION',
    message: 'Operation gh_repo_delete is destructive',
    severity: 'error',
    toolName: 'gh_repo_delete',
    commandPath: ['repo', 'delete']
  },
  {
    code: 'NON_REVERSIBLE_OPERATION',
    message: 'Operation gh_repo_delete cannot be reversed',
    severity: 'error',
    toolName: 'gh_repo_delete',
    commandPath: ['repo', 'delete']
  }
]
```

**Explanation**: The validator checks tool calls against a policy. Both violations are returned, allowing the agent to present all issues to the user.

---

### Example 8: Unknown Command Handling

```typescript
import { createValidator } from 'atip-bridge';

const validator = createValidator([ghTool], {
  allowDestructive: false,
});

// Try to validate a command not in the metadata
const result = validator.validate('gh_unknown_command', {});
console.log('Valid:', result.valid);
console.log('Violations:', result.violations);
```

**Expected Output**:
```typescript
Valid: false
Violations: [
  {
    code: 'UNKNOWN_COMMAND',
    message: 'Command gh_unknown_command not found in tool metadata',
    severity: 'error',
    toolName: 'gh_unknown_command',
    commandPath: undefined
  }
]
```

**Explanation**: Unknown commands are flagged as violations. This is especially important for partial discovery where some commands may not be in the loaded metadata.

---

### Example 9: Result Filtering

```typescript
import { createResultFilter } from 'atip-bridge';

const ghTool = {
  atip: { version: '0.4' },
  name: 'gh',
  version: '2.45.0',
  description: 'GitHub CLI',
  commands: {
    auth: {
      description: 'Authentication',
      commands: {
        token: {
          description: 'Print auth token',
          effects: {},
        },
      },
    },
  },
};

const filter = createResultFilter([ghTool], {
  maxLength: 500,
  redactSecrets: true,
});

// Raw output with sensitive data
const rawOutput = `
Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
API Key: AKIAIOSFODNN7EXAMPLE
Password: secret123
Some normal output that should remain visible
`;

const safeOutput = filter.filter(rawOutput, 'gh_auth_token');
console.log(safeOutput);
```

**Expected Output**:
```
Token: [REDACTED]
API Key: [REDACTED]
Password: [REDACTED]
Some normal output that should remain visible
```

**Explanation**: Sensitive patterns are automatically redacted. The filter protects against accidentally leaking secrets to the LLM.

---

### Example 10: Custom Redaction Patterns

```typescript
import { createResultFilter, DEFAULT_REDACT_PATTERNS } from 'atip-bridge';

const filter = createResultFilter([], {
  redactPatterns: [
    ...DEFAULT_REDACT_PATTERNS,
    /SSN:\s*\d{3}-\d{2}-\d{4}/g,         // Social Security Numbers
    /credit[_-]?card[=:\s]\d{16}/gi,      // Credit card numbers
  ],
});

const output = `
User: John Doe
SSN: 123-45-6789
Credit_card: 4111111111111111
`;

console.log(filter.filter(output, 'some_tool'));
```

**Expected Output**:
```
User: John Doe
[REDACTED]
[REDACTED]
```

**Explanation**: Custom patterns can extend the default set to handle domain-specific secrets.

---

## Lifecycle Examples

### Example 11: Parse OpenAI Tool Calls

```typescript
import { parseToolCall } from 'atip-bridge';

// Simulated OpenAI response
const openaiResponse = {
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
          {
            id: 'call_def456',
            type: 'function',
            function: {
              name: 'gh_pr_create',
              arguments: '{"title": "Fix bug", "draft": true}',
            },
          },
        ],
      },
    },
  ],
};

const calls = parseToolCall('openai', openaiResponse);
console.log(calls);
```

**Expected Output**:
```typescript
[
  {
    id: 'call_abc123',
    name: 'gh_pr_list',
    arguments: { state: 'open' }
  },
  {
    id: 'call_def456',
    name: 'gh_pr_create',
    arguments: { title: 'Fix bug', draft: true }
  }
]
```

**Explanation**: The parser extracts tool calls and parses JSON argument strings into objects.

---

### Example 12: Parse Anthropic Tool Calls

```typescript
import { parseToolCall } from 'atip-bridge';

// Simulated Anthropic response
const anthropicResponse = {
  content: [
    {
      type: 'text',
      text: 'I will list the pull requests for you.',
    },
    {
      type: 'tool_use',
      id: 'toolu_01XYZ',
      name: 'gh_pr_list',
      input: { state: 'open' },
    },
  ],
};

const calls = parseToolCall('anthropic', anthropicResponse);
console.log(calls);
```

**Expected Output**:
```typescript
[
  {
    id: 'toolu_01XYZ',
    name: 'gh_pr_list',
    arguments: { state: 'open' }
  }
]
```

**Explanation**: For Anthropic, `input` is already an object (not a JSON string), and text blocks are filtered out.

---

### Example 13: Format Tool Results

```typescript
import { handleToolResult } from 'atip-bridge';

// OpenAI result format
const openaiMsg = handleToolResult('openai', 'call_abc123', {
  prs: [{ number: 42, title: 'Fix bug' }],
});
console.log('OpenAI:', openaiMsg);

// Gemini result format
const geminiMsg = handleToolResult('gemini', 'gh_pr_list', {
  prs: [{ number: 42, title: 'Fix bug' }],
});
console.log('Gemini:', geminiMsg);

// Anthropic result format
const anthropicMsg = handleToolResult('anthropic', 'toolu_01XYZ', {
  prs: [{ number: 42, title: 'Fix bug' }],
});
console.log('Anthropic:', anthropicMsg);
```

**Expected Output**:
```typescript
OpenAI: {
  role: 'tool',
  tool_call_id: 'call_abc123',
  content: '{"prs":[{"number":42,"title":"Fix bug"}]}'
}

Gemini: {
  role: 'user',
  parts: [
    {
      function_response: {
        name: 'gh_pr_list',
        response: { prs: [{ number: 42, title: 'Fix bug' }] }
      }
    }
  ]
}

Anthropic: {
  role: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_01XYZ',
      content: '{"prs":[{"number":42,"title":"Fix bug"}]}'
    }
  ]
}
```

**Explanation**: Each provider has a different message format for returning results. The helper constructs the correct format automatically.

---

## Integration Examples

### Example 14: Full Agent Loop with OpenAI

```typescript
import {
  toOpenAI,
  createValidator,
  createResultFilter,
  parseToolCall,
  handleToolResult,
} from 'atip-bridge';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 1. Load and compile tools
const ghTool = require('./examples/gh.json');
const tools = toOpenAI(ghTool, { strict: true });

// 2. Create safety utilities
const validator = createValidator([ghTool], {
  allowDestructive: false,
});
const filter = createResultFilter([ghTool]);

// 3. Send to OpenAI (pseudo-code)
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'List open PRs' }],
  tools: tools,
});

// 4. Parse tool calls
const toolCalls = parseToolCall('openai', response);

// 5. Validate and execute
const messages = [];
for (const call of toolCalls) {
  const validation = validator.validate(call.name, call.arguments);

  if (!validation.valid) {
    messages.push(
      handleToolResult('openai', call.id, {
        error: 'Blocked by policy',
        violations: validation.violations.map((v) => v.message),
      })
    );
    continue;
  }

  // Convert flattened name back to CLI command
  const command = call.name.replace(/_/g, ' ').replace(/^gh /, 'gh ');
  const args = Object.entries(call.arguments)
    .map(([k, v]) => `--${k}=${v}`)
    .join(' ');

  const { stdout } = await execAsync(`${command} ${args}`);

  // Filter and return result
  const safeOutput = filter.filter(stdout, call.name);
  messages.push(handleToolResult('openai', call.id, safeOutput));
}

// 6. Continue conversation with results
const finalResponse = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...previousMessages, ...messages],
});
```

**Explanation**: This shows the complete lifecycle:
1. Compile ATIP to OpenAI format
2. Set up validation and filtering
3. Send tools with the request
4. Parse the response for tool calls
5. Validate each call against policy
6. Execute approved calls and filter results
7. Return results to continue the conversation

---

### Example 15: Error Handling

```typescript
import { toOpenAI, AtipValidationError, parseToolCall, AtipParseError } from 'atip-bridge';

// Invalid ATIP (missing required fields)
const invalidTool = {
  atip: { version: '0.4' },
  // missing: name, version, description
  commands: {},
};

try {
  toOpenAI(invalidTool);
} catch (e) {
  if (e instanceof AtipValidationError) {
    console.log('Validation error:', e.message);
    console.log('Path:', e.path);
    console.log('Value:', e.value);
  }
}
// Output:
// Validation error: Missing required field 'name'
// Path: ['name']
// Value: undefined

// Invalid response structure
const badResponse = { invalid: 'structure' };

try {
  parseToolCall('openai', badResponse);
} catch (e) {
  if (e instanceof AtipParseError) {
    console.log('Parse error:', e.message);
    console.log('Provider:', e.provider);
  }
}
// Output:
// Parse error: Expected choices array in OpenAI response
// Provider: openai
```

**Explanation**: Typed errors allow proper handling of different failure modes. Validation errors include the path to the invalid data for debugging.

---

### Example 16: Legacy ATIP Version Support

```typescript
import { toOpenAI } from 'atip-bridge';

// Legacy format (string version)
const legacyTool = {
  atip: '0.3', // String format from older versions
  name: 'mytool',
  version: '1.0.0',
  description: 'Legacy tool',
  commands: {
    run: {
      description: 'Run something',
      effects: { network: false },
    },
  },
};

// Both formats work
const tools = toOpenAI(legacyTool);
console.log('Compiled', tools.length, 'tools');
// Output: Compiled 1 tools
```

**Explanation**: Per spec section 3.2.1, both legacy string format (`"0.3"`) and current object format (`{ version: "0.4" }`) are accepted.

---

### Example 17: Type Coercion for File Paths

```typescript
import { toOpenAI } from 'atip-bridge';

const fileTool = {
  atip: { version: '0.4' },
  name: 'processor',
  version: '1.0.0',
  description: 'File processor',
  commands: {
    convert: {
      description: 'Convert a file',
      arguments: [
        {
          name: 'input',
          type: 'file',
          description: 'Input file',
          required: true,
        },
        {
          name: 'output',
          type: 'directory',
          description: 'Output directory',
          required: true,
        },
      ],
      options: [
        {
          name: 'url',
          flags: ['-u', '--url'],
          type: 'url',
          description: 'Remote source URL',
        },
      ],
    },
  },
};

const tools = toOpenAI(fileTool);
console.log(tools[0].function.parameters.properties);
```

**Expected Output**:
```typescript
{
  input: {
    type: 'string',
    description: 'Input file (file path)'
  },
  output: {
    type: 'string',
    description: 'Output directory (directory path)'
  },
  url: {
    type: 'string',
    description: 'Remote source URL (URL)'
  }
}
```

**Explanation**: ATIP types `file`, `directory`, and `url` are coerced to `string` with type hints appended to descriptions, per spec section 8.2 Rule 4.

---

### Example 18: Description Truncation

```typescript
import { toOpenAI, OPENAI_DESCRIPTION_MAX_LENGTH } from 'atip-bridge';

const longDescription = 'A'.repeat(1100); // Over 1024 limit

const verboseTool = {
  atip: { version: '0.4' },
  name: 'verbose',
  version: '1.0.0',
  description: 'Short root description',
  commands: {
    detailed: {
      description: longDescription,
      effects: { destructive: true },
    },
  },
};

const tools = toOpenAI(verboseTool);
const desc = tools[0].function.description;

console.log('Length:', desc.length);
console.log('Ends with:', desc.slice(-50));
```

**Expected Output**:
```
Length: 1024
Ends with: AAAA... [WARNING DESTRUCTIVE]
```

**Explanation**: The description is truncated to fit OpenAI's 1024 character limit, but the safety suffix is preserved. The truncated text ends with "..." before the safety flags.
