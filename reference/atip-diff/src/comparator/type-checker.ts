/**
 * Type comparison logic for determining if type changes are stricter or relaxed
 */

import type { AtipParamType } from '../types.js';

/**
 * Type coercion map - maps restrictive types to their relaxed forms
 */
const TYPE_COERCION_MAP: Record<AtipParamType, AtipParamType[]> = {
  enum: ['string'],
  integer: ['number'],
  file: ['string'],
  directory: ['string'],
  url: ['string'],
  string: [],
  number: [],
  boolean: [],
  array: [],
};

/**
 * Check if a type change is relaxed (less restrictive)
 * @param oldType - The old type
 * @param newType - The new type
 * @returns True if the new type is more relaxed than the old type
 */
export function isTypeRelaxed(
  oldType: AtipParamType,
  newType: AtipParamType
): boolean {
  if (oldType === newType) return false;
  return TYPE_COERCION_MAP[oldType]?.includes(newType) ?? false;
}

/**
 * Check if a type change is stricter (more restrictive)
 * @param oldType - The old type
 * @param newType - The new type
 * @returns True if the new type is stricter than the old type
 */
export function isTypeStricter(
  oldType: AtipParamType,
  newType: AtipParamType
): boolean {
  if (oldType === newType) return false;
  return TYPE_COERCION_MAP[newType]?.includes(oldType) ?? false;
}

/**
 * Compare two types and determine the relationship
 * @param oldType - The old type
 * @param newType - The new type
 * @returns 'stricter', 'relaxed', 'unchanged', or 'changed'
 */
export function compareTypes(
  oldType: AtipParamType,
  newType: AtipParamType
): 'stricter' | 'relaxed' | 'unchanged' | 'changed' {
  if (oldType === newType) return 'unchanged';
  if (isTypeStricter(oldType, newType)) return 'stricter';
  if (isTypeRelaxed(oldType, newType)) return 'relaxed';
  return 'changed';
}
