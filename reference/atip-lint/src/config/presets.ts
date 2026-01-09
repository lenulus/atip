import type { LintConfig } from './types.js';

/**
 * Recommended preset - balanced rules for most projects
 */
export const recommended: LintConfig = {
  rules: {
    // Quality
    'no-empty-effects': 'warn',
    'description-quality': ['warn', { minLength: 10, maxLength: 200 }],
    'no-missing-required-fields': 'error',
    'valid-effects-values': 'error',

    // Consistency
    'consistent-naming': ['warn', { commandCase: 'kebab-case' }],
    'no-duplicate-flags': 'error',

    // Security
    'destructive-needs-reversible': 'warn',
    'billable-needs-confirmation': 'warn',

    // Trust
    'trust-source-requirements': 'warn',
  },
  schemaValidation: true,
  executableChecks: false,
};

/**
 * Strict preset - stricter rules for production tools
 */
export const strict: LintConfig = {
  extends: 'recommended',
  rules: {
    'no-empty-effects': ['error', { minFields: 2 }],
    'description-quality': ['error', { minLength: 20, requireEndingPunctuation: true }],
    'destructive-needs-reversible': 'error',
    'trust-source-requirements': 'error',
  },
};

/**
 * Minimal preset - only critical rules
 */
export const minimal: LintConfig = {
  rules: {
    'no-missing-required-fields': 'error',
    'valid-effects-values': 'error',
    'no-duplicate-flags': 'error',
  },
  schemaValidation: true,
};

export const presets: Record<string, LintConfig> = {
  recommended,
  strict,
  minimal,
};
