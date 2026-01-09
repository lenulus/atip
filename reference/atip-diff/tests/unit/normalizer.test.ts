import { describe, it, expect } from 'vitest';
import { normalizeMetadata, normalizeArgument, normalizeOption, normalizeEffects } from '../../src/normalizer/normalizer';
import type { AtipTool, AtipArgument, AtipOption, AtipEffects } from '../../src/types';

describe('normalizer', () => {
  describe('normalizeArgument', () => {
    it('should set required to true by default for arguments', () => {
      const arg: AtipArgument = {
        name: 'file',
        type: 'file',
        description: 'Input file',
      };
      const normalized = normalizeArgument(arg);
      expect(normalized.required).toBe(true);
    });

    it('should preserve explicit required value', () => {
      const arg: AtipArgument = {
        name: 'file',
        type: 'file',
        description: 'Input file',
        required: false,
      };
      const normalized = normalizeArgument(arg);
      expect(normalized.required).toBe(false);
    });

    it('should set variadic to false by default', () => {
      const arg: AtipArgument = {
        name: 'files',
        type: 'file',
        description: 'Input files',
      };
      const normalized = normalizeArgument(arg);
      expect(normalized.variadic).toBe(false);
    });

    it('should preserve variadic when set', () => {
      const arg: AtipArgument = {
        name: 'files',
        type: 'file',
        description: 'Input files',
        variadic: true,
      };
      const normalized = normalizeArgument(arg);
      expect(normalized.variadic).toBe(true);
    });
  });

  describe('normalizeOption', () => {
    it('should set required to false by default for options', () => {
      const opt: AtipOption = {
        name: 'verbose',
        flags: ['-v'],
        type: 'boolean',
        description: 'Verbose output',
      };
      const normalized = normalizeOption(opt);
      expect(normalized.required).toBe(false);
    });

    it('should preserve explicit required value', () => {
      const opt: AtipOption = {
        name: 'format',
        flags: ['--format'],
        type: 'string',
        description: 'Output format',
        required: true,
      };
      const normalized = normalizeOption(opt);
      expect(normalized.required).toBe(true);
    });
  });

  describe('normalizeEffects', () => {
    it('should return empty object for undefined effects', () => {
      const normalized = normalizeEffects(undefined);
      expect(normalized).toEqual({});
    });

    it('should preserve existing effects', () => {
      const effects: AtipEffects = {
        network: true,
        destructive: false,
      };
      const normalized = normalizeEffects(effects);
      expect(normalized.network).toBe(true);
      expect(normalized.destructive).toBe(false);
    });

    it('should normalize interactive field', () => {
      const effects: AtipEffects = {
        network: true,
      };
      const normalized = normalizeEffects(effects);
      expect(normalized.interactive).toBeDefined();
      expect(normalized.interactive?.stdin).toBe('none');
      expect(normalized.interactive?.prompts).toBe(false);
      expect(normalized.interactive?.tty).toBe(false);
    });
  });

  describe('normalizeMetadata', () => {
    it('should normalize top-level metadata', () => {
      const metadata: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test tool',
        commands: {},
      };
      const normalized = normalizeMetadata(metadata);
      expect(normalized).toBeDefined();
      expect(normalized.name).toBe('test');
    });

    it('should normalize arguments in commands', () => {
      const metadata: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            arguments: [
              {
                name: 'file',
                type: 'file',
                description: 'Input',
              },
            ],
          },
        },
      };
      const normalized = normalizeMetadata(metadata);
      expect(normalized.commands?.run?.arguments?.[0].required).toBe(true);
    });

    it('should normalize options in commands', () => {
      const metadata: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            options: [
              {
                name: 'verbose',
                flags: ['-v'],
                type: 'boolean',
                description: 'Verbose',
              },
            ],
          },
        },
      };
      const normalized = normalizeMetadata(metadata);
      expect(normalized.commands?.run?.options?.[0].required).toBe(false);
    });

    it('should normalize effects in commands', () => {
      const metadata: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {
          run: {
            description: 'Run',
            effects: {
              network: true,
            },
          },
        },
      };
      const normalized = normalizeMetadata(metadata);
      expect(normalized.commands?.run?.effects?.interactive).toBeDefined();
    });
  });
});
