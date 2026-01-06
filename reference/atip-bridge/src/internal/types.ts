import type { AtipParamType } from '../types/atip';

/**
 * Type coercion result for provider parameters.
 */
export interface CoercedType {
  /** JSON Schema type */
  type: string;
  /** Optional suffix to add to description */
  descriptionSuffix?: string;
}

/**
 * Coerce ATIP types to JSON Schema types.
 * Per spec section 8.2 Rule 4.
 */
export function coerceType(atipType: AtipParamType): CoercedType {
  switch (atipType) {
    case 'string':
      return { type: 'string' };
    case 'integer':
      return { type: 'integer' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'file':
      return { type: 'string', descriptionSuffix: ' (file path)' };
    case 'directory':
      return { type: 'string', descriptionSuffix: ' (directory path)' };
    case 'url':
      return { type: 'string', descriptionSuffix: ' (URL)' };
    case 'enum':
      return { type: 'string' };
    case 'array':
      return { type: 'array' };
    default:
      return { type: 'string' };
  }
}
