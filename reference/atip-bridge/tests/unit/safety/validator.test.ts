import { describe, test, expect } from 'vitest';
import { createValidator } from '../../../src/index';
import type { AtipTool, Policy } from '../../../src/index';

describe('createValidator', () => {
  const ghTool: AtipTool = {
    atip: { version: '0.4' },
    name: 'gh',
    version: '2.45.0',
    description: 'GitHub CLI',
    commands: {
      repo: {
        description: 'Repositories',
        commands: {
          delete: {
            description: 'Delete repository',
            effects: {
              destructive: true,
              reversible: false,
              network: true,
            },
          },
          list: {
            description: 'List repositories',
            effects: {
              network: true,
              idempotent: true,
            },
          },
        },
      },
    },
  };

  describe('basic validation', () => {
    test('should create a validator instance', () => {
      const validator = createValidator([ghTool], {});

      expect(validator).toHaveProperty('validate');
      expect(typeof validator.validate).toBe('function');
    });

    test('should allow safe operations', () => {
      const validator = createValidator([ghTool], {
        allowNetwork: true,
      });

      const result = validator.validate('gh_repo_list', {});

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should block destructive operations when not allowed', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
      });

      const result = validator.validate('gh_repo_delete', { repo: 'test' });

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(2); // destructive + non-reversible
      expect(result.violations[0].code).toBe('DESTRUCTIVE_OPERATION');
    });

    test('should block non-reversible operations when not allowed', () => {
      const validator = createValidator([ghTool], {
        allowNonReversible: false,
      });

      const result = validator.validate('gh_repo_delete', { repo: 'test' });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'NON_REVERSIBLE_OPERATION')).toBe(true);
    });
  });

  describe('policy enforcement', () => {
    test('should enforce allowDestructive policy', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
      });

      const result = validator.validate('gh_repo_delete', {});

      expect(result.valid).toBe(false);
      const violation = result.violations.find(
        (v) => v.code === 'DESTRUCTIVE_OPERATION'
      );
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe('error');
      expect(violation?.toolName).toBe('gh_repo_delete');
    });

    test('should enforce allowNonReversible policy', () => {
      const validator = createValidator([ghTool], {
        allowNonReversible: false,
      });

      const result = validator.validate('gh_repo_delete', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'NON_REVERSIBLE_OPERATION')
      ).toBe(true);
    });

    test('should enforce allowNetwork policy', () => {
      const validator = createValidator([ghTool], {
        allowNetwork: false,
      });

      const result = validator.validate('gh_repo_list', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'NETWORK_OPERATION')
      ).toBe(true);
    });

    test('should enforce allowBillable policy', () => {
      const billableTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'api',
        version: '1.0.0',
        description: 'API',
        commands: {
          call: {
            description: 'Make call',
            effects: {
              cost: {
                billable: true,
              },
            },
          },
        },
      };

      const validator = createValidator([billableTool], {
        allowBillable: false,
      });

      const result = validator.validate('api_call', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'BILLABLE_OPERATION')
      ).toBe(true);
    });

    test('should enforce filesystem write policy', () => {
      const fsTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'fs',
        version: '1.0.0',
        description: 'Filesystem',
        commands: {
          write: {
            description: 'Write file',
            effects: {
              filesystem: {
                write: true,
              },
            },
          },
        },
      };

      const validator = createValidator([fsTool], {
        allowFilesystemWrite: false,
      });

      const result = validator.validate('fs_write', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'FILESYSTEM_WRITE')
      ).toBe(true);
    });

    test('should enforce filesystem delete policy', () => {
      const fsTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'fs',
        version: '1.0.0',
        description: 'Filesystem',
        commands: {
          delete: {
            description: 'Delete file',
            effects: {
              filesystem: {
                delete: true,
              },
            },
          },
        },
      };

      const validator = createValidator([fsTool], {
        allowFilesystemDelete: false,
      });

      const result = validator.validate('fs_delete', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'FILESYSTEM_DELETE')
      ).toBe(true);
    });
  });

  describe('cost estimate policy', () => {
    test('should enforce maxCostEstimate policy', () => {
      const costTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'api',
        version: '1.0.0',
        description: 'API',
        commands: {
          expensive: {
            description: 'Expensive call',
            effects: {
              cost: {
                estimate: 'high',
              },
            },
          },
        },
      };

      const validator = createValidator([costTool], {
        maxCostEstimate: 'low',
      });

      const result = validator.validate('api_expensive', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'COST_EXCEEDS_LIMIT')
      ).toBe(true);
    });

    test('should allow operations within cost threshold', () => {
      const costTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'api',
        version: '1.0.0',
        description: 'API',
        commands: {
          cheap: {
            description: 'Cheap call',
            effects: {
              cost: {
                estimate: 'low',
              },
            },
          },
        },
      };

      const validator = createValidator([costTool], {
        maxCostEstimate: 'medium',
      });

      const result = validator.validate('api_cheap', {});

      expect(result.valid).toBe(true);
    });
  });

  describe('trust level policy', () => {
    test('should enforce minTrustLevel policy', () => {
      const untrustedTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'untrusted',
        version: '1.0.0',
        description: 'Untrusted',
        trust: {
          source: 'user',
        },
        commands: {
          run: {
            description: 'Run',
            effects: {},
          },
        },
      };

      const validator = createValidator([untrustedTool], {
        minTrustLevel: 'org',
      });

      const result = validator.validate('untrusted_run', {});

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.code === 'TRUST_BELOW_THRESHOLD')
      ).toBe(true);
    });

    test('should allow tools meeting trust threshold', () => {
      const trustedTool: AtipTool = {
        atip: { version: '0.4' },
        name: 'trusted',
        version: '1.0.0',
        description: 'Trusted',
        trust: {
          source: 'native',
        },
        commands: {
          run: {
            description: 'Run',
            effects: {},
          },
        },
      };

      const validator = createValidator([trustedTool], {
        minTrustLevel: 'org',
      });

      const result = validator.validate('trusted_run', {});

      expect(result.valid).toBe(true);
    });
  });

  describe('unknown commands', () => {
    test('should flag unknown commands', () => {
      const validator = createValidator([ghTool], {});

      const result = validator.validate('unknown_command', {});

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].code).toBe('UNKNOWN_COMMAND');
      expect(result.violations[0].severity).toBe('error');
      expect(result.violations[0].toolName).toBe('unknown_command');
    });
  });

  describe('multiple violations', () => {
    test('should return all violations, not just first', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
        allowNonReversible: false,
        allowNetwork: false,
      });

      const result = validator.validate('gh_repo_delete', {});

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
      expect(
        result.violations.some((v) => v.code === 'DESTRUCTIVE_OPERATION')
      ).toBe(true);
      expect(
        result.violations.some((v) => v.code === 'NON_REVERSIBLE_OPERATION')
      ).toBe(true);
      expect(
        result.violations.some((v) => v.code === 'NETWORK_OPERATION')
      ).toBe(true);
    });
  });

  describe('violation details', () => {
    test('should include commandPath in violations', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
      });

      const result = validator.validate('gh_repo_delete', {});

      const violation = result.violations.find(
        (v) => v.code === 'DESTRUCTIVE_OPERATION'
      );
      expect(violation?.commandPath).toEqual(['repo', 'delete']);
    });

    test('should include descriptive message in violations', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
      });

      const result = validator.validate('gh_repo_delete', {});

      const violation = result.violations[0];
      expect(violation.message).toBeTruthy();
      expect(violation.message.length).toBeGreaterThan(0);
    });
  });

  describe('default policy', () => {
    test('should allow everything by default', () => {
      const validator = createValidator([ghTool], {});

      const deleteResult = validator.validate('gh_repo_delete', {});
      expect(deleteResult.valid).toBe(true);

      const listResult = validator.validate('gh_repo_list', {});
      expect(listResult.valid).toBe(true);
    });
  });

  describe('severity levels', () => {
    test('should mark destructive/non-reversible as error severity', () => {
      const validator = createValidator([ghTool], {
        allowDestructive: false,
      });

      const result = validator.validate('gh_repo_delete', {});

      const violation = result.violations.find(
        (v) => v.code === 'DESTRUCTIVE_OPERATION'
      );
      expect(violation?.severity).toBe('error');
    });

    test('should mark network/filesystem as warning severity', () => {
      const validator = createValidator([ghTool], {
        allowNetwork: false,
      });

      const result = validator.validate('gh_repo_list', {});

      const violation = result.violations.find(
        (v) => v.code === 'NETWORK_OPERATION'
      );
      expect(violation?.severity).toBe('warning');
    });
  });
});
