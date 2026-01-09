/**
 * Trust verification error types
 */

import { DiscoverError } from '../errors';

/**
 * Trust-specific error codes.
 */
export type TrustErrorCode =
  | 'HASH_COMPUTATION_FAILED' // Could not compute binary hash
  | 'COSIGN_NOT_INSTALLED' // cosign CLI not found
  | 'VERIFICATION_TIMEOUT' // Verification operation timed out
  | 'ATTESTATION_FETCH_FAILED' // Could not fetch SLSA attestation
  | 'ATTESTATION_PARSE_FAILED' // Invalid attestation format
  | 'SIGNATURE_INVALID' // Signature verification failed
  | 'BINARY_NOT_FOUND' // Binary file does not exist
  | 'PERMISSION_DENIED'; // Cannot read binary file

/**
 * Error during trust verification operations.
 */
export class TrustError extends DiscoverError {
  constructor(
    message: string,
    public readonly trustCode: TrustErrorCode,
    public readonly cause?: Error
  ) {
    super(message, `TRUST_${trustCode}`);
    this.name = 'TrustError';
  }
}
