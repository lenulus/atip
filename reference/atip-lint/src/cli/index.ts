#!/usr/bin/env node

import { Command } from 'commander';
import { createLinter } from '../linter/index.js';
import { loadConfig, presets } from '../config/index.js';
import { formatters } from '../output/index.js';
import { promises as fs } from 'fs';
import { builtinRules } from '../rules/index.js';
import { glob } from 'glob';

const program = new Command();

// Handle --agent flag early (before subcommands)
if (process.argv.includes('--agent')) {
  const metadata = {
    atip: { version: '0.4' },
    name: 'atip-lint',
    version: '0.1.0',
    description: 'Lint ATIP metadata for quality issues beyond schema validation',
    homepage: 'https://github.com/atip-dev/atip',
    trust: {
      source: 'native',
      verified: true,
    },
    commands: {
      lint: {
        description: 'Lint ATIP metadata files for quality issues',
        effects: {
          filesystem: { read: true, write: false },
          network: false,
          idempotent: true,
        },
      },
      init: {
        description: 'Initialize a lint configuration file',
        effects: {
          filesystem: { read: false, write: true },
          network: false,
          idempotent: false,
        },
      },
      'list-rules': {
        description: 'List available lint rules',
        effects: {
          network: false,
          idempotent: true,
        },
      },
    },
  };
  console.log(JSON.stringify(metadata, null, 2));
  process.exit(0);
}

program
  .name('atip-lint')
  .description('Lint ATIP metadata for quality issues beyond schema validation')
  .version('0.1.0');

// Default lint command
program
  .command('lint', { isDefault: true })
  .description('Lint ATIP metadata files for quality issues')
  .argument('<files...>', 'Files or glob patterns to lint')
  .option('-c, --config <path>', 'Path to config file')
  .option('-o, --output <format>', 'Output format: stylish, json, sarif, compact', 'stylish')
  .option('--fix', 'Automatically fix issues when possible')
  .option('--fix-dry-run', 'Show fixes without applying')
  .option('-q, --quiet', 'Only show errors, suppress warnings')
  .option('--no-color', 'Disable colored output')
  .option('--rule <rule>', 'Enable rule (e.g., no-empty-effects:error)')
  .option('--disable-rule <rule>', 'Disable rule by name')
  .option('--max-warnings <count>', 'Maximum warnings before exit 1', '-1')
  .action(async (patterns: string[], options: any) => {
    try {
      // Expand glob patterns
      const expandedFiles: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(pattern);
        expandedFiles.push(...matches);
      }

      if (expandedFiles.length === 0) {
        console.error('No files matched the pattern(s)');
        process.exit(2);
      }

      // Load base config (use recommended preset as default)
      let config: any = options.config
        ? await loadConfig(process.cwd(), options.config)
        : presets.recommended;

      // Apply CLI rule overrides
      if (options.rule) {
        const [ruleId, severity] = options.rule.split(':');
        config = {
          ...config,
          rules: {
            ...config.rules,
            [ruleId]: severity || 'error',
          },
        };
      }

      if (options.disableRule) {
        config = {
          ...config,
          rules: {
            ...config.rules,
            [options.disableRule]: 'off',
          },
        };
      }

      const linter = createLinter(config);
      const results = await linter.lintFiles(expandedFiles, {
        fix: options.fix || options.fixDryRun,
        quiet: options.quiet,
      });

      const formatter = formatters[options.output as keyof typeof formatters] || formatters.stylish;
      const output = formatter(results, {
        cwd: process.cwd(),
        color: options.color !== false,
        config,
      });

      console.log(output);

      // Show fix summary for dry-run
      if (options.fixDryRun) {
        const fixableCount = results.fixableErrorCount + results.fixableWarningCount;
        if (fixableCount > 0) {
          console.log(`\nWould fix ${fixableCount} issue(s)`);
        }
      }

      // Write fixed files
      if (options.fix && !options.fixDryRun) {
        let fixCount = 0;
        for (const result of results.results) {
          if (result.output) {
            await fs.writeFile(result.filePath, result.output, 'utf-8');
            fixCount++;
          }
        }
        if (fixCount > 0) {
          console.log(`Applied fix to ${fixCount} file(s)`);
        }
      }

      // Check max-warnings
      const maxWarnings = parseInt(options.maxWarnings, 10);
      if (maxWarnings >= 0 && results.warningCount > maxWarnings) {
        process.exit(1);
      }

      process.exit(results.errorCount > 0 ? 1 : 0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize a lint configuration file')
  .option('-p, --preset <name>', 'Rule preset: recommended, strict, minimal', 'recommended')
  .option('--path <path>', 'Output path for config file', '.atiplintrc.json')
  .action(async (options: any) => {
    const preset = presets[options.preset];
    if (!preset) {
      console.error(`Unknown preset: ${options.preset}`);
      process.exit(2);
    }

    const configContent = JSON.stringify(preset, null, 2);
    await fs.writeFile(options.path, configContent, 'utf-8');
    console.log(`Created ${options.path} with ${options.preset} preset`);
  });

// List rules command
program
  .command('list-rules')
  .description('List available lint rules')
  .option('-f, --format <format>', 'Output format: table, json', 'table')
  .option('--category <category>', 'Filter by category')
  .option('--fixable', 'Only show fixable rules')
  .action((options: any) => {
    const rules = Array.from(builtinRules.entries()).map(([id, rule]) => ({
      id,
      category: rule.meta.category,
      description: rule.meta.description,
      fixable: rule.meta.fixable || false,
      defaultSeverity: rule.meta.defaultSeverity,
    }));

    let filtered = rules;
    if (options.category) {
      filtered = filtered.filter((r) => r.category === options.category);
    }
    if (options.fixable) {
      filtered = filtered.filter((r) => r.fixable);
    }

    if (options.format === 'json') {
      console.log(JSON.stringify({ rules: filtered }, null, 2));
    } else {
      console.log('\nAvailable Rules:\n');
      for (const rule of filtered) {
        const fixable = rule.fixable ? '(fixable)' : '';
        console.log(`  ${rule.id.padEnd(30)} ${rule.category.padEnd(12)} ${rule.defaultSeverity.padEnd(6)} ${fixable}`);
        console.log(`    ${rule.description}`);
        console.log();
      }
    }
  });

program.parse();
