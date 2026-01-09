/**
 * Command array building - translates validated arguments to CLI command arrays
 */

/**
 * Build the final command array with arguments.
 *
 * Constructs a CLI command array from the command mapping and validated arguments.
 * Handles both positional arguments and options (flags) according to ATIP metadata.
 *
 * @param mapping - Command mapping from mapToCommand containing base command and metadata
 * @param args - Validated and normalized arguments from the tool call
 * @returns Command array ready for subprocess execution (e.g., ['gh', 'pr', 'create', '--title', 'Fix bug'])
 *
 * @example
 * ```typescript
 * const mapping = mapToCommand('gh_pr_create', tools);
 * const args = { title: 'Fix bug', draft: true };
 * const command = buildCommandArray(mapping, args);
 * // Returns: ['gh', 'pr', 'create', '--title', 'Fix bug', '--draft']
 * ```
 */
export function buildCommandArray(
  mapping: any,
  args: Record<string, unknown>
): string[] {
  const command = [...mapping.command]; // Start with base command

  const metadata = mapping.metadata;
  const argumentsSchema = metadata.arguments || [];
  const optionsSchema = metadata.options || [];

  // Add positional arguments first (in order defined in schema)
  for (const argSchema of argumentsSchema) {
    const paramName = argSchema.name;
    const value = args[paramName];

    if (value !== undefined && value !== null) {
      // Positional arguments are just added as values
      command.push(String(value));
    }
  }

  // Add options (flagged arguments)
  for (const optionSchema of optionsSchema) {
    const paramName = optionSchema.name;
    const value = args[paramName];

    // Skip if not provided
    if (value === undefined || value === null) {
      continue;
    }

    // Get the flag to use (prefer long form)
    const flag = selectFlag(optionSchema.flags);

    // Handle different types
    const type = optionSchema.type;

    if (type === 'boolean') {
      // Boolean: add flag if true, omit if false
      if (value === true) {
        command.push(flag);
      }
    } else if (type === 'array' || optionSchema.variadic) {
      // Array/variadic: repeat flag for each value
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        command.push(flag);
        command.push(String(item));
      }
    } else {
      // String, integer, number, enum: add flag and value
      command.push(flag);
      command.push(String(value));
    }
  }

  return command;
}

/**
 * Select which flag to use from the available flags.
 *
 * Prefers long form (--flag) over short form (-f) for better readability.
 *
 * @param flags - Array of available flags (e.g., ['-t', '--title'])
 * @returns Selected flag (prefers long form)
 * @throws Error if flags array is empty
 */
function selectFlag(flags: string[]): string {
  if (!flags || flags.length === 0) {
    throw new Error('Option has no flags defined');
  }

  // Prefer long form (starts with --)
  const longFlag = flags.find((f) => f.startsWith('--'));
  if (longFlag) {
    return longFlag;
  }

  // Fall back to first flag
  return flags[0];
}
