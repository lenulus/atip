# ATIP Reference Implementations

This directory contains reference implementations for the ATIP (Agent Tool Introspection Protocol) ecosystem.

## Toolchain Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ATIP Toolchain                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                         ┌─────────────────┐                                     │
│                         │  atip-registry  │                                     │
│                         │                 │                                     │
│                         │ Content-address │                                     │
│                         │ shim hosting    │                                     │
│                         └────────┬────────┘                                     │
│                                  │                                              │
│                                  ↓                                              │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────┐    ┌──────────────┐        │
│  │atip-discover │ →  │   atip-bridge   │ →  │ LLM │ →  │ atip-execute │        │
│  │              │    │                 │    │     │    │              │        │
│  │ Scan PATH    │    │ Compile ATIP to │    │     │    │ Parse call   │        │
│  │ Probe --agent│    │ OpenAI/Gemini/  │    │     │    │ Validate args│        │
│  │ Load shims   │    │ Anthropic tools │    │     │    │ Check effects│        │
│  └──────────────┘    └─────────────────┘    └─────┘    │ Execute CLI  │        │
│                                                        └──────┬───────┘        │
│                                                               │                │
│                                                               ↓                │
│                                                       ┌──────────────┐         │
│                                                       │   CLI Tool   │         │
│                                                       │              │         │
│                                                       │ gh, kubectl, │         │
│                                                       │ terraform... │         │
│                                                       └──────────────┘         │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Supporting Tools                                  │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  atip-validate  │  atip-gen   │  atip-lint  │  atip-diff               │   │
│  │  Schema valid.  │  --help →   │  Quality    │  Version                 │   │
│  │                 │  metadata   │  checks     │  comparison              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Status

| Tool | Language | Status | Description |
|------|----------|--------|-------------|
| [atip-validate](./atip-validate/) | JavaScript | ✅ Complete | Schema validation CLI |
| [atip-gen](./atip-gen/) | JavaScript | ✅ Complete | Generate metadata from --help |
| [atip-bridge](./atip-bridge/) | TypeScript | ✅ Complete | Compile to LLM provider formats |
| [atip-discover](./atip-discover/) | TypeScript | ✅ Complete | Discovery CLI (canonical) |
| [atip-discover-go](./atip-discover-go/) | Go | ✅ Complete | Discovery CLI (Go port) |
| [atip-registry](./atip-registry/) | Go | 🔲 Planned | Content-addressable registry server |
| [atip-execute](./atip-execute/) | TypeScript | 🔲 Planned | Safe tool execution |
| [atip-lint](./atip-lint/) | TypeScript | 🔲 Planned | Metadata quality linter |
| [atip-diff](./atip-diff/) | TypeScript | 🔲 Planned | Version comparison |
| [atip-mcp](./atip-mcp/) | TypeScript | 🔲 Future | MCP adapter |

## Core Tools

### atip-discover

Scans your system for ATIP-compatible tools and maintains a local registry.

```bash
# Scan for tools
atip-discover scan

# List discovered tools
atip-discover list

# Get metadata for a specific tool
atip-discover get gh
```

**Implementations:**
- **TypeScript** (`atip-discover/`) - Canonical implementation, matches agent CLIs like Claude Code
- **Go** (`atip-discover-go/`) - Single binary, fast startup, ideal for standalone use

### atip-bridge

TypeScript library that compiles ATIP metadata to provider-specific function calling formats.

```typescript
import { toOpenAI, toGemini, toAnthropic } from 'atip-bridge';

const tools = toOpenAI(atipMetadata);
// Ready for OpenAI function calling
```

**Supported providers:**
- OpenAI (with strict mode support)
- Google Gemini
- Anthropic Claude

### atip-validate

Validates ATIP metadata against the JSON schema.

```bash
atip-validate examples/gh.json
```

### atip-gen

Auto-generates ATIP metadata from `--help` output.

```bash
atip-gen curl -o shims/curl.json
```

## Planned Tools

### atip-registry (Phase 4.6)

Content-addressable registry server for hosting shims (v0.6.0 feature).

**Features:**
- Hash-based shim lookup (`/shims/sha256/{hash}.json`)
- Community crawler for auto-generating shims
- Cosign signature verification

### atip-execute (Phase 4.7)

Safe execution of LLM tool calls.

**Features:**
- Parse tool calls from OpenAI/Gemini/Anthropic responses
- Map flattened names back to CLI commands (`gh_pr_create` → `gh pr create`)
- Validate arguments against ATIP metadata
- Check effects before execution (prompt for destructive operations)
- Execute with proper timeouts and error handling

### atip-lint (Phase 4.8)

Quality checks beyond schema validation.

**Rules:**
- Missing effects declarations
- Description quality (length, no placeholder text)
- Executable validation (verify binary exists, `--agent` works)

### atip-diff (Phase 4.9)

Compare ATIP metadata versions.

**Change categories:**
- Breaking: removed commands, changed required args
- Non-breaking: new commands, new optional args
- Effects changes: destructive flag added/removed

## Development

All implementations follow the **BRGR methodology** (Blue, Red, Green, Refactor):

1. **Blue** - Design docs in `blue/` directory (api.md, design.md, examples.md)
2. **Red** - Write failing tests based on design
3. **Green** - Implement minimal code to pass tests
4. **Refactor** - Improve while keeping tests green

### Running Tests

```bash
# TypeScript implementations
cd atip-bridge && npm test
cd atip-discover && npm test

# Go implementations
cd atip-discover-go && go test ./...

# JavaScript implementations
cd atip-validate && npm test
cd atip-gen && npm test
```

### All Tools Implement --agent

Every ATIP reference tool implements `--agent` itself (dogfooding):

```bash
atip-discover --agent
atip-validate --agent
atip-gen --agent
```

## Language Choices

| Tool | Language | Rationale |
|------|----------|-----------|
| atip-bridge | TypeScript | Library for JS/TS agents; matches spec Appendix A |
| atip-discover | TypeScript | Canonical CLI; matches major agent CLIs |
| atip-discover-go | Go | Single binary, fast startup |
| atip-registry | Go | Server deployment, handles hash lookups |
| atip-execute | TypeScript | Pairs with atip-bridge ecosystem |
| atip-lint | TypeScript | Extends atip-validate infrastructure |
| atip-diff | TypeScript | JSON manipulation, rich output |
| atip-mcp | TypeScript | Uses official MCP SDK |

## See Also

- [ATIP Specification](../spec/rfc.md) - Protocol specification (v0.6.0)
- [JSON Schema](../schema/0.6.json) - Validation schema
- [Examples](../examples/) - Example ATIP metadata
- [TODO.md](../TODO.md) - Implementation roadmap
