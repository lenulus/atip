# Test Strategy: atip-registry

This document describes the test suite for `atip-registry`, a Go implementation of a content-addressable registry server for ATIP shims.

## Test Organization

Tests follow Go conventions with `_test.go` files alongside implementation files:

```
reference/atip-registry/
├── internal/
│   ├── server/
│   │   ├── server.go
│   │   └── server_test.go          # HTTP server tests
│   ├── registry/
│   │   ├── registry.go
│   │   └── registry_test.go        # Registry operations tests
│   ├── crawler/
│   │   ├── crawler.go
│   │   └── crawler_test.go         # Crawler pipeline tests
│   ├── sync/
│   │   ├── sync.go
│   │   └── sync_test.go            # Sync client tests
│   └── trust/
│       ├── trust.go
│       └── trust_test.go           # Signature tests
├── cmd/atip-registry/
│   ├── main.go
│   └── cmd_test.go                 # CLI command tests
└── testdata/
    ├── valid-shim.json             # Valid ATIP shim fixture
    ├── invalid-shim.json           # Invalid shim for error testing
    ├── manifest.yaml               # Tool manifest fixture
    └── registry-manifest.json      # Registry manifest fixture
```

## Test Coverage Goals

Based on the Blue phase design documents, we aim for:

- **Overall coverage**: >85%
- **Critical paths**: 100% (hash validation, signature verification, path traversal prevention)
- **HTTP handlers**: 100% (all endpoints and error cases)
- **Business logic**: >90% (crawler, sync, catalog generation)
- **CLI commands**: >80% (flag parsing and basic execution paths)

## What Each Test Suite Validates

### Server Tests (`internal/server/server_test.go`)

Tests the HTTP API endpoints defined in `blue/api.md`:

**✓ GET `/.well-known/atip-registry.json`**
- Returns valid manifest JSON
- Includes correct caching headers (`Cache-Control: public, max-age=3600`)
- Returns 200 status

**✓ GET `/shims/sha256/{hash}.json`**
- Returns shim for valid hash
- Returns 404 for non-existent hash
- Returns 400 for invalid hash format (not 64 lowercase hex chars)
- Includes immutable caching headers (`Cache-Control: public, max-age=86400, immutable`)
- Includes ETag header for conditional requests
- Returns 304 Not Modified when `If-None-Match` matches ETag

**✓ GET `/shims/sha256/{hash}.json.bundle`**
- Returns signature bundle with `Content-Type: application/octet-stream`
- Returns 404 for missing bundle
- Includes immutable caching headers

**✓ GET `/shims/index.json`**
- Returns catalog JSON
- Includes ETag and caching headers

**✓ GET `/health`**
- Returns 200 with health status JSON

**✓ Security**
- Prevents path traversal attacks (`../`, `%2F`, etc.)
- Validates hash format before file access
- CORS headers when configured

### Registry Tests (`internal/registry/registry_test.go`)

Tests registry operations from `blue/design.md`:

**✓ Loading**
- Loads shims from data directory
- Handles missing directories gracefully

**✓ Adding Shims**
- Validates shim against ATIP 0.6 schema
- Extracts hash from `binary.hash` field
- Verifies hash matches filename (warns if mismatch)
- Stores in `shims/sha256/{hash}.json` structure
- Rejects invalid shims with clear error messages

**✓ Hash Validation**
- Accepts `sha256:...` prefix (strips for filename)
- Validates 64 lowercase hex characters
- Rejects uppercase, short, or malformed hashes
- Ensures hash in shim matches stored location

**✓ Retrieval**
- Gets shim by hash
- Returns nil for non-existent shims

**✓ Catalog Generation**
- Builds catalog from all shims
- Groups by tool name, version, platform
- Tracks coverage statistics

**✓ Path Functions**
- `ShimPath()` generates correct path from hash
- `BundlePath()` appends `.bundle` suffix

### Crawler Tests (`internal/crawler/crawler_test.go`)

Tests automated shim generation per spec section 4.10:

**✓ Manifest Loading**
- Parses YAML tool manifests
- Extracts sources (GitHub, Homebrew, APT)
- Loads template JSON

**✓ Release Discovery**
- Queries GitHub Releases API
- Filters by platform
- Finds matching assets based on patterns

**✓ Binary Processing**
- Downloads binaries
- Computes SHA-256 hash
- Matches hash format (`sha256:...`)

**✓ Shim Generation**
- Merges template with binary metadata
- Adds `binary.hash`, `binary.platform` fields
- Sets `trust.source: "community"` or `"inferred"`
- Validates against ATIP schema

**✓ --help Parsing**
- Extracts options from help text
- Infers types (boolean, string, file, integer)
- Detects flags (`-x, --extended`)
- Handles variadic options

**✓ Pipeline Execution**
- Runs stages: discover → download → hash → generate
- Parallel processing with configurable workers
- Error collection (continues on individual failures)

**✓ Filtering**
- Filters by platform (e.g., `--platform=linux-amd64`)
- Check-only mode (no downloads)

### Sync Tests (`internal/sync/sync_test.go`)

Tests registry synchronization per spec section 4.7:

**✓ Remote Manifest Fetch**
- Fetches `/.well-known/atip-registry.json`
- Parses registry info and trust requirements

**✓ Remote Catalog Fetch**
- Fetches `/shims/index.json`
- Extracts tool/version/platform mappings

**✓ Conditional Requests**
- Sends `If-None-Match` with cached ETag
- Handles 304 Not Modified responses
- Updates cache with new ETags

**✓ Shim Download**
- Downloads shim by hash
- Verifies hash matches content
- Stores in local registry

**✓ Signature Download**
- Fetches `.json.bundle` files
- Stores alongside shims

**✓ Cache Management**
- Stores ETags with 24-hour TTL
- Force refresh ignores cache

**✓ Filtering**
- Syncs only specified tools (`--tools=curl,jq`)
- Syncs only specified platforms

**✓ Dry Run**
- Reports what would be synced
- Does not write files

**✓ Error Handling**
- Collects errors for failed downloads
- Continues sync for successful shims

### Trust Tests (`internal/trust/trust_test.go`)

Tests signature operations per spec section 3.2.2:

**✓ Signing**
- Invokes `cosign sign-blob` with correct arguments
- Supports keyless signing (OIDC)
- Supports key-based signing (`--key`)
- Creates `.json.bundle` file

**✓ Verification**
- Invokes `cosign verify-blob`
- Checks identity matches expected signer
- Checks issuer matches expected OIDC provider
- Returns error for missing bundle

**✓ Bundle Parsing**
- Parses Cosign bundle format
- Extracts signer identity and issuer

**✓ Trust Configuration**
- Validates `requireSignatures` setting
- Validates signer list

**✓ Identity Validation**
- Rejects empty identity
- Rejects empty issuer
- Accepts valid email + issuer

### CLI Tests (`cmd/atip-registry/cmd_test.go`)

Tests command-line interface per `blue/api.md`:

**✓ Global Flags**
- `--config` specifies config file
- `--data-dir` specifies data directory
- `--verbose` enables logging
- `--agent` outputs ATIP metadata (dogfooding)
- `--version` shows version info

**✓ `serve` Command**
- `--addr` sets listen address
- `--tls-cert` and `--tls-key` enable TLS
- `--read-only` disables write operations
- `--cors-origin` sets CORS policy

**✓ `add` Command**
- Requires shim file argument
- `--validate` checks schema (default: true)
- `--sign` signs after adding
- `--overwrite` replaces existing
- Returns exit code 0 on success, 2 on validation error

**✓ `crawl` Command**
- `--manifests-dir` specifies manifests location
- `--check-only` dry run
- `--platform` filters platforms
- `--parallel` sets worker count
- Takes optional tool names as arguments

**✓ `sync` Command**
- Requires registry URL argument
- `--verify-signatures` enables verification
- `--tools` filters tools
- `--force-refresh` ignores cache
- `--dry-run` previews sync

**✓ `sign` Command**
- Requires hash or file argument
- `--identity` and `--issuer` for keyless
- `--key` for key-based signing

**✓ `verify` Command**
- Requires hash or file argument
- `--identity` and `--issuer` specify expected signer

**✓ `catalog build` Command**
- Rebuilds catalog from shims
- `--output` specifies path

**✓ `catalog stats` Command**
- Shows coverage statistics
- JSON output format

**✓ `init` Command**
- Creates directory structure
- `--name` and `--url` configure registry
- `--require-signatures` sets trust policy

**✓ Exit Codes**
- 0: Success
- 1: Usage/argument error
- 2: Validation error
- 3: Fatal/network error

## Running Tests

### All Tests

```bash
cd reference/atip-registry
go test ./...
```

### Specific Package

```bash
go test ./internal/server
go test ./internal/registry
go test ./internal/crawler
go test ./internal/sync
go test ./internal/trust
go test ./cmd/atip-registry
```

### With Coverage

```bash
go test -cover ./...
```

### Verbose Output

```bash
go test -v ./...
```

### Generate Coverage Report

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Expected Failure Modes (RED Phase)

Currently, **all tests are expected to fail** because:

1. **Import errors**: Implementation files exist but contain only stubs
2. **"not implemented" errors**: All functions return `errors.New("not implemented")`
3. **Nil returns**: Functions return nil instead of actual data structures

### Example Failures

```
--- FAIL: TestServer_GetRegistryManifest (0.00s)
    server_test.go:29: Expected status 200, got 501 (Not Implemented)

--- FAIL: TestRegistry_Load (0.00s)
    registry_test.go:25: Expected no error, got: not implemented

--- FAIL: TestCrawler_LoadManifest (0.00s)
    crawler_test.go:20: Expected manifest, got: not implemented
```

This validates that:
- Tests compile successfully
- Tests actually test something (not just passing vacuously)
- We have clear requirements for the GREEN phase

## Test Fixtures

### `testdata/valid-shim.json`

Valid ATIP 0.6 shim with:
- `binary.hash` matching filename convention
- Complete command tree with options
- Effects metadata
- Trust information

### `testdata/invalid-shim.json`

Invalid shim missing required `version` field, for testing validation errors.

### `testdata/manifest.yaml`

Tool manifest for `jq` with:
- GitHub source configuration
- Asset patterns for multiple platforms
- JSON template for shim generation

### `testdata/registry-manifest.json`

Valid registry manifest with:
- ATIP 0.6 protocol version
- Endpoint URL templates
- Trust requirements

## Integration with BRGR

### Current Phase: RED

✅ Tests written
✅ Tests compile
✅ All tests fail (expected)

### Next Phase: GREEN

After RED phase completes:

1. Implement minimal server to pass HTTP tests
2. Implement registry operations to pass storage tests
3. Implement crawler to pass generation tests
4. Implement sync to pass synchronization tests
5. Implement trust wrappers to pass signature tests
6. Wire up CLI to pass command tests

### Success Criteria

Before moving to GREEN phase:
- [ ] All test files compile without errors
- [ ] All tests run and fail with clear "not implemented" messages
- [ ] No tests pass accidentally (would indicate weak test)
- [ ] Coverage goals documented and achievable

Before moving to REFACTOR phase:
- [ ] 100% of tests pass
- [ ] Coverage meets goals (>85% overall)
- [ ] All API contracts from `blue/api.md` validated
- [ ] All workflows from `blue/design.md` tested
- [ ] Real ATIP examples from `testdata/` used as fixtures

## Notes

- Tests use `httptest` for HTTP testing (no real server needed)
- Tests use `t.TempDir()` for isolated file operations
- Tests mock external dependencies (Cosign CLI, GitHub API)
- Tests include both positive and negative cases
- Tests use table-driven style where appropriate
- Tests validate against real ATIP schema (not mocked)
