# Design Document: atip-diff

## Architecture Overview

```
                              +-------------------------------------+
                              |            atip-diff                |
                              |       (TypeScript/Node.js)          |
                              +-------------------------------------+
                                              |
           +----------------------------------+----------------------------------+
           |                                  |                                  |
           v                                  v                                  v
+--------------------+            +--------------------+            +--------------------+
|     CLI Layer      |            |   Differ Core      |            |   Output Layer     |
|                    |            |                    |            |                    |
|  * diff command    |            |  * Deep compare    |            |  * Summary format  |
|  * stdin command   |            |  * Categorization  |            |  * JSON format     |
|  * --agent handler |            |  * Semver logic    |            |  * Markdown format |
+--------+-----------+            +--------+-----------+            +--------+-----------+
         |                                 |                                 |
         v                                 v                                 v
+------------------------------------------------------------------------------+
|                               Core Modules                                    |
|                                                                              |
|  +--------------+  +--------------+  +--------------+  +--------------+     |
|  |   Loader     |  |  Comparator  |  | Categorizer  |  |   Semver     |     |
|  |              |  |              |  |              |  |              |     |
|  | * Load JSON  |  | * Deep diff  |  | * Breaking   |  | * Bump calc  |     |
|  | * Validate   |  | * Path track |  | * Non-break  |  | * Rules      |     |
|  | * Normalize  |  | * Type check |  | * Effects    |  |              |     |
|  +--------------+  +--------------+  +--------------+  +--------------+     |
|                                                                              |
+------------------------------------------------------------------------------+
```

The tool is organized into three main layers:

1. **CLI Layer** - Command-line interface parsing and orchestration
2. **Differ Core** - Deep comparison and change categorization engine
3. **Output Layer** - Result formatting for various consumers

---

## Components

### 1. CLI Module (`src/cli/`)

**Responsibility**: Parse command-line arguments and orchestrate diff operations.

**Rationale**: Separating CLI from the differ core allows:
- Programmatic use as a library for CI/CD integration
- Testing of diff logic without CLI overhead
- Integration with build tools and other ATIP tools

**Dependencies**:
- `commander` for argument parsing
- `chalk` for colored output (respecting NO_COLOR)
- Differ core for all operations

#### Files

| File | Purpose |
|------|---------|
| `index.ts` | CLI entry point, command registration |
| `diff.ts` | Diff command implementation |
| `stdin.ts` | Stdin command implementation |
| `agent.ts` | --agent flag handler (dogfooding) |

### 2. Differ Core (`src/differ/`)

**Responsibility**: Deep comparison of ATIP metadata structures.

**Rationale**: The differ core is the heart of the tool. It:
- Performs recursive deep comparison
- Tracks paths through the metadata tree
- Detects type changes and value differences
- Delegates categorization to the categorizer

**Dependencies**:
- Loader module for JSON parsing
- Comparator module for deep comparison
- Categorizer module for change classification

#### Files

| File | Purpose |
|------|---------|
| `differ.ts` | Main Differ class implementation |
| `comparator.ts` | Deep comparison algorithm |
| `types.ts` | Differ-related type definitions |

### 3. Loader Module (`src/loader/`)

**Responsibility**: Load and validate ATIP JSON files.

**Rationale**: Centralized loading provides:
- Consistent error handling
- Schema validation before comparison
- Normalization of optional fields

**Dependencies**:
- `ajv` for JSON Schema validation
- ATIP schema (embedded or loaded from schema/0.6.json)

#### Files

| File | Purpose |
|------|---------|
| `loader.ts` | File loading and JSON parsing |
| `validator.ts` | Schema validation |
| `normalizer.ts` | Normalize optional fields for comparison |

### 4. Comparator Module (`src/comparator/`)

**Responsibility**: Deep comparison of JavaScript objects with path tracking.

**Rationale**: Custom comparator needed because:
- Must track paths for error reporting
- Must detect specific change types (not just "different")
- Must handle ATIP-specific structures (commands, options, effects)

**Dependencies**: None (pure functions)

#### Files

| File | Purpose |
|------|---------|
| `comparator.ts` | Generic deep comparison |
| `atip-comparator.ts` | ATIP-specific comparison logic |
| `type-checker.ts` | Type widening/narrowing detection |

### 5. Categorizer Module (`src/categorizer/`)

**Responsibility**: Classify changes into breaking, non-breaking, and effects categories.

**Rationale**: Separate categorization logic for:
- Clear categorization rules
- Easy testing of individual rules
- Support for custom rules

**Dependencies**: None (pure functions)

#### Files

| File | Purpose |
|------|---------|
| `categorizer.ts` | Main categorization logic |
| `breaking-rules.ts` | Breaking change detection rules |
| `effects-rules.ts` | Effects change detection rules |
| `severity.ts` | Severity calculation for effects changes |

### 6. Semver Module (`src/semver/`)

**Responsibility**: Recommend semantic version bump based on changes.

**Rationale**: Automate version bump decisions:
- Breaking changes -> major bump
- Non-breaking changes -> minor bump
- Effects changes -> minor or patch based on severity

**Dependencies**:
- Categorizer module for change categories

#### Files

| File | Purpose |
|------|---------|
| `semver.ts` | Version bump recommendation logic |
| `rules.ts` | Semver bump rules configuration |

### 7. Output Module (`src/output/`)

**Responsibility**: Format diff results for various consumers.

**Rationale**: Different outputs for different uses:
- `summary` - Terminal with colors for human review
- `json` - Programmatic consumption in CI/CD
- `markdown` - Changelog generation and documentation

**Dependencies**:
- `chalk` for colors

#### Files

| File | Purpose |
|------|---------|
| `summary.ts` | Human-readable terminal output |
| `json.ts` | JSON output |
| `markdown.ts` | Markdown output for changelogs |
| `index.ts` | Formatter registry |

---

## Design Decisions

### Decision: Deep Comparison with Path Tracking

**Context**: Need to compare complex nested ATIP structures and report exactly where changes occurred.

**Options Considered**:
1. **JSON diff libraries** (deep-diff, jsondiffpatch) - Generic but don't understand ATIP semantics
2. **Custom recursive comparison** - Full control over comparison logic
3. **AST-based comparison** - Parse to AST, compare nodes
4. **Schema-aware comparison** - Use JSON Schema to guide comparison

**Decision**: Custom recursive comparison with ATIP-specific handlers.

**Rationale**:
- Generic diff libraries report "changed" but not "what kind of change"
- Need to understand ATIP semantics (e.g., required vs optional args)
- Need to track full path for error messages
- Type-specific comparators for different ATIP node types

**Implementation**:
```typescript
interface CompareContext {
  path: string[];
  changes: Change[];
}

function compareCommands(
  oldCommands: Record<string, AtipCommand>,
  newCommands: Record<string, AtipCommand>,
  ctx: CompareContext
): void {
  // Detect removed commands (breaking)
  for (const name of Object.keys(oldCommands)) {
    if (!(name in newCommands)) {
      ctx.changes.push({
        type: 'command-removed',
        category: 'breaking',
        path: [...ctx.path, name],
        oldValue: oldCommands[name],
        message: `Command '${name}' was removed`,
      });
    }
  }

  // Detect added commands (non-breaking)
  for (const name of Object.keys(newCommands)) {
    if (!(name in oldCommands)) {
      ctx.changes.push({
        type: 'command-added',
        category: 'non-breaking',
        path: [...ctx.path, name],
        newValue: newCommands[name],
        message: `Command '${name}' was added`,
      });
    }
  }

  // Compare existing commands recursively
  for (const name of Object.keys(oldCommands)) {
    if (name in newCommands) {
      compareCommand(
        oldCommands[name],
        newCommands[name],
        { ...ctx, path: [...ctx.path, name] }
      );
    }
  }
}
```

### Decision: Type Change Detection (Stricter vs Relaxed)

**Context**: Need to determine if a type change is breaking (stricter) or non-breaking (relaxed).

**Options Considered**:
1. **All type changes are breaking** - Conservative but too strict
2. **Type hierarchy comparison** - Define type ordering
3. **Value space comparison** - Compare allowed values
4. **Semantic analysis** - Consider context

**Decision**: Type hierarchy with value space comparison.

**Rationale**:
- Type changes have clear semantics in ATIP
- `enum` -> `string` is relaxing (all enum values still valid as strings)
- `string` -> `enum` is stricter (some strings may not be in enum)
- Need to consider the direction of change

**Type Hierarchy** (from more restrictive to less):
```
enum < string < any
integer < number < any
specific-enum < larger-enum < string
```

**Implementation**:
```typescript
type AtipParamType = 'string' | 'integer' | 'number' | 'boolean' |
                     'file' | 'directory' | 'url' | 'enum' | 'array';

const TYPE_COERCION_MAP: Record<AtipParamType, AtipParamType[]> = {
  'enum': ['string'],           // enum can be relaxed to string
  'integer': ['number'],        // integer can be relaxed to number
  'file': ['string'],           // file is essentially a string
  'directory': ['string'],      // directory is essentially a string
  'url': ['string'],            // url is essentially a string
  'string': [],                 // string is already most relaxed
  'number': [],                 // number is most relaxed numeric
  'boolean': [],                // boolean has no relaxation
  'array': [],                  // array needs item type comparison
};

function isTypeRelaxed(oldType: AtipParamType, newType: AtipParamType): boolean {
  return TYPE_COERCION_MAP[oldType]?.includes(newType) ?? false;
}

function isTypeStricter(oldType: AtipParamType, newType: AtipParamType): boolean {
  return TYPE_COERCION_MAP[newType]?.includes(oldType) ?? false;
}
```

### Decision: Enum Value Change Detection

**Context**: Enum changes require special handling - values can be added or removed.

**Options Considered**:
1. **Simple equality check** - Any change is "changed"
2. **Set difference** - Calculate added/removed values
3. **Order-aware comparison** - Consider value ordering
4. **Case-insensitive comparison** - Normalize values

**Decision**: Set difference with case-sensitive comparison.

**Rationale**:
- Adding enum values is non-breaking (existing values still valid)
- Removing enum values is breaking (some calls may fail)
- Order typically doesn't matter for enums
- Case sensitivity matches CLI behavior

**Implementation**:
```typescript
function compareEnumValues(
  oldEnum: unknown[] | undefined,
  newEnum: unknown[] | undefined,
  ctx: CompareContext
): void {
  if (!oldEnum && !newEnum) return;

  const oldSet = new Set(oldEnum ?? []);
  const newSet = new Set(newEnum ?? []);

  // Values removed (breaking)
  const removed = [...oldSet].filter(v => !newSet.has(v));
  if (removed.length > 0) {
    ctx.changes.push({
      type: 'enum-values-removed',
      category: 'breaking',
      path: [...ctx.path, 'enum'],
      oldValue: removed,
      message: `Enum values removed: ${removed.join(', ')}`,
    });
  }

  // Values added (non-breaking)
  const added = [...newSet].filter(v => !oldSet.has(v));
  if (added.length > 0) {
    ctx.changes.push({
      type: 'enum-values-added',
      category: 'non-breaking',
      path: [...ctx.path, 'enum'],
      newValue: added,
      message: `Enum values added: ${added.join(', ')}`,
    });
  }
}
```

### Decision: Required/Optional Argument Change Detection

**Context**: Arguments and options can change between required and optional.

**Options Considered**:
1. **Treat as type change** - required is part of the type
2. **Separate change category** - dedicated handling
3. **Default value check** - if default added, can become required
4. **Breaking only** - all requirement changes are breaking

**Decision**: Separate change category with direction-aware categorization.

**Rationale**:
- Making required -> optional is non-breaking (existing calls still work)
- Making optional -> required is breaking (existing calls may be missing arg)
- Adding default value can make required -> optional transition safer
- Per spec: `required` defaults to `true` for arguments, `false` for options

**Implementation**:
```typescript
function compareRequiredness(
  oldArg: AtipArgument | AtipOption,
  newArg: AtipArgument | AtipOption,
  ctx: CompareContext,
  isOption: boolean
): void {
  // For arguments, required defaults to true
  // For options, required defaults to false
  const defaultRequired = !isOption;

  const wasRequired = oldArg.required ?? defaultRequired;
  const nowRequired = newArg.required ?? defaultRequired;

  if (wasRequired && !nowRequired) {
    // Required -> Optional (non-breaking)
    ctx.changes.push({
      type: isOption ? 'option-made-optional' : 'argument-made-optional',
      category: 'non-breaking',
      path: [...ctx.path, 'required'],
      oldValue: true,
      newValue: false,
      message: `${isOption ? 'Option' : 'Argument'} '${oldArg.name}' is now optional`,
    });
  } else if (!wasRequired && nowRequired) {
    // Optional -> Required (breaking)
    ctx.changes.push({
      type: isOption ? 'option-made-required' : 'argument-made-required',
      category: 'breaking',
      path: [...ctx.path, 'required'],
      oldValue: false,
      newValue: true,
      message: `${isOption ? 'Option' : 'Argument'} '${oldArg.name}' is now required`,
    });
  }
}
```

### Decision: Effects Change Severity

**Context**: Effects changes need severity levels to guide semver recommendations.

**Options Considered**:
1. **All effects are equal** - No severity distinction
2. **Binary (major/minor)** - High or low
3. **Three-level (high/medium/low)** - More granular
4. **Field-specific** - Each field has its own severity

**Decision**: Three-level severity with field-specific mapping.

**Rationale**:
- `destructive: true` added is critical (agents must change behavior)
- `reversible` changed is important but less critical
- `network` changed is informational
- Severity guides semver recommendation

**Severity Mapping** (per spec section 3.6):
```typescript
const EFFECTS_SEVERITY: Record<string, ChangeSeverity> = {
  // High severity - affects safety decisions
  'destructive': 'high',
  'cost.billable': 'high',

  // Medium severity - affects execution strategy
  'reversible': 'medium',
  'idempotent': 'medium',
  'interactive.stdin': 'medium',
  'interactive.prompts': 'medium',
  'interactive.tty': 'medium',
  'filesystem.write': 'medium',
  'filesystem.delete': 'medium',

  // Low severity - informational
  'network': 'low',
  'filesystem.read': 'low',
  'duration.typical': 'low',
  'duration.timeout': 'low',
  'cost.estimate': 'low',
};
```

### Decision: Semver Bump Recommendation

**Context**: Need to recommend appropriate version bump based on detected changes.

**Options Considered**:
1. **Simple mapping** - Breaking=major, else=minor
2. **Effects-aware** - Consider effects severity
3. **Cumulative** - Multiple changes affect recommendation
4. **Conservative** - Always recommend higher bump

**Decision**: Hierarchical bump with effects consideration.

**Rationale**:
- Breaking changes always require major bump
- High-severity effects changes warrant minor bump
- Multiple low-severity changes don't escalate
- Empty diff = no bump

**Implementation**:
```typescript
function getRecommendedBump(result: DiffResult): SemverBump {
  // Breaking changes -> major
  if (result.summary.hasBreakingChanges) {
    return 'major';
  }

  // Check effects changes by severity
  const effectsChanges = result.changes.filter(c => c.category === 'effects');
  const hasHighSeverity = effectsChanges.some(c => c.severity === 'high');

  if (hasHighSeverity) {
    return 'minor'; // High-severity effects warrant minor
  }

  // Non-breaking changes -> minor
  if (result.summary.nonBreakingChanges > 0) {
    return 'minor';
  }

  // Low/medium effects only -> patch
  if (effectsChanges.length > 0) {
    return 'patch';
  }

  return 'none';
}
```

### Decision: Option Flag Change Detection

**Context**: Option flags (e.g., `-o`, `--output`) can change, which is breaking.

**Options Considered**:
1. **Ignore flag changes** - Only compare by name
2. **All flag changes are breaking** - Conservative
3. **Flag removal is breaking, addition is not** - Nuanced
4. **Compare flag sets** - Set-based comparison

**Decision**: Flag removal or change is breaking, addition is non-breaking.

**Rationale**:
- Existing calls use specific flags
- Removing a flag breaks existing calls
- Adding an alias flag doesn't break calls
- Changing the primary flag affects docs/UX

**Implementation**:
```typescript
function compareOptionFlags(
  oldFlags: string[],
  newFlags: string[],
  ctx: CompareContext
): void {
  const oldSet = new Set(oldFlags);
  const newSet = new Set(newFlags);

  // Flags removed (breaking)
  const removed = oldFlags.filter(f => !newSet.has(f));
  if (removed.length > 0) {
    ctx.changes.push({
      type: 'option-flags-changed',
      category: 'breaking',
      path: [...ctx.path, 'flags'],
      oldValue: removed,
      message: `Option flags removed: ${removed.join(', ')}`,
    });
  }

  // Flags added is informational, not a separate change type
  // (would clutter output for common alias additions)
}
```

### Decision: Normalization Before Comparison

**Context**: ATIP has optional fields with defaults. Should compare normalized or raw?

**Options Considered**:
1. **Compare raw** - Exactly what's in the files
2. **Normalize both** - Apply defaults before comparison
3. **Normalize old only** - Catch missing fields in new
4. **Schema-aware** - Use schema defaults

**Decision**: Normalize both with schema defaults.

**Rationale**:
- Optional fields with defaults are semantically equivalent
- `{ required: true }` should equal `{}` for arguments
- Reduces false positives from formatting differences
- Aligns with how agents interpret the metadata

**Implementation**:
```typescript
function normalizeArgument(arg: AtipArgument): AtipArgument {
  return {
    ...arg,
    required: arg.required ?? true,  // Default: true for arguments
    variadic: arg.variadic ?? false, // Default: false
  };
}

function normalizeOption(opt: AtipOption): AtipOption {
  return {
    ...opt,
    required: opt.required ?? false, // Default: false for options
    variadic: opt.variadic ?? false, // Default: false
  };
}

function normalizeEffects(effects: AtipEffects | undefined): AtipEffects {
  if (!effects) return {};
  return {
    ...effects,
    interactive: effects.interactive ?? { stdin: 'none', prompts: false, tty: false },
  };
}
```

---

## Data Flow

### Diff Flow

```
User runs: atip-diff old.json new.json
           |
           v
+----------------------+
|  Parse CLI arguments |
|  Set configuration   |
+----------+-----------+
           |
           v
+----------------------+
|  Load old.json       |
|  Validate against    |
|  ATIP schema         |
+----------+-----------+
           |
           v
+----------------------+
|  Load new.json       |
|  Validate against    |
|  ATIP schema         |
+----------+-----------+
           |
           v
+----------------------+
|  Normalize both      |
|  metadata structures |
+----------+-----------+
           |
           v
+----------------------+
|  Deep compare with   |
|  path tracking       |
+----------+-----------+
           |
     For each difference:
           |
           v
+----------------------+
|  Categorize change   |
|  (breaking/non/fx)   |
+----------+-----------+
           |
           v
+----------------------+
|  Calculate severity  |
|  for effects changes |
+----------+-----------+
           |
           v
+----------------------+
|  Aggregate results   |
|  Calculate summary   |
+----------+-----------+
           |
           v
+----------------------+
|  Compute semver      |
|  recommendation      |
+----------+-----------+
           |
           v
+----------------------+
|  Format output       |
|  (summary/json/md)   |
+----------+-----------+
           |
           v
+----------------------+
|  Determine exit code |
|  Output to stdout    |
+----------------------+
```

### Comparison Flow (per node)

```
compareNode(old, new, path)
           |
           v
+----------------------+
|  Is node null/undef? |
+----------+-----------+
     |           |
     v           v
  Added       Removed
  (new)       (old)
     |           |
     +-----+-----+
           |
           v
+----------------------+
|  Are types same?     |
+----------+-----------+
     |           |
     v           v
   Same       Different
     |           |
     |           v
     |    +----------------------+
     |    |  Is type stricter    |
     |    |  or relaxed?         |
     |    +----------+-----------+
     |         |           |
     |         v           v
     |      Stricter    Relaxed
     |      (breaking)  (non-brk)
     |
     v
+----------------------+
|  Node type dispatch  |
+----------+-----------+
     |
     +---+---+---+---+---+
     |   |   |   |   |   |
     v   v   v   v   v   v
  Cmd  Arg  Opt  Fx  Str Arr
     |   |   |   |   |   |
     +---+---+---+---+---+
           |
           v
+----------------------+
|  Recurse into        |
|  children            |
+----------------------+
```

---

## Error Handling Strategy

### Error Types Hierarchy

```
DiffError (base)
+-- FileError
|   +-- File not found
|   +-- Permission denied
|   +-- Read error
+-- ParseError
|   +-- Invalid JSON syntax
|   +-- Unexpected token
+-- ValidationError
    +-- Schema validation failed
    +-- Missing required field
```

### Error Recovery

```typescript
async function diffFiles(oldPath: string, newPath: string): Promise<DiffResult> {
  // Load old file
  let oldContent: string;
  try {
    oldContent = await fs.readFile(oldPath, 'utf-8');
  } catch (e) {
    throw new FileError(`Cannot read old file: ${oldPath}`, oldPath, e as Error);
  }

  // Parse old JSON
  let oldMetadata: AtipTool;
  try {
    oldMetadata = JSON.parse(oldContent);
  } catch (e) {
    throw new ParseError(`Invalid JSON in old file: ${oldPath}`, oldPath);
  }

  // Validate old metadata
  const oldErrors = validateSchema(oldMetadata);
  if (oldErrors.length > 0) {
    throw new ValidationError(
      `Old file fails schema validation: ${oldPath}`,
      oldPath,
      oldErrors
    );
  }

  // Same for new file...

  // Perform comparison (should not throw)
  return compare(oldMetadata, newMetadata);
}
```

---

## Safety Considerations

### Input Validation

**Concern**: Malformed JSON or non-ATIP files.

**Mitigations**:
1. Parse JSON in try/catch with informative errors
2. Validate against ATIP schema before comparison
3. Handle deeply nested structures with recursion limits
4. Sanitize paths in error messages

### Large File Handling

**Concern**: Very large ATIP metadata files (e.g., kubectl with all commands).

**Mitigations**:
1. Stream parsing for large files (future optimization)
2. Memory limits for comparison state
3. Progress indication for long operations
4. Option to limit depth of comparison

### Path Security

**Concern**: File paths in error messages could leak sensitive information.

**Mitigations**:
1. Only include relative paths in output
2. Don't include file contents in errors
3. Sanitize paths when logging

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| JSON parsing | O(n) | n = file size |
| Schema validation | O(n) | n = node count |
| Deep comparison | O(n * m) | n = old nodes, m = new nodes |
| Categorization | O(1) per change | Constant-time lookup |
| Output formatting | O(c) | c = change count |

### Memory Usage

- JSON AST: O(n) where n = file size
- Comparison state: O(d) where d = max depth
- Changes array: O(c) where c = change count
- Formatted output: O(c) where c = change count

### Optimization Opportunities

1. **Early termination**: Stop on first breaking change if `--fail-on-breaking`
2. **Lazy comparison**: Skip unchanged subtrees
3. **Parallel comparison**: Compare independent subtrees concurrently
4. **Caching**: Cache parsed/validated files for repeated comparisons

---

## Future Extensions

### Planned Features

1. **Watch mode**: Re-diff on file changes
2. **Directory comparison**: Compare all .json files in directories
3. **Git integration**: `atip-diff HEAD~1 HEAD` style comparisons
4. **Baseline support**: Track known changes to ignore

### Extension Points

1. **Custom categorizers**: User-defined categorization rules
2. **Custom formatters**: Plugin-provided output formats
3. **Comparison hooks**: Pre/post comparison callbacks
4. **Filter plugins**: Custom change filtering

---

## Testing Strategy

### Unit Tests

Each module has corresponding test file:

```
src/
  comparator/
    comparator.ts          -> tests/unit/comparator/comparator.test.ts
    type-checker.ts        -> tests/unit/comparator/type-checker.test.ts
  categorizer/
    categorizer.ts         -> tests/unit/categorizer/categorizer.test.ts
    breaking-rules.ts      -> tests/unit/categorizer/breaking-rules.test.ts
    effects-rules.ts       -> tests/unit/categorizer/effects-rules.test.ts
  semver/
    semver.ts              -> tests/unit/semver/semver.test.ts
  output/
    summary.ts             -> tests/unit/output/summary.test.ts
    markdown.ts            -> tests/unit/output/markdown.test.ts
```

### Integration Tests

```
tests/integration/
  diff-files.test.ts           -> Diff real ATIP files
  cli.test.ts                  -> CLI argument handling
  formatters.test.ts           -> Output format verification
  semver-recommendation.test.ts-> Version bump logic
```

### Test Fixtures

```
tests/fixtures/
  base/
    minimal.json               -> Minimal valid ATIP
    complete.json              -> Full-featured ATIP
  changes/
    command-removed.json       -> Breaking: command removed
    required-arg-added.json    -> Breaking: required arg added
    command-added.json         -> Non-breaking: new command
    destructive-added.json     -> Effects: destructive true added
  expected/
    summary-output.txt         -> Expected summary format
    markdown-output.md         -> Expected markdown format
    json-output.json           -> Expected JSON format
```

### Test Coverage Requirements

Per CLAUDE.md:
- 80%+ coverage on core logic
- 100% coverage on categorization rules
- Integration tests use real ATIP examples from `examples/`

---

## File Structure

```
reference/atip-diff/
+-- blue/
|   +-- api.md           # API specification
|   +-- design.md        # This design document
|   +-- examples.md      # Usage examples
+-- src/
|   +-- index.ts         # Library exports
|   +-- cli/
|   |   +-- index.ts     # CLI entry point
|   |   +-- diff.ts      # Diff command
|   |   +-- stdin.ts     # Stdin command
|   |   +-- agent.ts     # --agent handler
|   +-- differ/
|   |   +-- index.ts     # Differ exports
|   |   +-- differ.ts    # Main Differ class
|   |   +-- types.ts     # Differ types
|   +-- loader/
|   |   +-- index.ts     # Loader exports
|   |   +-- loader.ts    # File loading
|   |   +-- validator.ts # Schema validation
|   |   +-- normalizer.ts# Normalization
|   +-- comparator/
|   |   +-- index.ts     # Comparator exports
|   |   +-- comparator.ts# Generic deep compare
|   |   +-- atip-comparator.ts # ATIP-specific compare
|   |   +-- type-checker.ts    # Type comparison
|   +-- categorizer/
|   |   +-- index.ts     # Categorizer exports
|   |   +-- categorizer.ts# Main categorization
|   |   +-- breaking-rules.ts # Breaking change rules
|   |   +-- effects-rules.ts  # Effects change rules
|   |   +-- severity.ts  # Severity calculation
|   +-- semver/
|   |   +-- index.ts     # Semver exports
|   |   +-- semver.ts    # Bump recommendation
|   |   +-- rules.ts     # Bump rules
|   +-- output/
|   |   +-- index.ts     # Formatter registry
|   |   +-- summary.ts   # Summary formatter
|   |   +-- json.ts      # JSON formatter
|   |   +-- markdown.ts  # Markdown formatter
|   +-- errors.ts        # Error types
|   +-- constants.ts     # Constants
|   +-- types.ts         # Shared types
+-- tests/
|   +-- unit/
|   |   +-- comparator/
|   |   +-- categorizer/
|   |   +-- semver/
|   |   +-- output/
|   +-- integration/
|   +-- fixtures/
+-- package.json
+-- tsconfig.json
+-- tsup.config.ts       # Build configuration
+-- vitest.config.ts     # Test configuration
+-- README.md
```

---

## Dependencies

### Runtime Dependencies

| Package | Purpose | Justification |
|---------|---------|---------------|
| `commander` | CLI parsing | Standard, subcommand support |
| `chalk` | Colored output | Respects NO_COLOR |
| `ajv` | JSON Schema validation | Fast, standard-compliant |
| `ajv-formats` | Format validation | For uri, date-time formats |

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
- **Familiar tools**: Match atip-lint and atip-bridge

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
  "name": "atip-diff",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "atip-diff": "./dist/cli.js"
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
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Relationship to Other Tools

### atip-validate

| Aspect | atip-validate | atip-diff |
|--------|---------------|-----------|
| Purpose | Schema validation | Version comparison |
| Input | Single file | Two files |
| Output | Valid/invalid | Change list |
| Use case | Authoring | Release process |

**Integration**: atip-diff validates both files against ATIP schema before comparing.

### atip-lint

| Aspect | atip-lint | atip-diff |
|--------|-----------|-----------|
| Purpose | Quality checks | Version comparison |
| Input | One+ files | Two files |
| Output | Issues list | Change list |
| Use case | CI quality | Release process |

**Complementary**: atip-lint checks quality, atip-diff checks compatibility.

### atip-bridge

| Aspect | Relationship |
|--------|--------------|
| Shared types | Use same AtipTool, AtipCommand, etc. |
| Effects handling | Same severity concepts for effects |

---

## Dogfooding

atip-diff implements `--agent` flag itself, outputting ATIP metadata for:

- `diff` command with all options
- `stdin` command for piping

This demonstrates:
1. ATIP is suitable for comparison tools
2. Tool authors can adopt ATIP easily
3. Effects metadata (filesystem read, idempotent) is meaningful
4. The tool can describe its own breaking changes over versions

See api.md for the full `--agent` output.
