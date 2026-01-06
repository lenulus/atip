import type { AtipTool } from '../types/atip';
import { AtipValidationError } from '../errors';

/**
 * Validate that ATIP tool metadata has required fields.
 */
export function validateAtipTool(tool: AtipTool): void {
  if (!tool.name) {
    throw new AtipValidationError("Missing required field 'name'", ['name'], tool.name);
  }

  if (!tool.version) {
    throw new AtipValidationError("Missing required field 'version'", ['version'], tool.version);
  }

  if (!tool.description) {
    throw new AtipValidationError(
      "Missing required field 'description'",
      ['description'],
      tool.description
    );
  }

  if (!tool.atip) {
    throw new AtipValidationError("Missing required field 'atip'", ['atip'], tool.atip);
  }
}
