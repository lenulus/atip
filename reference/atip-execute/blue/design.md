# Design Document: atip-execute

## Architecture Overview

```
                              atip-execute
                                   |
        +--------------------------+----------------------------+
        |                          |                            |
        v                          v                            v
+----------------+        +----------------+         +-------------------+
|  Tool Call     |        |   Validation   |         |    Execution      |
|  Parsing       |        |   & Policy     |         |    Engine         |
|                |        |                |         |                   |
| parseToolCall  |        | validateCall   |         | executeCommand    |
| (via bridge)   |        | checkPolicy    |         | buildCommandArgs  |
+-------+--------+        +-------+--------+         +--------+----------+
        |                         |                           |
        v                         v                           v
+----------------+        +----------------+         +-------------------+
|   Command      |        |   Effects      |         |    Result         |
|   Mapping      |        |   Analyzer     |         |    Formatting     |
|                |        |                |         |                   |
| mapToCommand   |        | mergeEffects   |         | formatResult      |
| unflatten      |        | checkEffects   |         | filterSecrets     |
+----------------+        +----------------+         +-------------------+
        |                         |                           |
        +------------+------------+---------------------------+
                     |
                     v
        +------------------------+
        |   atip-bridge Types    |
        |   (AtipTool, etc.)     |
        +------------------------+
```

The library is organized into three main functional areas:

1. **Tool Call Parsing & Mapping** - Parse LLM responses and map to CLI commands
2. **Validation & Policy** - Validate arguments and enforce execution policies
3. **Execution & Formatting** - Execute subprocesses and format results

All areas share common ATIP types from `atip-bridge`.

---

## Components

### 1. Parsing Module (`src/parse.ts`)

**Responsibility**: Re-export parseToolCall from atip-bridge for convenience.

**Rationale**: While atip-bridge already provides parseToolCall, re-exporting it allows atip-execute to be a complete solution for execution without requiring direct atip-bridge imports for common operations.

**Dependencies**:
- `atip-bridge` - parseToolCall function

### 2. Mapping Module (`src/mapping.ts`)

**Responsibility**: Map flattened tool names back to CLI command arrays.

**Rationale**: atip-bridge flattens nested commands (gh_pr_create) for LLM consumption. We need the inverse operation to reconstruct the CLI command. This is per spec section 8.2 Rule 3.

**Key Functions**:
- `mapToCommand(name, tools)` - Main mapping function
- `unflattenName(name, separator)` - Split flattened name into parts
- `findCommand(tool, path)` - Walk command tree to find leaf command
- `buildCommandArray(toolName, path)` - Construct ["gh", "pr", "create"]

**Implementation Notes**:
```typescript
// Flattened name: "gh_pr_create"
// Step 1: Split on separator -> ["gh", "pr", "create"]
// Step 2: First element is tool name -> "gh"
// Step 3: Remaining elements are command path -> ["pr", "create"]
// Step 4: Find tool in tools array by name
// Step 5: Walk command tree following path
// Step 6: Return mapping with resolved command
```

### 3. Validation Module (`src/validation.ts`)

**Responsibility**: Validate tool call arguments against ATIP metadata.

**Rationale**: Per spec section 11 (Security Considerations), agents MUST validate tool calls before execution. This module handles argument validation.

**Key Functions**:
- `validateToolCall(call, mapping)` - Validate arguments
- `validateArgument(value, schema)` - Check single argument
- `validateOption(value, schema)` - Check single option
- `coerceType(value, type)` - Safe type coercion
- `checkEnumValue(value, allowed)` - Enum validation

**Validation Rules**:
1. Required arguments must be present
2. Required options must be present
3. Types must match (with safe coercion)
4. Enum values must be in allowed list
5. Unknown parameters produce warnings (not errors)

### 4. Policy Module (`src/policy.ts`)

**Responsibility**: Enforce execution policies based on effects metadata.

**Rationale**: Effects metadata enables safe agent decisions. This module translates effects into actionable policy decisions per spec section 3.6.

**Key Functions**:
- `checkPolicy(call, mapping, policy)` - Main policy check
- `mergeEffects(command, tool)` - Merge command and tool-level effects
- `checkDestructive(effects, policy)` - Check destructive flag
- `checkTrustLevel(trust, minLevel)` - Compare trust levels
- `checkInteractive(effects, policy)` - Check interactive requirements

**Policy Enforcement**:
```typescript
// Effects to check (priority order):
// 1. destructive: true -> block or confirm
// 2. reversible: false -> warn or confirm
// 3. cost.billable: true -> check budget/confirm
// 4. interactive.stdin/prompts/tty -> may need PTY or skip
// 5. trust.source -> compare against minimum level
```

### 5. Command Builder Module (`src/command-builder.ts`)

**Responsibility**: Build CLI argument arrays from validated arguments.

**Rationale**: ATIP defines arguments and options with specific schemas. This module translates them to proper CLI syntax.

**Key Functions**:
- `buildCommandArray(mapping, args)` - Build complete command
- `buildArguments(args, schema)` - Handle positional arguments
- `buildOptions(args, schema)` - Handle flagged options
- `formatOptionFlag(option, value)` - Format --flag=value or --flag

**Argument Handling**:
```typescript
// Arguments (positional):
// - Added in order defined in schema
// - Variadic args become multiple values

// Options (flagged):
// - Boolean: --flag (true) or omitted (false)
// - String/number: --flag value or --flag=value
// - Variadic: --flag a --flag b --flag c

// Flag selection:
// - Prefer long form (--output) over short (-o)
// - Use first flag if multiple defined
```

### 6. Execution Module (`src/execution.ts`)

**Responsibility**: Execute CLI commands as subprocesses.

**Rationale**: Per spec section 6 (Execution Model), ATIP tools are executed directly via subprocess invocation.

**Key Functions**:
- `executeCommand(command, options)` - Main execution function
- `spawnWithTimeout(command, options)` - Spawn with timeout
- `captureOutput(process, limits)` - Capture stdout/stderr
- `handleTimeout(process, timeout)` - Kill on timeout

**Safety Measures**:
1. No shell by default (spawn without shell: true)
2. Timeout enforcement (default 30s, max 10min)
3. Output size limits (default 1MB, max 10MB)
4. Proper signal handling for cleanup
5. Working directory isolation

### 7. Formatting Module (`src/formatting.ts`)

**Responsibility**: Format execution results for LLM consumption.

**Rationale**: Per spec section 11.3, sensitive data must be filtered before returning to LLM.

**Key Functions**:
- `formatResult(result, options)` - Main formatter
- `filterSecrets(output, patterns)` - Redact secrets
- `truncateOutput(output, maxLength)` - Handle long output
- `combineStreams(stdout, stderr)` - Combine outputs
- `formatForProvider(provider, call, result)` - Provider-specific format

**Output Format**:
```
# For success:
<stdout>
[Exit code: 0]

# For failure:
<stderr>
<stdout>
[Exit code: 1]

# For timeout:
<partial stdout>
[TIMEOUT after 30s]

# For truncated:
<partial output>
[TRUNCATED - output exceeded 1MB]
```

### 8. Executor Module (`src/executor.ts`)

**Responsibility**: Orchestrate parsing, validation, policy, execution, and formatting.

**Rationale**: Provides a high-level API that combines all steps safely.

**Key Functions**:
- `createExecutor(config)` - Factory function
- `Executor.execute(call)` - Execute single tool call
- `Executor.executeBatch(calls)` - Execute multiple calls
- `Executor.validate(call)` - Validate without executing
- `Executor.checkPolicy(call)` - Check policy without executing

---

## Design Decisions

### Decision: Re-use parseToolCall from atip-bridge

**Context**: atip-bridge already implements parseToolCall for all three providers.

**Options Considered**:
1. **Duplicate implementation** - Copy code into atip-execute
2. **Re-export from atip-bridge** - Simple import and re-export
3. **Extend with execution context** - Wrap and add context

**Decision**: Re-export from atip-bridge (Option 2).

**Rationale**:
- DRY principle - no code duplication
- atip-bridge is already a dependency (for types)
- parseToolCall is stable and complete
- Users may already have atip-bridge, avoiding version conflicts

### Decision: Underscore as Default Separator

**Context**: atip-bridge flattens commands using underscores: `gh_pr_create`.

**Options Considered**:
1. **Fixed underscore** - Always use `_`
2. **Configurable separator** - Allow `_`, `.`, `-`
3. **Auto-detect** - Try multiple separators

**Decision**: Fixed underscore with optional override.

**Rationale**:
- Per spec section 8.2 Rule 3: "Strategy A: Discrete tools"
- atip-bridge uses underscore, must match
- Configurable option allows for non-standard usage
- Auto-detect is fragile and error-prone

### Decision: Effects Merging Strategy

**Context**: ATIP allows effects at both tool level and command level.

**Options Considered**:
1. **Command only** - Ignore tool-level effects
2. **Tool only** - Ignore command-level effects
3. **Merge with command priority** - Command overrides tool
4. **Merge conservatively** - Most restrictive wins

**Decision**: Merge conservatively (Option 4).

**Rationale**:
- Safety first - if either level declares destructive, treat as destructive
- Per CLAUDE.md: "Be conservative with effects declarations"
- Matches agent behavior expectation
- Prevents accidental unsafe operations

**Merging Rules**:
```typescript
// Boolean flags: OR semantics (true wins)
destructive: command.destructive || tool.destructive
network: command.network || tool.network

// Reversible/Idempotent: AND semantics (false wins)
reversible: command.reversible && tool.reversible
idempotent: command.idempotent && tool.idempotent

// Cost: MAX semantics (highest wins)
billable: command.cost?.billable || tool.cost?.billable
estimate: max(command.cost?.estimate, tool.cost?.estimate)

// Trust: use tool-level (not per-command)
trust: tool.trust
```

### Decision: Validation Before Execution

**Context**: Should validation be automatic or opt-in?

**Options Considered**:
1. **Always validate** - Executor.execute always validates first
2. **Opt-in validation** - Separate validate() and execute()
3. **Opt-out validation** - Validate by default, skip with flag

**Decision**: Always validate, with skip flag for advanced use.

**Rationale**:
- Per spec section 11: "Agents MUST validate tool calls before execution"
- Safe by default prevents accidental execution of invalid calls
- Skip flag allows performance optimization in trusted scenarios
- Matches BRGR safety-first philosophy

### Decision: Shell Execution Default

**Context**: Node child_process can spawn with or without shell.

**Options Considered**:
1. **Shell by default** - Use shell for familiar behavior
2. **No shell by default** - Direct spawn for safety
3. **Configurable** - Let user choose

**Decision**: No shell by default, configurable.

**Rationale**:
- Security: Shell introduces injection risks
- Predictability: No shell expansion of arguments
- Performance: Direct spawn is faster
- Per spec: "Agents execute tools directly via subprocess"
- Option available for tools requiring shell features

### Decision: Confirmation Handler Pattern

**Context**: Destructive operations may require user confirmation.

**Options Considered**:
1. **Always throw** - Let agent handle confirmation
2. **Callback handler** - Call async handler for decision
3. **Auto-confirm option** - Bypass confirmation in automation

**Decision**: Callback handler with throw fallback.

**Rationale**:
- Flexible: Agents can implement any confirmation UI
- Safe: Missing handler throws (doesn't auto-proceed)
- Testable: Handler can be mocked in tests
- Progressive: Simple use case works, complex supported

**Pattern**:
```typescript
const executor = createExecutor({
  policy: {
    allowDestructive: false,
    confirmationHandler: async (ctx) => {
      // Custom confirmation logic
      return await promptUser(ctx.reasons.join(', '));
    }
  }
});
```

### Decision: Output Truncation Strategy

**Context**: CLI tools can produce very large outputs.

**Options Considered**:
1. **Truncate at end** - Keep beginning, cut end
2. **Truncate at start** - Keep end (most recent)
3. **Smart truncation** - Keep start and end, cut middle
4. **No truncation** - Return everything, let LLM handle

**Decision**: Truncate at end with marker.

**Rationale**:
- LLMs process sequentially - beginning is most important
- Clear marker indicates truncation occurred
- Consistent behavior across all outputs
- Size limits prevent context overflow

**Implementation**:
```typescript
if (output.length > maxLength) {
  return output.slice(0, maxLength - 14) + '\n[TRUNCATED]';
}
```

### Decision: Error Type Hierarchy

**Context**: Many things can go wrong during execution.

**Options Considered**:
1. **Single error type** - All errors are ExecutionError
2. **Flat hierarchy** - Many specific error types
3. **Class hierarchy** - Base class with specific subclasses

**Decision**: Class hierarchy with specific subclasses.

**Rationale**:
- `instanceof` checks for error handling
- Specific errors carry relevant context
- Base class enables catch-all handling
- TypeScript discriminated unions work well

**Hierarchy**:
```
AtipExecuteError (base)
  +-- UnknownCommandError
  +-- ArgumentValidationError
  +-- PolicyViolationError
  +-- RequiresConfirmationError
  +-- InsufficientTrustError
  +-- ExecutionError
  +-- TimeoutError
  +-- InteractiveNotSupportedError
```

---

## Data Flow

### Execute Flow

```
ToolCall                      FormattedResult
    |                               ^
    v                               |
+-------------------+    +-------------------+
| 1. Map to Command |    | 6. Format Result  |
|    mapToCommand() |    |    formatResult() |
+--------+----------+    +--------+----------+
         |                        ^
         v                        |
+-------------------+    +-------------------+
| 2. Validate Args  |    | 5. Capture Output |
|    validateCall() |    |    captureOutput()|
+--------+----------+    +--------+----------+
         |                        ^
         v                        |
+-------------------+    +-------------------+
| 3. Check Policy   |    | 4. Execute        |
|    checkPolicy()  |--->|    spawnProcess() |
+-------------------+    +-------------------+
```

1. **Map to Command**: Convert flattened name to CLI command array
2. **Validate Args**: Check arguments against ATIP schema
3. **Check Policy**: Evaluate effects against execution policy
4. **Execute**: Spawn subprocess with timeout
5. **Capture Output**: Collect stdout/stderr with limits
6. **Format Result**: Filter secrets, truncate, format for LLM

### Validation Flow

```
ToolCall + Mapping           ValidationResult
    |                             ^
    v                             |
+-------------------+    +-------------------+
| Get Arguments     |    | Collect Results   |
| from ToolCall     |    | errors, warnings  |
+--------+----------+    +--------+----------+
         |                        ^
         v                        |
+-------------------+    +-------------------+
| Get Schema from   |    | Validate Each     |
| AtipCommand       |--->| Argument/Option   |
+-------------------+    +-------------------+
```

### Policy Check Flow

```
Mapping + Policy            PolicyCheckResult
    |                             ^
    v                             |
+-------------------+    +-------------------+
| Merge Effects     |    | Collect Results   |
| command + tool    |    | allowed, reasons  |
+--------+----------+    +--------+----------+
         |                        ^
         v                        |
+-------------------+    +-------------------+
| Check Each Effect |    | Determine if      |
| against Policy    |--->| Confirmation Req  |
+-------------------+    +-------------------+
```

---

## Error Handling Strategy

### Error Categories

| Category | Recovery | Examples |
|----------|----------|----------|
| **Validation** | Fix input | Missing required arg, wrong type |
| **Policy** | Change policy or confirm | Destructive blocked, trust too low |
| **Execution** | Retry or skip | Command not found, timeout |
| **System** | Report to user | Spawn failed, permission denied |

### Recovery Patterns

```typescript
// Validation errors - fix and retry
try {
  await executor.execute(call);
} catch (e) {
  if (e instanceof ArgumentValidationError) {
    // Show errors to user, ask for corrections
    console.error('Invalid arguments:', e.errors);
  }
}

// Policy errors - may be recoverable
try {
  await executor.execute(call);
} catch (e) {
  if (e instanceof RequiresConfirmationError) {
    // Ask user for confirmation
    if (await askUser(e.context.reasons)) {
      // Retry with confirmation handler that returns true
    }
  }
}

// Execution errors - log and continue
try {
  await executor.execute(call);
} catch (e) {
  if (e instanceof TimeoutError) {
    // Log timeout, maybe retry with longer timeout
    console.warn(`Command timed out after ${e.timeout}ms`);
  }
}
```

---

## Safety Considerations

### Pre-Execution Validation

Per spec section 11.2, validation MUST occur before execution:

1. **Argument Validation** - Prevents injection via malformed arguments
2. **Policy Validation** - Enforces safety boundaries
3. **Trust Validation** - Blocks untrusted tools

### Subprocess Security

1. **No Shell by Default** - Prevents shell injection
2. **Argument Array** - No shell parsing of arguments
3. **Environment Isolation** - Controlled env variables
4. **Working Directory** - Explicit cwd, no traversal
5. **Timeout Enforcement** - Prevents runaway processes

### Output Filtering

Per spec section 11.3, filter before returning to LLM:

1. **Secret Redaction** - Built-in patterns for common secrets
2. **Custom Patterns** - User-defined redaction rules
3. **Size Limits** - Prevent context overflow
4. **Error Sanitization** - Don't leak system paths in errors

### Trust Level Enforcement

Per spec section 3.2.2, trust affects execution policy:

| Source | Trust | Recommended Policy |
|--------|-------|-------------------|
| `native` | HIGH | Allow most operations |
| `vendor` | HIGH | Allow most operations |
| `org` | MEDIUM | Require confirmation for destructive |
| `community` | LOW | Block destructive, confirm others |
| `user` | LOW | Block destructive, confirm others |
| `inferred` | VERY LOW | Block all unsafe, confirm safe |

### Interactive Tool Handling

Per spec section 3.6 (interactive effects):

```typescript
// Check interactive effects before execution
if (effects.interactive?.stdin === 'required') {
  throw new InteractiveNotSupportedError(...)
}

if (effects.interactive?.tty) {
  // Option 1: Throw error
  // Option 2: Use PTY wrapper (advanced)
}

if (effects.interactive?.prompts) {
  // Try to use --yes, --force, -y flags
  // Or throw if not available
}
```

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `mapToCommand` | O(n * d) | n = tools, d = max depth |
| `validateToolCall` | O(a) | a = number of arguments |
| `checkPolicy` | O(1) | Fixed number of effect checks |
| `buildCommandArray` | O(a) | a = number of arguments |
| `executeCommand` | O(t) | t = command duration |
| `formatResult` | O(o * p) | o = output length, p = patterns |

### Memory Usage

- Executor caches flattened command map: O(n * d) where n = tools, d = commands
- Execution buffers output: O(maxOutputSize)
- No persistent state between executions

### Optimization Opportunities

1. **Command Map Caching** - Pre-build on executor creation
2. **Pattern Pre-compilation** - Compile regex patterns once
3. **Streaming Output** - Don't buffer entire output when streaming
4. **Parallel Batch Execution** - Run non-conflicting tools concurrently

---

## Future Extensions

### PTY Support

For tools requiring TTY:
- `createPtyExecutor(config)` - PTY-capable executor
- Handle prompts interactively
- Support for curses-based tools

### Streaming Execution

For long-running tools:
- `executor.executeStream(call)` - Returns AsyncIterable
- Real-time stdout/stderr streaming
- Progress reporting

### Sandbox Integration

For untrusted tools:
- Container-based isolation
- Filesystem sandboxing
- Network restrictions
- Resource limits

### Audit Logging

For compliance:
- Log all executions with arguments
- Track policy decisions
- Export audit trail

---

## Testing Strategy

### Unit Tests

Each module has corresponding test file:

```
src/
  mapping.ts       -> tests/unit/mapping.test.ts
  validation.ts    -> tests/unit/validation.test.ts
  policy.ts        -> tests/unit/policy.test.ts
  command-builder.ts -> tests/unit/command-builder.test.ts
  execution.ts     -> tests/unit/execution.test.ts
  formatting.ts    -> tests/unit/formatting.test.ts
  executor.ts      -> tests/unit/executor.test.ts
```

### Integration Tests

```
tests/integration/
  execute-gh.test.ts        -> Execute gh commands
  execute-git.test.ts       -> Execute git commands
  policy-enforcement.test.ts -> Test policy blocking
  error-handling.test.ts    -> Test error scenarios
```

### Test Coverage Requirements

Per CLAUDE.md:
- 80%+ coverage on core logic
- 100% coverage on safety-critical code (policy, validation)
- Integration tests use real ATIP examples from `examples/`

### Mocking Strategy

- Mock `child_process.spawn` for execution tests
- Mock atip-bridge functions minimally (they're stable)
- Use real ATIP metadata from examples/

---

## File Structure

```
reference/atip-execute/
+-- blue/
|   +-- api.md          # This API specification
|   +-- design.md       # This design document
|   +-- examples.md     # Usage examples
+-- src/
|   +-- index.ts        # Public exports
|   +-- types.ts        # Type definitions
|   +-- constants.ts    # Constants
|   +-- errors.ts       # Error classes
|   +-- parse.ts        # Re-export parseToolCall
|   +-- mapping.ts      # mapToCommand, unflatten
|   +-- validation.ts   # validateToolCall
|   +-- policy.ts       # checkPolicy
|   +-- command-builder.ts # buildCommandArray
|   +-- execution.ts    # executeCommand
|   +-- formatting.ts   # formatResult
|   +-- executor.ts     # createExecutor, Executor
+-- tests/
|   +-- unit/
|   |   +-- mapping.test.ts
|   |   +-- validation.test.ts
|   |   +-- policy.test.ts
|   |   +-- command-builder.test.ts
|   |   +-- execution.test.ts
|   |   +-- formatting.test.ts
|   |   +-- executor.test.ts
|   +-- integration/
|       +-- execute-gh.test.ts
|       +-- policy-enforcement.test.ts
+-- package.json
+-- tsconfig.json
+-- tsup.config.ts      # Build configuration
+-- vitest.config.ts    # Test configuration
+-- README.md
```

---

## Dependencies

### Runtime Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `atip-bridge` | Types, parseToolCall, handleToolResult | ^1.0.0 |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tsup` | Bundling |
| `vitest` | Testing |
| `@types/node` | Node.js types |

### Peer Dependencies

None - works with any Node.js version supporting child_process.
