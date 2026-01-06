import type { AtipEffects } from '../types/atip';
import { SAFETY_FLAGS } from '../constants';

/**
 * Build safety suffix from effects metadata.
 * Returns bracketed suffix like "[⚠️ DESTRUCTIVE | ⚠️ NOT REVERSIBLE]"
 */
export function buildSafetySuffix(effects?: AtipEffects): string {
  if (!effects) {
    return '';
  }

  const flags: string[] = [];

  // Critical flags first
  if (effects.destructive === true) {
    flags.push(SAFETY_FLAGS.DESTRUCTIVE);
  }

  if (effects.reversible === false) {
    flags.push(SAFETY_FLAGS.NOT_REVERSIBLE);
  }

  if (effects.idempotent === false) {
    flags.push(SAFETY_FLAGS.NOT_IDEMPOTENT);
  }

  // Billable flag
  if (effects.cost?.billable === true) {
    flags.push(SAFETY_FLAGS.BILLABLE);
  }

  // Read-only flag (positive indicator)
  // Only add when EXPLICITLY marked as read-only on both network and filesystem
  // An empty filesystem object {} does NOT imply read-only
  const noNetwork = effects.network === false;
  const writeExplicitlyFalse = effects.filesystem?.write === false;

  // READ-ONLY only if both conditions are explicitly met:
  // - network is explicitly false AND
  // - filesystem.write is explicitly false
  if (noNetwork && writeExplicitlyFalse) {
    flags.push(SAFETY_FLAGS.READ_ONLY);
  }

  if (flags.length === 0) {
    return '';
  }

  return `[${flags.join(' | ')}]`;
}
