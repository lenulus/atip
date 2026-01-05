# API Specification: atip-bridge

## Overview

`atip-bridge` is a TypeScript library that compiles ATIP (Agent Tool Introspection Protocol) metadata into provider-specific function calling formats for OpenAI, Gemini, and Anthropic. It provides:

1. **Core transformers** - Convert ATIP tools to provider formats
2. **Batch operations** - Compile multiple tools at once
3. **Safety utilities** - Generate prompts, validate calls, filter results
4. **Lifecycle helpers** - Parse responses and format results

The library is pure TypeScript with zero runtime dependencies, designed for tree-shaking.

---

## Core Types

### AtipTool

The input type representing ATIP metadata. Derived from `schema/0.4.json`.

```typescript
/**
 * ATIP protocol version declaration.
 * Supports both legacy string format and current object format.
 */
export type AtipVersion =
  | string  // Legacy: "0.3"
  | {
      version: string;
      features?: AtipFeature[];
      minAgentVersion?: string;
    };

export type AtipFeature =
  | 'partial-discovery'
  | 'interactive-effects'
  | 'trust-v1'
  | 'patterns-v1';

/**
 * Trust and provenance information for ATIP metadata.
 */
export interface AtipTrust {
  source: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred';
  verified?: boolean;
  checksum?: string;
  signedBy?: string;
  attestation?: string;
}

/**
 * Effects metadata describing tool side effects.
 * Per spec section 3.6.
 */
export interface AtipEffects {
  filesystem?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
    paths?: string[];
  };
  network?: boolean;
  subprocess?: boolean;
  idempotent?: boolean;
  reversible?: boolean;
  destructive?: boolean;
  creates?: string[];
  modifies?: string[];
  deletes?: string[];
  interactive?: {
    stdin?: 'none' | 'optional' | 'required' | 'password';
    prompts?: boolean;
    tty?: boolean;
  };
  cost?: {
    estimate?: 'free' | 'low' | 'medium' | 'high';
    billable?: boolean;
  };
  duration?: {
    typical?: string;
    timeout?: string;
  };
}

/**
 * ATIP parameter types per spec section 3.7.
 */
export type AtipParamType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'file'
  | 'directory'
  | 'url'
  | 'enum'
  | 'array';

/**
 * Command argument definition.
 */
export interface AtipArgument {
  name: string;
  type: AtipParamType;
  description: string;
  required?: boolean;      // Default: true
  default?: unknown;
  variadic?: boolean;      // Default: false
  enum?: (string | number)[];
}

/**
 * Command option definition.
 */
export interface AtipOption {
  name: string;
  flags: string[];         // e.g., ["-o", "--output"]
  type: AtipParamType;
  description: string;
  required?: boolean;      // Default: false
  default?: unknown;
  enum?: (string | number)[];
  envVar?: string;
}

/**
 * Command definition with optional nested subcommands.
 */
export interface AtipCommand {
  description: string;
  arguments?: AtipArgument[];
  options?: AtipOption[];
  commands?: Record<string, AtipCommand>;  // Nested subcommands
  effects?: AtipEffects;
  examples?: string[];
}

/**
 * Root ATIP tool metadata.
 * Per spec section 3.2.
 */
export interface AtipTool {
  atip: AtipVersion;
  name: string;
  version: string;
  description: string;
  homepage?: string;
  trust?: AtipTrust;
  commands?: Record<string, AtipCommand>;
  globalOptions?: AtipOption[];
  authentication?: {
    required?: boolean;
    methods?: Array<{
      type: 'token' | 'oauth' | 'api-key' | 'password' | 'certificate';
      envVar?: string;
      description?: string;
      setupCommand?: string;
    }>;
    checkCommand?: string;
  };
  effects?: AtipEffects;
  patterns?: AtipPattern[];

  // Partial discovery fields
  partial?: boolean;
  filter?: {
    commands?: string[];
    depth?: number | null;
  };
  totalCommands?: number;
  includedCommands?: number;
  omitted?: {
    reason: 'filtered' | 'depth-limited' | 'size-limited' | 'deprecated';
    safetyAssumption: 'unknown' | 'known-safe' | 'known-unsafe' | 'same-as-included';
  };
}

/**
 * Pattern definition for common workflows.
 */
export interface AtipPattern {
  name: string;
  description: string;
  steps: Array<{
    command: string;
    description?: string;
  }>;
  variables?: Record<string, {
    type: string;
    description: string;
  }>;
  tags?: string[];
  executable?: boolean;
}
```

### Provider Output Types

```typescript
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
  type: string | string[];  // string or ["string", "null"] for nullable
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
```

### Lifecycle Types

```typescript
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
```

### Safety Types

```typescript
/**
 * Safety policy for tool validation.
 */
export interface Policy {
  /** Allow destructive operations without confirmation */
  allowDestructive?: boolean;

  /** Allow non-reversible operations without confirmation */
  allowNonReversible?: boolean;

  /** Allow billable operations */
  allowBillable?: boolean;

  /** Allow network operations */
  allowNetwork?: boolean;

  /** Allow filesystem write operations */
  allowFilesystemWrite?: boolean;

  /** Allow filesystem delete operations */
  allowFilesystemDelete?: boolean;

  /** Maximum allowed cost estimate */
  maxCostEstimate?: 'free' | 'low' | 'medium' | 'high';

  /** Trust level threshold */
  minTrustLevel?: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred';
}

/**
 * Result of tool validation.
 */
export interface ValidationResult {
  valid: boolean;
  violations: PolicyViolation[];
}

export interface PolicyViolation {
  code: ViolationCode;
  message: string;
  severity: 'error' | 'warning';
  toolName: string;
  commandPath?: string[];
}

export type ViolationCode =
  | 'DESTRUCTIVE_OPERATION'
  | 'NON_REVERSIBLE_OPERATION'
  | 'BILLABLE_OPERATION'
  | 'NETWORK_OPERATION'
  | 'FILESYSTEM_WRITE'
  | 'FILESYSTEM_DELETE'
  | 'COST_EXCEEDS_LIMIT'
  | 'TRUST_BELOW_THRESHOLD'
  | 'UNKNOWN_COMMAND';

/**
 * Validator function returned by createValidator.
 */
export interface Validator {
  /**
   * Validate a tool call against the policy.
   * @param toolName - The flattened tool name (e.g., "gh_pr_create")
   * @param args - The arguments to the tool
   * @returns Validation result with violations
   */
  validate(toolName: string, args: Record<string, unknown>): ValidationResult;
}

/**
 * Filter for sanitizing tool results before sending to LLM.
 */
export interface ResultFilter {
  /**
   * Filter sensitive data from tool output.
   * @param result - Raw tool output
   * @param toolName - The tool that produced the output
   * @returns Filtered result safe to send to LLM
   */
  filter(result: string, toolName: string): string;
}

/**
 * Options for result filtering.
 */
export interface ResultFilterOptions {
  /** Maximum result length in characters */
  maxLength?: number;  // Default: 100000

  /** Patterns to redact (replaced with [REDACTED]) */
  redactPatterns?: RegExp[];

  /** Whether to redact common secret patterns */
  redactSecrets?: boolean;  // Default: true
}
```

---

## Core Transformers

### toOpenAI

```typescript
/**
 * Transform ATIP tool metadata to OpenAI function calling format.
 *
 * @param tool - ATIP tool metadata
 * @param options - Transformation options
 * @returns Array of OpenAI tool definitions (one per flattened command)
 *
 * @remarks
 * - Flattens nested subcommands (gh pr create -> gh_pr_create)
 * - Embeds safety metadata in descriptions per spec section 8.2
 * - In strict mode, transforms optional parameters to nullable types
 * - Truncates descriptions to 1024 characters (OpenAI limit)
 * - Coerces ATIP types to JSON Schema types per spec section 8.2 Rule 4
 *
 * @example
 * ```typescript
 * const tools = toOpenAI(ghTool, { strict: true });
 * // Returns OpenAITool[] with flattened commands
 * ```
 *
 * @throws {AtipValidationError} If tool metadata is invalid
 */
export function toOpenAI(
  tool: AtipTool,
  options?: { strict?: boolean }
): OpenAITool[];
```

**Contract**:
- Input must be valid ATIP metadata (passes schema validation)
- Output is always an array (empty if no commands)
- Each nested command produces a separate tool definition
- Command names are flattened with underscores: `pr.create` -> `gh_pr_create`
- Safety suffixes are appended to descriptions per spec section 8.2 Rule 1
- When `strict: true`:
  - All properties added to `required` array
  - Optional parameters get nullable type: `["string", "null"]`
  - `additionalProperties: false` is set
- Description truncated to 1024 chars if exceeded (with "..." suffix)

**Throws**:
- `AtipValidationError` - Invalid ATIP metadata structure

### toGemini

```typescript
/**
 * Transform ATIP tool metadata to Gemini function declaration format.
 *
 * @param tool - ATIP tool metadata
 * @returns Array of Gemini function declarations (one per flattened command)
 *
 * @remarks
 * - Flattens nested subcommands (gh pr create -> gh_pr_create)
 * - Embeds safety metadata in descriptions per spec section 8.2
 * - Only required parameters added to required array
 * - No description length limit enforced (Gemini has no explicit limit)
 *
 * @example
 * ```typescript
 * const tools = toGemini(ghTool);
 * // Returns GeminiFunctionDeclaration[] with flattened commands
 * ```
 *
 * @throws {AtipValidationError} If tool metadata is invalid
 */
export function toGemini(tool: AtipTool): GeminiFunctionDeclaration[];
```

**Contract**:
- Same flattening behavior as `toOpenAI`
- Same safety suffix behavior
- Only truly required parameters in `required` array
- No `strict` mode or nullable transformation

**Throws**:
- `AtipValidationError` - Invalid ATIP metadata structure

### toAnthropic

```typescript
/**
 * Transform ATIP tool metadata to Anthropic tool definition format.
 *
 * @param tool - ATIP tool metadata
 * @returns Array of Anthropic tool definitions (one per flattened command)
 *
 * @remarks
 * - Flattens nested subcommands (gh pr create -> gh_pr_create)
 * - Embeds safety metadata in descriptions per spec section 8.2
 * - Uses input_schema instead of parameters
 * - Only required parameters added to required array
 *
 * @example
 * ```typescript
 * const tools = toAnthropic(ghTool);
 * // Returns AnthropicTool[] with flattened commands
 * ```
 *
 * @throws {AtipValidationError} If tool metadata is invalid
 */
export function toAnthropic(tool: AtipTool): AnthropicTool[];
```

**Contract**:
- Same flattening behavior as `toOpenAI`
- Same safety suffix behavior
- Uses `input_schema` field instead of `parameters`
- Only truly required parameters in `required` array

**Throws**:
- `AtipValidationError` - Invalid ATIP metadata structure

---

## Batch Operations

### compileTools

```typescript
/**
 * Compile multiple ATIP tools to a specific provider format.
 *
 * @param tools - Array of ATIP tool metadata
 * @param provider - Target provider format
 * @param options - Provider-specific options
 * @returns Compiled tools for the specified provider
 *
 * @remarks
 * - Aggregates results from individual transformer calls
 * - Deduplicates tool names (later tools override earlier)
 * - Validates all tools before transformation
 *
 * @example
 * ```typescript
 * const result = compileTools([ghTool, kubectlTool], 'openai', { strict: true });
 * // Returns { provider: 'openai', tools: OpenAITool[] }
 * ```
 *
 * @throws {AtipValidationError} If any tool metadata is invalid
 */
export function compileTools(
  tools: AtipTool[],
  provider: Provider,
  options?: { strict?: boolean }
): ProviderTools;
```

**Contract**:
- Processes tools in order
- If duplicate flattened names exist, later tools override earlier
- Returns empty tools array if input is empty
- Provider-specific options only apply to relevant providers

**Throws**:
- `AtipValidationError` - If any tool in the array is invalid

---

## Safety Utilities

### generateSafetyPrompt

```typescript
/**
 * Generate a system prompt section describing tool safety properties.
 *
 * @param tools - ATIP tools to summarize
 * @returns Markdown-formatted safety summary for system prompt
 *
 * @remarks
 * - Groups tools by safety category (destructive, billable, etc.)
 * - Provides agent guidance for each category
 * - Suitable for inclusion in system prompts
 *
 * @example
 * ```typescript
 * const prompt = generateSafetyPrompt([ghTool]);
 * // Returns markdown like:
 * // "## Tool Safety Summary
 * //
 * // ### Destructive Operations
 * // The following commands permanently destroy data:
 * // - gh_repo_delete: Delete a repository
 * // ..."
 * ```
 */
export function generateSafetyPrompt(tools: AtipTool[]): string;
```

**Contract**:
- Returns empty string if no tools provided
- Categories: Destructive, Non-Reversible, Billable, Network, Interactive
- Each category lists affected commands with descriptions
- Format is markdown suitable for LLM system prompts

### createValidator

```typescript
/**
 * Create a validator for checking tool calls against a safety policy.
 *
 * @param tools - ATIP tools that may be called
 * @param policy - Safety policy to enforce
 * @returns Validator instance for checking calls
 *
 * @remarks
 * - Validator caches tool metadata for fast lookups
 * - Unknown tools are flagged with UNKNOWN_COMMAND violation
 * - All policy violations are returned (not just first)
 *
 * @example
 * ```typescript
 * const validator = createValidator([ghTool], {
 *   allowDestructive: false,
 *   allowBillable: false
 * });
 *
 * const result = validator.validate('gh_repo_delete', { repo: 'test' });
 * // result.valid === false
 * // result.violations includes DESTRUCTIVE_OPERATION
 * ```
 */
export function createValidator(
  tools: AtipTool[],
  policy: Policy
): Validator;
```

**Contract**:
- Validator is immutable after creation
- Policy defaults: all operations allowed
- `validate()` returns all violations, not just first
- Unknown commands produce `UNKNOWN_COMMAND` violation with severity `error`
- Destructive/non-reversible violations have severity `error`
- Network/filesystem violations have severity `warning`

### createResultFilter

```typescript
/**
 * Create a filter for sanitizing tool results before sending to LLM.
 *
 * @param tools - ATIP tools (used for tool-specific filtering rules)
 * @param options - Filtering options
 * @returns ResultFilter instance
 *
 * @remarks
 * - Default patterns redact common secrets (API keys, tokens, passwords)
 * - Tool-specific patterns may be added based on tool metadata
 * - Truncates results exceeding maxLength
 *
 * @example
 * ```typescript
 * const filter = createResultFilter([ghTool], {
 *   maxLength: 10000,
 *   redactSecrets: true
 * });
 *
 * const safeResult = filter.filter(rawOutput, 'gh_auth_token');
 * // Tokens and secrets are replaced with [REDACTED]
 * ```
 */
export function createResultFilter(
  tools: AtipTool[],
  options?: ResultFilterOptions
): ResultFilter;
```

**Contract**:
- Default `maxLength`: 100,000 characters
- Default `redactSecrets`: true
- Built-in patterns for:
  - API keys (Bearer tokens, Basic auth)
  - GitHub tokens (ghp_, gho_, ghs_, ghu_)
  - AWS keys (AKIA...)
  - Generic secrets (password=, secret=, token=)
- Truncation appends `\n[TRUNCATED]` marker
- Custom patterns from `redactPatterns` are applied after built-in patterns

---

## Lifecycle Helpers

### handleToolResult

```typescript
/**
 * Format a tool execution result for sending back to the LLM.
 *
 * @param provider - Target provider
 * @param id - Tool call ID from the provider
 * @param result - Tool execution result (will be stringified if object)
 * @returns Provider-specific message format
 *
 * @remarks
 * - OpenAI: role="tool" message with tool_call_id
 * - Gemini: role="user" message with function_response part
 * - Anthropic: role="user" message with tool_result content block
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
export function handleToolResult(
  provider: Provider,
  id: string,
  result: unknown
): Message;
```

**Contract**:
- `result` is JSON-stringified for OpenAI and Anthropic
- Gemini receives result as-is (not stringified)
- For OpenAI: `id` is the `tool_call_id`
- For Gemini: `id` is the function name
- For Anthropic: `id` is the `tool_use_id`

### parseToolCall

```typescript
/**
 * Parse tool calls from a provider's response.
 *
 * @param provider - Source provider
 * @param response - Raw API response object
 * @returns Array of parsed tool calls
 *
 * @remarks
 * - Handles provider-specific response structures
 * - Returns empty array if no tool calls in response
 * - Arguments are parsed from JSON strings where applicable
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
 *
 * @throws {AtipParseError} If response structure is invalid
 */
export function parseToolCall(
  provider: Provider,
  response: unknown
): ToolCall[];
```

**Contract**:
- Returns empty array if no tool calls present
- Parses JSON argument strings (OpenAI provides arguments as JSON string)
- Preserves original argument objects where applicable (Anthropic)
- Tool call `id` is populated from provider-specific field:
  - OpenAI: `tool_calls[].id`
  - Gemini: function name (no explicit ID)
  - Anthropic: `content[].id` where `type === 'tool_use'`

**Throws**:
- `AtipParseError` - Response structure doesn't match expected provider format

---

## Error Types

```typescript
/**
 * Error thrown when ATIP metadata fails validation.
 */
export class AtipValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string[],
    public readonly value: unknown
  );
}

/**
 * Error thrown when parsing provider responses fails.
 */
export class AtipParseError extends Error {
  constructor(
    message: string,
    public readonly provider: Provider,
    public readonly response: unknown
  );
}
```

---

## Constants

```typescript
/**
 * Maximum description length for OpenAI (enforced by API).
 */
export const OPENAI_DESCRIPTION_MAX_LENGTH = 1024;

/**
 * Safety flag prefixes used in description suffixes.
 */
export const SAFETY_FLAGS = {
  DESTRUCTIVE: '\u26a0\ufe0f DESTRUCTIVE',
  NOT_REVERSIBLE: '\u26a0\ufe0f NOT REVERSIBLE',
  NOT_IDEMPOTENT: '\u26a0\ufe0f NOT IDEMPOTENT',
  BILLABLE: '\ud83d\udcb0 BILLABLE',
  READ_ONLY: '\ud83d\udd12 READ-ONLY',
} as const;

/**
 * Default patterns for secret redaction.
 */
export const DEFAULT_REDACT_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g,
  /Basic\s+[A-Za-z0-9+\/]+=*/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /gho_[A-Za-z0-9]{36}/g,
  /ghs_[A-Za-z0-9]{36}/g,
  /ghu_[A-Za-z0-9]{36}/g,
  /AKIA[A-Z0-9]{16}/g,
  /(?<=password[=:\s])[^\s]+/gi,
  /(?<=secret[=:\s])[^\s]+/gi,
  /(?<=token[=:\s])[^\s]+/gi,
  /(?<=api[_-]?key[=:\s])[^\s]+/gi,
];
```

---

## Module Exports

```typescript
// Core transformers
export { toOpenAI } from './transformers/openai';
export { toGemini } from './transformers/gemini';
export { toAnthropic } from './transformers/anthropic';

// Batch operations
export { compileTools } from './compile';

// Safety utilities
export { generateSafetyPrompt } from './safety/prompt';
export { createValidator } from './safety/validator';
export { createResultFilter } from './safety/filter';

// Lifecycle helpers
export { handleToolResult } from './lifecycle/result';
export { parseToolCall } from './lifecycle/parse';

// Types (re-exported for consumers)
export type {
  // Input types
  AtipTool,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
  AtipTrust,
  AtipPattern,
  AtipVersion,
  AtipFeature,
  AtipParamType,

  // Provider types
  Provider,
  OpenAITool,
  OpenAIParameter,
  GeminiFunctionDeclaration,
  GeminiParameter,
  AnthropicTool,
  AnthropicParameter,
  ProviderTool,
  ProviderTools,

  // Lifecycle types
  ToolCall,
  Message,
  OpenAIToolMessage,
  GeminiToolMessage,
  AnthropicToolMessage,

  // Safety types
  Policy,
  ValidationResult,
  PolicyViolation,
  ViolationCode,
  Validator,
  ResultFilter,
  ResultFilterOptions,
};

// Error types
export { AtipValidationError, AtipParseError } from './errors';

// Constants
export {
  OPENAI_DESCRIPTION_MAX_LENGTH,
  SAFETY_FLAGS,
  DEFAULT_REDACT_PATTERNS,
} from './constants';
```
