# Changelog

All notable changes to the ATIP specification.

## [0.4.0] - 2026-01

### Added
- **Trust and provenance** (`trust` field) with source taxonomy
- **Protocol versioning** (`atip` as object with `version`, `features`, `minAgentVersion`)
- **Omitted commands semantics** for partial discovery safety
- **Governance section** with extension mechanism (`x-` prefix)
- **Pattern executability** flag
- Feature registry for version negotiation

### Changed
- `atip` field now accepts both legacy string and new object format
- Examples updated to use v0.4 format

## [0.3.0] - 2026-01

### Added
- **Partial discovery** (`--commands`, `--depth` flags)
- **Interactive effects** (`effects.interactive` with `stdin`, `prompts`, `tty`)
- Context bloat mitigation via filtered metadata

## [0.2.0] - 2026-01

### Added
- **Function calling lifecycle** documentation
- **Provider translation rules** (OpenAI, Gemini, Anthropic)
- Safety metadata tunneling via description suffix
- Subcommand flattening strategies
- Reference implementation outline (`atip-bridge`)

### Changed
- Clarified MCP as edge case (5%), not default execution path

## [0.1.0] - 2026-01

### Added
- Initial specification
- `--agent` flag convention
- Core schema: `commands`, `arguments`, `options`, `effects`
- XDG-compliant file locations
- Discovery mechanism
- Basic examples (gh, kubectl, terraform)
