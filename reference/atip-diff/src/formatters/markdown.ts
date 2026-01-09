/**
 * Markdown formatter for changelogs
 */

import type { DiffResult, MarkdownFormatOptions } from '../types.js';

/**
 * Format diff result as Markdown
 * @param result - Diff result to format
 * @param options - Formatting options
 * @returns Markdown string suitable for changelogs
 */
export function formatMarkdown(
  result: DiffResult,
  options?: MarkdownFormatOptions
): string {
  const includeHeader = options?.includeHeader ?? false;
  const version = options?.version;
  const date = options?.date ?? new Date().toISOString().split('T')[0];
  // const groupByCommand = options?.groupByCommand ?? false;

  const lines: string[] = [];

  // Header
  if (includeHeader && version) {
    lines.push(`## ${version} - ${date}`);
    lines.push('');
  }

  // Breaking changes
  if (result.summary.breakingChanges > 0) {
    lines.push('### Breaking Changes');
    lines.push('');
    lines.push('> **Warning**: The following changes may break existing integrations.');
    lines.push('');
    const breakingChanges = result.changes.filter(c => c.category === 'breaking');
    for (const change of breakingChanges) {
      lines.push(`- **${formatChangeType(change.type)}**: ${change.message}`);
      lines.push(`  - Path: \`${change.path.join('.')}\``);
    }
    lines.push('');
  }

  // Non-breaking changes
  if (result.summary.nonBreakingChanges > 0) {
    lines.push('### Non-Breaking Changes');
    lines.push('');
    const nonBreakingChanges = result.changes.filter(c => c.category === 'non-breaking');
    for (const change of nonBreakingChanges) {
      lines.push(`- **${formatChangeType(change.type)}**: ${change.message}`);
      lines.push(`  - Path: \`${change.path.join('.')}\``);
    }
    lines.push('');
  }

  // Effects changes
  if (result.summary.effectsChanges > 0) {
    lines.push('### Effects Changes');
    lines.push('');
    const effectsChanges = result.changes.filter(c => c.category === 'effects');
    for (const change of effectsChanges) {
      const severityTag = change.severity ? ` *(${change.severity} severity)*` : '';
      lines.push(`- **${formatChangeType(change.type)}**${severityTag}: ${change.message}`);
      lines.push(`  - Path: \`${change.path.join('.')}\``);
    }
    lines.push('');
  }

  // Footer with semver recommendation
  if (result.semverRecommendation !== 'none') {
    lines.push('---');
    lines.push('');
    lines.push(`**Recommended version bump**: ${result.semverRecommendation.toUpperCase()}`);
  }

  return lines.join('\n');
}

/**
 * Format change type as human-readable string
 */
function formatChangeType(type: string): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
