import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probe } from '../../src/discovery/prober';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Two-Phase Safe Probing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `atip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should skip --agent execution if --help does not show --agent support', async () => {
    const toolPath = path.join(tmpDir, 'legacy-tool');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Usage: tool [options]"
  echo "  --verbose  Be verbose"
  exit 0
elif [ "$1" = "--agent" ]; then
  # This should never execute due to Phase 1 check
  echo "SHOULD_NOT_EXECUTE"
  exit 1
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath);

    // Should return null without executing --agent
    expect(result).toBeNull();
  });

  it('should execute --agent only after confirming --help shows support', async () => {
    const metadata = {
      atip: { version: '0.4' },
      name: 'safe-tool',
      version: '1.0.0',
      description: 'A safe ATIP tool',
      commands: {
        run: {
          description: 'Run command',
          effects: { network: false },
        },
      },
    };

    const toolPath = path.join(tmpDir, 'safe-tool');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Usage: tool [options]"
  echo "  --agent  Output ATIP metadata"
  exit 0
elif [ "$1" = "--agent" ]; then
  echo '${JSON.stringify(metadata)}'
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath);

    // Should successfully execute Phase 2 and return metadata
    expect(result).not.toBeNull();
    expect(result?.name).toBe('safe-tool');
  });

  it('should return null for tools without --agent in help', async () => {
    const toolPath = path.join(tmpDir, 'no-agent-tool');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Standard CLI tool"
  echo "No special agent support"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath);
    expect(result).toBeNull();
  });

  it('should properly chain Phase 1 to Phase 2 on success', async () => {
    const metadata = {
      atip: { version: '0.4' },
      name: 'chained-tool',
      version: '2.0.0',
      description: 'Tool with proper chaining',
    };

    const toolPath = path.join(tmpDir, 'chained-tool');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Supports --agent flag for ATIP introspection"
  exit 0
elif [ "$1" = "--agent" ]; then
  echo '${JSON.stringify(metadata)}'
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('chained-tool');
    expect(result?.version).toBe('2.0.0');
  });

  it('should handle Phase 1 timeout without proceeding to Phase 2', async () => {
    const toolPath = path.join(tmpDir, 'timeout-phase1');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  sleep 10
  echo "Help with --agent"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath, { timeoutMs: 100 });

    // Phase 1 timeout should prevent Phase 2 execution
    expect(result).toBeNull();
  });

  it('should handle Phase 2 failure gracefully after Phase 1 success', async () => {
    const toolPath = path.join(tmpDir, 'phase2-fail');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Supports --agent flag"
  exit 0
elif [ "$1" = "--agent" ]; then
  echo "Error occurred" >&2
  exit 1
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath);

    // Phase 2 failure after Phase 1 success should return null
    expect(result).toBeNull();
  });

  it('should handle tools that output invalid JSON in Phase 2', async () => {
    const toolPath = path.join(tmpDir, 'invalid-json-phase2');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Tool with --agent support"
  exit 0
elif [ "$1" = "--agent" ]; then
  echo "{ invalid json }"
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    await expect(probe(toolPath)).rejects.toThrow(/invalid.*json|parse/i);
  });

  it('should handle stderr in both phases separately', async () => {
    const metadata = {
      atip: { version: '0.4' },
      name: 'stderr-tool',
      version: '1.0.0',
      description: 'Tool with stderr output',
    };

    const toolPath = path.join(tmpDir, 'stderr-both-phases');
    await fs.writeFile(
      toolPath,
      `#!/bin/bash
if [ "$1" = "--help" ]; then
  echo "Warning: beta" >&2
  echo "Options: --agent for metadata"
  exit 0
elif [ "$1" = "--agent" ]; then
  echo "Debug info" >&2
  echo '${JSON.stringify(metadata)}'
  exit 0
fi
exit 1
`,
      { mode: 0o755 }
    );

    const result = await probe(toolPath);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('stderr-tool');
  });
});
