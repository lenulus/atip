# atip-execute Test Suite

This directory contains comprehensive tests for the `@atip/execute` library, following the BRGR (Blue, Red, Green, Refactor) methodology. These tests were written during the **RED phase** and are designed to fail until the implementation is complete.

## Test Organization

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── mapping.test.ts      # Command mapping tests
│   ├── validation.test.ts   # Argument validation tests
│   ├── command-builder.test.ts # CLI command building tests
│   ├── policy.test.ts       # Policy enforcement tests
│   ├── execution.test.ts    # Subprocess execution tests
│   ├── formatting.test.ts   # Result formatting tests
│   ├── executor.test.ts     # Executor integration tests
│   └── errors.test.ts       # Error type tests
├── integration/             # End-to-end integration tests
│   └── full-flow.test.ts    # Complete execution workflow tests
└── README.md               # This file
```

## Test Coverage Goals

Per CLAUDE.md requirements:

- **Overall coverage**: 80%+ on core logic
- **Safety-critical code**: 100% coverage on:
  - Policy enforcement (`src/policy.ts`)
  - Argument validation (`src/validation.ts`)
  - Effects merging
  - Trust level checking
- **Integration tests**: Use real ATIP examples from `examples/gh.json`

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Suites

### Unit Tests

#### 1. mapping.test.ts

**Purpose**: Test command mapping from flattened names to CLI arrays.

**Key test cases**:
- Basic mapping: `gh_pr_create` → `["gh", "pr", "create"]`
- Nested command resolution
- Effects merging (command + tool level)
- Custom separator support
- Multiple tool searching
- Edge cases (empty tools, root commands, deep nesting)

**Coverage targets**: 100% of `src/mapping.ts`

#### 2. validation.test.ts

**Purpose**: Test argument validation against ATIP schemas.

**Key test cases**:
- Required parameter checking
- Type validation (string, integer, boolean, enum, array)
- Type coercion (safe conversions)
- Enum value validation
- Unknown parameter warnings
- Normalized argument output

**Coverage targets**: 100% of `src/validation.ts` (safety-critical)

#### 3. command-builder.test.ts

**Purpose**: Test building CLI command arrays from validated arguments.

**Key test cases**:
- String options with flags
- Boolean flags (present when true, omitted when false)
- Variadic options (repeated flags)
- Positional arguments
- Flag selection (long vs short form)
- Special character escaping
- Argument ordering

**Coverage targets**: 90%+ of `src/command-builder.ts`

#### 4. policy.test.ts

**Purpose**: Test execution policy enforcement.

**Key test cases**:
- Destructive operation blocking
- Trust level enforcement
- Billable operation checks
- Confirmation handler invocation
- Interactive command blocking
- Network restrictions
- Multiple policy violations
- Confirmation context

**Coverage targets**: 100% of `src/policy.ts` (safety-critical)

#### 5. execution.test.ts

**Purpose**: Test subprocess execution functionality.

**Key test cases**:
- Successful execution capture
- Exit code handling
- Timeout enforcement
- Output size limits
- Stderr capture
- Working directory and environment
- Streaming support
- Shell execution

**Coverage targets**: 80%+ of `src/execution.ts`

#### 6. formatting.test.ts

**Purpose**: Test result formatting for LLM consumption.

**Key test cases**:
- Basic formatting
- Secret redaction (tokens, API keys, Bearer tokens)
- Output truncation
- Exit code inclusion
- Error formatting (failures, timeouts)
- Custom formatters
- Combined filters

**Coverage targets**: 90%+ of `src/formatting.ts`

#### 7. executor.test.ts

**Purpose**: Test the high-level Executor API.

**Key test cases**:
- Executor creation and configuration
- `execute()` single tool call
- `executeBatch()` multiple calls
- `validate()` without execution
- `checkPolicy()` without execution
- `mapCommand()` lookup
- Configuration defaults

**Coverage targets**: 90%+ of `src/executor.ts`

#### 8. errors.test.ts

**Purpose**: Test error class hierarchy and properties.

**Key test cases**:
- Base AtipExecuteError
- All specific error types
- Error codes
- Error context preservation
- instanceof checks
- Error handling patterns

**Coverage targets**: 100% of `src/errors.ts`

### Integration Tests

#### full-flow.test.ts

**Purpose**: Test complete end-to-end execution workflows.

**Key test cases**:
- Parse → Map → Validate → Execute → Format flow
- Real ATIP metadata from `examples/gh.json`
- Safe read operations (gh auth status)
- Batch execution
- Policy enforcement integration
- Output formatting integration
- Error handling integration
- Real-world scenarios
- Performance characteristics

**Dependencies**: Requires real `examples/gh.json` file

## Expected Test Failures

All tests are expected to fail initially because:

1. **Implementation doesn't exist**: `src/` modules are placeholders that throw "Not implemented"
2. **This validates tests**: Failing tests prove they actually test something
3. **RED phase requirement**: Per BRGR, tests must fail before implementation

## Test Patterns

### Vitest Usage

All tests use vitest with:
- `describe()` for grouping
- `it()` for individual test cases
- `expect()` for assertions
- `vi.fn()` for mocks (policy tests)

### Mock Strategy

- **Minimal mocking**: Use real implementations where possible
- **Subprocess mocking**: Unit tests mock `child_process.spawn`
- **Integration tests**: Use real subprocesses with safe commands (`echo`, `sh -c`)
- **atip-bridge**: Re-exported functions tested via integration

### Test Data

- **Real ATIP examples**: Use `examples/gh.json` for integration tests
- **Inline fixtures**: Small test tools defined in test files
- **Safe commands**: Only safe, idempotent operations in integration tests

## Validation Criteria

Before moving to GREEN phase, ensure:

- [ ] All tests are written and fail with clear error messages
- [ ] Tests cover all API contracts from `blue/api.md`
- [ ] Tests cover all workflows from `blue/design.md`
- [ ] Tests use real ATIP examples
- [ ] No implementation code exists yet
- [ ] Coverage goals are documented
- [ ] Test README explains strategy

## Test Execution During GREEN Phase

When implementation begins:

1. **Run tests frequently**: `npm run test:watch`
2. **Fix one test at a time**: Start with mapping, then validation, etc.
3. **Monitor coverage**: `npm run test:coverage`
4. **All tests must pass**: Before moving to next module
5. **No skipping tests**: If test fails, fix implementation or test

## Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
thresholds: {
  lines: 80,
  functions: 80,
  branches: 80,
  statements: 80,
}
```

Safety-critical modules should achieve 100%.

## Contributing

When adding new tests:

1. Follow existing patterns
2. Use descriptive test names: "should [expected behavior] when [condition]"
3. Group related tests with `describe()`
4. Test happy paths, edge cases, and errors
5. Update this README if adding new test files

## Resources

- [CLAUDE.md](../../../CLAUDE.md) - Project development guidelines
- [api.md](../blue/api.md) - API specification
- [design.md](../blue/design.md) - Architecture decisions
- [examples.md](../blue/examples.md) - Usage examples
- [spec/rfc.md](../../../spec/rfc.md) - ATIP protocol specification
