/**
 * Command mapping - maps flattened tool names to CLI commands
 */

import { DEFAULT_SEPARATOR } from './constants.js';

/**
 * Options for command mapping.
 */
export interface MapOptions {
  /** Separator used in flattened tool names (default: '_') */
  separator?: string;
}

/**
 * Result of mapping a tool name to a CLI command.
 */
export interface CommandMapping {
  /** Command array to execute (e.g., ['gh', 'pr', 'create']) */
  command: string[];
  /** Command-level metadata from ATIP spec */
  metadata: any;
  /** Root tool metadata from ATIP spec */
  tool: any;
  /** Subcommand path within the tool (e.g., ['pr', 'create']) */
  path: string[];
  /** Merged effects metadata (command + tool level) */
  effects: any;
}

/**
 * Map a flattened tool name back to a CLI command array.
 *
 * Resolves flattened tool names (e.g., "gh_pr_create") back to their
 * full command structure (e.g., ['gh', 'pr', 'create']) by walking the
 * ATIP metadata tree. Also merges command-level and tool-level effects.
 *
 * @param toolName - Flattened tool name (e.g., "gh_pr_create")
 * @param tools - Array of ATIP tool metadata to search
 * @param options - Optional mapping options (separator)
 * @returns Command mapping with command array, metadata, and merged effects, or undefined if not found
 *
 * @example
 * ```typescript
 * const mapping = mapToCommand('gh_pr_create', tools);
 * if (mapping) {
 *   console.log(mapping.command); // ['gh', 'pr', 'create']
 *   console.log(mapping.effects.destructive); // false
 * }
 * ```
 */
export function mapToCommand(
  toolName: string,
  tools: any[],
  options?: MapOptions
): CommandMapping | undefined {
  const separator = options?.separator ?? DEFAULT_SEPARATOR;

  // Split flattened name into parts
  const parts = toolName.split(separator);
  if (parts.length === 0) {
    return undefined;
  }

  // First part is tool name
  const toolNamePart = parts[0];

  // Find the tool in the tools array
  const tool = tools.find((t) => t.name === toolNamePart);
  if (!tool) {
    return undefined;
  }

  // If only one part (e.g., "gh"), this is a root-level command
  if (parts.length === 1) {
    // Some tools may have no commands property, treat as root command
    if (!tool.commands) {
      return {
        command: [tool.name],
        metadata: tool,
        tool,
        path: [],
        effects: tool.effects || {},
      };
    }
    return undefined;
  }

  // Remaining parts are the command path
  const commandPath = parts.slice(1);

  // Walk the command tree to find the leaf command
  let current = tool.commands;
  const resolvedPath: string[] = [];

  for (const segment of commandPath) {
    if (!current || !current[segment]) {
      return undefined;
    }

    resolvedPath.push(segment);
    const node = current[segment];

    // If this is the last segment, we found the command
    if (resolvedPath.length === commandPath.length) {
      // Build command array: [toolName, ...path]
      const command = [tool.name, ...resolvedPath];

      // Merge effects (command + tool level)
      const effects = mergeEffects(node.effects || {}, tool.effects || {});

      return {
        command,
        metadata: node,
        tool,
        path: resolvedPath,
        effects,
      };
    }

    // Continue walking down the tree
    current = node.commands;
  }

  return undefined;
}

/**
 * Merge command-level and tool-level effects.
 * Uses conservative merging (most restrictive wins).
 */
function mergeEffects(commandEffects: any, toolEffects: any): any {
  const merged: any = {};

  // Boolean flags: OR semantics (true wins - conservative for safety)
  merged.destructive = commandEffects.destructive || toolEffects.destructive || false;
  merged.network = commandEffects.network || toolEffects.network || false;

  // Reversible/Idempotent: Conservative semantics
  // false is most restrictive, so false wins
  // true only if both explicitly say true
  // undefined if both are undefined
  merged.reversible = mergeOptionalBoolean(
    commandEffects.reversible,
    toolEffects.reversible
  );
  merged.idempotent = mergeOptionalBoolean(
    commandEffects.idempotent,
    toolEffects.idempotent
  );

  // Filesystem effects: OR semantics for individual operations
  if (commandEffects.filesystem || toolEffects.filesystem) {
    merged.filesystem = {
      read: commandEffects.filesystem?.read || toolEffects.filesystem?.read || false,
      write: commandEffects.filesystem?.write || toolEffects.filesystem?.write || false,
      delete: commandEffects.filesystem?.delete || toolEffects.filesystem?.delete || false,
    };
  }

  // Cost: command takes precedence, fall back to tool
  if (commandEffects.cost || toolEffects.cost) {
    merged.cost = {
      billable: commandEffects.cost?.billable ?? toolEffects.cost?.billable ?? false,
      estimate: commandEffects.cost?.estimate ?? toolEffects.cost?.estimate ?? undefined,
    };
  }

  // Duration: command takes precedence, fall back to tool
  if (commandEffects.duration || toolEffects.duration) {
    merged.duration = {
      expected: commandEffects.duration?.expected ?? toolEffects.duration?.expected,
      timeout: commandEffects.duration?.timeout ?? toolEffects.duration?.timeout,
    };
  }

  // Interactive: command takes precedence, fall back to tool
  if (commandEffects.interactive || toolEffects.interactive) {
    merged.interactive = {
      stdin: commandEffects.interactive?.stdin ?? toolEffects.interactive?.stdin,
      prompts: commandEffects.interactive?.prompts ?? toolEffects.interactive?.prompts ?? false,
      tty: commandEffects.interactive?.tty ?? toolEffects.interactive?.tty ?? false,
    };
  }

  return merged;
}

/**
 * Merge two optional boolean values with conservative semantics.
 * - false wins (most restrictive)
 * - true only if both are explicitly true
 * - undefined if both are undefined
 */
function mergeOptionalBoolean(a: boolean | undefined, b: boolean | undefined): boolean | undefined {
  // If either is false, result is false
  if (a === false || b === false) {
    return false;
  }
  // If both are true, result is true
  if (a === true && b === true) {
    return true;
  }
  // If one is true and the other undefined, result is true
  if (a === true || b === true) {
    return true;
  }
  // Both undefined
  return undefined;
}
