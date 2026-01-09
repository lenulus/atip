/**
 * Sigstore/Cosign signature verification
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { TrustSignature, SignatureVerificationResult } from './types';
import { TrustError } from './errors';

const execFileAsync = promisify(execFile);

/**
 * Check if cosign CLI is installed and available in PATH.
 *
 * @returns True if cosign is available in PATH, false otherwise
 *
 * @remarks
 * Attempts to locate cosign using `which` (Unix/macOS) or `where` (Windows).
 * This is a lightweight check that doesn't execute cosign itself.
 */
async function isCosignInstalled(): Promise<boolean> {
  try {
    await execFileAsync('which', ['cosign']);
    return true;
  } catch {
    try {
      await execFileAsync('where', ['cosign']);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Verify Cosign (Sigstore) signature for a file.
 *
 * @param targetPath - Path to the file to verify (binary or shim JSON)
 * @param signature - Signature block from trust metadata
 * @param options - Optional verification options
 * @returns Verification result with success status and details
 *
 * @remarks
 * - Requires `cosign` CLI to be installed and in PATH
 * - Supports two verification modes:
 *   1. Keyless (OIDC): Uses identity/issuer for keyless verification
 *   2. Key-based: Uses publicKey/signatureFile for traditional verification
 * - Verifies both identity (subject) and issuer in keyless mode
 * - Supports signature bundles for offline verification
 *
 * @throws {TrustError} If cosign is not installed or signature type is not supported
 */
export async function verifyCosignSignature(
  targetPath: string,
  signature: TrustSignature,
  options?: {
    /** Timeout for cosign invocation in ms (default: 30000) */
    timeoutMs?: number;
    /** Path to downloaded bundle file (overrides signature.bundle) */
    bundlePath?: string;
  }
): Promise<SignatureVerificationResult> {
  const timeoutMs = options?.timeoutMs || 30000;
  const bundlePath = options?.bundlePath || signature.bundle;

  // Only support cosign type
  if (signature.type !== 'cosign') {
    throw new TrustError(
      `Unsupported signature type: ${signature.type}. Only 'cosign' is currently supported.`,
      'UNSUPPORTED_SIGNATURE_TYPE'
    );
  }

  // Check if cosign is installed
  const cosignAvailable = await isCosignInstalled();
  if (!cosignAvailable) {
    throw new TrustError(
      'cosign CLI is not installed. Install it from https://docs.sigstore.dev/cosign/installation/',
      'COSIGN_NOT_INSTALLED'
    );
  }

  // Check if target file exists
  if (!existsSync(targetPath)) {
    throw new TrustError(
      `Target file not found: ${targetPath}`,
      'BINARY_NOT_FOUND'
    );
  }

  // Build cosign command based on verification mode
  const args = ['verify-blob'];

  if (signature.publicKey) {
    // Key-based verification mode
    if (!existsSync(signature.publicKey)) {
      throw new TrustError(
        `Public key file not found: ${signature.publicKey}`,
        'PUBLIC_KEY_NOT_FOUND'
      );
    }
    args.push('--key', signature.publicKey);

    // Support both new bundle format and old signature file format
    if (bundlePath) {
      if (!existsSync(bundlePath)) {
        throw new TrustError(
          `Bundle file not found: ${bundlePath}`,
          'BUNDLE_NOT_FOUND'
        );
      }
      args.push('--bundle', bundlePath);
    } else if (signature.signatureFile) {
      if (!existsSync(signature.signatureFile)) {
        throw new TrustError(
          `Signature file not found: ${signature.signatureFile}`,
          'SIGNATURE_FILE_NOT_FOUND'
        );
      }
      args.push('--signature', signature.signatureFile);
    } else {
      throw new TrustError(
        'Key-based verification requires either bundle or signatureFile',
        'INVALID_SIGNATURE_CONFIG'
      );
    }
  } else if (signature.identity && signature.issuer) {
    // Keyless verification mode (OIDC)
    args.push('--certificate-identity', signature.identity);
    args.push('--certificate-oidc-issuer', signature.issuer);

    if (bundlePath) {
      args.push('--bundle', bundlePath);
    }
  } else {
    throw new TrustError(
      'Invalid signature configuration: must provide either publicKey or (identity + issuer)',
      'INVALID_SIGNATURE_CONFIG'
    );
  }

  args.push(targetPath);

  // Execute cosign
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('cosign', args, {
      timeout: timeoutMs,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      resolve({
        verified: false,
        type: 'cosign',
        error: `Cosign verification timeout after ${timeoutMs}ms`,
        rawOutput: '',
      });
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({
          verified: false,
          type: 'cosign',
          error: `Failed to execute cosign: ${err.message}`,
        });
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        return;
      }

      const rawOutput = stdout + stderr;

      if (code === 0) {
        // Verification successful
        resolve({
          verified: true,
          type: 'cosign',
          identity: signature.identity || signature.publicKey,
          rawOutput,
        });
      } else {
        // Verification failed
        resolve({
          verified: false,
          type: 'cosign',
          error: stderr || stdout || `cosign exited with code ${code}`,
          rawOutput,
        });
      }
    });
  });
}
