// Main exports
export { createLinter } from './linter/index.js';
export { loadConfig } from './config/index.js';
export { presets } from './config/presets.js';
export { defineRule, builtinRules } from './rules/index.js';
export { formatters } from './output/index.js';
export * from './errors.js';
export * from './constants.js';

// Type exports
export type {
  Linter,
  LintOptions,
  LintResult,
  LintResults,
  LintMessage,
  LintFix,
  LintSuggestion,
  Severity,
  SeverityValue,
} from './linter/types.js';

export type {
  LintConfig,
  RuleConfig,
} from './config/types.js';

export type {
  RuleDefinition,
  RuleMeta,
  RuleContext,
  RuleVisitor,
  RuleIssue,
  Fixer,
} from './rules/types.js';

export type {
  Formatter,
  FormatterContext,
} from './output/index.js';

export type {
  JsonAst,
} from './ast/types.js';
