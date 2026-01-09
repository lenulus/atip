# Testing Documentation for atip-diff

## RED Phase: Comprehensive Failing Test Suite

This document provides a complete overview of the test suite created for the RED phase of atip-diff following BRGR methodology.

## Test File Summary

### Unit Tests (9 files, 100+ test cases)

#### 1. `tests/unit/comparator.test.ts`
**Purpose**: Test deep comparison logic for ATIP metadata structures

**Coverage**:
- Metadata comparison (version, description, homepage)
- Command comparison (addition, removal, recursion into nested commands)
- Argument comparison (required/optional, addition/removal)
- Option comparison (flags changed, required/optional)
- Effects comparison (destructive, reversible, cost, network)

**Key Test Cases**:
- Detect no changes when metadata is identical
- Detect command removal (breaking)
- Detect command addition (non-breaking)
- Detect required argument added (breaking)
- Detect optional argument added (non-breaking)
- Detect destructive flag added (effects, high severity)
- Detect cost.billable changed (effects, high severity)
- Recurse into nested command structures

#### 2. `tests/unit/categorizer.test.ts`
**Purpose**: Test change categorization logic (breaking/non-breaking/effects)

**Coverage**:
- All breaking change types (10+)
- All non-breaking change types (10+)
- All effects change types (9+)
- Severity calculation for effects changes

**Key Test Cases**:
- Categorize command-removed as breaking
- Categorize command-added as non-breaking
- Categorize type-made-stricter as breaking
- Categorize type-relaxed as non-breaking
- Categorize destructive-added as effects with high severity
- Categorize network-changed as effects with low severity

#### 3. `tests/unit/semver.test.ts`
**Purpose**: Test semantic version bump recommendations

**Coverage**:
- Major bump for breaking changes
- Minor bump for non-breaking additions
- Minor bump for high-severity effects
- Patch bump for low-severity effects
- None for no changes
- Prioritization logic (breaking > non-breaking > effects)

**Key Test Cases**:
- Recommend major for breaking changes
- Recommend minor for non-breaking changes
- Recommend minor for high-severity effects
- Recommend patch for low-severity effects only
- Recommend none for no changes
- Prioritize breaking over non-breaking

#### 4. `tests/unit/normalizer.test.ts`
**Purpose**: Test ATIP metadata normalization

**Coverage**:
- Argument normalization (required defaults to true)
- Option normalization (required defaults to false)
- Effects normalization (interactive field defaults)
- Full metadata normalization

**Key Test Cases**:
- Set required=true by default for arguments
- Set required=false by default for options
- Set variadic=false by default
- Normalize interactive field in effects
- Preserve explicit values

#### 5. `tests/unit/formatters.test.ts`
**Purpose**: Test output formatting (summary, JSON, markdown)

**Coverage**:
- Summary format with breaking/non-breaking/effects sections
- JSON format with pretty/minified options
- Markdown format for changelogs
- Format options (color, verbose, includeHeader)

**Key Test Cases**:
- Format summary with breaking changes section
- Format summary with effects changes section
- Include semver recommendation in output
- Format as valid JSON
- Pretty print vs minified JSON
- Markdown with headers and warnings
- Handle empty results (no changes)

#### 6. `tests/unit/type-checker.test.ts`
**Purpose**: Test type widening/narrowing detection

**Coverage**:
- Type relaxation detection (enum → string, integer → number)
- Type restriction detection (string → enum, number → integer)
- Type comparison logic
- Edge cases (undefined, null, unrelated types)

**Key Test Cases**:
- Detect enum → string as relaxed
- Detect string → enum as stricter
- Detect integer → number as relaxed
- Detect number → integer as stricter
- Handle same type (unchanged)
- Handle unrelated types (changed)

#### 7. `tests/unit/differ.test.ts`
**Purpose**: Test Differ class and factory function

**Coverage**:
- createDiffer factory function
- diff() method
- diffFiles() method
- diffStrings() method
- getRecommendedBump() method
- filterByCategory() method
- hasBreakingChanges() method
- Configuration options (ignoreVersion, ignoreDescription, breakingOnly, effectsOnly)

**Key Test Cases**:
- Create differ instance
- Diff two metadata objects
- Diff from files
- Diff from JSON strings
- Filter by category (breaking, non-breaking, effects)
- Check for breaking changes
- Apply configuration options

### Integration Tests (2 files, 50+ test cases)

#### 8. `tests/integration/cli.test.ts`
**Purpose**: Test CLI commands and flags end-to-end

**Coverage**:
- diff command
- stdin command
- --agent flag (dogfooding)
- All output formats (--output json/markdown/summary)
- All filters (--breaking-only, --effects-only)
- All flags (--fail-on-breaking, --semver, --quiet, --verbose, --ignore-version)
- Error handling (missing files, invalid JSON, schema validation)
- Exit codes (0, 1, 2)

**Key Test Cases**:
- Execute diff command successfully
- Detect breaking changes
- Output JSON format
- Output markdown format
- Filter with --breaking-only
- Exit with code 1 when --fail-on-breaking
- Output semver recommendation with --semver
- Handle --quiet flag (suppress output)
- Handle --verbose flag (detailed output)
- Read from stdin
- Output ATIP metadata for atip-diff itself (--agent)
- Error on missing file (exit code 2)
- Error on invalid JSON (exit code 2)
- Error on schema validation failure (exit code 2)

#### 9. `tests/integration/diff-scenarios.test.ts`
**Purpose**: Test real-world diff scenarios using fixtures

**Coverage**:
- Breaking change scenarios (command removed, required arg added, type stricter)
- Non-breaking change scenarios (command added, optional arg added, description changed)
- Effects change scenarios (destructive added, cost.billable changed, reversible changed)
- Complex multi-change scenarios
- Semver recommendations
- Real ATIP examples from repository

**Key Test Cases**:
- Detect command removed (breaking)
- Detect required argument added (breaking)
- Detect type made stricter (breaking)
- Detect command added (non-breaking)
- Detect optional argument added (non-breaking)
- Detect destructive flag added (effects, high)
- Detect cost.billable changed (effects, high)
- Detect reversible changed (effects, medium)
- Handle multiple changes correctly
- Categorize all changes correctly
- Track paths correctly for nested commands
- Recommend major for breaking
- Recommend minor for non-breaking
- Recommend minor for high-severity effects
- Recommend patch for low-severity effects
- Recommend none for no changes
- Diff real ATIP files from examples/
- Handle legacy atip format (string version)

## Test Fixtures Summary

### Base Fixtures (2 files)
- `base/minimal.json` - Minimal valid ATIP metadata
- `base/complete.json` - Complete ATIP with all features

### Breaking Change Fixtures (3 files)
- `breaking/command-removed.json` - Command removed from complete.json
- `breaking/required-arg-added.json` - Required argument added to minimal.json
- `breaking/type-stricter.json` - Enum values removed (type stricter)

### Non-Breaking Change Fixtures (2 files)
- `non-breaking/command-added.json` - New command added to complete.json
- `non-breaking/optional-arg-added.json` - Optional argument added to minimal.json

### Effects Change Fixtures (1 file)
- `effects/destructive-added.json` - Destructive, reversible, and cost.billable changed

### Complex Fixtures (1 file)
- `complex/multi-change.json` - Multiple breaking, non-breaking, and effects changes

### Edge Case Fixtures (3 files)
- `invalid.json` - Invalid JSON syntax (missing comma)
- `missing-name.json` - Schema validation failure (missing required field)
- `legacy/legacy-format.json` - Legacy ATIP format (string version)

## Test Execution

### Expected Behavior (RED Phase)

All tests MUST fail with import errors because the implementation doesn't exist yet:

```bash
npm test
```

**Expected Errors**:
```
Error: Cannot find module '../../src/comparator/comparator'
Error: Cannot find module '../../src/categorizer/categorizer'
Error: Cannot find module '../../src/semver/semver'
Error: Cannot find module '../../src/loader/normalizer'
Error: Cannot find module '../../src/output/formatters'
Error: Cannot find module '../../src/differ/differ'
Error: Cannot find module '../../src/diff'
Error: Cannot find module '../../src/types'
Error: Cannot find module '../../src/comparator/type-checker'
```

This is CORRECT behavior for RED phase. These errors validate:
1. Tests import from non-existent implementation files
2. Tests will actually test something when implementation is added
3. No false positives from incomplete tests

### Verification Commands

```bash
# Count test files
find tests -name "*.test.ts" | wc -l
# Expected: 9

# Count test fixtures
find tests/fixtures -name "*.json" | wc -l
# Expected: 12

# Count test cases (approximate)
grep -r "it('should" tests/*.test.ts | wc -l
# Expected: 100+

# Verify all imports reference src/
grep -r "from '../../src" tests | wc -l
# Expected: 50+
```

## Test Coverage Goals

Per CLAUDE.md and design.md:

- **80%+ coverage** on core logic (comparator, differ, semver, categorizer)
- **100% coverage** on categorization rules (breaking-rules, effects-rules, severity)
- Integration tests must use real ATIP examples from `examples/` directory

## Change Types Covered

### Breaking Changes (10 types)
- ✅ command-removed
- ✅ required-argument-added
- ✅ required-option-added
- ✅ type-made-stricter
- ✅ enum-values-removed
- ✅ argument-removed
- ✅ option-removed
- ✅ option-flags-changed
- ✅ argument-made-required
- ✅ option-made-required

### Non-Breaking Changes (11 types)
- ✅ command-added
- ✅ optional-argument-added
- ✅ optional-option-added
- ✅ type-relaxed
- ✅ enum-values-added
- ✅ description-changed
- ✅ default-value-changed
- ✅ examples-changed
- ✅ argument-made-optional
- ✅ option-made-optional
- ✅ homepage-changed
- ✅ version-changed

### Effects Changes (9 types)
- ✅ destructive-added (high)
- ✅ destructive-removed (medium)
- ✅ reversible-changed (medium)
- ✅ idempotent-changed (medium)
- ✅ network-changed (low)
- ✅ filesystem-changed (medium)
- ✅ cost-changed (high for billable, low for estimate)
- ✅ interactive-changed (medium)
- ✅ duration-changed (low)

## Next Steps (GREEN Phase)

Once tests are complete and failing correctly:

1. **Create src/ directory structure** matching design.md
2. **Implement modules** to pass tests one by one
3. **Verify 100% of tests pass**
4. **Run coverage** and ensure 80%+ on core logic
5. **Validate against real examples** from examples/ directory

## Notes

- All tests follow Blue phase design (api.md, design.md, examples.md)
- All fixtures are valid ATIP 0.6 metadata (except error cases)
- Tests use vitest framework with globals enabled
- CLI tests use exec() for true end-to-end validation
- Integration tests validate against actual ATIP examples
- Tests are comprehensive but maintainable
- Clear test names following "should [behavior] when [condition]" pattern
