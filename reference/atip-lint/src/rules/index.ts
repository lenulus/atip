import type { RuleDefinition } from './types.js';

// Quality rules
import { noEmptyEffects } from './quality/no-empty-effects.js';
import { descriptionQuality } from './quality/description-quality.js';
import { noMissingRequiredFields } from './quality/no-missing-required-fields.js';

// Consistency rules
import { validEffectsValues } from './consistency/valid-effects-values.js';
import { consistentNaming } from './consistency/consistent-naming.js';
import { noDuplicateFlags } from './consistency/no-duplicate-flags.js';

// Security rules
import { destructiveNeedsReversible } from './security/destructive-needs-reversible.js';
import { billableNeedsConfirmation } from './security/billable-needs-confirmation.js';

// Trust rules
import { trustSourceRequirements } from './trust/trust-source-requirements.js';

// Executable rules
import { binaryExists } from './executable/binary-exists.js';
import { agentFlagWorks } from './executable/agent-flag-works.js';

/**
 * Registry of all built-in rules
 */
export const builtinRules = new Map<string, RuleDefinition>([
  ['no-empty-effects', noEmptyEffects],
  ['description-quality', descriptionQuality],
  ['no-missing-required-fields', noMissingRequiredFields],
  ['valid-effects-values', validEffectsValues],
  ['consistent-naming', consistentNaming],
  ['no-duplicate-flags', noDuplicateFlags],
  ['destructive-needs-reversible', destructiveNeedsReversible],
  ['billable-needs-confirmation', billableNeedsConfirmation],
  ['trust-source-requirements', trustSourceRequirements],
  ['binary-exists', binaryExists],
  ['agent-flag-works', agentFlagWorks],
]);

export { defineRule } from './define.js';
export type * from './types.js';
