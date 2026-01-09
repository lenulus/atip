// Type definitions for linter
export type SeverityValue = 0 | 1 | 2;
export type Severity = 'off' | 'warn' | 'error';

export interface LintMessage {
  ruleId: string;
  severity: SeverityValue;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  nodeType?: string;
  jsonPath?: string[];
  fix?: LintFix;
  suggestions?: LintSuggestion[];
}

export interface LintFix {
  range: [number, number];
  text: string;
}

export interface LintSuggestion {
  desc: string;
  fix: LintFix;
}

export interface LintResult {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  source?: string;
  output?: string;
}

export interface LintResults {
  results: LintResult[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export interface LintOptions {
  fix?: boolean;
  fixableOnly?: boolean;
  executableCheck?: boolean;
  quiet?: boolean;
  configOverrides?: any;
}

export interface Linter {
  lintFile(filePath: string, options?: LintOptions): Promise<LintResult>;
  lintText(source: string, filePath?: string, options?: LintOptions): Promise<LintResult>;
  lintFiles(patterns: string[], options?: LintOptions): Promise<LintResults>;
  getConfigForFile(filePath: string): Promise<any>;
  getRules(): Map<string, any>;
}
