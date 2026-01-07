# Test Suite for atip-discover

This directory contains the Red phase test suite for `atip-discover`, the canonical TypeScript implementation of the ATIP discovery tool. These tests are written **before implementation** following the BRGR (Blue, Red, Green, Refactor) methodology.

## Test Structure

```
tests/
├── unit/               # Unit tests for individual modules
│   ├── xdg.test.ts          # XDG path resolution
│   ├── safety.test.ts       # Path safety checks
│   ├── registry.test.ts     # Registry load/save operations
│   ├── probe.test.ts        # Tool probing with --agent
│   ├── config.test.ts       # Configuration loading
│   ├── validator.test.ts    # ATIP metadata validation
│   └── scanner.test.ts      # Discovery scanner orchestration
├── integration/        # End-to-end integration tests
│   ├── cli.test.ts          # CLI command testing
│   └── discovery.test.ts    # Full discovery workflows
└── README.md          # This file
```

## Test Coverage Goals

Per `CLAUDE.md` requirements:

- **80%+ coverage** on core logic
- **100% coverage** on safety-critical code:
  - Path safety checks (`isSafePath`)
  - Skip list matching (`matchesSkipList`)
  - Metadata validation (`validateMetadata`)
  - Registry atomic writes

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests (will fail - no implementation exists yet)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Expected Test Failures

**All tests in this suite MUST fail initially** because no implementation exists. This validates that:

1. Tests actually test something (not false positives)
2. Tests reference non-existent source files
3. Implementation will be driven by these specifications

Expected failure patterns:

```
- Import errors: Cannot find module '../../src/xdg'
- Module not found: src/registry.ts does not exist
- Function undefined: probe is not a function
```

## Test Organization

### Unit Tests

Each module under `src/` has a corresponding test file:

| Module | Test File | Focus |
|--------|-----------|-------|
| `src/xdg/` | `xdg.test.ts` | XDG_DATA_HOME, XDG_CONFIG_HOME, path expansion |
| `src/safety/` | `safety.test.ts` | World-writable dirs, ownership checks, skip lists |
| `src/registry/` | `registry.test.ts` | Atomic writes, JSON parsing, entry operations |
| `src/discovery/prober.ts` | `probe.test.ts` | --agent execution, timeout, JSON parsing |
| `src/config/` | `config.test.ts` | Config file loading, env vars, defaults |
| `src/validator/` | `validator.test.ts` | ATIP schema validation, error messages |
| `src/discovery/scanner.ts` | `scanner.test.ts` | Parallel probing, progress callbacks |

### Integration Tests

Integration tests validate end-to-end workflows using real file operations:

- **CLI tests** (`cli.test.ts`): Test actual CLI commands via `child_process`
- **Discovery tests** (`discovery.test.ts`): Test full scan → list → get workflows

Integration tests use temporary directories and mock ATIP tools (shell scripts that output JSON).

## Test Patterns

### XDG Path Tests

Verify XDG Base Directory compliance per spec section 4:

```typescript
it('should use XDG_DATA_HOME when set', () => {
  process.env.XDG_DATA_HOME = '/custom/data';
  const paths = getAtipPaths();
  expect(paths.dataDir).toBe('/custom/data/agent-tools');
});
```

### Safety Tests

Critical security tests per spec section 5.2:

```typescript
it('should reject world-writable directories on Unix', async () => {
  const tmpDir = await createWorldWritableDir();
  const result = await isSafePath(tmpDir);
  expect(result.safe).toBe(false);
  expect(result.reason).toBe('world-writable');
});
```

### Registry Atomic Write Tests

Prevent corruption using temp-file-rename pattern:

```typescript
it('should perform atomic write (temp file + rename)', async () => {
  await saveRegistry(registry, paths);
  // Temp file should not exist after save
  const tmpExists = await fileExists(`${registryPath}.tmp`);
  expect(tmpExists).toBe(false);
});
```

### Probe Timeout Tests

Ensure tools don't hang:

```typescript
it('should throw ProbeTimeoutError on timeout', async () => {
  const slowTool = createSlowTool(); // sleeps 10s
  await expect(
    probe(slowTool, { timeoutMs: 100 })
  ).rejects.toThrow(/timeout/i);
});
```

### Validator Schema Tests

Validate against ATIP schema:

```typescript
it('should reject metadata without required fields', () => {
  const invalid = { name: 'tool' }; // Missing atip, version, description
  const result = validateMetadata(invalid);
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
});
```

## Test Fixtures

Tests create temporary mock tools on-the-fly:

```typescript
// Mock ATIP tool (returns valid JSON)
await fs.writeFile(
  toolPath,
  `#!/bin/sh\necho '${JSON.stringify(metadata)}'`,
  { mode: 0o755 }
);

// Mock slow tool (tests timeout)
await fs.writeFile(
  slowPath,
  '#!/bin/sh\nsleep 10\necho "{}"',
  { mode: 0o755 }
);

// Mock broken tool (tests error handling)
await fs.writeFile(
  brokenPath,
  '#!/bin/sh\necho "{ invalid json }"',
  { mode: 0o755 }
);
```

No static fixtures are needed - all test data is generated programmatically.

## Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

## Key Test Scenarios

### Unit Test Scenarios

1. **XDG Paths**
   - Respects XDG_DATA_HOME, XDG_CONFIG_HOME
   - Falls back to ~/.local/share, ~/.config
   - Expands tilde (~) in paths
   - Returns absolute paths

2. **Path Safety**
   - Rejects current directory (.)
   - Rejects world-writable directories
   - Rejects directories owned by other users
   - Accepts standard safe paths (/usr/bin, etc.)

3. **Skip List**
   - Exact name matching
   - Glob patterns (*, ?, [...])
   - Case-sensitive matching
   - Empty skip list

4. **Registry**
   - Load empty registry (returns default)
   - Load existing registry (parses JSON)
   - Throw on corrupted registry
   - Atomic save (temp + rename)
   - Date serialization

5. **Probing**
   - Return null for non-ATIP tools
   - Parse valid ATIP JSON
   - Timeout after configurable delay
   - Throw on invalid JSON
   - Handle large output (up to 10MB)
   - Validate against schema

6. **Configuration**
   - Load from file
   - Merge with defaults
   - Override with env vars
   - Parse duration strings (s, m, h)
   - Validate ranges

7. **Validation**
   - Accept minimal valid metadata
   - Accept legacy ATIP versions
   - Reject missing required fields
   - Validate nested commands
   - Validate effects types
   - Detailed error messages

8. **Scanner**
   - Discover ATIP tools
   - Skip tools in skip list
   - Parallel probing with limit
   - Progress callbacks
   - Update registry
   - Cache metadata
   - Incremental scanning

### Integration Test Scenarios

1. **Full Discovery Workflow**
   - Scan → discover tools
   - List → query registry
   - Get → retrieve metadata
   - All data persists correctly

2. **Incremental Scans**
   - First scan discovers all
   - Second scan skips unchanged
   - New tools discovered
   - Updated tools re-probed

3. **CLI Commands**
   - `atip-discover scan` outputs JSON
   - `atip-discover list` filters tools
   - `atip-discover get` returns metadata
   - `atip-discover cache info` shows stats
   - All flags work correctly

4. **Error Handling**
   - Broken tools don't stop scan
   - Invalid JSON reported
   - Missing tools return errors
   - Partial results on failures

## Test Data

### Valid ATIP Metadata

```json
{
  "atip": { "version": "0.6" },
  "name": "test-tool",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "run": {
      "description": "Run command",
      "effects": { "network": false }
    }
  }
}
```

### Registry Format

```json
{
  "version": "1",
  "lastScan": "2026-01-05T10:00:00.000Z",
  "tools": [
    {
      "name": "gh",
      "version": "2.45.0",
      "path": "/usr/local/bin/gh",
      "source": "native",
      "discoveredAt": "2026-01-05T10:00:00.000Z",
      "lastVerified": "2026-01-05T10:00:00.000Z"
    }
  ]
}
```

## Transition to GREEN Phase

Once tests are verified failing, implementation begins:

1. Create module structure matching `blue/api.md`
2. Implement functions one by one
3. Run tests after each function
4. Watch tests turn green incrementally
5. Achieve 80%+ coverage before refactor phase

## Testing Philosophy

- **Tests drive implementation**: Write tests first, implement to pass
- **One test, one focus**: Each test validates a single behavior
- **Descriptive names**: "should X when Y" format
- **No implementation details**: Tests specify behavior, not how it's done
- **Real fixtures**: Use actual file I/O, not mocks where possible
- **Fast feedback**: Unit tests run in milliseconds

## References

- BRGR Methodology: `CLAUDE.md` section "BRGR Methodology"
- API Specification: `blue/api.md`
- Design Document: `blue/design.md`
- ATIP Spec: `spec/rfc.md` sections 4-5 (discovery)
- Go Implementation: `reference/atip-discover-go/` (103 passing tests)

---

**Current Phase**: RED - All tests failing (expected)
**Next Phase**: GREEN - Implement to make tests pass
**Coverage Goal**: 80%+ overall, 100% safety-critical
