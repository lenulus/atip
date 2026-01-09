# Usage Examples: atip-diff

## Basic Usage

### Example 1: Compare Two ATIP Files

```bash
atip-diff examples/gh-v2.45.json examples/gh-v2.46.json
```

**Expected Output** (summary format):
```
Comparing: gh-v2.45.json -> gh-v2.46.json

BREAKING CHANGES (1)
  - Command 'repo.archive' was removed
    Path: commands.repo.commands.archive

NON-BREAKING CHANGES (3)
  + Command 'repo.unarchive' was added
    Path: commands.repo.commands.unarchive
  + Option '--json' was added to 'pr.list'
    Path: commands.pr.commands.list.options
  ~ Description changed for 'pr.create'
    Path: commands.pr.commands.create.description

EFFECTS CHANGES (1)
  ! 'pr.merge' now marked as destructive
    Path: commands.pr.commands.merge.effects.destructive
    Severity: high

Summary: 5 changes (1 breaking, 3 non-breaking, 1 effects)
Recommended version bump: MAJOR
```

**Explanation**: The default command is `diff`. It shows categorized changes with paths and a semver recommendation.

---

### Example 2: JSON Output for CI/CD

```bash
atip-diff old.json new.json --output json
```

**Expected Output**:
```json
{
  "summary": {
    "totalChanges": 5,
    "breakingChanges": 1,
    "nonBreakingChanges": 3,
    "effectsChanges": 1,
    "hasBreakingChanges": true,
    "hasEffectsChanges": true
  },
  "semverRecommendation": "major",
  "changes": [
    {
      "type": "command-removed",
      "category": "breaking",
      "message": "Command 'repo.archive' was removed",
      "path": ["commands", "repo", "commands", "archive"],
      "oldValue": {
        "description": "Archive a repository",
        "effects": { "network": true, "reversible": true }
      },
      "context": {
        "command": "archive",
        "commandPath": ["repo", "archive"]
      }
    },
    {
      "type": "command-added",
      "category": "non-breaking",
      "message": "Command 'repo.unarchive' was added",
      "path": ["commands", "repo", "commands", "unarchive"],
      "newValue": {
        "description": "Unarchive a repository",
        "effects": { "network": true }
      },
      "context": {
        "command": "unarchive",
        "commandPath": ["repo", "unarchive"]
      }
    },
    {
      "type": "optional-option-added",
      "category": "non-breaking",
      "message": "Option '--json' was added to 'pr.list'",
      "path": ["commands", "pr", "commands", "list", "options"],
      "newValue": {
        "name": "json",
        "flags": ["--json"],
        "type": "boolean",
        "description": "Output in JSON format"
      },
      "context": {
        "command": "list",
        "commandPath": ["pr", "list"],
        "option": "json"
      }
    },
    {
      "type": "description-changed",
      "category": "non-breaking",
      "message": "Description changed for 'pr.create'",
      "path": ["commands", "pr", "commands", "create", "description"],
      "oldValue": "Create a pull request",
      "newValue": "Create a new pull request from the current branch",
      "context": {
        "command": "create",
        "commandPath": ["pr", "create"]
      }
    },
    {
      "type": "destructive-added",
      "category": "effects",
      "severity": "high",
      "message": "'pr.merge' now marked as destructive",
      "path": ["commands", "pr", "commands", "merge", "effects", "destructive"],
      "oldValue": false,
      "newValue": true,
      "context": {
        "command": "merge",
        "commandPath": ["pr", "merge"],
        "effectField": "destructive"
      }
    }
  ]
}
```

**Explanation**: JSON output includes full details for programmatic processing.

---

### Example 3: Markdown Output for Changelogs

```bash
atip-diff old.json new.json --output markdown
```

**Expected Output**:
```markdown
## API Changes

### Breaking Changes

> **Warning**: The following changes may break existing integrations.

- **Command removed**: `repo.archive`
  - Path: `commands.repo.commands.archive`
  - Previously allowed archiving repositories

### Non-Breaking Changes

- **Command added**: `repo.unarchive`
  - Path: `commands.repo.commands.unarchive`
  - Allows unarchiving repositories

- **Option added**: `--json` to `pr.list`
  - Path: `commands.pr.commands.list.options`
  - Enables JSON output format

- **Description updated**: `pr.create`
  - Old: "Create a pull request"
  - New: "Create a new pull request from the current branch"

### Effects Changes

- **Destructive flag added**: `pr.merge` *(high severity)*
  - Path: `commands.pr.commands.merge.effects.destructive`
  - Agents should now require confirmation before merging

---

**Recommended version bump**: MAJOR
```

**Explanation**: Markdown format is suitable for inclusion in CHANGELOG.md or release notes.

---

### Example 4: Breaking Changes Only

```bash
atip-diff old.json new.json --breaking-only
```

**Expected Output**:
```
Comparing: old.json -> new.json

BREAKING CHANGES (2)
  - Command 'deploy.rollback' was removed
    Path: commands.deploy.commands.rollback
  - Argument 'environment' is now required in 'deploy.push'
    Path: commands.deploy.commands.push.arguments.environment

Summary: 2 breaking changes detected
Recommended version bump: MAJOR
```

**Explanation**: `--breaking-only` filters output to show only breaking changes.

---

### Example 5: Effects Changes Only

```bash
atip-diff old.json new.json --effects-only
```

**Expected Output**:
```
Comparing: old.json -> new.json

EFFECTS CHANGES (3)
  ! 'deploy.push' now marked as non-reversible (high)
    Path: commands.deploy.commands.push.effects.reversible
    Changed: true -> false

  ! 'deploy.push' now marked as billable (high)
    Path: commands.deploy.commands.push.effects.cost.billable
    Changed: false -> true

  ~ 'status' network effect changed (low)
    Path: commands.status.effects.network
    Changed: false -> true

Summary: 3 effects changes (2 high, 0 medium, 1 low severity)
Recommended version bump: MINOR
```

**Explanation**: `--effects-only` focuses on safety-related changes.

---

### Example 6: Fail on Breaking Changes (CI)

```bash
atip-diff old.json new.json --fail-on-breaking
echo "Exit code: $?"
```

**Scenario 1**: No breaking changes
```
Comparing: old.json -> new.json

NON-BREAKING CHANGES (2)
  + Command 'cache.clear' was added
  ~ Description changed for 'build'

Summary: 2 changes (0 breaking)
Recommended version bump: MINOR
Exit code: 0
```

**Scenario 2**: Breaking changes detected
```
Comparing: old.json -> new.json

BREAKING CHANGES (1)
  - Required argument 'target' added to 'build'

Summary: 1 breaking change detected
Recommended version bump: MAJOR
Exit code: 1
```

**Explanation**: `--fail-on-breaking` returns exit code 1 when breaking changes exist, useful for CI gates.

---

### Example 7: Semver Recommendation

```bash
atip-diff old.json new.json --semver
```

**Expected Output**:
```
minor
```

**Explanation**: `--semver` outputs only the recommended version bump, suitable for scripting:
```bash
NEW_VERSION=$(npm version $(atip-diff old.json new.json --semver))
```

---

### Example 8: Quiet Mode

```bash
atip-diff old.json new.json --quiet
```

**Scenario 1**: No breaking changes
```
(no output)
Exit code: 0
```

**Scenario 2**: Breaking changes
```
BREAKING CHANGES (1)
  - Command 'reset' was removed

Exit code: 0
```

**Explanation**: `--quiet` suppresses all output unless breaking changes are found.

---

### Example 9: Verbose Mode

```bash
atip-diff old.json new.json --verbose
```

**Expected Output**:
```
Comparing: old.json -> new.json
  Old version: 2.45.0
  New version: 2.46.0

Loading old.json...
  Schema validation: passed
  Commands: 45
  Total options: 123

Loading new.json...
  Schema validation: passed
  Commands: 47
  Total options: 128

Comparing metadata structures...
  Comparing root fields...
  Comparing commands (45 old, 47 new)...
    Comparing 'pr' subtree (8 commands)...
    Comparing 'repo' subtree (12 commands)...
    ...

BREAKING CHANGES (1)
  - Command 'repo.archive' was removed
    Path: commands.repo.commands.archive
    Old value: {
      "description": "Archive a repository",
      "effects": { "network": true, "reversible": true }
    }

NON-BREAKING CHANGES (3)
  ...

Summary: 5 changes (1 breaking, 3 non-breaking, 1 effects)
Comparison completed in 45ms
Recommended version bump: MAJOR
```

**Explanation**: `--verbose` shows detailed progress and full values.

---

### Example 10: Ignore Version Changes

```bash
atip-diff old.json new.json --ignore-version
```

**old.json**:
```json
{
  "atip": { "version": "0.6" },
  "name": "mytool",
  "version": "1.0.0",
  "description": "My tool",
  "commands": {}
}
```

**new.json**:
```json
{
  "atip": { "version": "0.6" },
  "name": "mytool",
  "version": "2.0.0",
  "description": "My tool",
  "commands": {}
}
```

**Expected Output**:
```
Comparing: old.json -> new.json

No changes detected

Summary: 0 changes
Recommended version bump: NONE
```

**Explanation**: `--ignore-version` excludes version field from comparison. Useful when the version bump is expected.

---

## Stdin Mode

### Example 11: Compare Tool Output to Baseline

```bash
mytool --agent | atip-diff stdin baseline.json
```

**Expected Output**:
```
Comparing: (stdin) -> baseline.json

BREAKING CHANGES (1)
  - Option '--force' was removed from 'deploy'
    Path: commands.deploy.options

Summary: 1 breaking change detected
Recommended version bump: MAJOR
```

**Explanation**: Reads new metadata from stdin, useful for CI pipelines:
```yaml
- name: Check for breaking changes
  run: |
    ./mytool --agent | atip-diff stdin metadata/mytool.json --fail-on-breaking
```

---

## Programmatic API

### Example 12: Basic Library Usage

```typescript
import { diff } from 'atip-diff';
import * as fs from 'fs';

const oldTool = JSON.parse(fs.readFileSync('v1.json', 'utf-8'));
const newTool = JSON.parse(fs.readFileSync('v2.json', 'utf-8'));

const result = diff(oldTool, newTool);

console.log(`Total changes: ${result.summary.totalChanges}`);
console.log(`Breaking: ${result.summary.breakingChanges}`);
console.log(`Semver recommendation: ${result.semverRecommendation}`);

if (result.summary.hasBreakingChanges) {
  console.log('\nBreaking changes:');
  for (const change of result.changes.filter(c => c.category === 'breaking')) {
    console.log(`  - ${change.message}`);
  }
}
```

**Expected Output**:
```
Total changes: 5
Breaking: 1
Semver recommendation: major

Breaking changes:
  - Command 'repo.archive' was removed
```

---

### Example 13: Using the Differ Class

```typescript
import { createDiffer } from 'atip-diff';

const differ = createDiffer({
  ignoreVersion: true,
  ignoreDescription: true,
});

// Diff from files
const result = await differ.diffFiles('old.json', 'new.json');

// Filter by category
const breaking = differ.filterByCategory(result, 'breaking');
console.log(`${breaking.length} breaking changes`);

// Check for breaking changes
if (differ.hasBreakingChanges(result)) {
  console.error('Cannot release: breaking changes detected');
  process.exit(1);
}

// Get recommended bump
const bump = differ.getRecommendedBump(result);
console.log(`Recommended bump: ${bump}`);
```

---

### Example 14: Diff JSON Strings

```typescript
import { createDiffer } from 'atip-diff';

const differ = createDiffer();

const oldJson = `{
  "atip": { "version": "0.6" },
  "name": "test",
  "version": "1.0.0",
  "description": "Test tool",
  "commands": {
    "run": {
      "description": "Run the tool",
      "options": [
        {
          "name": "verbose",
          "flags": ["-v", "--verbose"],
          "type": "boolean",
          "description": "Enable verbose output"
        }
      ]
    }
  }
}`;

const newJson = `{
  "atip": { "version": "0.6" },
  "name": "test",
  "version": "1.1.0",
  "description": "Test tool",
  "commands": {
    "run": {
      "description": "Run the tool",
      "options": [
        {
          "name": "verbose",
          "flags": ["-v", "--verbose"],
          "type": "boolean",
          "description": "Enable verbose output"
        },
        {
          "name": "quiet",
          "flags": ["-q", "--quiet"],
          "type": "boolean",
          "description": "Suppress output"
        }
      ]
    }
  }
}`;

const result = differ.diffStrings(oldJson, newJson);

console.log('Changes:', result.changes.map(c => c.message));
```

**Expected Output**:
```
Changes: [
  "Version changed from '1.0.0' to '1.1.0'",
  "Option '--quiet' was added to 'run'"
]
```

---

### Example 15: Format Output

```typescript
import { diff, formatSummary, formatJson, formatMarkdown } from 'atip-diff';

const result = diff(oldTool, newTool);

// Terminal output with colors
const summary = formatSummary(result, { color: true });
console.log(summary);

// JSON for API response
const json = formatJson(result, { pretty: true });
fs.writeFileSync('diff.json', json);

// Markdown for changelog
const markdown = formatMarkdown(result, {
  includeHeader: true,
  version: '2.46.0',
  date: '2026-01-08',
});
fs.appendFileSync('CHANGELOG.md', markdown);
```

---

### Example 16: Custom Diff Configuration

```typescript
import { createDiffer, type CustomDiffRule } from 'atip-diff';

// Define custom rules
const customRules: CustomDiffRule[] = [
  // Treat all changes under 'internal' commands as non-breaking
  {
    pathPattern: 'commands.internal.*',
    category: 'non-breaking',
  },
  // Ignore changes to x- extension fields
  {
    pathPattern: 'x-*',
    ignore: true,
  },
  // Treat network effect changes as high severity
  {
    pathPattern: '*.effects.network',
    severity: 'high',
  },
];

const differ = createDiffer({
  customRules,
  ignoreVersion: true,
});

const result = await differ.diffFiles('old.json', 'new.json');
```

---

## Change Detection Examples

### Example 17: Breaking - Command Removed

**old.json**:
```json
{
  "commands": {
    "deploy": { "description": "Deploy application" },
    "rollback": { "description": "Rollback deployment" }
  }
}
```

**new.json**:
```json
{
  "commands": {
    "deploy": { "description": "Deploy application" }
  }
}
```

**Detected Change**:
```json
{
  "type": "command-removed",
  "category": "breaking",
  "message": "Command 'rollback' was removed",
  "path": ["commands", "rollback"]
}
```

---

### Example 18: Breaking - Required Argument Added

**old.json**:
```json
{
  "commands": {
    "deploy": {
      "description": "Deploy application",
      "arguments": []
    }
  }
}
```

**new.json**:
```json
{
  "commands": {
    "deploy": {
      "description": "Deploy application",
      "arguments": [
        {
          "name": "environment",
          "type": "enum",
          "enum": ["dev", "staging", "prod"],
          "description": "Target environment",
          "required": true
        }
      ]
    }
  }
}
```

**Detected Change**:
```json
{
  "type": "required-argument-added",
  "category": "breaking",
  "message": "Required argument 'environment' was added to 'deploy'",
  "path": ["commands", "deploy", "arguments", "environment"]
}
```

---

### Example 19: Breaking - Type Made Stricter

**old.json**:
```json
{
  "commands": {
    "set": {
      "description": "Set value",
      "options": [
        {
          "name": "value",
          "flags": ["--value"],
          "type": "string",
          "description": "Value to set"
        }
      ]
    }
  }
}
```

**new.json**:
```json
{
  "commands": {
    "set": {
      "description": "Set value",
      "options": [
        {
          "name": "value",
          "flags": ["--value"],
          "type": "enum",
          "enum": ["low", "medium", "high"],
          "description": "Value to set"
        }
      ]
    }
  }
}
```

**Detected Change**:
```json
{
  "type": "type-made-stricter",
  "category": "breaking",
  "message": "Option 'value' type changed from 'string' to 'enum' (stricter)",
  "path": ["commands", "set", "options", "value", "type"],
  "oldValue": "string",
  "newValue": "enum"
}
```

---

### Example 20: Breaking - Enum Values Removed

**old.json**:
```json
{
  "options": [
    {
      "name": "format",
      "flags": ["--format"],
      "type": "enum",
      "enum": ["json", "yaml", "xml", "csv"],
      "description": "Output format"
    }
  ]
}
```

**new.json**:
```json
{
  "options": [
    {
      "name": "format",
      "flags": ["--format"],
      "type": "enum",
      "enum": ["json", "yaml"],
      "description": "Output format"
    }
  ]
}
```

**Detected Change**:
```json
{
  "type": "enum-values-removed",
  "category": "breaking",
  "message": "Enum values removed from 'format': xml, csv",
  "path": ["options", "format", "enum"],
  "oldValue": ["xml", "csv"]
}
```

---

### Example 21: Non-Breaking - Command Added

**old.json**:
```json
{
  "commands": {
    "build": { "description": "Build project" }
  }
}
```

**new.json**:
```json
{
  "commands": {
    "build": { "description": "Build project" },
    "test": { "description": "Run tests" }
  }
}
```

**Detected Change**:
```json
{
  "type": "command-added",
  "category": "non-breaking",
  "message": "Command 'test' was added",
  "path": ["commands", "test"]
}
```

---

### Example 22: Non-Breaking - Type Relaxed

**old.json**:
```json
{
  "options": [
    {
      "name": "count",
      "flags": ["--count"],
      "type": "integer",
      "description": "Number of items"
    }
  ]
}
```

**new.json**:
```json
{
  "options": [
    {
      "name": "count",
      "flags": ["--count"],
      "type": "number",
      "description": "Number of items"
    }
  ]
}
```

**Detected Change**:
```json
{
  "type": "type-relaxed",
  "category": "non-breaking",
  "message": "Option 'count' type changed from 'integer' to 'number' (relaxed)",
  "path": ["options", "count", "type"],
  "oldValue": "integer",
  "newValue": "number"
}
```

---

### Example 23: Effects - Destructive Flag Added

**old.json**:
```json
{
  "commands": {
    "delete": {
      "description": "Delete resource",
      "effects": {
        "network": true
      }
    }
  }
}
```

**new.json**:
```json
{
  "commands": {
    "delete": {
      "description": "Delete resource",
      "effects": {
        "network": true,
        "destructive": true,
        "reversible": false
      }
    }
  }
}
```

**Detected Changes**:
```json
[
  {
    "type": "destructive-added",
    "category": "effects",
    "severity": "high",
    "message": "'delete' now marked as destructive",
    "path": ["commands", "delete", "effects", "destructive"],
    "oldValue": undefined,
    "newValue": true
  },
  {
    "type": "reversible-changed",
    "category": "effects",
    "severity": "medium",
    "message": "'delete' reversible changed (undefined -> false)",
    "path": ["commands", "delete", "effects", "reversible"],
    "oldValue": undefined,
    "newValue": false
  }
]
```

---

### Example 24: Effects - Cost Billable Changed

**old.json**:
```json
{
  "commands": {
    "deploy": {
      "description": "Deploy to cloud",
      "effects": {
        "network": true,
        "cost": {
          "estimate": "low",
          "billable": false
        }
      }
    }
  }
}
```

**new.json**:
```json
{
  "commands": {
    "deploy": {
      "description": "Deploy to cloud",
      "effects": {
        "network": true,
        "cost": {
          "estimate": "medium",
          "billable": true
        }
      }
    }
  }
}
```

**Detected Changes**:
```json
[
  {
    "type": "cost-changed",
    "category": "effects",
    "severity": "high",
    "message": "'deploy' cost.billable changed (false -> true)",
    "path": ["commands", "deploy", "effects", "cost", "billable"],
    "oldValue": false,
    "newValue": true
  },
  {
    "type": "cost-changed",
    "category": "effects",
    "severity": "low",
    "message": "'deploy' cost.estimate changed (low -> medium)",
    "path": ["commands", "deploy", "effects", "cost", "estimate"],
    "oldValue": "low",
    "newValue": "medium"
  }
]
```

---

## Semver Recommendation Examples

### Example 25: Major Bump (Breaking Changes)

```typescript
const result = diff(oldTool, newTool);
// result.changes includes: command-removed

console.log(result.semverRecommendation); // "major"
```

---

### Example 26: Minor Bump (Non-Breaking + High Effects)

```typescript
const result = diff(oldTool, newTool);
// result.changes includes:
// - command-added (non-breaking)
// - destructive-added (effects, high severity)

console.log(result.semverRecommendation); // "minor"
```

---

### Example 27: Patch Bump (Low Effects Only)

```typescript
const result = diff(oldTool, newTool);
// result.changes includes only:
// - network-changed (effects, low severity)
// - duration-changed (effects, low severity)

console.log(result.semverRecommendation); // "patch"
```

---

### Example 28: No Bump (No Changes)

```typescript
const result = diff(oldTool, newTool);
// result.changes is empty

console.log(result.semverRecommendation); // "none"
```

---

## Error Handling

### Example 29: File Not Found

```bash
atip-diff nonexistent.json new.json
```

**Expected Output**:
```
Error: Cannot read file: nonexistent.json
  ENOENT: no such file or directory

Exit code: 2
```

---

### Example 30: Invalid JSON

```bash
atip-diff invalid.json new.json
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
Error: Invalid JSON in file: invalid.json
  Unexpected token at line 3, column 3
  Expected ',' or '}' after object property

Exit code: 2
```

---

### Example 31: Schema Validation Failed

```bash
atip-diff missing-name.json new.json
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
Error: Schema validation failed for: missing-name.json
  - Required property 'name' is missing (path: /)

Exit code: 2
```

---

## Dogfooding

### Example 32: atip-diff's Own ATIP Metadata

```bash
atip-diff --agent
```

**Expected Output**:
```json
{
  "atip": { "version": "0.6" },
  "name": "atip-diff",
  "version": "0.1.0",
  "description": "Compare ATIP metadata versions and categorize breaking changes",
  "homepage": "https://github.com/atip-dev/atip",
  "trust": {
    "source": "native",
    "verified": true
  },
  "commands": {
    "diff": {
      "description": "Compare two ATIP metadata files and report differences",
      "arguments": [
        {
          "name": "old",
          "type": "file",
          "description": "Path to old/base ATIP JSON file",
          "required": true
        },
        {
          "name": "new",
          "type": "file",
          "description": "Path to new/updated ATIP JSON file",
          "required": true
        }
      ],
      "options": [
        {
          "name": "output",
          "flags": ["-o", "--output"],
          "type": "enum",
          "enum": ["summary", "json", "markdown"],
          "default": "summary",
          "description": "Output format"
        },
        {
          "name": "breaking-only",
          "flags": ["-b", "--breaking-only"],
          "type": "boolean",
          "description": "Only report breaking changes"
        },
        {
          "name": "effects-only",
          "flags": ["-e", "--effects-only"],
          "type": "boolean",
          "description": "Only report effects changes"
        },
        {
          "name": "fail-on-breaking",
          "flags": ["--fail-on-breaking"],
          "type": "boolean",
          "description": "Exit with code 1 if breaking changes detected"
        },
        {
          "name": "semver",
          "flags": ["--semver"],
          "type": "boolean",
          "description": "Output recommended semantic version bump"
        }
      ],
      "effects": {
        "filesystem": { "read": true, "write": false },
        "network": false,
        "idempotent": true,
        "destructive": false
      }
    },
    "stdin": {
      "description": "Compare ATIP metadata from stdin against a file",
      "arguments": [
        {
          "name": "old",
          "type": "file",
          "description": "Path to old/base ATIP JSON file",
          "required": true
        }
      ],
      "effects": {
        "filesystem": { "read": true, "write": false },
        "network": false,
        "idempotent": true,
        "interactive": { "stdin": "required" }
      }
    }
  },
  "globalOptions": [
    {
      "name": "output",
      "flags": ["-o", "--output"],
      "type": "enum",
      "enum": ["summary", "json", "markdown"],
      "description": "Output format"
    },
    {
      "name": "quiet",
      "flags": ["-q", "--quiet"],
      "type": "boolean",
      "description": "Only output on breaking changes"
    },
    {
      "name": "verbose",
      "flags": ["-v", "--verbose"],
      "type": "boolean",
      "description": "Show detailed change information"
    }
  ]
}
```

**Explanation**: atip-diff can describe itself using ATIP, demonstrating:
- The `diff` command reads two files but doesn't write
- The `stdin` command requires stdin input
- Effects metadata accurately describes the tool's read-only, idempotent behavior

---

### Example 33: Compare atip-diff Versions

```bash
atip-diff atip-diff-v0.1.0.json atip-diff-v0.2.0.json
```

**Expected Output**:
```
Comparing: atip-diff-v0.1.0.json -> atip-diff-v0.2.0.json

NON-BREAKING CHANGES (2)
  ~ Version changed from '0.1.0' to '0.2.0'
  + Option '--include-unchanged' was added to 'diff'

Summary: 2 changes (0 breaking, 2 non-breaking, 0 effects)
Recommended version bump: MINOR
```

**Explanation**: atip-diff can compare its own metadata across versions.

---

## CI/CD Integration Examples

### Example 34: GitHub Actions Workflow

**`.github/workflows/check-breaking.yml`**:
```yaml
name: Check Breaking Changes

on:
  pull_request:
    paths:
      - 'metadata/*.json'

jobs:
  check-breaking:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install atip-diff
        run: npm install -g atip-diff

      - name: Get changed files
        id: changed
        run: |
          FILES=$(git diff --name-only origin/main -- 'metadata/*.json')
          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Check for breaking changes
        run: |
          for file in ${{ steps.changed.outputs.files }}; do
            echo "Checking $file..."
            git show origin/main:$file > /tmp/old.json
            atip-diff /tmp/old.json $file --fail-on-breaking
          done

      - name: Generate changelog diff
        if: success()
        run: |
          for file in ${{ steps.changed.outputs.files }}; do
            git show origin/main:$file > /tmp/old.json
            atip-diff /tmp/old.json $file --output markdown >> pr-changes.md
          done

      - name: Comment on PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('pr-changes.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

---

### Example 35: Pre-release Version Bump

```bash
#!/bin/bash
# release.sh - Automated version bump based on changes

OLD_VERSION=$(cat metadata/tool.json | jq -r '.version')
BUMP=$(atip-diff metadata/tool.json.bak metadata/tool.json --semver)

case $BUMP in
  major)
    npm version major
    ;;
  minor)
    npm version minor
    ;;
  patch)
    npm version patch
    ;;
  none)
    echo "No changes detected"
    exit 0
    ;;
esac

NEW_VERSION=$(cat package.json | jq -r '.version')
echo "Version bumped from $OLD_VERSION to $NEW_VERSION"
```
