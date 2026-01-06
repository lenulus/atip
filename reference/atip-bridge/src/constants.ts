/**
 * Maximum description length for OpenAI (enforced by API).
 */
export const OPENAI_DESCRIPTION_MAX_LENGTH = 1024;

/**
 * Safety flag prefixes used in description suffixes.
 */
export const SAFETY_FLAGS = {
  DESTRUCTIVE: '⚠️ DESTRUCTIVE',
  NOT_REVERSIBLE: '⚠️ NOT REVERSIBLE',
  NOT_IDEMPOTENT: '⚠️ NOT IDEMPOTENT',
  BILLABLE: '💰 BILLABLE',
  READ_ONLY: '🔒 READ-ONLY',
} as const;

/**
 * Default patterns for secret redaction.
 */
export const DEFAULT_REDACT_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g,
  /Basic\s+[A-Za-z0-9+\/]+=*/g,
  /ghp_[A-Za-z0-9]+/g,
  /gho_[A-Za-z0-9]+/g,
  /ghs_[A-Za-z0-9]+/g,
  /ghu_[A-Za-z0-9]+/g,
  /ghr_[A-Za-z0-9]+/g,
  /AKIA[A-Z0-9]{16}/g,
  /(?<=password[=:\s])[^\s]+/gi,
  /(?<=secret[=:\s])[^\s]+/gi,
  /(?<=token[=:\s])[^\s]+/gi,
  /(?<=api[_-]?key[=:\s])[^\s]+/gi,
];
