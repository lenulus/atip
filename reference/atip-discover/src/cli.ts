#!/usr/bin/env node

/**
 * CLI entry point for atip-discover
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { scan } from './discovery/scanner';
import { loadRegistry } from './registry';
import { getAtipPaths } from './xdg';
import type { AtipPaths } from './types';

const program = new Command();

program
  .name('atip-discover')
  .description('Discover ATIP-compatible tools on your system')
  .version('0.1.0');

// Global options
program
  .option('-o, --output <format>', 'Output format: json, table, quiet', 'json')
  .option('-c, --config <path>', 'Path to config file')
  .option('--data-dir <path>', 'Path to data directory')
  .option('-v, --verbose', 'Enable verbose logging');

// scan command
program
  .command('scan')
  .description('Scan for ATIP-compatible tools')
  .option('--safe-paths-only', 'Only scan known-safe PATH prefixes', true)
  .option('-a, --allow-path <path>', 'Additional directory to scan', collectValues, [])
  .option('-s, --skip <pattern>', 'Tools to skip during scan', collectValues, [])
  .option('-t, --timeout <duration>', 'Timeout for probing each tool', '2s')
  .option('-p, --parallel <n>', 'Number of parallel probes', '4')
  .option('-i, --incremental', 'Only scan new/changed executables', true)
  .option('-f, --full', 'Force full scan (ignore cache)')
  .option('--include-shims', 'Include shim files in discovery', true)
  .option('-n, --dry-run', 'Show what would be scanned without executing')
  .action(async (options, command) => {
    const globalOpts = command.parent?.opts() || {};
    const paths = getPaths(globalOpts);

    // Parse timeout
    const timeoutMs = parseDuration(options.timeout);
    const parallelism = parseInt(options.parallel, 10);

    // Prepare scan options
    // If --allow-path is explicitly provided, only scan those paths (disable safe paths)
    // Unless --safe-paths-only is also explicitly provided
    const hasExplicitAllowPath = options.allowPath && options.allowPath.length > 0;
    const scanOpts = {
      safePathsOnly: hasExplicitAllowPath ? false : (options.full ? false : options.safePathsOnly),
      allowPaths: options.allowPath,
      skipList: options.skip,
      timeoutMs,
      parallelism,
      incremental: !options.full,
      includeShims: options.includeShims,
    };

    if (options.dryRun) {
      // Show what would be scanned
      const output = {
        dryRun: true,
        would_scan: scanOpts.allowPaths || [],
        would_probe: 0, // Would need to enumerate to know exact count
        options: scanOpts,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Perform scan
    const result = await scan(scanOpts, paths);

    // Output results
    outputScanResult(result, globalOpts.output);
  });

// list command
program
  .command('list')
  .description('List known ATIP tools from the registry')
  .argument('[pattern]', 'Glob pattern to filter tool names')
  .option('--source <type>', 'Filter by source: all, native, shim', 'all')
  .option('--sort <field>', 'Sort by: name, discovered, path', 'name')
  .option('-l, --limit <n>', 'Maximum tools to list (0 = unlimited)', '0')
  .option('--show-path', 'Include executable path in output')
  .option('--stale', 'Only show tools that may need refresh')
  .action(async (pattern, options, command) => {
    const globalOpts = command.parent?.opts() || {};
    const paths = getPaths(globalOpts);

    const registry = await loadRegistry(paths);
    let tools = registry.tools;

    // Filter by pattern
    if (pattern) {
      const minimatch = (await import('minimatch')).minimatch;
      tools = tools.filter((t) => minimatch(t.name, pattern));
    }

    // Filter by source
    if (options.source !== 'all') {
      tools = tools.filter((t) => t.source === options.source);
    }

    // Sort
    if (options.sort === 'discovered') {
      tools.sort((a, b) => b.discoveredAt.getTime() - a.discoveredAt.getTime());
    } else if (options.sort === 'path') {
      tools.sort((a, b) => a.path.localeCompare(b.path));
    } else {
      tools.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Limit
    const limit = parseInt(options.limit, 10);
    if (limit > 0) {
      tools = tools.slice(0, limit);
    }

    // Output
    if (tools.length === 0) {
      if (globalOpts.output === 'json') {
        console.log(JSON.stringify({ count: 0, tools: [] }, null, 2));
      }
      process.exit(1);
    }

    outputListResult(tools, globalOpts.output, options.showPath);
  });

// get command
program
  .command('get <tool-name>')
  .description('Get full ATIP metadata for a specific tool')
  .option('-r, --refresh', 'Force refresh from tool before returning')
  .option('--cached', 'Use cached metadata if available', true)
  .option('--commands <commands>', 'Filter to specific command subtrees')
  .option('-d, --depth <n>', 'Limit command nesting depth (0 = unlimited)', '0')
  .option('--compact', 'Omit optional fields from output')
  .action(async (toolName, _options, command) => {
    const globalOpts = command.parent?.opts() || {};
    const paths = getPaths(globalOpts);

    const registry = await loadRegistry(paths);
    const tool = registry.tools.find((t) => t.name === toolName);

    if (!tool) {
      console.error(`Tool not found: ${toolName}`);
      process.exit(1);
    }

    // Load cached metadata
    const metadataPath = path.join(paths.toolsDir, `${toolName}.json`);
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      console.log(JSON.stringify(metadata, null, 2));
    } catch {
      console.error(`Metadata not found for tool: ${toolName}`);
      process.exit(2);
    }
  });

// cache commands
const cache = program.command('cache').description('Manage cached metadata');

cache
  .command('refresh')
  .description('Force refresh cached metadata')
  .argument('[tool-names...]', 'Specific tools to refresh')
  .option('--stale-only', 'Only refresh tools marked as stale')
  .option('-p, --parallel <n>', 'Number of parallel refreshes', '4')
  .option('-t, --timeout <duration>', 'Timeout for probing each tool', '2s')
  .action(async (_toolNames, _options, _command) => {
    // const globalOpts = command.parent?.parent?.opts() || {};
    // const paths = getPaths(globalOpts);

    const result = {
      refreshed: 0,
      failed: 0,
      unchanged: 0,
      durationMs: 0,
      tools: [],
      errors: [],
    };

    console.log(JSON.stringify(result, null, 2));
  });

cache
  .command('clear')
  .description('Clear cached metadata')
  .option('--all', 'Clear registry and all cached metadata')
  .option('--tools <names>', 'Clear only specific tools')
  .option('--older-than <duration>', 'Clear entries older than duration')
  .action(async (options, command) => {
    const globalOpts = command.parent?.parent?.opts() || {};
    const paths = getPaths(globalOpts);

    let cleared = 0;
    let freedBytes = 0;

    if (options.all) {
      // Clear everything
      try {
        const stats = await fs.stat(paths.registryPath);
        freedBytes += stats.size;
        await fs.rm(paths.registryPath);
        cleared++;
      } catch {
        // Ignore if doesn't exist
      }

      try {
        const toolsDir = await fs.readdir(paths.toolsDir);
        for (const file of toolsDir) {
          const stats = await fs.stat(path.join(paths.toolsDir, file));
          freedBytes += stats.size;
          await fs.rm(path.join(paths.toolsDir, file));
          cleared++;
        }
      } catch {
        // Ignore if doesn't exist
      }
    }

    console.log(JSON.stringify({ cleared, freed_bytes: freedBytes }, null, 2));
  });

cache
  .command('info')
  .description('Display cache information')
  .action(async (_options, command) => {
    const globalOpts = command.parent?.parent?.opts() || {};
    const paths = getPaths(globalOpts);

    const registry = await loadRegistry(paths);
    let cacheSize = 0;

    try {
      const toolsDir = await fs.readdir(paths.toolsDir);
      for (const file of toolsDir) {
        const stats = await fs.stat(path.join(paths.toolsDir, file));
        cacheSize += stats.size;
      }
    } catch {
      // Ignore if doesn't exist
    }

    const info = {
      path: paths.dataDir,
      registry_path: paths.registryPath,
      tools_dir: paths.toolsDir,
      shims_dir: paths.shimsDir,
      tool_count: registry.tools.filter((t) => t.source === 'native').length,
      shim_count: registry.tools.filter((t) => t.source === 'shim').length,
      last_scan: registry.lastScan,
      cache_size_bytes: cacheSize,
    };

    console.log(JSON.stringify(info, null, 2));
  });

// Helper functions

function collectValues(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function getPaths(opts: { dataDir?: string }): AtipPaths {
  if (opts.dataDir) {
    return getAtipPaths({ dataDir: opts.dataDir });
  }
  return getAtipPaths();
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|ms)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

function outputScanResult(result: unknown, format: string): void {
  const res = result as {
    discovered: number;
    updated: number;
    failed: number;
    skipped: number;
    durationMs: number;
    tools: unknown[];
    errors: unknown[];
  };

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (format === 'table') {
    console.log('SCAN RESULTS');
    console.log('============');
    console.log(`DISCOVERED: ${res.discovered}`);
    console.log(`UPDATED:    ${res.updated}`);
    console.log(`FAILED:     ${res.failed}`);
    console.log(`SKIPPED:    ${res.skipped}`);
    console.log(`DURATION:   ${res.durationMs}ms`);
  } else if (format === 'quiet') {
    console.log(`${res.discovered} discovered, ${res.updated} updated`);
  }
}

function outputListResult(
  tools: unknown[],
  format: string,
  _showPath: boolean
): void {
  if (format === 'json') {
    console.log(JSON.stringify({ count: tools.length, tools }, null, 2));
  } else if (format === 'table') {
    console.log('NAME       VERSION  SOURCE  DESCRIPTION');
    console.log('----------------------------------------');
    for (const tool of tools) {
      const t = tool as {
        name: string;
        version: string;
        source: string;
        path?: string;
      };
      const name = t.name.padEnd(10);
      const version = t.version.padEnd(8);
      const source = t.source.padEnd(7);
      console.log(`${name} ${version} ${source}`);
    }
  } else if (format === 'quiet') {
    for (const tool of tools) {
      const t = tool as { name: string };
      console.log(t.name);
    }
  }
}

// Parse and execute
program.parse();
