/**
 * Constants for atip-execute
 */

/**
 * Default timeout for command execution in milliseconds (30 seconds).
 *
 * Commands exceeding this timeout will be terminated with SIGTERM,
 * followed by SIGKILL after 1 second if still running.
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default maximum output size in bytes (1MB).
 *
 * Output (stdout + stderr combined) exceeding this size will be truncated.
 * This prevents memory exhaustion from commands with large output.
 */
export const DEFAULT_MAX_OUTPUT_SIZE = 1048576;

/**
 * Default maximum result length for LLM consumption in characters (100K).
 *
 * Formatted results exceeding this length will be truncated before
 * being returned to the LLM to stay within token limits.
 */
export const DEFAULT_MAX_RESULT_LENGTH = 100000;

/**
 * Default separator used in flattened tool names.
 *
 * Flattens nested command structures like gh.pr.create into gh_pr_create
 * for LLM function calling compatibility.
 */
export const DEFAULT_SEPARATOR = '_';

/**
 * Trust level ordering for comparison.
 *
 * Higher numbers indicate greater trust. Used for enforcing minimum
 * trust level policies.
 *
 * @see ExecutionPolicy.minTrustLevel
 */
export const TRUST_LEVEL_ORDER: Record<string, number> = {
  native: 6,
  vendor: 5,
  org: 4,
  community: 3,
  user: 2,
  inferred: 1,
};
