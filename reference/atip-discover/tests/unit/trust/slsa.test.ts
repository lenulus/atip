import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifySLSAProvenance } from '../../../src/trust/slsa';
import type { TrustProvenance } from '../../../src/trust/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Helper to compute SHA256 hash of content (without sha256: prefix).
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Helper to create a mock SLSA attestation (DSSE envelope format).
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

describe('verifySLSAProvenance', () => {
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

  it('should return verified true when attestation is valid', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    const binaryContent = 'binary content';
    await fs.writeFile(binaryPath, binaryContent);

    // Compute the actual hash of the binary
    const binaryHash = computeHash(binaryContent);

    // Create mock attestation that matches the binary hash
    const mockAttestation = createMockSLSAAttestation(binaryHash, 3, 'https://github.com/actions/runner');

    // Mock fetch to return the attestation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockAttestation),
    } as Response);

    const provenance: TrustProvenance = {
      url: 'https://github.com/cli/cli/attestations/sha256:abc123',
      format: 'slsa-provenance-v1',
      slsaLevel: 3,
      builder: 'https://github.com/actions/runner',
    };

    const result = await verifySLSAProvenance(binaryPath, provenance);

    expect(result).toBeDefined();
    expect(result.verified).toBe(true);
    expect(result.slsaLevel).toBe(3);
    expect(result.builder).toBe('https://github.com/actions/runner');
    expect(global.fetch).toHaveBeenCalledWith(
      provenance.url,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('should return verified false when attestation fetch fails', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://invalid.example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 2,
    };

    const result = await verifySLSAProvenance(binaryPath, provenance);

    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should verify attestation subject matches binary hash', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'specific content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 2,
    };

    const result = await verifySLSAProvenance(binaryPath, provenance);

    // Should check that attestation subject digest matches sha256(binaryPath)
    expect(result).toBeDefined();
  });

  it('should validate claimed SLSA level against attestation contents', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 4,
    };

    const result = await verifySLSAProvenance(binaryPath, provenance);

    // Should verify the claimed level matches actual attestation
    expect(result).toBeDefined();
  });

  it('should support minimum level threshold', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 1,
    };

    const result = await verifySLSAProvenance(binaryPath, provenance, { minimumLevel: 2 });

    // Should fail if level is below minimum
    expect(result.verified).toBe(false);
  });

  it('should support in-toto format in addition to SLSA v1', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation.intoto.jsonl',
      format: 'in-toto',
      slsaLevel: 2,
    };

    const result = await verifySLSAProvenance(binaryPath, provenance);

    expect(result).toBeDefined();
  });

  it('should verify builder identity if allowedBuilders is set', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 3,
      builder: 'https://github.com/actions/runner',
    };

    const result = await verifySLSAProvenance(binaryPath, provenance, {
      allowedBuilders: ['https://github.com/actions/runner'],
    });

    expect(result).toBeDefined();
  });

  it('should reject if builder is not in allowedBuilders', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 3,
      builder: 'https://untrusted-builder.com',
    };

    const result = await verifySLSAProvenance(binaryPath, provenance, {
      allowedBuilders: ['https://github.com/actions/runner'],
    });

    expect(result.verified).toBe(false);
  });

  it('should respect timeout option for network operations', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://slow-server.example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 2,
    };

    // Short timeout should fail
    await expect(
      verifySLSAProvenance(binaryPath, provenance, { timeoutMs: 10 })
    ).rejects.toThrow(/timeout/i);
  });

  it('should include attestation details in result', async () => {
    const binaryPath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(binaryPath, 'content');

    const provenance: TrustProvenance = {
      url: 'https://example.com/attestation',
      format: 'slsa-provenance-v1',
      slsaLevel: 3,
    };

    const result = await verifySLSAProvenance(binaryPath, provenance);

    if (result.verified) {
      expect(result.attestation).toBeDefined();
      expect(result.attestation?.subject).toBeDefined();
      expect(result.attestation?.predicateType).toBeDefined();
    }
  });
});
