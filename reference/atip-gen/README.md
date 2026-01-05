# atip-gen

Generate ATIP metadata from `--help` output.

## Overview

`atip-gen` is a best-effort tool that parses `--help` output and generates ATIP metadata. The generated metadata serves as a **starting point** and should be reviewed and refined manually.

## Installation

```bash
cd reference/atip-gen
npm install
```

## Usage

### Basic Generation

```bash
# Generate metadata for a tool
node src/cli.js gh

# Save to file
node src/cli.js gh -o examples/gh.json

# Parse subcommands (depth 2)
node src/cli.js gh --depth 2 -o examples/gh.json
```

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output file path |
| `-d, --depth <n>` | Parse subcommands to depth N (default: 1) |
| `--no-effects` | Skip effects inference |
| `--format <json\|yaml>` | Output format (default: json) |

## What Gets Generated

### Automatically Detected

✅ **Tool name** - From command
✅ **Version** - From `--version` or `-v`
✅ **Description** - First line of help text
✅ **Commands** - Parsed from COMMANDS sections
✅ **Options** - Parsed from FLAGS sections
✅ **Effects** - Inferred from command names/descriptions

### Effects Inference

The tool infers effects based on keywords:

| Effect | Keywords |
|--------|----------|
| `network: true` | api, http, request, fetch, pull, push, clone, sync |
| `destructive: true` | delete, remove, destroy, drop, purge, force |
| `idempotent: false` | create, add, new, edit, update, modify, set |
| `reversible: true` | (when paired operations detected) |

### What's NOT Generated

❌ **Arguments** - Requires deeper parsing
❌ **Enum values** - Not reliably extractable
❌ **Required flags** - Usually all optional
❌ **Authentication** - Tool-specific
❌ **Patterns** - Require domain knowledge

## Post-Generation Steps

1. **Review effects carefully** - Inference is conservative but not perfect
2. **Add missing fields** - Arguments, enum values, authentication
3. **Validate** - `atip-validate examples/gh.json`
4. **Test** - Use with an ATIP-aware agent
5. **Update trust** - Change `trust.verified: true` after review

## Example

```bash
# Generate gh metadata
node src/cli.js gh --depth 2 -o examples/gh.json

# Validate
node ../atip-validate/src/cli.js ../../examples/gh.json

# Review and refine manually
# Then mark as verified
```

## Limitations

### Parsing Challenges

- **Inconsistent help formats** - Every tool formats differently
- **Missing type information** - `--help` rarely specifies types
- **Nested subcommands** - Some tools have 3+ levels
- **Hidden commands** - Not all commands appear in help
- **Option aliases** - Multiple flags for same option

### Effects Inference

- **Conservative defaults** - Assumes unsafe unless proven safe
- **Keyword-based** - May miss context-specific operations
- **Manual review required** - Always verify destructive operations

## Architecture

```
HelpParser
├── getHelpText()       - Run tool --help
├── getVersion()        - Try --version, -v, version
├── extractCommands()   - Parse command sections
├── extractOptions()    - Parse FLAGS sections
├── inferEffects()      - Keyword-based effects detection
└── parseSubcommand()   - Recursive subcommand parsing
```

## Trust Level

All generated metadata has:

```json
{
  "trust": {
    "source": "inferred",
    "verified": false
  }
}
```

After manual review and verification, update to:

```json
{
  "trust": {
    "source": "community",  // or "org" if organization-maintained
    "verified": true
  }
}
```

## Contributing

To improve parsing for specific tools:

1. Add tool-specific heuristics to `parser.js`
2. Add test cases
3. Submit PR with example output

## Roadmap

- [ ] Better option parsing (required, types, enums)
- [ ] Argument detection
- [ ] Interactive mode for refinement
- [ ] Learn from existing shims
- [ ] YAML output support
- [ ] Batch processing
