# Contributing to ATIP

Thank you for your interest in contributing to the Agent Tool Introspection Protocol! This document provides guidelines for different types of contributions.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
3. [Contributing Shims](#contributing-shims)
4. [Proposing Spec Changes](#proposing-spec-changes)
5. [Development Setup](#development-setup)
6. [Style Guidelines](#style-guidelines)
7. [Pull Request Process](#pull-request-process)

---

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- **Be respectful** and considerate in all interactions
- **Be collaborative** and open to feedback
- **Focus on what's best** for the community and specification
- **Be patient** with newcomers and those learning

---

## How Can I Contribute?

### Reporting Bugs

If you find an issue with the specification, schema, or examples:

1. **Check existing issues** to avoid duplicates
2. **Open a new issue** with:
   - Clear description of the problem
   - Steps to reproduce (if applicable)
   - Expected vs. actual behavior
   - Version information (spec version, tool version)

### Suggesting Enhancements

For feature requests or improvements:

1. **Open an issue** describing:
   - The problem you're trying to solve
   - Your proposed solution
   - Why this benefits the broader community
   - Backwards compatibility considerations

### Improving Documentation

Documentation improvements are always welcome:

- Fix typos, clarify unclear sections
- Add examples or use cases
- Improve adoption guides
- Translate documentation

Small fixes can be submitted directly as PRs. Larger changes should start as issues for discussion.

---

## Contributing Shims

Shims allow legacy tools (those without native `--agent` support) to work with ATIP-aware agents.

### Shim Requirements

A valid shim must:

1. **Follow the ATIP schema** (validate against `schema/0.4.json`)
2. **Include trust metadata**:
   ```json
   {
     "trust": {
       "source": "community",
       "verified": false
     }
   }
   ```
3. **Document common use cases** in the `patterns` field
4. **Declare effects accurately** — agents rely on this for safety

### Creating a Shim

1. **Choose a popular CLI tool** without native ATIP support
2. **Study the tool's documentation** and `--help` output
3. **Create a JSON file** in `shims/{tool-name}.json`
4. **Validate** against the schema:
   ```bash
   # Using a JSON schema validator
   ajv validate -s schema/0.4.json -d shims/your-tool.json
   ```
5. **Test** with an ATIP-aware agent if possible
6. **Submit a PR** (see Pull Request Process below)

### Shim Quality Checklist

- [ ] Covers the most common commands (80/20 rule)
- [ ] Effects metadata is accurate and conservative
- [ ] Includes at least 2-3 usage patterns
- [ ] Argument types are specific (not just "string" everywhere)
- [ ] Enum values are provided where applicable
- [ ] Optional vs. required arguments are correct
- [ ] File includes a top-level comment with tool version tested against

### Example Shim Structure

```json
{
  "atip": {"version": "0.4"},
  "name": "curl",
  "version": "8.4.0",
  "description": "Transfer data from or to a server",
  "trust": {
    "source": "community",
    "verified": false
  },
  "commands": {
    "": {
      "description": "Make HTTP request",
      "arguments": [
        {"name": "url", "type": "url", "required": true, "description": "URL to request"}
      ],
      "options": [
        {
          "name": "request",
          "flags": ["-X", "--request"],
          "type": "enum",
          "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
          "description": "HTTP method to use"
        },
        {
          "name": "data",
          "flags": ["-d", "--data"],
          "type": "string",
          "description": "Request body data"
        }
      ],
      "effects": {
        "network": true,
        "idempotent": false,
        "filesystem": {"write": false}
      }
    }
  },
  "patterns": [
    {
      "name": "get-json",
      "description": "Fetch JSON from API",
      "steps": [
        {"command": "curl -X GET {url} -H 'Accept: application/json'"}
      ]
    }
  ]
}
```

---

## Proposing Spec Changes

Changes to the ATIP specification follow a structured process to ensure quality and community consensus.

### Change Categories

| Type | Examples | Process |
|------|----------|---------|
| **Typo/Editorial** | Fix grammar, clarify wording | Direct PR |
| **Minor Addition** | New optional field | Issue → Proposal → PR |
| **Breaking Change** | Remove/rename field, change semantics | RFC → Discussion → Implementation |

### RFC Process (for significant changes)

1. **Open an issue** with the `proposal` label describing:
   - **Problem statement** — What gap does this address?
   - **Proposed solution** — Specific changes to the spec
   - **Alternatives considered** — Why is this the best approach?
   - **Backwards compatibility** — Will this break existing implementations?
   - **Migration path** — How do users upgrade?

2. **Community discussion** (minimum 1 week)
   - Maintainers and community provide feedback
   - Proposal is refined based on input

3. **Approval decision**
   - Maintainers assess consensus
   - Proposal is approved, rejected, or sent back for revision

4. **Implementation**
   - Update specification
   - Update JSON schema
   - Add examples demonstrating the change
   - Update reference implementations

5. **Version bump**
   - Minor version for backwards-compatible additions
   - Major version for breaking changes

### Versioning Policy

ATIP uses semantic versioning for the specification:

| Change | Version Bump | Example |
|--------|--------------|---------|
| New optional field | Minor (0.x.0) | 0.4.0 → 0.5.0 |
| New required field | Major (x.0.0) | 0.4.0 → 1.0.0 |
| Field deprecation | Minor (0.x.0) | With transition period |
| Field removal | Major (x.0.0) | After deprecation period |
| Editorial/typos | Patch (0.0.x) | 0.4.0 → 0.4.1 |

---

## Development Setup

### Prerequisites

- Git
- Node.js 18+ (for schema validation and reference implementations)
- Python 3.9+ (for reference implementations)
- A JSON schema validator (e.g., `ajv-cli`)

### Setup

```bash
# Clone the repository
git clone https://github.com/lenulus/atip.git
cd atip

# Install development dependencies
npm install

# Validate all examples against schema
npm run validate

# Run tests (once reference implementation exists)
npm test
```

### Repository Structure

```
atip/
├── spec/rfc.md              # Source of truth
├── schema/0.4.json          # Generated from spec
├── examples/                # Must validate against schema
├── shims/                   # Community contributions
├── reference/               # Reference implementations
└── docs/                    # Additional documentation
```

---

## Style Guidelines

### JSON Files

- **Indent**: 2 spaces
- **No trailing commas**
- **Sort object keys** alphabetically (except for `atip`, `name`, `version` at top)
- **Use double quotes** for strings
- **Include trailing newline**

Example:
```json
{
  "atip": {"version": "0.4"},
  "name": "example",
  "version": "1.0.0",
  "authentication": {...},
  "commands": {...},
  "description": "...",
  "effects": {...}
}
```

### Markdown Files

- **Headers**: Use ATX style (`#` not `===`)
- **Line length**: Aim for 80 characters (not strict)
- **Code blocks**: Always specify language
- **Links**: Use reference-style for repeated URLs

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature or spec addition
- `fix`: Bug fix or correction
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `refactor`: Code/structure improvements
- `test`: Test additions or fixes

Examples:
```
feat(schema): add trust.attestation field

Add support for attestation URLs to allow tools to provide
verification endpoints for metadata accuracy.

Closes #42
```

```
docs(contributing): clarify shim submission process
```

---

## Pull Request Process

### Before Submitting

1. **Validate** your changes:
   ```bash
   # For JSON files
   npm run validate

   # For spec changes, ensure examples still pass
   npm run test-examples
   ```

2. **Test** if applicable:
   - Shims: Test with an ATIP-aware agent
   - Schema: Validate all examples still pass
   - Code: Run test suite

3. **Update documentation**:
   - Add/update examples if needed
   - Update CHANGELOG.md for spec changes
   - Update README.md if adding new features

### Submitting the PR

1. **Create a descriptive title**:
   ```
   Add shim for kubectl
   Fix typo in effects schema documentation
   Propose new field for tool dependencies
   ```

2. **Fill out the PR template** including:
   - What changed and why
   - Related issues
   - Testing performed
   - Breaking changes (if any)

3. **Link related issues** using keywords:
   ```
   Closes #123
   Fixes #456
   Relates to #789
   ```

### Review Process

1. **Automated checks** must pass:
   - Schema validation
   - Linting
   - Tests (when available)

2. **Maintainer review**:
   - At least one maintainer approval required
   - May request changes or clarification

3. **Community review**:
   - Complex changes may be left open for community input
   - Non-trivial changes wait 3-7 days for feedback

4. **Merge**:
   - Maintainer merges once approved
   - PR author may be asked to squash commits

### After Merge

- Changes appear in next release
- Major changes announced in discussions
- Your contribution is credited in CHANGELOG.md

---

## Getting Help

- **Questions about the spec?** Open a discussion
- **Not sure if your idea fits?** Open an issue to discuss first
- **Need help with a shim?** Ask in discussions or open a draft PR

---

## Recognition

Contributors are recognized in:
- CHANGELOG.md for each release
- GitHub contributors page
- Special recognition for significant contributions

Thank you for helping make ATIP better! 🚀
