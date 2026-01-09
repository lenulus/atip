import { parseTree, Node, getLocation } from 'jsonc-parser';
import type { JsonAst } from './types.js';

/**
 * Parse JSON source to AST with source locations.
 * Creates an abstract syntax tree that preserves character positions
 * for accurate error reporting and fix generation.
 *
 * @param source - JSON source text
 * @returns AST with root node and source
 * @throws Error if JSON parsing fails
 */
export function parseJsonToAst(source: string): JsonAst {
  const root = parseTree(source, [], { disallowComments: true });

  if (!root) {
    throw new Error('Failed to parse JSON');
  }

  return {
    root,
    source,
  };
}

/**
 * Get line and column from character offset.
 * Converts a zero-based character offset into one-based line and column numbers.
 *
 * @param source - Source text
 * @param offset - Character offset (zero-based)
 * @returns Line and column numbers (one-based)
 */
export function getPositionAt(source: string, offset: number): { line: number; column: number } {
  const lines = source.substring(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Get node at JSON path.
 * Traverses the AST following the path segments to find a specific node.
 *
 * @param root - Root AST node
 * @param path - Path segments (e.g., ['commands', 'delete', 'effects'])
 * @returns AST node at path, or null if not found
 */
export function getNodeAtPath(root: Node, path: string[]): Node | null {
  let node: Node | null = root;

  for (const segment of path) {
    if (!node || node.type !== 'object') {
      return null;
    }

    const property = node.children?.find(
      (child) => child.type === 'property' && child.children?.[0]?.value === segment
    );

    if (!property || !property.children || property.children.length < 2) {
      return null;
    }

    node = property.children[1];
  }

  return node;
}

/**
 * Get location info for a node
 */
export function getNodeLocation(source: string, node: Node): { line: number; column: number; endLine: number; endColumn: number } {
  const start = getPositionAt(source, node.offset);
  const end = getPositionAt(source, node.offset + node.length);

  return {
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
  };
}

/**
 * Get value from node
 */
export function getNodeValue(node: Node): any {
  if (node.type === 'object') {
    const obj: any = {};
    for (const child of node.children || []) {
      if (child.type === 'property' && child.children && child.children.length >= 2) {
        const key = child.children[0].value;
        obj[key] = getNodeValue(child.children[1]);
      }
    }
    return obj;
  } else if (node.type === 'array') {
    return (node.children || []).map(getNodeValue);
  } else {
    return node.value;
  }
}
