/**
 * Trust verification module
 * Phase 4.4.5 - Trust verification and two-phase safe probing
 */

import type { AtipMetadata } from '../types';
import type {
  AtipTrustFull,
  TrustVerificationOptions,
  TrustVerificationResult,
} from './types';
import { TrustLevel } from './types';
import { computeBinaryHash } from './hash';
import { evaluateTrustLevel } from './evaluator';

// Re-export types
export type {
  TrustLevel,
  TrustSignature,
  TrustIntegrity,
  TrustProvenance,
  AtipTrustFull,
  HashResult,
  SignatureVerificationResult,
  ProvenanceVerificationResult,
  TrustEvaluationResult,
  TrustVerificationOptions,
  TrustVerificationResult,
} from './types';

// Re-export TrustLevel enum
export { TrustLevel as TrustLevelEnum } from './types';

// Re-export error types
export { TrustError } from './errors';
export type { TrustErrorCode } from './errors';

// Re-export functions
export { computeBinaryHash } from './hash';
export { verifyCosignSignature } from './cosign';
export { verifySLSAProvenance } from './slsa';
export { evaluateTrustLevel } from './evaluator';

/**
 * Verify trust for a discovered tool (main entry point for trust verification).
 *
 * This is the primary function for verifying tool integrity after discovery.
 * It orchestrates all trust verification checks based on available metadata.
 *
 * @param binaryPath - Absolute path to the tool binary
 * @param metadata - ATIP metadata from discovery (may include trust field)
 * @param options - Verification options (signatures, provenance, SLSA level, etc.)
 * @returns Complete verification result with trust level, evaluation, and binary hash
 *
 * @throws {TrustError} If binary cannot be read or verification encounters fatal errors
 *
 * @remarks
 * This function combines:
 * 1. Binary hash computation ({@link computeBinaryHash})
 * 2. Trust level evaluation ({@link evaluateTrustLevel})
 * 3. Final trusted/untrusted determination
 *
 * The result includes:
 * - `level`: Trust level from {@link TrustLevel} enum
 * - `trusted`: Boolean flag (true only if VERIFIED)
 * - `evaluation`: Detailed evaluation with checks and recommendation
 * - `source`: Origin of metadata (native, vendor, community, etc.)
 * - `binaryHash`: SHA-256 hash of the binary (always computed)
 *
 * @example
 * ```typescript
 * const metadata = await probe('/usr/local/bin/gh');
 * if (metadata) {
 *   const result = await verifyTrust('/usr/local/bin/gh', metadata, {
 *     verifySignatures: true,
 *     verifyProvenance: true,
 *     minimumSlsaLevel: 3,
 *   });
 *
 *   if (result.trusted) {
 *     console.log('✓ Tool is fully verified');
 *   } else {
 *     console.warn(`⚠ Trust level: ${result.evaluation.reason}`);
 *     console.log(`  Recommendation: ${result.evaluation.recommendation}`);
 *   }
 * }
 * ```
 */
export async function verifyTrust(
  binaryPath: string,
  metadata: AtipMetadata,
  options?: TrustVerificationOptions
): Promise<TrustVerificationResult> {
  // Always compute binary hash
  const hashResult = await computeBinaryHash(binaryPath);

  // Get trust metadata (cast to full type for evaluation)
  const trust = metadata.trust as AtipTrustFull | undefined;

  // Evaluate trust level
  const evaluation = await evaluateTrustLevel(binaryPath, trust, options);

  // Determine if trusted
  const trusted = evaluation.level === TrustLevel.VERIFIED;

  return {
    level: evaluation.level,
    trusted,
    evaluation,
    source: trust?.source || 'community',
    binaryHash: hashResult.hash,
  };
}
