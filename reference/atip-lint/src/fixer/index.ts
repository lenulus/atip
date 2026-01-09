import { getNodeAtPath, getNodeLocation } from '../ast/parser.js';
import type { Node } from 'jsonc-parser';
import type { LintFix } from '../linter/types.js';
import type { Fixer } from '../rules/types.js';

/**
 * Create a fixer helper for generating fixes.
 * Provides methods to manipulate JSON at specific paths.
 *
 * @param source - Original source text
 * @param ast - Parsed AST root node
 * @returns Fixer helper with fix generation methods
 */
export function createFixer(source: string, ast: Node): Fixer {
  return {
    replaceAt(path: string[], value: unknown): LintFix {
      const node = getNodeAtPath(ast, path);
      if (!node) {
        throw new Error(`Node not found at path: ${path.join('.')}`);
      }

      return {
        range: [node.offset, node.offset + node.length],
        text: JSON.stringify(value),
      };
    },

    insertAt(path: string[], key: string, value: unknown): LintFix {
      const node = getNodeAtPath(ast, path);
      if (!node || node.type !== 'object') {
        throw new Error(`Object not found at path: ${path.join('.')}`);
      }

      const valueText = JSON.stringify(value);
      const propertyText = `"${key}": ${valueText}`;

      // Find insertion point
      if (!node.children || node.children.length === 0) {
        // Empty object - insert between braces
        return {
          range: [node.offset + 1, node.offset + 1],
          text: propertyText,
        };
      } else {
        // Insert after last property with comma
        const lastProperty = node.children[node.children.length - 1];
        const insertOffset = lastProperty.offset + lastProperty.length;
        return {
          range: [insertOffset, insertOffset],
          text: `, ${propertyText}`,
        };
      }
    },

    removeAt(path: string[]): LintFix {
      const node = getNodeAtPath(ast, path);
      if (!node) {
        throw new Error(`Node not found at path: ${path.join('.')}`);
      }

      return {
        range: [node.offset, node.offset + node.length],
        text: '',
      };
    },

    setAt(path: string[], value: unknown): LintFix {
      const node = getNodeAtPath(ast, path);
      if (!node) {
        throw new Error(`Node not found at path: ${path.join('.')}`);
      }

      return {
        range: [node.offset, node.offset + node.length],
        text: JSON.stringify(value, null, 2),
      };
    },

    replaceRange(range: [number, number], text: string): LintFix {
      return { range, text };
    },
  };
}

/**
 * Apply fixes to source text.
 * Sorts fixes by position and applies non-overlapping fixes from end to start.
 * Detects and reports conflicting fixes that would overlap.
 *
 * @param source - Original source text
 * @param fixes - Array of fixes to apply
 * @returns Result with modified output, count of applied fixes, and any conflicts
 */
export function applyFixes(source: string, fixes: LintFix[]): {
  output: string;
  applied: number;
  conflicts: LintFix[];
} {
  if (fixes.length === 0) {
    return { output: source, applied: 0, conflicts: [] };
  }

  // Sort fixes by start position (descending) to apply from end
  const sorted = [...fixes].sort((a, b) => b.range[0] - a.range[0]);

  const conflicts: LintFix[] = [];
  const toApply: LintFix[] = [];

  let lastStart = source.length;
  for (const fix of sorted) {
    if (fix.range[1] <= lastStart) {
      toApply.push(fix);
      lastStart = fix.range[0];
    } else {
      conflicts.push(fix);
    }
  }

  // Apply fixes (already sorted descending)
  let output = source;
  for (const fix of toApply) {
    output = output.slice(0, fix.range[0]) + fix.text + output.slice(fix.range[1]);
  }

  return {
    output,
    applied: toApply.length,
    conflicts,
  };
}

export * from './types.js';
