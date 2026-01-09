# Phase 4.4.5 Test Suite: Trust Verification & Two-Phase Safe Probing

This document describes the RED phase test suite for Phase 4.4.5 of atip-discover, covering:
1. **Two-phase safe probing** (security enhancement to discovery)
2. **Trust verification** (cryptographic validation of tools)

## Test Organization

### Unit Tests

```
tests/unit/
├── discovery/
│   └── checkHelpForAgent.test.ts    (~10 tests)  - Phase 1: --help checking
├── probe-two-phase.test.ts          (~8 tests)   - Phase 2: --agent execution
└── trust/
    ├── hash.test.ts                 (~10 tests)  - SHA-256 hash computation
    ├── cosign.test.ts               (~12 tests)  - Cosign signature verification
    ├── slsa.test.ts                 (~10 tests)  - SLSA provenance verification
    └── evaluator.test.ts            (~15 tests)  - Trust level evaluation
```

### Integration Tests

```
tests/integration/
└── trust.test.ts                    (~8 tests)   - End-to-end trust verification
```

**Total Test Count**: ~73 tests

## Two-Phase Safe Probing Tests

### Rationale

Per design.md section 2.6 "Subprocess Execution Safety", blindly executing `--agent` on arbitrary binaries is unsafe. The two-phase approach:

1. **Phase 1**: Execute `--help` (universally safe) and check if `--agent` is documented
2. **Phase 2**: Only execute `--agent` if Phase 1 confirmed support

This prevents triggering unknown behavior, permission prompts, or errors.

### Test Coverage

#### `tests/unit/discovery/checkHelpForAgent.test.ts`

Tests the Phase 1 helper function that parses --help output:

- ✅ Returns true when `--agent` appears in help text
- ✅ Returns true when `-agent` short form appears
- ✅ Returns true when ATIP/agent keywords appear
- ✅ Returns false when no agent reference exists
- ✅ Returns false when --help command fails
- ✅ Returns false when --help times out
- ✅ Returns false for non-executable files
- ✅ Handles stderr output (some tools output help to stderr)
- ✅ Respects custom timeout option
- ✅ Handles case variations

**Contract**: Never throws - returns `false` on any error (safe default).

#### `tests/unit/probe-two-phase.test.ts`

Tests the enhanced `probe()` function with two-phase logic:

- ✅ Skips --agent execution if Phase 1 doesn't find support
- ✅ Executes --agent only after confirming Phase 1 success
- ✅ Returns null for tools without --agent in help
- ✅ Properly chains Phase 1 → Phase 2 on success
- ✅ Handles Phase 1 timeout without proceeding to Phase 2
- ✅ Handles Phase 2 failure gracefully after Phase 1 success
- ✅ Handles invalid JSON in Phase 2
- ✅ Handles stderr in both phases separately

**Key Security Property**: `--agent` is NEVER executed unless `--help` explicitly documents it.

### Mock Binary Pattern

All tests create temporary executables in `os.tmpdir()`:

```typescript
beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// Create mock executable
const toolPath = path.join(tmpDir, 'tool-name');
await fs.writeFile(toolPath, `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Help text with --agent flag"
  exit 0
elif [ "$1" = "--agent" ]; then
  echo '{"atip":"0.4","name":"test","version":"1.0.0","description":"test"}'
  exit 0
fi
exit 1
`, { mode: 0o755 });
```

**Critical**: No tests reference system paths like `/usr/local/bin` or attempt to create files outside tmpdir.

## Trust Verification Tests

### Rationale

Per spec section 3.2.2, ATIP provides cryptographic verification mechanisms:
- **Integrity**: SHA-256 checksums detect tampering
- **Signatures**: Sigstore/Cosign keyless signing proves authenticity
- **Provenance**: SLSA attestations prove build origin

These tests validate the trust module implementation against the API contracts in api.md.

### Test Coverage

#### `tests/unit/trust/hash.test.ts`

Tests SHA-256 hash computation for binaries:

- ✅ Computes SHA-256 hash of binary file
- ✅ Returns lowercase hex encoding
- ✅ Computes consistent hash for same content
- ✅ Computes different hashes for different content
- ✅ Handles large files efficiently (streaming)
- ✅ Handles empty files
- ✅ Throws TrustError if file cannot be read
- ✅ Throws TrustError if file is a directory
- ✅ Formats hash suitable for content-addressable lookup
- ✅ Handles binary content correctly

**Contract**: Returns `HashResult` with `{ algorithm: 'sha256', hash: string, formatted: string }`.

#### `tests/unit/trust/cosign.test.ts`

Tests Cosign signature verification via CLI:

- ✅ Returns verified true when cosign verification succeeds
- ✅ Returns verified false when verification fails
- ✅ Throws TrustError if cosign CLI is not installed
- ✅ Supports signature bundles for offline verification
- ✅ Respects timeout option
- ✅ Verifies identity matches expected value
- ✅ Verifies issuer matches expected value
- ✅ Includes raw output for debugging
- ✅ Handles non-existent target file
- ✅ Only supports cosign type currently (GPG/minisign future)
- ✅ Parses cosign error messages into error field
- ✅ Handles network failures gracefully

**Contract**: Returns `SignatureVerificationResult` with `{ verified: boolean, type, identity?, error?, rawOutput? }`.

**Dependency**: Requires `cosign` CLI in PATH. Tests throw `TrustError` with code `COSIGN_NOT_INSTALLED` if missing.

#### `tests/unit/trust/slsa.test.ts`

Tests SLSA provenance attestation verification:

- ✅ Returns verified true when attestation is valid
- ✅ Returns verified false when attestation fetch fails
- ✅ Verifies attestation subject matches binary hash
- ✅ Validates claimed SLSA level against attestation contents
- ✅ Supports minimum level threshold
- ✅ Supports in-toto format in addition to SLSA v1
- ✅ Verifies builder identity if allowedBuilders is set
- ✅ Rejects if builder is not in allowedBuilders
- ✅ Respects timeout option for network operations
- ✅ Includes attestation details in result

**Contract**: Returns `ProvenanceVerificationResult` with `{ verified: boolean, slsaLevel?, builder?, error?, attestation? }`.

**Network**: Fetches attestations from provenance.url (requires network access or offline mode).

#### `tests/unit/trust/evaluator.test.ts`

Tests trust level evaluation logic (combines all checks):

- ✅ Returns COMPROMISED when hash mismatch is detected
- ✅ Returns UNSIGNED when no signature is provided
- ✅ Returns UNSIGNED when signature verification fails
- ✅ Returns UNVERIFIED when signature verification is skipped
- ✅ Returns PROVENANCE_FAIL when SLSA attestation fails
- ✅ Returns VERIFIED when all checks pass
- ✅ Includes recommendation based on trust level
- ✅ Recommends block for COMPROMISED
- ✅ Recommends confirm for UNSIGNED
- ✅ Recommends execute for VERIFIED
- ✅ Handles offline mode gracefully
- ✅ Respects allowedSignerIdentities option
- ✅ Provides detailed check results for debugging
- ✅ Handles trust metadata with no integrity or provenance
- ✅ Prioritizes hash mismatch over other checks

**Contract**: Returns `TrustEvaluationResult` with `{ level: TrustLevel, reason: string, checks: {...}, recommendation: string }`.

**Trust Level Hierarchy**:
```
COMPROMISED (0) → UNSIGNED (1) → UNVERIFIED (2) → PROVENANCE_FAIL (3) → VERIFIED (4)
```

#### `tests/integration/trust.test.ts`

End-to-end trust verification tests:

- ✅ Verifies trust for tool with full cryptographic verification
- ✅ Detects compromised binaries via hash mismatch
- ✅ Handles tools without trust metadata
- ✅ Works in offline mode when network is unavailable
- ✅ Computes and returns binary hash regardless of verification
- ✅ Includes source information from metadata
- ✅ Handles minimum SLSA level requirements
- ✅ Provides comprehensive evaluation results

**Contract**: Tests the `verifyTrust()` high-level function that orchestrates all verification steps.

## Expected Failures (RED Phase)

All tests are **designed to fail** because the implementation doesn't exist yet:

### Import Errors

```
Error: Cannot find module '../../../src/trust/hash'
Error: Cannot find module '../../../src/trust/cosign'
Error: Cannot find module '../../../src/trust/slsa'
Error: Cannot find module '../../../src/trust/evaluator'
Error: Cannot find module '../../src/trust'
Error: Cannot find module '../../../src/discovery/prober' (checkHelpForAgent export)
```

### Expected Failure Messages

- `Module not found` or `Cannot resolve module`
- `checkHelpForAgent is not exported from prober module`
- `TrustLevel enum not found`
- `computeBinaryHash is not a function`
- `verifyCosignSignature is not a function`
- `verifySLSAProvenance is not a function`
- `evaluateTrustLevel is not a function`
- `verifyTrust is not a function`

## Running the Tests

### Run All Tests (Will Fail)

```bash
npm test
```

Expected output:
```
FAIL tests/unit/discovery/checkHelpForAgent.test.ts
FAIL tests/unit/probe-two-phase.test.ts
FAIL tests/unit/trust/hash.test.ts
FAIL tests/unit/trust/cosign.test.ts
FAIL tests/unit/trust/slsa.test.ts
FAIL tests/unit/trust/evaluator.test.ts
FAIL tests/integration/trust.test.ts

Tests:  0 passed, 73 failed, 73 total
```

### Run Specific Test Suites

```bash
# Two-phase probing tests
npm test tests/unit/discovery/checkHelpForAgent.test.ts
npm test tests/unit/probe-two-phase.test.ts

# Trust verification tests
npm test tests/unit/trust/

# Integration tests
npm test tests/integration/trust.test.ts
```

## Coverage Goals

When implemented (GREEN phase), aim for:

- **Overall coverage**: 80%+
- **Safety-critical code**: 100%
  - `checkHelpForAgent` (security)
  - `evaluateTrustLevel` (security)
  - Hash verification logic
- **Trust module**: 90%+
  - All cryptographic verification paths
  - Error handling for network failures
  - Offline mode fallbacks

## API Contracts Tested

These tests validate implementation against `blue/api.md`:

### Discovery Module

- `checkHelpForAgent(executablePath, options?)` → `Promise<boolean>`
- `probe(executablePath, options?)` → `Promise<AtipMetadata | null>` (enhanced)

### Trust Module

- `computeBinaryHash(binaryPath)` → `Promise<HashResult>`
- `verifyCosignSignature(targetPath, signature, options?)` → `Promise<SignatureVerificationResult>`
- `verifySLSAProvenance(binaryPath, provenance, options?)` → `Promise<ProvenanceVerificationResult>`
- `evaluateTrustLevel(binaryPath, trust, options?)` → `Promise<TrustEvaluationResult>`
- `verifyTrust(binaryPath, metadata, options?)` → `Promise<TrustVerificationResult>`

### Trust Types

- `TrustLevel` enum: `COMPROMISED | UNSIGNED | UNVERIFIED | PROVENANCE_FAIL | VERIFIED`
- `TrustSignature`: `{ type, identity, issuer, bundle? }`
- `TrustIntegrity`: `{ checksum?, signature? }`
- `TrustProvenance`: `{ url, format, slsaLevel, builder? }`
- `AtipTrustFull`: `{ source, verified, integrity?, provenance? }`

## Security Considerations

### Two-Phase Probing

**Critical Security Property**: The two-phase approach prevents executing unknown flags on tools that don't support ATIP.

**Test Validation**:
- Phase 1 failure must prevent Phase 2 execution
- No test should trigger `--agent` without confirming `--help` support
- Timeouts in Phase 1 must safely abort without Phase 2

### Trust Verification

**Critical Security Property**: Hash mismatches MUST result in `TrustLevel.COMPROMISED`.

**Test Validation**:
- COMPROMISED takes priority over all other checks
- Hash verification always runs first
- Recommendation for COMPROMISED must be 'block'

**Non-Critical Security Property**: Missing signatures result in UNSIGNED, not failure.

**Test Validation**:
- Trust verification degrades gracefully
- Offline mode returns UNVERIFIED instead of failing
- Network failures don't crash, just lower trust level

## Implementation Notes

### Module Structure (to be created in GREEN phase)

```
src/
├── discovery/
│   └── prober.ts         # Add checkHelpForAgent() export
└── trust/
    ├── index.ts          # Module exports
    ├── types.ts          # Trust type definitions
    ├── hash.ts           # SHA-256 computation
    ├── cosign.ts         # Cosign verification
    ├── slsa.ts           # SLSA verification
    ├── evaluator.ts      # Trust level evaluation
    └── errors.ts         # TrustError class
```

### Dependencies Required

```json
{
  "dependencies": {
    // No new dependencies - uses Node.js crypto module
  }
}
```

**Note**: `cosign` CLI must be installed separately by users who want signature verification.

### Next Steps (GREEN Phase)

1. Create `src/trust/` directory structure
2. Implement `computeBinaryHash()` using Node.js crypto
3. Implement `verifyCosignSignature()` with child_process
4. Implement `verifySLSAProvenance()` with fetch + parsing
5. Implement `evaluateTrustLevel()` with decision logic
6. Implement `verifyTrust()` as orchestrator
7. Export `checkHelpForAgent()` from prober module
8. Enhance `probe()` to use two-phase logic
9. Run tests - should all pass
10. Check coverage - aim for 80%+ (90%+ for trust module)

## Test Fixtures

All tests use temporary directories created via `os.tmpdir()`:

```typescript
let tmpDir: string;

beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```

**No test should**:
- Reference system paths like `/usr/local/bin`
- Attempt to create files outside tmpdir
- Depend on specific tools being installed (except cosign for signature tests)

## Verification Checklist

Before moving to GREEN phase, confirm:

- [x] All API contracts from api.md have corresponding tests
- [x] Two-phase probing workflow is fully tested
- [x] Trust verification workflow is fully tested
- [x] Tests use real temp directories (not mocked filesystem)
- [x] Tests will fail with clear import errors
- [x] No implementation code was written
- [x] Coverage goals are documented
- [x] Test README explains strategy
- [x] All tests follow existing vitest patterns
- [x] Mock binaries use tmpdir exclusively

## References

- **Spec**: `/Users/anthonylaforge/dev/atip/spec/rfc.md` section 3.2.2 (Trust metadata)
- **API**: `/Users/anthonylaforge/dev/atip/reference/atip-discover/blue/api.md` section "Trust Verification API"
- **Design**: `/Users/anthonylaforge/dev/atip/reference/atip-discover/blue/design.md` section "Trust Verification Module"
- **Examples**: `/Users/anthonylaforge/dev/atip/reference/atip-discover/blue/examples.md`
- **CLAUDE.md**: `/Users/anthonylaforge/dev/atip/CLAUDE.md` (BRGR methodology, testing requirements)
