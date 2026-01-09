import type { RuleVisitor } from '../rules/types.js';
import type {
  AtipMetadata,
  AtipCommand,
  AtipArgument,
  AtipOption,
} from '../types/atip.js';

/**
 * Traverse ATIP metadata and call visitors.
 * Uses a visitor pattern to walk the metadata tree and invoke callbacks.
 */
export function traverseMetadata(metadata: AtipMetadata, visitors: RuleVisitor[]): void {
  // Visit root metadata
  callVisitors(visitors, 'AtipMetadata', metadata, []);

  // Visit trust
  if (metadata.trust) {
    callVisitors(visitors, 'Trust', metadata.trust, ['trust']);
  }

  // Visit patterns
  if (metadata.patterns) {
    for (const [name, pattern] of Object.entries(metadata.patterns)) {
      callVisitors(visitors, 'Pattern', pattern, ['patterns', name]);
    }
  }

  // Visit commands
  if (metadata.commands) {
    visitCommands(metadata.commands, ['commands'], visitors);
  }

  // Visit global arguments
  if (metadata.arguments) {
    visitArguments(metadata.arguments, ['arguments'], visitors);
  }

  // Visit global options
  if (metadata.globalOptions) {
    visitOptions(metadata.globalOptions, ['globalOptions'], visitors);
  }
}

/**
 * Helper function to call a specific visitor method on all visitors.
 * Reduces code duplication across the traversal functions.
 */
function callVisitors<K extends keyof RuleVisitor>(
  visitors: RuleVisitor[],
  method: K,
  node: Parameters<NonNullable<RuleVisitor[K]>>[0],
  path: string[]
): void {
  for (const visitor of visitors) {
    const fn = visitor[method];
    if (fn) {
      fn.call(visitor, node, path);
    }
  }
}

function visitCommands(commands: Record<string, AtipCommand>, path: string[], visitors: RuleVisitor[]): void {
  for (const [name, command] of Object.entries(commands)) {
    const commandPath = [...path, name];

    callVisitors(visitors, 'Command', command, commandPath);

    // Visit nested effects
    if (command.effects) {
      callVisitors(visitors, 'Effects', command.effects, [...commandPath, 'effects']);
    }

    // Visit arguments
    if (command.arguments) {
      visitArguments(command.arguments, [...commandPath, 'arguments'], visitors);
    }

    // Visit options
    if (command.options) {
      visitOptions(command.options, [...commandPath, 'options'], visitors);
    }

    // Visit nested commands recursively
    if (command.commands) {
      visitCommands(command.commands, [...commandPath, 'commands'], visitors);
    }
  }
}

function visitArguments(args: AtipArgument[], path: string[], visitors: RuleVisitor[]): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const argPath = [...path, String(i)];
    callVisitors(visitors, 'Argument', arg, argPath);
  }
}

function visitOptions(options: AtipOption[], path: string[], visitors: RuleVisitor[]): void {
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const optionPath = [...path, String(i)];
    callVisitors(visitors, 'Option', option, optionPath);
  }
}
