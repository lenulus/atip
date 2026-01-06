import type { AtipTool } from '../types/atip';
import { flattenCommands } from '../internal/flatten';

/**
 * Generate a system prompt section describing tool safety properties.
 */
export function generateSafetyPrompt(tools: AtipTool[]): string {
  if (tools.length === 0) {
    return '';
  }

  const sections: string[] = [];
  const destructive: string[] = [];
  const nonReversible: string[] = [];
  const nonIdempotent: string[] = [];
  const billable: string[] = [];
  const network: string[] = [];
  const interactive: string[] = [];

  for (const tool of tools) {
    const flattened = flattenCommands(tool);

    for (const fc of flattened) {
      const effects = fc.command.effects;
      if (!effects) continue;

      if (effects.destructive === true) {
        destructive.push(`- \`${fc.name}\`: ${fc.command.description}`);
      }

      if (effects.reversible === false) {
        nonReversible.push(`- \`${fc.name}\`: ${fc.command.description}`);
      }

      if (effects.idempotent === false) {
        nonIdempotent.push(`- \`${fc.name}\`: ${fc.command.description}`);
      }

      if (effects.cost?.billable === true) {
        billable.push(`- \`${fc.name}\`: ${fc.command.description}`);
      }

      if (effects.network === true) {
        network.push(`- \`${fc.name}\`: ${fc.command.description}`);
      }

      if (effects.interactive?.stdin === 'required' || effects.interactive?.prompts === true) {
        interactive.push(`- \`${fc.name}\`: ${fc.command.description}`);
      }
    }
  }

  sections.push('## Tool Safety Summary');

  if (destructive.length > 0) {
    sections.push('');
    sections.push('### Destructive Operations');
    sections.push('The following commands permanently destroy data. Always confirm with the user before executing:');
    sections.push(...destructive);
  }

  if (nonReversible.length > 0) {
    sections.push('');
    sections.push('### Non-Reversible Operations');
    sections.push('The following commands cannot be undone:');
    sections.push(...nonReversible);
  }

  if (nonIdempotent.length > 0) {
    sections.push('');
    sections.push('### Non-Idempotent Operations');
    sections.push('The following commands have different effects on repeated execution:');
    sections.push(...nonIdempotent);
  }

  if (billable.length > 0) {
    sections.push('');
    sections.push('### Billable Operations');
    sections.push('The following commands may incur costs:');
    sections.push(...billable);
  }

  if (network.length > 0) {
    sections.push('');
    sections.push('### Network Operations');
    sections.push('The following commands require network access:');
    sections.push(...network);
  }

  if (interactive.length > 0) {
    sections.push('');
    sections.push('### Interactive Operations');
    sections.push('The following commands require user input:');
    sections.push(...interactive);
  }

  return sections.join('\n');
}
