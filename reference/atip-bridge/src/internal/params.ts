import type { AtipArgument, AtipOption } from '../types/atip';
import type { OpenAIParameter, GeminiParameter, AnthropicParameter } from '../types/providers';
import { coerceType } from './types';

/**
 * Common parameter type that can represent any provider's parameter format.
 */
type ProviderParameter = OpenAIParameter | GeminiParameter | AnthropicParameter;

/**
 * Transform a single argument or option into a provider parameter.
 * This is the core logic shared by all provider transformations.
 */
function transformParameter(
  param: AtipArgument | AtipOption,
  isArgument: boolean,
  strict: boolean
): {
  property: ProviderParameter;
  isRequired: boolean;
} {
  const coerced = coerceType(param.type);
  const desc = param.description + (coerced.descriptionSuffix || '');

  // Determine if parameter is required
  // Arguments default to required (true), options default to optional (false)
  const isRequired = isArgument ? param.required !== false : param.required === true;

  // Build base property
  let property: ProviderParameter;

  if (strict && !isRequired) {
    // In strict mode, optional params become nullable
    property = {
      type: [coerced.type, 'null'],
      description: desc,
      ...(param.enum && { enum: param.enum }),
    };
  } else {
    property = {
      type: coerced.type,
      description: desc,
      ...(param.enum && { enum: param.enum }),
    };
  }

  return { property, isRequired: strict ? true : isRequired };
}

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
  const strictMode = strict || false;

  // Add arguments
  if (args) {
    for (const arg of args) {
      const { property, isRequired } = transformParameter(arg, true, strictMode);
      properties[arg.name] = property as OpenAIParameter;
      if (isRequired) {
        required.push(arg.name);
      }
    }
  }

  // Add options
  if (opts) {
    for (const opt of opts) {
      const { property, isRequired } = transformParameter(opt, false, strictMode);
      properties[opt.name] = property as OpenAIParameter;
      if (isRequired) {
        required.push(opt.name);
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
      const { property, isRequired } = transformParameter(arg, true, false);
      properties[arg.name] = property as GeminiParameter;
      if (isRequired) {
        required.push(arg.name);
      }
    }
  }

  // Add options
  if (opts) {
    for (const opt of opts) {
      const { property, isRequired } = transformParameter(opt, false, false);
      properties[opt.name] = property as GeminiParameter;
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
      const { property, isRequired } = transformParameter(arg, true, false);
      properties[arg.name] = property as AnthropicParameter;
      if (isRequired) {
        required.push(arg.name);
      }
    }
  }

  // Add options
  if (opts) {
    for (const opt of opts) {
      const { property, isRequired } = transformParameter(opt, false, false);
      properties[opt.name] = property as AnthropicParameter;
      if (isRequired) {
        required.push(opt.name);
      }
    }
  }

  return { properties, required };
}
