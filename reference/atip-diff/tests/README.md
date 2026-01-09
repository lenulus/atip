# Test Suite for atip-diff

This directory contains comprehensive tests for the RED phase of atip-diff following the BRGR methodology.

## Test Structure

```
tests/
├── unit/                   # Unit tests for individual modules
│   ├── comparator.test.ts      # Deep comparison logic tests
│   ├── categorizer.test.ts     # Change categorization tests
│   ├── semver.test.ts          # Semver recommendation tests
│   ├── normalizer.test.ts      # ATIP normalization tests
│   └── formatters.test.ts      # Output formatting tests
├── integration/            # End-to-end integration tests
│   ├── cli.test.ts             # CLI command tests
│   └── diff-scenarios.test.ts  # Real ATIP diff scenarios
├── fixtures/               # Test fixtures
│   ├── base/                   # Base ATIP files
│   ├── breaking/               # Breaking change examples
│   ├── non-breaking/           # Non-breaking change examples
│   ├── effects/                # Effects change examples
│   └── complex/                # Multi-change scenarios
└── README.md               # This file
```

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

# Generate coverage report
npm test -- --coverage
```

## Test Coverage Goals

Per CLAUDE.md requirements:

- **80%+ coverage** on core logic (comparator, categorizer, semver)
- **100% coverage** on categorization rules (breaking-rules, effects-rules)
- Integration tests use real ATIP examples from `examples/`

## Test Strategy

### Unit Tests

Each module has corresponding unit tests that validate:

1. **comparator.test.ts**
   - Deep comparison of ATIP metadata structures
   - Command, argument, option comparison
   - Effects comparison with severity detection
   - Path tracking through nested structures

2. **categorizer.test.ts**
   - Correct categorization of all change types
   - Breaking vs non-breaking vs effects classification
   - Severity calculation for effects changes
   - Edge cases and boundary conditions

3. **semver.test.ts**
   - Semver bump recommendations based on changes
   - Hierarchical bump logic (breaking > non-breaking > effects)
   - Severity-based effects recommendations

4. **normalizer.test.ts**
   - Argument normalization (required defaults to true)
   - Option normalization (required defaults to false)
   - Effects normalization (interactive field defaults)
   - Full metadata normalization

5. **formatters.test.ts**
   - Summary format output
   - JSON format output
   - Markdown format output
   - Format options (color, verbose, etc.)

### Integration Tests

1. **cli.test.ts**
   - All CLI commands (diff, stdin, --agent)
   - All CLI flags (--output, --breaking-only, --effects-only, etc.)
   - Exit codes (0 for success, 1 for breaking with --fail-on-breaking, 2 for errors)
   - Error handling (missing files, invalid JSON, schema validation)

2. **diff-scenarios.test.ts**
   - Real-world diff scenarios using test fixtures
   - Breaking change detection
   - Non-breaking change detection
   - Effects change detection with severity
   - Complex multi-change scenarios
   - Semver recommendation validation
   - Real ATIP examples from `examples/` directory

## Test Fixtures

### Base Fixtures

- `base/minimal.json` - Minimal valid ATIP metadata
- `base/complete.json` - Complete ATIP with all features

### Breaking Change Fixtures

- `breaking/command-removed.json` - Command removed from complete.json
- `breaking/required-arg-added.json` - Required argument added to minimal.json
- `breaking/type-stricter.json` - Type changed from broader to stricter

### Non-Breaking Change Fixtures

- `non-breaking/command-added.json` - New command added to complete.json
- `non-breaking/optional-arg-added.json` - Optional argument added to minimal.json

### Effects Change Fixtures

- `effects/destructive-added.json` - Destructive and reversible flags changed

### Complex Fixtures

- `complex/multi-change.json` - Multiple breaking, non-breaking, and effects changes

## Expected Test Failures

**CRITICAL**: All tests MUST fail initially because:

1. Import statements reference non-existent implementation files:
   - `../../src/comparator/comparator`
   - `../../src/categorizer/categorizer`
   - `../../src/semver/semver`
   - `../../src/loader/normalizer`
   - `../../src/output/formatters`
   - `../../src/diff`
   - `../../src/types`

2. These modules don't exist yet - they will be created in the GREEN phase

3. Running `npm test` should produce errors like:
   ```
   Error: Cannot find module '../../src/comparator/comparator'
   ```

This validates that the tests actually test something and aren't false positives.

## Test Categories Validated

### Breaking Changes (from api.md)

- Command removed
- Required argument added
- Required option added
- Type made stricter (e.g., string → enum)
- Enum values removed
- Argument removed
- Option removed
- Option flags changed
- Argument made required
- Option made required

### Non-Breaking Changes

- Command added
- Optional argument added
- Optional option added
- Type relaxed (e.g., enum → string)
- Enum values added
- Description changed
- Default value changed
- Examples changed
- Argument made optional
- Option made optional
- Homepage changed
- Version changed

### Effects Changes with Severity

**High Severity:**
- destructive: false → true
- cost.billable: false → true

**Medium Severity:**
- reversible: changed
- idempotent: changed
- interactive.stdin: changed
- interactive.prompts: changed
- filesystem.write: changed
- filesystem.delete: changed

**Low Severity:**
- network: changed
- duration.typical: changed
- duration.timeout: changed

## Verification Checklist

Before completing RED phase, verify:

- [ ] All API contracts from api.md have corresponding tests
- [ ] All workflows from design.md have integration tests
- [ ] Tests use real examples/*.json as fixtures
- [ ] Test framework is properly configured (vitest.config.ts)
- [ ] Tests will fail with clear error messages
- [ ] No implementation code was written
- [ ] Coverage goals are documented (80%+ core, 100% categorization)
- [ ] Test README explains strategy

## Next Steps

Once GREEN phase implementation is complete:

1. Run tests and verify they all pass
2. Check coverage meets 80%+ threshold
3. Ensure all change types are detected correctly
4. Validate semver recommendations match expectations
5. Confirm output formats are correct

## Notes

- Tests follow the design in `blue/` directory (api.md, design.md, examples.md)
- All test fixtures are valid ATIP 0.6 metadata
- Integration tests validate against real ATIP examples from repository
- CLI tests verify exit codes and error handling
- Tests are structured for maintainability and clarity
