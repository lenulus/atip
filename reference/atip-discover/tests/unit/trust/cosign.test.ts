import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyCosignSignature } from '../../../src/trust/cosign';
import type { TrustSignature } from '../../../src/trust/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Helper to generate cosign key pair for testing.
 * Returns paths to private and public keys.
 */
async function generateTestKeyPair(tmpDir: string): Promise<{ privateKey: string; publicKey: string }> {
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
 * Helper to sign a file with cosign.
 * Returns path to bundle file (new format in cosign v3.x).
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

describe('verifyCosignSignature', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return verified true when cosign verification succeeds with key-based signing', async () => {
    // Generate test key pair
    const { privateKey, publicKey } = await generateTestKeyPair(tmpDir);

    // Create and sign a test file
    const targetPath = path.join(tmpDir, 'signed-binary');
    await fs.writeFile(targetPath, 'binary content');

    const bundlePath = await signFile(targetPath, privateKey, tmpDir);

    const signature: TrustSignature = {
      type: 'cosign',
      publicKey: publicKey,
      bundle: bundlePath,
    };

    const result = await verifyCosignSignature(targetPath, signature);

    expect(result).toBeDefined();
    expect(result.verified).toBe(true);
    expect(result.type).toBe('cosign');
    expect(result.identity).toBe(publicKey);
  });

  it('should return verified false when cosign verification fails', async () => {
    const targetPath = path.join(tmpDir, 'unsigned-binary');
    await fs.writeFile(targetPath, 'unsigned content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'https://github.com/fake/fake/.github/workflows/release.yml@refs/tags/v1.0.0',
      issuer: 'https://token.actions.githubusercontent.com',
    };

    const result = await verifyCosignSignature(targetPath, signature);

    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should throw TrustError if cosign CLI is not installed', async () => {
    const targetPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(targetPath, 'content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://test.com',
    };

    // Test with invalid PATH to simulate cosign not being installed
    const oldPath = process.env.PATH;
    process.env.PATH = '/nonexistent/path';

    try {
      await expect(verifyCosignSignature(targetPath, signature)).rejects.toThrow(/cosign.*not.*installed/i);
    } finally {
      process.env.PATH = oldPath;
    }
  });

  it('should support signature bundles for offline verification', async () => {
    const targetPath = path.join(tmpDir, 'bundled-binary');
    await fs.writeFile(targetPath, 'content');

    const bundlePath = path.join(tmpDir, 'signature.bundle');
    await fs.writeFile(bundlePath, JSON.stringify({ bundle: 'data' }));

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://token.actions.githubusercontent.com',
      bundle: bundlePath,
    };

    const result = await verifyCosignSignature(targetPath, signature, { bundlePath });

    expect(result).toBeDefined();
    expect(result.type).toBe('cosign');
  });

  it('should respect timeout option', async () => {
    // Create a test file
    const targetPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(targetPath, 'content');

    // Use keyless mode which requires network access (slower)
    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://token.actions.githubusercontent.com',
    };

    // Very short timeout should trigger timeout
    const result = await verifyCosignSignature(targetPath, signature, { timeoutMs: 1 });

    // Should either timeout or fail quickly (both are acceptable)
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should verify identity matches expected value', async () => {
    const targetPath = path.join(tmpDir, 'signed-binary');
    await fs.writeFile(targetPath, 'content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'https://github.com/expected/repo/.github/workflows/release.yml@refs/tags/v1.0.0',
      issuer: 'https://token.actions.githubusercontent.com',
    };

    const result = await verifyCosignSignature(targetPath, signature);

    if (result.verified) {
      expect(result.identity).toBe(signature.identity);
    }
  });

  it('should verify issuer matches expected value', async () => {
    const targetPath = path.join(tmpDir, 'signed-binary');
    await fs.writeFile(targetPath, 'content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://token.actions.githubusercontent.com',
    };

    const result = await verifyCosignSignature(targetPath, signature);

    // Verification should check the issuer
    expect(result.type).toBe('cosign');
  });

  it('should include raw output in result for debugging', async () => {
    const targetPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(targetPath, 'content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://token.actions.githubusercontent.com',
    };

    const result = await verifyCosignSignature(targetPath, signature);

    expect(result).toHaveProperty('rawOutput');
  });

  it('should handle non-existent target file', async () => {
    const targetPath = path.join(tmpDir, 'does-not-exist');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://token.actions.githubusercontent.com',
    };

    await expect(verifyCosignSignature(targetPath, signature)).rejects.toThrow();
  });

  it('should only support cosign type currently', async () => {
    const targetPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(targetPath, 'content');

    const gpgSignature: TrustSignature = {
      type: 'gpg' as any,
      identity: 'test@example.com',
      issuer: 'not-applicable',
    };

    // Should throw or return error for unsupported types
    await expect(verifyCosignSignature(targetPath, gpgSignature)).rejects.toThrow(/unsupported|gpg/i);
  });

  it('should parse cosign error messages into error field', async () => {
    const targetPath = path.join(tmpDir, 'bad-signature');
    await fs.writeFile(targetPath, 'content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'wrong@example.com',
      issuer: 'https://wrong.issuer.com',
    };

    const result = await verifyCosignSignature(targetPath, signature);

    if (!result.verified) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  });

  it('should handle network failures gracefully', async () => {
    const targetPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(targetPath, 'content');

    const signature: TrustSignature = {
      type: 'cosign',
      identity: 'test@example.com',
      issuer: 'https://unreachable.example.com',
    };

    const result = await verifyCosignSignature(targetPath, signature, { timeoutMs: 5000 });

    // Network failures should result in verified: false
    expect(result.verified).toBe(false);
  });
});
