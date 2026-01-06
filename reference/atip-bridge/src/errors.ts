import type { Provider } from './types/providers';

/**
 * Error thrown when ATIP metadata fails validation.
 */
export class AtipValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string[],
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'AtipValidationError';
  }
}

/**
 * Error thrown when parsing provider responses fails.
 */
export class AtipParseError extends Error {
  constructor(
    message: string,
    public readonly provider: Provider,
    public readonly response: unknown
  ) {
    super(message);
    this.name = 'AtipParseError';
  }
}
