import type { JsonAst } from '../ast/types.js';
import type { LintConfig } from '../config/types.js';
import type {
  AtipMetadata,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
  AtipTrust,
  AtipPattern,
} from '../types/atip.js';

// Rule definition types
export interface RuleContext {
  filePath: string;
  metadata: AtipMetadata;
  source: string;
  ast: JsonAst;
  report(issue: RuleIssue): void;
  options: Record<string, unknown>;
  config: LintConfig;
}

export interface RuleIssue {
  message: string;
  path: string[];
  fix?: (fixer: Fixer) => LintFix | LintFix[];
  suggest?: Array<{
    desc: string;
    fix: (fixer: Fixer) => LintFix | LintFix[];
  }>;
}

export interface Fixer {
  replaceAt(path: string[], value: unknown): LintFix;
  insertAt(path: string[], key: string, value: unknown): LintFix;
  removeAt(path: string[]): LintFix;
  setAt(path: string[], value: unknown): LintFix;
  replaceRange(range: [number, number], text: string): LintFix;
}

export interface LintFix {
  range: [number, number];
  text: string;
}

export interface RuleDefinition {
  meta: RuleMeta;
  create(context: RuleContext): RuleVisitor;
}

export interface RuleMeta {
  category: 'quality' | 'consistency' | 'security' | 'executable' | 'trust';
  description: string;
  fixable?: boolean;
  hasSuggestions?: boolean;
  defaultSeverity: Severity;
  schema?: Record<string, unknown>;
  docs?: string;
}

export type Severity = 'off' | 'warn' | 'error';

export interface RuleVisitor {
  AtipMetadata?(node: AtipMetadata, path: string[]): void;
  Command?(node: AtipCommand, path: string[]): void;
  Argument?(node: AtipArgument, path: string[]): void;
  Option?(node: AtipOption, path: string[]): void;
  Effects?(node: AtipEffects, path: string[]): void;
  Trust?(node: AtipTrust, path: string[]): void;
  Pattern?(node: AtipPattern, path: string[]): void;
}
