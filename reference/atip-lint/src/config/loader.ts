import { cosmiconfig } from 'cosmiconfig';
import type { LintConfig, RuleConfig } from './types.js';
import { presets } from './presets.js';
import { SEVERITY_VALUES, DEFAULT_IGNORE_PATTERNS } from '../constants.js';

const explorer = cosmiconfig('atiplint');

/**
 * Load configuration from file hierarchy.
 *
 * Searches for configuration in this order:
 * 1. Explicit path if provided
 * 2. .atiplintrc.json in current directory
 * 3. .atiplintrc.yaml in current directory
 * 4. .atiplintrc.js in current directory
 * 5. atiplint.config.js in current directory
 * 6. package.json atiplint field
 * 7. Parent directories (up to root)
 *
 * @param startPath - Starting directory for config search (defaults to cwd)
 * @param configPath - Optional explicit config path
 * @returns Loaded and merged configuration with defaults
 *
 * @example
 * ```typescript
 * const config = await loadConfig('/project/examples');
 * console.log('Rules:', config.rules);
 * ```
 */
export async function loadConfig(
  startPath?: string,
  configPath?: string
): Promise<LintConfig> {
  let result;

  if (configPath) {
    result = await explorer.load(configPath);
  } else {
    result = await explorer.search(startPath);
  }

  if (!result) {
    // Return default config with empty rules
    return {
      rules: {},
      ignorePatterns: Array.from(DEFAULT_IGNORE_PATTERNS),
      schemaValidation: true,
    };
  }

  return mergeConfig(result.config);
}

/**
 * Merge config with extends
 */
function mergeConfig(config: LintConfig): LintConfig {
  // Validate config before merging
  validateConfig(config);

  if (!config.extends) {
    return config;
  }

  const extendsArray = Array.isArray(config.extends) ? config.extends : [config.extends];
  let merged: LintConfig = {};

  for (const extendName of extendsArray) {
    const baseConfig = presets[extendName];
    if (!baseConfig) {
      throw new Error(`Unknown preset: ${extendName}`);
    }
    merged = deepMerge(merged, mergeConfig(baseConfig));
  }

  return deepMerge(merged, config);
}

/**
 * Validate config structure
 */
function validateConfig(config: LintConfig): void {
  if (!config.rules) {
    return;
  }

  for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
    // Validate severity
    if (Array.isArray(ruleConfig)) {
      const [severity, options] = ruleConfig;
      normalizeSeverity(severity);

      // Validate options is an object
      if (options !== undefined && typeof options !== 'object') {
        throw new Error(`Invalid rule options for ${ruleId}: must be an object`);
      }
    } else {
      normalizeSeverity(ruleConfig);
    }
  }
}

/**
 * Deep merge two configs
 */
function deepMerge(target: LintConfig, source: LintConfig): LintConfig {
  const result: LintConfig = { ...target };

  if (source.rules) {
    result.rules = { ...target.rules, ...source.rules };
  }

  if (source.ignorePatterns) {
    result.ignorePatterns = [
      ...(target.ignorePatterns || []),
      ...source.ignorePatterns,
    ];
  }

  if (source.overrides) {
    result.overrides = [
      ...(target.overrides || []),
      ...source.overrides,
    ];
  }

  if (source.plugins) {
    result.plugins = [
      ...(target.plugins || []),
      ...source.plugins,
    ];
  }

  if (source.env) {
    result.env = {
      ...target.env,
      ...source.env,
      binaryPaths: {
        ...(target.env?.binaryPaths || {}),
        ...(source.env?.binaryPaths || {}),
      },
    };
  }

  if (source.schemaValidation !== undefined) {
    result.schemaValidation = source.schemaValidation;
  }

  if (source.executableChecks !== undefined) {
    result.executableChecks = source.executableChecks;
  }

  return result;
}

/**
 * Normalize rule config to [severity, options] format.
 * Converts various config formats into a consistent tuple format.
 *
 * @param config - Rule config in any valid format (severity string/number or tuple)
 * @returns Tuple of [numeric severity, options object]
 *
 * @example
 * ```typescript
 * normalizeRuleConfig('error') // => [2, {}]
 * normalizeRuleConfig(['warn', { minLength: 20 }]) // => [1, { minLength: 20 }]
 * normalizeRuleConfig(2) // => [2, {}]
 * ```
 */
export function normalizeRuleConfig(config: RuleConfig): [number, Record<string, unknown>] {
  if (Array.isArray(config)) {
    const [severity, options = {}] = config;
    return [normalizeSeverity(severity), options];
  }

  return [normalizeSeverity(config), {}];
}

/**
 * Convert severity to numeric value
 */
function normalizeSeverity(severity: string | number): number {
  if (typeof severity === 'number') {
    return severity;
  }

  const value = SEVERITY_VALUES[severity as keyof typeof SEVERITY_VALUES];
  if (value === undefined) {
    throw new Error(`Invalid severity: ${severity}`);
  }

  return value;
}
