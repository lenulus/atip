/**
 * ATIP protocol version declaration.
 * Supports both legacy string format and current object format.
 */
export type AtipVersion =
  | string // Legacy: "0.3"
  | {
      version: string;
      features?: AtipFeature[];
      minAgentVersion?: string;
    };

export type AtipFeature =
  | 'partial-discovery'
  | 'interactive-effects'
  | 'trust-v1'
  | 'patterns-v1';

/**
 * Trust and provenance information for ATIP metadata.
 */
export interface AtipTrust {
  source: 'native' | 'vendor' | 'org' | 'community' | 'user' | 'inferred';
  verified?: boolean;
  checksum?: string;
  signedBy?: string;
  attestation?: string;
}

/**
 * Effects metadata describing tool side effects.
 * Per spec section 3.6.
 */
export interface AtipEffects {
  filesystem?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
    paths?: string[];
  };
  network?: boolean;
  subprocess?: boolean;
  idempotent?: boolean;
  reversible?: boolean;
  destructive?: boolean;
  creates?: string[];
  modifies?: string[];
  deletes?: string[];
  interactive?: {
    stdin?: 'none' | 'optional' | 'required' | 'password';
    prompts?: boolean;
    tty?: boolean;
  };
  cost?: {
    estimate?: 'free' | 'low' | 'medium' | 'high';
    billable?: boolean;
  };
  duration?: {
    typical?: string;
    timeout?: string;
  };
}

/**
 * ATIP parameter types per spec section 3.7.
 */
export type AtipParamType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'file'
  | 'directory'
  | 'url'
  | 'enum'
  | 'array';

/**
 * Command argument definition.
 */
export interface AtipArgument {
  name: string;
  type: AtipParamType;
  description: string;
  required?: boolean; // Default: true
  default?: unknown;
  variadic?: boolean; // Default: false
  enum?: (string | number)[];
}

/**
 * Command option definition.
 */
export interface AtipOption {
  name: string;
  flags: string[]; // e.g., ["-o", "--output"]
  type: AtipParamType;
  description: string;
  required?: boolean; // Default: false
  default?: unknown;
  enum?: (string | number)[];
  envVar?: string;
}

/**
 * Command definition with optional nested subcommands.
 */
export interface AtipCommand {
  description: string;
  arguments?: AtipArgument[];
  options?: AtipOption[];
  commands?: Record<string, AtipCommand>; // Nested subcommands
  effects?: AtipEffects;
  examples?: string[];
}

/**
 * Pattern definition for common workflows.
 */
export interface AtipPattern {
  name: string;
  description: string;
  steps: Array<{
    command: string;
    description?: string;
  }>;
  variables?: Record<
    string,
    {
      type: string;
      description: string;
    }
  >;
  tags?: string[];
  executable?: boolean;
}

/**
 * Root ATIP tool metadata.
 * Per spec section 3.2.
 */
export interface AtipTool {
  atip: AtipVersion;
  name: string;
  version: string;
  description: string;
  homepage?: string;
  trust?: AtipTrust;
  commands?: Record<string, AtipCommand>;
  globalOptions?: AtipOption[];
  authentication?: {
    required?: boolean;
    methods?: Array<{
      type: 'token' | 'oauth' | 'api-key' | 'password' | 'certificate';
      envVar?: string;
      description?: string;
      setupCommand?: string;
    }>;
    checkCommand?: string;
  };
  effects?: AtipEffects;
  patterns?: AtipPattern[];

  // Partial discovery fields
  partial?: boolean;
  filter?: {
    commands?: string[];
    depth?: number | null;
  };
  totalCommands?: number;
  includedCommands?: number;
  omitted?: {
    reason: 'filtered' | 'depth-limited' | 'size-limited' | 'deprecated';
    safetyAssumption: 'unknown' | 'known-safe' | 'known-unsafe' | 'same-as-included';
  };
}
