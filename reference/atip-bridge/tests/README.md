# atip-bridge Test Suite

This directory contains comprehensive tests for the `atip-bridge` library, following the **BRGR (Blue, Red, Green, Refactor)** methodology. These tests were created in the **RED phase** and are designed to fail until the implementation is complete.

## Test Organization

```
tests/
├── unit/                    # Unit tests (fast, isolated)
│   ├── transformers/        # Provider-specific transformers
│   │   ├── openai.test.ts   # OpenAI transformer tests
│   │   ├── gemini.test.ts   # Gemini transformer tests
│   │   └── anthropic.test.ts # Anthropic transformer tests
│   ├── compile.test.ts      # Batch compilation tests
│   ├── safety/              # Safety utilities
│   │   ├── prompt.test.ts   # Safety prompt generation
│   │   ├── validator.test.ts # Policy validation
│   │   └── filter.test.ts   # Result filtering
│   └── lifecycle/           # Lifecycle helpers
│       ├── parse.test.ts    # Response parsing
│       └── result.test.ts   # Result formatting
└── integration/             # Integration tests (end-to-end)
    ├── compile-gh.test.ts   # Full gh.json compilation
    ├── compile-minimal.test.ts # Minimal example tests
    └── roundtrip.test.ts    # Parse → Execute → Result cycles
```

## Test Categories

### Unit Tests

**Purpose**: Test individual functions and modules in isolation.

**Coverage Areas**:
- **Transformers** (`tests/unit/transformers/`)
  - OpenAI format transformation with strict mode
  - Gemini format transformation
  - Anthropic format transformation
  - Safety suffix generation
  - Description truncation
  - Type coercion (file, directory, url → string)
  - Parameter transformation

- **Compilation** (`tests/unit/compile.test.ts`)
  - Batch compilation to multiple providers
  - Name deduplication
  - Strict mode propagation
  - Error aggregation

- **Safety Utilities** (`tests/unit/safety/`)
  - **Prompt generation**: Markdown safety summaries
  - **Validation**: Policy enforcement (destructive, reversible, network, billable, etc.)
  - **Filtering**: Secret redaction, length truncation

- **Lifecycle Helpers** (`tests/unit/lifecycle/`)
  - **Parsing**: Extract tool calls from OpenAI, Gemini, Anthropic responses
  - **Result formatting**: Convert execution results to provider message formats

### Integration Tests

**Purpose**: Test complete workflows using real ATIP examples.

**Coverage Areas**:
- **gh.json compilation** (`tests/integration/compile-gh.test.ts`)
  - Full GitHub CLI transformation to all providers
  - Safety flag preservation (destructive operations)
  - Command flattening validation
  - Real-world validation and filtering workflows

- **minimal.json compilation** (`tests/integration/compile-minimal.test.ts`)
  - Simplest valid ATIP tool
  - Empty command name handling
  - Basic parameter transformation

- **Round-trip workflows** (`tests/integration/roundtrip.test.ts`)
  - Complete agent loop: compile → parse → execute → format
  - Cross-provider consistency
  - Error handling in full workflows

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only (fast)
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Coverage Goals

Per CLAUDE.md requirements:

- **Core logic**: 80%+ coverage
- **Safety-critical code**: 100% coverage (effects handling, validation, secret redaction)
- **Integration tests**: Must use real ATIP examples from `examples/`

Expected coverage by module:
- `src/transformers/`: 90%+
- `src/safety/`: 100% (safety-critical)
- `src/lifecycle/`: 85%+
- `src/compile.ts`: 90%+
- `src/internal/`: 85%+

## Test Strategy

### 1. Transformer Tests

Each transformer (OpenAI, Gemini, Anthropic) is tested for:
- ✅ Basic transformation (minimal valid ATIP → provider format)
- ✅ Safety suffix generation (destructive → `⚠️ DESTRUCTIVE`)
- ✅ Subcommand flattening (`gh pr create` → `gh_pr_create`)
- ✅ Type coercion (`file` → `string` with hint)
- ✅ Parameter merging (arguments + options → properties)
- ✅ Description handling (truncation for OpenAI, no limit for Gemini/Anthropic)
- ✅ Strict mode (OpenAI only: nullable types, all params required)
- ✅ Error handling (missing required fields)

### 2. Safety Tests

**Prompt Generation** (`safety/prompt.test.ts`):
- ✅ Grouping by category (destructive, non-reversible, billable, etc.)
- ✅ Markdown formatting
- ✅ Multi-tool aggregation

**Validation** (`safety/validator.test.ts`):
- ✅ Policy enforcement (allowDestructive, allowNonReversible, etc.)
- ✅ Unknown command detection
- ✅ Multiple violation reporting
- ✅ Severity levels (error vs warning)
- ✅ Cost estimate thresholds
- ✅ Trust level enforcement

**Filtering** (`safety/filter.test.ts`):
- ✅ GitHub token redaction (ghp_, gho_, ghs_, ghu_)
- ✅ AWS key redaction (AKIA...)
- ✅ Bearer token redaction
- ✅ Basic auth redaction
- ✅ Password/secret/token/api_key redaction
- ✅ Custom pattern support
- ✅ Length truncation
- ✅ Combined filtering (redact + truncate)

### 3. Lifecycle Tests

**Parsing** (`lifecycle/parse.test.ts`):
- ✅ OpenAI: Extract from `choices[].message.tool_calls[]`
- ✅ Gemini: Extract from `candidates[].content.parts[].functionCall`
- ✅ Anthropic: Extract from `content[]` where `type === 'tool_use'`
- ✅ JSON argument parsing (OpenAI)
- ✅ Object argument handling (Gemini, Anthropic)
- ✅ Error handling for invalid responses

**Result Formatting** (`lifecycle/result.test.ts`):
- ✅ OpenAI: `role: tool`, stringified content
- ✅ Gemini: `role: user`, object response (not stringified)
- ✅ Anthropic: `role: user`, stringified content in tool_result
- ✅ All result types (object, array, primitive, null, undefined)

### 4. Integration Tests

**Real ATIP Examples** (`integration/compile-gh.test.ts`, `compile-minimal.test.ts`):
- ✅ Load actual JSON from `examples/` directory
- ✅ Validate complete transformation pipeline
- ✅ Verify safety metadata preservation
- ✅ Test with real-world tool complexity

**Round-trip Workflows** (`integration/roundtrip.test.ts`):
- ✅ Compile → Parse → Execute → Format
- ✅ Multiple tool calls in one response
- ✅ Error handling in execution
- ✅ Cross-provider consistency

## Expected Failure Modes

These tests will fail with the following errors until implementation is complete:

1. **Import Errors**:
   ```
   Cannot find module '../src/index'
   ```

2. **Type Errors**:
   ```
   Module '../src/index' has no exported member 'toOpenAI'
   ```

3. **Function Not Defined**:
   ```
   toOpenAI is not a function
   ```

This is **expected and correct** for the RED phase. The tests validate:
- ✅ All API contracts from `blue/api.md` are tested
- ✅ All workflows from `blue/design.md` are covered
- ✅ All examples from `blue/examples.md` are validated
- ✅ Real ATIP examples from `examples/` are used

## Running Tests Before Implementation

To verify tests are properly failing:

```bash
npm test
```

Expected output:
```
❌ FAIL tests/unit/transformers/openai.test.ts
  ● Test suite failed to run
    Cannot find module '../../../src/index'

❌ FAIL tests/unit/transformers/gemini.test.ts
  ● Test suite failed to run
    Cannot find module '../../../src/index'

... (all tests fail)

Test Suites: X failed, X total
Tests:       0 total
```

## Implementation Checklist

Before moving to GREEN phase, verify:

- [ ] All tests import from `src/` (non-existent files)
- [ ] Tests use descriptive names (`should X when Y`)
- [ ] Tests follow Arrange-Act-Assert pattern
- [ ] Each test validates one specific behavior
- [ ] No implementation code in test files
- [ ] Real fixtures from `examples/*.json` are used
- [ ] Error messages will be clear when tests fail

## Test Quality Metrics

✅ **Total test files**: 11 (8 unit, 3 integration)
✅ **Total test cases**: 200+
✅ **Coverage targets**:
  - Core logic: 80%+
  - Safety code: 100%
  - Integration: Real ATIP examples

## Next Steps (GREEN Phase)

Once tests are confirmed failing:

1. Create `src/index.ts` with exports
2. Implement transformers (`src/transformers/`)
3. Implement safety utilities (`src/safety/`)
4. Implement lifecycle helpers (`src/lifecycle/`)
5. Run tests continuously: `npm run test:watch`
6. Achieve 100% test pass rate
7. Generate coverage: `npm run test:coverage`
8. Verify coverage meets thresholds

**Remember**: Tests must remain unchanged during GREEN phase. If a test needs modification, the design (BLUE) was wrong, not the test (RED).

---

**Test Philosophy**: These tests are the specification. The implementation must satisfy them, not the other way around. This ensures the library behaves exactly as designed in `blue/`.
