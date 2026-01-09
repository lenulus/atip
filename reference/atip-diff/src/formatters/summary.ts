/**
 * Summary formatter for human-readable terminal output
 */

import chalk from 'chalk';
import type { DiffResult, FormatOptions } from '../types.js';

/**
 * Format diff result as human-readable summary
 * @param result - Diff result to format
 * @param options - Formatting options
 * @returns Formatted string for terminal output
 */
export function formatSummary(
  result: DiffResult,
  options?: FormatOptions
): string {
  const useColor = options?.color ?? true;
  const verbose = options?.verbose ?? false;

  const lines: string[] = [];

  // Helper to colorize if color is enabled
  const colorize = (text: string, color: (s: string) => string): string =>
    useColor ? color(text) : text;

  // Breaking changes section
  if (result.summary.breakingChanges > 0) {
    lines.push('');
    lines.push(colorize('BREAKING CHANGES', chalk.red.bold) + ` (${result.summary.breakingChanges})`);
    const breakingChanges = result.changes.filter(c => c.category === 'breaking');
    for (const change of breakingChanges) {
      lines.push(colorize('  - ', chalk.red) + change.message);
      lines.push(colorize(`    Type: ${change.type}`, chalk.gray));
      if (verbose) {
        lines.push(colorize(`    Path: ${change.path.join('.')}`, chalk.gray));
      }
    }
  }

  // Non-breaking changes section
  if (result.summary.nonBreakingChanges > 0) {
    lines.push('');
    lines.push(colorize('NON-BREAKING CHANGES', chalk.green.bold) + ` (${result.summary.nonBreakingChanges})`);
    const nonBreakingChanges = result.changes.filter(c => c.category === 'non-breaking');
    for (const change of nonBreakingChanges) {
      lines.push(colorize('  + ', chalk.green) + change.message);
      lines.push(colorize(`    Type: ${change.type}`, chalk.gray));
      if (verbose) {
        lines.push(colorize(`    Path: ${change.path.join('.')}`, chalk.gray));
      }
    }
  }

  // Effects changes section
  if (result.summary.effectsChanges > 0) {
    lines.push('');
    lines.push(colorize('EFFECTS CHANGES', chalk.yellow.bold) + ` (${result.summary.effectsChanges})`);
    const effectsChanges = result.changes.filter(c => c.category === 'effects');
    for (const change of effectsChanges) {
      const severityIndicator = change.severity === 'high' ? '!' : change.severity === 'medium' ? '~' : '.';
      lines.push(colorize(`  ${severityIndicator} `, chalk.yellow) + change.message);
      if (change.severity) {
        lines.push(colorize(`    Severity: ${change.severity}`, chalk.gray));
      }
      if (verbose) {
        lines.push(colorize(`    Path: ${change.path.join('.')}`, chalk.gray));
      }
    }
  }

  // Summary line
  lines.push('');
  if (result.summary.totalChanges === 0) {
    lines.push(colorize('No changes detected', chalk.gray));
  } else {
    const parts = [
      `${result.summary.totalChanges} change${result.summary.totalChanges !== 1 ? 's' : ''}`,
    ];
    if (result.summary.breakingChanges > 0) {
      parts.push(colorize(`${result.summary.breakingChanges} breaking`, chalk.red));
    }
    if (result.summary.nonBreakingChanges > 0) {
      parts.push(colorize(`${result.summary.nonBreakingChanges} non-breaking`, chalk.green));
    }
    if (result.summary.effectsChanges > 0) {
      parts.push(colorize(`${result.summary.effectsChanges} effects`, chalk.yellow));
    }
    lines.push(`Summary: ${parts.join(', ')}`);
  }

  // Semver recommendation
  if (result.semverRecommendation !== 'none') {
    const bumpColor =
      result.semverRecommendation === 'major' ? chalk.red :
      result.semverRecommendation === 'minor' ? chalk.yellow :
      chalk.blue;
    lines.push(
      `Recommended version bump: ${colorize(
        result.semverRecommendation.toUpperCase(),
        bumpColor
      )}`
    );
  }

  return lines.join('\n');
}
