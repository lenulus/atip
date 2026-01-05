# Why ATIP Exists

## The Gap

AI agents need to understand local tools. Today they have three options:

1. **Parse `--help` output** — Unreliable. Every tool formats differently.
2. **Use training data** — Stale. Can't handle custom or updated tools.
3. **Spin up MCP servers** — Overkill. Most CLI tools just need "run command, get output."

ATIP fills the gap: **structured introspection without infrastructure**.

## The Insight: Introspection ≠ Execution

MCP conflates two concerns:

| Concern | What it means |
|---------|---------------|
| **Introspection** | What can this tool do? What are the effects? |
| **Execution** | Run the tool and get results |

For local CLI tools, execution is trivial—`subprocess.run()` has worked for decades.

What's missing is introspection. ATIP provides exactly that:

```bash
# Introspection (ATIP)
$ gh --agent
{"atip": {"version": "0.4"}, "name": "gh", "effects": {...}}

# Execution (direct)
$ gh pr list --json number,title
[{"number": 42, "title": "Fix bug"}]
```

No server. No handshake. No session management.

## When to Use What

```
┌─────────────────────────────────────────────────────────┐
│  Tool Discovery                                         │
│  └── ATIP (always)                                      │
├─────────────────────────────────────────────────────────┤
│  Tool Execution                                         │
│  ├── Direct subprocess (95% of cases)                   │
│  │   gh, git, kubectl, terraform, npm, cargo, etc.      │
│  │                                                      │
│  └── MCP (5% of cases)                                  │
│      Playwright, database connections, remote APIs      │
└─────────────────────────────────────────────────────────┘
```

### Use ATIP + Direct Execution When:

- Tool runs and exits (stateless)
- Output is captured from stdout/stderr
- No persistent session needed
- Local binary exists

**Examples:** `gh`, `git`, `kubectl`, `terraform`, `npm`, `cargo`, `docker`, `curl`, `jq`, `ffmpeg`

### Use MCP When:

- Tool requires persistent state (browser session, DB connection)
- Bidirectional communication needed
- No local binary (remote API only)
- Multiple agents share one tool instance

**Examples:** Playwright, database explorers, OAuth flows, real-time collaboration tools

## ATIP Complements MCP

They're not competitors:

| Aspect | ATIP | MCP |
|--------|------|-----|
| Purpose | Discovery | Stateful execution |
| Infrastructure | None | Server process |
| Overhead | ~50ms (one subprocess) | Persistent connection |
| Best for | CLI tools | Interactive services |

An agent might use both:
1. **ATIP** to discover what's available
2. **Direct execution** for most tools
3. **MCP** for the few that need it

## What ATIP Provides That `--help` Doesn't

| Feature | `--help` | ATIP |
|---------|----------|------|
| Structured arguments | ❌ Parse text | ✅ JSON schema |
| Side effects | ❌ Unknown | ✅ `effects.destructive`, `effects.network` |
| Idempotency | ❌ Unknown | ✅ `effects.idempotent` |
| Reversibility | ❌ Unknown | ✅ `effects.reversible` |
| Cost/billing | ❌ Unknown | ✅ `effects.cost.billable` |
| Interactive stdin | ❌ Unknown | ✅ `effects.interactive` |
| Trust/provenance | ❌ N/A | ✅ `trust.source`, `trust.verified` |
| Usage patterns | ❌ Maybe examples | ✅ `patterns[]` |

## The Safety Argument

Agents making autonomous decisions need more than argument schemas. They need to know:

- **Will this delete something permanently?** → `destructive: true`
- **Is it safe to retry on failure?** → `idempotent: true`
- **Can I undo this if wrong?** → `reversible: true`
- **Will this cost money?** → `cost.billable: true`
- **Will it hang waiting for input?** → `interactive.stdin: "required"`

Without this metadata, agents either:
- Ask for confirmation on everything (annoying)
- Never ask (dangerous)

ATIP enables **risk-proportionate friction**.

## Adoption Path

ATIP is designed for incremental adoption:

1. **Shim-first** — Community creates metadata for popular tools
2. **Native support** — Tool authors add `--agent` flag
3. **Agent integration** — Claude Code, Gemini CLI adopt the protocol
4. **Ecosystem growth** — Registry of trusted shims, verification tooling

The protocol requires nothing from tool authors until they're ready. Shims bridge the gap.
