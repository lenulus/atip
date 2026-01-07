#!/usr/bin/env node

import { AtipValidator } from './validator.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

/**
 * ATIP Validate CLI
 * Command-line interface for validating ATIP metadata files
 */

const VERSION = '0.1.0';

/**
 * ATIP metadata for atip-validate itself.
 * This tool eats its own dogfood!
 */
const ATIP_METADATA = {
  atip: { version: '0.6', features: ['trust-v1'] },
  name: 'atip-validate',
  version: VERSION,
  description: 'Validate ATIP metadata files against JSON Schema',
  homepage: 'https://github.com/anthropics/atip',
  trust: {
    source: 'native',
    verified: true,
  },
  commands: {
    validate: {
      description: 'Validate ATIP metadata files (default command)',
      arguments: [
        { name: 'paths', type: 'string', required: true, variadic: true, description: 'Files or directories to validate' },
      ],
      options: [
        { name: 'recursive', flags: ['-r', '--recursive'], type: 'boolean', description: 'Recursively scan subdirectories' },
        { name: 'schema', flags: ['-s', '--schema'], type: 'file', description: 'Use custom schema file' },
        { name: 'quiet', flags: ['-q', '--quiet'], type: 'boolean', description: 'Only show errors (no success messages)' },
        { name: 'verbose', flags: ['-v', '--verbose'], type: 'boolean', description: 'Show detailed validation info' },
        { name: 'json', flags: ['--json'], type: 'boolean', description: 'Output results as JSON' },
      ],
      effects: {
        filesystem: { read: true, write: false },
        network: false,
        idempotent: true,
        destructive: false,
      },
    },
  },
  globalOptions: [
    { name: 'help', flags: ['-h', '--help'], type: 'boolean', description: 'Show help' },
  ],
};

// Handle --agent flag before anything else
if (process.argv.includes('--agent')) {
  console.log(JSON.stringify(ATIP_METADATA, null, 2));
  process.exit(0);
}

function printUsage() {
  console.log(`
${chalk.bold('atip-validate')} - Validate ATIP metadata files against JSON Schema

${chalk.bold('USAGE:')}
  atip-validate <file>              Validate a single file
  atip-validate <directory>         Validate all .json files in directory
  atip-validate -r <directory>      Recursively validate directory
  atip-validate --help              Show this help

${chalk.bold('OPTIONS:')}
  -r, --recursive                   Recursively scan subdirectories
  -s, --schema <path>               Use custom schema file
  -q, --quiet                       Only show errors (no success messages)
  -v, --verbose                     Show detailed validation info
  --json                            Output results as JSON
  --agent                           Output ATIP metadata (for agent discovery)

${chalk.bold('EXAMPLES:')}
  atip-validate examples/gh.json
  atip-validate examples/
  atip-validate -r shims/
  atip-validate --schema custom.json examples/gh.json

${chalk.bold('EXIT CODES:')}
  0    All files valid
  1    Validation errors found
  2    Invalid arguments or file not found
`);
}

function parseArgs(args) {
  const options = {
    recursive: false,
    schema: null,
    quiet: false,
    verbose: false,
    json: false,
    paths: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--recursive' || arg === '-r') {
      options.recursive = true;
    } else if (arg === '--schema' || arg === '-s') {
      options.schema = args[++i];
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (!arg.startsWith('-')) {
      options.paths.push(arg);
    } else {
      console.error(chalk.red(`Unknown option: ${arg}`));
      process.exit(2);
    }
  }

  return options;
}

function formatErrorOutput(result) {
  const output = [];

  output.push(chalk.red(`✗ ${result.file}`));

  for (const error of result.errors) {
    if (error.type === 'parse-error' || error.type === 'file-error') {
      output.push(`  ${chalk.yellow('Error:')} ${error.message}`);
    } else {
      output.push(`  ${chalk.yellow(error.path || '/')} ${error.message}`);
    }
  }

  return output.join('\n');
}

function formatSuccessOutput(result, verbose) {
  if (verbose) {
    return chalk.green(`✓ ${result.file}`) +
           chalk.dim(` (${result.data.name} v${result.data.version})`);
  }
  return chalk.green(`✓ ${result.file}`);
}

function formatSummary(results) {
  const total = results.length;
  const valid = results.filter(r => r.valid).length;
  const invalid = total - valid;

  const output = [];

  output.push('');
  output.push(chalk.bold('Summary:'));
  output.push(`  Total files:   ${total}`);
  output.push(`  ${chalk.green('Valid:')}        ${valid}`);

  if (invalid > 0) {
    output.push(`  ${chalk.red('Invalid:')}      ${invalid}`);
  }

  return output.join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (options.paths.length === 0) {
    console.error(chalk.red('Error: No files or directories specified'));
    process.exit(2);
  }

  // Initialize validator
  const validator = new AtipValidator(options.schema);

  // Collect all results
  const allResults = [];

  for (const inputPath of options.paths) {
    if (!fs.existsSync(inputPath)) {
      console.error(chalk.red(`Error: Path not found: ${inputPath}`));
      process.exit(2);
    }

    const stats = fs.statSync(inputPath);

    if (stats.isDirectory()) {
      const results = validator.validateDirectory(inputPath, options.recursive);
      allResults.push(...results);
    } else if (stats.isFile()) {
      const result = validator.validateFile(inputPath);
      allResults.push(result);
    }
  }

  // Output results
  if (options.json) {
    console.log(JSON.stringify(allResults, null, 2));
  } else {
    for (const result of allResults) {
      if (result.valid) {
        if (!options.quiet) {
          console.log(formatSuccessOutput(result, options.verbose));
        }
      } else {
        console.log(formatErrorOutput(result));
      }
    }

    if (!options.quiet) {
      console.log(formatSummary(allResults));
    }
  }

  // Exit with appropriate code
  const hasErrors = allResults.some(r => !r.valid);
  process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(2);
});
