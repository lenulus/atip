# ATIP Implementation TODO

## Project Structure

### Core Documentation
- [x] README.md - Overview, quick start, links to spec
- [x] LICENSE - MIT or Apache 2.0
- [x] CONTRIBUTING.md - How to propose changes, submit shims
- [ ] CHANGELOG.md - Version history

### Specification
- [x] spec/rfc.md - Main specification (v0.4.0)
- [ ] spec/versions/ - Historical versions
  - [ ] spec/versions/0.1.0.md
  - [ ] spec/versions/0.2.0.md
  - [ ] spec/versions/0.3.0.md

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
- [ ] examples/gh.json - Full example (GitHub CLI)
- [ ] examples/kubectl-partial.json - Partial discovery example
- [ ] examples/minimal.json - Minimal valid ATIP

### Reference Implementations
- [ ] reference/atip-bridge/ - TypeScript/Python compiler library
  - [ ] reference/atip-bridge/package.json
  - [ ] reference/atip-bridge/src/
  - [ ] reference/atip-bridge/README.md
- [ ] reference/atip-discover/ - CLI tool for discovery
- [ ] reference/atip-gen/ - Auto-generate shims from --help

### Documentation
- [ ] docs/why-not-mcp.md - Positioning document
- [ ] docs/adoption-guide.md - For tool authors
- [ ] docs/agent-integration.md - For agent developers

## Priority Order

### Phase 1: Foundation (Immediate) ✅ COMPLETE
1. ✅ README.md - Project introduction
2. ✅ LICENSE - Legal foundation
3. ✅ CONTRIBUTING.md - Contribution guidelines
4. ✅ schema/0.4.json - Validation schema

### Phase 2: Examples & Documentation (Next)
5. examples/minimal.json - Simple reference
6. examples/gh.json - Full-featured reference
7. docs/adoption-guide.md - Help tool authors adopt
8. shims/README.md - Shim contribution guide

### Phase 3: Reference Implementation (Later)
9. reference/atip-bridge/ - Core library
10. reference/atip-discover/ - Discovery tool
11. reference/atip-gen/ - Shim generator

### Phase 4: Extended Examples (Future)
12. More shim examples
13. Historical spec versions
14. Additional documentation

## Notes

- Keep examples aligned with spec v0.4.0
- JSON Schema should validate all examples
- Reference implementation should match Appendix A
- All files should reference canonical schema at https://atip.dev/schema/0.4.json
