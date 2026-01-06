# ATIP Example Tools

This directory contains example CLI tools that implement the ATIP `--agent` flag. These serve as reference implementations for tool authors looking to add ATIP support.

## Tools

### hello-atip

A minimal example demonstrating the basic pattern for implementing `--agent`:

```bash
# Show ATIP metadata
./hello-atip --agent

# Normal usage
./hello-atip                    # Hello, World!
./hello-atip Alice              # Hello, Alice!
./hello-atip Bob --uppercase    # HELLO, BOB!
```

**Key patterns demonstrated:**
- Checking for `--agent` flag early before other argument parsing
- Outputting valid ATIP JSON metadata
- Minimal effects declaration (read-only, idempotent)

### atip-echo

A more comprehensive example demonstrating various ATIP effects metadata:

```bash
# Show ATIP metadata
./atip-echo --agent

# Commands with different effects
./atip-echo print "Hello"           # Safe, read-only
./atip-echo write file.txt "data"   # Filesystem write
./atip-echo delete file.txt         # DESTRUCTIVE (prompts for confirmation)
./atip-echo fetch https://example.com  # Network operation
./atip-echo deploy prod             # Network + non-idempotent + billable
```

**Key patterns demonstrated:**
- Multiple commands with different effect profiles
- Destructive operations with `destructive: true`
- Interactive prompts with `interactive.prompts: true`
- Network operations with `network: true`
- Non-idempotent operations
- Cost metadata with `cost.billable: true`

## How to Add --agent to Your CLI Tool

### 1. Define ATIP Metadata

Create a JSON object with your tool's metadata. At minimum, you need:

```json
{
  "atip": { "version": "0.4" },
  "name": "your-tool",
  "version": "1.0.0",
  "description": "What your tool does",
  "commands": { ... }
}
```

### 2. Check for --agent Early

Before any other argument parsing, check if `--agent` was passed:

**Bash:**
```bash
for arg in "$@"; do
  if [ "$arg" = "--agent" ]; then
    echo "$ATIP_METADATA"
    exit 0
  fi
done
```

**JavaScript/TypeScript:**
```javascript
if (process.argv.includes('--agent')) {
  console.log(JSON.stringify(ATIP_METADATA, null, 2));
  process.exit(0);
}
```

**Go:**
```go
for _, arg := range os.Args[1:] {
  if arg == "--agent" {
    data, _ := json.MarshalIndent(atipMetadata, "", "  ")
    fmt.Println(string(data))
    os.Exit(0)
  }
}
```

**Python:**
```python
if '--agent' in sys.argv:
    print(json.dumps(ATIP_METADATA, indent=2))
    sys.exit(0)
```

### 3. Document Effects Carefully

The most important part of ATIP metadata is accurate effects declaration:

```json
{
  "effects": {
    "destructive": true,      // CRITICAL: Can this permanently destroy data?
    "reversible": false,      // CRITICAL: Can the action be undone?
    "idempotent": true,       // Is it safe to run multiple times?
    "network": true,          // Does it make network requests?
    "filesystem": {
      "read": true,
      "write": true,
      "delete": false,
      "paths": ["~/.config/myapp/"]
    },
    "cost": { "billable": true }  // Does it incur costs?
  }
}
```

**Be conservative:** If you're unsure, mark as potentially unsafe (`destructive: true`).

### 4. Validate Your Metadata

Use `atip-validate` to ensure your metadata is valid:

```bash
your-tool --agent | atip-validate -
```

## Testing with atip-discover

Once your tool implements `--agent`, it can be discovered automatically:

```bash
# Scan for ATIP tools
atip-discover scan --allow-path /path/to/your/tools

# Verify your tool was found
atip-discover list

# Get full metadata
atip-discover get your-tool
```

## More Information

- [ATIP Specification](../../spec/rfc.md)
- [Adoption Guide](../../docs/adoption-guide.md)
- [Reference Implementations](../../reference/)
