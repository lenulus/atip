/**
 * Deep comparison logic for ATIP metadata with path tracking
 */

import type {
  AtipTool,
  AtipCommand,
  AtipArgument,
  AtipOption,
  AtipEffects,
  Change,
} from '../types.js';
import { categorizeChange, getEffectsSeverity } from '../categorizer/categorizer.js';
import { compareTypes } from './type-checker.js';

/**
 * Compare two ATIP tool metadata objects
 */
export function compareMetadata(
  oldTool: AtipTool,
  newTool: AtipTool
): Change[] {
  const changes: Change[] = [];

  // Compare version
  if (oldTool.version !== newTool.version) {
    changes.push(createChange('version-changed', ['version'], oldTool.version, newTool.version));
  }

  // Compare description
  if (oldTool.description !== newTool.description) {
    changes.push(createChange('description-changed', ['description'], oldTool.description, newTool.description));
  }

  // Compare homepage
  if (oldTool.homepage !== newTool.homepage) {
    changes.push(createChange('homepage-changed', ['homepage'], oldTool.homepage, newTool.homepage));
  }

  // Compare patterns
  if (JSON.stringify(oldTool.patterns) !== JSON.stringify(newTool.patterns)) {
    changes.push(createChange('patterns-changed', ['patterns'], oldTool.patterns, newTool.patterns));
  }

  // Compare commands
  if (oldTool.commands || newTool.commands) {
    changes.push(...compareCommands(
      oldTool.commands || {},
      newTool.commands || {},
      ['commands']
    ));
  }

  // Compare global options
  if (oldTool.globalOptions || newTool.globalOptions) {
    changes.push(...compareOptions(
      oldTool.globalOptions || [],
      newTool.globalOptions || [],
      ['globalOptions']
    ));
  }

  // Compare root-level arguments
  if (oldTool.arguments || newTool.arguments) {
    changes.push(...compareArguments(
      oldTool.arguments || [],
      newTool.arguments || [],
      ['arguments']
    ));
  }

  // Compare root-level options
  if (oldTool.options || newTool.options) {
    changes.push(...compareOptions(
      oldTool.options || [],
      newTool.options || [],
      ['options']
    ));
  }

  // Compare root-level effects
  if (oldTool.effects || newTool.effects) {
    changes.push(...compareEffects(
      oldTool.effects || {},
      newTool.effects || {},
      ['effects']
    ));
  }

  return changes;
}

/**
 * Compare command dictionaries
 */
export function compareCommands(
  oldCommands: Record<string, AtipCommand>,
  newCommands: Record<string, AtipCommand>,
  path: string[]
): Change[] {
  const changes: Change[] = [];

  // Find removed commands (breaking)
  for (const name of Object.keys(oldCommands)) {
    if (!(name in newCommands)) {
      const changePath = [...path, name];
      changes.push(createChange(
        'command-removed',
        changePath,
        oldCommands[name],
        undefined,
        { command: name, commandPath: getCommandPath(path, name) }
      ));
    }
  }

  // Find added commands (non-breaking)
  for (const name of Object.keys(newCommands)) {
    if (!(name in oldCommands)) {
      const changePath = [...path, name];
      changes.push(createChange(
        'command-added',
        changePath,
        undefined,
        newCommands[name],
        { command: name, commandPath: getCommandPath(path, name) }
      ));
    }
  }

  // Compare existing commands
  for (const name of Object.keys(oldCommands)) {
    if (name in newCommands) {
      const changePath = [...path, name];
      changes.push(...compareCommand(
        oldCommands[name],
        newCommands[name],
        changePath,
        name
      ));
    }
  }

  return changes;
}

/**
 * Compare a single command
 */
function compareCommand(
  oldCmd: AtipCommand,
  newCmd: AtipCommand,
  path: string[],
  commandName: string
): Change[] {
  const changes: Change[] = [];

  // Compare description
  if (oldCmd.description !== newCmd.description) {
    changes.push(createChange(
      'description-changed',
      [...path, 'description'],
      oldCmd.description,
      newCmd.description,
      { command: commandName, commandPath: getCommandPath(path, commandName) }
    ));
  }

  // Compare nested commands
  if (oldCmd.commands || newCmd.commands) {
    changes.push(...compareCommands(
      oldCmd.commands || {},
      newCmd.commands || {},
      [...path, 'commands']  // Append 'commands' for nested command path tracking
    ));
  }

  // Compare arguments
  if (oldCmd.arguments || newCmd.arguments) {
    changes.push(...compareArguments(
      oldCmd.arguments || [],
      newCmd.arguments || [],
      [...path, 'arguments']
    ));
  }

  // Compare options
  if (oldCmd.options || newCmd.options) {
    changes.push(...compareOptions(
      oldCmd.options || [],
      newCmd.options || [],
      [...path, 'options']
    ));
  }

  // Compare effects
  if (oldCmd.effects || newCmd.effects) {
    changes.push(...compareEffects(
      oldCmd.effects || {},
      newCmd.effects || {},
      [...path, 'effects']
    ));
  }

  // Compare examples
  if (JSON.stringify(oldCmd.examples) !== JSON.stringify(newCmd.examples)) {
    changes.push(createChange(
      'examples-changed',
      [...path, 'examples'],
      oldCmd.examples,
      newCmd.examples,
      { command: commandName, commandPath: getCommandPath(path, commandName) }
    ));
  }

  return changes;
}

/**
 * Compare arguments arrays
 */
export function compareArguments(
  oldArgs: AtipArgument[],
  newArgs: AtipArgument[],
  path: string[]
): Change[] {
  const changes: Change[] = [];

  // Build maps by name
  const oldMap = new Map(oldArgs.map((arg) => [arg.name, arg]));
  const newMap = new Map(newArgs.map((arg) => [arg.name, arg]));

  // Find removed arguments (breaking)
  for (const [name, oldArg] of oldMap) {
    if (!newMap.has(name)) {
      changes.push(createChange(
        'argument-removed',
        [...path, name],
        oldArg,
        undefined,
        { argument: name }
      ));
    }
  }

  // Find added arguments
  for (const [name, newArg] of newMap) {
    if (!oldMap.has(name)) {
      const isRequired = newArg.required ?? true;
      changes.push(createChange(
        isRequired ? 'required-argument-added' : 'optional-argument-added',
        [...path, name],
        undefined,
        newArg,
        { argument: name }
      ));
    }
  }

  // Compare existing arguments
  for (const [name, oldArg] of oldMap) {
    if (newMap.has(name)) {
      const newArg = newMap.get(name)!;
      changes.push(...compareArgument(oldArg, newArg, [...path, name]));
    }
  }

  return changes;
}

/**
 * Compare a single argument
 */
function compareArgument(
  oldArg: AtipArgument,
  newArg: AtipArgument,
  path: string[]
): Change[] {
  const changes: Change[] = [];

  // Compare required field
  const oldRequired = oldArg.required ?? true;
  const newRequired = newArg.required ?? true;
  if (oldRequired !== newRequired) {
    if (!oldRequired && newRequired) {
      changes.push(createChange(
        'argument-made-required',
        [...path, 'required'],
        oldRequired,
        newRequired,
        { argument: oldArg.name }
      ));
    } else if (oldRequired && !newRequired) {
      changes.push(createChange(
        'argument-made-optional',
        [...path, 'required'],
        oldRequired,
        newRequired,
        { argument: oldArg.name }
      ));
    }
  }

  // Compare type
  if (oldArg.type && newArg.type && oldArg.type !== newArg.type) {
    const comparison = compareTypes(oldArg.type, newArg.type);
    if (comparison === 'stricter') {
      changes.push(createChange(
        'type-made-stricter',
        [...path, 'type'],
        oldArg.type,
        newArg.type,
        { argument: oldArg.name }
      ));
    } else if (comparison === 'relaxed') {
      changes.push(createChange(
        'type-relaxed',
        [...path, 'type'],
        oldArg.type,
        newArg.type,
        { argument: oldArg.name }
      ));
    }
  }

  // Compare enum values
  if (oldArg.enum || newArg.enum) {
    changes.push(...compareEnumValues(
      oldArg.enum,
      newArg.enum,
      [...path, 'enum']
    ));
  }

  // Compare description
  if (oldArg.description !== newArg.description) {
    changes.push(createChange(
      'description-changed',
      [...path, 'description'],
      oldArg.description,
      newArg.description,
      { argument: oldArg.name }
    ));
  }

  // Compare default value
  if (JSON.stringify(oldArg.default) !== JSON.stringify(newArg.default)) {
    changes.push(createChange(
      'default-value-changed',
      [...path, 'default'],
      oldArg.default,
      newArg.default,
      { argument: oldArg.name }
    ));
  }

  return changes;
}

/**
 * Compare options arrays
 */
export function compareOptions(
  oldOpts: AtipOption[],
  newOpts: AtipOption[],
  path: string[]
): Change[] {
  const changes: Change[] = [];

  // Build maps by name
  const oldMap = new Map(oldOpts.map((opt) => [opt.name, opt]));
  const newMap = new Map(newOpts.map((opt) => [opt.name, opt]));

  // Find removed options (breaking)
  for (const [name, oldOpt] of oldMap) {
    if (!newMap.has(name)) {
      changes.push(createChange(
        'option-removed',
        [...path, name],
        oldOpt,
        undefined,
        { option: name }
      ));
    }
  }

  // Find added options
  for (const [name, newOpt] of newMap) {
    if (!oldMap.has(name)) {
      const isRequired = newOpt.required ?? false;
      changes.push(createChange(
        isRequired ? 'required-option-added' : 'optional-option-added',
        [...path, name],
        undefined,
        newOpt,
        { option: name }
      ));
    }
  }

  // Compare existing options
  for (const [name, oldOpt] of oldMap) {
    if (newMap.has(name)) {
      const newOpt = newMap.get(name)!;
      changes.push(...compareOption(oldOpt, newOpt, [...path, name]));
    }
  }

  return changes;
}

/**
 * Compare a single option
 */
function compareOption(
  oldOpt: AtipOption,
  newOpt: AtipOption,
  path: string[]
): Change[] {
  const changes: Change[] = [];

  // Compare required field
  const oldRequired = oldOpt.required ?? false;
  const newRequired = newOpt.required ?? false;
  if (oldRequired !== newRequired) {
    if (!oldRequired && newRequired) {
      changes.push(createChange(
        'option-made-required',
        [...path, 'required'],
        oldRequired,
        newRequired,
        { option: oldOpt.name }
      ));
    } else if (oldRequired && !newRequired) {
      changes.push(createChange(
        'option-made-optional',
        [...path, 'required'],
        oldRequired,
        newRequired,
        { option: oldOpt.name }
      ));
    }
  }

  // Compare flags
  const oldFlags = oldOpt.flags || [];
  const newFlags = newOpt.flags || [];
  if (JSON.stringify(oldFlags) !== JSON.stringify(newFlags)) {
    const oldSet = new Set(oldFlags);
    const newSet = new Set(newFlags);
    const removed = oldFlags.filter((f) => !newSet.has(f));
    if (removed.length > 0) {
      changes.push(createChange(
        'option-flags-changed',
        [...path, 'flags'],
        removed,
        newFlags,
        { option: oldOpt.name }
      ));
    }
  }

  // Compare type
  if (oldOpt.type && newOpt.type && oldOpt.type !== newOpt.type) {
    const comparison = compareTypes(oldOpt.type, newOpt.type);
    if (comparison === 'stricter') {
      changes.push(createChange(
        'type-made-stricter',
        [...path, 'type'],
        oldOpt.type,
        newOpt.type,
        { option: oldOpt.name }
      ));
    } else if (comparison === 'relaxed') {
      changes.push(createChange(
        'type-relaxed',
        [...path, 'type'],
        oldOpt.type,
        newOpt.type,
        { option: oldOpt.name }
      ));
    }
  }

  // Compare enum values
  if (oldOpt.enum || newOpt.enum) {
    changes.push(...compareEnumValues(
      oldOpt.enum,
      newOpt.enum,
      [...path, 'enum']
    ));
  }

  // Compare description
  if (oldOpt.description !== newOpt.description) {
    changes.push(createChange(
      'description-changed',
      [...path, 'description'],
      oldOpt.description,
      newOpt.description,
      { option: oldOpt.name }
    ));
  }

  // Compare default value
  if (JSON.stringify(oldOpt.default) !== JSON.stringify(newOpt.default)) {
    changes.push(createChange(
      'default-value-changed',
      [...path, 'default'],
      oldOpt.default,
      newOpt.default,
      { option: oldOpt.name }
    ));
  }

  return changes;
}

/**
 * Compare enum values
 */
function compareEnumValues(
  oldEnum: unknown[] | undefined,
  newEnum: unknown[] | undefined,
  path: string[]
): Change[] {
  const changes: Change[] = [];

  if (!oldEnum && !newEnum) return changes;

  const oldSet = new Set(oldEnum || []);
  const newSet = new Set(newEnum || []);

  // Values removed (breaking)
  const removed = [...oldSet].filter((v) => !newSet.has(v));
  if (removed.length > 0) {
    changes.push(createChange('enum-values-removed', path, removed, undefined));
  }

  // Values added (non-breaking)
  const added = [...newSet].filter((v) => !oldSet.has(v));
  if (added.length > 0) {
    changes.push(createChange('enum-values-added', path, undefined, added));
  }

  return changes;
}

/**
 * Helper to compare a simple effect field
 */
function compareSimpleEffect(
  field: string,
  changeType: Change['type'],
  oldValue: unknown,
  newValue: unknown,
  path: string[]
): Change | null {
  if (oldValue !== newValue) {
    return createEffectsChange(
      changeType,
      [...path, field],
      oldValue,
      newValue,
      field
    );
  }
  return null;
}

/**
 * Compare effects metadata
 */
export function compareEffects(
  oldEffects: AtipEffects,
  newEffects: AtipEffects,
  path: string[]
): Change[] {
  const changes: Change[] = [];

  // Compare destructive (special handling for added/removed)
  if (oldEffects.destructive !== newEffects.destructive) {
    if (!oldEffects.destructive && newEffects.destructive) {
      changes.push(createEffectsChange(
        'destructive-added',
        [...path, 'destructive'],
        oldEffects.destructive,
        newEffects.destructive,
        'destructive'
      ));
    } else if (oldEffects.destructive && !newEffects.destructive) {
      changes.push(createEffectsChange(
        'destructive-removed',
        [...path, 'destructive'],
        oldEffects.destructive,
        newEffects.destructive,
        'destructive'
      ));
    }
  }

  // Compare simple boolean fields
  const simpleChanges = [
    compareSimpleEffect('reversible', 'reversible-changed', oldEffects.reversible, newEffects.reversible, path),
    compareSimpleEffect('idempotent', 'idempotent-changed', oldEffects.idempotent, newEffects.idempotent, path),
    compareSimpleEffect('network', 'network-changed', oldEffects.network, newEffects.network, path),
  ].filter((c): c is Change => c !== null);

  changes.push(...simpleChanges);

  // Compare filesystem
  if (JSON.stringify(oldEffects.filesystem) !== JSON.stringify(newEffects.filesystem)) {
    changes.push(createEffectsChange(
      'filesystem-changed',
      [...path, 'filesystem'],
      oldEffects.filesystem,
      newEffects.filesystem,
      'filesystem'
    ));
  }

  // Compare interactive
  if (JSON.stringify(oldEffects.interactive) !== JSON.stringify(newEffects.interactive)) {
    changes.push(createEffectsChange(
      'interactive-changed',
      [...path, 'interactive'],
      oldEffects.interactive,
      newEffects.interactive,
      'interactive'
    ));
  }

  // Compare cost - check nested fields
  if (oldEffects.cost || newEffects.cost) {
    const oldCost = oldEffects.cost || {};
    const newCost = newEffects.cost || {};

    // Check billable field specifically (high severity)
    if (oldCost.billable !== newCost.billable) {
      changes.push(createEffectsChange(
        'cost-changed',
        [...path, 'cost', 'billable'],
        oldCost.billable,
        newCost.billable,
        'cost.billable'
      ));
    }

    // Check estimate field
    if (oldCost.estimate !== newCost.estimate) {
      changes.push(createEffectsChange(
        'cost-changed',
        [...path, 'cost', 'estimate'],
        oldCost.estimate,
        newCost.estimate,
        'cost.estimate'
      ));
    }
  }

  // Compare duration
  if (JSON.stringify(oldEffects.duration) !== JSON.stringify(newEffects.duration)) {
    changes.push(createEffectsChange(
      'duration-changed',
      [...path, 'duration'],
      oldEffects.duration,
      newEffects.duration,
      'duration'
    ));
  }

  return changes;
}

/**
 * Helper to create a change object
 */
function createChange(
  type: Change['type'],
  path: string[],
  oldValue?: unknown,
  newValue?: unknown,
  context?: Change['context']
): Change {
  const category = categorizeChange(type, path, oldValue, newValue);
  let message = generateMessage(type, path, oldValue, newValue);

  return {
    type,
    category,
    message,
    path,
    oldValue,
    newValue,
    context,
  };
}

/**
 * Helper to create an effects change with severity
 */
function createEffectsChange(
  type: Change['type'],
  path: string[],
  oldValue: unknown,
  newValue: unknown,
  effectField: string
): Change {
  const change = createChange(type, path, oldValue, newValue, { effectField });
  change.severity = getEffectsSeverity(effectField, oldValue, newValue);
  return change;
}

/**
 * Generate a human-readable message for a change
 */
function generateMessage(
  type: Change['type'],
  path: string[],
  oldValue?: unknown,
  newValue?: unknown
): string {
  const lastPath = path[path.length - 1];

  switch (type) {
    case 'command-removed':
      return `Command '${lastPath}' was removed`;
    case 'command-added':
      return `Command '${lastPath}' was added`;
    case 'required-argument-added':
      return `Required argument '${lastPath}' was added`;
    case 'optional-argument-added':
      return `Optional argument '${lastPath}' was added`;
    case 'argument-removed':
      return `Argument '${lastPath}' was removed`;
    case 'required-option-added':
      return `Required option '${lastPath}' was added`;
    case 'optional-option-added':
      return `Optional option '${lastPath}' was added`;
    case 'option-removed':
      return `Option '${lastPath}' was removed`;
    case 'option-flags-changed':
      return `Option '${path[path.length - 2]}' flags changed`;
    case 'argument-made-required':
      return `Argument '${path[path.length - 2]}' is now required`;
    case 'argument-made-optional':
      return `Argument '${path[path.length - 2]}' is now optional`;
    case 'option-made-required':
      return `Option '${path[path.length - 2]}' is now required`;
    case 'option-made-optional':
      return `Option '${path[path.length - 2]}' is now optional`;
    case 'type-made-stricter':
      return `Type changed from '${oldValue}' to '${newValue}' (stricter)`;
    case 'type-relaxed':
      return `Type changed from '${oldValue}' to '${newValue}' (relaxed)`;
    case 'enum-values-removed':
      return `Enum values removed: ${JSON.stringify(oldValue)}`;
    case 'enum-values-added':
      return `Enum values added: ${JSON.stringify(newValue)}`;
    case 'description-changed':
      return `Description changed`;
    case 'version-changed':
      return `Version changed from '${oldValue}' to '${newValue}'`;
    case 'homepage-changed':
      return `Homepage changed`;
    case 'patterns-changed':
      return `Patterns changed`;
    case 'default-value-changed':
      return `Default value changed`;
    case 'examples-changed':
      return `Examples changed`;
    case 'destructive-added':
      return `Marked as destructive`;
    case 'destructive-removed':
      return `No longer marked as destructive`;
    case 'reversible-changed':
      return `Reversible changed from ${oldValue} to ${newValue}`;
    case 'idempotent-changed':
      return `Idempotent changed from ${oldValue} to ${newValue}`;
    case 'network-changed':
      return `Network changed from ${oldValue} to ${newValue}`;
    case 'filesystem-changed':
      return `Filesystem effects changed`;
    case 'interactive-changed':
      return `Interactive effects changed`;
    case 'cost-changed':
      return `Cost effects changed`;
    case 'duration-changed':
      return `Duration effects changed`;
    default:
      return `Change detected at ${path.join('.')}`;
  }
}

/**
 * Extract command path from path array
 */
function getCommandPath(path: string[], commandName: string): string[] {
  const commandPath: string[] = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i] === 'commands' && path[i + 1]) {
      commandPath.push(path[i + 1]);
      i++;
    }
  }
  commandPath.push(commandName);
  return commandPath;
}
