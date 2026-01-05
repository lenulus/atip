# Claude Code Context for ATIP

This file provides context for AI agents (like Claude Code) working on the ATIP repository.

---

## Project Overview

**ATIP (Agent Tool Introspection Protocol)** is a lightweight protocol for AI agents to discover and understand command-line tools through a `--agent` flag convention that outputs structured JSON metadata.

### Core Concept

Instead of running MCP servers for every CLI tool, ATIP separates concerns:
- **Introspection**: `tool --agent` outputs metadata (what the tool can do, its effects, parameters)
- **Execution**: Direct subprocess invocation (agents run the tool normally)

### Current Version

**v0.4.0** (Draft) - See [spec/rfc.md](spec/rfc.md)

---

## Repository Structure

```
atip/
├── spec/rfc.md              # THE SOURCE OF TRUTH - Full specification
├── schema/0.4.json          # JSON Schema derived from spec
├── examples/                # Reference ATIP metadata (must validate)
├── shims/                   # Community shims for legacy tools
├── reference/               # Reference implementations
│   ├── atip-validate/       # Schema validator
│   ├── atip-gen/            # --help parser/generator
│   └── atip-bridge/         # Compiler library (OpenAI/Gemini/Anthropic)
└── docs/                    # Additional documentation
```

---

## Key Principles

### 1. Spec is Source of Truth

**Always refer to [spec/rfc.md](spec/rfc.md) first.**

- Schema, examples, and implementations derive from the spec
- If spec and implementation conflict, spec wins
- Changes should update spec first, then cascade to schema/examples

### 2. Safety First

ATIP's killer feature is effects metadata that helps agents make safe decisions:

```json
{
  "effects": {
    "destructive": true,      // CRITICAL - permanently destroys data
    "reversible": false,       // CRITICAL - cannot be undone
    "idempotent": false,       // Important - not safe to retry
    "network": true,           // Agent should know
    "cost": {"billable": true} // Prevent surprise costs
  }
}
```

**When creating examples or shims:**
- Be conservative with effects declarations
- If unsure, mark as potentially unsafe
- `destructive: true` is better than missing it

### 3. Schema Validation is Mandatory

Every JSON file in `examples/` and `shims/` **must** validate against `schema/0.4.json`.

```bash
# Before committing examples/shims
npm run validate
```

### 4. Backwards Compatibility

The `atip` field supports legacy formats:

```json
// Legacy (v0.1-0.3)
"atip": "0.3"

// Current (v0.4+)
"atip": {
  "version": "0.4",
  "features": ["partial-discovery", "trust-v1"]
}
```

Agents must accept both formats.

---

## Common Tasks

### Adding a New Example

1. **Study the spec** - Understand what the tool does
2. **Create JSON file** in `examples/` or `shims/`
3. **Follow naming**: `{tool-name}.json` (lowercase, hyphens)
4. **Include trust metadata**:
   ```json
   {
     "trust": {
       "source": "community",  // or "native" if tool implements --agent
       "verified": false
     }
   }
   ```
5. **Validate**: `npm run validate` (once tooling exists)
6. **Test**: Ideally test with an ATIP-aware agent

### Modifying the Schema

1. **Update spec first** - [spec/rfc.md](spec/rfc.md)
2. **Update schema** - [schema/0.4.json](schema/0.4.json)
3. **Update examples** - Ensure all examples still validate
4. **Update tests** - Add test cases for new features
5. **Document** - Update README if user-facing

### Proposing Spec Changes

See [CONTRIBUTING.md](CONTRIBUTING.md) for the RFC process.

**Minor changes** (new optional field):
- Open issue with proposal
- Update spec, schema, examples
- Submit PR

**Breaking changes** (required field, rename, removal):
- RFC process required
- Community discussion
- Version bump (major)

---

## Important Spec Details

### Translation to LLM Providers

ATIP metadata compiles to OpenAI/Gemini/Anthropic function calling formats.

**Critical rule**: Safety metadata must be embedded in descriptions since providers don't have native effects support:

```typescript
// ATIP
{
  "description": "Delete a repository",
  "effects": {"destructive": true, "reversible": false}
}

// Compiles to OpenAI
{
  "description": "Delete a repository. [⚠️ DESTRUCTIVE | ⚠️ NOT REVERSIBLE]"
}
```

See spec §8 for full translation rules.

### Partial Discovery

Large tools (kubectl, aws-cli) can return filtered metadata:

```bash
kubectl --agent --commands=pods,deployments --depth=1
```

The `omitted` field declares safety assumptions for unlisted commands:

```json
{
  "partial": true,
  "omitted": {
    "reason": "filtered",
    "safetyAssumption": "unknown"  // Agent must confirm before using
  }
}
```

### Interactive Effects

Tools requiring stdin/TTY must declare it:

```json
{
  "interactive": {
    "stdin": "required",    // Blocks waiting for input
    "prompts": true,        // May prompt for confirmation
    "tty": false            // Doesn't need pseudo-terminal
  }
}
```

Agents use this to decide whether to run in PTY, auto-confirm, or skip.

---

## Development Guidelines

### BRGR Methodology

**Always follow BRGR (Blue, Red, Green, Refactor) for all implementations:**

1. **Blue (Spec)** - Write or update the specification first
   - Define the interface, behavior, and contracts in [spec/rfc.md](spec/rfc.md)
   - Update schema if needed
   - Document expected behavior

2. **Red (Failing Tests)** - Write tests that fail
   - Create test cases based on the spec
   - Tests should fail because implementation doesn't exist yet
   - Validates that tests actually test something

3. **Green (Implement)** - Write minimal code to pass tests
   - Implement just enough to make tests pass
   - Don't over-engineer or add features not in spec
   - Focus on correctness first

4. **Refactor** - Clean up while keeping tests green
   - Improve code quality, performance, readability
   - Extract common patterns
   - Maintain backward compatibility

**Example workflow:**

```bash
# 1. Blue: Update spec/rfc.md with new feature
# 2. Red: Write failing tests
npm test                    # Should fail
# 3. Green: Implement feature
npm test                    # Should pass
# 4. Refactor: Clean up code
npm test                    # Should still pass
npm run validate            # All examples validate
```

**This ensures:**
- Spec-driven development (spec is source of truth)
- No untested code
- Minimal implementation complexity
- Safe refactoring with test coverage

### Code Style

**JSON**:
- 2-space indent
- No trailing commas
- Double quotes
- Sort keys alphabetically (except `atip`, `name`, `version` at top)

**TypeScript/Python** (for reference implementations):
- Follow existing style in the file
- Add JSDoc/docstrings for public APIs
- Match interface from spec Appendix A

### Commit Messages

```
<type>(<scope>): <description>

feat(schema): add authentication.methods field
fix(examples): correct gh.json effects metadata
docs(spec): clarify partial discovery semantics
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

### Testing

Once test infrastructure exists:

```bash
npm test              # Run all tests
npm run validate      # Validate all JSON against schema
npm run test:schema   # Schema-specific tests
```

---

## Key Files Reference

| File | Purpose | Notes |
|------|---------|-------|
| `spec/rfc.md` | **SOURCE OF TRUTH** | Read this first |
| `schema/0.4.json` | JSON Schema | Must validate all examples |
| `README.md` | Project intro | Keep aligned with spec |
| `CONTRIBUTING.md` | Contribution guide | RFC process, shim guidelines |
| `TODO.md` | Implementation roadmap | Update as phases complete |

---

## What NOT to Do

❌ **Don't create examples without validating** - Must pass schema validation

❌ **Don't mark unsafe operations as safe** - Better to be conservative

❌ **Don't add breaking changes to schema without RFC** - Community consensus required

❌ **Don't use `x-` prefix for standard fields** - Reserved for vendor extensions

❌ **Don't hardcode specific provider formats in examples** - ATIP is provider-agnostic; translation happens at agent runtime

---

## Useful Patterns

### Minimal Valid ATIP

```json
{
  "atip": {"version": "0.4"},
  "name": "mytool",
  "version": "1.0.0",
  "description": "Does something useful",
  "commands": {
    "run": {
      "description": "Execute main function",
      "effects": {"network": false}
    }
  }
}
```

### Command with Options

```json
{
  "commands": {
    "deploy": {
      "description": "Deploy application",
      "options": [
        {
          "name": "environment",
          "flags": ["-e", "--env"],
          "type": "enum",
          "enum": ["dev", "staging", "prod"],
          "required": true,
          "description": "Target environment"
        }
      ],
      "effects": {
        "network": true,
        "idempotent": false,
        "destructive": false
      }
    }
  }
}
```

### Nested Subcommands

```json
{
  "commands": {
    "pr": {
      "description": "Manage pull requests",
      "commands": {
        "create": {
          "description": "Create a pull request",
          "effects": {"network": true, "idempotent": false}
        },
        "list": {
          "description": "List pull requests",
          "effects": {"network": true, "idempotent": true}
        }
      }
    }
  }
}
```

---

## Relationship to MCP

ATIP is **complementary** to MCP, not competitive:

- **Use ATIP** for: Discovery/metadata for any CLI tool
- **Use MCP** for: Stateful execution (browsers, databases, streaming)
- **Use both** for: Tools that benefit from ATIP discovery + MCP execution

See [docs/why-not-mcp.md](docs/why-not-mcp.md) for detailed comparison.

---

## Questions?

- **Spec unclear?** Open a discussion or issue
- **Not sure if valid?** Validate against schema
- **Proposing changes?** See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**When in doubt, read [spec/rfc.md](spec/rfc.md) first.** 🎯
