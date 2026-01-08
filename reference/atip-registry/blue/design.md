# Design Document: atip-registry

## Architecture Overview

```
                              ┌────────────────────────────────────────┐
                              │            atip-registry               │
                              │             (CLI Entry)                │
                              └───────────────────┬────────────────────┘
                                                  │
        ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
        │                     │                   │                   │                     │
        ▼                     ▼                   ▼                   ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Server    │    │   Crawler    │    │     Sync     │    │    Trust     │    │   Catalog    │
│              │    │              │    │              │    │              │    │              │
│ • HTTP       │    │ • Sources    │    │ • Fetcher    │    │ • Cosign     │    │ • Builder    │
│ • Router     │    │ • Generator  │    │ • Cache      │    │ • Verifier   │    │ • Index      │
│ • Caching    │    │ • Parser     │    │ • Differ     │    │ • Signer     │    │ • Stats      │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │                   │                   │
       │                   │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┴───────────────────┘
                                               │
                                               ▼
                           ┌───────────────────────────────────────────┐
                           │              Storage Layer                 │
                           │                                           │
                           │  data/                                    │
                           │  ├── .well-known/                         │
                           │  │   └── atip-registry.json               │
                           │  ├── shims/                               │
                           │  │   ├── sha256/                          │
                           │  │   │   ├── a1b2c3d4....json            │
                           │  │   │   ├── a1b2c3d4....json.bundle     │
                           │  │   │   └── ...                          │
                           │  │   └── index.json                       │
                           │  └── manifests/                           │
                           │      ├── curl.yaml                        │
                           │      └── gh.yaml                          │
                           └───────────────────────────────────────────┘
```

The registry is organized into five main functional areas:

1. **Server** - HTTP server for static file serving with caching
2. **Crawler** - Automated shim generation from tool releases
3. **Sync** - Download and cache shims from remote registries
4. **Trust** - Signature creation and verification via Cosign
5. **Catalog** - Index building and statistics

---

## Components

### 1. CLI Module (`cmd/atip-registry/`)

**Responsibility**: Parse command-line arguments and dispatch to appropriate handlers.

**Rationale**: Separating CLI parsing from business logic allows:
- Unit testing of core logic without CLI overhead
- Future addition of new commands
- Consistent flag handling across commands

**Dependencies**:
- `internal/server` - HTTP serving
- `internal/crawler` - Shim generation
- `internal/sync` - Registry synchronization
- `internal/trust` - Signature operations
- `internal/catalog` - Index management

#### Files

| File | Purpose |
|------|---------|
| `main.go` | Entry point, global flag setup |
| `serve.go` | `serve` command handler |
| `add.go` | `add` command handler |
| `sign.go` | `sign` command handler |
| `verify.go` | `verify` command handler |
| `crawl.go` | `crawl` command handler |
| `sync.go` | `sync` command handler |
| `catalog.go` | `catalog` subcommand handlers |
| `init.go` | `init` command handler |

### 2. Server Module (`internal/server/`)

**Responsibility**: Serve shims via HTTP with proper caching.

**Rationale**: Static file serving with content-addressable storage:
- Immutable resources can have aggressive caching
- ETag support for conditional requests
- Simple architecture - no database needed

**Dependencies**:
- `internal/storage` - File access
- `internal/catalog` - Index loading

#### Files

| File | Purpose |
|------|---------|
| `server.go` | HTTP server setup and lifecycle |
| `router.go` | Route definitions |
| `handlers.go` | Request handlers |
| `middleware.go` | Caching, CORS, logging middleware |
| `response.go` | Response formatting |

### 3. Crawler Module (`internal/crawler/`)

**Responsibility**: Generate shims from tool releases.

**Rationale**: Per spec section 4.10, the crawler automates shim creation:
- Reduces manual effort for common tools
- Ensures consistent shim format
- Enables tracking new releases automatically

**Dependencies**:
- `internal/sources` - Release discovery
- `internal/generator` - Shim generation
- `internal/validator` - Schema validation

#### Files

| File | Purpose |
|------|---------|
| `crawler.go` | Main crawler orchestration |
| `manifest.go` | Tool manifest parsing |
| `pipeline.go` | Download/hash/generate pipeline |
| `worker.go` | Parallel worker pool |

### 4. Sources Module (`internal/sources/`)

**Responsibility**: Fetch binaries from various release sources.

**Rationale**: Tools are distributed through different channels:
- GitHub Releases (most common)
- Homebrew (macOS)
- APT/DNF (Linux)
- Direct URLs

**Dependencies**: None (external HTTP calls)

#### Files

| File | Purpose |
|------|---------|
| `github.go` | GitHub Releases API |
| `homebrew.go` | Homebrew formula parsing |
| `apt.go` | APT repository queries |
| `direct.go` | Direct URL downloads |
| `archive.go` | Archive extraction (tar, zip) |

### 5. Generator Module (`internal/generator/`)

**Responsibility**: Create shim JSON from templates and `--help` parsing.

**Rationale**: Per spec section 4.10.4:
- Templates provide baseline metadata
- `--help` parsing extracts options
- Combines for complete shim

**Dependencies**:
- `internal/validator` - Schema validation

#### Files

| File | Purpose |
|------|---------|
| `generator.go` | Shim generation logic |
| `template.go` | Template processing |
| `parser.go` | --help output parsing |
| `merger.go` | Combine template + parsed data |

### 6. Sync Module (`internal/sync/`)

**Responsibility**: Synchronize shims from remote registries.

**Rationale**: Per spec section 4.7:
- Conditional requests with ETag
- Signature verification
- Local caching

**Dependencies**:
- `internal/storage` - Local file access
- `internal/trust` - Signature verification

#### Files

| File | Purpose |
|------|---------|
| `sync.go` | Main sync orchestration |
| `fetcher.go` | HTTP fetching with caching |
| `differ.go` | Compare local vs remote catalogs |
| `cache.go` | ETag and metadata caching |

### 7. Trust Module (`internal/trust/`)

**Responsibility**: Signature creation and verification.

**Rationale**: Per spec sections 3.2.2 and 4.4:
- Cosign for keyless signatures
- OIDC identity verification
- Bundle format compatibility

**Dependencies**: Cosign CLI (external)

#### Files

| File | Purpose |
|------|---------|
| `signer.go` | Sign shims with Cosign |
| `verifier.go` | Verify shim signatures |
| `cosign.go` | Cosign CLI wrapper |
| `bundle.go` | Bundle file handling |

### 8. Catalog Module (`internal/catalog/`)

**Responsibility**: Build and manage the catalog index.

**Rationale**: Per spec section 4.4.4:
- Provides browsable tool listing
- Maps tool/version/platform to hash
- Tracks coverage statistics

**Dependencies**:
- `internal/storage` - Shim file access

#### Files

| File | Purpose |
|------|---------|
| `catalog.go` | Catalog data structure |
| `builder.go` | Build catalog from shims |
| `stats.go` | Coverage statistics |

### 9. Storage Module (`internal/storage/`)

**Responsibility**: Abstraction over file storage.

**Rationale**: Support multiple backends:
- Filesystem for simple deployments
- S3 for cloud deployments
- Consistent interface for both

**Dependencies**: None

#### Files

| File | Purpose |
|------|---------|
| `storage.go` | Storage interface |
| `filesystem.go` | Local filesystem backend |
| `s3.go` | S3 backend (optional) |

### 10. Validator Module (`internal/validator/`)

**Responsibility**: Validate shims against ATIP schema.

**Rationale**: Ensures data integrity:
- All shims validate against schema
- Consistent error messages
- Embedded schema for portability

**Dependencies**: None (uses embedded schema)

#### Files

| File | Purpose |
|------|---------|
| `validator.go` | JSON Schema validation |
| `schema.go` | Embedded ATIP 0.6 schema |

---

## Design Decisions

### Decision: Go as Implementation Language

**Context**: Registry needs to be deployable as single binary with good HTTP performance.

**Options Considered**:
1. **Go** - Fast, single binary, excellent HTTP stdlib
2. **Rust** - Similar benefits, more complex
3. **Node.js** - Fast development, needs runtime

**Decision**: Go

**Rationale**:
- Per TODO.md: "Go, single binary, good for deployment, handles hash lookups"
- `net/http` provides production-quality HTTP server
- Cross-compilation trivial
- Consistent with atip-discover-go
- Widely used for registry servers (Docker Registry, OCI)

### Decision: Static File Serving (vs Dynamic)

**Context**: Per spec section 4.4, registries are "static file hosts organized by hash."

**Options Considered**:
1. **Dynamic database-backed server** - Flexible queries, complex
2. **Static file server with index** - Simple, cacheable, per spec
3. **Hybrid** - Database for search, files for content

**Decision**: Static file server with in-memory index.

**Rationale**:
- Spec explicitly describes static file layout
- Content-addressable storage is naturally static
- No database means simpler deployment
- Aggressive caching possible (immutable resources)
- Index loaded at startup, rebuilt when needed

**Implementation**:
```go
// Server holds the registry state
type Server struct {
    storage Storage
    catalog *Catalog // Loaded at startup
    trust   *TrustConfig
    router  *http.ServeMux
}

func (s *Server) handleShim(w http.ResponseWriter, r *http.Request) {
    hash := extractHash(r.URL.Path)

    // Check ETag for conditional request
    etag := s.catalog.GetETag(hash)
    if r.Header.Get("If-None-Match") == etag {
        w.WriteHeader(http.StatusNotModified)
        return
    }

    // Serve static file
    data, err := s.storage.Read(shimPath(hash))
    if err != nil {
        http.NotFound(w, r)
        return
    }

    // Set caching headers per spec 4.7
    w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
    w.Header().Set("ETag", etag)
    w.Header().Set("Content-Type", "application/json")
    w.Write(data)
}
```

### Decision: Content-Addressable Storage Layout

**Context**: Per spec section 4.1, shims are indexed by binary hash.

**Options Considered**:
1. **Flat directory** - Simple, but slow with many files
2. **Nested by prefix** - e.g., `/ab/cd/abcd1234.json`
3. **Single level by hash** - `/sha256/abcd1234.json`

**Decision**: Single level with `sha256/` prefix (per spec 4.4.1).

**Rationale**:
- Matches spec exactly: `/shims/sha256/{hash}.json`
- Filesystems handle 10K+ files in single directory
- Simpler than nested structure
- Hash prefix already provides namespace

**Implementation**:
```go
// Storage layout
func shimPath(hash string) string {
    // Input: "sha256:a1b2c3d4..."
    // Output: "shims/sha256/a1b2c3d4....json"
    hashValue := strings.TrimPrefix(hash, "sha256:")
    return filepath.Join("shims", "sha256", hashValue+".json")
}

func bundlePath(hash string) string {
    return shimPath(hash) + ".bundle"
}
```

### Decision: Catalog as In-Memory Index

**Context**: Need to map tool names to hashes for browsing.

**Options Considered**:
1. **Database (SQLite/BoltDB)** - Query flexibility, persistence
2. **In-memory map** - Fast, rebuild on startup
3. **File-based index** - index.json, load on demand

**Decision**: In-memory map loaded from `index.json` at startup.

**Rationale**:
- Catalog is derived data (can be rebuilt from shims)
- In-memory is fastest for lookups
- `index.json` persists for clients who want browsable list
- Rebuild is O(n) over shim files, acceptable

**Implementation**:
```go
type Catalog struct {
    mu       sync.RWMutex
    tools    map[string]*ToolInfo       // name -> info
    hashes   map[string]*Shim           // hash -> shim metadata
    updated  time.Time
}

func (c *Catalog) LookupByName(name, version, platform string) (string, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()

    tool, ok := c.tools[name]
    if !ok {
        return "", false
    }

    versions, ok := tool.Versions[version]
    if !ok {
        return "", false
    }

    hash, ok := versions[platform]
    return hash, ok
}
```

### Decision: Cosign via CLI (vs Library)

**Context**: Need to sign and verify shims with Sigstore.

**Options Considered**:
1. **Cosign CLI** - Shell out to `cosign` binary
2. **Sigstore Go library** - Direct integration
3. **Custom implementation** - Full control, high effort

**Decision**: Cosign CLI wrapper.

**Rationale**:
- Cosign CLI is stable and well-tested
- Library API changes frequently
- CLI already handles OIDC flows
- Users already have Cosign installed for other purposes
- Reduces binary size (no embedded Sigstore deps)

**Implementation**:
```go
func (s *Signer) Sign(shimPath string) error {
    bundlePath := shimPath + ".bundle"

    cmd := exec.Command("cosign", "sign-blob",
        "--yes", // Non-interactive
        "--output-bundle", bundlePath,
        shimPath,
    )

    // Keyless signing uses OIDC
    cmd.Env = append(os.Environ(), "COSIGN_EXPERIMENTAL=1")

    output, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("cosign failed: %s: %w", output, err)
    }

    return nil
}

func (v *Verifier) Verify(shimPath string, expected Signer) error {
    bundlePath := shimPath + ".bundle"

    cmd := exec.Command("cosign", "verify-blob",
        "--certificate-identity", expected.Identity,
        "--certificate-oidc-issuer", expected.Issuer,
        "--bundle", bundlePath,
        shimPath,
    )

    output, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("verification failed: %s: %w", output, err)
    }

    return nil
}
```

### Decision: Crawler Pipeline Architecture

**Context**: Per spec 4.10, crawler fetches releases and generates shims.

**Options Considered**:
1. **Sequential processing** - Simple, slow
2. **Parallel with goroutines** - Fast, complex error handling
3. **Pipeline with stages** - Structured, controllable

**Decision**: Pipeline with configurable parallelism.

**Rationale**:
- Each stage has different characteristics:
  - Discovery: API rate limits
  - Download: Network-bound
  - Hash: CPU-bound
  - Generate: CPU-bound
- Pipeline allows backpressure
- Easier to debug and monitor

**Implementation**:
```go
type Pipeline struct {
    sources   []Source
    generator *Generator
    validator *Validator
    workers   int
}

func (p *Pipeline) Crawl(ctx context.Context, tools []string) *CrawlResult {
    // Stage 1: Discover releases
    releases := make(chan Release, 100)
    go p.discoverReleases(ctx, tools, releases)

    // Stage 2: Download binaries (parallel)
    binaries := make(chan Binary, 100)
    var wg sync.WaitGroup
    for i := 0; i < p.workers; i++ {
        wg.Add(1)
        go p.downloadWorker(ctx, releases, binaries, &wg)
    }
    go func() {
        wg.Wait()
        close(binaries)
    }()

    // Stage 3: Generate shims
    shims := make(chan *Shim, 100)
    go p.generateShims(ctx, binaries, shims)

    // Collect results
    return p.collectResults(shims)
}
```

### Decision: --help Parsing Strategy

**Context**: Per spec 4.10.4, crawler can generate shims from `--help`.

**Options Considered**:
1. **Regex patterns** - Fast, fragile
2. **LLM-assisted** - Accurate, expensive
3. **Heuristic parser** - Balanced, maintainable

**Decision**: Heuristic parser with LLM fallback (optional).

**Rationale**:
- Most tools follow common patterns
- Regex handles 80% of cases
- LLM can be used for complex tools
- Generated shims are marked `trust.source: "inferred"`

**Implementation**:
```go
func (p *Parser) Parse(helpOutput string) (*ParsedOptions, error) {
    options := &ParsedOptions{
        Options: make([]Option, 0),
    }

    // Try structured patterns first
    // Pattern: -x, --extended TYPE  Description
    optionRe := regexp.MustCompile(
        `^\s*(-\w),?\s*(--[\w-]+)?\s*(?:<(\w+)>)?\s+(.+)$`)

    for _, line := range strings.Split(helpOutput, "\n") {
        if matches := optionRe.FindStringSubmatch(line); matches != nil {
            options.Options = append(options.Options, Option{
                Flags:       filterEmpty(matches[1], matches[2]),
                Type:        inferType(matches[3]),
                Description: strings.TrimSpace(matches[4]),
            })
        }
    }

    return options, nil
}

func inferType(hint string) string {
    hint = strings.ToLower(hint)
    switch {
    case hint == "" || hint == "true" || hint == "false":
        return "boolean"
    case strings.Contains(hint, "file") || strings.Contains(hint, "path"):
        return "file"
    case strings.Contains(hint, "int") || strings.Contains(hint, "num"):
        return "integer"
    default:
        return "string"
    }
}
```

### Decision: HTTP Caching Strategy

**Context**: Per spec 4.7, registry must support proper caching.

**Options Considered**:
1. **No caching** - Simple, inefficient
2. **Cache-Control only** - Time-based expiry
3. **ETag + Cache-Control** - Conditional requests, efficient

**Decision**: ETag + Cache-Control with per-resource policies.

**Rationale**:
- Shims are immutable (same hash = same content forever)
- But shim metadata may be updated (docs fixes)
- ETag allows conditional refresh
- Aggressive caching for static content

**Implementation**:
```go
// Caching policies per resource type
var cachePolicies = map[string]CachePolicy{
    "manifest": {
        MaxAge:    3600,  // 1 hour
        Immutable: false,
    },
    "shim": {
        MaxAge:    86400, // 24 hours
        Immutable: true,  // Hash guarantees content
    },
    "bundle": {
        MaxAge:    86400,
        Immutable: true,
    },
    "catalog": {
        MaxAge:    3600,  // 1 hour (changes when shims added)
        Immutable: false,
    },
}

func (m *CacheMiddleware) Handle(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        policy := m.policyFor(r.URL.Path)

        // Set Cache-Control
        cc := fmt.Sprintf("public, max-age=%d", policy.MaxAge)
        if policy.Immutable {
            cc += ", immutable"
        }
        w.Header().Set("Cache-Control", cc)

        // ETag for conditional requests
        etag := m.computeETag(r.URL.Path)
        w.Header().Set("ETag", etag)

        if r.Header.Get("If-None-Match") == etag {
            w.WriteHeader(http.StatusNotModified)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

### Decision: Sync Conflict Resolution

**Context**: Local registry may have shims that differ from remote.

**Options Considered**:
1. **Remote wins** - Always overwrite local
2. **Local wins** - Never overwrite local
3. **Merge with policy** - Configurable behavior

**Decision**: Remote wins for matching hashes, skip local-only.

**Rationale**:
- Same hash = same binary, shim can be updated
- Local-only shims (custom tools) preserved
- Simple mental model
- Matches spec's "shim metadata may be updated" (4.7)

**Implementation**:
```go
func (s *Syncer) Sync(ctx context.Context, remote *Registry) *SyncResult {
    result := &SyncResult{}

    remoteCatalog, err := s.fetchCatalog(remote)
    if err != nil {
        return result.WithError(err)
    }

    for hash, remoteInfo := range remoteCatalog.Hashes() {
        local, exists := s.catalog.Get(hash)

        if !exists {
            // New shim - download
            if err := s.downloadShim(ctx, remote, hash); err != nil {
                result.AddError(hash, err)
                continue
            }
            result.Added++
        } else if s.needsUpdate(local, remoteInfo) {
            // Existing shim - check for updates
            if err := s.updateShim(ctx, remote, hash); err != nil {
                result.AddError(hash, err)
                continue
            }
            result.Updated++
        } else {
            result.Unchanged++
        }
    }

    return result
}

func (s *Syncer) needsUpdate(local, remote *ShimInfo) bool {
    // Use ETag to check if content changed
    return local.ETag != remote.ETag
}
```

---

## Data Flow

### Server Request Flow

```
Client: GET /shims/sha256/a1b2c3d4....json
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  HTTP Server                                                     │
│  ├── Middleware: Logging                                         │
│  ├── Middleware: CORS                                            │
│  └── Middleware: Cache Headers                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Router                                                          │
│  Match: /shims/sha256/{hash}.json                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Handler: GetShim                                                │
│  1. Extract hash from path                                       │
│  2. Validate hash format (64 hex chars)                          │
│  3. Check If-None-Match header                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  ETag Match         │         │  No Match / No ETag │
│  Return 304         │         │                     │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │  Storage: Read Shim    │
                              │  Path: shims/sha256/   │
                              │        {hash}.json     │
                              └──────────┬─────────────┘
                                         │
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
               ┌─────────────────────┐      ┌─────────────────────┐
               │  Found              │      │  Not Found          │
               │  Return 200 + body  │      │  Return 404         │
               └─────────────────────┘      └─────────────────────┘
```

### Crawler Pipeline Flow

```
atip-registry crawl curl
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Load Manifests                                                  │
│  manifests/curl.yaml                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 1: Discover Releases                                      │
│  ├── Query GitHub API: curl/curl                                 │
│  ├── Query Homebrew: formula/curl                                │
│  └── Filter: New versions not in catalog                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 2: Download Binaries (parallel)                           │
│  ├── Worker 1: curl-8.5.0-linux-x86_64.tar.gz                   │
│  ├── Worker 2: curl-8.5.0-darwin-arm64.tar.gz                   │
│  └── Extract binary from archive                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 3: Compute Hashes                                         │
│  ├── SHA-256(curl-linux-x86_64) → a1b2c3d4...                   │
│  └── SHA-256(curl-darwin-arm64) → b2c3d4e5...                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 4: Generate Shims                                         │
│  ├── Load template from manifest                                 │
│  ├── Run ./curl --help (optional)                                │
│  ├── Parse options from --help                                   │
│  ├── Merge template + parsed options                             │
│  └── Add binary.hash, binary.platform fields                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 5: Validate                                               │
│  ├── Validate against ATIP 0.6 schema                            │
│  └── Verify binary.hash matches computed hash                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 6: Output                                                 │
│  ├── Write shims/sha256/{hash}.json                              │
│  ├── Optionally sign with Cosign                                 │
│  └── Update catalog index                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Flow

```
atip-registry sync https://atip.dev
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Fetch Remote Manifest                                           │
│  GET https://atip.dev/.well-known/atip-registry.json             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Fetch Remote Catalog                                            │
│  GET https://atip.dev/shims/index.json                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Compare Catalogs                                                │
│  ├── New hashes in remote: add to download queue                 │
│  ├── Updated ETags: add to update queue                          │
│  └── Local-only hashes: skip                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Download Shims (parallel)                                       │
│  ├── GET /shims/sha256/{hash}.json (with If-None-Match)          │
│  ├── GET /shims/sha256/{hash}.json.bundle (if requireSignatures) │
│  └── Verify signatures                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Update Local Storage                                            │
│  ├── Write shims to shims/sha256/                                │
│  ├── Write bundles to shims/sha256/                              │
│  └── Rebuild catalog index                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling Strategy

### Error Types

```go
// RegistryError is the base error type.
type RegistryError struct {
    Op      string // "fetch", "store", "validate", "sign"
    Path    string // Resource path
    Err     error
}

func (e *RegistryError) Error() string {
    return fmt.Sprintf("%s %s: %v", e.Op, e.Path, e.Err)
}

func (e *RegistryError) Unwrap() error {
    return e.Err
}

// Specific error types
var (
    ErrNotFound       = errors.New("not found")
    ErrInvalidHash    = errors.New("invalid hash format")
    ErrValidation     = errors.New("validation failed")
    ErrSignature      = errors.New("signature verification failed")
    ErrHashMismatch   = errors.New("hash mismatch")
)
```

### HTTP Error Responses

```go
type APIError struct {
    Error   string `json:"error"`
    Message string `json:"message"`
    Details any    `json:"details,omitempty"`
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(APIError{
        Error:   code,
        Message: msg,
    })
}

// Error handler mapping
func errorToStatus(err error) (int, string, string) {
    switch {
    case errors.Is(err, ErrNotFound):
        return 404, "not_found", err.Error()
    case errors.Is(err, ErrInvalidHash):
        return 400, "invalid_hash", err.Error()
    case errors.Is(err, ErrValidation):
        return 400, "validation_error", err.Error()
    default:
        return 500, "internal_error", "internal server error"
    }
}
```

### Crawler Error Collection

```go
type CrawlResult struct {
    Crawled  int           `json:"crawled"`
    Shims    int           `json:"shims_generated"`
    Errors   []CrawlError  `json:"errors"`
    Duration time.Duration `json:"duration_ms"`
}

type CrawlError struct {
    Tool    string `json:"tool"`
    Version string `json:"version,omitempty"`
    Stage   string `json:"stage"` // "discover", "download", "generate"
    Error   string `json:"error"`
}

// Crawl continues on errors, collecting them
func (p *Pipeline) Crawl(ctx context.Context, tools []string) *CrawlResult {
    result := &CrawlResult{}

    for _, tool := range tools {
        releases, err := p.discover(tool)
        if err != nil {
            result.Errors = append(result.Errors, CrawlError{
                Tool:  tool,
                Stage: "discover",
                Error: err.Error(),
            })
            continue // Try next tool
        }

        // ... continue with successful tools
    }

    return result
}
```

---

## Security Considerations

### Input Validation

```go
// Hash format validation
var hashRegex = regexp.MustCompile(`^[a-f0-9]{64}$`)

func validateHash(hash string) error {
    if !hashRegex.MatchString(hash) {
        return fmt.Errorf("%w: must be 64 lowercase hex characters", ErrInvalidHash)
    }
    return nil
}

// Path traversal prevention
func safePath(base, requested string) (string, error) {
    // Join and clean
    full := filepath.Join(base, requested)

    // Ensure still under base
    if !strings.HasPrefix(full, filepath.Clean(base)+string(os.PathSeparator)) {
        return "", fmt.Errorf("path traversal attempt: %s", requested)
    }

    return full, nil
}
```

### Signature Verification

Per spec 3.2.2, verification is critical for trust:

```go
func (s *Server) handleShimWithTrust(w http.ResponseWriter, r *http.Request) {
    hash := extractHash(r.URL.Path)

    // Load shim
    shimData, err := s.storage.Read(shimPath(hash))
    if err != nil {
        writeError(w, 404, "not_found", "shim not found")
        return
    }

    // If registry requires signatures, verify
    if s.trust.RequireSignatures {
        bundleData, err := s.storage.Read(bundlePath(hash))
        if err != nil {
            writeError(w, 500, "signature_missing", "signature bundle not found")
            return
        }

        if err := s.verifier.Verify(shimPath(hash), s.trust.Signers); err != nil {
            writeError(w, 500, "signature_invalid", "signature verification failed")
            return
        }
    }

    // Serve verified shim
    w.Header().Set("Content-Type", "application/json")
    w.Write(shimData)
}
```

### Rate Limiting (Optional)

For public registries, rate limiting prevents abuse:

```go
type RateLimiter struct {
    limiter *rate.Limiter
    perIP   map[string]*rate.Limiter
    mu      sync.Mutex
}

func (rl *RateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    limiter, ok := rl.perIP[ip]
    if !ok {
        limiter = rate.NewLimiter(100, 1000) // 100 req/s, burst 1000
        rl.perIP[ip] = limiter
    }
    rl.mu.Unlock()

    return limiter.Allow()
}
```

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Shim lookup | O(1) | Direct file access by hash |
| Catalog load | O(n) | n = number of shims |
| Catalog rebuild | O(n) | n = number of shims |
| Sync | O(m) | m = changed shims |
| Crawl (per tool) | O(p) | p = platforms |

### Space Complexity

| Component | Size | Notes |
|-----------|------|-------|
| Shim file | ~1-50KB | Depends on command count |
| Bundle file | ~1-2KB | Cosign signature |
| Catalog | O(n * 100B) | n = shims |
| In-memory index | O(n * 200B) | n = shims |

### Optimization Opportunities

1. **Shim compression**: gzip large shims
2. **Catalog pagination**: For very large registries
3. **Lazy loading**: Only parse shims on demand
4. **CDN fronting**: Use CDN for static content
5. **Signature caching**: Cache verification results

---

## File Structure

```
reference/atip-registry/
├── blue/
│   ├── api.md           # HTTP and CLI interface specification
│   ├── design.md        # This design document
│   └── examples.md      # Usage examples
├── cmd/
│   └── atip-registry/
│       ├── main.go      # Entry point
│       ├── serve.go     # serve command
│       ├── add.go       # add command
│       ├── sign.go      # sign command
│       ├── verify.go    # verify command
│       ├── crawl.go     # crawl command
│       ├── sync.go      # sync command
│       ├── catalog.go   # catalog subcommands
│       └── init.go      # init command
├── internal/
│   ├── server/
│   │   ├── server.go
│   │   ├── router.go
│   │   ├── handlers.go
│   │   └── middleware.go
│   ├── crawler/
│   │   ├── crawler.go
│   │   ├── manifest.go
│   │   ├── pipeline.go
│   │   └── worker.go
│   ├── sources/
│   │   ├── github.go
│   │   ├── homebrew.go
│   │   ├── apt.go
│   │   └── archive.go
│   ├── generator/
│   │   ├── generator.go
│   │   ├── template.go
│   │   ├── parser.go
│   │   └── merger.go
│   ├── sync/
│   │   ├── sync.go
│   │   ├── fetcher.go
│   │   ├── differ.go
│   │   └── cache.go
│   ├── trust/
│   │   ├── signer.go
│   │   ├── verifier.go
│   │   ├── cosign.go
│   │   └── bundle.go
│   ├── catalog/
│   │   ├── catalog.go
│   │   ├── builder.go
│   │   └── stats.go
│   ├── storage/
│   │   ├── storage.go
│   │   ├── filesystem.go
│   │   └── s3.go
│   ├── validator/
│   │   ├── validator.go
│   │   └── schema.go
│   └── config/
│       └── config.go
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── testdata/
│   ├── shims/           # Test shim files
│   ├── manifests/       # Test manifests
│   └── schemas/         # Test schemas
├── go.mod
├── go.sum
├── Makefile
├── Dockerfile
└── README.md
```

---

## Future Extensions

### Additional Storage Backends

- **S3/GCS/Azure Blob**: Cloud object storage
- **OCI Registry**: Store shims as OCI artifacts
- **IPFS**: Distributed content-addressable storage

### Enhanced Crawler Sources

- **NPM Registry**: For Node.js tools
- **PyPI**: For Python tools
- **Crates.io**: For Rust tools
- **Container registries**: Extract tools from images

### Federation

Multiple registries could federate:
- Shared catalog with distributed storage
- Registry-of-registries discovery
- Cross-registry signature validation

### Metrics and Observability

- Prometheus metrics endpoint
- OpenTelemetry tracing
- Structured logging (JSON)
- Health check endpoints
