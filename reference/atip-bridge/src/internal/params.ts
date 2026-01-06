import type { AtipArgument, AtipOption } from '../types/atip';
import type { OpenAIParameter, GeminiParameter, AnthropicParameter } from '../types/providers';
import { coerceType } from './types';

/**
 * Transform ATIP arguments and options to OpenAI parameters.
 */
export function transformToOpenAIParams(
  args?: AtipArgument[],
  opts?: AtipOption[],
  strict?: boolean
): {
  properties: Record<string, OpenAIParameter>;
  required: string[];
} {
  const properties: Record<string, OpenAIParameter> = {};
  const required: string[] = [];

  // Add arguments
  if (args) {
    for (const arg of args) {
      const coerced = coerceType(arg.type);
      const desc = arg.description + (coerced.descriptionSuffix || '');
      const isRequired = arg.required !== false; // Default: true

      if (strict && !isRequired) {
        // In strict mode, optional params become nullable
        properties[arg.name] = {
          type: [coerced.type, 'null'],
          description: desc,
          ...(arg.enum && { enum: arg.enum }),
        };
        required.push(arg.name);
      } else {
        properties[arg.name] = {
          type: coerced.type,
          description: desc,
          ...(arg.enum && { enum: arg.enum }),
        };
        if (isRequired) {
          required.push(arg.name);
        }
      }
    }
  }

  // Add options
  if (opts) {
    for (const opt of opts) {
      const coerced = coerceType(opt.type);
      const desc = opt.description + (coerced.descriptionSuffix || '');
      const isRequired = opt.required === true; // Default: false

      if (strict && !isRequired) {
        // In strict mode, optional params become nullable
        properties[opt.name] = {
          type: [coerced.type, 'null'],
          description: desc,
          ...(opt.enum && { enum: opt.enum }),
        };
        required.push(opt.name);
      } else {
        properties[opt.name] = {
          type: coerced.type,
          description: desc,
          ...(opt.enum && { enum: opt.enum }),
        };
        if (isRequired) {
          required.push(opt.name);
        }
      }
    }
  }

  return { properties, required };
}

/**
 * Transform ATIP arguments and options to Gemini parameters.
 */
export function transformToGeminiParams(
  args?: AtipArgument[],
  opts?: AtipOption[]
): {
  properties: Record<string, GeminiParameter>;
  required: string[];
} {
  const properties: Record<string, GeminiParameter> = {};
  const required: string[] = [];

  // Add arguments
  if (args) {
    for (const arg of args) {
      const coerced = coerceType(arg.type);
      const desc = arg.description + (coerced.descriptionSuffix || '');
      const isRequired = arg.required !== false; // Default: true

      properties[arg.name] = {
        type: coerced.type,
        description: desc,
        ...(arg.enum && { enum: arg.enum }),
      };

      if (isRequired) {
        required.push(arg.name);
      }
    }
  }

  // Add options
  if (opts) {
    for (const opt of opts) {
      const coerced = coerceType(opt.type);
      const desc = opt.description + (coerced.descriptionSuffix || '');
      const isRequired = opt.required === true; // Default: false

      properties[opt.name] = {
        type: coerced.type,
        description: desc,
        ...(opt.enum && { enum: opt.enum }),
      };

      if (isRequired) {
        required.push(opt.name);
      }
    }
  }

  return { properties, required };
}

/**
 * Transform ATIP arguments and options to Anthropic parameters.
 * Same as Gemini format.
 */
export function transformToAnthropicParams(
  args?: AtipArgument[],
  opts?: AtipOption[]
): {
  properties: Record<string, AnthropicParameter>;
  required: string[];
} {
  const properties: Record<string, AnthropicParameter> = {};
  const required: string[] = [];

  // Add arguments
  if (args) {
    for (const arg of args) {
      const coerced = coerceType(arg.type);
      const desc = arg.description + (coerced.descriptionSuffix || '');
      const isRequired = arg.required !== false; // Default: true

      properties[arg.name] = {
        type: coerced.type,
        description: desc,
        ...(arg.enum && { enum: arg.enum }),
      };

      if (isRequired) {
        required.push(arg.name);
      }
    }
  }

  // Add options
  if (opts) {
    for (const opt of opts) {
      const coerced = coerceType(opt.type);
      const desc = opt.description + (coerced.descriptionSuffix || '');
      const isRequired = opt.required === true; // Default: false

      properties[opt.name] = {
        type: coerced.type,
        description: desc,
        ...(opt.enum && { enum: opt.enum }),
      };

      if (isRequired) {
        required.push(opt.name);
      }
    }
  }

  return { properties, required };
}
