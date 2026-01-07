# ATIP Implementation TODO

## Project Structure

### Core Documentation
- [x] README.md - Overview, quick start, links to spec
- [x] LICENSE - MIT or Apache 2.0
- [x] CONTRIBUTING.md - How to propose changes, submit shims
- [x] CHANGELOG.md - Version history

### Specification
- [x] spec/rfc.md - Main specification (v0.6.0)
- [x] spec/versions/ - Historical versions
  - [x] spec/versions/0.1.0.md
  - [x] spec/versions/0.2.0.md
  - [x] spec/versions/0.3.0.md
  - [x] spec/versions/0.4.0.md
  - [x] spec/versions/0.5.0.md
  - [x] spec/versions/0.5.1.md
  - [x] spec/versions/0.6.0.md

### Schema
- [x] schema/0.4.json - JSON Schema for v0.4.0
- [x] schema/0.6.json - JSON Schema for v0.6.0 (current)
- [ ] schema/atip.schema.json - Symlink to latest version

### Shims (Community-maintained tool metadata)
- [ ] shims/README.md - How to contribute shims
- [ ] shims/curl.json - Example: curl tool
- [ ] shims/rsync.json - Example: rsync tool
- [ ] shims/ffmpeg.json - Example: ffmpeg tool
- [ ] shims/jq.json - Example: jq tool

### Examples
- [x] examples/gh.json - Full example (GitHub CLI)
- [ ] examples/kubectl-partial.json - Partial discovery example
- [x] examples/minimal.json - Minimal valid ATIP

### Reference Implementations
- [x] reference/atip-validate/ - Schema validation CLI tool
- [x] reference/atip-gen/ - Auto-generate shims from --help
- [x] reference/atip-bridge/ - TypeScript compiler library
- [x] reference/atip-discover/ - CLI tool for discovery (TypeScript, canonical)
- [x] reference/atip-discover-go/ - CLI tool for discovery (Go, alternative)
- [ ] reference/atip-registry/ - Content-addressable registry server (Go)

### Documentation
- [x] docs/why-atip.md - Positioning document (why ATIP exists)
- [x] docs/adoption-guide.md - For tool authors
- [x] docs/agent-integration.md - For agent developers

## Priority Order

### Phase 1: Foundation (Immediate) ✅ COMPLETE
1. ✅ README.md - Project introduction
2. ✅ LICENSE - Legal foundation
3. ✅ CONTRIBUTING.md - Contribution guidelines
4. ✅ schema/0.4.json - Validation schema

### Phase 2: Validation Tooling ✅ COMPLETE
5. ✅ reference/atip-validate/ - Schema validation CLI tool
6. ✅ examples/minimal.json - Simple reference (validated)

### Phase 3: Examples & Documentation ✅ COMPLETE
7. ✅ docs/why-atip.md - Positioning document
8. ✅ docs/adoption-guide.md - Help tool authors adopt
9. ✅ docs/agent-integration.md - Agent integration guide

### Phase 3.5: Additional Examples & Tooling ✅ COMPLETE
10. ✅ examples/gh.json - Full-featured reference (generated via atip-gen)
11. ✅ reference/atip-gen/ - --help to --agent metadata generator

### Phase 4: Reference Implementations

**Language Choices:**
| Implementation | Language | Tooling | Rationale |
|---------------|----------|---------|-----------|
| atip-bridge | TypeScript | npm, tsup, vitest | Library for JS/TS agents; matches spec Appendix A |
| atip-bridge-py | Python | uv, pytest | Python port (future) - better debugging, wider adoption |
| atip-discover | TypeScript | npm, tsup, vitest | Canonical CLI tool; matches major agent CLIs (Claude Code, etc.) |
| atip-discover-go | Go | go test | Go port; single binary, fast startup, ideal for standalone use |
| atip-registry | Go | go test | Registry server; single binary, good for deployment, handles hash lookups |

**BRGR Agent Workflow:**
Each BRGR phase uses a dedicated Claude Code agent (defined in `.claude/agents/`):
- **Blue** → `brgr-blue-spec-writer` (creates design docs in `blue/`)
- **Red** → `brgr-red-test-writer` (creates failing tests based on design)
- **Green** → `brgr-green-implementer` (implements minimal code to pass tests)
- **Refactor** → `brgr-refactor` (improves code while keeping tests green)

---

### Phase 4.1: atip-bridge Library (TypeScript)

12. reference/atip-bridge/ - TypeScript compiler library
    - [x] 4.1.1: Project setup and Blue phase ✅
      - [x] **Use `brgr-blue-spec-writer` agent** to create:
        - [x] `blue/api.md` - Public API contracts and signatures
        - [x] `blue/design.md` - Architecture decisions and rationale
        - [x] `blue/examples.md` - Usage examples and expected behaviors
      - [x] Initialize npm package with TypeScript
      - [x] Configure build tooling (tsup/esbuild)
      - [x] Set up test framework (vitest)
      - [ ] Create initial README with API reference
    - [x] 4.1.2: Core transformers (BRGR cycle) ✅
      - [x] Blue: Document API contracts for toOpenAI/toGemini/toAnthropic
      - [x] Red: **Use `brgr-red-test-writer` agent** for core transformer tests
      - [x] Green: **Use `brgr-green-implementer` agent** to implement transformers
      - [ ] Refactor: **Use `brgr-refactor` agent** to optimize and extract patterns
    - [x] 4.1.3: Safety utilities (BRGR cycle) ✅
      - [x] Blue: Document API contracts for safety utilities
      - [x] Red: **Use `brgr-red-test-writer` agent** for safety utility tests
      - [x] Green: **Use `brgr-green-implementer` agent** to implement utilities
      - [ ] Refactor: **Use `brgr-refactor` agent** to clean up and document
    - [x] 4.1.4: Lifecycle helpers (BRGR cycle) ✅
      - [x] Blue: Document API contracts for lifecycle helpers
      - [x] Red: **Use `brgr-red-test-writer` agent** for lifecycle helper tests
      - [x] Green: **Use `brgr-green-implementer` agent** to implement helpers
      - [ ] Refactor: **Use `brgr-refactor` agent** to optimize provider handling
    - [ ] 4.1.5: Integration and packaging
      - [x] Integration tests with real ATIP examples
      - [ ] Package for npm distribution
      - [ ] Complete API documentation
      - [ ] Usage examples and cookbook

### Phase 4.2: atip-discover-go Tool (Go) ✅ COMPLETE

13. reference/atip-discover-go/ - Go CLI tool for discovery
    - [x] 4.2.1: Project setup and Blue phase ✅
      - [x] **Use `brgr-blue-spec-writer` agent** to create `blue/` design docs
      - [x] Initialize Go module
      - [x] Set up test framework (go test)
    - [x] 4.2.2: Discovery implementation (BRGR cycle) ✅
      - [x] Blue: Document discovery algorithm and security model
      - [x] Red: **Use `brgr-red-test-writer` agent** for discovery tests
      - [x] Green: **Use `brgr-green-implementer` agent** to implement discovery
      - [x] Refactor: **Use `brgr-refactor` agent** to optimize and secure
    - [x] 4.2.3: Registry and caching (BRGR cycle) ✅
      - [x] Blue: Document registry format and caching strategy
      - [x] Red: **Use `brgr-red-test-writer` agent** for registry tests
      - [x] Green: **Use `brgr-green-implementer` agent** to implement registry
      - [x] Refactor: **Use `brgr-refactor` agent** to optimize performance

### Phase 4.3: atip-bridge-py (Python)

14. reference/atip-bridge-py/ - Python port of atip-bridge
    - [ ] 4.3.1: Project setup and Blue phase
      - [ ] **Use `brgr-blue-spec-writer` agent** to create `blue/` design docs
      - [ ] Initialize Python package (uv)
      - [ ] Set up test framework (pytest)
    - [ ] 4.3.2: Core transformers (BRGR cycle)
      - [ ] Port toOpenAI/toGemini/toAnthropic from TypeScript
      - [ ] Red: **Use `brgr-red-test-writer` agent** for transformer tests
      - [ ] Green: **Use `brgr-green-implementer` agent** to implement
      - [ ] Refactor: **Use `brgr-refactor` agent** to make Pythonic
    - [ ] 4.3.3: Safety utilities and lifecycle helpers (BRGR cycle)
      - [ ] Port remaining utilities from TypeScript
      - [ ] Full test coverage with pytest
    - [ ] 4.3.4: Packaging
      - [ ] Package for PyPI distribution
      - [ ] Complete API documentation (Sphinx/mkdocs)

### Phase 4.4: atip-discover (TypeScript) - Canonical Implementation ✅ COMPLETE

15. reference/atip-discover/ - Canonical TypeScript CLI tool for discovery
    - [x] 4.4.1: Project setup and Blue phase ✅
      - [x] **Use `brgr-blue-spec-writer` agent** to create `blue/` design docs
      - [x] Initialize npm package with TypeScript
      - [x] Configure build tooling (tsup/esbuild)
      - [x] Set up test framework (vitest)
    - [x] 4.4.2: Discovery implementation (BRGR cycle) ✅
      - [x] Blue: Port discovery algorithm from Go implementation
      - [x] Red: **Use `brgr-red-test-writer` agent** for discovery tests (137 tests)
      - [x] Green: **Use `brgr-green-implementer` agent** to implement discovery
      - [x] Refactor: **Use `brgr-refactor` agent** to optimize
    - [x] 4.4.3: Registry and CLI (BRGR cycle) ✅
      - [x] Blue: Port registry format and CLI from Go
      - [x] Red: **Use `brgr-red-test-writer` agent** for registry/CLI tests
      - [x] Green: **Use `brgr-green-implementer` agent** to implement
      - [x] Refactor: **Use `brgr-refactor` agent** to make idiomatic TypeScript
    - [x] 4.4.4: Packaging ✅
      - [x] CLI binary via npm link / npx
      - [x] README with installation and usage guide
      - [x] Implements `--agent` flag (dogfooding!)

### Phase 4.5: Dogfooding - ATIP Tools Implement --agent ✅ COMPLETE

Make all ATIP reference tools implement the `--agent` flag themselves:

16. Add `--agent` flag to reference implementations
    - [x] atip-discover (TypeScript) - Implements `--agent` ✅
    - [x] atip-discover-go (Go) - Add `--agent` flag ✅
    - [x] atip-validate - Add `--agent` flag ✅
    - [x] atip-gen - Add `--agent` flag ✅
    - [ ] atip-bridge CLI wrapper (if applicable)

17. Create example ATIP-native tools
    - [x] examples/tools/hello-atip - Minimal example tool with `--agent` ✅
    - [x] examples/tools/atip-echo - Echo tool demonstrating effects metadata ✅
    - [x] examples/tools/README.md - Documentation: "How to add --agent to your CLI tool" ✅

### Phase 4.6: atip-registry (Go) - Content-Addressable Registry Server

18. reference/atip-registry/ - Go server for content-addressable shim registry (v0.6.0)
    - [ ] 4.6.1: Project setup and Blue phase
      - [ ] **Use `brgr-blue-spec-writer` agent** to create `blue/` design docs
      - [ ] Initialize Go module
      - [ ] Set up test framework (go test)
    - [ ] 4.6.2: Registry server (BRGR cycle)
      - [ ] Blue: Document API endpoints per spec §4.4 (Remote registry protocol)
      - [ ] Red: **Use `brgr-red-test-writer` agent** for server tests
      - [ ] Green: **Use `brgr-green-implementer` agent** to implement
      - [ ] Refactor: **Use `brgr-refactor` agent** to optimize
      - [ ] Endpoints:
        - [ ] `GET /shims/sha256/{hash}.json` - Fetch shim by binary hash
        - [ ] `GET /catalog.json` - Tool/version/platform matrix
        - [ ] `GET /registry.json` - Full registry index
    - [ ] 4.6.3: Community crawler (BRGR cycle)
      - [ ] Blue: Document crawler algorithm per spec §4.10
      - [ ] Red: **Use `brgr-red-test-writer` agent** for crawler tests
      - [ ] Green: **Use `brgr-green-implementer` agent** to implement
      - [ ] Refactor: **Use `brgr-refactor` agent** to optimize
      - [ ] Features:
        - [ ] Auto-generate shims from `--help` parsing
        - [ ] Binary hash computation (SHA-256)
        - [ ] `trust.source: "inferred"` for auto-generated shims
    - [ ] 4.6.4: Sync and integrity (BRGR cycle)
      - [ ] Blue: Document sync protocol per spec §4.7
      - [ ] Red: **Use `brgr-red-test-writer` agent** for sync tests
      - [ ] Green: **Use `brgr-green-implementer` agent** to implement
      - [ ] Features:
        - [ ] Cosign signature verification (optional)
        - [ ] Registry sync client
        - [ ] Local cache management
    - [ ] 4.6.5: Packaging and deployment
      - [ ] Single binary distribution
      - [ ] Docker image
      - [ ] README with deployment guide
      - [ ] Implements `--agent` flag (dogfooding!)

### Phase 5: Shims & Partial Discovery (Future)
19. examples/kubectl-partial.json - Partial discovery example
20. shims/README.md - Shim contribution guide
21. shims/curl.json, jq.json, etc. - Example shims

### Phase 6: Extended (Future)
22. More shim examples (rsync, ffmpeg, etc.)
23. ✅ Historical spec versions (0.1.0, 0.2.0, 0.3.0)
24. schema/atip.schema.json - Symlink to latest

### Phase 7: Post v0.6.0 Update Validation

After updating all reference tools from v0.4 to v0.6:

- [ ] Run atip-discover (TypeScript) tests: `cd reference/atip-discover && npm test`
- [ ] Run atip-discover-go tests: `cd reference/atip-discover-go && go test ./...`
- [ ] Run atip-bridge tests: `cd reference/atip-bridge && npm test`
- [ ] Run atip-validate tests: `cd reference/atip-validate && npm test`
- [ ] Validate all examples against schema/0.6.json

## Notes

- Keep examples aligned with spec v0.6.0
- JSON Schema should validate all examples
- Reference implementation should match Appendix A
- All files should reference canonical schema at https://atip.dev/schema/0.6.json
- **100% of tests must pass before marking a phase complete** (see CLAUDE.md § Phase Transitions)
- Follow BRGR methodology for all implementation phases (see CLAUDE.md § BRGR Methodology)
