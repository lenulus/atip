/**
 * Error classes for atip-discover
 */

/**
 * Base error for all atip-discover errors.
 */
export class DiscoverError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DiscoverError';
    Object.setPrototypeOf(this, DiscoverError.prototype);
  }
}

/**
 * Error during registry operations.
 */
export class RegistryError extends DiscoverError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: Error
  ) {
    super(message, 'REGISTRY_ERROR');
    this.name = 'RegistryError';
    Object.setPrototypeOf(this, RegistryError.prototype);
  }
}

/**
 * Error when tool is not found in registry.
 */
export class ToolNotFoundError extends DiscoverError {
  constructor(public readonly toolName: string) {
    super(`Tool not found: ${toolName}`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
    Object.setPrototypeOf(this, ToolNotFoundError.prototype);
  }
}

/**
 * Error when cached metadata is not found.
 */
export class MetadataNotFoundError extends DiscoverError {
  constructor(
    public readonly toolName: string,
    public readonly expectedPath: string
  ) {
    super(
      `Metadata not found for tool ${toolName} at ${expectedPath}`,
      'METADATA_NOT_FOUND'
    );
    this.name = 'MetadataNotFoundError';
    Object.setPrototypeOf(this, MetadataNotFoundError.prototype);
  }
}

/**
 * Error during tool probing.
 */
export class ProbeError extends DiscoverError {
  constructor(
    message: string,
    public readonly executablePath: string,
    public readonly cause?: Error
  ) {
    super(message, 'PROBE_ERROR');
    this.name = 'ProbeError';
    Object.setPrototypeOf(this, ProbeError.prototype);
  }
}

/**
 * Error when probe times out.
 */
export class ProbeTimeoutError extends ProbeError {
  constructor(
    public readonly executablePath: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Probe timeout after ${timeoutMs}ms: ${executablePath}`,
      executablePath
    );
    this.name = 'ProbeTimeoutError';
    Object.setPrototypeOf(this, ProbeTimeoutError.prototype);
  }
}

/**
 * Error when configuration is invalid.
 */
export class ConfigError extends DiscoverError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}
