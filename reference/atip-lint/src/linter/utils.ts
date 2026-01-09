import type { LintMessage, LintResult } from './types.js';

/**
 * Calculate counts for lint messages.
 * Extracts the logic for counting errors, warnings, and fixable issues.
 */
export function calculateMessageCounts(messages: LintMessage[]): {
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
} {
  let errorCount = 0;
  let warningCount = 0;
  let fixableErrorCount = 0;
  let fixableWarningCount = 0;

  for (const message of messages) {
    if (message.severity === 2) {
      errorCount++;
      if (message.fix) {
        fixableErrorCount++;
      }
    } else if (message.severity === 1) {
      warningCount++;
      if (message.fix) {
        fixableWarningCount++;
      }
    }
  }

  return {
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
  };
}

/**
 * Filter messages based on quiet mode.
 * In quiet mode, only errors are shown.
 */
export function filterMessages(messages: LintMessage[], quiet: boolean): LintMessage[] {
  return quiet ? messages.filter((m) => m.severity === 2) : messages;
}
