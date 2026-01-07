# Design Document: atip-discover

## Architecture Overview

```
                              ┌────────────────────────────────┐
                              │         atip-discover          │
                              │          (CLI Entry)           │
                              └───────────────┬────────────────┘
                                              │
            ┌─────────────────────────────────┼─────────────────────────────────┐
            │                                 │                                 │
            ▼                                 ▼                                 ▼
┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
│      Discovery        │       │       Registry        │       │        Output         │
│                       │       │                       │       │                       │
│  • Scanner           │       │  • Load/Save          │       │  • JSON formatter     │
│  • Prober            │       │  • Query              │       │  • Table formatter    │
│  • Validator         │       │  • Update             │       │  • Quiet formatter    │
└───────────┬───────────┘       └───────────┬───────────┘       └───────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                   Storage Layer                                        │
│                                                                                        │
│  $XDG_DATA_HOME/agent-tools/                                                          │
│  ├── registry.json        (index of discovered tools)                                │
│  ├── tools/               (cached metadata from --agent)                              │
│  │   ├── gh.json                                                                      │
│  │   └── kubectl.json                                                                 │
│  └── shims/               (metadata for legacy tools)                                 │
│      └── curl.json                                                                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

The CLI is organized into three main functional areas:

1. **Discovery** - Scan directories, probe executables, validate ATIP responses
2. **Registry** - Manage the persistent index of discovered tools
3. **Output** - Format results for different consumers (agents, humans)

---

## Components

### 1. CLI Module (`cmd/atip-discover/`)

**Responsibility**: Parse command-line arguments and dispatch to appropriate handlers.

**Rationale**: Separating CLI parsing from business logic allows:
- Unit testing of core logic without CLI overhead
- Future addition of new commands without touching core code
- Consistent flag handling across commands

**Dependencies**:
- `internal/discovery` - Scanning and probing
- `internal/registry` - Data persistence
- `internal/output` - Result formatting

#### Files

| File | Purpose |
|------|---------|
| `main.go` | Entry point, global flag setup |
| `scan.go` | `scan` command handler |
| `list.go` | `list` command handler |
| `get.go` | `get` command handler |
| `refresh.go` | `refresh` command handler |
| `registry.go` | `registry` subcommand handlers |

### 2. Discovery Module (`internal/discovery/`)

**Responsibility**: Find and probe ATIP-compatible tools.

**Rationale**: Core discovery logic is complex and requires:
- Security-conscious path handling
- Timeout management for probes
- Parallel execution with proper error handling
- Incremental update support

**Dependencies**:
- `internal/validator` - ATIP schema validation
- `internal/config` - Discovery configuration

#### Files

| File | Purpose |
|------|---------|
| `scanner.go` | Directory scanning with security filtering |
| `prober.go` | Execute `--agent` and capture output |
| `filter.go` | Skip list and path safety filtering |
| `worker.go` | Parallel probe worker pool |
| `result.go` | Scan result aggregation |

### 3. Registry Module (`internal/registry/`)

**Responsibility**: Persist and query the tool registry.

**Rationale**: Registry is the source of truth for discovered tools. Separate module provides:
- Atomic file operations (temp file + rename)
- Concurrent read access
- Clear API for CRUD operations

**Dependencies**:
- `internal/xdg` - XDG path resolution

#### Files

| File | Purpose |
|------|---------|
| `registry.go` | Core registry operations |
| `entry.go` | RegistryEntry type and operations |
| `cache.go` | Metadata cache management |
| `lock.go` | File locking for safe writes |

### 4. Validator Module (`internal/validator/`)

**Responsibility**: Validate ATIP metadata against schema.

**Rationale**: Validation ensures:
- Only valid ATIP tools are registered
- Schema compliance before caching
- Clear error messages for debugging

**Dependencies**: None (uses embedded schema)

#### Files

| File | Purpose |
|------|---------|
| `validator.go` | JSON Schema validation |
| `schema.go` | Embedded ATIP 0.6 schema |
| `errors.go` | Validation error types |

### 5. Output Module (`internal/output/`)

**Responsibility**: Format command results for different output modes.

**Rationale**: Separating output formatting allows:
- Consistent output across commands
- Easy addition of new formats
- Testing output independently

**Dependencies**: None

#### Files

| File | Purpose |
|------|---------|
| `json.go` | JSON output formatter |
| `table.go` | Human-readable table formatter |
| `quiet.go` | Minimal output formatter |
| `writer.go` | Common output interface |

### 6. Config Module (`internal/config/`)

**Responsibility**: Load and manage configuration.

**Rationale**: Centralized configuration handling provides:
- Environment variable support
- Config file loading
- Sensible defaults
- Flag override priority

**Dependencies**:
- `internal/xdg` - XDG path resolution

#### Files

| File | Purpose |
|------|---------|
| `config.go` | Configuration loading and merging |
| `defaults.go` | Default values |

### 7. XDG Module (`internal/xdg/`)

**Responsibility**: XDG Base Directory path resolution.

**Rationale**: XDG compliance per spec section 4 requires:
- Proper environment variable handling
- Fallback to default paths
- Tilde expansion

**Dependencies**: None

#### Files

| File | Purpose |
|------|---------|
| `xdg.go` | Path resolution functions |

---

## Design Decisions

### Decision: Go as Implementation Language

**Context**: The tool needs to be fast, produce a single binary, and work cross-platform.

**Options Considered**:
1. **Go** - Fast startup, single binary, excellent subprocess handling
2. **Rust** - Similar benefits, more complex toolchain
3. **Python** - Easier development, but requires runtime, slower startup

**Decision**: Go

**Rationale**:
- Per TODO.md: "single binary, fast startup, ideal for PATH scanning"
- Go's `os/exec` package is excellent for subprocess management
- Cross-compilation is trivial with `GOOS`/`GOARCH`
- Widely used for CLI tools (kubectl, gh, terraform all use Go)
- Standard library covers most needs (no heavy dependencies)

### Decision: Security-First PATH Scanning

**Context**: Per spec section 5.2, PATH scanning can be dangerous in untrusted environments.

**Options Considered**:
1. **Scan all PATH entries** - Maximum discovery, security risk
2. **Allowlist only** - Secure, but misses custom tools
3. **Safe defaults with opt-in** - Secure by default, flexible

**Decision**: Safe defaults with explicit opt-in (`--safe-paths-only` default true).

**Rationale**:
- Per spec: "Prefer explicit allowlists over full PATH scanning"
- Default safe paths cover 90%+ of use cases
- `--allow-path` flag allows adding custom directories
- Security is a feature, not an afterthought

**Implementation**:
```go
var DefaultSafePaths = []string{
    "/usr/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
    filepath.Join(os.Getenv("HOME"), ".local/bin"),
}

func IsSafePath(path string) bool {
    // Additional checks:
    // - Not world-writable
    // - Not owned by other users
    // - Not "." in PATH
    info, err := os.Stat(path)
    if err != nil {
        return false
    }
    mode := info.Mode()
    if mode&0002 != 0 { // World-writable
        return false
    }
    // Check ownership on Unix
    return true
}
```

### Decision: Incremental Scanning

**Context**: Full PATH scanning is slow. Most tools don't change between scans.

**Options Considered**:
1. **Always full scan** - Simple, but slow
2. **Time-based cache expiry** - May miss updates
3. **Executable checksum tracking** - Accurate, but overhead
4. **Modification time tracking** - Fast, mostly accurate

**Decision**: Modification time tracking for incremental scans.

**Rationale**:
- Executable mtime changes when tool is updated
- Checking mtime is O(1) stat call per file
- Occasional false negatives acceptable (user can `--full`)
- Reduces typical scan from seconds to milliseconds

**Implementation**:
```go
type RegistryEntry struct {
    Path     string    `json:"path"`
    ModTime  time.Time `json:"mod_time"`
    Checksum string    `json:"checksum,omitempty"` // Optional, for paranoid mode
}

func NeedsRescan(entry RegistryEntry) bool {
    info, err := os.Stat(entry.Path)
    if err != nil {
        return true // File gone, needs cleanup
    }
    return info.ModTime().After(entry.ModTime)
}
```

### Decision: Parallel Probing with Worker Pool

**Context**: Probing tools sequentially is slow. Each probe involves spawning a subprocess.

**Options Considered**:
1. **Sequential probing** - Simple, predictable, slow
2. **Unlimited parallelism** - Fast, but may overwhelm system
3. **Fixed worker pool** - Balanced, configurable

**Decision**: Fixed worker pool with configurable size (default: 4).

**Rationale**:
- 4 workers provides good speedup without excessive load
- Worker pool pattern is well-understood in Go
- Easy to tune via `--parallel` flag
- Prevents fork bomb scenarios

**Implementation**:
```go
func (s *Scanner) Scan(ctx context.Context, paths []string, workers int) *ScanResult {
    jobs := make(chan string, 100)
    results := make(chan ProbeResult, 100)

    // Start workers
    var wg sync.WaitGroup
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go s.worker(ctx, jobs, results, &wg)
    }

    // Feed jobs
    go func() {
        for _, path := range paths {
            jobs <- path
        }
        close(jobs)
    }()

    // Collect results
    go func() {
        wg.Wait()
        close(results)
    }()

    return s.aggregateResults(results)
}
```

### Decision: Timeout Handling

**Context**: Some executables may hang when called with `--agent`. Must not block indefinitely.

**Options Considered**:
1. **No timeout** - Risk of hanging forever
2. **Signal-based kill** - Complex, platform-specific
3. **Context with timeout** - Clean, Go-idiomatic

**Decision**: Context-based timeout with process kill on expiry.

**Rationale**:
- Go contexts provide clean cancellation
- 2 second default is generous for metadata output
- SIGKILL after timeout ensures cleanup
- Per spec: "timeout=2s" is the recommended default

**Implementation**:
```go
func (p *Prober) Probe(ctx context.Context, path string) (*AtipMetadata, error) {
    ctx, cancel := context.WithTimeout(ctx, p.timeout)
    defer cancel()

    cmd := exec.CommandContext(ctx, path, "--agent")
    output, err := cmd.Output()

    if ctx.Err() == context.DeadlineExceeded {
        return nil, fmt.Errorf("timeout after %s", p.timeout)
    }

    return p.parseOutput(output)
}
```

### Decision: Atomic Registry Updates

**Context**: Registry file must not be corrupted by concurrent access or crashes.

**Options Considered**:
1. **Direct write** - Risk of corruption on crash
2. **File locking** - Complex, platform-specific
3. **Temp file + rename** - Simple, atomic on POSIX

**Decision**: Temp file + atomic rename.

**Rationale**:
- Rename is atomic on POSIX systems
- No partial writes visible
- Simple to implement
- Read operations never see incomplete data

**Implementation**:
```go
func (r *Registry) Save() error {
    data, err := json.MarshalIndent(r, "", "  ")
    if err != nil {
        return err
    }

    // Write to temp file
    tmpPath := r.path + ".tmp"
    if err := os.WriteFile(tmpPath, data, 0644); err != nil {
        return err
    }

    // Atomic rename
    return os.Rename(tmpPath, r.path)
}
```

### Decision: JSON as Primary Output Format

**Context**: Tool must serve both agents (machines) and humans.

**Options Considered**:
1. **JSON only** - Machine-friendly, harder for humans
2. **Table only** - Human-friendly, harder for machines
3. **Multiple formats with default** - Flexible

**Decision**: JSON as default, with table and quiet alternatives.

**Rationale**:
- Primary users are agents, which prefer JSON
- `--output table` for human debugging
- `--output quiet` for shell scripting
- JSON is self-describing and future-proof

### Decision: Shim File Support

**Context**: Legacy tools don't implement `--agent`. Shim files provide metadata for them.

**Options Considered**:
1. **Only native tools** - Simple, but limits adoption
2. **Shims in separate directory** - Clear separation
3. **Shims as first-class metadata** - Unified experience

**Decision**: Shims are first-class, stored in `shims/` directory.

**Rationale**:
- Per spec section 4: shims directory is part of standard locations
- Enables gradual migration as tools adopt ATIP
- Same validation for shims and native metadata
- Community can share shim files

**Implementation**:
```go
func (r *Registry) LoadShims() error {
    shimsDir := filepath.Join(r.dataDir, "shims")
    entries, err := os.ReadDir(shimsDir)
    if err != nil {
        return nil // No shims directory is OK
    }

    for _, entry := range entries {
        if filepath.Ext(entry.Name()) != ".json" {
            continue
        }

        metadata, err := r.loadShimFile(filepath.Join(shimsDir, entry.Name()))
        if err != nil {
            continue // Skip invalid shims
        }

        r.addEntry(RegistryEntry{
            Name:   metadata.Name,
            Source: "shim",
            // ...
        })
    }
    return nil
}
```

### Decision: XDG Compliance

**Context**: Per spec section 4, tool must follow XDG Base Directory Specification.

**Options Considered**:
1. **Custom paths** - Simpler, but non-standard
2. **XDG paths only** - Standard, but may not exist
3. **XDG with fallbacks** - Standard with robustness

**Decision**: XDG with automatic directory creation.

**Rationale**:
- Standard paths expected by spec
- Auto-creation on first run provides good UX
- Environment variable overrides for flexibility

**Implementation**:
```go
func DataHome() string {
    if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
        return dir
    }
    return filepath.Join(os.Getenv("HOME"), ".local", "share")
}

func AgentToolsDataDir() string {
    return filepath.Join(DataHome(), "agent-tools")
}

func EnsureDataDirs() error {
    dirs := []string{
        AgentToolsDataDir(),
        filepath.Join(AgentToolsDataDir(), "tools"),
        filepath.Join(AgentToolsDataDir(), "shims"),
    }
    for _, dir := range dirs {
        if err := os.MkdirAll(dir, 0755); err != nil {
            return err
        }
    }
    return nil
}
```

---

## Data Flow

### Scan Flow

```
CLI: atip-discover scan
         │
         ▼
┌─────────────────────┐
│  Load Configuration │
│  (flags + config +  │
│   environment)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Resolve Scan Paths │
│  (safe paths +      │
│   --allow-path)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Enumerate          │
│  Executables        │
│  (filter by skip    │
│   list and safety)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Load Existing      │─────▶│  Filter to          │
│  Registry           │      │  Changed/New Files  │
└─────────────────────┘      └──────────┬──────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │  Probe Executables  │
                             │  (parallel workers) │
                             │  $ tool --agent     │
                             └──────────┬──────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │  Validate ATIP      │
                             │  Response           │
                             └──────────┬──────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
          ┌─────────────────┐                    ┌─────────────────┐
          │  Valid: Update  │                    │  Invalid: Add   │
          │  Registry +     │                    │  to Errors      │
          │  Cache Metadata │                    │                 │
          └────────┬────────┘                    └────────┬────────┘
                   │                                      │
                   ▼                                      ▼
          ┌────────────────────────────────────────────────────────┐
          │  Aggregate Results + Save Registry + Output            │
          └────────────────────────────────────────────────────────┘
```

### Get Flow

```
CLI: atip-discover get <tool>
         │
         ▼
┌─────────────────────┐
│  Load Registry      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Find Entry by Name │─────▶│  Not Found: Exit 1  │
└──────────┬──────────┘      └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│  --refresh flag?    │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌─────────────┐
│  Yes    │  │  No: Load   │
│  Probe  │  │  from Cache │
│  Tool   │  │             │
└────┬────┘  └──────┬──────┘
     │              │
     ▼              │
┌─────────────┐     │
│  Update     │     │
│  Cache      │     │
└──────┬──────┘     │
       │            │
       ▼            ▼
┌─────────────────────────────────────┐
│  Apply --commands/--depth Filters   │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  Output Metadata                    │
└─────────────────────────────────────┘
```

---

## Error Handling Strategy

### Error Types

```go
// DiscoveryError indicates a problem during tool discovery.
type DiscoveryError struct {
    Path    string
    Op      string // "stat", "probe", "parse", "validate"
    Err     error
}

func (e *DiscoveryError) Error() string {
    return fmt.Sprintf("%s %s: %v", e.Op, e.Path, e.Err)
}

// RegistryError indicates a problem with registry operations.
type RegistryError struct {
    Op  string // "load", "save", "query"
    Err error
}

// ConfigError indicates a problem with configuration.
type ConfigError struct {
    Field string
    Err   error
}
```

### Error Handling Principles

1. **Partial Success is OK**: Scan continues even if some tools fail
2. **Aggregate Errors**: Collect all errors, report at end
3. **Structured Errors in JSON**: Machine-parseable error output
4. **Human-Readable in Table Mode**: Clear messages for debugging
5. **Exit Codes Indicate Severity**: 0 success, 1 partial, 2-3 fatal

### Recovery Patterns

```go
// Scan with error collection
func (s *Scanner) Scan(ctx context.Context, paths []string) *ScanResult {
    result := &ScanResult{
        Tools:  make([]DiscoveredTool, 0),
        Errors: make([]ScanError, 0),
    }

    for _, path := range paths {
        metadata, err := s.Probe(ctx, path)
        if err != nil {
            result.Errors = append(result.Errors, ScanError{
                Path:  path,
                Error: err.Error(),
            })
            result.Failed++
            continue
        }

        result.Tools = append(result.Tools, DiscoveredTool{...})
        result.Discovered++
    }

    return result
}

// Exit code determination
func ExitCodeForResult(result *ScanResult) int {
    if len(result.Errors) == 0 {
        return 0 // Complete success
    }
    if result.Discovered > 0 {
        return 1 // Partial success
    }
    return 3 // Complete failure
}
```

---

## Security Considerations

### PATH Scanning Security

Per spec section 5.2 (non-normative), the following checks are mandatory:

1. **Skip world-writable directories**
   ```go
   if info.Mode()&0002 != 0 {
       return false, ErrWorldWritable
   }
   ```

2. **Skip directories owned by other users** (Unix)
   ```go
   stat := info.Sys().(*syscall.Stat_t)
   if stat.Uid != uint32(os.Getuid()) && stat.Uid != 0 {
       return false, ErrOtherOwner
   }
   ```

3. **Never scan "." in PATH**
   ```go
   if path == "." || path == "" {
       return false, ErrCurrentDir
   }
   ```

4. **Prefer cached results over re-scanning**
   - Incremental mode is default
   - Full scan requires explicit `--full` flag

### Subprocess Execution Security

1. **No shell expansion**: Use `exec.Command`, not `os.System`
2. **No user input in command**: Only execute `<path> --agent`
3. **Timeout enforcement**: Kill processes that exceed timeout
4. **Output size limits**: Prevent memory exhaustion from large output

```go
func (p *Prober) Probe(ctx context.Context, path string) (*AtipMetadata, error) {
    cmd := exec.CommandContext(ctx, path, "--agent")

    // Capture output with size limit
    var stdout bytes.Buffer
    stdout.Grow(MaxOutputSize)
    cmd.Stdout = &stdout
    cmd.Stderr = io.Discard // Don't capture stderr

    if err := cmd.Run(); err != nil {
        return nil, err
    }

    if stdout.Len() > MaxOutputSize {
        return nil, ErrOutputTooLarge
    }

    return p.parseOutput(stdout.Bytes())
}

const MaxOutputSize = 10 * 1024 * 1024 // 10MB limit
```

### Registry File Security

1. **Restrictive permissions**: 0644 for files, 0755 for directories
2. **Atomic writes**: Prevent partial file corruption
3. **No symlink following**: Prevent symlink attacks in data directory

```go
func (r *Registry) Save() error {
    // Create temp file in same directory (for atomic rename)
    tmpFile, err := os.CreateTemp(filepath.Dir(r.path), ".registry-*.tmp")
    if err != nil {
        return err
    }
    defer os.Remove(tmpFile.Name()) // Clean up on error

    // Set restrictive permissions
    if err := tmpFile.Chmod(0644); err != nil {
        tmpFile.Close()
        return err
    }

    // Write and close
    encoder := json.NewEncoder(tmpFile)
    encoder.SetIndent("", "  ")
    if err := encoder.Encode(r); err != nil {
        tmpFile.Close()
        return err
    }
    tmpFile.Close()

    // Atomic rename
    return os.Rename(tmpFile.Name(), r.path)
}
```

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Scan (full) | O(n * t) | n = executables, t = timeout |
| Scan (incremental) | O(n) + O(m * t) | n = stat checks, m = changed |
| List | O(k) | k = registry entries |
| Get | O(1) | HashMap lookup |
| Refresh | O(m * t) | m = tools to refresh |

### Space Complexity

| Component | Size | Notes |
|-----------|------|-------|
| Registry JSON | ~1KB/tool | Grows with tool count |
| Cached metadata | ~10-100KB/tool | Depends on command count |
| Memory during scan | O(n) | n = parallel workers |

### Optimization Opportunities

1. **Lazy loading**: Only load full metadata when requested
2. **Concurrent stat checks**: Parallelize incremental mtime checks
3. **Registry indexing**: Build name -> entry map on load
4. **Compressed cache**: gzip metadata files for large tools

---

## Testing Strategy

### Unit Tests

```
internal/
  discovery/
    scanner_test.go      - Directory scanning tests
    prober_test.go       - Probe execution tests
    filter_test.go       - Safety filtering tests
  registry/
    registry_test.go     - Registry CRUD tests
    cache_test.go        - Cache operations tests
  validator/
    validator_test.go    - Schema validation tests
  output/
    json_test.go         - JSON formatting tests
    table_test.go        - Table formatting tests
  xdg/
    xdg_test.go          - Path resolution tests
```

### Integration Tests

```
tests/
  integration/
    scan_test.go         - Full scan workflow
    discovery_test.go    - End-to-end discovery
    registry_persist_test.go - Registry persistence
```

### Test Fixtures

```
testdata/
  tools/
    mock-atip-tool       - Executable that returns valid ATIP
    mock-invalid-tool    - Executable that returns invalid JSON
    mock-timeout-tool    - Executable that hangs
    mock-error-tool      - Executable that exits 1
  shims/
    valid-shim.json      - Valid shim file
    invalid-shim.json    - Invalid shim file
  schemas/
    0.6.json             - Copy of ATIP schema for testing
```

### Test Coverage Requirements

Per CLAUDE.md:
- 80%+ coverage on core logic
- 100% coverage on security-critical code (path filtering, subprocess)
- Integration tests use real ATIP examples from `examples/`

---

## File Structure

```
reference/atip-discover/
├── blue/
│   ├── api.md           # CLI interface specification
│   ├── design.md        # This design document
│   └── examples.md      # Usage examples
├── cmd/
│   └── atip-discover/
│       ├── main.go      # Entry point
│       ├── scan.go      # scan command
│       ├── list.go      # list command
│       ├── get.go       # get command
│       ├── refresh.go   # refresh command
│       └── registry.go  # registry subcommands
├── internal/
│   ├── discovery/
│   │   ├── scanner.go
│   │   ├── prober.go
│   │   ├── filter.go
│   │   ├── worker.go
│   │   └── result.go
│   ├── registry/
│   │   ├── registry.go
│   │   ├── entry.go
│   │   ├── cache.go
│   │   └── lock.go
│   ├── validator/
│   │   ├── validator.go
│   │   ├── schema.go
│   │   └── errors.go
│   ├── output/
│   │   ├── json.go
│   │   ├── table.go
│   │   ├── quiet.go
│   │   └── writer.go
│   ├── config/
│   │   ├── config.go
│   │   └── defaults.go
│   └── xdg/
│       └── xdg.go
├── tests/
│   ├── unit/            # Unit tests mirror internal/
│   └── integration/     # End-to-end tests
├── testdata/
│   ├── tools/           # Mock executables
│   ├── shims/           # Test shim files
│   └── schemas/         # Test schemas
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

---

## Future Extensions

### New Discovery Sources

The design supports adding new discovery sources:

1. **Remote registries**: Fetch tool metadata from HTTPS endpoints
2. **Container registries**: Discover tools in OCI images
3. **Package managers**: Query brew/apt/npm for ATIP support

### Enhanced Caching

Future versions may add:

- **Delta updates**: Only download changed portions of metadata
- **Shared cache**: System-wide cache for multi-user systems
- **Cache invalidation hooks**: Notify when tools are updated

### Agent Integration

For deeper agent integration:

- **Unix socket server**: Long-running daemon for fast queries
- **Watch mode**: Notify agents of registry changes
- **Capability filtering**: Return tools matching agent capabilities
