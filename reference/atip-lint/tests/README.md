# atip-lint Test Suite

This directory contains the comprehensive test suite for atip-lint, created following the BRGR (Blue, Red, Green, Refactor) methodology.

## Test Organization

```
tests/
├── unit/                      # Unit tests for individual modules
│   ├── rules/                 # Rule-specific tests
│   │   ├── quality/
│   │   │   ├── no-empty-effects.test.ts
│   │   │   ├── description-quality.test.ts
│   │   │   └── no-missing-required-fields.test.ts
│   │   ├── consistency/
│   │   │   ├── consistent-naming.test.ts
│   │   │   ├── no-duplicate-flags.test.ts
│   │   │   └── valid-effects-values.test.ts
│   │   ├── security/
│   │   │   ├── destructive-needs-reversible.test.ts
│   │   │   └── billable-needs-confirmation.test.ts
│   │   ├── executable/
│   │   │   ├── binary-exists.test.ts
│   │   │   └── agent-flag-works.test.ts
│   │   └── trust/
│   │       └── trust-source-requirements.test.ts
│   ├── linter.test.ts         # Core linter functionality
│   ├── config.test.ts         # Configuration loading and merging
│   ├── fixer.test.ts          # Fix application logic
│   ├── formatters.test.ts     # Output formatters
│   └── ast.test.ts            # JSON AST parsing and location mapping
├── integration/               # End-to-end integration tests
│   ├── cli.test.ts            # CLI invocation and exit codes
│   └── examples.test.ts       # Lint real ATIP examples
└── fixtures/                  # Test fixtures
    ├── valid/                 # Valid ATIP files
    ├── invalid/               # Files with specific violations
    └── fixable/               # Files with auto-fixable issues
```

## Test Strategy

### Unit Tests

Unit tests validate individual rules and core modules in isolation. Each rule has:

1. **Trigger tests**: Verify the rule detects violations
2. **Pass tests**: Verify valid cases don't trigger the rule
3. **Option tests**: Verify configurable options work correctly
4. **Fix tests**: Verify auto-fix functionality (if applicable)
5. **Edge case tests**: Nested commands, global options, etc.

**Coverage goals:**
- 100% coverage on rule implementations
- 100% coverage on safety-critical code (effects validation)
- 80%+ coverage on core linter logic

### Integration Tests

Integration tests validate end-to-end workflows:

- **CLI tests**: Command-line invocation, exit codes, output formats
- **Example tests**: Lint real ATIP files from `examples/` directory
- **Workflow tests**: Complete user scenarios (lint → fix → verify)

### Test Fixtures

Fixtures are organized by expected behavior:

- `valid/`: Files that should pass all checks
- `invalid/`: Files with specific rule violations (named after the rule)
- `fixable/`: Files with auto-fixable issues

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (fast)
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## RED Phase Validation

This test suite was created during the RED phase of BRGR. All tests are designed to:

1. **Fail initially**: Tests import from `src/` but implementations throw "Not implemented"
2. **Test the specification**: Tests validate API contracts from `blue/api.md`
3. **Cover all workflows**: Tests include examples from `blue/examples.md`
4. **Validate architecture**: Tests follow the structure from `blue/design.md`

### Expected Failures

When run before GREEN phase implementation, tests fail with:

```
Error: Not implemented
    at createLinter (src/linter/index.ts:2:9)
    at test/unit/linter.test.ts:8:21
```

This is **correct** - it validates that tests actually test something.

## GREEN Phase Goals

Once implementation is complete, all tests should pass with:

```bash
npm test

# Expected output:
# ✓ tests/unit/rules/quality/no-empty-effects.test.ts (15 tests)
# ✓ tests/unit/rules/quality/description-quality.test.ts (12 tests)
# ✓ tests/unit/linter.test.ts (18 tests)
# ✓ tests/integration/cli.test.ts (25 tests)
# ✓ tests/integration/examples.test.ts (10 tests)
#
# Test Files  45 passed (45)
#      Tests  180 passed (180)
#   Duration  2.5s
```

## Coverage Thresholds

Configured in `vitest.config.ts`:

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Functions | 80% |
| Branches | 80% |
| Statements | 80% |

Safety-critical code (effects handling, rule execution) should have 100% coverage.

## Test Patterns

### Rule Test Pattern

```typescript
describe('rule-name', () => {
  describe('basic check', () => {
    test('should trigger on violation', async () => {
      const linter = createLinter({
        rules: { 'rule-name': 'error' }
      });
      const result = await linter.lintText(invalidSource);
      expect(result.errorCount).toBe(1);
    });

    test('should pass on valid input', async () => {
      const linter = createLinter({
        rules: { 'rule-name': 'error' }
      });
      const result = await linter.lintText(validSource);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('options', () => {
    test('should respect rule options', async () => {
      // Test configurable behavior
    });
  });

  describe('auto-fix', () => {
    test('should fix issue', async () => {
      const result = await linter.lintText(source, { fix: true });
      expect(result.output).toContain('fixed-content');
    });
  });
});
```

### Integration Test Pattern

```typescript
describe('workflow', () => {
  test('should complete user workflow', async () => {
    // 1. Lint file
    const lintResult = await linter.lintFile('test.json');
    expect(lintResult.warningCount).toBeGreaterThan(0);

    // 2. Apply fixes
    const fixResult = await linter.lintFile('test.json', { fix: true });
    expect(fixResult.fixableWarningCount).toBe(0);

    // 3. Verify clean
    const verifyResult = await linter.lintFile('test.json');
    expect(verifyResult.warningCount).toBe(0);
  });
});
```

## Debugging Tests

### View detailed output

```bash
npm test -- --reporter=verbose
```

### Run specific test file

```bash
npm test -- tests/unit/rules/quality/no-empty-effects.test.ts
```

### Run specific test

```bash
npm test -- -t "should error when command has no effects"
```

## Contributing Tests

When adding new rules:

1. Create test file in appropriate category under `tests/unit/rules/`
2. Add fixture files in `tests/fixtures/invalid/` and `tests/fixtures/fixable/`
3. Follow the rule test pattern above
4. Ensure 100% coverage of the new rule
5. Add integration test if rule affects CLI behavior

## CI/CD Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests (GitHub Actions)
- Main branch merges

Required checks:
- All tests pass
- Coverage thresholds met
- No TypeScript errors

## Related Documentation

- [Blue Phase Specification](../blue/api.md)
- [Design Document](../blue/design.md)
- [Usage Examples](../blue/examples.md)
- [Main README](../README.md)
