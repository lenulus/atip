# Test Strategy: atip-discover

This document describes the comprehensive test suite for `atip-discover`, created following the BRGR (Blue, Red, Green, Refactor) methodology during the **RED phase**.

---

## Overview

The test suite validates the complete implementation against the specifications in `blue/`:
- **api.md** - CLI interface, flags, output schemas, exit codes
- **design.md** - Architecture, security model, caching strategy
- **examples.md** - 27 usage examples with expected outputs

**Current Status**: RED phase - All tests are expected to FAIL until implementation is complete.

---

## Test Organization

```
reference/atip-discover/
├── internal/
│   ├── xdg/
│   │   └── xdg_test.go              # XDG path resolution tests
│   ├── config/
│   │   └── config_test.go           # Configuration loading and merging tests
│   ├── validator/
│   │   └── validator_test.go        # ATIP schema validation tests
│   ├── output/
│   │   └── output_test.go           # Output formatting tests (JSON/table/quiet)
│   ├── registry/
│   │   └── registry_test.go         # Registry CRUD and persistence tests
│   └── discovery/
│       └── discovery_test.go        # Scanning and probing tests
├── tests/
│   └── integration/
│       ├── scan_test.go             # End-to-end scan workflows
│       └── security_test.go         # Security enforcement tests
└── testdata/
    ├── tools/                       # Mock executables for testing
    │   ├── mock-atip-tool           # Valid ATIP tool
    │   ├── mock-invalid-tool        # Returns invalid JSON
    │   ├── mock-timeout-tool        # Hangs to test timeouts
    │   └── mock-error-tool          # Exits with error
    └── shims/                       # Test shim files
        ├── valid-shim.json          # Valid shim metadata
        └── invalid-shim.json        # Invalid shim (missing fields)
```

---

## Test Categories

### 1. Unit Tests

Located in `internal/*/` alongside source files. Test individual modules in isolation.

#### XDG Module (`internal/xdg/xdg_test.go`)
- **Coverage**: Path resolution, environment variable handling
- **Key Tests**:
  - `TestDataHome` - XDG_DATA_HOME resolution with fallback
  - `TestConfigHome` - XDG_CONFIG_HOME resolution with fallback
  - `TestAgentToolsDataDir` - Agent-tools directory path
  - `TestEnsureDataDirs` - Directory creation and idempotence
  - `TestExpandTilde` - Tilde expansion in paths
- **Expected Failures**: All functions panic with "not implemented"

#### Config Module (`internal/config/config_test.go`)
- **Coverage**: Configuration loading, merging, validation
- **Key Tests**:
  - `TestDefault` - Default configuration values
  - `TestLoad_ValidConfig` - JSON config file parsing
  - `TestMerge_EnvironmentVariables` - Env var overrides
  - `TestMerge_CLIFlags` - Flag priority over env/config
  - `TestMerge_Precedence` - Flags > Env > Config priority
  - `TestValidate` - Configuration validation (parallelism, timeout, format)
- **Expected Failures**: All functions panic with "not implemented"

#### Validator Module (`internal/validator/validator_test.go`)
- **Coverage**: ATIP schema validation against spec/schema
- **Key Tests**:
  - `TestValidate_ValidMinimalMetadata` - Minimal valid ATIP
  - `TestValidate_ValidComplexMetadata` - Full metadata with nested commands
  - `TestValidate_MissingRequiredFields` - Enforce required fields (atip, name, version, description)
  - `TestValidate_LegacyAtipFormat` - Backwards compatibility (atip: "0.3")
  - `TestValidate_InvalidEffects` - Effects type checking
  - `TestValidate_PartialDiscovery` - Partial metadata with omitted field
  - `TestValidate_OptionsWithAllTypes` - String, integer, boolean, enum options
  - `TestValidate_NestedCommands` - Deep command nesting
- **Expected Failures**: All functions panic with "not implemented"

#### Output Module (`internal/output/output_test.go`)
- **Coverage**: JSON, table, and quiet output formatting
- **Key Tests**:
  - `TestJSONWriter_Write` - Valid JSON output with indentation
  - `TestTableWriter_WriteList` - Table with headers and alignment
  - `TestTableWriter_EmptyList` - "No tools found" message
  - `TestQuietWriter_WriteList` - Tool names only (one per line)
  - `TestQuietWriter_WriteCount` - Numeric count for scan results
- **Expected Failures**: All functions panic with "not implemented"

#### Registry Module (`internal/registry/registry_test.go`)
- **Coverage**: Registry persistence, CRUD operations, cache management
- **Key Tests**:
  - `TestLoad_ValidRegistry` - JSON registry parsing
  - `TestSave_Atomic` - Atomic file writes (no .tmp remnants)
  - `TestAdd` - Add new tool to registry
  - `TestAdd_Update` - Update existing tool (preserve DiscoveredAt)
  - `TestRemove` - Remove tool by name
  - `TestGet` - Retrieve tool by name
  - `TestList_FilterBySource` - Filter native vs shim tools
  - `TestList_FilterByPattern` - Glob pattern matching
  - `TestLoadShims` - Load shim files from shims directory
  - `TestIsStale` - Modification time change detection
  - `TestCachePath` - Cache file path generation
- **Expected Failures**: All functions panic with "not implemented"

#### Discovery Module (`internal/discovery/discovery_test.go`)
- **Coverage**: PATH scanning, tool probing, security filtering
- **Key Tests**:
  - `TestScanner_Scan` - Basic directory scanning
  - `TestScanner_Scan_IncrementalMode` - Skip unchanged executables
  - `TestScanner_Scan_WithSkipList` - Skip list filtering
  - `TestScanner_Scan_Timeout` - Kill hanging tools
  - `TestScanner_Scan_Parallel` - Worker pool parallelism
  - `TestProber_Probe_ValidTool` - Execute --agent and parse JSON
  - `TestProber_Probe_InvalidJSON` - Reject invalid responses
  - `TestProber_Probe_NoAgentSupport` - Handle tools without --agent
  - `TestIsSafePath` - World-writable and current directory rejection
  - `TestEnumerateExecutables` - Find executable files only
  - `TestMatchesSkipList` - Glob pattern matching for skip list
- **Expected Failures**: All functions panic with "not implemented"

---

### 2. Integration Tests

Located in `tests/integration/`. Test complete workflows end-to-end.

#### Scan Workflow Tests (`tests/integration/scan_test.go`)
- **Coverage**: Full CLI workflows from examples.md
- **Key Tests**:
  - `TestFullScanWorkflow` - Example 1: First-time discovery
  - `TestIncrementalScan` - Example 7: Incremental vs full scan
  - `TestListCommand` - Example 2: List discovered tools
  - `TestGetCommand` - Example 3: Get tool metadata
  - `TestGetCommand_NotFound` - Example 19: Error handling
  - `TestSkipList` - Example 6: Skip problematic tools
  - `TestDryRun` - Example 8: Dry run mode
  - `TestOutputFormats` - Example 2: JSON, table, quiet formats
  - `TestRefreshCommand` - Example 15: Refresh metadata
- **Expected Failures**: Binary not yet built, all commands fail

#### Security Tests (`tests/integration/security_test.go`)
- **Coverage**: Security scenarios from design.md and examples.md
- **Key Tests**:
  - `TestSafePathEnforcement` - Example 25: World-writable directory rejection
  - `TestSafePathsOnlyDefault` - Default safe paths only
  - `TestCurrentDirectoryRejection` - Reject "." in PATH
  - `TestDisableSafePathsWarning` - Example 26: Warning when disabled
  - `TestVerboseSecurityLogging` - Example 27: Debug security decisions
  - `TestProbeTimeout` - Kill tools exceeding timeout
  - `TestOutputSizeLimit` - Reject oversized tool output
  - `TestNoShellExpansion` - Safe command execution (no shell)
  - `TestSymlinkHandling` - Handle symlinks safely
  - `TestRegistryFilePermissions` - 0644 permissions on registry.json
- **Expected Failures**: Binary not yet built, all commands fail

---

## Test Fixtures

### Mock Tools (`testdata/tools/`)

All mock tools are shell scripts with execute permissions.

1. **mock-atip-tool**
   - Returns valid ATIP metadata with --agent
   - Has multiple commands (run, test) and options
   - Used for: Basic scanning, validation, metadata retrieval

2. **mock-invalid-tool**
   - Returns invalid JSON (plain text)
   - Used for: Testing validation error handling

3. **mock-timeout-tool**
   - Sleeps for 30 seconds
   - Used for: Testing timeout enforcement and process killing

4. **mock-error-tool**
   - Exits with code 1 when called with --agent
   - Used for: Testing error handling for unsupported tools

### Shim Files (`testdata/shims/`)

1. **valid-shim.json**
   - Complete ATIP metadata for curl
   - Demonstrates community shim format
   - Used for: Testing shim loading and validation

2. **invalid-shim.json**
   - Missing required `version` field
   - Used for: Testing shim validation rejection

---

## Running Tests

### Prerequisites

```bash
cd reference/atip-discover
go mod download
```

### Run All Tests

```bash
# Will FAIL until implementation is complete (RED phase)
go test ./...
```

### Run Specific Test Suites

```bash
# Unit tests only
go test ./internal/...

# Integration tests only
go test ./tests/integration/...

# Specific module
go test ./internal/xdg
go test ./internal/discovery
```

### Run With Coverage

```bash
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Run With Verbose Output

```bash
go test -v ./...
```

### Run Specific Test

```bash
go test -v -run TestXDGDataHome ./internal/xdg
go test -v -run TestFullScanWorkflow ./tests/integration
```

---

## Expected Test Failures

**All tests will fail in the RED phase** because:

1. **Import Errors**: Source files exist but all functions panic with "not implemented"
2. **Panic Errors**: Tests that call unimplemented functions will panic
3. **Binary Not Found**: Integration tests attempt to execute `atip-discover` CLI which doesn't exist yet

**Example failure output**:
```
--- FAIL: TestDataHome (0.00s)
panic: not implemented [recovered]
	panic: not implemented

goroutine 6 [running]:
testing.tRunner.func1.2({0x1008a40, 0x10162a0})
	/usr/local/go/src/testing/testing.go:1526 +0x24e
...
```

This is **correct behavior** for the RED phase. These failures drive the GREEN phase implementation.

---

## Coverage Goals

Per CLAUDE.md requirements:

- **Core logic**: 80%+ coverage
- **Security-critical code**: 100% coverage
  - Path safety filtering (`IsSafePath`)
  - Subprocess execution (`Prober.Probe`)
  - File permissions (`Registry.Save`)
  - Effects validation (`Validator.Validate`)
- **Integration tests**: Must use real ATIP examples from `../../examples/`

---

## Test Data Sources

### From Spec (`../../spec/rfc.md`)
- ATIP schema version validation
- Required vs optional fields
- Effects semantics
- Partial discovery behavior

### From Design (`blue/design.md`)
- Security filtering rules
- Atomic file operations
- Worker pool parallelism
- Incremental scanning logic
- Cache TTL handling

### From Examples (`blue/examples.md`)
- 27 concrete usage scenarios
- Expected output formats
- Error message content
- Exit codes for various conditions

### From Real Examples (`../../examples/`)
Integration tests should validate against actual ATIP metadata:
- `gh.json` - Complex nested commands
- `kubectl.json` - Partial discovery
- `terraform.json` - Effects metadata

---

## Validation Criteria

Tests verify implementation against:

1. **API Contracts** (api.md)
   - CLI flags match specification
   - JSON output schemas match exactly
   - Exit codes match documented values

2. **Security Guarantees** (design.md)
   - World-writable directories rejected
   - Current directory rejected
   - Timeout enforcement works
   - No shell expansion vulnerabilities

3. **Behavioral Correctness** (examples.md)
   - Output matches expected format
   - Incremental mode skips unchanged tools
   - Skip list filters correctly
   - Refresh detects version changes

4. **Schema Compliance** (spec/rfc.md)
   - All valid ATIP metadata accepted
   - Required fields enforced
   - Legacy formats supported
   - Effects types validated

---

## Special Test Considerations

### Platform-Specific Tests

Some tests are Unix-only:
- `TestSafePathEnforcement` - File permissions
- `TestSymlinkHandling` - Symlink behavior
- `TestRegistryFilePermissions` - Mode bits

These use `runtime.GOOS` checks:
```go
if runtime.GOOS == "windows" {
    t.Skip("Skipping Unix permission tests on Windows")
}
```

### Timeout Tests

Tests involving timeouts use short durations (100-200ms) for fast execution:
```go
scanner, err := NewScanner(100*time.Millisecond, 1, nil)
```

### Temporary Directories

All tests use `t.TempDir()` for isolation:
```go
tmpDir := t.TempDir() // Cleaned up automatically
```

### Environment Isolation

Tests manipulate environment variables and clean up:
```go
original := os.Getenv("XDG_DATA_HOME")
defer os.Setenv("XDG_DATA_HOME", original)
```

---

## Progression to GREEN Phase

Once implementation begins, tests should fail in this order:

1. **First to pass**: XDG and config modules (minimal dependencies)
2. **Second**: Validator module (depends on embedded schema)
3. **Third**: Output module (depends on encoding/json)
4. **Fourth**: Registry module (depends on XDG, uses file I/O)
5. **Fifth**: Discovery module (depends on validator, registry)
6. **Last**: Integration tests (depends on compiled CLI binary)

**100% of tests must pass before moving to REFACTOR phase.**

---

## Adding New Tests

When adding tests, ensure:

1. **Follow table-driven pattern** for multiple cases:
   ```go
   tests := []struct {
       name     string
       input    string
       expected string
   }{
       {"case 1", "input1", "expected1"},
       {"case 2", "input2", "expected2"},
   }

   for _, tt := range tests {
       t.Run(tt.name, func(t *testing.T) {
           // Test logic
       })
   }
   ```

2. **Use testify assertions** for clear failures:
   ```go
   require.NoError(t, err)  // Stop on error
   assert.Equal(t, expected, actual)  // Continue on failure
   ```

3. **Document what you're testing**:
   ```go
   // TestFoo validates that Foo returns bar when given baz
   // per design.md section 3.2
   func TestFoo(t *testing.T) { ... }
   ```

4. **Link to spec/design/examples** in comments

---

## Known Limitations

1. **No GUI tests** - CLI only
2. **No network tests** - All operations are local
3. **No long-running tests** - All tests complete in seconds
4. **Mock tools are simple** - Shell scripts, not real executables

---

## References

- [api.md](../blue/api.md) - CLI interface specification
- [design.md](../blue/design.md) - Architecture and design decisions
- [examples.md](../blue/examples.md) - 27 usage examples
- [spec/rfc.md](../../spec/rfc.md) - ATIP protocol specification
- [CLAUDE.md](../../CLAUDE.md) - BRGR methodology and test requirements

---

## Questions?

If a test seems to validate behavior not in the spec, check:
1. Is it in api.md? (Explicit requirement)
2. Is it in design.md? (Design decision)
3. Is it in examples.md? (Expected behavior)

If none of the above, the test may be over-specified and should be removed or relaxed.
