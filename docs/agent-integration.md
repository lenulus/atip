# ATIP Agent Integration Guide

This guide shows how to integrate ATIP into an AI coding agent.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent Flow                           │
├─────────────────────────────────────────────────────────────┤
│  1. DISCOVERY                                               │
│     Load ATIP metadata from tools                           │
│     ├── Run: tool --agent                                   │
│     ├── Load shims for legacy tools                         │
│     └── Cache in registry                                   │
├─────────────────────────────────────────────────────────────┤
│  2. COMPILATION                                             │
│     Convert ATIP → Provider format (OpenAI/Gemini/Anthropic)│
│     ├── Flatten subcommands                                 │
│     ├── Embed safety in descriptions                        │
│     └── Handle strict mode constraints                      │
├─────────────────────────────────────────────────────────────┤
│  3. SELECTION                                               │
│     LLM chooses tool based on user request                  │
├─────────────────────────────────────────────────────────────┤
│  4. VALIDATION                                              │
│     Check effects metadata against policy                   │
│     ├── Trust level                                         │
│     ├── Destructive operations                              │
│     └── Cost/billing                                        │
├─────────────────────────────────────────────────────────────┤
│  5. EXECUTION                                               │
│     Direct subprocess invocation                            │
│     ├── Handle interactive tools                            │
│     └── Capture stdout/stderr                               │
├─────────────────────────────────────────────────────────────┤
│  6. RESULT                                                  │
│     Return to LLM for synthesis                             │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Discovery

```python
import subprocess
import json
from pathlib import Path

XDG_DATA_HOME = Path.home() / ".local/share"
ATIP_DIR = XDG_DATA_HOME / "agent-tools"
REGISTRY_PATH = ATIP_DIR / "registry.json"

def probe_tool(tool_name: str) -> dict | None:
    """Probe a tool for ATIP support."""
    try:
        result = subprocess.run(
            [tool_name, "--agent"],
            capture_output=True,
            text=True,
            timeout=2.0
        )
        if result.returncode == 0:
            metadata = json.loads(result.stdout)
            if "atip" in metadata:
                return metadata
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        pass
    return None

def load_shim(tool_name: str) -> dict | None:
    """Load shim metadata for a tool."""
    shim_path = ATIP_DIR / "shims" / f"{tool_name}.json"
    if shim_path.exists():
        return json.loads(shim_path.read_text())
    return None

def discover_tool(tool_name: str) -> dict | None:
    """Discover metadata for a tool."""
    # Try native support first
    metadata = probe_tool(tool_name)
    if metadata:
        metadata["_source"] = "native"
        return metadata
    
    # Fall back to shim
    shim = load_shim(tool_name)
    if shim:
        shim["_source"] = "shim"
        return shim
    
    return None
```

## Step 2: Compilation to Provider Formats

### OpenAI

```python
def compile_to_openai(atip_tool: dict, strict: bool = True) -> list[dict]:
    """Compile ATIP to OpenAI function format."""
    tools = []
    
    def flatten_commands(commands: dict, prefix: str = ""):
        for name, cmd in commands.items():
            full_name = f"{prefix}_{name}" if prefix else name
            
            # Recurse into subcommands
            if "commands" in cmd:
                flatten_commands(cmd["commands"], full_name)
            else:
                tools.append(compile_command(full_name, cmd, strict))
    
    flatten_commands(atip_tool.get("commands", {}), atip_tool["name"])
    return tools

def compile_command(name: str, cmd: dict, strict: bool) -> dict:
    """Compile a single command to OpenAI format."""
    # Build safety suffix
    effects = cmd.get("effects", {})
    safety_flags = []
    if effects.get("destructive"):
        safety_flags.append("⚠️ DESTRUCTIVE")
    if effects.get("reversible") == False:
        safety_flags.append("⚠️ NOT REVERSIBLE")
    if effects.get("idempotent") == False:
        safety_flags.append("⚠️ NOT IDEMPOTENT")
    if effects.get("cost", {}).get("billable"):
        safety_flags.append("💰 BILLABLE")
    
    description = cmd["description"]
    if safety_flags:
        description += f" [{' | '.join(safety_flags)}]"
    
    # Truncate for OpenAI limit
    if len(description) > 1024:
        description = description[:1021] + "..."
    
    # Build parameters
    properties = {}
    required = []
    
    for opt in cmd.get("options", []):
        prop = {"type": opt["type"], "description": opt["description"]}
        if opt.get("enum"):
            prop["enum"] = opt["enum"]
        
        if strict:
            # Strict mode: all params required, use nullable for optional
            if not opt.get("required", False):
                prop["type"] = [opt["type"], "null"]
            required.append(opt["name"])
        else:
            if opt.get("required"):
                required.append(opt["name"])
        
        properties[opt["name"]] = prop
    
    params = {
        "type": "object",
        "properties": properties,
        "required": required,
    }
    if strict:
        params["additionalProperties"] = False
    
    return {
        "type": "function",
        "function": {
            "name": name.replace("-", "_"),
            "description": description,
            "strict": strict,
            "parameters": params
        }
    }
```

### Gemini

```python
def compile_to_gemini(atip_tool: dict) -> list[dict]:
    """Compile ATIP to Gemini FunctionDeclaration format."""
    tools = []
    
    def flatten_commands(commands: dict, prefix: str = ""):
        for name, cmd in commands.items():
            full_name = f"{prefix}_{name}" if prefix else name
            
            if "commands" in cmd:
                flatten_commands(cmd["commands"], full_name)
            else:
                tools.append({
                    "name": full_name.replace("-", "_"),
                    "description": build_description(cmd),
                    "parameters": build_parameters(cmd, strict=False)
                })
    
    flatten_commands(atip_tool.get("commands", {}), atip_tool["name"])
    return tools
```

### Anthropic

```python
def compile_to_anthropic(atip_tool: dict) -> list[dict]:
    """Compile ATIP to Anthropic tool format."""
    tools = []
    
    def flatten_commands(commands: dict, prefix: str = ""):
        for name, cmd in commands.items():
            full_name = f"{prefix}_{name}" if prefix else name
            
            if "commands" in cmd:
                flatten_commands(cmd["commands"], full_name)
            else:
                tools.append({
                    "name": full_name.replace("-", "_"),
                    "description": build_description(cmd),
                    "input_schema": build_parameters(cmd, strict=False)
                })
    
    flatten_commands(atip_tool.get("commands", {}), atip_tool["name"])
    return tools
```

## Step 3: Validation

```python
from enum import Enum

class TrustLevel(Enum):
    FULL = 4
    HIGH = 3
    MEDIUM = 2
    LOW = 1
    NONE = 0

def get_trust_level(metadata: dict) -> TrustLevel:
    """Determine trust level from metadata."""
    trust = metadata.get("trust", {})
    source = trust.get("source", "unknown")
    verified = trust.get("verified", False)
    
    if source == "native" and verified:
        return TrustLevel.FULL
    elif source in ("native", "vendor"):
        return TrustLevel.HIGH
    elif source == "org" and verified:
        return TrustLevel.MEDIUM
    elif source in ("org", "community"):
        return TrustLevel.LOW
    else:
        return TrustLevel.NONE

def validate_tool_call(
    tool_call: dict,
    metadata: dict,
    policy: dict
) -> tuple[bool, str | None]:
    """Validate a tool call against policy."""
    effects = metadata.get("effects", {})
    trust = get_trust_level(metadata)
    
    # Always block destructive without confirmation
    if effects.get("destructive"):
        return False, "Destructive operation requires confirmation"
    
    # Block billable without budget
    if effects.get("cost", {}).get("billable"):
        if not policy.get("allow_billable"):
            return False, "Operation may incur costs"
    
    # Block network for low-trust tools
    if effects.get("network") and trust < TrustLevel.MEDIUM:
        return False, "Network access from untrusted tool"
    
    return True, None
```

## Step 4: Execution

```python
def execute_tool(
    tool_name: str,
    args: list[str],
    metadata: dict
) -> dict:
    """Execute a tool with ATIP-informed handling."""
    effects = metadata.get("effects", {})
    interactive = effects.get("interactive", {})
    
    # Handle interactive tools
    if interactive.get("stdin") == "required":
        # Option 1: Look for --yes flag
        if has_yes_flag(metadata, args):
            args = add_yes_flag(args, metadata)
        else:
            return {"error": "Tool requires interactive input"}
    
    # Handle TTY requirement
    if interactive.get("tty"):
        return execute_in_pty(tool_name, args)
    
    # Standard execution
    try:
        timeout = parse_duration(effects.get("duration", {}).get("timeout", "30s"))
        result = subprocess.run(
            [tool_name] + args,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"error": f"Command timed out after {timeout}s"}
```

## Complete Agent Loop

```python
async def agent_loop(user_message: str, available_tools: list[str]):
    # 1. Discovery
    tools_metadata = {}
    for tool in available_tools:
        metadata = discover_tool(tool)
        if metadata:
            tools_metadata[tool] = metadata
    
    # 2. Compilation
    compiled_tools = []
    for name, metadata in tools_metadata.items():
        compiled_tools.extend(compile_to_openai(metadata))
    
    # 3. LLM call
    response = await llm.chat(
        messages=[{"role": "user", "content": user_message}],
        tools=compiled_tools
    )
    
    # Process tool calls
    while response.tool_calls:
        for call in response.tool_calls:
            # 4. Validation
            tool_name = call.function.name.split("_")[0]
            metadata = tools_metadata.get(tool_name, {})
            
            valid, reason = validate_tool_call(call, metadata, policy)
            if not valid:
                if await confirm_with_user(reason):
                    valid = True
                else:
                    continue
            
            # 5. Execution
            args = parse_args(call.function.arguments, metadata)
            result = execute_tool(tool_name, args, metadata)
            
            # 6. Return result
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result)
            })
        
        response = await llm.chat(messages=messages, tools=compiled_tools)
    
    return response.content
```

## Best Practices

1. **Cache metadata** — Don't probe tools on every request
2. **Respect trust levels** — More friction for less trusted tools
3. **Always validate** — Even trusted metadata can be wrong
4. **Handle interactive gracefully** — Don't hang on stdin
5. **Log for audit** — Record all tool executions
6. **Sandbox when possible** — Especially for low-trust tools
