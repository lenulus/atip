# atip-diff

Compare ATIP metadata versions and categorize breaking changes.

## Status

**Phase: RED (Failing Tests)**

This tool is currently in the RED phase of BRGR (Blue, Red, Green, Refactor) methodology. All tests are written and currently failing because the implementation does not exist yet.

## Overview

`atip-diff` is a TypeScript CLI tool and library for comparing two versions of ATIP metadata and categorizing the differences. It helps users understand breaking changes, new features, and effects modifications between versions of a tool's ATIP metadata.

See the [Blue Phase Documentation](./blue/) for complete design details.

## Features

- **Change Detection** - Deep comparison of ATIP metadata structures
- **Change Categorization** - Classify changes as breaking, non-breaking, or effects-related
- **Semantic Versioning Guidance** - Recommend version bump based on changes
- **Multiple Output Formats** - Human-readable, JSON, and Markdown formats
- **CI/CD Integration** - Exit codes for breaking change detection
- **Dogfooding** - Implements `--agent` flag itself (per spec convention)

## Installation

```bash
npm install -g atip-diff
```

## Usage

### Basic Comparison

```bash
atip-diff old.json new.json
```

### Output Formats

```bash
# Human-readable summary (default)
atip-diff old.json new.json

# JSON format for CI/CD
atip-diff old.json new.json --output json

# Markdown for changelogs
atip-diff old.json new.json --output markdown
```

### Filtering

```bash
# Show only breaking changes
atip-diff old.json new.json --breaking-only

# Show only effects changes
atip-diff old.json new.json --effects-only
```

### CI/CD Integration

```bash
# Exit with code 1 if breaking changes detected
atip-diff old.json new.json --fail-on-breaking

# Output semver recommendation only
atip-diff old.json new.json --semver
```

### Stdin Mode

```bash
# Compare tool output to baseline
mytool --agent | atip-diff stdin baseline.json
```

### Dogfooding

```bash
# Get ATIP metadata for atip-diff itself
atip-diff --agent
```

## Development

### Running Tests (RED Phase)

Tests are currently expected to FAIL because the implementation doesn't exist yet.

```bash
# Install dependencies
npm install

# Run tests (will fail with import errors)
npm test

# Expected output:
# Error: Cannot find module '../../src/comparator/comparator'
# Error: Cannot find module '../../src/categorizer/categorizer'
# etc.
```

This is correct behavior for the RED phase. Tests validate:

- All API contracts from blue/api.md
- All workflows from blue/design.md
- All scenarios from blue/examples.md
- Real ATIP examples from examples/

### Test Coverage Goals

- 80%+ coverage on core logic
- 100% coverage on categorization rules
- Integration tests use real ATIP examples

### Next Steps (GREEN Phase)

Once implementation is complete:

1. Create src/ directory structure
2. Implement all modules to pass tests
3. Verify 100% of tests pass
4. Achieve 80%+ coverage

## Change Categories

### Breaking Changes

Changes that may break existing agent integrations:

- Command removed
- Required argument added
- Required option added
- Type made stricter (e.g., string → enum)
- Enum values removed
- Argument removed
- Option removed
- Option flags changed

### Non-Breaking Changes

Changes that are backward compatible:

- Command added
- Optional argument added
- Optional option added
- Type relaxed (e.g., enum → string)
- Enum values added
- Description changed
- Default value changed

### Effects Changes

Changes to safety metadata with severity levels:

- **High**: destructive added, cost.billable changed
- **Medium**: reversible/idempotent changed, interactive changed
- **Low**: network changed, duration changed

## Semver Recommendations

- **Major**: Breaking changes detected
- **Minor**: Non-breaking additions or high-severity effects changes
- **Patch**: Low/medium-severity effects changes only
- **None**: No changes

## API

### Library Usage

```typescript
import { diff, diffFiles, formatSummary } from 'atip-diff';

// Diff objects
const result = diff(oldMetadata, newMetadata);

// Diff files
const result = await diffFiles('old.json', 'new.json');

// Format output
const summary = formatSummary(result, { color: true });
console.log(summary);
```

### Configuration

```typescript
import { createDiffer } from 'atip-diff';

const differ = createDiffer({
  ignoreVersion: true,
  ignoreDescription: true,
  breakingOnly: false,
  effectsOnly: false,
});

const result = await differ.diffFiles('old.json', 'new.json');
```

## Documentation

- [API Specification](./blue/api.md) - Complete API documentation
- [Design Document](./blue/design.md) - Architecture and design decisions
- [Usage Examples](./blue/examples.md) - Detailed usage examples
- [Test Documentation](./tests/README.md) - Test strategy and coverage

## License

MIT

## Contributing

This tool follows the BRGR (Blue, Red, Green, Refactor) methodology:

1. **Blue** - Design documentation (complete)
2. **Red** - Failing tests (current phase)
3. **Green** - Minimal implementation
4. **Refactor** - Code cleanup

See [CLAUDE.md](../../CLAUDE.md) for contribution guidelines.
