# Design Document: atip-lint

## Architecture Overview

```
                              ┌─────────────────────────────────────┐
                              │            atip-lint                │
                              │       (TypeScript/Node.js)          │
                              └─────────────────────────────────────┘
                                              │
           ┌──────────────────────────────────┼──────────────────────────────────┐
           │                                  │                                  │
           ▼                                  ▼                                  ▼
┌────────────────────┐            ┌────────────────────┐            ┌────────────────────┐
│     CLI Layer      │            │   Linter Core      │            │   Output Layer     │
│                    │            │                    │            │                    │
│  • lint command    │            │  • Rule engine     │            │  • Stylish format  │
│  • init command    │            │  • AST traversal   │            │  • JSON format     │
│  • list-rules cmd  │            │  • Fix application │            │  • SARIF format    │
│  • --agent handler │            │  • Config merge    │            │  • Compact format  │
└─────────┬──────────┘            └─────────┬──────────┘            └─────────┬──────────┘
          │                                 │                                 │
          ▼                                 ▼                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Core Modules                                            │
│                                                                                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │
│  │    Config     │  │     Rules     │  │  JSON AST     │  │    Fixer      │             │
│  │               │  │               │  │               │  │               │             │
│  │ • Load        │  │ • Quality     │  │ • Parse       │  │ • Apply       │             │
│  │ • Merge       │  │ • Consistency │  │ • Traverse    │  │ • Validate    │             │
│  │ • Validate    │  │ • Security    │  │ • Locate      │  │ • Output      │             │
│  │ • Presets     │  │ • Executable  │  │               │  │               │             │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘             │
│                                                                                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                                │
│  │   Validator   │  │   Executable  │  │   Plugin      │                                │
│  │               │  │    Checker    │  │    Loader     │                                │
│  │ • Schema      │  │ • Binary      │  │ • Load        │                                │
│  │ • ATIP types  │  │ • Probe       │  │ • Validate    │                                │
│  │ • Integration │  │ • Verify      │  │ • Register    │                                │
│  └───────────────┘  └───────────────┘  └───────────────┘                                │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The tool is organized into three main layers:

1. **CLI Layer** - Command-line interface parsing and orchestration
2. **Linter Core** - Rule execution engine and AST traversal
3. **Output Layer** - Result formatting for various consumers

All layers share common core modules for consistent behavior.

---

## Components

### 1. CLI Module (`src/cli/`)

**Responsibility**: Parse command-line arguments and orchestrate lint operations.

**Rationale**: Separating CLI from the linter core allows:
- Programmatic use as a library
- Testing of lint logic without CLI overhead
- Integration with build tools and IDEs

**Dependencies**:
- `commander` for argument parsing
- `chalk` for colored output (respecting NO_COLOR)
- Linter core for all operations

#### Files

| File | Purpose |
|------|---------|
| `index.ts` | CLI entry point, command registration |
| `lint.ts` | Lint command implementation |
| `init.ts` | Init command implementation |
| `list-rules.ts` | List-rules command implementation |
| `agent.ts` | --agent flag handler (dogfooding) |

### 2. Linter Core (`src/linter/`)

**Responsibility**: Execute lint rules against ATIP metadata.

**Rationale**: The linter core is the heart of the tool. It:
- Manages rule lifecycle
- Traverses ATIP metadata
- Collects and aggregates issues
- Applies fixes

**Dependencies**:
- Config module for configuration
- Rules module for rule definitions
- JSON AST module for source mapping
- Fixer module for auto-fixes

#### Files

| File | Purpose |
|------|---------|
| `linter.ts` | Main Linter class implementation |
| `runner.ts` | Rule execution and coordination |
| `context.ts` | RuleContext implementation |
| `visitor.ts` | AST visitor pattern implementation |
| `types.ts` | Linter-related type definitions |

### 3. Config Module (`src/config/`)

**Responsibility**: Configuration loading, merging, and validation.

**Rationale**: ESLint-inspired configuration with:
- File hierarchy search
- Preset extension
- Per-directory overrides
- Plugin support

**Dependencies**:
- `cosmiconfig` or similar for config discovery
- Presets module for built-in presets

#### Files

| File | Purpose |
|------|---------|
| `loader.ts` | Config file discovery and loading |
| `merger.ts` | Config merging and inheritance |
| `validator.ts` | Config schema validation |
| `presets.ts` | Built-in preset definitions |
| `types.ts` | Config-related type definitions |

### 4. Rules Module (`src/rules/`)

**Responsibility**: Rule definitions and registry.

**Rationale**: Modular rule architecture allows:
- Easy addition of new rules
- User-defined custom rules
- Plugin-provided rules
- Independent testing

**Dependencies**:
- JSON AST module for node locations
- Fixer module for fix generation

#### Structure

```
src/rules/
├── index.ts           # Rule registry and exports
├── quality/
│   ├── no-empty-effects.ts
│   ├── description-quality.ts
│   └── no-missing-required-fields.ts
├── consistency/
│   ├── consistent-naming.ts
│   ├── no-duplicate-flags.ts
│   └── valid-effects-values.ts
├── security/
│   ├── destructive-needs-reversible.ts
│   └── billable-needs-confirmation.ts
├── executable/
│   ├── binary-exists.ts
│   └── agent-flag-works.ts
└── trust/
    └── trust-source-requirements.ts
```

### 5. JSON AST Module (`src/ast/`)

**Responsibility**: Parse JSON to AST with source locations.

**Rationale**: Unlike `JSON.parse`, we need:
- Source positions for each node
- Ability to map JSON paths to line/column
- Support for generating precise fixes

**Dependencies**:
- `jsonc-parser` or similar for AST parsing

#### Files

| File | Purpose |
|------|---------|
| `parser.ts` | JSON to AST parsing |
| `locator.ts` | Path to position mapping |
| `types.ts` | AST node type definitions |

### 6. Fixer Module (`src/fixer/`)

**Responsibility**: Generate and apply auto-fixes.

**Rationale**: Fixes must be:
- Non-overlapping
- Applicable in single pass
- Reversible (dry-run support)

**Dependencies**:
- JSON AST module for locations

#### Files

| File | Purpose |
|------|---------|
| `fixer.ts` | Fixer helper implementation |
| `applier.ts` | Fix application to source |
| `types.ts` | Fix-related type definitions |

### 7. Output Module (`src/output/`)

**Responsibility**: Format lint results for various consumers.

**Rationale**: Different outputs for different uses:
- `stylish` - Terminal with colors
- `json` - Programmatic consumption
- `sarif` - GitHub Code Scanning
- `compact` - grep/scripting

**Dependencies**:
- `chalk` for colors

#### Files

| File | Purpose |
|------|---------|
| `stylish.ts` | ESLint-style terminal output |
| `json.ts` | JSON array output |
| `sarif.ts` | SARIF 2.1.0 output |
| `compact.ts` | One-line-per-issue output |
| `index.ts` | Formatter registry |

### 8. Validator Module (`src/validator/`)

**Responsibility**: Integration with atip-validate for schema validation.

**Rationale**: Schema validation is a prerequisite for meaningful lint:
- Invalid JSON structure breaks rule assumptions
- Schema errors should be reported first
- Can optionally be disabled for partial files

**Dependencies**:
- `ajv` for JSON Schema validation
- ATIP schema (embedded or loaded)

#### Files

| File | Purpose |
|------|---------|
| `schema.ts` | Schema validation wrapper |
| `integration.ts` | Integration with atip-validate |

### 9. Executable Module (`src/executable/`)

**Responsibility**: Verify tool binaries and probe --agent flag.

**Rationale**: For native tools, we can verify:
- Binary exists in PATH
- `--agent` flag works
- Output matches the file being linted

**Dependencies**:
- `child_process` for spawning
- Discovery logic similar to atip-discover

#### Files

| File | Purpose |
|------|---------|
| `finder.ts` | Binary path resolution |
| `prober.ts` | --agent flag probing |
| `verifier.ts` | Output verification |

### 10. Plugin Module (`src/plugin/`)

**Responsibility**: Load and register external plugins.

**Rationale**: Extensibility through plugins allows:
- Organization-specific rules
- Third-party rule sets
- Custom formatters

**Dependencies**:
- Node.js module resolution

#### Files

| File | Purpose |
|------|---------|
| `loader.ts` | Plugin discovery and loading |
| `validator.ts` | Plugin structure validation |
| `registry.ts` | Plugin registration |

---

## Design Decisions

### Decision: ESLint-Inspired Architecture

**Context**: Need a familiar, proven architecture for linting.

**Options Considered**:
1. **ESLint-style** - Rule-based visitor pattern
2. **Prettier-style** - Transform and compare
3. **TSLint-style** - TypeScript-specific walker
4. **Custom** - Build from scratch

**Decision**: ESLint-inspired rule-based architecture.

**Rationale**:
- Well-understood pattern in JavaScript ecosystem
- Proven extensibility through plugins
- Familiar to developers
- Good balance of flexibility and structure
- Supports auto-fixing naturally

### Decision: JSON AST for Source Mapping

**Context**: Need to report line/column numbers and generate fixes.

**Options Considered**:
1. **JSON.parse + position tracking** - Parse then map paths
2. **JSON AST parser** - Parse with source positions
3. **Text manipulation** - Work directly with source text
4. **YAML parser** - More lenient parsing

**Decision**: Use JSON AST parser (jsonc-parser or similar).

**Rationale**:
- Per spec: ATIP output is JSON (not JSONC), but parser handles both
- Source positions are essential for:
  - Accurate line/column reporting
  - Generating non-overlapping fixes
- Libraries like `jsonc-parser` are battle-tested

**Implementation**:
```typescript
import { parseTree, Node } from 'jsonc-parser';

function parseWithLocations(source: string): JsonAst {
  const root = parseTree(source, [], { disallowComments: true });
  return { root, source };
}

function getLocation(ast: JsonAst, path: string[]): Location {
  let node = ast.root;
  for (const segment of path) {
    node = findChild(node, segment);
  }
  return {
    line: lineFromOffset(ast.source, node.offset),
    column: columnFromOffset(ast.source, node.offset),
    offset: node.offset,
    length: node.length,
  };
}
```

### Decision: Visitor Pattern for Rule Traversal

**Context**: Rules need to examine different parts of ATIP metadata.

**Options Considered**:
1. **Visitor pattern** - Rules implement visitors for node types
2. **Query selectors** - CSS-like selectors for nodes
3. **Explicit iteration** - Rules iterate themselves
4. **Event-based** - Emit events during traversal

**Decision**: Visitor pattern with typed visitors.

**Rationale**:
- Natural fit for tree-structured data
- TypeScript can enforce visitor types
- Rules declare what they care about
- Efficient single-pass traversal

**Implementation**:
```typescript
interface RuleVisitor {
  AtipMetadata?(node: AtipMetadata, path: string[]): void;
  Command?(node: AtipCommand, path: string[]): void;
  Effects?(node: AtipEffects, path: string[]): void;
  // ... other node types
}

function traverse(metadata: AtipMetadata, visitors: RuleVisitor[]): void {
  // Visit root
  for (const visitor of visitors) {
    visitor.AtipMetadata?.(metadata, []);
  }

  // Visit commands recursively
  if (metadata.commands) {
    for (const [name, command] of Object.entries(metadata.commands)) {
      visitCommand(command, ['commands', name], visitors);
    }
  }
  // ... other traversals
}
```

### Decision: Configuration File Hierarchy

**Context**: Projects need per-directory configuration like ESLint.

**Options Considered**:
1. **Single config file** - One config at project root
2. **Hierarchical search** - Search up directory tree
3. **Explicit path only** - User must specify config
4. **Convention over configuration** - Minimal config needed

**Decision**: Hierarchical search with extends support.

**Rationale**:
- Matches ESLint user expectations
- Supports monorepos with different rules
- `extends` allows sharing common configs
- Overrides support file-specific rules

**Config search order**:
1. Explicit `--config` path
2. `.atiplintrc.json` in current directory
3. `.atiplintrc.yaml` in current directory
4. `.atiplintrc.js` in current directory
5. `atiplint.config.js` in current directory
6. `package.json` `atiplint` field
7. Parent directories (up to root or `root: true`)

### Decision: Rule Severity Model

**Context**: Need to distinguish warnings from errors for CI.

**Options Considered**:
1. **Binary (error only)** - Simple but inflexible
2. **Three-level (off/warn/error)** - ESLint model
3. **Four-level (off/info/warn/error)** - More granular
4. **Custom levels** - User-defined severities

**Decision**: Three-level (off/warn/error) matching ESLint.

**Rationale**:
- Familiar to developers
- Sufficient for CI (error = fail, warn = ok)
- Maps to exit codes naturally
- Simple to configure

### Decision: Fix Application Strategy

**Context**: Fixes must not overlap or conflict.

**Options Considered**:
1. **Apply sequentially** - One fix at a time, re-parse
2. **Apply all at once** - Collect, sort, apply
3. **Transform-based** - AST transforms
4. **Conflict detection** - Reject conflicting fixes

**Decision**: Collect all fixes, detect conflicts, apply non-overlapping.

**Rationale**:
- Single pass is efficient
- Conflicts are reported (not silently dropped)
- User can re-run to apply remaining fixes
- Matches ESLint behavior

**Implementation**:
```typescript
function applyFixes(source: string, fixes: LintFix[]): { output: string; applied: number; conflicts: LintFix[] } {
  // Sort by start position (descending) to apply from end
  const sorted = [...fixes].sort((a, b) => b.range[0] - a.range[0]);

  const conflicts: LintFix[] = [];
  const applied: LintFix[] = [];

  let lastStart = source.length;
  for (const fix of sorted) {
    if (fix.range[1] <= lastStart) {
      applied.push(fix);
      lastStart = fix.range[0];
    } else {
      conflicts.push(fix);
    }
  }

  // Apply fixes (already sorted descending)
  let output = source;
  for (const fix of applied) {
    output = output.slice(0, fix.range[0]) + fix.text + output.slice(fix.range[1]);
  }

  return { output, applied: applied.length, conflicts };
}
```

### Decision: Schema Validation Integration

**Context**: Should lint run on files that fail schema validation?

**Options Considered**:
1. **Require valid schema** - Fail early on schema errors
2. **Best effort** - Lint what we can, report schema errors
3. **Separate phases** - Schema first, then lint
4. **Optional** - User chooses

**Decision**: Schema validation first by default, but configurable.

**Rationale**:
- Schema errors often cause cascading lint failures
- User may want to lint partial/draft files
- Schema errors reported in same format as lint errors
- Can be disabled via `--no-schema-validate`

### Decision: Executable Checks as Opt-in

**Context**: Checking binaries requires executing them.

**Options Considered**:
1. **Always check** - Comprehensive but slow
2. **Never check** - Fast but incomplete
3. **Opt-in via flag** - User chooses when
4. **Opt-in via config** - Project-level setting

**Decision**: Opt-in via `--executable-check` flag.

**Rationale**:
- Executing binaries has security implications
- Binaries may not be available (CI without tools installed)
- Significantly slower than static lint
- Flag makes intent explicit

### Decision: Plugin Architecture

**Context**: Users may want custom rules.

**Options Considered**:
1. **No plugins** - Only built-in rules
2. **Config-defined rules** - Rules in config file
3. **NPM plugins** - Separate packages
4. **Local file plugins** - Files in project

**Decision**: Support both NPM plugins and local files.

**Rationale**:
- NPM plugins for shared/published rules
- Local files for project-specific rules
- Matches ESLint's plugin model
- Easy to test custom rules

**Plugin structure**:
```typescript
// atip-lint-plugin-custom/index.ts
export default {
  rules: {
    'custom-rule': {
      meta: { category: 'quality', ... },
      create(context) { ... },
    },
  },
};
```

### Decision: SARIF Output for GitHub Integration

**Context**: GitHub Code Scanning uses SARIF format.

**Options Considered**:
1. **Custom GitHub format** - Specific to GitHub
2. **SARIF 2.1.0** - Industry standard
3. **JUnit XML** - CI standard but less info
4. **Checkstyle XML** - Another CI standard

**Decision**: SARIF 2.1.0 as one of the output formats.

**Rationale**:
- SARIF is the GitHub Code Scanning standard
- Also supported by other tools (Azure DevOps, etc.)
- Rich format with fix suggestions
- Industry standard for static analysis

---

## Data Flow

### Lint Flow

```
User runs: atip-lint *.json
           │
           ▼
┌──────────────────────┐
│  Parse CLI arguments │
│  Load configuration  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Resolve file paths  │
│  Apply ignore patterns│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     For each file:
│  Load file content   │────────────────────┐
└──────────────────────┘                    │
                                            ▼
                             ┌──────────────────────────┐
                             │  Parse JSON to AST       │
                             └──────────┬───────────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                        ▼                               ▼
             ┌──────────────────────┐      ┌──────────────────────┐
             │  Schema validation   │      │  Skip if disabled    │
             │  (optional)          │      └──────────────────────┘
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │  Create rule context │
             │  Initialize visitors │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │  Traverse ATIP       │
             │  metadata tree       │
             │  Call visitors       │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │  Collect issues      │
             │  Generate fixes      │
             └──────────┬───────────┘
                        │
        ┌───────────────┴───────────────┐
        │ If --executable-check         │
        ▼                               ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Find binary         │    │  Skip executable     │
│  Probe --agent       │    │  checks              │
│  Verify output       │    └──────────────────────┘
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Aggregate results   │
│  Apply fixes if --fix│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Format output       │
│  Determine exit code │
└──────────────────────┘
```

### Fix Application Flow

```
Lint results with fixes
           │
           ▼
┌──────────────────────┐
│  Collect all fixes   │
│  from all rules      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Sort by position    │
│  (descending)        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Detect overlapping  │
│  fixes (conflicts)   │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌────────┐  ┌────────────┐
│ No     │  │ Conflicts  │
│ conflict│  │ detected   │
└────┬───┘  └─────┬──────┘
     │            │
     │            ▼
     │      ┌────────────┐
     │      │ Report     │
     │      │ conflicts  │
     │      └────────────┘
     │
     ▼
┌──────────────────────┐
│  Apply fixes from    │
│  end to start        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Write fixed source  │
│  (or output if       │
│  --fix-dry-run)      │
└──────────────────────┘
```

---

## Error Handling Strategy

### Error Types Hierarchy

```
LintError (base)
├── ConfigError
│   ├── ConfigNotFoundError
│   ├── ConfigParseError
│   └── ConfigValidationError
├── FileError
│   ├── FileNotFoundError
│   └── FileReadError
├── SchemaError
│   └── (contains schemaErrors array)
├── ExecutableError
│   ├── BinaryNotFoundError
│   ├── ProbeTimeoutError
│   └── ProbeInvalidOutputError
└── PluginError
    ├── PluginNotFoundError
    └── PluginValidationError
```

### Error Design Principles

1. **Typed errors**: Each error type has specific properties
2. **Detailed messages**: Include file paths, rule IDs, positions
3. **Recoverable**: Continue linting other files on file errors
4. **Aggregated**: Collect all errors, report together

### Recovery Patterns

```typescript
// Lint multiple files with error recovery
async function lintFiles(patterns: string[]): Promise<LintResults> {
  const files = await resolvePatterns(patterns);
  const results: LintResult[] = [];

  for (const file of files) {
    try {
      const result = await lintFile(file);
      results.push(result);
    } catch (e) {
      if (e instanceof FileError) {
        // Report as result with error message
        results.push({
          filePath: file,
          messages: [{
            ruleId: null,
            severity: 2,
            message: e.message,
            line: 0,
            column: 0,
          }],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        });
      } else {
        throw e; // Re-throw unexpected errors
      }
    }
  }

  return aggregateResults(results);
}
```

---

## Safety Considerations

### Configuration Security

**Concern**: Config files may contain code (`.atiplintrc.js`).

**Mitigations**:
- Warn when loading JS config from untrusted location
- Support JSON-only mode for strict environments
- Document security implications

### Executable Checks Security

**CRITICAL**: Executable checks run external binaries.

**Mitigations**:
1. **Opt-in only**: `--executable-check` flag required
2. **Timeout enforcement**: Always use timeout (default: 2s)
3. **No shell**: Use `execFile` not `exec`
4. **Stderr suppression**: Don't expose tool stderr
5. **Safe PATH**: Prefer known locations

**Implementation**:
```typescript
async function probeAgent(binaryPath: string, timeout: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const child = execFile(binaryPath, ['--agent'], {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB max
      shell: false,  // CRITICAL: no shell
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new ProbeTimeoutError(binaryPath, timeout));
        } else {
          resolve(null); // Not ATIP-compatible
        }
        return;
      }
      resolve(stdout);
    });
  });
}
```

### Plugin Security

**Concern**: Plugins execute arbitrary code.

**Mitigations**:
- Document plugin trust model
- Warn when loading plugins from unexpected locations
- Support plugin allowlist in strict environments

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Parse JSON to AST | O(n) | n = file size |
| Schema validation | O(n) | n = node count |
| Rule traversal | O(n * r) | n = nodes, r = rules |
| Fix application | O(f log f) | f = fix count (sorting) |
| Aggregate results | O(r) | r = result count |

### Memory Usage

- JSON AST: O(n) where n = file size (typically 2-3x source size)
- Rule contexts: O(r) where r = rule count
- Fixes: O(f) where f = fix count
- Results: O(m) where m = message count

### Optimization Opportunities

1. **Lazy rule initialization**: Only initialize rules that are enabled
2. **Early termination**: Stop on first error if `--max-warnings 0`
3. **Caching**: Cache results for unchanged files (via `--cache`)
4. **Parallel linting**: Lint multiple files concurrently

### Cache Strategy

When `--cache` is enabled:

```typescript
interface CacheEntry {
  filePath: string;
  hash: string;  // SHA256 of file content
  configHash: string;  // SHA256 of effective config
  results: LintResult;
  timestamp: number;
}

async function lintWithCache(filePath: string): Promise<LintResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  const hash = sha256(content);
  const configHash = sha256(JSON.stringify(getConfigForFile(filePath)));

  const cached = cache.get(filePath);
  if (cached && cached.hash === hash && cached.configHash === configHash) {
    return cached.results;
  }

  const results = await lintFile(filePath);
  cache.set(filePath, { filePath, hash, configHash, results, timestamp: Date.now() });
  return results;
}
```

---

## Future Extensions

### Planned Features

1. **IDE integration**: Language server protocol (LSP) support
2. **Watch mode**: Re-lint on file changes
3. **Shared configs**: Publishable config packages
4. **Inline configuration**: `// atip-lint-disable-next-line` comments

### Extension Points

1. **Custom formatters**: Plugin-provided output formats
2. **Custom parsers**: Support for alternative ATIP formats
3. **Rule presets**: Sharable rule configurations
4. **Processors**: Pre/post-process files

---

## Testing Strategy

### Unit Tests

Each module has corresponding test file:

```
src/
  rules/
    quality/
      no-empty-effects.ts      -> tests/unit/rules/quality/no-empty-effects.test.ts
      description-quality.ts   -> tests/unit/rules/quality/description-quality.test.ts
  config/
    loader.ts                  -> tests/unit/config/loader.test.ts
    merger.ts                  -> tests/unit/config/merger.test.ts
  ast/
    parser.ts                  -> tests/unit/ast/parser.test.ts
    locator.ts                 -> tests/unit/ast/locator.test.ts
  fixer/
    applier.ts                 -> tests/unit/fixer/applier.test.ts
```

### Integration Tests

```
tests/integration/
  lint-files.test.ts           -> Lint real ATIP files
  fix-application.test.ts      -> Apply and verify fixes
  config-loading.test.ts       -> Config hierarchy
  cli.test.ts                  -> CLI argument handling
  formatters.test.ts           -> Output format verification
```

### Test Fixtures

```
tests/fixtures/
  valid/
    minimal.json               -> Minimal valid ATIP
    complete.json              -> Full-featured ATIP
  invalid/
    missing-effects.json       -> For no-empty-effects
    bad-description.json       -> For description-quality
    duplicate-flags.json       -> For no-duplicate-flags
  configs/
    recommended.json           -> Recommended preset
    custom.json                -> Custom configuration
  expected/
    stylish-output.txt         -> Expected stylish format
    sarif-output.json          -> Expected SARIF format
```

### Test Coverage Requirements

Per CLAUDE.md:
- 80%+ coverage on core logic
- 100% coverage on rule implementations
- Integration tests use real ATIP examples from `examples/`

---

## File Structure

```
reference/atip-lint/
├── blue/
│   ├── api.md           # API specification
│   ├── design.md        # This design document
│   └── examples.md      # Usage examples
├── src/
│   ├── index.ts         # Library exports
│   ├── cli/
│   │   ├── index.ts     # CLI entry point
│   │   ├── lint.ts      # Lint command
│   │   ├── init.ts      # Init command
│   │   ├── list-rules.ts# List-rules command
│   │   └── agent.ts     # --agent handler
│   ├── linter/
│   │   ├── index.ts     # Linter exports
│   │   ├── linter.ts    # Main Linter class
│   │   ├── runner.ts    # Rule execution
│   │   ├── context.ts   # RuleContext
│   │   ├── visitor.ts   # AST visitor
│   │   └── types.ts     # Linter types
│   ├── config/
│   │   ├── index.ts     # Config exports
│   │   ├── loader.ts    # Config loading
│   │   ├── merger.ts    # Config merging
│   │   ├── validator.ts # Config validation
│   │   ├── presets.ts   # Built-in presets
│   │   └── types.ts     # Config types
│   ├── rules/
│   │   ├── index.ts     # Rule registry
│   │   ├── define.ts    # defineRule helper
│   │   ├── quality/
│   │   │   ├── no-empty-effects.ts
│   │   │   ├── description-quality.ts
│   │   │   └── no-missing-required-fields.ts
│   │   ├── consistency/
│   │   │   ├── consistent-naming.ts
│   │   │   ├── no-duplicate-flags.ts
│   │   │   └── valid-effects-values.ts
│   │   ├── security/
│   │   │   ├── destructive-needs-reversible.ts
│   │   │   └── billable-needs-confirmation.ts
│   │   ├── executable/
│   │   │   ├── binary-exists.ts
│   │   │   └── agent-flag-works.ts
│   │   └── trust/
│   │       └── trust-source-requirements.ts
│   ├── ast/
│   │   ├── index.ts     # AST exports
│   │   ├── parser.ts    # JSON parsing
│   │   ├── locator.ts   # Position mapping
│   │   └── types.ts     # AST types
│   ├── fixer/
│   │   ├── index.ts     # Fixer exports
│   │   ├── fixer.ts     # Fixer helper
│   │   ├── applier.ts   # Fix application
│   │   └── types.ts     # Fixer types
│   ├── output/
│   │   ├── index.ts     # Formatter registry
│   │   ├── stylish.ts   # Stylish formatter
│   │   ├── json.ts      # JSON formatter
│   │   ├── sarif.ts     # SARIF formatter
│   │   └── compact.ts   # Compact formatter
│   ├── validator/
│   │   ├── index.ts     # Validator exports
│   │   ├── schema.ts    # Schema validation
│   │   └── integration.ts
│   ├── executable/
│   │   ├── index.ts     # Executable exports
│   │   ├── finder.ts    # Binary finder
│   │   ├── prober.ts    # --agent prober
│   │   └── verifier.ts  # Output verifier
│   ├── plugin/
│   │   ├── index.ts     # Plugin exports
│   │   ├── loader.ts    # Plugin loading
│   │   ├── validator.ts # Plugin validation
│   │   └── registry.ts  # Plugin registry
│   ├── errors.ts        # Error types
│   └── constants.ts     # Constants
├── tests/
│   ├── unit/
│   │   ├── rules/
│   │   ├── config/
│   │   ├── ast/
│   │   ├── fixer/
│   │   └── output/
│   ├── integration/
│   └── fixtures/
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
| `commander` | CLI parsing | Standard, subcommand support |
| `chalk` | Colored output | Respects NO_COLOR |
| `jsonc-parser` | JSON AST parsing | Source positions, comments |
| `ajv` | JSON Schema validation | Fast, standard-compliant |
| `minimatch` | Glob matching | Pattern matching |
| `cosmiconfig` | Config loading | Hierarchy search |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `tsup` | Build tool (esbuild-based) |
| `vitest` | Test framework |
| `@types/node` | Node.js types |

### Dependency Rationale

- **Minimal dependencies**: Only what's necessary
- **Well-maintained packages**: Active maintenance
- **No native modules**: Pure JavaScript for portability
- **Familiar tools**: Match atip-discover and atip-bridge

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
  "name": "atip-lint",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "atip-lint": "./dist/cli.js"
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
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:unit": "vitest run --dir tests/unit",
    "test:integration": "vitest run --dir tests/integration",
    "lint": "node ./dist/cli.js ../../examples/*.json"
  }
}
```

---

## Relationship to Other Tools

### atip-validate

| Aspect | atip-validate | atip-lint |
|--------|---------------|-----------|
| Purpose | Schema validation | Quality linting |
| What it checks | JSON structure | Semantic quality |
| When to use | Always | After validation |
| Can fix | No | Some issues |

**Integration**: atip-lint can optionally run atip-validate first (via `--schema-validate`).

### atip-bridge

| Aspect | Relationship |
|--------|--------------|
| Shared types | Use same AtipTool, AtipCommand, etc. |
| Safety utilities | Can validate same concerns |
| Execution | atip-lint doesn't execute tools (except probing) |

### atip-discover

| Aspect | Relationship |
|--------|--------------|
| Executable checking | Similar probing logic |
| Binary finding | Similar PATH resolution |
| Shared patterns | XDG paths, timeout handling |

---

## Dogfooding

atip-lint implements `--agent` flag itself, outputting ATIP metadata for:

- `lint` command with all options
- `init` command with presets
- `list-rules` command

This demonstrates:
1. ATIP is suitable for lint tools
2. Tool authors can adopt ATIP easily
3. Effects metadata (filesystem read, idempotent) is meaningful

See api.md for the full `--agent` output.
