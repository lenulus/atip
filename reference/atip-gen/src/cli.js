#!/usr/bin/env node

import { HelpParser } from './parser.js';
import chalk from 'chalk';
import fs from 'fs';

/**
 * ATIP Generator CLI
 * Generate ATIP metadata from --help output
 */

const VERSION = '0.1.0';

/**
 * ATIP metadata for atip-gen itself.
 * This tool eats its own dogfood!
 */
const ATIP_METADATA = {
  atip: { version: '0.6', features: ['trust-v1'] },
  name: 'atip-gen',
  version: VERSION,
  description: 'Generate ATIP metadata from --help output',
  homepage: 'https://github.com/anthropics/atip',
  trust: {
    source: 'native',
    verified: true,
  },
  commands: {
    generate: {
      description: 'Generate ATIP metadata for a tool (default command)',
      arguments: [
        { name: 'tool', type: 'string', required: true, description: 'Name of the tool to generate metadata for' },
      ],
      options: [
        { name: 'output', flags: ['-o', '--output'], type: 'file', description: 'Output file path' },
        { name: 'depth', flags: ['-d', '--depth'], type: 'integer', default: 1, description: 'Parse subcommands to depth N' },
        { name: 'no-effects', flags: ['--no-effects'], type: 'boolean', description: 'Skip effects inference' },
        { name: 'format', flags: ['--format'], type: 'enum', enum: ['json', 'yaml'], default: 'json', description: 'Output format' },
      ],
      effects: {
        filesystem: { read: true, write: true },
        subprocess: true,
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
${chalk.bold('atip-gen')} - Generate ATIP metadata from --help output

${chalk.bold('USAGE:')}
  atip-gen <tool>                   Generate metadata for tool
  atip-gen <tool> -o <file>         Save to file
  atip-gen <tool> --depth <n>       Recursively parse subcommands (depth limit)
  atip-gen --help                   Show this help

${chalk.bold('OPTIONS:')}
  -o, --output <file>               Output file path
  -d, --depth <n>                   Parse subcommands to depth N (default: 1)
  --no-effects                      Skip effects inference
  --format <json|yaml>              Output format (default: json)
  --agent                           Output ATIP metadata (for agent discovery)

${chalk.bold('EXAMPLES:')}
  atip-gen gh -o examples/gh.json
  atip-gen kubectl --depth 2
  atip-gen curl

${chalk.bold('NOTE:')}
  This tool generates ATIP metadata by parsing --help output.
  Results are best-effort and should be reviewed/refined manually.

  Generated metadata will have:
    - trust.source: "inferred"
    - trust.verified: false

  Recommendations:
    1. Review all effects metadata carefully
    2. Add missing options/arguments
    3. Test with atip-validate
    4. Update trust.verified: true after manual review

${chalk.bold('EXIT CODES:')}
  0    Success
  1    Generation failed
  2    Invalid arguments
`);
}

function parseArgs(args) {
  const options = {
    tool: null,
    output: null,
    depth: 1,
    effects: true,
    format: 'json'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--depth' || arg === '-d') {
      options.depth = parseInt(args[++i], 10);
    } else if (arg === '--no-effects') {
      options.effects = false;
    } else if (arg === '--format') {
      options.format = args[++i];
    } else if (!arg.startsWith('-')) {
      options.tool = arg;
    } else {
      console.error(chalk.red(`Unknown option: ${arg}`));
      process.exit(2);
    }
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.tool) {
    console.error(chalk.red('Error: No tool specified'));
    process.exit(2);
  }

  console.log(chalk.blue(`Generating ATIP metadata for: ${options.tool}`));
  console.log(chalk.dim(`Parsing --help output... (depth: ${options.depth})`));

  try {
    const parser = new HelpParser(options.tool);
    const metadata = await parser.parse();

    // Parse subcommands if depth > 1
    if (options.depth > 1) {
      console.log(chalk.dim(`Recursively parsing subcommands...`));
      await parseSubcommandsRecursive(parser, metadata.commands, '', options.depth - 1);
    }

    // Remove effects if requested
    if (!options.effects) {
      removeEffects(metadata);
    }

    // Format output
    const output = options.format === 'json'
      ? JSON.stringify(metadata, null, 2)
      : metadata; // YAML support could be added

    // Write or print
    if (options.output) {
      fs.writeFileSync(options.output, output + '\n');
      console.log(chalk.green(`✓ Metadata written to: ${options.output}`));
      console.log(chalk.yellow(`\n⚠ Remember to:`));
      console.log(chalk.yellow(`  1. Review effects metadata carefully`));
      console.log(chalk.yellow(`  2. Validate: atip-validate ${options.output}`));
      console.log(chalk.yellow(`  3. Mark trust.verified: true after review`));
    } else {
      console.log('\n' + output);
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function parseSubcommandsRecursive(parser, commands, parentPath, depth) {
  if (depth <= 0) return;

  for (const [name, cmd] of Object.entries(commands)) {
    const fullPath = parentPath ? `${parentPath} ${name}` : name;

    try {
      const detailed = await parser.parseSubcommand(parentPath, name);

      // Merge with existing
      Object.assign(cmd, detailed);

      // Recurse
      if (detailed.commands && depth > 1) {
        await parseSubcommandsRecursive(parser, detailed.commands, fullPath, depth - 1);
      }

      process.stdout.write(chalk.dim('.'));
    } catch (error) {
      // Skip on error
      process.stdout.write(chalk.red('x'));
    }
  }
}

function removeEffects(obj) {
  if (typeof obj !== 'object' || obj === null) return;

  delete obj.effects;

  for (const key of Object.keys(obj)) {
    removeEffects(obj[key]);
  }
}

main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(2);
});
