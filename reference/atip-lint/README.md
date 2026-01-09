# atip-lint

> Lint ATIP metadata for quality issues beyond schema validation

`atip-lint` is a TypeScript CLI tool and library for validating ATIP metadata quality. While `atip-validate` ensures structural correctness against the JSON schema, `atip-lint` checks semantic quality and best practices.

## Features

- **Quality Rules**: Check description quality, naming conventions, effects completeness
- **Executable Validation**: Verify tool binaries exist and `--agent` flag works
- **Extensibility**: User-defined rules via configuration or plugins
- **Auto-fixing**: Automatic fixes for simple issues
- **CI/CD Integration**: JSON/SARIF output, configurable exit codes
- **Dogfooding**: Implements `--agent` flag itself

## Status

**Current Phase**: RED (Failing Tests)

This project follows the BRGR (Blue, Red, Green, Refactor) methodology:

- ✅ **Blue**: Design complete (see `blue/` directory)
- ✅ **Red**: Comprehensive failing test suite
- ⏳ **Green**: Implementation in progress
- ⏳ **Refactor**: Not started

All tests are expected to fail with "Not implemented" errors. This is correct behavior for the RED phase.

## Installation

```bash
npm install -g atip-lint
```

## Quick Start

```bash
# Lint a single file
atip-lint examples/gh.json

# Lint with auto-fix
atip-lint examples/*.json --fix

# Initialize configuration
atip-lint init --preset recommended

# Output as JSON for CI/CD
atip-lint examples/*.json --output json
```

## Usage

### Basic Linting

```bash
# Default command (lint)
atip-lint examples/gh.json

# Multiple files with glob
atip-lint "examples/*.json" "shims/*.json"

# With configuration file
atip-lint examples/*.json --config .atiplintrc.json
```

### Output Formats

```bash
# Human-readable (default)
atip-lint examples/gh.json

# JSON for programmatic use
atip-lint examples/gh.json --output json

# SARIF for GitHub Code Scanning
atip-lint examples/gh.json --output sarif

# Compact for grep/scripting
atip-lint examples/gh.json --output compact
```

### Auto-fixing

```bash
# Apply fixes
atip-lint examples/gh.json --fix

# Preview fixes without applying
atip-lint examples/gh.json --fix-dry-run
```

### Rule Configuration

```bash
# Enable specific rule
atip-lint examples/gh.json --rule "no-empty-effects:error"

# Disable rule
atip-lint examples/gh.json --disable-rule "description-quality"

# Set max warnings
atip-lint examples/gh.json --max-warnings 0
```

## Configuration

Create `.atiplintrc.json`:

```json
{
  "extends": "recommended",
  "rules": {
    "no-empty-effects": "error",
    "description-quality": ["warn", {
      "minLength": 20,
      "requireEndingPunctuation": true
    }],
    "consistent-naming": ["warn", {
      "commandCase": "kebab-case"
    }]
  },
  "ignorePatterns": [
    "**/test-fixtures/**"
  ]
}
```

### Presets

- **recommended**: Balanced rules for most projects
- **strict**: Stricter rules for production tools
- **minimal**: Only critical errors

## Rules

### Quality Rules

- **no-empty-effects**: Commands should declare effects metadata
- **description-quality**: Descriptions must be meaningful
- **no-missing-required-fields**: Required fields present
- **valid-effects-values**: Effects values are valid types

### Consistency Rules

- **consistent-naming**: Command/option names follow conventions
- **no-duplicate-flags**: No duplicate flag definitions

### Security Rules

- **destructive-needs-reversible**: Destructive ops must declare reversible
- **billable-needs-confirmation**: Billable ops should be flagged

### Trust Rules

- **trust-source-requirements**: Trust levels have required fields

### Executable Rules

- **binary-exists**: Binary at path exists (requires `--executable-check`)
- **agent-flag-works**: `--agent` flag returns valid ATIP (requires `--executable-check`)

See `atip-lint list-rules` for full list.

## Programmatic API

```typescript
import { createLinter } from 'atip-lint';

const linter = createLinter({
  extends: 'recommended',
  rules: {
    'no-empty-effects': 'error',
  },
});

// Lint files
const results = await linter.lintFiles(['examples/*.json']);
console.log(`Errors: ${results.errorCount}`);

// Lint text
const result = await linter.lintText(atipJson, 'virtual.json');

// Apply fixes
const fixed = await linter.lintFile('test.json', { fix: true });
if (fixed.output) {
  await fs.writeFile('test.json', fixed.output);
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Lint ATIP files
  run: atip-lint "examples/*.json" --output sarif > results.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

### Exit Codes

- `0`: No errors (warnings allowed unless `--max-warnings` exceeded)
- `1`: Lint errors found
- `2`: Configuration or file access error

## Development

### Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests (will fail in RED phase)
npm test

# Type check
npm run typecheck
```

### Project Structure

```
reference/atip-lint/
├── blue/               # Design documentation
│   ├── api.md          # API specification
│   ├── design.md       # Architecture decisions
│   └── examples.md     # Usage examples
├── src/                # Source code (stubs in RED phase)
│   ├── cli/            # CLI commands
│   ├── linter/         # Core linter engine
│   ├── config/         # Configuration loading
│   ├── rules/          # Lint rules
│   ├── ast/            # JSON AST parsing
│   ├── fixer/          # Auto-fix logic
│   ├── output/         # Formatters
│   └── index.ts        # Public API
├── tests/              # Comprehensive test suite
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── fixtures/       # Test fixtures
└── package.json
```

### Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Adding Rules

1. Create rule file in `src/rules/{category}/`
2. Implement `RuleDefinition` interface
3. Add tests in `tests/unit/rules/{category}/`
4. Register in `src/rules/index.ts`

See existing rules for examples.

## Dogfooding

`atip-lint` implements the `--agent` flag itself:

```bash
atip-lint --agent
```

Output demonstrates ATIP is suitable for lint tools with effects metadata for filesystem operations.

## Documentation

- [API Specification](blue/api.md) - Complete API reference
- [Design Document](blue/design.md) - Architecture and design decisions
- [Usage Examples](blue/examples.md) - Comprehensive usage examples
- [Test Strategy](tests/README.md) - Test organization and coverage

## Related Tools

- [atip-validate](../atip-validate/) - JSON Schema validation
- [atip-bridge](../atip-bridge/) - Compile ATIP to LLM formats
- [atip-discover](../atip-discover/) - Discover ATIP-compatible tools

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the RFC process and contribution guidelines.

---

**Note**: This tool is in the RED phase of BRGR development. All tests are designed to fail until implementation is complete. This validates that tests actually test the specification.
