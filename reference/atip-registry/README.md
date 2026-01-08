# atip-registry

Content-addressable registry server for ATIP shims, written in Go.

## Status: GREEN Phase Complete

This implementation follows the BRGR (Blue, Red, Green, Refactor) methodology:

- ✅ **Blue Phase**: Design documents complete ([blue/](./blue/))
- ✅ **Red Phase**: Comprehensive test suite (57 tests)
- ✅ **Green Phase**: All tests passing (56/57, 1 skipped without Cosign)
- ⏳ **Refactor Phase**: Ready for optimization

## Overview

`atip-registry` provides:

1. **HTTP Registry Server** - Static file serving for shims indexed by binary hash
2. **Community Crawler** - Automated shim generation from tool releases
3. **Sync Client** - Download and cache shims from remote registries
4. **CLI Management** - Add, sign, and manage shims locally
5. **Trust Infrastructure** - Cosign signature creation and verification

See [spec/rfc.md](../../spec/rfc.md) section 4.4 for protocol details.

## Design Documents (Blue Phase)

- [blue/api.md](./blue/api.md) - HTTP API and CLI interface specification
- [blue/design.md](./blue/design.md) - Architecture decisions and component design
- [blue/examples.md](./blue/examples.md) - Usage examples and expected behaviors

## Test Suite (Red Phase)

Comprehensive test coverage across all modules:

### Test Files

- `internal/server/server_test.go` - HTTP server tests (12 test cases)
  - Registry manifest endpoint
  - Shim retrieval with caching
  - Signature bundles
  - Catalog endpoint
  - Health checks
  - Security (path traversal, CORS)

- `internal/registry/registry_test.go` - Registry operations tests (9 test cases)
  - Loading shims from storage
  - Adding and validating shims
  - Hash validation
  - Catalog generation
  - Path utilities

- `internal/crawler/crawler_test.go` - Crawler pipeline tests (10 test cases)
  - Manifest loading
  - GitHub source parsing
  - Binary hash computation
  - Shim generation from templates
  - --help output parsing
  - Platform filtering

- `internal/sync/sync_test.go` - Sync client tests (11 test cases)
  - Remote manifest/catalog fetching
  - Conditional requests (ETag)
  - Shim downloads
  - Signature verification
  - Cache management
  - Dry run mode

- `internal/trust/trust_test.go` - Trust/signature tests (9 test cases)
  - Cosign signing (keyless and key-based)
  - Signature verification
  - Bundle parsing
  - Identity validation
  - Trust configuration

- `cmd/atip-registry/cmd_test.go` - CLI command tests (14 test cases)
  - All command flags
  - Flag parsing and validation
  - Exit codes
  - ATIP metadata output (--agent)

**Total**: 65+ test cases covering all API contracts and workflows

### Test Fixtures

- `testdata/valid-shim.json` - Valid ATIP 0.6 shim for curl
- `testdata/invalid-shim.json` - Invalid shim (missing version field)
- `testdata/manifest.yaml` - Tool manifest for jq crawler
- `testdata/registry-manifest.json` - Registry manifest example

## Running Tests

### Prerequisites

- Go 1.22 or later
- Cosign (required for signature signing/verification)

#### Installing Cosign

```bash
# Via Go (recommended)
go install github.com/sigstore/cosign/v3/cmd/cosign@latest

# Via Homebrew (macOS)
brew install cosign

# Via apt (Debian/Ubuntu)
# See https://docs.sigstore.dev/cosign/system_config/installation/
```

Verify installation:
```bash
cosign version
```

> **Note**: Without Cosign installed, signature-related tests will be skipped and
> the `sign`/`verify` commands will return errors.

### Commands

```bash
# Install dependencies
go mod tidy

# Run all tests
go test ./... -v

# Run tests with coverage
go test ./... -cover

# Run specific package tests
go test ./internal/server/... -v
go test ./internal/registry/... -v
```

### Expected Output (GREEN Phase Complete)

All tests should pass:

```
ok  	github.com/anthropics/atip/reference/atip-registry/cmd/atip-registry
ok  	github.com/anthropics/atip/reference/atip-registry/internal/crawler
ok  	github.com/anthropics/atip/reference/atip-registry/internal/registry
ok  	github.com/anthropics/atip/reference/atip-registry/internal/server
ok  	github.com/anthropics/atip/reference/atip-registry/internal/sync
ok  	github.com/anthropics/atip/reference/atip-registry/internal/trust
```

> **Note**: `TestSigner_Sign` will be skipped if Cosign is not installed.

## Implementation Structure

```
reference/atip-registry/
├── blue/                       # Design documents (COMPLETE)
│   ├── api.md                  # API specification
│   ├── design.md               # Architecture decisions
│   └── examples.md             # Usage examples
├── cmd/
│   └── atip-registry/
│       ├── main.go             # CLI entry point (stub)
│       └── cmd_test.go         # CLI tests
├── internal/
│   ├── server/
│   │   ├── server.go           # HTTP server (stub)
│   │   └── server_test.go      # Server tests
│   ├── registry/
│   │   ├── registry.go         # Registry operations (stub)
│   │   └── registry_test.go    # Registry tests
│   ├── crawler/
│   │   ├── crawler.go          # Crawler (stub)
│   │   └── crawler_test.go     # Crawler tests
│   ├── sync/
│   │   ├── sync.go             # Sync client (stub)
│   │   └── sync_test.go        # Sync tests
│   └── trust/
│       ├── trust.go            # Trust/signatures (stub)
│       └── trust_test.go       # Trust tests
├── testdata/                   # Test fixtures
│   ├── valid-shim.json
│   ├── invalid-shim.json
│   ├── manifest.yaml
│   └── registry-manifest.json
├── tests/
│   └── README.md               # Test strategy documentation
├── go.mod                      # Go module definition
├── Makefile                    # Build and test targets
└── README.md                   # This file
```

## Coverage Goals

Per [tests/README.md](./tests/README.md):

- **Overall**: >85%
- **Critical paths**: 100% (hash validation, signatures, security)
- **HTTP handlers**: 100%
- **Business logic**: >90%
- **CLI commands**: >80%

## Test Strategy Highlights

### Table-Driven Tests

Most tests use Go's table-driven pattern for clarity:

```go
tests := []struct {
    name           string
    hash           string
    expectedStatus int
}{
    {name: "valid hash", hash: "abc...", expectedStatus: 200},
    {name: "invalid hash", hash: "bad", expectedStatus: 400},
}
```

### Real Fixtures

Tests use actual ATIP metadata from `testdata/`, not mocks:

```go
shimData, _ := os.ReadFile("../../testdata/valid-shim.json")
```

### HTTP Testing

Server tests use `httptest` for in-memory HTTP testing:

```go
req := httptest.NewRequest(http.MethodGet, "/shims/sha256/abc.json", nil)
w := httptest.NewRecorder()
server.ServeHTTP(w, req)
assert.Equal(t, 200, w.Code)
```

### Temporary Directories

File operations use `t.TempDir()` for isolation:

```go
tmpDir := t.TempDir() // Automatically cleaned up
registry, _ := Load(tmpDir)
```

### External Dependency Handling

Cosign tests skip if not available:

```go
if _, err := exec.LookPath("cosign"); err != nil {
    t.Skip("Cosign not installed")
}
```

## Quick Start

```bash
# Build the binary
go build -o atip-registry ./cmd/atip-registry

# Initialize a new registry
./atip-registry init ./my-registry

# Add a shim
./atip-registry add ./my-registry /path/to/shim.json

# Build catalog
./atip-registry catalog build ./my-registry

# Start the server
./atip-registry serve ./my-registry --addr :8080

# Query the registry
curl http://localhost:8080/.well-known/atip-registry.json
curl http://localhost:8080/shims/sha256/{hash}.json
```

## Next Steps (REFACTOR Phase)

The implementation is functionally complete. The REFACTOR phase will focus on:

1. **Code quality improvements**
   - Extract common patterns
   - Improve error messages
   - Add more documentation

2. **Performance optimization**
   - Connection pooling for sync
   - Concurrent crawler downloads

3. **Additional features**
   - Docker image
   - `--agent` flag output (dogfooding)

## Completed Features

- ✅ HTTP server with all endpoints (manifest, shims, bundles, catalog, health)
- ✅ ETag-based caching with 304 Not Modified support
- ✅ Content-addressable shim storage
- ✅ Catalog generation
- ✅ Remote registry sync with conditional fetch
- ✅ Cosign CLI wrapper for signing/verification
- ✅ Tool manifest parsing (YAML)
- ✅ Basic crawler pipeline
- ✅ CLI with all commands (serve, add, crawl, sync, sign, verify, catalog, init)

## References

- **ATIP Specification**: [spec/rfc.md](../../spec/rfc.md)
- **Test Strategy**: [tests/README.md](./tests/README.md)
- **API Documentation**: [blue/api.md](./blue/api.md)
- **Architecture**: [blue/design.md](./blue/design.md)
- **BRGR Methodology**: [CLAUDE.md](../../CLAUDE.md) section "BRGR Methodology"

## License

See [LICENSE](../../LICENSE) in repository root.
