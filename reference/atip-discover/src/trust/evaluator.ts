/**
 * Trust level evaluation logic
 */

import type {
  AtipTrustFull,
  TrustEvaluationResult,
  TrustVerificationOptions,
} from './types';
import { TrustLevel } from './types';
import { computeBinaryHash } from './hash';
import { verifyCosignSignature } from './cosign';
import { verifySLSAProvenance } from './slsa';

// Re-export TrustLevel for convenience
export { TrustLevel } from './types';

/**
 * Evaluate trust level for a tool based on its metadata and binary integrity.
 *
 * @param binaryPath - Absolute path to the tool binary
 * @param trust - Trust metadata from ATIP metadata (optional)
 * @param options - Evaluation options
 * @returns Complete trust evaluation with level, reason, checks, and recommendation
 *
 * @throws {TrustError} If binary cannot be read or hash computation fails
 * @throws {TrustError} If signature/provenance verification encounters fatal errors
 *
 * @remarks
 * Implements the trust verification flow from ATIP spec section 3.2.2:
 *
 * **Step 1: Binary Hash (Always)**
 * - Computes SHA-256 hash of binary for integrity verification
 * - Always performed regardless of trust metadata
 *
 * **Step 2: Integrity Check (If checksum provided)**
 * - Compares computed hash against expected checksum
 * - Returns {@link TrustLevel.COMPROMISED} immediately if mismatch detected
 * - This is the highest priority check (security critical)
 *
 * **Step 3: Signature Verification (If enabled and signature provided)**
 * - Verifies cryptographic signature using cosign/gpg/minisign
 * - Returns {@link TrustLevel.UNSIGNED} if verification fails
 * - Returns {@link TrustLevel.UNVERIFIED} if disabled or offline
 *
 * **Step 4: SLSA Provenance (If enabled and provenance provided)**
 * - Verifies SLSA build provenance attestation
 * - Returns {@link TrustLevel.PROVENANCE_FAIL} if verification fails
 * - Validates minimum SLSA level and builder identity
 *
 * **Step 5: Final Level**
 * - {@link TrustLevel.VERIFIED} if all enabled checks pass
 * - Includes recommendation: execute | sandbox | confirm | block
 *
 * @example
 * ```typescript
 * const evaluation = await evaluateTrustLevel('/usr/local/bin/gh', metadata.trust, {
 *   verifySignatures: true,
 *   verifyProvenance: true,
 *   minimumSlsaLevel: 3,
 * });
 *
 * if (evaluation.level === TrustLevel.VERIFIED) {
 *   console.log('Tool is fully verified and safe to execute');
 * } else {
 *   console.warn(`Trust level: ${evaluation.reason}`);
 *   console.log(`Recommendation: ${evaluation.recommendation}`);
 * }
 * ```
 */
export async function evaluateTrustLevel(
  binaryPath: string,
  trust: AtipTrustFull | undefined,
  options?: TrustVerificationOptions
): Promise<TrustEvaluationResult> {
  const opts = {
    verifySignatures: options?.verifySignatures ?? true,
    verifyProvenance: options?.verifyProvenance ?? true,
    minimumSlsaLevel: options?.minimumSlsaLevel ?? 1,
    offlineMode: options?.offlineMode ?? false,
    ...options,
  };

  const checks: TrustEvaluationResult['checks'] = {};

  // Step 1: Always compute binary hash
  const hashResult = await computeBinaryHash(binaryPath);

  // Step 2: Integrity check (if checksum provided)
  if (trust?.integrity?.checksum) {
    const expected = trust.integrity.checksum.replace('sha256:', '');
    const matches = expected.toLowerCase() === hashResult.hash.toLowerCase();

    checks.hash = {
      checked: true,
      expected,
      actual: hashResult.hash,
      matches,
    };

    if (!matches) {
      return {
        level: TrustLevel.COMPROMISED,
        reason: 'Binary hash mismatch: does not match expected checksum',
        checks,
        recommendation: 'block',
      };
    }
  }

  // Step 3: Signature verification (if enabled and signature provided)
  if (opts.verifySignatures && trust?.integrity?.signature) {
    try {
      if (trust.integrity.signature.type === 'cosign') {
        const sigResult = await verifyCosignSignature(
          binaryPath,
          trust.integrity.signature,
          { timeoutMs: opts.networkTimeoutMs }
        );

        checks.signature = sigResult;

        if (!sigResult.verified) {
          return {
            level: TrustLevel.UNSIGNED,
            reason: sigResult.error || 'Signature verification failed',
            checks,
            recommendation: 'confirm',
          };
        }
      } else {
        // GPG/minisign not yet supported
        return {
          level: TrustLevel.UNVERIFIED,
          reason: `Signature type '${trust.integrity.signature.type}' not yet supported`,
          checks,
          recommendation: 'sandbox',
        };
      }
    } catch (error) {
      if (opts.offlineMode) {
        // In offline mode, mark as unverified rather than failing
        checks.signature = {
          verified: false,
          type: trust.integrity.signature.type,
          error: `Offline mode: ${(error as Error).message}`,
        };
        return {
          level: TrustLevel.UNVERIFIED,
          reason: 'Signature verification skipped (offline mode)',
          checks,
          recommendation: 'sandbox',
        };
      }
      throw error;
    }
  } else if (!trust?.integrity?.signature && opts.verifySignatures) {
    // No signature available
    return {
      level: TrustLevel.UNSIGNED,
      reason: 'No cryptographic signature available',
      checks,
      recommendation: 'confirm',
    };
  } else if (!opts.verifySignatures && trust?.integrity?.signature) {
    // Signature verification disabled
    return {
      level: TrustLevel.UNVERIFIED,
      reason: 'Signature verification was skipped (disabled)',
      checks,
      recommendation: 'sandbox',
    };
  }

  // Step 4: SLSA provenance (if enabled and provenance provided)
  if (opts.verifyProvenance && trust?.provenance) {
    try {
      const provResult = await verifySLSAProvenance(binaryPath, trust.provenance, {
        timeoutMs: opts.networkTimeoutMs,
        minimumLevel: opts.minimumSlsaLevel,
        allowedBuilders: opts.allowedBuilders,
      });

      checks.provenance = provResult;

      if (!provResult.verified) {
        return {
          level: TrustLevel.PROVENANCE_FAIL,
          reason: provResult.error || 'SLSA provenance verification failed',
          checks,
          recommendation: 'confirm',
        };
      }
    } catch (error) {
      if (opts.offlineMode) {
        // In offline mode, mark as unverified rather than failing
        checks.provenance = {
          verified: false,
          error: `Offline mode: ${(error as Error).message}`,
        };
        return {
          level: TrustLevel.UNVERIFIED,
          reason: 'Provenance verification skipped (offline mode)',
          checks,
          recommendation: 'sandbox',
        };
      }
      throw error;
    }
  }

  // Step 5: All checks passed or nothing to verify
  if (!trust) {
    return {
      level: TrustLevel.UNSIGNED,
      reason: 'No trust metadata available',
      checks,
      recommendation: 'confirm',
    };
  }

  return {
    level: TrustLevel.VERIFIED,
    reason: 'Full cryptographic verification passed',
    checks,
    recommendation: 'execute',
  };
}
