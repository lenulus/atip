/**
 * Safety policy for tool validation.
 */
export interface Policy {
  /** Allow destructive operations without confirmation */
  allowDestructive?: boolean;

  /** Allow non-reversible operations without confirmation */
  allowNonReversible?: boolean;

  /** Allow billable operations */
  allowBillable?: boolean;

  /** Allow network operations */
  allowNetwork?: boolean;

  /** Allow filesystem write operations */
  allowFilesystemWrite?: boolean;

  /** Allow filesystem delete operations */
  allowFilesystemDelete?: boolean;

  /** Maximum allowed cost estimate */
  maxCostEstimate?: 'free' | 'low' | 'medium' | 'high';

  /** Trust level threshold */
  minTrustLevel?: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred';
}

/**
 * Result of tool validation.
 */
export interface ValidationResult {
  valid: boolean;
  violations: PolicyViolation[];
}

export interface PolicyViolation {
  code: ViolationCode;
  message: string;
  severity: 'error' | 'warning';
  toolName: string;
  commandPath?: string[];
}

export type ViolationCode =
  | 'DESTRUCTIVE_OPERATION'
  | 'NON_REVERSIBLE_OPERATION'
  | 'BILLABLE_OPERATION'
  | 'NETWORK_OPERATION'
  | 'FILESYSTEM_WRITE'
  | 'FILESYSTEM_DELETE'
  | 'COST_EXCEEDS_LIMIT'
  | 'TRUST_BELOW_THRESHOLD'
  | 'UNKNOWN_COMMAND';

/**
 * Validator function returned by createValidator.
 */
export interface Validator {
  /**
   * Validate a tool call against the policy.
   * @param toolName - The flattened tool name (e.g., "gh_pr_create")
   * @param args - The arguments to the tool
   * @returns Validation result with violations
   */
  validate(toolName: string, args: Record<string, unknown>): ValidationResult;
}

/**
 * Filter for sanitizing tool results before sending to LLM.
 */
export interface ResultFilter {
  /**
   * Filter sensitive data from tool output.
   * @param result - Raw tool output
   * @param toolName - The tool that produced the output
   * @returns Filtered result safe to send to LLM
   */
  filter(result: string, toolName: string): string;
}

/**
 * Options for result filtering.
 */
export interface ResultFilterOptions {
  /** Maximum result length in characters */
  maxLength?: number; // Default: 100000

  /** Patterns to redact (replaced with [REDACTED]) */
  redactPatterns?: RegExp[];

  /** Whether to redact common secret patterns */
  redactSecrets?: boolean; // Default: true
}
