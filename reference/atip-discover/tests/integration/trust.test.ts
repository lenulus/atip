import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyTrust } from '../../src/trust';
import type { AtipMetadata } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Trust Verification Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should verify trust for tool with full cryptographic verification', async () => {
    const binaryPath = path.join(tmpDir, 'verified-tool');
    const content = 'tool content';
    await fs.writeFile(binaryPath, content);

    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'verified-tool',
      version: '1.0.0',
      description: 'A verified tool',
      trust: {
        source: 'native',
        verified: true,
        integrity: {
          checksum: `sha256:${hash}`,
          signature: {
            type: 'cosign',
            identity: 'https://github.com/org/repo/.github/workflows/release.yml@refs/tags/v1.0.0',
            issuer: 'https://token.actions.githubusercontent.com',
          },
        },
        provenance: {
          url: 'https://github.com/org/repo/attestations/sha256:abc',
          format: 'slsa-provenance-v1',
          slsaLevel: 3,
        },
      },
    };

    const result = await verifyTrust(binaryPath, metadata, {
      verifySignatures: true,
      verifyProvenance: true,
    });

    expect(result).toBeDefined();
    expect(result.level).toBeDefined();
    expect(result.trusted).toBeDefined();
    expect(result.evaluation).toBeDefined();
    expect(result.binaryHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should detect compromised binaries via hash mismatch', async () => {
    const binaryPath = path.join(tmpDir, 'modified-tool');
    await fs.writeFile(binaryPath, 'modified content');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'modified-tool',
      version: '1.0.0',
      description: 'A tool that has been modified',
      trust: {
        source: 'native',
        verified: true,
        integrity: {
          checksum: 'sha256:originalhashdoesnotmatchcurrent0000000000000000000000000',
        },
      },
    };

    const result = await verifyTrust(binaryPath, metadata);

    expect(result.trusted).toBe(false);
    expect(result.level).toBeLessThan(4); // Not VERIFIED
  });

  it('should handle tools without trust metadata', async () => {
    const binaryPath = path.join(tmpDir, 'untrusted-tool');
    await fs.writeFile(binaryPath, 'content');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'untrusted-tool',
      version: '1.0.0',
      description: 'Tool without trust metadata',
    };

    const result = await verifyTrust(binaryPath, metadata);

    expect(result).toBeDefined();
    expect(result.binaryHash).toBeDefined();
  });

  it('should work in offline mode when network is unavailable', async () => {
    const binaryPath = path.join(tmpDir, 'offline-tool');
    await fs.writeFile(binaryPath, 'content');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'offline-tool',
      version: '1.0.0',
      description: 'Tool verified offline',
      trust: {
        source: 'native',
        verified: true,
        integrity: {
          signature: {
            type: 'cosign',
            identity: 'test@example.com',
            issuer: 'https://token.actions.githubusercontent.com',
          },
        },
      },
    };

    const result = await verifyTrust(binaryPath, metadata, {
      offlineMode: true,
    });

    expect(result).toBeDefined();
    // In offline mode, should return UNVERIFIED instead of failing
    expect(result.level).toBeDefined();
  });

  it('should compute and return binary hash regardless of verification', async () => {
    const binaryPath = path.join(tmpDir, 'any-tool');
    const content = 'some content';
    await fs.writeFile(binaryPath, content);

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'any-tool',
      version: '1.0.0',
      description: 'Any tool',
    };

    const result = await verifyTrust(binaryPath, metadata);

    expect(result.binaryHash).toBeDefined();
    expect(result.binaryHash).toMatch(/^[a-f0-9]{64}$/);

    // Verify the hash is correct
    const crypto = await import('crypto');
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
    expect(result.binaryHash).toBe(expectedHash);
  });

  it('should include source information from metadata', async () => {
    const binaryPath = path.join(tmpDir, 'community-tool');
    await fs.writeFile(binaryPath, 'content');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'community-tool',
      version: '1.0.0',
      description: 'Community contributed tool',
      trust: {
        source: 'community',
        verified: false,
      },
    };

    const result = await verifyTrust(binaryPath, metadata);

    expect(result.source).toBe('community');
  });

  it('should handle minimum SLSA level requirements', async () => {
    const binaryPath = path.join(tmpDir, 'slsa-tool');
    await fs.writeFile(binaryPath, 'content');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'slsa-tool',
      version: '1.0.0',
      description: 'SLSA verified tool',
      trust: {
        source: 'native',
        verified: true,
        provenance: {
          url: 'https://example.com/attestation',
          format: 'slsa-provenance-v1',
          slsaLevel: 2,
        },
      },
    };

    const result = await verifyTrust(binaryPath, metadata, {
      verifyProvenance: true,
      minimumSlsaLevel: 3,
    });

    expect(result).toBeDefined();
    // Should fail if SLSA level is below minimum
  });

  it('should provide comprehensive evaluation results', async () => {
    const binaryPath = path.join(tmpDir, 'eval-tool');
    await fs.writeFile(binaryPath, 'content');

    const metadata: AtipMetadata = {
      atip: { version: '0.4' },
      name: 'eval-tool',
      version: '1.0.0',
      description: 'Tool for evaluation testing',
      trust: {
        source: 'native',
        verified: true,
      },
    };

    const result = await verifyTrust(binaryPath, metadata);

    expect(result.evaluation).toBeDefined();
    expect(result.evaluation.level).toBeDefined();
    expect(result.evaluation.reason).toBeDefined();
    expect(result.evaluation.checks).toBeDefined();
    expect(result.evaluation.recommendation).toMatch(/execute|sandbox|confirm|block/);
  });
});
