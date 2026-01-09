import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkHelpForAgent } from '../../../src/discovery/prober';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('checkHelpForAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return true when --agent flag appears in --help output', async () => {
    const toolPath = path.join(tmpDir, 'tool-with-agent');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Usage: tool [options]"
  echo "  --agent    Output ATIP metadata"
  echo "  --help     Show this message"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(true);
  });

  it('should return true when -agent short form appears in --help output', async () => {
    const toolPath = path.join(tmpDir, 'tool-with-short-agent');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Options:"
  echo "  -agent  Output agent metadata"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(true);
  });

  it('should return true when ATIP/agent keyword appears in --help', async () => {
    const toolPath = path.join(tmpDir, 'tool-mentions-atip');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "This tool supports ATIP agent introspection"
  echo "Run with --agent flag for metadata"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(true);
  });

  it('should return false when --help output has no agent reference', async () => {
    const toolPath = path.join(tmpDir, 'tool-no-agent');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Usage: tool [options]"
  echo "  --verbose    Verbose output"
  echo "  --help       Show this message"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(false);
  });

  it('should return false when --help command fails', async () => {
    const toolPath = path.join(tmpDir, 'tool-help-fails');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Error: help not available" >&2
  exit 1
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(false);
  });

  it('should return false when --help command times out', async () => {
    const toolPath = path.join(tmpDir, 'tool-help-slow');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  sleep 10
  echo "Help text"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath, { timeoutMs: 100 });
    expect(result).toBe(false);
  });

  it('should return false for non-executable files', async () => {
    const toolPath = path.join(tmpDir, 'not-executable');
    await fs.writeFile(toolPath, 'not a script', { mode: 0o644 });

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(false);
  });

  it('should handle stderr output from --help', async () => {
    const toolPath = path.join(tmpDir, 'tool-stderr-help');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Usage info" >&2
  echo "  --agent  ATIP metadata" >&2
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(true);
  });

  it('should respect custom timeout option', async () => {
    const toolPath = path.join(tmpDir, 'tool-slow-help');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  sleep 0.15
  echo "  --agent  Agent flag"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    // Give generous timeout to account for system load during full test suite
    const result = await checkHelpForAgent(toolPath, { timeoutMs: 2000 });
    expect(result).toBe(true);
  });

  it('should handle case variations in help text', async () => {
    const toolPath = path.join(tmpDir, 'tool-case-variation');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Options:"
  echo "  --AGENT    Output metadata (uppercase)"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    // Should detect --agent regardless of case
    const result = await checkHelpForAgent(toolPath);
    expect(result).toBe(true);
  });
});
