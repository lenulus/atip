import { parseJsonToAst } from '../ast/parser.js';
import { traverseMetadata } from '../ast/visitor.js';
import { createRuleContext } from './context.js';
import { normalizeRuleConfig } from '../config/loader.js';
import { applyFixes } from '../fixer/index.js';
import { calculateMessageCounts, filterMessages } from './utils.js';
import type { LintConfig } from '../config/types.js';
import type { RuleDefinition } from '../rules/types.js';
import type { LintResult, LintOptions, LintMessage, SeverityValue } from './types.js';
import type { JsonAst } from '../ast/types.js';
import type { AtipMetadata } from '../types/atip.js';

/**
 * Run lint rules on a file.
 * Parses the source, initializes rules, traverses the metadata tree,
 * and optionally applies fixes.
 */
export async function runLint(
  source: string,
  filePath: string,
  config: LintConfig,
  rules: Map<string, RuleDefinition>,
  options: LintOptions = {}
): Promise<LintResult> {
  // Parse source
  let metadata: AtipMetadata;
  let ast: JsonAst;

  try {
    metadata = JSON.parse(source);
    ast = parseJsonToAst(source);
  } catch (e) {
    return {
      filePath,
      messages: [
        {
          ruleId: 'parse-error',
          severity: 2,
          message: `Failed to parse JSON: ${(e as Error).message}`,
          line: 1,
          column: 1,
        },
      ],
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      source,
    };
  }

  const messages: LintMessage[] = [];
  const activeRules: Array<{ ruleId: string; severity: number; visitor: any }> = [];

  // Initialize active rules
  for (const [ruleId, ruleConfig] of Object.entries(config.rules || {})) {
    const [severity, ruleOptions] = normalizeRuleConfig(ruleConfig);

    if (severity === 0) {
      continue; // Rule disabled
    }

    const rule = rules.get(ruleId);
    if (!rule) {
      continue; // Unknown rule
    }

    const context = createRuleContext(
      filePath,
      metadata,
      source,
      ast,
      config,
      ruleOptions,
      messages,
      ruleId,
      severity as SeverityValue
    );

    const visitor = rule.create(context);
    activeRules.push({ ruleId, severity, visitor });
  }

  // Traverse metadata and call visitors
  const visitors = activeRules.map((r) => r.visitor);
  traverseMetadata(metadata, visitors);

  // Apply quiet mode
  const filteredMessages = filterMessages(messages, options.quiet ?? false);

  // Calculate counts
  const counts = calculateMessageCounts(filteredMessages);

  const result: LintResult = {
    filePath,
    messages: filteredMessages,
    ...counts,
    source,
  };

  // Apply fixes if requested
  if (options.fix && (counts.fixableErrorCount > 0 || counts.fixableWarningCount > 0)) {
    const fixes = filteredMessages
      .filter((m) => m.fix)
      .map((m) => m.fix!);

    const { output } = applyFixes(source, fixes);
    result.output = output;
  }

  return result;
}
