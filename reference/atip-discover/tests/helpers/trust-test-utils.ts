/**
 * Shared test utilities for trust verification tests.
 * These helpers reduce duplication across test files.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Generate a cosign key pair for testing.
 *
 * @param tmpDir - Temporary directory to store keys
 * @returns Paths to private and public keys
 */
export async function generateTestKeyPair(tmpDir: string): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const prefix = path.join(tmpDir, 'test');

  // Generate key pair with no password (for tests)
  await execFileAsync('cosign', ['generate-key-pair', `--output-key-prefix=${prefix}`], {
    env: { ...process.env, COSIGN_PASSWORD: '' },
  });

  return {
    privateKey: `${prefix}.key`,
    publicKey: `${prefix}.pub`,
  };
}

/**
 * Sign a file with cosign for testing.
 *
 * @param filePath - Path to file to sign
 * @param privateKey - Path to private key
 * @param tmpDir - Temporary directory for bundle output
 * @returns Path to signature bundle file
 */
export async function signFile(
  filePath: string,
  privateKey: string,
  tmpDir: string
): Promise<string> {
  const bundlePath = path.join(tmpDir, 'test.bundle');

  await execFileAsync(
    'cosign',
    ['sign-blob', '--key', privateKey, '--bundle', bundlePath, '--yes', filePath],
    {
      env: { ...process.env, COSIGN_PASSWORD: '' },
    }
  );

  return bundlePath;
}

/**
 * Compute SHA-256 hash of content with optional formatting.
 *
 * @param content - Content to hash
 * @param withPrefix - Whether to include "sha256:" prefix (default: false)
 * @returns Hash string
 */
export function computeHash(content: string, withPrefix: boolean = false): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return withPrefix ? `sha256:${hash}` : hash;
}

/**
 * Create a mock SLSA provenance attestation for testing.
 *
 * @param binaryHash - SHA-256 hash of the binary (without sha256: prefix)
 * @param slsaLevel - SLSA level (1-4)
 * @param builder - Optional builder identity
 * @returns Mock attestation in DSSE envelope format
 */
export function createMockSLSAAttestation(
  binaryHash: string,
  slsaLevel: number,
  builder?: string
): any {
  const statement = {
    _type: 'https://in-toto.io/Statement/v0.1',
    subject: [
      {
        name: 'binary',
        digest: {
          sha256: binaryHash,
        },
      },
    ],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://slsa.dev/slsaBuildType/v1',
      },
      runDetails: {
        builder: {
          id: builder || 'https://github.com/actions/runner',
        },
      },
      slsaLevel,
    },
  };

  const payloadBase64 = Buffer.from(JSON.stringify(statement)).toString('base64');

  return {
    payloadType: 'application/vnd.in-toto+json',
    payload: payloadBase64,
    signatures: [
      {
        sig: 'mock-signature',
      },
    ],
  };
}
