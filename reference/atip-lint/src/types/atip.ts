/**
 * ATIP metadata type definitions.
 * These types represent the structure of ATIP tool metadata.
 */

export interface AtipMetadata {
  atip: AtipVersion;
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  trust?: AtipTrust;
  commands?: Record<string, AtipCommand>;
  arguments?: AtipArgument[];
  globalOptions?: AtipOption[];
  patterns?: Record<string, AtipPattern>;
  effects?: AtipEffects;
}

export type AtipVersion = string | { version: string; features?: string[] };

export interface AtipCommand {
  description: string;
  commands?: Record<string, AtipCommand>;
  arguments?: AtipArgument[];
  options?: AtipOption[];
  effects?: AtipEffects;
  examples?: string[];
}

export interface AtipArgument {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  variadic?: boolean;
  default?: unknown;
}

export interface AtipOption {
  name: string;
  flags: string[];
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

export interface AtipEffects {
  destructive?: boolean;
  reversible?: boolean;
  idempotent?: boolean;
  network?: boolean;
  subprocess?: boolean;
  filesystem?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  cost?: {
    billable?: boolean;
    estimate?: 'free' | 'low' | 'medium' | 'high';
  };
  interactive?: {
    stdin?: 'none' | 'optional' | 'required' | 'password';
    prompts?: boolean;
    tty?: boolean;
  };
  duration?: {
    typical?: string;
    timeout?: string;
  };
}

export interface AtipTrust {
  source: 'native' | 'vendor' | 'community' | 'inferred';
  verified?: boolean;
  author?: string;
  homepage?: string;
}

export interface AtipPattern {
  description?: string;
  pattern: string;
  flags?: string[];
}
