# How to Verify RED Phase Tests

This document explains how to verify that the Phase 4.4.5 RED phase tests are properly failing.

## Quick Verification

Run all tests and observe the expected failures:

```bash
cd /Users/anthonylaforge/dev/atip/reference/atip-discover
npm test
```

## Expected Output

### Summary Line

```
Tests:  137 passed, 11 failed, 148 total
```

- **137 passed**: Existing tests from previous phases (still working)
- **11 failed**: New Phase 4.4.5 tests (failing as expected)
- **148 total**: Sum of existing + new tests

### Failed Test Details

#### 1. Trust Module Import Failures (5 files)

These should fail with "Failed to load url" errors:

```
FAIL  tests/unit/trust/hash.test.ts
Error: Failed to load url ../../../src/trust/hash

FAIL  tests/unit/trust/cosign.test.ts
Error: Failed to load url ../../../src/trust/cosign

FAIL  tests/unit/trust/slsa.test.ts
Error: Failed to load url ../../../src/trust/slsa

FAIL  tests/unit/trust/evaluator.test.ts
Error: Failed to load url ../../../src/trust/evaluator

FAIL  tests/integration/trust.test.ts
Error: Failed to load url ../../src/trust
```

**Why**: The `src/trust/` directory doesn't exist yet.

#### 2. Function Not Exported (10 tests)

```
FAIL  tests/unit/discovery/checkHelpForAgent.test.ts (10 tests | 10 failed)
TypeError: checkHelpForAgent is not a function
```

**Why**: The `checkHelpForAgent` function is not exported from `src/discovery/prober.ts` yet.

#### 3. Two-Phase Behavior Difference (1 test)

```
FAIL  tests/unit/probe-two-phase.test.ts > should handle Phase 1 timeout without proceeding to Phase 2
ProbeTimeoutError: Probe timeout after 100ms
```

**Why**: The current `probe()` implementation doesn't use two-phase logic yet, so it times out directly instead of returning null.

## Test-by-Test Verification

### Verify checkHelpForAgent tests fail

```bash
npm test tests/unit/discovery/checkHelpForAgent.test.ts
```

Expected:
```
FAIL  tests/unit/discovery/checkHelpForAgent.test.ts
  checkHelpForAgent
    ✕ should return true when --agent flag appears in --help output
    ✕ should return true when -agent short form appears in --help output
    ✕ should return true when ATIP/agent keyword appears in --help
    ✕ should return false when --help output has no agent reference
    ✕ should return false when --help command fails
    ✕ should return false when --help command times out
    ✕ should return false for non-executable files
    ✕ should handle stderr output from --help
    ✕ should respect custom timeout option
    ✕ should handle case variations in help text

Tests:  10 failed, 10 total
Error: checkHelpForAgent is not a function
```

### Verify two-phase probing tests

```bash
npm test tests/unit/probe-two-phase.test.ts
```

Expected:
```
FAIL  tests/unit/probe-two-phase.test.ts
  Two-Phase Safe Probing
    ✓ should skip --agent execution if --help does not show --agent support
    ✓ should execute --agent only after confirming --help shows support
    ✓ should return null for tools without --agent in help
    ✓ should properly chain Phase 1 to Phase 2 on success
    ✕ should handle Phase 1 timeout without proceeding to Phase 2
    ✓ should handle Phase 2 failure gracefully after Phase 1 success
    ✓ should handle tools that output invalid JSON in Phase 2
    ✓ should handle stderr in both phases separately

Tests:  7 passed, 1 failed, 8 total
```

**Note**: 7 tests pass because the current `probe()` implementation happens to work for those cases. The timeout test fails because the two-phase logic isn't implemented yet.

### Verify trust module tests fail

```bash
npm test tests/unit/trust/
```

Expected:
```
FAIL  tests/unit/trust/hash.test.ts
Error: Failed to load url ../../../src/trust/hash

FAIL  tests/unit/trust/cosign.test.ts
Error: Failed to load url ../../../src/trust/cosign

FAIL  tests/unit/trust/slsa.test.ts
Error: Failed to load url ../../../src/trust/slsa

FAIL  tests/unit/trust/evaluator.test.ts
Error: Failed to load url ../../../src/trust/evaluator
```

All trust tests should fail at the import stage because the modules don't exist.

### Verify trust integration tests fail

```bash
npm test tests/integration/trust.test.ts
```

Expected:
```
FAIL  tests/integration/trust.test.ts
Error: Failed to load url ../../src/trust
```

## What This Proves

### Tests Will Actually Test Something

The failures prove that:

1. **Import validation**: Tests reference the correct module paths
2. **Function existence**: Tests will fail if functions aren't implemented
3. **Contract validation**: Tests expect specific function signatures
4. **No false positives**: Tests don't accidentally pass without implementation

### Ready for GREEN Phase

Once these tests pass, we'll know:

1. All modules are correctly structured
2. All functions are properly exported
3. All API contracts are satisfied
4. The implementation matches the design

## Common Issues

### If tests pass unexpectedly

**Problem**: Some tests pass even though implementation doesn't exist.

**Diagnosis**: Check if test is mocking the function or using a different import path.

**Fix**: Verify test imports match the API specification.

### If more tests fail than expected

**Problem**: Existing tests break.

**Diagnosis**: Check if test files accidentally modified existing code.

**Fix**: Ensure no changes to `src/` directory during RED phase.

### If fewer tests fail than expected

**Problem**: Some test files aren't running.

**Diagnosis**: Check test file naming (must end in `.test.ts`) and location.

**Fix**: Verify files are in `tests/unit/` or `tests/integration/`.

## Verification Checklist

Before declaring RED phase complete:

- [ ] Run `npm test` and observe 11 failed tests
- [ ] Verify 5 trust module files fail with import errors
- [ ] Verify 10 checkHelpForAgent tests fail with "not a function"
- [ ] Verify existing 137 tests still pass
- [ ] Confirm no changes to `src/` directory (only `tests/` modified)
- [ ] Read PHASE-4.4.5-README.md to understand test strategy
- [ ] Read VERIFICATION-SUMMARY.md to confirm completeness

## Next Steps

Once verification is complete:

1. Commit the test files:
   ```bash
   git add tests/
   git commit -m "test(atip-discover): Add Phase 4.4.5 RED phase tests for trust verification"
   ```

2. Begin GREEN phase:
   - Create `src/trust/` directory structure
   - Implement functions one at a time
   - Run tests incrementally to verify each implementation
   - Aim for all 73 Phase 4.4.5 tests to pass

3. Final verification:
   ```bash
   npm test
   # Should show: Tests: 148 passed, 0 failed, 148 total
   ```

## Documentation References

- **Test Strategy**: `tests/PHASE-4.4.5-README.md`
- **Verification Summary**: `tests/VERIFICATION-SUMMARY.md`
- **API Specification**: `blue/api.md` (section "Trust Verification API")
- **Design Document**: `blue/design.md` (section "Trust Verification Module")

## Contact

If tests fail in unexpected ways or you have questions about the test strategy, refer to:

- CLAUDE.md (BRGR methodology)
- PHASE-4.4.5-README.md (detailed test documentation)
- blue/api.md (API contracts)
