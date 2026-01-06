# Test Suite Verification for atip-discover

## RED Phase Status: COMPLETE

All test files have been created following the BRGR methodology. Tests are designed to **fail** because no implementation exists yet.

## Installation & Verification

To verify tests fail correctly:

```bash
cd reference/atip-discover

# Install dependencies
npm install

# Run tests (all should fail with import/module errors)
npm test
```

## Expected Failure Output

Tests should fail with errors like:

```
❌ Cannot find module '../../src/xdg'
❌ Cannot find module '../../src/safety'
❌ Cannot find module '../../src/registry'
❌ Cannot find module '../../src/discovery/prober'
❌ Cannot find module '../../src/config'
❌ Cannot find module '../../src/validator'
❌ Cannot find module '../../src/discovery/scanner'
❌ Cannot find module '../../src/index'
```

This validates that:
1. Tests reference the correct source file locations
2. Tests will actually test implementation (not false positives)
3. Implementation is spec-driven (tests written first)

## Test Suite Summary

### Unit Tests (7 files)

| Test File | Module | Test Count (approx) | Focus |
|-----------|--------|---------------------|-------|
| `xdg.test.ts` | `src/xdg/` | ~10 | XDG path resolution, env vars, tilde expansion |
| `safety.test.ts` | `src/safety/` | ~15 | Path safety checks, skip list matching |
| `registry.test.ts` | `src/registry/` | ~15 | Load/save registry, atomic writes, JSON parsing |
| `probe.test.ts` | `src/discovery/prober.ts` | ~12 | Tool probing, --agent flag, timeout, validation |
| `config.test.ts` | `src/config/` | ~12 | Config loading, env vars, duration parsing |
| `validator.test.ts` | `src/validator/` | ~20 | ATIP schema validation, error reporting |
| `scanner.test.ts` | `src/discovery/scanner.ts` | ~15 | Discovery orchestration, parallel probing |

**Total Unit Tests**: ~99 tests

### Integration Tests (2 files)

| Test File | Focus | Test Count (approx) |
|-----------|-------|---------------------|
| `cli.test.ts` | CLI commands via child_process | ~20 |
| `discovery.test.ts` | End-to-end workflows | ~10 |

**Total Integration Tests**: ~30 tests

**Grand Total**: ~129 tests (comparable to Go implementation's 103)

## Coverage Goals

Per `CLAUDE.md`:

- **80%+ coverage** on core logic
- **100% coverage** on safety-critical code:
  - `isSafePath()` - Prevents scanning unsafe directories
  - `matchesSkipList()` - Skip list filtering
  - `validateMetadata()` - ATIP schema validation
  - `saveRegistry()` - Atomic writes to prevent corruption

## Test Quality Checklist

✅ **All tests follow BRGR**: Written before implementation
✅ **Descriptive names**: "should X when Y" format
✅ **One assertion focus**: Each test validates one behavior
✅ **Real fixtures**: Uses actual file I/O, not excessive mocking
✅ **Safety-first**: Critical security checks covered 100%
✅ **Based on API spec**: All tests derived from `blue/api.md`
✅ **Match Go patterns**: Similar structure to Go implementation
✅ **Will fail correctly**: Import errors expected

## Key Test Scenarios Covered

### Security (Critical)
- ✅ Reject world-writable directories
- ✅ Reject directories owned by other users
- ✅ Reject current directory (.)
- ✅ Skip list glob matching
- ✅ Tool execution timeout enforcement

### XDG Compliance
- ✅ XDG_DATA_HOME environment variable
- ✅ XDG_CONFIG_HOME environment variable
- ✅ Default fallbacks (~/.local/share, ~/.config)
- ✅ Tilde expansion
- ✅ Windows LOCALAPPDATA support

### Registry Operations
- ✅ Load empty registry (returns default)
- ✅ Load existing registry
- ✅ Atomic save (temp + rename)
- ✅ Date serialization/parsing
- ✅ Forward compatibility (preserve unknown fields)

### Tool Discovery
- ✅ Probe with --agent flag
- ✅ Parse valid ATIP JSON
- ✅ Timeout on slow tools
- ✅ Handle invalid JSON
- ✅ Validate against schema
- ✅ Parallel probing with concurrency limit

### Configuration
- ✅ Load from file
- ✅ Merge with defaults
- ✅ Environment variable overrides
- ✅ Duration parsing (s, m, h)
- ✅ Validation (ranges, types)

### End-to-End Workflows
- ✅ Scan → List → Get workflow
- ✅ Incremental scanning
- ✅ Version update detection
- ✅ Multiple tool sources (native, shim)
- ✅ Error handling (partial results)

## Next Steps (GREEN Phase)

Once tests are verified failing:

1. **Create module structure**:
   ```
   src/
   ├── index.ts              # Library exports
   ├── xdg/
   ├── safety/
   ├── registry/
   ├── discovery/
   │   ├── prober.ts
   │   └── scanner.ts
   ├── config/
   ├── validator/
   └── cli/
   ```

2. **Implement modules one by one**:
   - Start with `xdg/` (no dependencies)
   - Then `safety/` (depends on xdg)
   - Then `registry/` (depends on xdg)
   - Then `validator/` (standalone)
   - Then `config/` (depends on xdg)
   - Then `prober.ts` (depends on validator)
   - Then `scanner.ts` (depends on all above)
   - Finally `cli/` (depends on scanner)

3. **Watch tests turn green**:
   ```bash
   npm run test:watch
   ```

4. **Achieve coverage goals**:
   ```bash
   npm run test:coverage
   ```

5. **Move to REFACTOR phase** when all tests pass

## File Locations

All test files created:

```
/Users/laforge/dev/atip/reference/atip-discover/
├── package.json                    # npm configuration
├── tsconfig.json                   # TypeScript config
├── vitest.config.ts                # Test runner config
├── tsup.config.ts                  # Build config
└── tests/
    ├── README.md                   # Test documentation
    ├── unit/
    │   ├── xdg.test.ts            # 10 tests
    │   ├── safety.test.ts         # 15 tests
    │   ├── registry.test.ts       # 15 tests
    │   ├── probe.test.ts          # 12 tests
    │   ├── config.test.ts         # 12 tests
    │   ├── validator.test.ts      # 20 tests
    │   └── scanner.test.ts        # 15 tests
    └── integration/
        ├── cli.test.ts            # 20 tests
        └── discovery.test.ts      # 10 tests
```

## Comparison with Go Implementation

The TypeScript test suite is designed to match the Go implementation's coverage:

| Metric | Go | TypeScript |
|--------|-----|------------|
| Test files | ~9 | 9 |
| Total tests | 103 | ~129 |
| Test structure | unit + integration | unit + integration |
| Coverage focus | Safety, discovery | Safety, discovery |
| Test framework | Go testing | Vitest |

TypeScript has slightly more tests due to:
- Additional TypeScript-specific type validation tests
- More granular CLI flag testing
- Extra edge case coverage for JSON parsing

---

**Phase**: RED (Complete)
**Status**: All tests will fail - no implementation exists
**Next**: GREEN phase - implement to make tests pass
**Goal**: 80%+ coverage, 100% on safety-critical code
