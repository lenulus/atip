# Usage Examples: atip-lint

## Basic Usage

### Example 1: Lint a Single File

```bash
atip-lint examples/gh.json
```

**Expected Output** (stylish format):
```
/path/to/examples/gh.json
  12:5   warning  Command 'pr.merge' should declare 'reversible' when destructive  destructive-needs-reversible
  45:3   warning  Description is too short (5 characters, minimum 10)              description-quality

2 problems (0 errors, 2 warnings)
```

**Explanation**: The default command is `lint`. Two warnings are found: a command that's destructive but doesn't declare reversibility, and a short description.

---

### Example 2: Lint Multiple Files with Glob

```bash
atip-lint "examples/*.json" "shims/*.json"
```

**Expected Output**:
```
/path/to/examples/minimal.json
  (no issues)

/path/to/examples/gh.json
  12:5   warning  Command 'pr.merge' should declare 'reversible' when destructive  destructive-needs-reversible

/path/to/shims/curl.json
  3:17   warning  Description is too short (8 characters, minimum 10)              description-quality
  15:5   error    Missing required field 'type' in argument                        no-missing-required-fields

3 problems (1 error, 2 warnings)
```

**Explanation**: Multiple patterns can be provided. Errors and warnings are aggregated across all files.

---

### Example 3: Lint with JSON Output

```bash
atip-lint examples/gh.json --output json
```

**Expected Output**:
```json
{
  "results": [
    {
      "filePath": "/path/to/examples/gh.json",
      "messages": [
        {
          "ruleId": "destructive-needs-reversible",
          "severity": 1,
          "message": "Command 'pr.merge' should declare 'reversible' when destructive",
          "line": 12,
          "column": 5,
          "nodeType": "effects",
          "jsonPath": ["commands", "pr", "commands", "merge", "effects"]
        }
      ],
      "errorCount": 0,
      "warningCount": 1,
      "fixableErrorCount": 0,
      "fixableWarningCount": 1
    }
  ],
  "errorCount": 0,
  "warningCount": 1
}
```

**Explanation**: JSON output is machine-readable and includes full path information.

---

### Example 4: Lint with Errors Only

```bash
atip-lint examples/*.json --quiet
```

**Expected Output**:
```
/path/to/shims/curl.json
  15:5   error    Missing required field 'type' in argument  no-missing-required-fields

1 problem (1 error, 0 warnings)
```

**Explanation**: `--quiet` suppresses warnings, showing only errors. Useful for CI when warnings shouldn't block.

---

### Example 5: Auto-fix Issues

```bash
atip-lint examples/gh.json --fix
```

**Expected Output**:
```
/path/to/examples/gh.json
  12:5   warning  Command 'pr.merge' should declare 'reversible' when destructive  destructive-needs-reversible (fixed)

1 problem (0 errors, 1 warning)
1 fix applied
```

**File Before**:
```json
{
  "commands": {
    "pr": {
      "commands": {
        "merge": {
          "description": "Merge a pull request",
          "effects": {
            "destructive": true
          }
        }
      }
    }
  }
}
```

**File After**:
```json
{
  "commands": {
    "pr": {
      "commands": {
        "merge": {
          "description": "Merge a pull request",
          "effects": {
            "destructive": true,
            "reversible": false
          }
        }
      }
    }
  }
}
```

**Explanation**: The `--fix` flag automatically adds `reversible: false` since the command is destructive.

---

### Example 6: Dry Run Fixes

```bash
atip-lint examples/gh.json --fix-dry-run
```

**Expected Output**:
```
/path/to/examples/gh.json
  12:5   warning  Command 'pr.merge' should declare 'reversible' when destructive  destructive-needs-reversible

Would fix:
  Line 12: Add "reversible": false

1 problem (0 errors, 1 warning)
1 fix would be applied (dry run)
```

**Explanation**: Shows what would be fixed without modifying the file.

---

## Configuration

### Example 7: Initialize Configuration

```bash
atip-lint init --preset recommended
```

**Expected Output**:
```
Created .atiplintrc.json with 'recommended' preset

Configuration includes:
  - no-empty-effects: warn
  - description-quality: warn
  - consistent-naming: warn
  - destructive-needs-reversible: warn
  - (and more...)

Run 'atip-lint .' to lint your ATIP files.
```

**Generated `.atiplintrc.json`**:
```json
{
  "extends": "recommended",
  "rules": {}
}
```

---

### Example 8: Custom Configuration

**`.atiplintrc.json`**:
```json
{
  "extends": "recommended",
  "rules": {
    "description-quality": ["error", {
      "minLength": 20,
      "requireEndingPunctuation": true
    }],
    "no-empty-effects": ["error", {
      "minFields": 2,
      "requiredFields": ["network", "idempotent"]
    }],
    "consistent-naming": ["warn", {
      "commandCase": "camelCase"
    }]
  },
  "ignorePatterns": [
    "**/test-fixtures/**"
  ]
}
```

```bash
atip-lint examples/*.json
```

**Expected Output**:
```
/path/to/examples/gh.json
  5:17   error    Description should end with punctuation                     description-quality
  12:5   error    Effects block should have at least 2 fields                 no-empty-effects
  18:5   error    Effects missing required field 'idempotent'                 no-empty-effects
  25:5   warning  Command name 'list-items' should be camelCase              consistent-naming

4 problems (3 errors, 1 warning)
```

**Explanation**: Custom configuration overrides preset defaults. Description quality is now an error with stricter requirements.

---

### Example 9: Override Rules via CLI

```bash
atip-lint examples/*.json --rule "no-empty-effects:error" --disable-rule "description-quality"
```

**Expected Output**:
```
/path/to/examples/gh.json
  12:5   error    Command 'delete' has no effects declared  no-empty-effects

1 problem (1 error, 0 warnings)
```

**Explanation**: CLI flags override config file. `no-empty-effects` is elevated to error, `description-quality` is disabled.

---

### Example 10: File-Specific Overrides

**`.atiplintrc.json`**:
```json
{
  "extends": "strict",
  "overrides": [
    {
      "files": ["shims/**/*.json"],
      "rules": {
        "description-quality": ["warn", { "minLength": 5 }],
        "trust-source-requirements": "off"
      }
    },
    {
      "files": ["examples/minimal.json"],
      "rules": {
        "no-empty-effects": "off"
      }
    }
  ]
}
```

**Explanation**: Different rules apply to different files. Shims get relaxed description requirements; minimal example skips effects check.

---

## CI/CD Integration

### Example 11: GitHub Actions Workflow

**`.github/workflows/lint.yml`**:
```yaml
name: ATIP Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install atip-lint
        run: npm install -g atip-lint

      - name: Lint ATIP files
        run: atip-lint "examples/*.json" "shims/*.json" --output sarif > results.sarif

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

**Expected Behavior**: Lint errors appear as annotations on pull requests.

---

### Example 12: SARIF Output for Code Scanning

```bash
atip-lint examples/*.json --output sarif
```

**Expected Output**:
```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "atip-lint",
          "version": "0.1.0",
          "informationUri": "https://github.com/atip-dev/atip",
          "rules": [
            {
              "id": "no-empty-effects",
              "name": "no-empty-effects",
              "shortDescription": {
                "text": "Commands should declare effects metadata"
              },
              "defaultConfiguration": {
                "level": "warning"
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "no-empty-effects",
          "level": "warning",
          "message": {
            "text": "Command 'delete' has no effects declared"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "examples/gh.json"
                },
                "region": {
                  "startLine": 12,
                  "startColumn": 5
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Example 13: Exit Codes for CI

```bash
atip-lint examples/*.json --max-warnings 0
echo "Exit code: $?"
```

**Scenario 1**: No issues
```
Exit code: 0
```

**Scenario 2**: Warnings only (without --max-warnings 0)
```
2 problems (0 errors, 2 warnings)
Exit code: 0
```

**Scenario 3**: Warnings with --max-warnings 0
```
2 problems (0 errors, 2 warnings)

ATIP Lint found too many warnings (2). Maximum allowed: 0
Exit code: 1
```

**Scenario 4**: Errors present
```
3 problems (1 error, 2 warnings)
Exit code: 1
```

---

## Executable Validation

### Example 14: Check Tool Binary Exists

```bash
atip-lint examples/gh.json --executable-check
```

**Expected Output** (if gh is installed):
```
/path/to/examples/gh.json
  Checking binary: gh
    Found at: /usr/local/bin/gh
    --agent flag: works
    Version match: yes (2.45.0)

0 problems (0 errors, 0 warnings)
```

**Expected Output** (if gh is not installed):
```
/path/to/examples/gh.json
  1:1   warning  Binary 'gh' not found in PATH  binary-exists

1 problem (0 errors, 1 warning)
```

---

### Example 15: Verify --agent Output

```bash
atip-lint examples/gh.json --executable-check --verbose
```

**Expected Output**:
```
Checking /path/to/examples/gh.json

Binary check:
  Tool name: gh
  Expected path: (from PATH)
  Found at: /usr/local/bin/gh

Agent flag check:
  Running: /usr/local/bin/gh --agent
  Exit code: 0
  Output size: 4521 bytes
  Valid JSON: yes
  Schema valid: yes

Metadata verification:
  File name: gh
  Binary name: gh (match)
  File version: 2.45.0
  Binary version: 2.45.0 (match)

/path/to/examples/gh.json
  (no issues)

0 problems (0 errors, 0 warnings)
```

---

## Programmatic API

### Example 16: Basic Library Usage

```typescript
import { createLinter } from 'atip-lint';

const linter = createLinter({
  extends: 'recommended',
  rules: {
    'no-empty-effects': 'error',
  },
});

const results = await linter.lintFiles(['examples/*.json']);

console.log(`Total errors: ${results.errorCount}`);
console.log(`Total warnings: ${results.warningCount}`);

for (const result of results.results) {
  console.log(`\n${result.filePath}:`);
  for (const msg of result.messages) {
    console.log(`  ${msg.line}:${msg.column} ${msg.severity === 2 ? 'error' : 'warning'} ${msg.message}`);
  }
}
```

**Expected Output**:
```
Total errors: 1
Total warnings: 2

/path/to/examples/gh.json:
  12:5 error Command 'delete' has no effects declared
  45:3 warning Description is too short
  62:5 warning Command 'pr.merge' should declare 'reversible' when destructive
```

---

### Example 17: Lint a String

```typescript
import { createLinter } from 'atip-lint';

const linter = createLinter();

const atipJson = `{
  "atip": { "version": "0.6" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test",
  "commands": {
    "delete": {
      "description": "Delete something",
      "effects": {
        "destructive": true
      }
    }
  }
}`;

const result = await linter.lintText(atipJson, 'test.json');

console.log('Messages:', result.messages);
```

**Expected Output**:
```typescript
Messages: [
  {
    ruleId: 'destructive-needs-reversible',
    severity: 1,
    message: "Command 'delete' should declare 'reversible' when destructive",
    line: 10,
    column: 7,
    nodeType: 'effects',
    jsonPath: ['commands', 'delete', 'effects'],
    fix: {
      range: [185, 185],
      text: ',\n        "reversible": false'
    }
  }
]
```

---

### Example 18: Apply Fixes Programmatically

```typescript
import { createLinter } from 'atip-lint';
import * as fs from 'fs/promises';

const linter = createLinter();

const result = await linter.lintFile('examples/gh.json', { fix: true });

if (result.output && result.output !== result.source) {
  await fs.writeFile('examples/gh.json', result.output);
  console.log(`Applied ${result.fixableErrorCount + result.fixableWarningCount} fixes`);
}
```

---

### Example 19: Get Config for File

```typescript
import { createLinter, loadConfig } from 'atip-lint';

// Load config starting from a directory
const config = await loadConfig('/project/examples');
console.log('Rules:', config.rules);

// Or get effective config for a specific file
const linter = createLinter();
const fileConfig = await linter.getConfigForFile('/project/examples/gh.json');
console.log('File-specific rules:', fileConfig.rules);
```

---

## Custom Rules

### Example 20: Define a Custom Rule

```typescript
import { defineRule, createLinter } from 'atip-lint';

// Define a rule that checks for company-specific requirements
const requireHomepage = defineRule({
  meta: {
    category: 'quality',
    description: 'All tools must have a homepage URL',
    fixable: false,
    defaultSeverity: 'error',
  },
  create(context) {
    return {
      AtipMetadata(node) {
        if (!node.homepage) {
          context.report({
            message: 'Tool must have a homepage URL',
            path: [],
          });
        }
      },
    };
  },
});

// Use the custom rule
const linter = createLinter({
  rules: {
    'custom/require-homepage': 'error',
  },
  plugins: [
    {
      rules: {
        'require-homepage': requireHomepage,
      },
    },
  ],
});

const results = await linter.lintFiles(['examples/*.json']);
```

---

### Example 21: Custom Rule with Options

```typescript
import { defineRule } from 'atip-lint';

const maxCommandDepth = defineRule({
  meta: {
    category: 'consistency',
    description: 'Limit command nesting depth',
    fixable: false,
    defaultSeverity: 'warn',
    schema: {
      type: 'object',
      properties: {
        maxDepth: { type: 'number', default: 3 },
      },
    },
  },
  create(context) {
    const maxDepth = (context.options.maxDepth as number) || 3;

    function checkDepth(commands: Record<string, any>, path: string[], depth: number) {
      if (depth > maxDepth) {
        context.report({
          message: `Command nesting exceeds maximum depth of ${maxDepth}`,
          path,
        });
        return;
      }

      for (const [name, command] of Object.entries(commands)) {
        if (command.commands) {
          checkDepth(command.commands, [...path, name, 'commands'], depth + 1);
        }
      }
    }

    return {
      AtipMetadata(node) {
        if (node.commands) {
          checkDepth(node.commands, ['commands'], 1);
        }
      },
    };
  },
});
```

**Usage**:
```json
{
  "rules": {
    "custom/max-command-depth": ["error", { "maxDepth": 2 }]
  }
}
```

---

### Example 22: Custom Rule with Fixer

```typescript
import { defineRule } from 'atip-lint';

const trimDescriptions = defineRule({
  meta: {
    category: 'quality',
    description: 'Descriptions should not have leading/trailing whitespace',
    fixable: true,
    defaultSeverity: 'warn',
  },
  create(context) {
    function checkDescription(description: string, path: string[]) {
      if (description !== description.trim()) {
        context.report({
          message: 'Description has leading or trailing whitespace',
          path,
          fix: (fixer) => fixer.replaceAt(path, description.trim()),
        });
      }
    }

    return {
      AtipMetadata(node) {
        if (node.description) {
          checkDescription(node.description, ['description']);
        }
      },
      Command(node, path) {
        if (node.description) {
          checkDescription(node.description, [...path, 'description']);
        }
      },
    };
  },
});
```

---

## Output Formatters

### Example 23: Compact Format (grep-friendly)

```bash
atip-lint examples/*.json --output compact
```

**Expected Output**:
```
/path/to/examples/gh.json:12:5: warning: Command 'pr.merge' should declare 'reversible' when destructive (destructive-needs-reversible)
/path/to/examples/gh.json:45:3: warning: Description is too short (description-quality)
/path/to/shims/curl.json:15:5: error: Missing required field 'type' in argument (no-missing-required-fields)
```

**Explanation**: One line per issue, easy to grep or pipe to other tools.

---

### Example 24: Custom Formatter

```typescript
import { createLinter, type Formatter, type LintResults } from 'atip-lint';

const markdownFormatter: Formatter = (results: LintResults, context) => {
  const lines: string[] = ['# ATIP Lint Report', ''];

  for (const result of results.results) {
    if (result.messages.length === 0) continue;

    lines.push(`## ${result.filePath}`, '');
    lines.push('| Line | Severity | Message | Rule |');
    lines.push('|------|----------|---------|------|');

    for (const msg of result.messages) {
      const severity = msg.severity === 2 ? 'Error' : 'Warning';
      lines.push(`| ${msg.line} | ${severity} | ${msg.message} | ${msg.ruleId} |`);
    }

    lines.push('');
  }

  lines.push(`**Total: ${results.errorCount} errors, ${results.warningCount} warnings**`);
  return lines.join('\n');
};

const linter = createLinter();
const results = await linter.lintFiles(['examples/*.json']);
console.log(markdownFormatter(results, { cwd: process.cwd(), color: false, config: {} }));
```

**Expected Output**:
```markdown
# ATIP Lint Report

## /path/to/examples/gh.json

| Line | Severity | Message | Rule |
|------|----------|---------|------|
| 12 | Warning | Command 'pr.merge' should declare 'reversible' when destructive | destructive-needs-reversible |
| 45 | Warning | Description is too short | description-quality |

**Total: 0 errors, 2 warnings**
```

---

## Plugin System

### Example 25: Local Plugin File

**`atip-lint-rules.js`**:
```javascript
module.exports = {
  rules: {
    'no-emoji-in-description': {
      meta: {
        category: 'consistency',
        description: 'Descriptions should not contain emoji',
        fixable: false,
        defaultSeverity: 'warn',
      },
      create(context) {
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u;

        return {
          AtipMetadata(node) {
            if (emojiRegex.test(node.description)) {
              context.report({
                message: 'Description contains emoji',
                path: ['description'],
              });
            }
          },
        };
      },
    },
  },
};
```

**`.atiplintrc.json`**:
```json
{
  "extends": "recommended",
  "plugins": ["./atip-lint-rules.js"],
  "rules": {
    "local/no-emoji-in-description": "error"
  }
}
```

---

### Example 26: NPM Plugin

**Install**:
```bash
npm install --save-dev atip-lint-plugin-company
```

**`.atiplintrc.json`**:
```json
{
  "extends": "recommended",
  "plugins": ["atip-lint-plugin-company"],
  "rules": {
    "company/require-cost-center": "error",
    "company/approved-tools-only": "warn"
  }
}
```

---

## Dogfooding

### Example 27: atip-lint's Own ATIP Metadata

```bash
atip-lint --agent
```

**Expected Output**:
```json
{
  "atip": { "version": "0.6" },
  "name": "atip-lint",
  "version": "0.1.0",
  "description": "Lint ATIP metadata for quality issues beyond schema validation",
  "homepage": "https://github.com/atip-dev/atip",
  "trust": {
    "source": "native",
    "verified": true
  },
  "commands": {
    "lint": {
      "description": "Lint ATIP metadata files for quality issues",
      "arguments": [
        {
          "name": "files",
          "type": "string",
          "description": "Files or glob patterns to lint",
          "required": true,
          "variadic": true
        }
      ],
      "options": [
        {
          "name": "fix",
          "flags": ["--fix"],
          "type": "boolean",
          "description": "Automatically fix issues when possible"
        },
        {
          "name": "config",
          "flags": ["-c", "--config"],
          "type": "file",
          "description": "Path to config file"
        },
        {
          "name": "output",
          "flags": ["-o", "--output"],
          "type": "enum",
          "enum": ["stylish", "json", "sarif", "compact"],
          "description": "Output format"
        }
      ],
      "effects": {
        "filesystem": { "read": true, "write": false },
        "network": false,
        "idempotent": true
      }
    },
    "init": {
      "description": "Initialize a lint configuration file",
      "options": [
        {
          "name": "preset",
          "flags": ["-p", "--preset"],
          "type": "enum",
          "enum": ["recommended", "strict", "minimal"],
          "description": "Rule preset to use"
        }
      ],
      "effects": {
        "filesystem": { "read": false, "write": true },
        "network": false,
        "idempotent": false
      }
    },
    "list-rules": {
      "description": "List available lint rules",
      "effects": {
        "network": false,
        "idempotent": true
      }
    }
  },
  "globalOptions": [
    {
      "name": "quiet",
      "flags": ["-q", "--quiet"],
      "type": "boolean",
      "description": "Only show errors, suppress warnings"
    },
    {
      "name": "verbose",
      "flags": ["-v", "--verbose"],
      "type": "boolean",
      "description": "Show debug information"
    }
  ]
}
```

**Explanation**: atip-lint can describe itself using ATIP, demonstrating:
- The `lint` command reads files but doesn't write (unless `--fix`)
- The `init` command writes a new config file
- Effects metadata accurately describes the tool's behavior

---

### Example 28: Lint atip-lint's Own Metadata

```bash
atip-lint --agent | atip-lint --stdin
```

**Expected Output**:
```
(stdin)
  (no issues)

0 problems (0 errors, 0 warnings)
```

**Explanation**: atip-lint's own metadata should pass all lint checks, proving it follows best practices.

---

## Error Handling

### Example 29: Invalid JSON

```bash
atip-lint invalid.json
```

**invalid.json**:
```json
{
  "atip": { "version": "0.6" }
  "name": "broken"
}
```

**Expected Output**:
```
/path/to/invalid.json
  2:35   error    Unexpected token, expected ","  parse-error

1 problem (1 error, 0 warnings)
```

---

### Example 30: Schema Validation Errors

```bash
atip-lint missing-name.json
```

**missing-name.json**:
```json
{
  "atip": { "version": "0.6" },
  "version": "1.0.0",
  "description": "Missing name field"
}
```

**Expected Output**:
```
/path/to/missing-name.json
  1:1   error    Schema validation failed: required property 'name' is missing  schema-error

1 problem (1 error, 0 warnings)
```

---

### Example 31: Configuration Error

```bash
atip-lint examples/*.json --config nonexistent.json
```

**Expected Output**:
```
Error: Configuration file not found: nonexistent.json

Exit code: 2
```

---

## Caching

### Example 32: Enable Caching for Large Projects

```bash
atip-lint examples/*.json shims/*.json --cache
```

**First Run**:
```
Linting 50 files...

/path/to/shims/curl.json
  15:5   warning  Missing effects  no-empty-effects

1 problem (0 errors, 1 warning)
Cache saved: 50 entries
```

**Second Run** (no changes):
```
Linting 50 files...
(49 files from cache)

/path/to/shims/curl.json
  15:5   warning  Missing effects  no-empty-effects

1 problem (0 errors, 1 warning)
Time: 50ms (vs 500ms uncached)
```

**Explanation**: Cache stores results keyed by file content hash and config hash. Changed files are re-linted.

---

### Example 33: Custom Cache Location

```bash
atip-lint examples/*.json --cache --cache-location .lint-cache
```

**Explanation**: Cache file is stored at `.lint-cache` instead of default `.atiplintcache`.

---

## List Rules

### Example 34: List All Rules

```bash
atip-lint list-rules
```

**Expected Output**:
```
Rule                            Category     Fixable  Default
────────────────────────────────────────────────────────────
no-empty-effects                quality      yes      warn
description-quality             quality      partial  warn
no-missing-required-fields      quality      no       error
valid-effects-values            consistency  no       error
consistent-naming               consistency  no       warn
no-duplicate-flags              consistency  no       error
destructive-needs-reversible    security     yes      warn
billable-needs-confirmation     security     no       warn
trust-source-requirements       trust        no       warn
binary-exists                   executable   no       warn
agent-flag-works                executable   no       warn

11 rules available
```

---

### Example 35: List Rules by Category

```bash
atip-lint list-rules --category security --format json
```

**Expected Output**:
```json
{
  "rules": [
    {
      "id": "destructive-needs-reversible",
      "category": "security",
      "description": "Destructive operations should declare reversibility",
      "fixable": true,
      "defaultSeverity": "warn",
      "options": {}
    },
    {
      "id": "billable-needs-confirmation",
      "category": "security",
      "description": "Billable operations should be marked non-idempotent",
      "fixable": false,
      "defaultSeverity": "warn",
      "options": {}
    }
  ]
}
```
