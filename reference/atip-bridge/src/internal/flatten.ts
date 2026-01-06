import type { AtipCommand, AtipTool } from '../types/atip';

/**
 * Flattened command with full path information.
 */
export interface FlattenedCommand {
  /** Flattened name (e.g., "gh_pr_create") */
  name: string;
  /** Path components (e.g., ["pr", "create"]) */
  path: string[];
  /** The command definition */
  command: AtipCommand;
}

/**
 * Flatten nested command tree into array of leaf commands.
 * Uses depth-first traversal to maintain consistent ordering.
 */
export function flattenCommands(
  tool: AtipTool,
  commandName?: string,
  commandMap?: Record<string, AtipCommand>,
  path: string[] = []
): FlattenedCommand[] {
  const commands = commandMap || tool.commands;
  if (!commands) {
    return [];
  }

  const result: FlattenedCommand[] = [];
  const toolName = tool.name;

  for (const [key, command] of Object.entries(commands)) {
    const currentPath = [...path, key];

    // If command has subcommands, recurse
    if (command.commands && Object.keys(command.commands).length > 0) {
      result.push(...flattenCommands(tool, commandName, command.commands, currentPath));
    } else {
      // Leaf command - flatten the name
      const flatName = `${toolName}_${currentPath.join('_')}`;
      result.push({
        name: flatName,
        path: currentPath,
        command,
      });
    }
  }

  return result;
}
