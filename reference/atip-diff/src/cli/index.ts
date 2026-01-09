#!/usr/bin/env node

/**
 * CLI entry point for atip-diff
 */

import { Command } from 'commander';
import { diffFiles } from '../differ/differ.js';
import type { CliOptions } from './utils.js';
import {
  buildDiffConfig,
  handleDiffOutput,
  handleCliError,
  logVerbose,
} from './utils.js';

const program = new Command();

program
  .name('atip-diff')
  .description('Compare ATIP metadata versions and categorize breaking changes')
  .version('0.1.0');

// Handle --agent flag globally before parsing arguments
if (process.argv.includes('--agent')) {
  const atipMetadata = {
        atip: { version: '0.6' },
        name: 'atip-diff',
        version: '0.1.0',
        description: 'Compare ATIP metadata versions and categorize breaking changes',
        homepage: 'https://github.com/atip-dev/atip',
        trust: {
          source: 'native',
          verified: true,
        },
        commands: {
          diff: {
            description: 'Compare two ATIP metadata files and report differences',
            arguments: [
              {
                name: 'old',
                type: 'file',
                description: 'Path to old/base ATIP JSON file',
                required: true,
              },
              {
                name: 'new',
                type: 'file',
                description: 'Path to new/updated ATIP JSON file',
                required: true,
              },
            ],
            options: [
              {
                name: 'output',
                flags: ['-o', '--output'],
                type: 'enum',
                enum: ['summary', 'json', 'markdown'],
                default: 'summary',
                description: 'Output format',
              },
              {
                name: 'breaking-only',
                flags: ['-b', '--breaking-only'],
                type: 'boolean',
                description: 'Only report breaking changes',
              },
              {
                name: 'effects-only',
                flags: ['-e', '--effects-only'],
                type: 'boolean',
                description: 'Only report effects changes',
              },
              {
                name: 'fail-on-breaking',
                flags: ['--fail-on-breaking'],
                type: 'boolean',
                description: 'Exit with code 1 if breaking changes detected',
              },
              {
                name: 'semver',
                flags: ['--semver'],
                type: 'boolean',
                description: 'Output recommended semantic version bump',
              },
            ],
            effects: {
              filesystem: { read: true, write: false },
              network: false,
              idempotent: true,
              destructive: false,
            },
          },
          stdin: {
            description: 'Compare ATIP metadata from stdin with a file',
            arguments: [
              {
                name: 'old',
                type: 'file',
                description: 'Path to old/base ATIP JSON file to compare against stdin',
                required: true,
              },
            ],
            options: [
              {
                name: 'output',
                flags: ['-o', '--output'],
                type: 'enum',
                enum: ['summary', 'json', 'markdown'],
                default: 'summary',
                description: 'Output format',
              },
            ],
            effects: {
              filesystem: { read: true, write: false },
              network: false,
              idempotent: true,
              destructive: false,
            },
            interactive: {
              stdin: 'required',
            },
          },
        },
        globalOptions: [
          {
            name: 'output',
            flags: ['-o', '--output'],
            type: 'enum',
            enum: ['summary', 'json', 'markdown'],
            description: 'Output format',
          },
          {
            name: 'quiet',
            flags: ['-q', '--quiet'],
            type: 'boolean',
            description: 'Only output on breaking changes',
          },
          {
            name: 'verbose',
            flags: ['-v', '--verbose'],
            type: 'boolean',
            description: 'Show detailed change information',
          },
        ],
      };
  console.log(JSON.stringify(atipMetadata, null, 2));
  process.exit(0);
}

// Default diff command
program
  .argument('<old>', 'Path to old/base ATIP JSON file')
  .argument('<new>', 'Path to new/updated ATIP JSON file')
  .option('-o, --output <format>', 'Output format: summary, json, markdown', 'summary')
  .option('-b, --breaking-only', 'Only report breaking changes')
  .option('-e, --effects-only', 'Only report effects changes')
  .option('--fail-on-breaking', 'Exit with code 1 if breaking changes detected')
  .option('--semver', 'Output recommended semantic version bump')
  .option('--ignore-version', 'Ignore version field changes')
  .option('--ignore-description', 'Ignore description-only changes')
  .option('-q, --quiet', 'Suppress output unless breaking changes found')
  .option('--no-color', 'Disable colored output')
  .option('-v, --verbose', 'Show detailed change information')
  .action(async (oldPath: string, newPath: string, options: CliOptions) => {
    try {
      logVerbose(`Loading old file: ${oldPath}`, options);
      logVerbose(`Loading new file: ${newPath}`, options);

      const config = buildDiffConfig(options);

      logVerbose('Comparing ATIP metadata...', options);

      const result = await diffFiles(oldPath, newPath, config);

      handleDiffOutput(result, options);
    } catch (error) {
      handleCliError(error);
    }
  });

// stdin command - read new metadata from stdin
program
  .command('stdin')
  .description('Compare ATIP metadata from stdin with a file')
  .argument('<old>', 'Path to old/base ATIP JSON file')
  .option('-o, --output <format>', 'Output format: summary, json, markdown', 'summary')
  .option('-b, --breaking-only', 'Only report breaking changes')
  .option('-e, --effects-only', 'Only report effects changes')
  .option('--fail-on-breaking', 'Exit with code 1 if breaking changes detected')
  .option('--semver', 'Output recommended semantic version bump')
  .option('--ignore-version', 'Ignore version field changes')
  .option('--ignore-description', 'Ignore description-only changes')
  .option('-q, --quiet', 'Suppress output unless breaking changes found')
  .option('--no-color', 'Disable colored output')
  .option('-v, --verbose', 'Show detailed change information')
  .action(async (oldPath: string, options: CliOptions) => {
    try {
      // Read from stdin
      const stdinChunks: Buffer[] = [];
      process.stdin.on('data', (chunk) => stdinChunks.push(chunk));

      await new Promise<void>((resolve, reject) => {
        process.stdin.on('end', () => resolve());
        process.stdin.on('error', reject);
      });

      const stdinContent = Buffer.concat(stdinChunks).toString('utf-8');
      const newMetadata = JSON.parse(stdinContent);

      logVerbose(`Loading old file: ${oldPath}`, options);
      logVerbose('Reading new metadata from stdin', options);

      // Import fs to read old file and write temp new file
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      // Write stdin content to temp file
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atip-diff-'));
      const newPath = path.join(tmpDir, 'new.json');
      await fs.writeFile(newPath, JSON.stringify(newMetadata, null, 2));

      const config = buildDiffConfig(options);

      logVerbose('Comparing ATIP metadata...', options);

      const result = await diffFiles(oldPath, newPath, config);

      // Clean up temp file
      await fs.rm(tmpDir, { recursive: true, force: true });

      handleDiffOutput(result, options);
    } catch (error) {
      handleCliError(error);
    }
  });

program.parse();
