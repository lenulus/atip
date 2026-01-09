import { describe, it, expect } from 'vitest';
import { isTypeStricter, isTypeRelaxed, compareTypes } from '../../src/comparator/type-checker';
import type { AtipParamType } from '../../src/types';

describe('type-checker', () => {
  describe('isTypeRelaxed', () => {
    it('should detect enum -> string as relaxed', () => {
      expect(isTypeRelaxed('enum', 'string')).toBe(true);
    });

    it('should detect integer -> number as relaxed', () => {
      expect(isTypeRelaxed('integer', 'number')).toBe(true);
    });

    it('should detect file -> string as relaxed', () => {
      expect(isTypeRelaxed('file', 'string')).toBe(true);
    });

    it('should detect directory -> string as relaxed', () => {
      expect(isTypeRelaxed('directory', 'string')).toBe(true);
    });

    it('should detect url -> string as relaxed', () => {
      expect(isTypeRelaxed('url', 'string')).toBe(true);
    });

    it('should return false for string -> enum', () => {
      expect(isTypeRelaxed('string', 'enum')).toBe(false);
    });

    it('should return false for number -> integer', () => {
      expect(isTypeRelaxed('number', 'integer')).toBe(false);
    });

    it('should return false for same type', () => {
      expect(isTypeRelaxed('string', 'string')).toBe(false);
    });
  });

  describe('isTypeStricter', () => {
    it('should detect string -> enum as stricter', () => {
      expect(isTypeStricter('string', 'enum')).toBe(true);
    });

    it('should detect number -> integer as stricter', () => {
      expect(isTypeStricter('number', 'integer')).toBe(true);
    });

    it('should detect string -> file as stricter', () => {
      expect(isTypeStricter('string', 'file')).toBe(true);
    });

    it('should detect string -> url as stricter', () => {
      expect(isTypeStricter('string', 'url')).toBe(true);
    });

    it('should return false for enum -> string', () => {
      expect(isTypeStricter('enum', 'string')).toBe(false);
    });

    it('should return false for integer -> number', () => {
      expect(isTypeStricter('integer', 'number')).toBe(false);
    });

    it('should return false for same type', () => {
      expect(isTypeStricter('string', 'string')).toBe(false);
    });
  });

  describe('compareTypes', () => {
    it('should return "stricter" when type narrows', () => {
      const result = compareTypes('string', 'enum');
      expect(result).toBe('stricter');
    });

    it('should return "relaxed" when type widens', () => {
      const result = compareTypes('enum', 'string');
      expect(result).toBe('relaxed');
    });

    it('should return "unchanged" for same type', () => {
      const result = compareTypes('string', 'string');
      expect(result).toBe('unchanged');
    });

    it('should return "changed" for unrelated types', () => {
      const result = compareTypes('string', 'boolean');
      expect(result).toBe('changed');
    });

    it('should handle array type', () => {
      const result = compareTypes('array', 'array');
      expect(result).toBe('unchanged');
    });

    it('should detect boolean type changes', () => {
      const result = compareTypes('string', 'boolean');
      expect(result).toBe('changed');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined types', () => {
      expect(() => compareTypes(undefined as any, 'string')).not.toThrow();
    });

    it('should handle null types', () => {
      expect(() => compareTypes(null as any, 'string')).not.toThrow();
    });

    it('should handle complex type transitions', () => {
      // file -> url is changing, not relaxing or restricting
      const result = compareTypes('file', 'url');
      expect(['changed', 'unchanged']).toContain(result);
    });
  });
});
