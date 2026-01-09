import { getNodeAtPath, getNodeLocation } from '../ast/parser.js';
import { createFixer } from '../fixer/index.js';
import type { RuleContext, RuleIssue } from '../rules/types.js';
import type { LintMessage, LintFix, SeverityValue } from './types.js';
import type { JsonAst } from '../ast/types.js';
import type { AtipMetadata } from '../types/atip.js';
import type { LintConfig } from '../config/types.js';

/**
 * Create a rule context for a file.
 * The context provides access to file metadata, AST, and reporting capabilities.
 */
export function createRuleContext(
  filePath: string,
  metadata: AtipMetadata,
  source: string,
  ast: JsonAst,
  config: LintConfig,
  ruleOptions: Record<string, unknown>,
  messages: LintMessage[],
  ruleId: string,
  severity: SeverityValue
): RuleContext {
  const fixer = createFixer(source, ast.root);

  return {
    filePath,
    metadata,
    source,
    ast,
    options: ruleOptions,
    config,

    report(issue: RuleIssue): void {
      const node = getNodeAtPath(ast.root, issue.path);

      let line = 1;
      let column = 1;
      let endLine: number | undefined;
      let endColumn: number | undefined;

      if (node) {
        const location = getNodeLocation(source, node);
        line = location.line;
        column = location.column;
        endLine = location.endLine;
        endColumn = location.endColumn;
      }

      let fix: LintFix | undefined;
      if (issue.fix) {
        try {
          const fixResult = issue.fix(fixer);
          fix = Array.isArray(fixResult) ? fixResult[0] : fixResult;
        } catch (e) {
          // Fix generation failed, skip it
        }
      }

      const suggestions = issue.suggest?.map((suggestion) => {
        try {
          const fixResult = suggestion.fix(fixer);
          const suggestionFix = Array.isArray(fixResult) ? fixResult[0] : fixResult;
          return {
            desc: suggestion.desc,
            fix: suggestionFix,
          };
        } catch (e) {
          return null;
        }
      }).filter((s): s is { desc: string; fix: LintFix } => s !== null);

      messages.push({
        ruleId,
        severity,
        message: issue.message,
        line,
        column,
        endLine,
        endColumn,
        jsonPath: issue.path,
        fix,
        suggestions,
      });
    },
  };
}
