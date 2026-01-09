// Configuration types
export type Severity = 'off' | 'warn' | 'error';
export type SeverityValue = 0 | 1 | 2;
export type RuleConfig = Severity | SeverityValue | [Severity | SeverityValue, Record<string, unknown>];

export interface LintConfig {
  extends?: string | string[];
  rules?: Record<string, RuleConfig>;
  ignorePatterns?: string[];
  schemaValidation?: boolean;
  executableChecks?: boolean;
  overrides?: Array<{
    files: string[];
    rules: Record<string, RuleConfig>;
  }>;
  plugins?: string[];
  env?: {
    binaryPaths?: Record<string, string>;
  };
}
