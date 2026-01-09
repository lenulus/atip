import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeBinaryHash } from '../../../src/trust/hash';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('computeBinaryHash', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should compute SHA-256 hash of a binary file', async () => {
    const filePath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(filePath, 'test content');

    const result = await computeBinaryHash(filePath);

    expect(result).toBeDefined();
    expect(result.algorithm).toBe('sha256');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.formatted).toBe(`sha256:${result.hash}`);
  });

  it('should return lowercase hex encoding', async () => {
    const filePath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(filePath, 'content');

    const result = await computeBinaryHash(filePath);

    expect(result.hash).toBe(result.hash.toLowerCase());
    expect(result.hash).not.toMatch(/[A-F]/);
  });

  it('should compute consistent hash for same content', async () => {
    const content = 'consistent content';
    const file1 = path.join(tmpDir, 'file1');
    const file2 = path.join(tmpDir, 'file2');
    await fs.writeFile(file1, content);
    await fs.writeFile(file2, content);

    const hash1 = await computeBinaryHash(file1);
    const hash2 = await computeBinaryHash(file2);

    expect(hash1.hash).toBe(hash2.hash);
    expect(hash1.formatted).toBe(hash2.formatted);
  });

  it('should compute different hashes for different content', async () => {
    const file1 = path.join(tmpDir, 'file1');
    const file2 = path.join(tmpDir, 'file2');
    await fs.writeFile(file1, 'content A');
    await fs.writeFile(file2, 'content B');

    const hash1 = await computeBinaryHash(file1);
    const hash2 = await computeBinaryHash(file2);

    expect(hash1.hash).not.toBe(hash2.hash);
  });

  it('should handle large files efficiently', async () => {
    const filePath = path.join(tmpDir, 'large-file');
    // Create a 1MB file
    const largeContent = Buffer.alloc(1024 * 1024, 'x');
    await fs.writeFile(filePath, largeContent);

    const result = await computeBinaryHash(filePath);

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle empty files', async () => {
    const filePath = path.join(tmpDir, 'empty-file');
    await fs.writeFile(filePath, '');

    const result = await computeBinaryHash(filePath);

    // SHA-256 of empty string
    expect(result.hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should throw TrustError if file cannot be read', async () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist');

    await expect(computeBinaryHash(nonExistentPath)).rejects.toThrow(/TrustError|ENOENT/i);
  });

  it('should throw TrustError if file is a directory', async () => {
    const dirPath = path.join(tmpDir, 'directory');
    await fs.mkdir(dirPath);

    await expect(computeBinaryHash(dirPath)).rejects.toThrow(/TrustError|directory/i);
  });

  it('should format hash suitable for content-addressable lookup', async () => {
    const filePath = path.join(tmpDir, 'test-binary');
    await fs.writeFile(filePath, 'test');

    const result = await computeBinaryHash(filePath);

    // Formatted should be usable in URLs like https://atip.dev/shims/sha256/{hash}.json
    expect(result.formatted).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.formatted.replace(':', '/')).toBe(`sha256/${result.hash}`);
  });

  it('should handle binary content correctly', async () => {
    const filePath = path.join(tmpDir, 'binary-content');
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    await fs.writeFile(filePath, binaryData);

    const result = await computeBinaryHash(filePath);

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.algorithm).toBe('sha256');
  });
});
