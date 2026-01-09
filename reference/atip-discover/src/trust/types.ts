/**
 * Trust verification types per spec section 3.2.2
 */

import type { AtipMetadata } from '../types';

/**
 * Trust evaluation levels from spec section 3.2.2.
 *
 * Higher values indicate higher trust. Agents should use these
 * levels to make execution decisions.
 */
export enum TrustLevel {
  /** Hash mismatch detected - binary may have been tampered with */
  COMPROMISED = 0,
  /** No cryptographic signature found */
  UNSIGNED = 1,
  /** Signature exists but verification was skipped */
  UNVERIFIED = 2,
  /** SLSA provenance attestation failed verification */
  PROVENANCE_FAIL = 3,
  /** Full cryptographic verification passed */
  VERIFIED = 4,
}

/**
 * Cryptographic signature block for trust verification.
 * Supports Sigstore/Cosign (recommended), GPG, and Minisign.
 */
export interface TrustSignature {
  /** Signature algorithm/system: cosign (Sigstore), gpg, or minisign */
  type: 'cosign' | 'gpg' | 'minisign';
  /**
   * Expected signer identity (OIDC subject for cosign keyless verification).
   * For cosign: the workflow path, e.g.,
   * "https://github.com/cli/cli/.github/workflows/release.yml@refs/tags/v2.45.0"
   * Optional when using key-based verification (publicKey).
   */
  identity?: string;
  /**
   * OIDC issuer URL for cosign keyless signatures.
   * E.g., "https://token.actions.githubusercontent.com" for GitHub Actions
   * Optional when using key-based verification (publicKey).
   */
  issuer?: string;
  /** Optional URL to signature bundle file for keyless verification */
  bundle?: string;
  /**
   * Path to public key file for key-based verification.
   * When provided, uses cosign verify-blob --key instead of keyless OIDC verification.
   */
  publicKey?: string;
  /**
   * Path to detached signature file for key-based verification.
   * Required when publicKey is provided.
   */
  signatureFile?: string;
}

/**
 * Integrity verification block per spec section 3.2.2.
 * Contains checksum and optional signature for binary verification.
 */
export interface TrustIntegrity {
  /**
   * Content-addressable hash of the binary.
   * Format: "sha256:<64-hex-chars>"
   * This is the primary integrity mechanism - matching hash = correct binary.
   */
  checksum?: string;
  /** Cryptographic signature for the binary or shim */
  signature?: TrustSignature;
}

/**
 * SLSA provenance attestation block per spec section 3.2.2.
 * Links to build attestation proving binary provenance.
 */
export interface TrustProvenance {
  /** URL to attestation document (.intoto.jsonl or similar) */
  url: string;
  /** Attestation format: SLSA v1 or generic in-toto */
  format: 'slsa-provenance-v1' | 'in-toto';
  /** Claimed SLSA level (1-4). Higher = stronger guarantees. */
  slsaLevel: number;
  /** Optional trusted builder identity */
  builder?: string;
}

/**
 * Full trust metadata per spec section 3.2.2.
 * Extends the basic AtipTrust interface with integrity and provenance.
 */
export interface AtipTrustFull {
  /**
   * Origin of metadata.
   * - native: Tool implements --agent directly (HIGH trust)
   * - vendor: Official shim from tool vendor (HIGH trust)
   * - org: Organization-maintained shim (MEDIUM trust)
   * - community: Community-contributed shim (LOW trust)
   * - user: User-created local shim (LOW trust)
   * - inferred: Auto-generated from --help parsing (VERY LOW trust)
   */
  source: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred';
  /** Whether metadata has been verified against tool behavior */
  verified: boolean;
  /** Cryptographic integrity verification (checksums, signatures) */
  integrity?: TrustIntegrity;
  /** SLSA provenance attestation */
  provenance?: TrustProvenance;
}

/**
 * Result of binary hash computation.
 */
export interface HashResult {
  /** Algorithm used (always "sha256" currently) */
  algorithm: 'sha256';
  /** Hex-encoded hash value (64 characters) */
  hash: string;
  /** Formatted string: "sha256:<hash>" */
  formatted: string;
}

/**
 * Result of cryptographic signature verification.
 */
export interface SignatureVerificationResult {
  /** Whether signature verification succeeded */
  verified: boolean;
  /** Signature type that was checked */
  type: 'cosign' | 'gpg' | 'minisign';
  /** Verified signer identity (if successful) */
  identity?: string;
  /** Error message if verification failed */
  error?: string;
  /** Raw verification output (for debugging) */
  rawOutput?: string;
}

/**
 * Result of SLSA provenance attestation verification.
 */
export interface ProvenanceVerificationResult {
  /** Whether provenance verification succeeded */
  verified: boolean;
  /** Verified SLSA level (if successful) */
  slsaLevel?: number;
  /** Verified builder identity (if successful) */
  builder?: string;
  /** Error message if verification failed */
  error?: string;
  /** Attestation details for debugging */
  attestation?: {
    subject: string;
    predicateType: string;
    buildType?: string;
  };
}

/**
 * Comprehensive trust evaluation result.
 */
export interface TrustEvaluationResult {
  /** Final evaluated trust level */
  level: TrustLevel;
  /** Human-readable explanation of the trust level */
  reason: string;
  /** Detailed verification results for each check performed */
  checks: {
    /** Hash verification result */
    hash?: {
      checked: boolean;
      expected?: string;
      actual?: string;
      matches?: boolean;
    };
    /** Signature verification result */
    signature?: SignatureVerificationResult;
    /** Provenance verification result */
    provenance?: ProvenanceVerificationResult;
  };
  /** Recommended agent action based on trust level */
  recommendation: 'execute' | 'sandbox' | 'confirm' | 'block';
}

/**
 * Options for trust verification operations.
 */
export interface TrustVerificationOptions {
  /**
   * Whether to verify cryptographic signatures (default: true).
   * Set to false for offline operation or when cosign is not installed.
   */
  verifySignatures?: boolean;
  /**
   * Whether to verify SLSA provenance attestations (default: true).
   * Requires network access to fetch attestations.
   */
  verifyProvenance?: boolean;
  /**
   * Minimum acceptable SLSA level (default: 1).
   * Tools with lower levels will be treated as PROVENANCE_FAIL.
   */
  minimumSlsaLevel?: number;
  /**
   * Allowed signature identities (default: any).
   * If set, only signatures from these identities are accepted.
   */
  allowedSignerIdentities?: string[];
  /**
   * Allowed OIDC issuers (default: any).
   * If set, only signatures from these issuers are accepted.
   */
  allowedIssuers?: string[];
  /**
   * Allowed builders for SLSA attestations (default: any).
   * If set, only attestations from these builders are accepted.
   */
  allowedBuilders?: string[];
  /**
   * Timeout for network operations in ms (default: 30000).
   * Applies to signature bundle downloads and attestation fetches.
   */
  networkTimeoutMs?: number;
  /**
   * Skip verification but mark as UNVERIFIED instead of failing.
   * Useful for offline mode or development.
   */
  offlineMode?: boolean;
}

/**
 * Complete trust verification result combining all checks.
 */
export interface TrustVerificationResult {
  /** Final trust level after all verifications */
  level: TrustLevel;
  /** Whether the tool should be trusted for execution */
  trusted: boolean;
  /** Evaluation details */
  evaluation: TrustEvaluationResult;
  /** Source from trust metadata */
  source: AtipTrustFull['source'];
  /** Binary hash (always computed) */
  binaryHash: string;
}
