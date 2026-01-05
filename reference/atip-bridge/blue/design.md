# Design Document: atip-bridge

## Architecture Overview

```
                           ┌─────────────────────────────────────┐
                           │           atip-bridge               │
                           └─────────────────────────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          │                                │                                │
          ▼                                ▼                                ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   Transformers   │            │  Safety Utils    │            │ Lifecycle Helpers│
│                  │            │                  │            │                  │
│  • toOpenAI      │            │  • safetyPrompt  │            │  • handleResult  │
│  • toGemini      │            │  • validator     │            │  • parseToolCall │
│  • toAnthropic   │            │  • resultFilter  │            │                  │
│  • compileTools  │            │                  │            │                  │
└────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
         │                               │                               │
         ▼                               ▼                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              Shared Internals                                     │
│                                                                                   │
│  • flattenCommands()    - Subcommand tree flattening                             │
│  • buildSafetySuffix()  - Effects → description suffix                           │
│  • coerceType()         - ATIP type → JSON Schema type                           │
│  • transformParams()    - Arguments/options → provider params                     │
│  • truncateDescription()- Enforce provider limits                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The library is organized into three main functional areas:

1. **Transformers** - Convert ATIP metadata to provider formats
2. **Safety Utilities** - Runtime safety enforcement and filtering
3. **Lifecycle Helpers** - Parse responses and format results

All areas share common internal utilities for consistent behavior.

---

## Components

### 1. Transformers Module (`src/transformers/`)

**Responsibility**: Transform ATIP metadata into provider-specific function calling formats.

**Rationale**: Each provider has slightly different format requirements. Separating transformers allows:
- Provider-specific optimizations
- Easy addition of new providers
- Independent testing of each transformation

**Dependencies**:
- `src/internal/flatten.ts` - Command tree flattening
- `src/internal/safety.ts` - Safety suffix generation
- `src/internal/types.ts` - Type coercion

#### Files

| File | Purpose |
|------|---------|
| `openai.ts` | OpenAI-specific transformation with strict mode support |
| `gemini.ts` | Gemini-specific transformation |
| `anthropic.ts` | Anthropic-specific transformation |
| `index.ts` | Re-exports all transformers |

### 2. Compile Module (`src/compile.ts`)

**Responsibility**: Batch compilation of multiple tools to a provider format.

**Rationale**: Agents typically need to compile multiple tools at once. A dedicated module provides:
- Consistent interface for batch operations
- Deduplication of tool names
- Aggregated error reporting

**Dependencies**:
- All transformer modules
- Validation utilities

### 3. Safety Module (`src/safety/`)

**Responsibility**: Runtime safety utilities for agent developers.

**Rationale**: ATIP's core value is effects metadata. This module makes that metadata actionable:
- `prompt.ts` - Generate LLM-readable safety summaries
- `validator.ts` - Pre-execution policy enforcement
- `filter.ts` - Post-execution result sanitization

**Dependencies**:
- `src/internal/flatten.ts` - To map flattened names to commands
- `src/internal/effects.ts` - Effects analysis utilities

### 4. Lifecycle Module (`src/lifecycle/`)

**Responsibility**: Parse provider responses and format results.

**Rationale**: Each provider has different response/request formats for tool calls. This module normalizes the interface:
- `parse.ts` - Extract tool calls from responses
- `result.ts` - Format results for sending back

**Dependencies**: None (pure format conversion)

### 5. Internal Utilities (`src/internal/`)

**Responsibility**: Shared utilities used by multiple modules.

**Rationale**: Avoid code duplication and ensure consistent behavior across transformers.

| File | Purpose |
|------|---------|
| `flatten.ts` | Flatten nested command trees with path tracking |
| `safety.ts` | Build safety description suffixes |
| `types.ts` | ATIP type to JSON Schema type coercion |
| `params.ts` | Transform arguments/options to provider params |
| `validate.ts` | ATIP metadata validation utilities |

---

## Design Decisions

### Decision: Subcommand Flattening Strategy

**Context**: CLI tools have nested subcommands (e.g., `gh pr create`), but LLM function calling only supports flat function names.

**Options Considered**:
1. **Discrete tools (underscore-separated)**: `gh_pr_create`, `gh_pr_list`
   - Pros: Each command has distinct parameter schema
   - Cons: More tools to register

2. **Action discriminator**: Single `gh_pr` tool with `action` enum
   - Pros: Fewer tools
   - Cons: Complex schema, union parameters, harder for LLM to understand

**Decision**: Use discrete tools (Option 1) per spec section 8.2 Rule 3.

**Rationale**:
- Per spec: "Strategy A preferred when subcommands have distinct parameter schemas"
- Most CLI tools have distinct schemas per subcommand
- Clearer for LLMs to understand individual commands
- Simpler JSON Schema (no oneOf/anyOf)

### Decision: Safety Suffix Format

**Context**: Provider APIs don't have native effects support. Safety info must be embedded in descriptions.

**Options Considered**:
1. **Emoji prefixes**: Visually distinctive, compact
2. **Plain text prefixes**: More verbose, better for text models
3. **Suffix with brackets**: Separates from description, parseable

**Decision**: Use bracketed suffix with emoji flags: `"{description} [{FLAGS}]"`

**Rationale**:
- Per spec section 8.2 Rule 1: explicit format defined
- Suffix preserves original description readability
- Brackets make it parseable for programmatic extraction
- Emojis provide visual scanning in logs/debugging
- Pipe separators allow multiple flags

**Format**:
```
[flag1 | flag2 | flag3]
```

**Flags (per spec)**:
- `WARNING_SIGN DESTRUCTIVE` - destructive: true
- `WARNING_SIGN NOT REVERSIBLE` - reversible: false
- `WARNING_SIGN NOT IDEMPOTENT` - idempotent: false
- `MONEY_BAG BILLABLE` - cost.billable: true
- `LOCK READ-ONLY` - filesystem.write: false && network: false

### Decision: Optional Parameter Handling

**Context**: OpenAI strict mode requires all properties in `required` array, but ATIP has optional parameters.

**Options Considered**:
1. **Omit optional parameters**: Loses information
2. **Make all required**: Forces LLM to provide values
3. **Nullable types**: `["string", "null"]` with all in required

**Decision**: Transform optional parameters to nullable types in strict mode.

**Rationale**:
- Per spec section 8.2 Rule 2: explicit transformation defined
- Preserves parameter visibility
- LLM can pass `null` for optional params
- Matches OpenAI's recommended pattern

**Implementation**:
```typescript
// Non-strict mode
{ type: "string", description: "Optional title" }
// required: []

// Strict mode
{ type: ["string", "null"], description: "Optional title" }
// required: ["title"]
```

### Decision: Description Length Enforcement

**Context**: OpenAI enforces 1024 character limit on descriptions. Other providers don't.

**Options Considered**:
1. **Truncate all providers**: Consistent but loses information
2. **Truncate only OpenAI**: Provider-specific behavior
3. **Warn and truncate**: Log warning, then truncate

**Decision**: Truncate only for OpenAI, silently.

**Rationale**:
- Per spec: "Description length limits: OpenAI: 1024 characters (enforced)"
- No need to lose information on providers without limits
- Silent truncation matches the "compilation" model (not validation)
- Truncation adds "..." to indicate content was cut

**Implementation**:
```typescript
if (description.length > 1024) {
  return description.slice(0, 1021) + '...';
}
```

### Decision: Type Coercion Strategy

**Context**: ATIP has rich types (file, directory, url), but JSON Schema only supports primitives.

**Options Considered**:
1. **Map to string with format**: `{ type: "string", format: "file-path" }`
2. **Map to plain string**: `{ type: "string" }` with description
3. **Keep as-is**: Let provider handle unknown formats

**Decision**: Map to plain string, note in description.

**Rationale**:
- Per spec section 8.2 Rule 4: "format field is not reliably supported"
- Description is the reliable carrier of type information
- Avoids provider-specific format handling

**Type mapping**:
| ATIP Type | JSON Schema Type | Description Suffix |
|-----------|------------------|-------------------|
| `string` | `string` | - |
| `integer` | `integer` | - |
| `number` | `number` | - |
| `boolean` | `boolean` | - |
| `file` | `string` | "(file path)" |
| `directory` | `string` | "(directory path)" |
| `url` | `string` | "(URL)" |
| `enum` | `string` + enum | - |
| `array` | `array` | - |

### Decision: Error Handling Strategy

**Context**: Invalid ATIP metadata should be caught early, but the library should be forgiving.

**Options Considered**:
1. **Strict validation**: Throw on any deviation from schema
2. **Best effort**: Try to transform, ignore invalid parts
3. **Validate then transform**: Check first, then transform

**Decision**: Validate required fields, be lenient on optional/extension fields.

**Rationale**:
- Required fields (name, version, description, atip) must be present
- Optional fields with wrong types can be ignored
- Unknown `x-*` fields are ignored (per spec section 12.2)
- This matches "progressive enhancement" philosophy

**Implementation**:
```typescript
// Throws AtipValidationError
if (!tool.name || !tool.version || !tool.description || !tool.atip) {
  throw new AtipValidationError(...);
}

// Silently ignored
if (tool.effects?.cost && typeof tool.effects.cost.billable !== 'boolean') {
  // Use undefined, don't throw
}
```

### Decision: Tree-Shakeable Exports

**Context**: Library should be usable with minimal bundle size impact.

**Options Considered**:
1. **Single default export**: Import everything or nothing
2. **Named exports from index**: Some tree-shaking
3. **Deep path imports**: Maximum tree-shaking

**Decision**: Named exports from index, with internal re-exports.

**Rationale**:
- Modern bundlers (webpack, esbuild, rollup) handle named exports well
- Deep imports are fragile to internal refactoring
- Named exports provide good IDE autocomplete
- tsup/esbuild can optimize named exports effectively

**Import examples**:
```typescript
// Recommended
import { toOpenAI, createValidator } from 'atip-bridge';

// Also works (full import)
import * as atipBridge from 'atip-bridge';
```

---

## Data Flow

### Transformation Flow

```
AtipTool                    Provider Format
    │                            ▲
    ▼                            │
┌──────────────────┐   ┌──────────────────┐
│  Validate Input  │──▶│   Return Array   │
└────────┬─────────┘   └──────────────────┘
         │                      ▲
         ▼                      │
┌──────────────────┐   ┌──────────────────┐
│ Flatten Commands │──▶│  Build Provider  │
│  (recursive DFS) │   │    Tool Object   │
└────────┬─────────┘   └────────┬─────────┘
         │                      │
         ▼                      │
┌──────────────────┐   ┌──────────────────┐
│  For Each Leaf   │──▶│  Transform Params│
│  Command Node    │   │  Add Safety      │
└──────────────────┘   └──────────────────┘
```

1. **Validate Input**: Check required fields, ATIP version compatibility
2. **Flatten Commands**: Recursively walk command tree, build path-prefixed names
3. **For Each Leaf Command**: Commands without subcommands become tools
4. **Transform Params**: Convert arguments/options to provider parameter format
5. **Add Safety**: Append safety suffix to description
6. **Build Provider Object**: Construct provider-specific structure
7. **Return Array**: Collect all flattened tools

### Validation Flow

```
ToolCall                    ValidationResult
    │                            ▲
    ▼                            │
┌──────────────────┐   ┌──────────────────┐
│  Lookup Command  │──▶│  Return Result   │
│  by Flattened    │   │  with Violations │
│  Name            │   └──────────────────┘
└────────┬─────────┘            ▲
         │                      │
         ▼                      │
┌──────────────────┐   ┌──────────────────┐
│  Get Effects     │──▶│  Collect All     │
│  from Metadata   │   │  Violations      │
└────────┬─────────┘   └────────┬─────────┘
         │                      │
         ▼                      │
┌──────────────────┐   ┌──────────────────┐
│  Check Each      │──▶│  Check Policy    │
│  Effect vs       │   │  Violation       │
│  Policy          │   │                  │
└──────────────────┘   └──────────────────┘
```

1. **Lookup Command**: Map flattened name to original command metadata
2. **Get Effects**: Extract effects from command (or inherit from parent)
3. **Check Each Effect**: Compare effect values to policy settings
4. **Collect All Violations**: Don't short-circuit, report all violations
5. **Return Result**: Include violation details for agent decision-making

---

## Error Handling Strategy

### Error Types

| Error | When Thrown | Recovery |
|-------|-------------|----------|
| `AtipValidationError` | Invalid ATIP metadata structure | Fix metadata or use fallback |
| `AtipParseError` | Cannot parse provider response | Log and skip tool call |

### Error Design Principles

1. **Fail Fast on Required Data**: Missing `name`, `version`, `description`, or `atip` throws immediately
2. **Lenient on Optional Data**: Invalid optional fields are treated as undefined
3. **Informative Messages**: Errors include path to invalid data and actual value
4. **No Partial Results**: Transformation either succeeds completely or throws

### Recovery Patterns

```typescript
// Transformation with fallback
function compileWithFallback(tool: AtipTool): OpenAITool[] {
  try {
    return toOpenAI(tool);
  } catch (e) {
    if (e instanceof AtipValidationError) {
      console.warn(`Invalid ATIP metadata for ${tool.name}: ${e.message}`);
      return []; // Skip this tool
    }
    throw e;
  }
}

// Parsing with graceful degradation
function parseWithFallback(response: unknown): ToolCall[] {
  try {
    return parseToolCall('openai', response);
  } catch (e) {
    if (e instanceof AtipParseError) {
      console.warn('Could not parse tool calls:', e.message);
      return [];
    }
    throw e;
  }
}
```

---

## Safety Considerations

### Effects Metadata Preservation

**CRITICAL**: The core value proposition of ATIP is effects metadata. The library MUST:

1. **Never lose effects data silently**: Always include safety suffix in descriptions
2. **Preserve all safety-relevant fields**: destructive, reversible, idempotent, billable
3. **Make destructive operations obvious**: Always prefix with warning emoji
4. **Support validation**: Allow agents to check effects before execution

### Safety Suffix Priority

When description length is limited (OpenAI 1024 chars), prioritize safety flags:

1. **Always include**: `DESTRUCTIVE`, `NOT REVERSIBLE` (agent must know)
2. **Include if space**: `NOT IDEMPOTENT`, `BILLABLE`
3. **Include if space**: `READ-ONLY` (positive indicator)

**Implementation**: Build suffix first, then truncate description text (not suffix).

```typescript
function buildDescription(text: string, suffix: string): string {
  const maxTextLength = 1024 - suffix.length - 1; // -1 for space
  if (text.length > maxTextLength) {
    text = text.slice(0, maxTextLength - 3) + '...';
  }
  return suffix ? `${text} ${suffix}` : text;
}
```

### Result Filtering Security

The `ResultFilter` MUST:

1. **Redact known secret patterns**: Tokens, API keys, passwords
2. **Support custom patterns**: Allow agent-specific secrets
3. **Truncate long outputs**: Prevent context overflow attacks
4. **Not modify structure**: Only redact, don't parse/reformat

### Trust Level Awareness

The library does NOT enforce trust levels, but:

1. **Exposes trust metadata**: Available for agent policy decisions
2. **Documents trust implications**: In generated safety prompts
3. **Supports trust-based policies**: Validator can check min trust level

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `toOpenAI/toGemini/toAnthropic` | O(n) | n = total nested commands |
| `compileTools` | O(m * n) | m = tools, n = commands per tool |
| `createValidator` | O(n) | One-time index building |
| `Validator.validate` | O(1) | HashMap lookup |
| `createResultFilter` | O(p) | p = number of patterns |
| `ResultFilter.filter` | O(n * p) | n = output length, p = patterns |

### Memory Usage

- Validator caches flattened command map: O(n) where n = total commands
- ResultFilter stores compiled patterns: O(p) where p = pattern count
- Transformers are stateless: O(1)

### Optimization Opportunities

1. **Pattern pre-compilation**: Compile regex patterns once at filter creation
2. **Lazy flattening**: Only flatten on first access if validator unused
3. **Description caching**: Cache safety suffixes per effects combination

---

## Future Extensions

### New Providers

The design supports adding new providers by:

1. Creating new transformer in `src/transformers/{provider}.ts`
2. Adding provider type to `Provider` union
3. Implementing message types in `src/types/providers.ts`
4. Adding case to `compileTools`, `handleToolResult`, `parseToolCall`

### Enhanced Validation

Future versions may add:

- **Schema validation**: Full JSON Schema validation of ATIP input
- **Argument validation**: Type checking of tool call arguments
- **Path validation**: Check file/directory paths exist

### Streaming Support

For providers with streaming responses:

- `parseToolCallStream(provider, chunk)` - Incremental parsing
- `ToolCallBuilder` - Accumulate partial tool calls

### Caching Layer

For production use:

- Memoize transformation results by tool hash
- Cache compiled validators
- Share patterns across filters

---

## Testing Strategy

### Unit Tests

Each module has corresponding test file:

```
src/
  transformers/
    openai.ts      → tests/unit/transformers/openai.test.ts
    gemini.ts      → tests/unit/transformers/gemini.test.ts
    anthropic.ts   → tests/unit/transformers/anthropic.test.ts
  safety/
    prompt.ts      → tests/unit/safety/prompt.test.ts
    validator.ts   → tests/unit/safety/validator.test.ts
    filter.ts      → tests/unit/safety/filter.test.ts
  lifecycle/
    result.ts      → tests/unit/lifecycle/result.test.ts
    parse.ts       → tests/unit/lifecycle/parse.test.ts
```

### Integration Tests

```
tests/integration/
  compile-gh.test.ts      → Full gh.json compilation
  compile-minimal.test.ts → Minimal example compilation
  roundtrip.test.ts       → Parse → Execute → Result cycle
```

### Test Coverage Requirements

Per CLAUDE.md:
- 80%+ coverage on core logic
- 100% coverage on safety-critical code (effects handling, validation)
- Integration tests use real ATIP examples from `examples/`

---

## File Structure

```
reference/atip-bridge/
├── blue/
│   ├── api.md          # This API specification
│   ├── design.md       # This design document
│   └── examples.md     # Usage examples
├── src/
│   ├── index.ts        # Public exports
│   ├── types/
│   │   ├── atip.ts     # AtipTool, AtipCommand, etc.
│   │   ├── providers.ts # OpenAITool, GeminiFunctionDeclaration, etc.
│   │   └── safety.ts   # Policy, ValidationResult, etc.
│   ├── transformers/
│   │   ├── index.ts    # Re-exports
│   │   ├── openai.ts   # toOpenAI
│   │   ├── gemini.ts   # toGemini
│   │   └── anthropic.ts # toAnthropic
│   ├── safety/
│   │   ├── index.ts    # Re-exports
│   │   ├── prompt.ts   # generateSafetyPrompt
│   │   ├── validator.ts # createValidator
│   │   └── filter.ts   # createResultFilter
│   ├── lifecycle/
│   │   ├── index.ts    # Re-exports
│   │   ├── result.ts   # handleToolResult
│   │   └── parse.ts    # parseToolCall
│   ├── internal/
│   │   ├── flatten.ts  # flattenCommands
│   │   ├── safety.ts   # buildSafetySuffix
│   │   ├── types.ts    # coerceType
│   │   ├── params.ts   # transformParams
│   │   └── validate.ts # validateAtipTool
│   ├── errors.ts       # AtipValidationError, AtipParseError
│   ├── constants.ts    # SAFETY_FLAGS, limits, patterns
│   └── compile.ts      # compileTools
├── tests/
│   ├── unit/
│   │   ├── transformers/
│   │   ├── safety/
│   │   ├── lifecycle/
│   │   └── internal/
│   └── integration/
├── package.json
├── tsconfig.json
├── tsup.config.ts      # Build configuration
├── vitest.config.ts    # Test configuration
└── README.md
```
