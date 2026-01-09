# Design Document: atip-discover

## Architecture Overview

```
                              ┌─────────────────────────────────────┐
                              │          atip-discover              │
                              │       (TypeScript/Node.js)          │
                              └─────────────────────────────────────┘
                                              │
           ┌──────────────────────────────────┼──────────────────────────────────┐
           │                                  │                                  │
           ▼                                  ▼                                  ▼
┌────────────────────┐            ┌────────────────────┐            ┌────────────────────┐
│     CLI Layer      │            │   Library Layer    │            │   Storage Layer    │
│                    │            │                    │            │                    │
│  • scan command    │            │  • scan()          │            │  • Registry        │
│  • list command    │            │  • probe()         │            │  • Metadata cache  │
│  • get command     │            │  • list()          │            │  • Config          │
│  • cache command   │            │  • get()           │            │  • Shims           │
│  • output formats  │            │  • refresh()       │            │                    │
└─────────┬──────────┘            └─────────┬──────────┘            └─────────┬──────────┘
          │                                 │                                 │
          ▼                                 ▼                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Core Modules                                            │
│                                                                                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │
│  │   Discovery   │  │   Registry    │  │     XDG       │  │    Config     │             │
│  │               │  │               │  │               │  │               │             │
│  │ • Scanner     │  │ • Load/Save   │  │ • Path calc   │  │ • Load        │             │
│  │ • Prober      │  │ • Add/Remove  │  │ • Dir create  │  │ • Merge       │             │
│  │ • Validator   │  │ • Query       │  │ • Tilde exp   │  │ • Validate    │             │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘             │
│                                                                                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                                │
│  │    Safety     │  │    Output     │  │   Validator   │                                │
│  │               │  │               │  │               │                                │
│  │ • Path check  │  │ • JSON        │  │ • Schema      │                                │
│  │ • Skip list   │  │ • Table       │  │ • Errors      │                                │
│  │ • Ownership   │  │ • Quiet       │  │               │                                │
│  └───────────────┘  └───────────────┘  └───────────────┘                                │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The tool is organized into three main layers:

1. **CLI Layer** - Command-line interface using Commander.js or similar
2. **Library Layer** - Programmatic API for use in other applications
3. **Storage Layer** - File-based persistence (registry, cache, config)

All layers share common core modules for consistent behavior.

---

## Components

### 1. CLI Module (`src/cli/`)

**Responsibility**: Parse command-line arguments and orchestrate commands.

**Rationale**: Separating CLI from library allows the same functionality to be used programmatically by agent frameworks like Claude Code.

**Dependencies**:
- `commander` or `yargs` for argument parsing
- `chalk` for colored output (respecting NO_COLOR)
- Library layer for all operations

#### Files

| File | Purpose |
|------|---------|
| `index.ts` | CLI entry point, command registration |
| `scan.ts` | Scan command implementation |
| `list.ts` | List command implementation |
| `get.ts` | Get command implementation |
| `cache.ts` | Cache subcommand implementations |
| `output.ts` | Output formatting (JSON, table, quiet) |

### 2. Discovery Module (`src/discovery/`)

**Responsibility**: Scan directories and probe executables for ATIP support.

**Rationale**: Core discovery logic is isolated for testability and reuse. The Scanner orchestrates the full scan workflow while Prober handles individual tool invocations.

**Dependencies**:
- `child_process` for spawning executables
- `fs/promises` for directory enumeration
- Validator module for schema validation
- Safety module for path checking

#### Files

| File | Purpose |
|------|---------|
| `scanner.ts` | Orchestrates full scan workflow |
| `prober.ts` | Probes individual tools with --agent |
| `enumerate.ts` | Enumerates executables in directories |
| `types.ts` | Discovery-related type definitions |

### 3. Registry Module (`src/registry/`)

**Responsibility**: Manage the persistent index of discovered tools.

**Rationale**: Centralizes all registry operations with atomic writes to prevent corruption. Supports querying and filtering.

**Dependencies**:
- `fs/promises` for file operations
- XDG module for path resolution

#### Files

| File | Purpose |
|------|---------|
| `registry.ts` | Load, save, query registry |
| `entry.ts` | RegistryEntry operations |
| `types.ts` | Registry type definitions |

### 4. XDG Module (`src/xdg/`)

**Responsibility**: XDG Base Directory specification support.

**Rationale**: Ensures consistent, standards-compliant file locations across platforms. Encapsulates platform-specific path logic.

**Dependencies**: None (pure functions)

#### Files

| File | Purpose |
|------|---------|
| `paths.ts` | Calculate XDG paths |
| `platform.ts` | Platform-specific logic (Unix/Windows) |

### 5. Config Module (`src/config/`)

**Responsibility**: Configuration loading, merging, and validation.

**Rationale**: Centralizes configuration from multiple sources (file, env, CLI flags) with clear priority rules.

**Dependencies**:
- XDG module for config path
- `fs/promises` for file operations

#### Files

| File | Purpose |
|------|---------|
| `config.ts` | Load and merge config |
| `defaults.ts` | Default configuration values |
| `schema.ts` | Config validation |

### 6. Safety Module (`src/safety/`)

**Responsibility**: Security checks for path scanning.

**Rationale**: Per spec section 5.2, PATH scanning has security implications. This module encapsulates all safety checks.

**Dependencies**:
- `fs/promises` for stat operations
- `os` for user/permission info

#### Files

| File | Purpose |
|------|---------|
| `paths.ts` | Path safety checks |
| `skiplist.ts` | Skip list matching |

### 7. Validator Module (`src/validator/`)

**Responsibility**: Validate ATIP metadata against schema.

**Rationale**: All metadata from tools must be validated before caching. Uses Ajv for JSON Schema validation.

**Dependencies**:
- `ajv` for JSON Schema validation
- ATIP schema (embedded or loaded)

#### Files

| File | Purpose |
|------|---------|
| `validator.ts` | Schema validation |
| `schema.ts` | Embedded or loaded ATIP schema |

### 8. Output Module (`src/output/`)

**Responsibility**: Format output for different modes (JSON, table, quiet).

**Rationale**: Consistent output formatting across all commands with support for machine-readable and human-friendly formats.

**Dependencies**:
- `chalk` for colors (respecting NO_COLOR)
- `cli-table3` or similar for table output

#### Files

| File | Purpose |
|------|---------|
| `writer.ts` | Output writer factory |
| `json.ts` | JSON output |
| `table.ts` | Table output |
| `quiet.ts` | Minimal output |

---

## Design Decisions

### Decision: TypeScript Implementation

**Context**: The TypeScript implementation is designated as canonical, matching major agent CLIs like Claude Code.

**Options Considered**:
1. **Pure JavaScript** - Simpler build, but less type safety
2. **TypeScript** - Better IDE support, catches errors at compile time
3. **ESM + TypeScript** - Modern module system with types

**Decision**: TypeScript with ESM output.

**Rationale**:
- Matches atip-bridge patterns
- Better developer experience
- Enables use as library with full type information
- ESM is the modern standard

### Decision: Dual CLI/Library Architecture

**Context**: The tool should be usable both as a CLI and as a library.

**Options Considered**:
1. **CLI only** - Simpler, but requires shelling out from code
2. **Library only** - Requires wrapper script for CLI
3. **Dual mode** - CLI wraps library functions

**Decision**: Dual mode with library-first design.

**Rationale**:
- Enables programmatic use by agent frameworks
- CLI is thin wrapper over library
- Better testability (library functions tested directly)
- Matches atip-bridge pattern

### Decision: Async/Promise-Based API

**Context**: Many operations involve I/O (file system, subprocess execution).

**Options Considered**:
1. **Callbacks** - Traditional Node.js style
2. **Promises** - Modern async/await
3. **Observables** - RxJS-style streaming

**Decision**: Promises with async/await.

**Rationale**:
- Modern JavaScript standard
- Clean error handling with try/catch
- Progress can be communicated via callbacks
- Simpler than observables for this use case

### Decision: Commander.js for CLI Parsing

**Context**: Need robust CLI argument parsing with subcommands.

**Options Considered**:
1. **yargs** - Feature-rich, auto-generates help
2. **commander** - Clean API, widely used
3. **clipanion** - TypeScript-first, strict typing
4. **Custom** - Full control, more work

**Decision**: Commander.js or a similar lightweight parser.

**Rationale**:
- Well-known API
- Subcommand support
- Automatic help generation
- Smaller than yargs
- Good TypeScript support

### Decision: Ajv for Schema Validation

**Context**: ATIP metadata must validate against JSON Schema.

**Options Considered**:
1. **Ajv** - Fast, standards-compliant, widely used
2. **Zod** - TypeScript-first, but not JSON Schema
3. **Custom** - Full control, but complex

**Decision**: Ajv with embedded schema.

**Rationale**:
- Industry standard for JSON Schema validation
- Fast validation
- Detailed error messages
- Can embed schema/0.4.json at build time

### Decision: Parallel Probing with Promise.allSettled

**Context**: Scanning many executables benefits from parallelism.

**Options Considered**:
1. **Sequential** - Simple but slow
2. **Promise.all** - Fast but fails on first error
3. **Promise.allSettled** - Fast with individual error handling
4. **Worker pool** - Most control, most complex

**Decision**: Promise.allSettled with concurrency limit.

**Rationale**:
- Handles individual failures gracefully
- Uses `p-limit` or similar for concurrency control
- Matches Go implementation's parallel behavior
- Simple implementation

**Implementation**:
```typescript
import pLimit from 'p-limit';

const limit = pLimit(options.parallelism);

const results = await Promise.allSettled(
  executables.map(path => limit(() => probe(path, options)))
);
```

### Decision: Atomic Registry Writes

**Context**: Registry corruption would lose all discovery data.

**Options Considered**:
1. **Direct write** - Risk of corruption on crash
2. **Backup file** - Better but still risky
3. **Temp file + rename** - Atomic on POSIX systems

**Decision**: Temp file + rename pattern.

**Rationale**:
- POSIX rename is atomic
- Matches Go implementation
- Prevents corruption from crashes or concurrent access
- Standard pattern for config files

**Implementation**:
```typescript
async function saveRegistry(registry: Registry, path: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await fs.rename(tmpPath, path);
}
```

### Decision: XDG Base Directory Compliance

**Context**: Tools should store data in standard locations (per spec section 4).

**Options Considered**:
1. **Fixed paths** - Simple but inflexible
2. **XDG compliance** - Standard for Unix
3. **Platform-specific** - Different paths per OS

**Decision**: XDG compliance with Windows fallbacks.

**Rationale**:
- Spec section 4 mandates XDG compliance
- Respects user environment variables
- Falls back gracefully on Windows
- Matches Go implementation

**Implementation**:
```typescript
function getDataHome(): string {
  if (process.env.XDG_DATA_HOME) {
    return process.env.XDG_DATA_HOME;
  }
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  }
  return path.join(os.homedir(), '.local', 'share');
}
```

### Decision: Safe Paths by Default

**Context**: PATH scanning can execute arbitrary code (spec section 5.2).

**Options Considered**:
1. **Scan all PATH** - Dangerous in untrusted environments
2. **Safe paths only** - Secure by default
3. **User approval** - Requires interaction

**Decision**: Safe paths by default, opt-in for others.

**Rationale**:
- Security-first approach per spec section 5.2
- Default safe paths: `/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`
- User can add paths via `--allow-path` or config
- Explicit `--safe-paths-only=false` required to scan all

### Decision: Incremental Scanning by Default

**Context**: Full scans are slow; incremental speeds up repeated scans.

**Options Considered**:
1. **Always full scan** - Slow but thorough
2. **Incremental by default** - Fast for common case
3. **Cache-only** - Never re-probe

**Decision**: Incremental by default with `--full` override.

**Rationale**:
- Common case is "check for new tools"
- Uses file modification time for change detection
- `--full` flag forces complete rescan
- Matches Go implementation behavior

### Decision: Progress Callbacks Instead of Streams

**Context**: Long scans need progress feedback.

**Options Considered**:
1. **Silent operation** - Simple but poor UX
2. **Progress callback** - Flexible, composable
3. **Event emitter** - More complex API
4. **Async iterator** - Streaming results

**Decision**: Optional progress callback.

**Rationale**:
- Simple function parameter
- Non-blocking (callback returns immediately)
- CLI uses it for progress bar/spinner
- Library users can ignore it

**Implementation**:
```typescript
await scan({
  onProgress: (progress) => {
    spinner.text = `Scanning ${progress.current}/${progress.total}: ${progress.currentItem}`;
  }
});
```

---

## Data Flow

### Scan Flow

```
User runs: atip-discover scan
           │
           ▼
┌──────────────────────┐
│  Parse CLI arguments │
│  Load configuration  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Resolve safe paths  │
│  Check path safety   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Load existing       │
│  registry            │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│  Enumerate           │────▶│  Filter by skip list │
│  executables         │     │  and mod time        │
└──────────────────────┘     └──────────┬───────────┘
                                        │
                                        ▼
                             ┌──────────────────────┐
                             │  Parallel probe      │
                             │  with --agent        │
                             └──────────┬───────────┘
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              │                                                   │
              ▼                                                   ▼
┌──────────────────────┐                            ┌──────────────────────┐
│  Success:            │                            │  Failure:            │
│  Parse JSON          │                            │  Record error        │
│  Validate schema     │                            │  Continue            │
│  Cache metadata      │                            └──────────────────────┘
│  Update registry     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Save registry       │
│  Output results      │
└──────────────────────┘
```

### Get Flow

```
User runs: atip-discover get gh
           │
           ▼
┌──────────────────────┐
│  Parse CLI arguments │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Load registry       │
│  Find tool entry     │
└──────────┬───────────┘
           │
           ├───────────────────────────────────┐
           │ Tool not found                    │
           ▼                                   ▼
┌──────────────────────┐           ┌──────────────────────┐
│  Return error:       │           │  --refresh flag?     │
│  TOOL_NOT_FOUND      │           └──────────┬───────────┘
└──────────────────────┘                      │
                                   ┌──────────┴───────────┐
                                   │ yes                  │ no
                                   ▼                      ▼
                       ┌──────────────────────┐ ┌──────────────────────┐
                       │  Probe tool          │ │  Load from cache     │
                       │  Update cache        │ └──────────┬───────────┘
                       └──────────┬───────────┘            │
                                  │                        │
                                  ▼                        ▼
                       ┌──────────────────────┐ ┌──────────────────────┐
                       │  Apply filters       │ │  Apply filters       │
                       │  (commands, depth)   │ │  (commands, depth)   │
                       └──────────┬───────────┘ └──────────┬───────────┘
                                  │                        │
                                  └──────────┬─────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  Output metadata     │
                                  └──────────────────────┘
```

---

## Error Handling Strategy

### Error Types Hierarchy

```
DiscoverError (base)
├── RegistryError
│   ├── RegistryCorruptedError
│   └── RegistryWriteError
├── ToolNotFoundError
├── MetadataNotFoundError
├── ProbeError
│   ├── ProbeTimeoutError
│   └── ProbeInvalidJsonError
└── ConfigError
    ├── ConfigParseError
    └── ConfigValidationError
```

### Error Design Principles

1. **Typed errors**: Each error type has specific properties for handling
2. **Detailed messages**: Include path, tool name, and cause
3. **Error codes**: Machine-readable codes for programmatic handling
4. **Partial results**: Scan/refresh return results even with some failures

### Recovery Patterns

```typescript
// Scan with partial failure handling
const result = await scan(options);
if (result.failed > 0) {
  console.log(`${result.failed} tools failed to probe`);
  for (const error of result.errors) {
    console.log(`  ${error.path}: ${error.error}`);
  }
}
// Still have result.tools for successful probes

// Get with fallback
try {
  const metadata = await get('gh', { refresh: true });
} catch (e) {
  if (e instanceof ProbeError) {
    // Fall back to cached version
    const cached = await get('gh', { cached: true });
  }
}
```

---

## Safety Considerations

### Path Safety Checks (per spec section 5.2)

**CRITICAL**: PATH scanning can execute arbitrary code. All paths must be checked before scanning.

**Safety checks performed**:

1. **World-writable directories**: Reject directories with mode `0o777` or `0o002` (other-writable)
2. **Ownership check**: Reject directories owned by users other than current user or root
3. **Current directory**: Never scan `.` as it may contain untrusted executables
4. **PATH injection**: Warn if PATH contains suspicious entries

**Implementation**:
```typescript
async function isSafePath(dirPath: string): Promise<{ safe: boolean; reason?: string }> {
  // Reject current directory
  if (dirPath === '.' || dirPath === '') {
    return { safe: false, reason: 'current-directory' };
  }

  const stat = await fs.stat(dirPath);

  // Check world-writable (Unix only)
  if (process.platform !== 'win32') {
    if (stat.mode & 0o002) {
      return { safe: false, reason: 'world-writable' };
    }

    // Check ownership
    if (stat.uid !== process.getuid() && stat.uid !== 0) {
      return { safe: false, reason: 'owned-by-other-user' };
    }
  }

  return { safe: true };
}
```

### Subprocess Execution Safety

When probing tools with `--agent`:

1. **Timeout enforcement**: Always use timeout to prevent hanging
2. **No shell**: Use `execFile` not `exec` to prevent shell injection
3. **Stderr capture**: Log but don't expose tool stderr to output
4. **Exit code handling**: Non-zero exit means no ATIP support (not an error)

```typescript
async function probe(path: string, timeoutMs: number): Promise<AtipMetadata | null> {
  return new Promise((resolve, reject) => {
    const child = execFile(path, ['--agent'], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB max
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new ProbeTimeoutError(path, timeoutMs));
        }
        // Non-zero exit just means no ATIP support
        resolve(null);
        return;
      }
      // Parse and validate JSON...
    });
  });
}
```

### Cache Security

Cached metadata is stored in user-writable directory:

1. **Permissions**: Create files with mode 0644
2. **Validation**: Always validate cached metadata on load
3. **Atomic writes**: Prevent corruption from concurrent access

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `scan` (full) | O(n * t) | n = executables, t = timeout |
| `scan` (incremental) | O(m * t) | m = changed executables |
| `list` | O(n) | n = registry entries |
| `list` (with pattern) | O(n) | Pattern matching per entry |
| `get` (cached) | O(1) | Single file read |
| `get` (refresh) | O(t) | Single probe |

### Memory Usage

- Registry in memory: O(n) where n = tool count (typically < 100)
- Metadata cache: Loaded on demand, not held in memory
- Probe output: Limited to 10MB per tool via maxBuffer

### Optimization Opportunities

1. **Parallel probing**: Configurable concurrency (default: 4)
2. **Incremental scans**: Only probe changed executables
3. **Lazy loading**: Load cached metadata only when needed
4. **Skip list**: Skip known non-ATIP tools early

### Benchmarks (Expected)

Based on Go implementation (103 tests, similar architecture):

| Operation | Expected Time |
|-----------|--------------|
| Full scan (~50 tools) | 5-10 seconds |
| Incremental scan (no changes) | < 500ms |
| List all tools | < 50ms |
| Get single tool (cached) | < 10ms |

---

## Trust Verification Module (Phase 4.4.5)

### Trust Architecture Overview

Per spec section 3.2.2, ATIP provides cryptographic verification mechanisms to establish tool trustworthiness. The trust module is an **enhancement** to the existing discovery system, integrated after the probe phase.

```
                          ┌─────────────────────────────────────────┐
                          │           Trust Verification            │
                          │         (NEW - Phase 4.4.5)            │
                          └─────────────────────────────────────────┘
                                              │
           ┌──────────────────────────────────┼──────────────────────────────────┐
           │                                  │                                  │
           ▼                                  ▼                                  ▼
┌────────────────────┐            ┌────────────────────┐            ┌────────────────────┐
│  Hash Computation  │            │ Signature Verify   │            │ SLSA Provenance    │
│  (src/trust/hash)  │            │ (src/trust/cosign) │            │ (src/trust/slsa)   │
│                    │            │                    │            │                    │
│  • SHA-256 binary  │            │  • Cosign verify   │            │  • Fetch attest.   │
│  • Chunk reading   │            │  • Identity match  │            │  • Parse in-toto   │
│  • Content-addr.   │            │  • Bundle support  │            │  • Level verify    │
└─────────┬──────────┘            └─────────┬──────────┘            └─────────┬──────────┘
          │                                 │                                 │
          └──────────────────────┬──────────┴─────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Trust Evaluator      │
                    │ (src/trust/evaluator)  │
                    │                        │
                    │  • Combine results     │
                    │  • Assign TrustLevel   │
                    │  • Generate recommend. │
                    └────────────────────────┘
```

### Trust Module File Structure

```
src/trust/
├── index.ts           # Module exports
├── types.ts           # Trust-specific type definitions
├── hash.ts            # SHA-256 binary hash computation
├── cosign.ts          # Sigstore/Cosign signature verification
├── slsa.ts            # SLSA attestation verification
├── evaluator.ts       # Trust level evaluation logic
└── errors.ts          # Trust-specific error types
```

### Integration with Existing Discovery Flow

The trust module integrates at two points in the existing discovery flow:

#### 1. Post-Probe Verification (Recommended)

After `probe()` returns ATIP metadata, optionally verify trust:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Enhanced Scan Flow                                        │
└──────────────────────────────────────────────────────────────────────────────────────────┘

User runs: atip-discover scan [--verify-trust]
           │
           ▼
┌──────────────────────┐
│  Existing scan flow  │
│  (enumerate, probe,  │
│   validate, cache)   │
└──────────┬───────────┘
           │
           ▼ [if --verify-trust or config.trustVerification.enabled]
┌──────────────────────┐
│  Trust Verification  │
│                      │
│  1. Compute hash     │──▶ Store in registry entry
│  2. Check checksum   │──▶ COMPROMISED if mismatch
│  3. Verify signature │──▶ UNSIGNED if missing/fail
│  4. Check provenance │──▶ PROVENANCE_FAIL if fail
│  5. Assign level     │──▶ VERIFIED if all pass
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Enhanced output     │
│  (includes trust     │
│   level per tool)    │
└──────────────────────┘
```

#### 2. On-Demand Verification via `verifyTrust()`

For explicit trust verification without a full scan:

```typescript
// After discovery
const metadata = await get('gh');
const trustResult = await verifyTrust('/usr/local/bin/gh', metadata);

if (trustResult.level === TrustLevel.COMPROMISED) {
  throw new SecurityError('Binary hash mismatch');
}
```

### Component Details

#### Hash Module (`src/trust/hash.ts`)

**Responsibility**: Compute SHA-256 hash of binary files for content-addressable lookup and integrity verification.

**Rationale**: Hash computation is the foundation of content-addressable storage (spec section 4.1) and integrity verification. Separating it allows reuse for both shim lookups and checksum verification.

**Design decisions**:

| Decision | Rationale |
|----------|-----------|
| Use Node.js `crypto` module | No external dependencies; available in all Node versions |
| Stream-based reading (8KB chunks) | Memory-efficient for large binaries |
| SHA-256 only | Industry standard; matches spec requirement |
| Lowercase hex output | Consistent with content-addressable URLs |

**Implementation approach**:
```typescript
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

async function computeBinaryHash(binaryPath: string): Promise<HashResult> {
  const hash = createHash('sha256');
  const stream = createReadStream(binaryPath, { highWaterMark: 8192 });

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  const hex = hash.digest('hex');
  return {
    algorithm: 'sha256',
    hash: hex,
    formatted: `sha256:${hex}`
  };
}
```

#### Cosign Module (`src/trust/cosign.ts`)

**Responsibility**: Verify Sigstore/Cosign signatures using the cosign CLI.

**Rationale**: Cosign is the recommended signature verification tool per spec section 3.2.2. Using the CLI avoids complex cryptographic dependencies while leveraging Sigstore's keyless signing infrastructure.

**Design decisions**:

| Decision | Rationale |
|----------|-----------|
| Shell out to `cosign` CLI | Avoids bundling cryptographic dependencies; uses established tooling |
| Require explicit identity/issuer | Keyless verification needs identity binding |
| Support signature bundles | Enables offline verification when bundle is cached |
| 30-second default timeout | Network verification may be slow; avoid hanging |

**Command invocation**:
```bash
cosign verify-blob \
  --certificate-identity "https://github.com/cli/cli/.github/workflows/release.yml@refs/tags/v2.45.0" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --bundle "/path/to/signature.bundle" \
  /usr/local/bin/gh
```

**Error handling**:

| Cosign exit code | Interpretation |
|------------------|----------------|
| 0 | Verification successful |
| Non-zero | Verification failed (parse stderr for details) |
| ENOENT | Cosign not installed |
| Timeout | Network issues or Rekor unavailable |

#### SLSA Module (`src/trust/slsa.ts`)

**Responsibility**: Fetch and verify SLSA provenance attestations.

**Rationale**: SLSA attestations prove build provenance (where and how the binary was built). This complements signature verification by establishing the build chain.

**Design decisions**:

| Decision | Rationale |
|----------|-----------|
| Fetch attestation over HTTPS | Attestations are published at known URLs |
| Parse in-toto envelope format | Standard format for SLSA attestations |
| Verify subject digest matches | Ensures attestation is for this specific binary |
| Support minimum level threshold | Allows agents to require specific SLSA guarantees |

**Attestation verification flow**:
```
1. Fetch attestation from provenance.url
2. Parse as DSSE envelope (JSON)
3. Verify signature on envelope (if certificate provided)
4. Decode payload as in-toto statement
5. Check statement.subject[].digest.sha256 matches binaryHash
6. Extract SLSA level from predicate.buildType or custom fields
7. Compare against minimum required level
```

**SLSA level interpretation** (per spec):

| Level | Guarantees | Agent behavior |
|-------|------------|----------------|
| 0 | None | Treat as untrusted |
| 1 | Build process documented | Low trust |
| 2 | Signed provenance, hosted build | Medium trust |
| 3 | Hardened build platform | High trust |
| 4 | Two-party review, hermetic | Full trust |

#### Evaluator Module (`src/trust/evaluator.ts`)

**Responsibility**: Combine verification results into a single trust level with recommendations.

**Rationale**: Agents need a single, actionable trust level rather than multiple separate verification results. The evaluator applies the decision logic from spec section 3.2.2.

**Evaluation algorithm**:
```python
# Pseudocode for trust level evaluation
def evaluate_trust(binary_path, trust_metadata, options):
    # Step 1: Always compute binary hash
    actual_hash = sha256(binary_path)

    # Step 2: Integrity check (if checksum provided)
    if trust.integrity?.checksum:
        if actual_hash != trust.integrity.checksum:
            return TrustLevel.COMPROMISED, "Hash mismatch"

    # Step 3: Signature verification (if enabled and signature provided)
    if options.verifySignatures and trust.integrity?.signature:
        sig_result = verify_signature(binary_path, trust.integrity.signature)
        if not sig_result.verified:
            return TrustLevel.UNSIGNED, sig_result.error
    elif not trust.integrity?.signature:
        # No signature provided
        if options.verifySignatures:
            return TrustLevel.UNSIGNED, "No signature available"
        else:
            return TrustLevel.UNVERIFIED, "Signature verification skipped"

    # Step 4: SLSA provenance (if enabled and provenance provided)
    if options.verifyProvenance and trust.provenance:
        prov_result = verify_provenance(binary_path, trust.provenance, options)
        if not prov_result.verified:
            return TrustLevel.PROVENANCE_FAIL, prov_result.error

    # Step 5: All checks passed
    return TrustLevel.VERIFIED, "Full verification passed"
```

**Recommendation mapping**:

| Trust Level | Recommendation | Agent Action |
|-------------|----------------|--------------|
| COMPROMISED | `block` | Do not execute; alert user |
| UNSIGNED | `confirm` | Require explicit user confirmation |
| UNVERIFIED | `sandbox` | Execute in restricted environment |
| PROVENANCE_FAIL | `confirm` | Warn user, require confirmation |
| VERIFIED | `execute` | Safe to execute normally |

### Security Considerations

#### Trust Verification is Optional but Encouraged

Per spec, trust verification is RECOMMENDED but not required. The module is designed to:

1. **Degrade gracefully**: Missing cosign CLI results in UNVERIFIED, not failure
2. **Support offline mode**: Skip network operations, mark as UNVERIFIED
3. **Never block discovery**: Trust verification happens after successful probe

#### Hash Verification is Implicit in Content-Addressable Lookup

With content-addressable storage (spec section 4), the binary hash IS the lookup key:

```
Binary → sha256(binary) → lookup shim by hash → hash match is implicit
```

The `trust.integrity.checksum` field provides **explicit verification** for:
- Native tools that include checksum in `--agent` output
- Verifying binary hasn't changed since shim was created

#### Signature Verification Requires `cosign` CLI

The module depends on the external `cosign` CLI rather than implementing cryptographic verification directly:

**Pros**:
- Uses battle-tested Sigstore implementation
- No cryptographic code to maintain
- Automatic Rekor transparency log integration
- Handles certificate chain validation

**Cons**:
- External dependency (must be installed separately)
- CLI invocation overhead
- Different behavior across cosign versions

**Mitigation**: Check for cosign availability early; provide clear error messages if missing.

### Performance Characteristics

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| Hash computation (10MB binary) | ~50ms | I/O bound; uses streaming |
| Hash computation (100MB binary) | ~500ms | Linear with file size |
| Cosign verification | 1-3s | Network bound (Rekor lookup) |
| Cosign verification (cached) | ~200ms | When using local bundle |
| SLSA attestation fetch | 200-500ms | Network bound |
| SLSA attestation verify | ~10ms | CPU bound (JSON parsing) |

**Optimization strategies**:

1. **Cache binary hashes** in registry entries; recompute only if mtime changes
2. **Batch verification** during scan; parallelize cosign invocations
3. **Download signature bundles** once; cache for offline verification
4. **Skip verification for known-good hashes** (content-addressable property)

### Configuration

Trust verification is controlled via:

#### Config file (`config.json`)

```json
{
  "trustVerification": {
    "enabled": true,
    "verifySignatures": true,
    "verifyProvenance": true,
    "minimumSlsaLevel": 2,
    "allowedSigners": [
      "https://github.com/*/.github/workflows/*"
    ],
    "allowedIssuers": [
      "https://token.actions.githubusercontent.com"
    ],
    "offlineMode": false,
    "networkTimeoutMs": 30000
  }
}
```

#### CLI flags

```bash
# Enable trust verification during scan
atip-discover scan --verify-trust

# Skip trust verification (faster)
atip-discover scan --no-verify-trust

# Offline mode (skip network checks)
atip-discover scan --verify-trust --offline

# Set minimum SLSA level
atip-discover scan --verify-trust --min-slsa=3
```

#### Environment variables

```bash
ATIP_VERIFY_TRUST=true
ATIP_OFFLINE_MODE=true
ATIP_MIN_SLSA_LEVEL=2
```

### Future Extensions

1. **GPG signature support**: Extend cosign module to support GPG signatures
2. **Minisign support**: Add minisign verification for tools using it
3. **Certificate pinning**: Allow specifying expected certificates
4. **Trust policy files**: Define complex trust rules in separate files
5. **Revocation checking**: Check if signatures have been revoked
6. **Local Rekor mirror**: Support enterprise Rekor deployments

---

## Future Extensions

### Planned Features

1. **Watch mode**: Monitor for new tools and auto-discover
2. **Remote shims**: Fetch shims from community registry
3. **Tool suggestions**: Suggest similar tools based on description
4. **Integration with atip-bridge**: Direct compilation to provider formats

### Extension Points

1. **Custom probers**: Support alternative introspection methods
2. **Output formatters**: Plugin system for new output formats
3. **Storage backends**: Support for SQLite or other backends
4. **Event hooks**: Callbacks for tool discovery events

---

## Testing Strategy

### Unit Tests

Each module has corresponding test file:

```
src/
  discovery/
    scanner.ts       -> tests/unit/discovery/scanner.test.ts
    prober.ts        -> tests/unit/discovery/prober.test.ts
    enumerate.ts     -> tests/unit/discovery/enumerate.test.ts
  registry/
    registry.ts      -> tests/unit/registry/registry.test.ts
  xdg/
    paths.ts         -> tests/unit/xdg/paths.test.ts
  safety/
    paths.ts         -> tests/unit/safety/paths.test.ts
    skiplist.ts      -> tests/unit/safety/skiplist.test.ts
  config/
    config.ts        -> tests/unit/config/config.test.ts
  validator/
    validator.ts     -> tests/unit/validator/validator.test.ts
```

### Integration Tests

```
tests/integration/
  scan.test.ts        -> Full scan workflow with mock tools
  list.test.ts        -> List with various filters
  get.test.ts         -> Get with cache and refresh
  cli.test.ts         -> CLI argument parsing and output
  security.test.ts    -> Safety checks with mock directories
```

### Test Fixtures

```
tests/fixtures/
  mock-tools/
    atip-tool        -> Mock executable returning valid ATIP JSON
    non-atip-tool    -> Mock executable that doesn't support --agent
    slow-tool        -> Mock executable that sleeps (for timeout tests)
    broken-tool      -> Mock executable returning invalid JSON
  registries/
    empty.json       -> Empty registry
    populated.json   -> Registry with sample entries
    corrupted.json   -> Invalid JSON for error handling
  configs/
    default.json     -> Default configuration
    custom.json      -> Custom safe paths
```

### Test Coverage Requirements

Per CLAUDE.md:
- 80%+ coverage on core logic
- 100% coverage on safety-critical code (path checking, validation)
- Integration tests use mock tools simulating ATIP support

---

## File Structure

```
reference/atip-discover/
├── blue/
│   ├── api.md           # API specification
│   ├── design.md        # This design document
│   └── examples.md      # Usage examples
├── src/
│   ├── index.ts         # Library exports
│   ├── cli/
│   │   ├── index.ts     # CLI entry point
│   │   ├── scan.ts      # Scan command
│   │   ├── list.ts      # List command
│   │   ├── get.ts       # Get command
│   │   ├── cache.ts     # Cache subcommands
│   │   └── output.ts    # Output formatting
│   ├── discovery/
│   │   ├── index.ts     # Module exports
│   │   ├── scanner.ts   # Scan orchestration
│   │   ├── prober.ts    # Tool probing
│   │   ├── enumerate.ts # Executable enumeration
│   │   └── types.ts     # Discovery types
│   ├── registry/
│   │   ├── index.ts     # Module exports
│   │   ├── registry.ts  # Registry operations
│   │   ├── entry.ts     # Entry operations
│   │   └── types.ts     # Registry types
│   ├── xdg/
│   │   ├── index.ts     # Module exports
│   │   ├── paths.ts     # Path calculation
│   │   └── platform.ts  # Platform detection
│   ├── config/
│   │   ├── index.ts     # Module exports
│   │   ├── config.ts    # Config loading
│   │   ├── defaults.ts  # Default values
│   │   └── schema.ts    # Config validation
│   ├── safety/
│   │   ├── index.ts     # Module exports
│   │   ├── paths.ts     # Path safety checks
│   │   └── skiplist.ts  # Skip list matching
│   ├── validator/
│   │   ├── index.ts     # Module exports
│   │   ├── validator.ts # Schema validation
│   │   └── schema.ts    # Embedded ATIP schema
│   ├── output/
│   │   ├── index.ts     # Module exports
│   │   ├── writer.ts    # Writer factory
│   │   ├── json.ts      # JSON output
│   │   ├── table.ts     # Table output
│   │   └── quiet.ts     # Quiet output
│   ├── errors.ts        # Error types
│   └── types.ts         # Shared types
├── tests/
│   ├── unit/
│   │   ├── discovery/
│   │   ├── registry/
│   │   ├── xdg/
│   │   ├── config/
│   │   ├── safety/
│   │   └── validator/
│   ├── integration/
│   └── fixtures/
│       ├── mock-tools/
│       ├── registries/
│       └── configs/
├── package.json
├── tsconfig.json
├── tsup.config.ts       # Build configuration
├── vitest.config.ts     # Test configuration
└── README.md
```

---

## Dependencies

### Runtime Dependencies

| Package | Purpose | Justification |
|---------|---------|---------------|
| `commander` | CLI parsing | Standard, well-maintained |
| `chalk` | Colored output | Respects NO_COLOR |
| `ajv` | JSON Schema validation | Fast, standard-compliant |
| `p-limit` | Concurrency control | Simple Promise limiting |
| `minimatch` | Glob matching | Standard pattern matching |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `tsup` | Build tool (esbuild-based) |
| `vitest` | Test framework |
| `@types/node` | Node.js types |

### Dependency Rationale

- **Minimal dependencies**: Only include what's necessary
- **Well-maintained packages**: Prefer packages with active maintenance
- **Small bundle size**: Use esbuild-based bundler (tsup)
- **No native modules**: Pure JavaScript for portability

---

## Build Configuration

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  shims: true,
  target: 'node18',
});
```

### package.json (relevant sections)

```json
{
  "name": "atip-discover",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "atip-discover": "./dist/cli.js"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "engines": {
    "node": ">=18"
  }
}
```

---

## Relationship to Go Implementation

The TypeScript implementation is designed to be compatible with the Go implementation:

| Aspect | Compatibility |
|--------|---------------|
| CLI interface | Identical commands and flags |
| Registry format | Same JSON structure |
| Cache format | Same file layout |
| Config format | Same JSON schema |
| Exit codes | Same values |
| Output formats | Same JSON/table/quiet |

This allows:
- Using either implementation interchangeably
- Sharing registry between implementations
- Consistent behavior for agents

Differences (TypeScript-specific):
- Programmatic API for library use
- Promise-based async API
- TypeScript type definitions
- ESM module support
