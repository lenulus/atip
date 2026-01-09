/**
 * Main executor for orchestrating tool call execution
 */

import { mapToCommand, type CommandMapping } from './mapping.js';
import { validateToolCall, type ValidationResult } from './validation.js';
import { buildCommandArray } from './command-builder.js';
import { executeCommand, type ExecutionOptions } from './execution.js';
import { formatResult, type OutputOptions, type FormattedResult } from './formatting.js';
import { checkPolicy, type ExecutionPolicy, type PolicyCheckResult, type ConfirmationContext } from './policy.js';
import {
  UnknownCommandError,
  ArgumentValidationError,
  PolicyViolationError,
  RequiresConfirmationError,
  InsufficientTrustError,
  InteractiveNotSupportedError,
} from './errors.js';
import { TRUST_LEVEL_ORDER } from './constants.js';

/**
 * Create a formatted error result from an exception.
 * Helper to avoid duplicating error result structure in batch execution.
 */
function createErrorResult(toolCall: any, error: any): FormattedResult {
  return {
    content: `Error: ${error.message}`,
    success: false,
    raw: {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: error.message,
      duration: 0,
      truncated: false,
      timedOut: false,
      command: [],
      toolCallId: toolCall.id,
      toolName: toolCall.name,
    },
  };
}

/**
 * Check if trust level meets minimum requirement.
 * Returns true if trust level is sufficient or no minimum is required.
 */
function checkTrustLevel(
  trust: any | undefined,
  minTrustLevel: string | undefined
): boolean {
  if (!minTrustLevel || !trust) {
    return true;
  }

  const actualLevel = TRUST_LEVEL_ORDER[trust.source] || 0;
  const requiredLevel = TRUST_LEVEL_ORDER[minTrustLevel] || 0;

  return actualLevel >= requiredLevel;
}

/**
 * Configuration for creating an executor instance.
 */
export interface ExecutorConfig {
  /** Array of ATIP tool metadata */
  tools: any[];
  /** Optional policy constraints */
  policy?: ExecutionPolicy;
  /** Optional execution options (applied to all executions) */
  execution?: ExecutionOptions;
  /** Optional output formatting options */
  output?: OutputOptions;
}

/**
 * Options for batch execution.
 */
export interface BatchOptions {
  /** Execute tools in parallel (default: false) */
  parallel?: boolean;
  /** Continue executing remaining tools if one fails (default: true) */
  continueOnError?: boolean;
  /** Maximum concurrent executions in parallel mode (default: 4) */
  maxConcurrency?: number;
}

/**
 * Result of batch execution.
 */
export interface BatchExecutionResult {
  /** Array of formatted results (one per tool call) */
  results: FormattedResult[];
  /** Total duration of batch execution in milliseconds */
  totalDuration: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
}

/**
 * Executor instance for safe tool execution.
 */
export interface Executor {
  /** Execute a single tool call */
  execute(toolCall: any): Promise<FormattedResult>;
  /** Execute multiple tool calls */
  executeBatch(toolCalls: any[], options?: BatchOptions): Promise<BatchExecutionResult>;
  /** Validate tool call arguments without executing */
  validate(toolCall: any): ValidationResult;
  /** Map a tool name to its command mapping */
  mapCommand(toolName: string): CommandMapping | undefined;
  /** Check if a tool call is allowed by policy */
  checkPolicy(toolCall: any): PolicyCheckResult;
  /** Get metadata for a tool */
  getMetadata(toolName: string): any | undefined;
}

/**
 * Create an executor instance configured for safe tool execution.
 */
export function createExecutor(config: ExecutorConfig): Executor {
  const tools = config.tools;
  const policy = config.policy || {};
  const executionOptions = config.execution || {};
  const outputOptions = config.output || {};

  return {
    async execute(toolCall: any): Promise<FormattedResult> {
      // 1. Map tool name to command
      const mapping = mapToCommand(toolCall.name, tools);
      if (!mapping) {
        throw new UnknownCommandError(toolCall.name);
      }

      // 2. Validate arguments
      const validation = validateToolCall(toolCall, mapping);
      if (!validation.valid) {
        throw new ArgumentValidationError(
          `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
          toolCall.name,
          validation.errors
        );
      }

      // 3. Check policy
      const policyCheck = checkPolicy(toolCall, mapping, policy);

      // Handle interactive commands
      if (mapping.effects.interactive && policy.allowInteractive === false) {
        throw new InteractiveNotSupportedError(toolCall.name, mapping.effects.interactive);
      }

      // Handle trust level
      if (!checkTrustLevel(mapping.tool.trust, policy.minTrustLevel)) {
        throw new InsufficientTrustError(
          toolCall.name,
          mapping.tool.trust.source,
          policy.minTrustLevel!
        );
      }

      // Handle policy violations - check if there are hard blocking violations first
      const hasHardBlockingViolations = policyCheck.violations.some(
        (v) =>
          v.severity === 'error' &&
          v.code !== 'DESTRUCTIVE_BLOCKED' &&
          v.code !== 'NON_REVERSIBLE_BLOCKED' &&
          v.code !== 'BILLABLE_BLOCKED' &&
          v.code !== 'FILESYSTEM_DELETE_BLOCKED' &&
          v.code !== 'TRUST_INSUFFICIENT' &&
          v.code !== 'COST_EXCEEDED'
      );

      if (hasHardBlockingViolations) {
        throw new PolicyViolationError(
          `Policy violation: ${policyCheck.violations.map((v) => v.message).join(', ')}`,
          toolCall.name,
          policyCheck.violations
        );
      }

      // Handle confirmation for soft violations
      if (policyCheck.requiresConfirmation) {
        if (!policy.confirmationHandler) {
          const context: ConfirmationContext = {
            toolName: toolCall.name,
            command: mapping.command,
            arguments: toolCall.arguments || {},
            reasons: policyCheck.reasons,
            effects: mapping.effects,
            trust: mapping.tool.trust,
          };
          throw new RequiresConfirmationError(context);
        }

        // Call confirmation handler
        const context: ConfirmationContext = {
          toolName: toolCall.name,
          command: mapping.command,
          arguments: toolCall.arguments || {},
          reasons: policyCheck.reasons,
          effects: mapping.effects,
          trust: mapping.tool.trust,
        };

        const confirmed = await policy.confirmationHandler(context);
        if (!confirmed) {
          throw new RequiresConfirmationError(context);
        }
      }

      // 4. Build command array
      const commandArray = buildCommandArray(mapping, validation.normalizedArgs || {});

      // 5. Execute command
      const result = await executeCommand(commandArray, executionOptions);

      // Set metadata
      result.toolCallId = toolCall.id;
      result.toolName = toolCall.name;

      // 6. Format result
      return formatResult(result, outputOptions);
    },

    async executeBatch(toolCalls: any[], options?: BatchOptions): Promise<BatchExecutionResult> {
      const parallel = options?.parallel ?? false;
      const continueOnError = options?.continueOnError ?? true;
      const maxConcurrency = options?.maxConcurrency ?? 4;

      const results: FormattedResult[] = [];
      const startTime = Date.now();

      if (parallel) {
        // Parallel execution (limited concurrency)
        const chunks: any[][] = [];
        for (let i = 0; i < toolCalls.length; i += maxConcurrency) {
          chunks.push(toolCalls.slice(i, i + maxConcurrency));
        }

        for (const chunk of chunks) {
          const promises = chunk.map(async (toolCall) => {
            try {
              return await this.execute(toolCall);
            } catch (error: any) {
              if (!continueOnError) {
                throw error;
              }
              return createErrorResult(toolCall, error);
            }
          });

          const chunkResults = await Promise.all(promises);
          results.push(...chunkResults);
        }
      } else {
        // Sequential execution
        for (const toolCall of toolCalls) {
          try {
            const result = await this.execute(toolCall);
            results.push(result);
          } catch (error: any) {
            results.push(createErrorResult(toolCall, error));

            // Stop if continueOnError is false
            if (!continueOnError) {
              break;
            }
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      return {
        results,
        totalDuration,
        successCount,
        failureCount,
      };
    },

    validate(toolCall: any): ValidationResult {
      const mapping = mapToCommand(toolCall.name, tools);
      if (!mapping) {
        return {
          valid: false,
          errors: [
            {
              code: 'UNKNOWN_COMMAND',
              message: `Unknown command: ${toolCall.name}`,
            },
          ],
          warnings: [],
        };
      }

      return validateToolCall(toolCall, mapping);
    },

    mapCommand(toolName: string): CommandMapping | undefined {
      return mapToCommand(toolName, tools);
    },

    checkPolicy(toolCall: any): PolicyCheckResult {
      const mapping = mapToCommand(toolCall.name, tools);
      if (!mapping) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reasons: [],
          violations: [
            {
              code: 'TRUST_INSUFFICIENT',
              message: `Unknown command: ${toolCall.name}`,
              severity: 'error',
            },
          ],
        };
      }

      return checkPolicy(toolCall, mapping, policy);
    },

    getMetadata(toolName: string): any | undefined {
      const mapping = mapToCommand(toolName, tools);
      return mapping?.metadata;
    },
  };
}
