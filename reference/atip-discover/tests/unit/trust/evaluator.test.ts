import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { evaluateTrustLevel, TrustLevel } from '../../../src/trust/evaluator';
import type { AtipTrustFull, TrustVerificationOptions } from '../../../src/trust/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execFileAsync = promisify(execFile);

/**
 * Helper to generate cosign key pair for testing.
 */
async function generateTestKeyPair(tmpDir: string): Promise<{ privateKey: string; publicKey: string }> {
  const prefix = path.join(tmpDir, 'test');
  await execFileAsync('cosign', ['generate-key-pair', `--output-key-prefix=${prefix}`], {
    env: { ...process.env, COSIGN_PASSWORD: '' },
  });
  return {
    privateKey: `${prefix}.key`,
    publicKey: `${prefix}.pub`,
  };
}

/**
 * Helper to sign a file with cosign.
 */
async function signFile(filePath: string, privateKey: string, tmpDir: string): Promise<string> {
  const bundlePath = path.join(tmpDir, 'test.bundle');
  await execFileAsync('cosign', [
    'sign-blob',
    '--key', privateKey,
    '--bundle', bundlePath,
    '--yes',
    filePath,
  ], {
    env: { ...process.env, COSIGN_PASSWORD: '' },
  });
  return bundlePath;
}

/**
 * Helper to compute SHA256 hash of content.
 */
function computeHash(content: string): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Helper to create a mock SLSA attestation for testing.
 */
function createMockSLSAAttestation(binaryHash: string, slsaLevel: number, builder?: string): any {
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

describe('evaluateTrustLevel', () => {
  let tmpDir: string;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });

    // Restore original fetch
    global.fetch = originalFetch;
  });

  it('should return COMPROMISED when hash mismatch is detected', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'actual content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    expect(result.level).toBe(TrustLevel.COMPROMISED);
    expect(result.reason).toMatch(/hash.*mismatch/i);
    expect(result.checks.hash?.matches).toBe(false);
  });

  it('should return UNSIGNED when no signature is provided', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      // No integrity.signature field
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: true,
    });

    expect(result.level).toBe(TrustLevel.UNSIGNED);
    expect(result.reason).toMatch(/no.*signature|unsigned/i);
  });

  it('should return UNSIGNED when signature verification fails', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        signature: {
          type: 'cosign',
          identity: 'invalid@example.com',
          issuer: 'https://wrong.issuer.com',
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: true,
    });

    expect(result.level).toBe(TrustLevel.UNSIGNED);
    expect(result.checks.signature?.verified).toBe(false);
  });

  it('should return UNVERIFIED when signature verification is skipped', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        signature: {
          type: 'cosign',
          identity: 'test@example.com',
          issuer: 'https://token.actions.githubusercontent.com',
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: false,
    });

    expect(result.level).toBe(TrustLevel.UNVERIFIED);
    expect(result.reason).toMatch(/verification.*skipped/i);
  });

  it('should return PROVENANCE_FAIL when SLSA attestation fails', async () => {
    // Generate test key pair for signature verification
    const { privateKey, publicKey } = await generateTestKeyPair(tmpDir);

    // Create and sign a test file
    const binaryPath = path.join(tmpDir, 'test-binary');
    const content = 'content';
    await fs.writeFile(binaryPath, content);

    // Sign the file
    const bundlePath = await signFile(binaryPath, privateKey, tmpDir);

    // Compute hash
    const checksum = computeHash(content);

    // Mock fetch to return a network error for the provenance URL
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: checksum,
        signature: {
          type: 'cosign',
          publicKey: publicKey,
          bundle: bundlePath,
        },
      },
      provenance: {
        url: 'https://invalid.example.com/attestation',
        format: 'slsa-provenance-v1',
        slsaLevel: 3,
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: true,
      verifyProvenance: true,
    });

    expect(result.level).toBe(TrustLevel.PROVENANCE_FAIL);
    expect(result.checks.provenance?.verified).toBe(false);
  });

  it('should return VERIFIED when all checks pass', async () => {
    // Generate test key pair
    const { privateKey, publicKey } = await generateTestKeyPair(tmpDir);

    // Create and sign a test file
    const binaryPath = path.join(tmpDir, 'test-binary');
    const content = 'verified content';
    await fs.writeFile(binaryPath, content);

    // Sign the file
    const bundlePath = await signFile(binaryPath, privateKey, tmpDir);

    // Compute hash
    const checksum = computeHash(content);

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: checksum,
        signature: {
          type: 'cosign',
          publicKey: publicKey,
          bundle: bundlePath,
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: true,
    });

    expect(result.level).toBe(TrustLevel.VERIFIED);
    expect(result.checks.hash?.matches).toBe(true);
    expect(result.checks.signature?.verified).toBe(true);
  });

  it('should include recommendation based on trust level', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'community',
      verified: false,
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    expect(result.recommendation).toMatch(/execute|sandbox|confirm|block/);
  });

  it('should recommend block for COMPROMISED', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    expect(result.level).toBe(TrustLevel.COMPROMISED);
    expect(result.recommendation).toBe('block');
  });

  it('should recommend confirm for UNSIGNED', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'community',
      verified: false,
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    expect(result.level).toBe(TrustLevel.UNSIGNED);
    expect(result.recommendation).toBe('confirm');
  });

  it('should recommend execute for VERIFIED', async () => {
    // Generate test key pair
    const { privateKey, publicKey } = await generateTestKeyPair(tmpDir);

    // Create and sign a test file
    const binaryPath = path.join(tmpDir, 'test-binary');
    const content = 'content';
    await fs.writeFile(binaryPath, content);

    // Sign the file
    const bundlePath = await signFile(binaryPath, privateKey, tmpDir);

    // Compute hash
    const checksum = computeHash(content);

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: checksum,
        signature: {
          type: 'cosign',
          publicKey: publicKey,
          bundle: bundlePath,
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: true,
    });

    expect(result.level).toBe(TrustLevel.VERIFIED);
    expect(result.recommendation).toBe('execute');
  });

  it('should handle offline mode gracefully', async () => {
    // In offline mode, when verifySignatures is false, signature is marked as unverified
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        signature: {
          type: 'cosign',
          identity: 'test@example.com',
          issuer: 'https://token.actions.githubusercontent.com',
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      offlineMode: true,
      verifySignatures: false,  // In offline mode, disable signature verification
    });

    // When signature verification is disabled, level is UNVERIFIED
    expect(result.level).toBe(TrustLevel.UNVERIFIED);
    expect(result.reason).toMatch(/verification.*skipped/i);
  });

  it('should respect allowedSignerIdentities option', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        signature: {
          type: 'cosign',
          identity: 'untrusted@example.com',
          issuer: 'https://token.actions.githubusercontent.com',
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust, {
      verifySignatures: true,
      allowedSignerIdentities: ['trusted@example.com'],
    });

    expect(result.level).toBe(TrustLevel.UNSIGNED);
  });

  it('should provide detailed check results for debugging', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: 'sha256:abc123',
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    expect(result.checks).toBeDefined();
    expect(result.checks.hash).toBeDefined();
    expect(result.checks.hash?.checked).toBe(true);
    expect(result.checks.hash?.expected).toBeDefined();
    expect(result.checks.hash?.actual).toBeDefined();
  });

  it('should handle trust metadata with no integrity or provenance', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'community',
      verified: false,
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    expect(result.level).toBe(TrustLevel.UNSIGNED);
  });

  it('should prioritize hash mismatch over other checks', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const trust: AtipTrustFull = {
      source: 'native',
      verified: true,
      integrity: {
        checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        signature: {
          type: 'cosign',
          identity: 'valid@example.com',
          issuer: 'https://token.actions.githubusercontent.com',
        },
      },
    };

    const result = await evaluateTrustLevel(binaryPath, trust);

    // Even with valid signature, hash mismatch should result in COMPROMISED
    expect(result.level).toBe(TrustLevel.COMPROMISED);
  });
});
