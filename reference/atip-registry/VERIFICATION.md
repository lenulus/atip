# RED Phase Verification Checklist

This document provides step-by-step verification that the RED phase is complete for `atip-registry`.

## Prerequisites

Ensure you have:
- Go 1.22 or later installed (`go version`)
- Project dependencies downloaded (`make deps`)

## Verification Steps

### 1. Test Compilation

Verify all tests compile without errors:

```bash
make verify
```

**Expected output**:
```
Verifying tests compile...
✓ All tests compile successfully
```

**Pass criteria**: No compilation errors

### 2. Test Execution

Run all tests and verify they fail (as expected in RED phase):

```bash
make test
```

**Expected output**:
```
⚠️  RED PHASE: Tests are expected to FAIL (not implemented)

--- FAIL: TestServer_GetRegistryManifest
--- FAIL: TestRegistry_Load
--- FAIL: TestCrawler_LoadManifest
--- FAIL: TestSync_FetchRemoteManifest
--- FAIL: TestSigner_Sign
--- FAIL: TestServeCommand_Flags
...
FAIL
```

**Pass criteria**:
- ✅ All tests run
- ✅ All tests fail with "not implemented" or similar errors
- ❌ No tests pass (would indicate weak test)

### 3. Individual Module Testing

Test each module independently:

```bash
go test -v ./internal/server
go test -v ./internal/registry
go test -v ./internal/crawler
go test -v ./internal/sync
go test -v ./internal/trust
go test -v ./cmd/atip-registry
```

**Expected**: Each module's tests fail but demonstrate clear test structure

### 4. Coverage Analysis

Check that coverage tracking works (even with failing tests):

```bash
make test-coverage-text
```

**Expected output**:
```
?       github.com/anthropics/atip/reference/atip-registry/internal/server     [no test files]
?       github.com/anthropics/atip/reference/atip-registry/internal/registry   [no test files]
...
coverage: 0.0% of statements
```

**Pass criteria**: Coverage can be measured (will be 0% until implementation)

### 5. RED Phase Complete Verification

Run the comprehensive RED phase check:

```bash
make red-phase
```

**Expected output**:
```
========================================
RED PHASE VERIFICATION
========================================

1. Verifying tests compile...
   ✓ All tests compile

2. Verifying tests fail (as expected)...
   ✓ Tests fail (expected in RED phase)

3. Test coverage breakdown:
   internal/server: 0.0% of statements
   internal/registry: 0.0% of statements
   internal/crawler: 0.0% of statements
   internal/sync: 0.0% of statements
   internal/trust: 0.0% of statements
   cmd/atip-registry: 0.0% of statements

========================================
RED PHASE: Tests ready for GREEN phase
========================================
```

## File Checklist

Verify all files exist:

### Design Documents (Blue Phase)
- [x] `blue/api.md`
- [x] `blue/design.md`
- [x] `blue/examples.md`

### Test Files
- [x] `internal/server/server_test.go`
- [x] `internal/registry/registry_test.go`
- [x] `internal/crawler/crawler_test.go`
- [x] `internal/sync/sync_test.go`
- [x] `internal/trust/trust_test.go`
- [x] `cmd/atip-registry/cmd_test.go`

### Stub Implementation Files
- [x] `internal/server/server.go`
- [x] `internal/registry/registry.go`
- [x] `internal/crawler/crawler.go`
- [x] `internal/sync/sync.go`
- [x] `internal/trust/trust.go`
- [x] `cmd/atip-registry/main.go`

### Test Fixtures
- [x] `testdata/valid-shim.json`
- [x] `testdata/invalid-shim.json`
- [x] `testdata/manifest.yaml`
- [x] `testdata/registry-manifest.json`

### Documentation
- [x] `tests/README.md` (test strategy)
- [x] `README.md` (project overview)
- [x] `VERIFICATION.md` (this file)

### Build Files
- [x] `go.mod`
- [x] `Makefile`

## Test Count Verification

Expected test counts per module:

| Module | Test Cases | Description |
|--------|-----------|-------------|
| `server` | 12 | HTTP endpoints, caching, security |
| `registry` | 9 | Storage, validation, catalog |
| `crawler` | 10 | Pipeline, parsing, generation |
| `sync` | 11 | Fetching, caching, filtering |
| `trust` | 9 | Signing, verification, bundles |
| `cmd` | 14 | CLI commands, flags, exit codes |
| **Total** | **65+** | Comprehensive coverage |

To count actual tests:

```bash
grep -r "func Test" internal/ cmd/ | wc -l
```

## Common Issues

### Issue: Tests pass when they should fail

**Problem**: Some tests pass in RED phase, indicating weak test assertions

**Solution**: Review tests to ensure they:
- Call unimplemented functions
- Assert on actual return values (not just error existence)
- Use real fixtures, not mock data

### Issue: Compilation errors

**Problem**: Tests don't compile due to missing types or imports

**Solution**:
- Ensure stub files define all types used in tests
- Check import paths match `go.mod` module name
- Run `go mod tidy` to fix dependency issues

### Issue: Test panics instead of failing gracefully

**Problem**: Tests panic on nil pointer dereference

**Solution**: Stub functions should return errors, not panic:

```go
// Good
func Load(dir string) (*Registry, error) {
    return nil, errors.New("not implemented")
}

// Bad
func Load(dir string) (*Registry, error) {
    return &Registry{}, nil // Will pass test accidentally
}
```

## Transition to GREEN Phase

Once verification passes, move to GREEN phase:

1. **Pick a module** to implement (suggest: start with `registry` or `server`)
2. **Run tests for that module**: `go test -v ./internal/registry`
3. **Implement minimal code** to pass tests
4. **Verify tests pass**: `go test ./internal/registry`
5. **Repeat** for next module

### GREEN Phase Success Criteria

Ready to move to REFACTOR phase when:
- [ ] 100% of tests pass
- [ ] `make test` returns exit code 0
- [ ] Coverage >85% overall
- [ ] All API contracts from `blue/api.md` implemented
- [ ] No known bugs

## Questions?

See:
- [tests/README.md](./tests/README.md) - Test strategy details
- [blue/design.md](./blue/design.md) - Architecture guidance
- [blue/api.md](./blue/api.md) - API contracts to implement
- [CLAUDE.md](../../CLAUDE.md) - BRGR methodology reference
