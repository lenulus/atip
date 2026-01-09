import { describe, it, expect } from 'vitest';
import { compareMetadata, compareCommands, compareArguments, compareOptions, compareEffects } from '../../src/comparator/comparator';
import type { AtipTool, AtipCommand, AtipArgument, AtipOption, AtipEffects } from '../../src/types';

describe('comparator', () => {
  describe('compareMetadata', () => {
    it('should detect no changes when metadata is identical', () => {
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };
      const changes = compareMetadata(old, old);
      expect(changes).toEqual([]);
    });

    it('should detect version change', () => {
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        version: '2.0.0',
      };
      const changes = compareMetadata(old, newMeta);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('version-changed');
      expect(changes[0].oldValue).toBe('1.0.0');
      expect(changes[0].newValue).toBe('2.0.0');
    });

    it('should detect description change', () => {
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Old description',
        commands: {},
      };
      const newMeta: AtipTool = {
        ...old,
        description: 'New description',
      };
      const changes = compareMetadata(old, newMeta);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('description-changed');
    });

    it('should detect homepage change', () => {
      const old: AtipTool = {
        atip: { version: '0.6' },
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        commands: {},
        homepage: 'https://old.com',
      };
      const newMeta: AtipTool = {
        ...old,
        homepage: 'https://new.com',
      };
      const changes = compareMetadata(old, newMeta);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('homepage-changed');
    });
  });

  describe('compareCommands', () => {
    it('should detect command removal (breaking)', () => {
      const oldCommands: Record<string, AtipCommand> = {
        build: { description: 'Build' },
        deploy: { description: 'Deploy' },
      };
      const newCommands: Record<string, AtipCommand> = {
        build: { description: 'Build' },
      };
      const changes = compareCommands(oldCommands, newCommands, ['commands']);
      expect(changes.some(c => c.type === 'command-removed')).toBe(true);
      const removeChange = changes.find(c => c.type === 'command-removed');
      expect(removeChange?.category).toBe('breaking');
      expect(removeChange?.path).toEqual(['commands', 'deploy']);
    });

    it('should detect command addition (non-breaking)', () => {
      const oldCommands: Record<string, AtipCommand> = {
        build: { description: 'Build' },
      };
      const newCommands: Record<string, AtipCommand> = {
        build: { description: 'Build' },
        test: { description: 'Test' },
      };
      const changes = compareCommands(oldCommands, newCommands, ['commands']);
      expect(changes.some(c => c.type === 'command-added')).toBe(true);
      const addChange = changes.find(c => c.type === 'command-added');
      expect(addChange?.category).toBe('non-breaking');
      expect(addChange?.path).toEqual(['commands', 'test']);
    });

    it('should recurse into nested commands', () => {
      const oldCommands: Record<string, AtipCommand> = {
        pr: {
          description: 'Pull requests',
          commands: {
            create: { description: 'Create PR' },
          },
        },
      };
      const newCommands: Record<string, AtipCommand> = {
        pr: {
          description: 'Pull requests',
          commands: {
            create: { description: 'Create PR' },
            merge: { description: 'Merge PR' },
          },
        },
      };
      const changes = compareCommands(oldCommands, newCommands, ['commands']);
      expect(changes.some(c => c.type === 'command-added' && c.path[3] === 'merge')).toBe(true);
    });
  });

  describe('compareArguments', () => {
    it('should detect required argument added (breaking)', () => {
      const oldArgs: AtipArgument[] = [];
      const newArgs: AtipArgument[] = [
        {
          name: 'file',
          type: 'file',
          description: 'Input file',
          required: true,
        },
      ];
      const changes = compareArguments(oldArgs, newArgs, ['commands', 'run', 'arguments']);
      expect(changes.some(c => c.type === 'required-argument-added')).toBe(true);
      const change = changes.find(c => c.type === 'required-argument-added');
      expect(change?.category).toBe('breaking');
    });

    it('should detect optional argument added (non-breaking)', () => {
      const oldArgs: AtipArgument[] = [];
      const newArgs: AtipArgument[] = [
        {
          name: 'output',
          type: 'file',
          description: 'Output file',
          required: false,
        },
      ];
      const changes = compareArguments(oldArgs, newArgs, ['commands', 'run', 'arguments']);
      expect(changes.some(c => c.type === 'optional-argument-added')).toBe(true);
      const change = changes.find(c => c.type === 'optional-argument-added');
      expect(change?.category).toBe('non-breaking');
    });

    it('should detect argument removed (breaking)', () => {
      const oldArgs: AtipArgument[] = [
        {
          name: 'file',
          type: 'file',
          description: 'Input file',
        },
      ];
      const newArgs: AtipArgument[] = [];
      const changes = compareArguments(oldArgs, newArgs, ['commands', 'run', 'arguments']);
      expect(changes.some(c => c.type === 'argument-removed')).toBe(true);
      const change = changes.find(c => c.type === 'argument-removed');
      expect(change?.category).toBe('breaking');
    });

    it('should detect argument made required (breaking)', () => {
      const oldArgs: AtipArgument[] = [
        {
          name: 'file',
          type: 'file',
          description: 'Input file',
          required: false,
        },
      ];
      const newArgs: AtipArgument[] = [
        {
          name: 'file',
          type: 'file',
          description: 'Input file',
          required: true,
        },
      ];
      const changes = compareArguments(oldArgs, newArgs, ['commands', 'run', 'arguments']);
      expect(changes.some(c => c.type === 'argument-made-required')).toBe(true);
    });

    it('should detect argument made optional (non-breaking)', () => {
      const oldArgs: AtipArgument[] = [
        {
          name: 'file',
          type: 'file',
          description: 'Input file',
          required: true,
        },
      ];
      const newArgs: AtipArgument[] = [
        {
          name: 'file',
          type: 'file',
          description: 'Input file',
          required: false,
        },
      ];
      const changes = compareArguments(oldArgs, newArgs, ['commands', 'run', 'arguments']);
      expect(changes.some(c => c.type === 'argument-made-optional')).toBe(true);
    });
  });

  describe('compareOptions', () => {
    it('should detect option flags changed (breaking)', () => {
      const oldOpts: AtipOption[] = [
        {
          name: 'verbose',
          flags: ['-v', '--verbose'],
          type: 'boolean',
          description: 'Verbose',
        },
      ];
      const newOpts: AtipOption[] = [
        {
          name: 'verbose',
          flags: ['-V', '--verbose'],
          type: 'boolean',
          description: 'Verbose',
        },
      ];
      const changes = compareOptions(oldOpts, newOpts, ['commands', 'run', 'options']);
      expect(changes.some(c => c.type === 'option-flags-changed')).toBe(true);
    });

    it('should detect option removed (breaking)', () => {
      const oldOpts: AtipOption[] = [
        {
          name: 'force',
          flags: ['--force'],
          type: 'boolean',
          description: 'Force',
        },
      ];
      const newOpts: AtipOption[] = [];
      const changes = compareOptions(oldOpts, newOpts, ['commands', 'run', 'options']);
      expect(changes.some(c => c.type === 'option-removed')).toBe(true);
    });

    it('should detect optional option added (non-breaking)', () => {
      const oldOpts: AtipOption[] = [];
      const newOpts: AtipOption[] = [
        {
          name: 'quiet',
          flags: ['-q', '--quiet'],
          type: 'boolean',
          description: 'Quiet mode',
        },
      ];
      const changes = compareOptions(oldOpts, newOpts, ['commands', 'run', 'options']);
      expect(changes.some(c => c.type === 'optional-option-added')).toBe(true);
    });
  });

  describe('compareEffects', () => {
    it('should detect destructive flag added (effects, high severity)', () => {
      const oldEffects: AtipEffects = {
        network: true,
      };
      const newEffects: AtipEffects = {
        network: true,
        destructive: true,
      };
      const changes = compareEffects(oldEffects, newEffects, ['commands', 'delete', 'effects']);
      expect(changes.some(c => c.type === 'destructive-added')).toBe(true);
      const change = changes.find(c => c.type === 'destructive-added');
      expect(change?.category).toBe('effects');
      expect(change?.severity).toBe('high');
    });

    it('should detect reversible changed (effects, medium severity)', () => {
      const oldEffects: AtipEffects = {
        reversible: true,
      };
      const newEffects: AtipEffects = {
        reversible: false,
      };
      const changes = compareEffects(oldEffects, newEffects, ['commands', 'deploy', 'effects']);
      expect(changes.some(c => c.type === 'reversible-changed')).toBe(true);
      const change = changes.find(c => c.type === 'reversible-changed');
      expect(change?.severity).toBe('medium');
    });

    it('should detect network changed (effects, low severity)', () => {
      const oldEffects: AtipEffects = {
        network: false,
      };
      const newEffects: AtipEffects = {
        network: true,
      };
      const changes = compareEffects(oldEffects, newEffects, ['commands', 'fetch', 'effects']);
      expect(changes.some(c => c.type === 'network-changed')).toBe(true);
      const change = changes.find(c => c.type === 'network-changed');
      expect(change?.severity).toBe('low');
    });

    it('should detect cost.billable changed (effects, high severity)', () => {
      const oldEffects: AtipEffects = {
        cost: {
          billable: false,
        },
      };
      const newEffects: AtipEffects = {
        cost: {
          billable: true,
        },
      };
      const changes = compareEffects(oldEffects, newEffects, ['commands', 'deploy', 'effects']);
      expect(changes.some(c => c.type === 'cost-changed')).toBe(true);
      const change = changes.find(c => c.type === 'cost-changed' && c.path.includes('billable'));
      expect(change?.severity).toBe('high');
    });
  });
});
