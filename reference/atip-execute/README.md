# @atip/execute

Safe execution of LLM tool calls against CLI tools with ATIP metadata.

## Status

**RED Phase** - Tests written, implementation pending.

This package is currently in the RED phase of BRGR (Blue, Red, Green, Refactor) development:

- ✅ **Blue**: Design specifications complete (`blue/` directory)
- ✅ **Red**: Comprehensive failing tests written (`tests/` directory)
- ⏳ **Green**: Implementation pending
- ⏳ **Refactor**: Not started

## Overview

`@atip/execute` is a TypeScript library that safely executes LLM tool calls against CLI tools described by ATIP metadata. It bridges the gap between LLM provider responses (OpenAI, Gemini, Anthropic) and actual subprocess execution.

**Key features**:

- **Tool Call Parsing** - Extract tool calls from LLM responses (via atip-bridge)
- **Command Mapping** - Map flattened tool names back to CLI command arrays
- **Validation** - Validate arguments against ATIP schema
- **Policy Enforcement** - Block destructive operations, enforce trust levels
- **Safe Execution** - Subprocess execution with timeout and output limits
- **Result Formatting** - Filter secrets, truncate output, format for LLM

## Installation

```bash
npm install @atip/execute
```

## Usage

**Note**: Implementation is not yet complete. See `blue/examples.md` for planned usage.

### Basic Execution

```typescript
import { createExecutor } from '@atip/execute';
import ghTool from './atip/gh.json';

// Create executor with ATIP metadata
const executor = createExecutor({
  tools: [ghTool],
  policy: {
    allowDestructive: false,
    confirmationHandler: async (ctx) => {
      return await askUser(`Execute ${ctx.command.join(' ')}?`);
    },
  },
});

// Execute a tool call from LLM
const result = await executor.execute({
  id: 'call_123',
  name: 'gh_pr_list',
  arguments: { state: 'open' },
});

console.log(result.content);
```

### Policy Configuration

```typescript
const executor = createExecutor({
  tools: [ghTool],
  policy: {
    allowDestructive: false,     // Block destructive operations
    allowBillable: false,         // Block billable operations
    minTrustLevel: 'vendor',      // Require high trust
    allowInteractive: false,      // Block interactive commands
    maxCostEstimate: 'low',       // Limit cost
  },
});
```

### Batch Execution

```typescript
const results = await executor.executeBatch(toolCalls, {
  parallel: true,        // Execute in parallel
  maxConcurrency: 4,     // Limit concurrency
  continueOnError: true, // Don't stop on failures
});

console.log(`Executed ${results.successCount} of ${toolCalls.length}`);
```

## Documentation

- [API Specification](./blue/api.md) - Complete API documentation
- [Design Document](./blue/design.md) - Architecture and design decisions
- [Usage Examples](./blue/examples.md) - Comprehensive usage examples
- [Test Strategy](./tests/README.md) - Test organization and coverage goals

## Development

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests (will fail until implementation complete)
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### BRGR Workflow

This project follows BRGR methodology:

1. **Blue (Design)** ✅ - Specifications in `blue/` directory
2. **Red (Tests)** ✅ - Failing tests in `tests/` directory
3. **Green (Implement)** ⏳ - Write minimal code to pass tests
4. **Refactor** ⏳ - Improve code while keeping tests green

### Next Steps (GREEN Phase)

To implement:

1. Create `src/mapping.ts` - Command mapping logic
2. Create `src/validation.ts` - Argument validation
3. Create `src/command-builder.ts` - CLI command building
4. Create `src/policy.ts` - Policy enforcement
5. Create `src/execution.ts` - Subprocess execution
6. Create `src/formatting.ts` - Result formatting
7. Create `src/executor.ts` - Main executor class
8. Create `src/errors.ts` - Error classes
9. Update `src/index.ts` - Export all public APIs

Run `npm test` after each module to verify tests pass.

## Test Coverage

All tests are expected to fail initially (RED phase). Coverage goals:

- **Overall**: 80%+
- **Safety-critical code**: 100%
  - Policy enforcement
  - Argument validation
  - Effects merging
  - Trust level checking

See [tests/README.md](./tests/README.md) for detailed test strategy.

## Dependencies

- `atip-bridge` - For types and LLM provider integration

## Contributing

This package is part of the ATIP reference implementation. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT

## Related Packages

- [`atip-bridge`](../atip-bridge/) - Compile ATIP metadata to LLM formats
- [`atip-discover`](../atip-discover/) - Discover ATIP-compatible tools
- [`atip-validate`](../atip-validate/) - Validate ATIP metadata against schema
