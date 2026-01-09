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
 * Verify trust for a discovered tool.
 *
 * This is the main entry point for trust verification after discovery.
 * It performs all relevant checks based on available trust metadata.
 *
 * @param binaryPath - Path to the tool binary
 * @param metadata - ATIP metadata from discovery (may have trust field)
 * @param options - Verification options
 * @returns Complete verification result with trust level
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
