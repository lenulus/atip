# Quick Start: atip-diff RED Phase

## Current Status: RED Phase Complete ✅

All tests are written and will fail (correctly) because implementation doesn't exist yet.

## Verify RED Phase

```bash
cd reference/atip-diff

# Run verification script
bash scripts/verify-red-phase.sh

# Should output:
# ✓ All RED phase checks passed!
```

## Install Dependencies

```bash
npm install
```

## Run Tests (Expected to Fail)

```bash
npm test
```

**Expected behavior**: Tests fail with import errors like:
```
Error: Cannot find module '../../src/comparator/comparator'
```

This is CORRECT! It proves the tests will actually test the implementation.

## Test Structure

- **8 unit test files** in `tests/unit/`
- **2 integration test files** in `tests/integration/`
- **12 test fixtures** in `tests/fixtures/`
- **198+ test cases** total

## What's Tested

✅ All 30+ change types (breaking, non-breaking, effects)
✅ All API contracts from blue/api.md
✅ All workflows from blue/design.md
✅ All scenarios from blue/examples.md
✅ CLI commands and flags
✅ Error handling
✅ Real ATIP examples integration

## Coverage Goals

- 80%+ on core logic
- 100% on categorization rules

## Next Steps

See [RED-PHASE-COMPLETE.md](RED-PHASE-COMPLETE.md) for full details.

Ready to implement? Create `src/` directory and start GREEN phase!
