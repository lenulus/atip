# atip-validate

JSON Schema validator for ATIP metadata files.

## Installation

```bash
cd reference/atip-validate
npm install
```

## Usage

### Command Line

```bash
# Validate a single file
node src/cli.js ../../examples/gh.json

# Validate directory
node src/cli.js ../../examples/

# Recursive validation
node src/cli.js -r ../../shims/

# With custom schema
node src/cli.js --schema custom.json examples/gh.json

# JSON output
node src/cli.js --json examples/
```

### Programmatic

```javascript
import { AtipValidator } from 'atip-validate';

const validator = new AtipValidator();

// Validate single file
const result = validator.validateFile('examples/gh.json');

if (result.valid) {
  console.log('Valid!', result.data);
} else {
  console.error('Errors:', result.errors);
}

// Validate directory
const results = validator.validateDirectory('examples/', true);

// Validate data object
const metadata = { atip: "0.4", name: "mytool", ... };
const result = validator.validateData(metadata);
```

## Options

| Option | Description |
|--------|-------------|
| `-r, --recursive` | Recursively scan subdirectories |
| `-s, --schema <path>` | Use custom schema file |
| `-q, --quiet` | Only show errors |
| `-v, --verbose` | Show detailed info |
| `--json` | Output as JSON |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All files valid |
| 1 | Validation errors found |
| 2 | Invalid arguments or file not found |

## Example Output

```
✓ examples/minimal.json
✗ examples/invalid.json
  /commands/deploy Missing required field: description
  /effects/cost/estimate Invalid value. Allowed: free, low, medium, high

Summary:
  Total files:   2
  Valid:         1
  Invalid:       1
```

## API

### `AtipValidator`

#### Constructor

```javascript
new AtipValidator(schemaPath?: string)
```

#### Methods

- `validateFile(filePath: string): ValidationResult`
- `validateData(data: object, source?: string): ValidationResult`
- `validateFiles(filePaths: string[]): ValidationResult[]`
- `validateDirectory(dirPath: string, recursive?: boolean): ValidationResult[]`

### `ValidationResult`

```typescript
{
  valid: boolean;
  file: string;
  data?: object;        // If valid
  errors?: Error[];     // If invalid
}
```

### Error Types

- `schema-error` - Validation against schema failed
- `parse-error` - Invalid JSON syntax
- `file-error` - File read error

## Development

```bash
# Run tests (once implemented)
npm test

# Validate examples
npm run validate ../../examples/
```
