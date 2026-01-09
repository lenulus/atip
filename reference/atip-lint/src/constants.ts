// Constants
export const RULE_CATEGORIES = [
  'quality',
  'consistency',
  'security',
  'executable',
  'trust',
] as const;

export const SEVERITY_VALUES = {
  off: 0,
  warn: 1,
  error: 2,
} as const;

export const DEFAULT_CONFIG_FILES = [
  '.atiplintrc.json',
  '.atiplintrc.yaml',
  '.atiplintrc.yml',
  '.atiplintrc.js',
  'atiplint.config.js',
] as const;

export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
] as const;
