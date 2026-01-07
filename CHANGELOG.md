# Changelog

All notable changes to the ATIP specification.

## [0.6.0] - 2026-01

### Added
- **Content-addressable registry** - shims indexed by binary SHA-256 hash
- New feature flag: `content-addressable`
- **Community crawler** specification for automated shim generation
- Auto-generation from `--help` parsing with `trust.source: "inferred"`
- Registry bootstrap and coverage tracking metrics
- `binary` block in shim format (`hash`, `name`, `version`, `platform`)
- Catalog endpoint for browsable tool/version/platform matrix

### Changed
- Registry format version bumped to "2" (hash-based)
- Directory structure reorganized for hash-based storage (`shims/sha256/`)
- Simplified verification flow: hash lookup IS the integrity check
- `trust.integrity.checksum` removed (implicit via content-addressable lookup)
- Shim files now named by binary hash, not tool name

## [0.5.1] - 2026-01

### Fixed
- Minor documentation corrections

## [0.5.0] - 2026-01

### Added
- **Cryptographic verification** via SLSA attestations and Sigstore signatures
- `trust.integrity` field for binary integrity verification (Sigstore/Cosign)
- `trust.provenance` field for SLSA attestation links
- New feature flags: `trust-integrity`, `trust-provenance`
- **Local registry format** specification (`registry.json`)
- **Remote registry protocol** (static file hosting, API endpoints)
- Registry discovery and sync mechanisms
- Organization registry support with policy files
- Shim signing workflow with Cosign
- Verification utilities in atip-bridge interface (`verifyBinaryIntegrity`, `verifyCosignSignature`, etc.)
- `TrustLevel` enum with verification states

### Changed
- §4 renamed from "File Locations" to "File Locations and Registry"
- Expanded trust section with detailed verification flows
- Added SLSA/Sigstore references to specification

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
