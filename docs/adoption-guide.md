# ATIP Adoption Guide for Tool Authors

This guide shows how to add ATIP support to your CLI tool.

## Minimal Implementation (30 minutes)

### Python

```python
import json
import sys

ATIP_METADATA = {
    "atip": {"version": "0.4"},
    "name": "mytool",
    "version": "1.0.0",
    "description": "Does something useful",
    "trust": {"source": "native"},
    "commands": {
        "run": {
            "description": "Execute main function",
            "options": [
                {
                    "name": "verbose",
                    "flags": ["-v", "--verbose"],
                    "type": "boolean",
                    "description": "Verbose output"
                }
            ],
            "effects": {
                "idempotent": True,
                "network": False
            }
        }
    }
}

def main():
    if "--agent" in sys.argv:
        print(json.dumps(ATIP_METADATA, indent=2))
        sys.exit(0)
    
    # ... rest of your tool

if __name__ == "__main__":
    main()
```

### Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "os"
)

var atipMetadata = map[string]interface{}{
    "atip": map[string]interface{}{
        "version": "0.4",
    },
    "name":        "mytool",
    "version":     "1.0.0",
    "description": "Does something useful",
    "trust": map[string]interface{}{
        "source": "native",
    },
    "commands": map[string]interface{}{
        "run": map[string]interface{}{
            "description": "Execute main function",
            "effects": map[string]interface{}{
                "idempotent": true,
            },
        },
    },
}

func main() {
    for _, arg := range os.Args[1:] {
        if arg == "--agent" {
            enc := json.NewEncoder(os.Stdout)
            enc.SetIndent("", "  ")
            enc.Encode(atipMetadata)
            os.Exit(0)
        }
    }
    // ... rest of your tool
}
```

### Node.js

```javascript
const ATIP_METADATA = {
  atip: { version: "0.4" },
  name: "mytool",
  version: "1.0.0",
  description: "Does something useful",
  trust: { source: "native" },
  commands: {
    run: {
      description: "Execute main function",
      effects: { idempotent: true }
    }
  }
};

if (process.argv.includes("--agent")) {
  console.log(JSON.stringify(ATIP_METADATA, null, 2));
  process.exit(0);
}

// ... rest of your tool
```

### Rust

```rust
use serde_json::json;
use std::env;

fn main() {
    if env::args().any(|arg| arg == "--agent") {
        let metadata = json!({
            "atip": {"version": "0.4"},
            "name": "mytool",
            "version": "1.0.0",
            "description": "Does something useful",
            "trust": {"source": "native"},
            "commands": {
                "run": {
                    "description": "Execute main function",
                    "effects": {"idempotent": true}
                }
            }
        });
        println!("{}", serde_json::to_string_pretty(&metadata).unwrap());
        std::process::exit(0);
    }
    // ... rest of your tool
}
```

## Progressive Enhancement

Start minimal, add more over time:

### Level 1: Basic metadata
- `atip`, `name`, `version`, `description`
- Basic `commands` structure

### Level 2: Safety metadata
- `effects.idempotent`
- `effects.destructive`
- `effects.reversible`
- `effects.network`

### Level 3: Full effects
- `effects.filesystem`
- `effects.interactive`
- `effects.cost`
- `effects.duration`

### Level 4: Patterns and trust
- `patterns[]` for common workflows
- `trust` with verification
- Partial discovery support

## Effects Guidelines

### When to mark `destructive: true`
- Deletes files, resources, or data
- Drops database tables
- Removes cloud resources
- Any irreversible data loss

### When to mark `idempotent: true`
- Running twice has same effect as once
- GET requests, read operations
- Declarative state commands (e.g., `terraform apply`)

### When to mark `reversible: true`
- Operation can be undone
- Example: `git commit` → `git revert`
- Example: `gh pr close` → `gh pr reopen`

### When to mark `network: true`
- Makes HTTP/API calls
- Connects to external services
- Sends/receives data over network

## Testing Your Implementation

```bash
# Should output valid JSON
mytool --agent | jq .

# Should validate against schema
mytool --agent | jsonschema -i /dev/stdin schema/0.4.json

# Should not have side effects
mytool --agent  # Should complete instantly, no prompts
```

## Partial Discovery (Large Tools)

For tools with many commands (kubectl, aws, gcloud):

```python
import sys

def get_metadata(commands_filter=None, depth=None):
    full_metadata = {...}  # Your full metadata
    
    if commands_filter:
        # Filter to requested commands only
        filtered = filter_commands(full_metadata, commands_filter)
        filtered["partial"] = True
        filtered["omitted"] = {"reason": "filtered", "safetyAssumption": "unknown"}
        return filtered
    
    if depth:
        # Limit nesting depth
        truncated = truncate_depth(full_metadata, depth)
        truncated["partial"] = True
        truncated["omitted"] = {"reason": "depth-limited", "safetyAssumption": "same-as-included"}
        return truncated
    
    return full_metadata

if "--agent" in sys.argv:
    commands = get_arg_value("--commands")  # e.g., "pods,deployments"
    depth = get_arg_value("--depth")        # e.g., "1"
    
    metadata = get_metadata(
        commands_filter=commands.split(",") if commands else None,
        depth=int(depth) if depth else None
    )
    print(json.dumps(metadata, indent=2))
    sys.exit(0)
```

## Questions?

Open an issue or see the [full specification](../spec/RFC.md).
