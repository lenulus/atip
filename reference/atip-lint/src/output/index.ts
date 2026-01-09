import type { LintResults } from '../linter/types.js';

export interface FormatterContext {
  cwd: string;
  color: boolean;
  config: any;
}

export type Formatter = (results: LintResults, context: FormatterContext) => string;

function stylish(results: LintResults, _context: FormatterContext): string {
  // Minimal stylish formatter
  let output = '';
  for (const result of results.results) {
    if (result.messages.length === 0) continue;

    output += `\n${result.filePath}\n`;
    for (const message of result.messages) {
      const severity = message.severity === 2 ? 'error' : 'warn';
      output += `  ${message.line}:${message.column}  ${severity}  ${message.message}  ${message.ruleId}\n`;
    }
  }

  if (results.errorCount > 0 || results.warningCount > 0) {
    output += `\n${results.errorCount} errors, ${results.warningCount} warnings\n`;
  }

  return output;
}

function json(results: LintResults, _context: FormatterContext): string{
  return JSON.stringify(results, null, 2);
}

function sarif(results: LintResults, _context: FormatterContext): string {
  // Collect unique rule IDs from results
  const ruleIds = new Set<string>();
  for (const fileResult of results.results) {
    for (const message of fileResult.messages) {
      if (message.ruleId) ruleIds.add(message.ruleId);
    }
  }

  // Build rules array
  const rules = Array.from(ruleIds).map(ruleId => ({
    id: ruleId,
    shortDescription: {
      text: ruleId,
    },
  }));

  // SARIF 2.1.0 output
  const runs = [{
    tool: {
      driver: {
        name: 'atip-lint',
        version: '0.1.0',
        rules,
      },
    },
    results: results.results.flatMap((fileResult) =>
      fileResult.messages.map((message) => ({
        ruleId: message.ruleId,
        level: message.severity === 2 ? 'error' : 'warning',
        message: {
          text: message.message,
        },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: fileResult.filePath,
            },
            region: {
              startLine: message.line,
              startColumn: message.column,
            },
          },
        }],
      }))
    ),
  }];

  return JSON.stringify({ version: '2.1.0', $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json', runs }, null, 2);
}

function compact(results: LintResults, _context: FormatterContext): string {
  // One line per issue - grep-friendly format
  let output = '';
  for (const result of results.results) {
    for (const message of result.messages) {
      const severity = message.severity === 2 ? 'error' : 'warning';
      output += `${result.filePath}:${message.line}:${message.column}: ${severity} - ${message.message} (${message.ruleId})\n`;
    }
  }
  return output;
}

export const formatters = {
  stylish,
  json,
  sarif,
  compact,
};
