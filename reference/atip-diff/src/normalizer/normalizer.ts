/**
 * Normalization logic for ATIP metadata
 */

import type {
  AtipTool,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
} from '../types.js';

/**
 * Normalize ATIP tool metadata
 * @param tool - The ATIP tool metadata
 * @returns Normalized metadata
 */
export function normalizeTool(tool: AtipTool): AtipTool {
  return {
    ...tool,
    atip:
      typeof tool.atip === 'string'
        ? { version: tool.atip }
        : tool.atip,
    commands: tool.commands
      ? normalizeCommands(tool.commands)
      : {},
    arguments: tool.arguments
      ? tool.arguments.map((arg) => normalizeArgument(arg))
      : undefined,
    options: tool.options
      ? tool.options.map((opt) => normalizeOption(opt))
      : undefined,
    globalOptions: tool.globalOptions
      ? tool.globalOptions.map((opt) => normalizeOption(opt))
      : undefined,
    effects: tool.effects
      ? normalizeEffects(tool.effects)
      : undefined,
  };
}

/**
 * Normalize commands object
 */
function normalizeCommands(
  commands: Record<string, AtipCommand>
): Record<string, AtipCommand> {
  const normalized: Record<string, AtipCommand> = {};
  for (const [name, command] of Object.entries(commands)) {
    normalized[name] = normalizeCommand(command);
  }
  return normalized;
}

/**
 * Normalize command definition
 */
function normalizeCommand(command: AtipCommand): AtipCommand {
  return {
    ...command,
    commands: command.commands
      ? normalizeCommands(command.commands)
      : undefined,
    arguments: command.arguments
      ? command.arguments.map((arg) => normalizeArgument(arg))
      : undefined,
    options: command.options
      ? command.options.map((opt) => normalizeOption(opt))
      : undefined,
    effects: command.effects
      ? normalizeEffects(command.effects)
      : undefined,
  };
}

/**
 * Normalize argument definition
 * Arguments have required=true by default
 */
export function normalizeArgument(arg: AtipArgument): AtipArgument {
  return {
    ...arg,
    required: arg.required ?? true,
    variadic: arg.variadic ?? false,
  };
}

/**
 * Normalize option definition
 * Options have required=false by default
 */
export function normalizeOption(opt: AtipOption): AtipOption {
  return {
    ...opt,
    required: opt.required ?? false,
    variadic: opt.variadic ?? false,
  };
}

/**
 * Normalize effects metadata
 */
export function normalizeEffects(effects: AtipEffects | undefined): AtipEffects {
  if (!effects) {
    return {};
  }
  const normalized: AtipEffects = { ...effects };

  // Always normalize interactive (with defaults if not present)
  normalized.interactive = {
    stdin: effects.interactive?.stdin ?? 'none',
    prompts: effects.interactive?.prompts ?? false,
    tty: effects.interactive?.tty ?? false,
  };

  // Normalize filesystem if present
  if (effects.filesystem) {
    normalized.filesystem = {
      read: effects.filesystem.read ?? false,
      write: effects.filesystem.write ?? false,
      delete: effects.filesystem.delete ?? false,
    };
  }

  // Normalize cost if present
  if (effects.cost) {
    normalized.cost = {
      billable: effects.cost.billable ?? false,
      estimate: effects.cost.estimate,
    };
  }

  return normalized;
}

/**
 * Alias for normalizeTool for backwards compatibility
 */
export const normalizeMetadata = normalizeTool;
