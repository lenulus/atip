# ATIP Implementation TODO

## Project Structure

### Core Documentation
- [x] README.md - Overview, quick start, links to spec
- [x] LICENSE - MIT or Apache 2.0
- [x] CONTRIBUTING.md - How to propose changes, submit shims
- [x] CHANGELOG.md - Version history

### Specification
- [x] spec/rfc.md - Main specification (v0.4.0)
- [x] spec/versions/ - Historical versions
  - [x] spec/versions/0.1.0.md
  - [x] spec/versions/0.2.0.md
  - [x] spec/versions/0.3.0.md

### Schema
- [x] schema/0.4.json - JSON Schema for validation
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
- [ ] reference/atip-bridge/ - TypeScript/Python compiler library
  - [ ] reference/atip-bridge/package.json
  - [ ] reference/atip-bridge/src/
  - [ ] reference/atip-bridge/README.md
- [ ] reference/atip-discover/ - CLI tool for discovery

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

### Phase 4.1: atip-bridge Library (Next)
12. reference/atip-bridge/ - TypeScript compiler library
    - [ ] 4.1.1: Project setup and structure
      - [ ] Create blue/ directory with api.md, design.md, examples.md
      - [ ] Initialize npm package with TypeScript
      - [ ] Configure build tooling (tsup/esbuild)
      - [ ] Set up test framework (vitest/jest)
      - [ ] Create initial README with API reference
    - [ ] 4.1.2: Core transformers (BRGR cycle)
      - [ ] Blue: Document API contracts for toOpenAI/toGemini/toAnthropic
      - [ ] Red: Write failing tests for core transformers
      - [ ] Green: Implement toOpenAI, toGemini, toAnthropic
      - [ ] Refactor: Optimize and extract common patterns
    - [ ] 4.1.3: Safety utilities (BRGR cycle)
      - [ ] Blue: Document API contracts for safety utilities
      - [ ] Red: Write failing tests for generateSafetyPrompt, createValidator
      - [ ] Green: Implement safety utilities
      - [ ] Refactor: Clean up and document
    - [ ] 4.1.4: Lifecycle helpers (BRGR cycle)
      - [ ] Blue: Document API contracts for lifecycle helpers
      - [ ] Red: Write failing tests for handleToolResult, parseToolCall
      - [ ] Green: Implement lifecycle helpers
      - [ ] Refactor: Optimize provider-specific handling
    - [ ] 4.1.5: Integration and packaging
      - [ ] Integration tests with real ATIP examples
      - [ ] Package for npm distribution
      - [ ] Complete API documentation
      - [ ] Usage examples and cookbook

### Phase 4.2: atip-discover Tool
13. reference/atip-discover/ - CLI tool for discovery
    - [ ] 4.2.1: Project setup and structure
      - [ ] Create blue/ directory with design docs
      - [ ] Initialize project structure
      - [ ] Set up test framework
    - [ ] 4.2.2: Discovery implementation (BRGR cycle)
      - [ ] Blue: Document discovery algorithm and security model
      - [ ] Red: Write failing tests
      - [ ] Green: Implement discovery and PATH scanning
      - [ ] Refactor: Optimize and secure
    - [ ] 4.2.3: Registry and caching (BRGR cycle)
      - [ ] Blue: Document registry format and caching strategy
      - [ ] Red: Write failing tests
      - [ ] Green: Implement registry management and caching
      - [ ] Refactor: Optimize performance

### Phase 5: Shims & Partial Discovery (Future)
14. examples/kubectl-partial.json - Partial discovery example
15. shims/README.md - Shim contribution guide
16. shims/curl.json, jq.json, etc. - Example shims

### Phase 6: Extended (Future)
17. More shim examples (rsync, ffmpeg, etc.)
18. ✅ Historical spec versions (0.1.0, 0.2.0, 0.3.0)
19. schema/atip.schema.json - Symlink to latest

## Notes

- Keep examples aligned with spec v0.4.0
- JSON Schema should validate all examples
- Reference implementation should match Appendix A
- All files should reference canonical schema at https://atip.dev/schema/0.4.json
- **100% of tests must pass before marking a phase complete** (see CLAUDE.md § Phase Transitions)
- Follow BRGR methodology for all implementation phases (see CLAUDE.md § BRGR Methodology)
