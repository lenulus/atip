# ATIP (Agent Tool Introspection Protocol)

## A lightweight, CLI-first protocol that allows AI agents to safely introspect local tools via a simple --agent contract, without requiring MCP servers or additional infrastructure.

[![Version](https://img.shields.io/badge/version-0.4.0-blue)](./spec/rfc.md)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## What is ATIP?

ATIP defines a simple convention for CLI tools to expose their capabilities to AI agents:

```bash
$ gh --agent
{
  "atip": {"version": "0.4"},
  "name": "gh",
  "description": "GitHub CLI",
  "commands": {
    "pr": {
      "list": {...},
      "create": {...}
    }
  },
  "effects": {
    "network": true,
    "destructive": false
  }
}
```

No servers. No JSON-RPC. No handshakes. Just a `--agent` flag that outputs structured JSON.

---

## Why ATIP?

### The Problem

AI agents need to know:
- **What tools are available?** (discovery)
- **How do I use this tool?** (parameters, types)
- **What are the side effects?** (destructive? network? cost?)
- **Is it safe to retry?** (idempotent? reversible?)

Current solutions fall short:
- **Parsing `--help`** — Inconsistent, unreliable
- **Hardcoded knowledge** — Doesn't scale to custom tools
- **MCP servers** — Overkill for simple CLI tools that execute and exit

### The Solution

**ATIP separates introspection from execution:**

| Concern | Solution |
|---------|----------|
| **Discovery** | `tool --agent` outputs metadata (ATIP) |
| **Execution** | Direct subprocess invocation |
| **Stateful tools** | MCP (when genuinely needed) |

For 95% of CLI tools (git, kubectl, terraform, gh), ATIP provides everything agents need without infrastructure overhead.

---

## Quick Start

### For Tool Authors

Add ATIP support to your CLI tool in 30 minutes:

```python
import json, sys

ATIP_METADATA = {
    "atip": {"version": "0.4"},
    "name": "mytool",
    "version": "1.0.0",
    "description": "Does something useful",
    "commands": {
        "run": {
            "description": "Execute main function",
            "options": [
                {
                    "name": "verbose",
                    "flags": ["-v", "--verbose"],
                    "type": "boolean",
                    "description": "Enable verbose output"
                }
            ],
            "effects": {
                "filesystem": {"write": true},
                "network": false,
                "idempotent": false
            }
        }
    }
}

if "--agent" in sys.argv:
    print(json.dumps(ATIP_METADATA))
    sys.exit(0)

# ... rest of your tool logic
```

See [docs/adoption-guide.md](./docs/adoption-guide.md) for full details.

### For Legacy Tools

Create a shim file for tools that don't natively support `--agent`:

```bash
# ~/.local/share/agent-tools/shims/curl.json
{
  "atip": {"version": "0.4"},
  "name": "curl",
  "version": "8.4.0",
  "description": "Transfer data from or to a server",
  "commands": {
    "": {
      "description": "Make HTTP request",
      "options": [...],
      "effects": {"network": true, "idempotent": false}
    }
  }
}
```

See [shims/README.md](./shims/README.md) for contribution guidelines.

### For Agent Developers

Integrate ATIP into your AI agent:

```python
from atip_bridge import discover_tools, compile_to_openai, execute_tool

# 1. Discovery
tools = discover_tools()  # Scans PATH and shims

# 2. Compile to provider format
openai_tools = [compile_to_openai(t) for t in tools]

# 3. Send to LLM
response = client.chat.completions.create(
    model="gpt-4",
    messages=messages,
    tools=openai_tools
)

# 4. Execute directly
for call in response.choices[0].message.tool_calls:
    result = execute_tool(call.function.name, call.function.arguments)
```

See [docs/agent-integration.md](./docs/agent-integration.md) for integration patterns.

---

## Key Features

### 🎯 Zero Infrastructure
No servers, daemons, or sockets. Works on a fresh system with only the tool binary.

### 🔒 Safety Metadata
Tools declare effects (destructive, idempotent, reversible, cost) so agents can make informed decisions:

```json
{
  "effects": {
    "destructive": true,
    "reversible": false,
    "cost": {"billable": true}
  }
}
```

### 📦 Partial Discovery
Large tools (kubectl, aws-cli) support filtered discovery to avoid context bloat:

```bash
$ kubectl --agent --commands=pods,deployments --depth=1
```

### 🔄 Interactive Tool Handling
Metadata includes stdin/TTY requirements so agents know when tools need special handling:

```json
{
  "interactive": {
    "stdin": "required",
    "prompts": true,
    "tty": false
  }
}
```

### 🌐 Universal Translation
ATIP compiles to native function calling formats for OpenAI, Gemini, and Anthropic with safety information preserved.

### 🤝 MCP Compatible
ATIP complements MCP—use ATIP for discovery, MCP for stateful execution when needed.

---

## Repository Structure

```
atip/
├── spec/rfc.md              # Full specification (v0.4.0)
├── schema/0.4.json          # JSON Schema for validation
├── examples/                # Reference implementations
│   ├── gh.json              # Full example (GitHub CLI)
│   ├── minimal.json         # Minimal valid ATIP
│   └── kubectl-partial.json # Partial discovery
├── shims/                   # Community shims for legacy tools
│   ├── curl.json
│   ├── rsync.json
│   └── jq.json
├── reference/               # Reference implementations
│   ├── atip-bridge/         # TypeScript/Python library
│   ├── atip-discover/       # Discovery CLI tool
│   └── atip-gen/            # Auto-generate shims
└── docs/                    # Additional documentation
    ├── adoption-guide.md
    ├── agent-integration.md
    └── why-not-mcp.md
```

---

## Documentation

- **[RFC Specification](./spec/rfc.md)** — Complete protocol specification
- **[Adoption Guide](./docs/adoption-guide.md)** — For tool authors
- **[Agent Integration](./docs/agent-integration.md)** — For agent developers
- **[Why Not MCP?](./docs/why-not-mcp.md)** — Positioning and comparison
- **[Contributing](./CONTRIBUTING.md)** — How to contribute

---

## Examples

### Minimal ATIP

```json
{
  "atip": {"version": "0.4"},
  "name": "hello",
  "version": "1.0.0",
  "description": "Print a greeting",
  "commands": {
    "": {
      "description": "Say hello",
      "arguments": [
        {"name": "name", "type": "string", "required": true}
      ],
      "effects": {"filesystem": {}, "network": false}
    }
  }
}
```

### Full Example

See [examples/gh.json](./examples/gh.json) for a complete GitHub CLI example with:
- Nested subcommands
- Authentication requirements
- Effect declarations
- Usage patterns

---

## Comparison to MCP

| Aspect | ATIP | MCP |
|--------|------|-----|
| **Purpose** | Tool introspection | Stateful execution |
| **Infrastructure** | None | Server process |
| **Typical tools** | gh, kubectl, terraform | Playwright, databases |
| **Use together?** | Yes — ATIP for discovery, MCP for execution |

ATIP and MCP solve different problems. See [docs/why-not-mcp.md](./docs/why-not-mcp.md) for detailed comparison.

---

## Status

**Current Version:** 0.4.0 (Draft)

This specification is open for community feedback and contributions.

### Roadmap

- [x] v0.1.0 — Core protocol and schema
- [x] v0.2.0 — Partial discovery
- [x] v0.3.0 — Interactive effects
- [x] v0.4.0 — Trust and provenance
- [ ] v0.5.0 — Reference implementation (atip-bridge)
- [ ] v1.0.0 — Stable release

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Proposing spec changes
- Contributing shims
- Reporting issues
- Submitting implementations

---

## License

This specification and reference implementations are released under the [MIT License](./LICENSE).

---

## Links

- **Specification:** [spec/rfc.md](./spec/rfc.md)
- **JSON Schema:** [schema/0.4.json](./schema/0.4.json)
- **Issues:** [GitHub Issues](https://github.com/lenulus/atip/issues)
- **Discussions:** [GitHub Discussions](https://github.com/lenulus/atip/discussions)

---

**Built for the agent-native future.**
