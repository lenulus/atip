# API Specification: atip-registry

## Overview

`atip-registry` is a Go server and CLI tool that implements the ATIP content-addressable registry protocol (spec section 4.4). It provides:

1. **Registry Server** - Static file serving for shims indexed by binary hash
2. **Community Crawler** - Automated shim generation from tool releases
3. **Sync Client** - Download and cache shims from remote registries
4. **CLI Management** - Add, sign, and manage shims locally

The server is designed for deployment as a single binary or Docker container. It serves static files with proper caching headers and optional signature verification.

---

## HTTP API Endpoints

### Registry Manifest

```
GET /.well-known/atip-registry.json
```

Returns the registry manifest describing available endpoints and trust requirements.

**Response** (200 OK):
```json
{
  "atip": {"version": "0.6"},
  "registry": {
    "name": "ATIP Community Registry",
    "url": "https://atip.dev",
    "type": "static",
    "version": "2026.01.15"
  },
  "endpoints": {
    "shims": "/shims/sha256/{hash}.json",
    "signatures": "/shims/sha256/{hash}.json.bundle",
    "catalog": "/shims/index.json"
  },
  "trust": {
    "requireSignatures": true,
    "signers": [
      {"identity": "shim-maintainers@atip.dev", "issuer": "https://accounts.google.com"}
    ]
  }
}
```

**Headers**:
- `Content-Type: application/json`
- `Cache-Control: public, max-age=3600` (1 hour)

**Contract**:
- MUST return valid JSON matching spec section 4.4.2
- MUST include all required fields
- The `version` field SHOULD be updated when registry content changes

---

### Fetch Shim by Hash

```
GET /shims/sha256/{hash}.json
```

Retrieves ATIP shim metadata for a specific binary hash.

**Path Parameters**:
- `hash` (required): SHA-256 hash of the binary (64 hex characters, lowercase)

**Response** (200 OK):
```json
{
  "atip": {"version": "0.6"},
  "binary": {
    "hash": "sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
    "name": "curl",
    "version": "8.4.0",
    "platform": "darwin-arm64"
  },
  "trust": {
    "source": "community",
    "verified": true
  },
  "description": "Transfer data from or to a server",
  "commands": {...}
}
```

**Headers**:
- `Content-Type: application/json`
- `Cache-Control: public, max-age=86400, immutable` (24 hours, per spec section 4.7)
- `ETag: "abc123..."` (content hash for conditional requests)

**Error Responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid hash format | `{"error": "invalid_hash", "message": "hash must be 64 lowercase hex characters"}` |
| 404 | Shim not found | `{"error": "not_found", "message": "no shim for hash a1b2c3..."}` |

**Contract**:
- Hash in URL MUST match `binary.hash` field in response (minus `sha256:` prefix)
- Response MUST validate against ATIP 0.6 schema
- Server MUST support conditional requests via `If-None-Match` header

---

### Fetch Signature Bundle

```
GET /shims/sha256/{hash}.json.bundle
```

Retrieves the Cosign signature bundle for a shim.

**Path Parameters**:
- `hash` (required): SHA-256 hash of the binary (64 hex characters)

**Response** (200 OK):
Binary Cosign bundle file.

**Headers**:
- `Content-Type: application/octet-stream`
- `Cache-Control: public, max-age=86400, immutable`

**Error Responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Bundle not found | `{"error": "not_found", "message": "no signature bundle for hash"}` |

**Contract**:
- Bundle MUST be valid Cosign format
- Bundle signs the corresponding `.json` file, not the binary

---

### Catalog Index

```
GET /shims/index.json
```

Returns a browsable catalog of all shims in the registry.

**Response** (200 OK):
```json
{
  "version": "1",
  "updated": "2026-01-15T00:00:00Z",
  "tools": {
    "curl": {
      "description": "Transfer data from or to a server",
      "homepage": "https://curl.se",
      "versions": {
        "8.4.0": {
          "linux-amd64": "sha256:a1b2c3d4...",
          "linux-arm64": "sha256:b2c3d4e5...",
          "darwin-amd64": "sha256:c3d4e5f6...",
          "darwin-arm64": "sha256:d4e5f6g7..."
        },
        "8.5.0": {
          "linux-amd64": "sha256:e5f6g7h8...",
          "darwin-arm64": "sha256:f6g7h8i9..."
        }
      }
    },
    "gh": {
      "description": "GitHub CLI",
      "homepage": "https://cli.github.com",
      "note": "Native ATIP support via --agent flag",
      "versions": {...}
    }
  },
  "totalShims": 4271,
  "coverage": {
    "tracked_tools": 847,
    "platforms": {
      "linux-amd64": 847,
      "linux-arm64": 623,
      "darwin-arm64": 712,
      "darwin-amd64": 698,
      "windows-amd64": 412
    },
    "by_source": {
      "native": 23,
      "community": 612,
      "inferred": 212
    }
  }
}
```

**Headers**:
- `Content-Type: application/json`
- `Cache-Control: public, max-age=3600` (1 hour, catalog changes more frequently)
- `ETag: "catalog-v123"`

**Contract**:
- Catalog is informational, not required for agent operation
- `tools[name].versions[version][platform]` maps to shim hash
- May be paginated for very large registries (future extension)

---

### Health Check

```
GET /health
```

Returns server health status.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 86400,
  "shim_count": 4271,
  "storage": {
    "type": "filesystem",
    "path": "/data/shims",
    "writable": true
  }
}
```

**Contract**:
- Returns 200 if server can serve requests
- Returns 503 if server is unhealthy

---

## CLI Interface

### Global Flags

```
atip-registry [global-flags] <command> [command-flags] [arguments]
```

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--config` | `-c` | string | `./config.yaml` | Path to config file |
| `--data-dir` | `-d` | string | `./data` | Path to data directory |
| `--verbose` | `-v` | bool | `false` | Enable verbose logging |
| `--help` | `-h` | bool | `false` | Show help message |
| `--version` | | bool | `false` | Show version information |
| `--agent` | | bool | `false` | Output ATIP metadata for this tool |

---

## Commands

### serve

Start the registry HTTP server.

```
atip-registry serve [flags]
```

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--addr` | `-a` | string | `:8080` | Listen address (host:port) |
| `--tls-cert` | | string | | TLS certificate file |
| `--tls-key` | | string | | TLS key file |
| `--read-only` | | bool | `false` | Disable write operations |
| `--cors-origin` | | string | `*` | CORS allowed origins |
| `--metrics-addr` | | string | | Prometheus metrics address |

**Behavior**:
1. Load configuration from file
2. Initialize storage backend
3. Load registry manifest and catalog
4. Start HTTP server with configured endpoints
5. Handle graceful shutdown on SIGTERM/SIGINT

**Exit Codes**:
- `0` - Clean shutdown
- `1` - Configuration error
- `2` - Storage initialization error
- `3` - Bind error (port in use)

---

### add

Add a shim to the registry.

```
atip-registry add [flags] <shim-file>
```

**Arguments**:
- `shim-file` (required): Path to shim JSON file

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--sign` | `-s` | bool | `false` | Sign with Cosign after adding |
| `--validate` | | bool | `true` | Validate against ATIP schema |
| `--overwrite` | | bool | `false` | Overwrite existing shim |

**Behavior**:
1. Read and parse shim file
2. Validate against ATIP 0.6 schema
3. Extract `binary.hash` from shim
4. Verify hash matches filename (if named by hash)
5. Copy to `shims/sha256/{hash}.json`
6. Optionally sign with Cosign
7. Update catalog index

**JSON Output**:
```json
{
  "added": true,
  "hash": "sha256:a1b2c3d4...",
  "path": "/data/shims/sha256/a1b2c3d4....json",
  "signed": true,
  "bundle_path": "/data/shims/sha256/a1b2c3d4....json.bundle"
}
```

**Exit Codes**:
- `0` - Shim added successfully
- `1` - Validation error
- `2` - Hash mismatch
- `3` - Write error

---

### sign

Sign a shim with Cosign.

```
atip-registry sign [flags] <hash-or-file>
```

**Arguments**:
- `hash-or-file` (required): Binary hash or path to shim file

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--identity` | | string | | OIDC identity for keyless signing |
| `--issuer` | | string | | OIDC issuer URL |
| `--key` | `-k` | string | | Path to private key (alternative to keyless) |
| `--output` | `-o` | string | | Output bundle path (default: same as shim + .bundle) |

**Behavior**:
1. Locate shim file by hash or path
2. Invoke `cosign sign-blob` with provided credentials
3. Create bundle file alongside shim
4. Verify signature after creation

**JSON Output**:
```json
{
  "signed": true,
  "shim_path": "/data/shims/sha256/a1b2c3d4....json",
  "bundle_path": "/data/shims/sha256/a1b2c3d4....json.bundle",
  "identity": "shim-maintainers@atip.dev",
  "issuer": "https://accounts.google.com"
}
```

**Exit Codes**:
- `0` - Signing successful
- `1` - Shim not found
- `2` - Cosign not installed
- `3` - Signing failed

---

### verify

Verify a shim signature.

```
atip-registry verify [flags] <hash-or-file>
```

**Arguments**:
- `hash-or-file` (required): Binary hash or path to shim file

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--identity` | | string | | Expected signer identity |
| `--issuer` | | string | | Expected OIDC issuer |
| `--bundle` | | string | | Path to bundle file (default: shim path + .bundle) |

**Behavior**:
1. Locate shim and bundle files
2. Invoke `cosign verify-blob`
3. Check identity and issuer match expectations

**JSON Output**:
```json
{
  "verified": true,
  "shim_path": "/data/shims/sha256/a1b2c3d4....json",
  "signer": {
    "identity": "shim-maintainers@atip.dev",
    "issuer": "https://accounts.google.com"
  }
}
```

**Exit Codes**:
- `0` - Verification successful
- `1` - Shim or bundle not found
- `2` - Verification failed
- `3` - Identity/issuer mismatch

---

### crawl

Run the community crawler to generate shims.

```
atip-registry crawl [flags] [tool-names...]
```

**Arguments**:
- `tool-names` (optional): Specific tools to crawl (default: all in manifests)

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--manifests-dir` | `-m` | string | `./manifests` | Directory containing tool manifests |
| `--check-only` | | bool | `false` | Check for updates without downloading |
| `--platform` | `-p` | []string | all | Platforms to crawl |
| `--parallel` | | int | `2` | Number of parallel downloads |
| `--sign` | | bool | `false` | Sign generated shims |
| `--output-dir` | `-o` | string | `./output` | Directory for generated shims |
| `--pr` | | bool | `false` | Create PR with generated shims |

**Behavior** (per spec section 4.10):
1. Load tool manifests from directory
2. For each tool, query sources for new releases
3. Download binaries for specified platforms
4. Compute SHA-256 hash of each binary
5. Generate shim from manifest template + `--help` parsing
6. Validate generated shim against schema
7. Optionally sign and create PR

**JSON Output**:
```json
{
  "crawled": 5,
  "new_releases": 2,
  "shims_generated": 8,
  "duration_ms": 45000,
  "tools": [
    {
      "name": "curl",
      "version": "8.5.0",
      "platforms": ["linux-amd64", "darwin-arm64"],
      "shims": [
        {"hash": "sha256:a1b2c3d4...", "platform": "linux-amd64"},
        {"hash": "sha256:b2c3d4e5...", "platform": "darwin-arm64"}
      ]
    }
  ],
  "errors": []
}
```

**Exit Codes**:
- `0` - Crawl completed successfully
- `1` - Some tools failed
- `2` - Manifest error
- `3` - Network error

---

### sync

Sync shims from a remote registry.

```
atip-registry sync [flags] <registry-url>
```

**Arguments**:
- `registry-url` (required): URL of remote registry to sync from

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--verify-signatures` | | bool | `true` | Verify shim signatures |
| `--tools` | | []string | all | Specific tools to sync |
| `--platforms` | | []string | all | Platforms to sync |
| `--force-refresh` | | bool | `false` | Ignore cached ETags |
| `--dry-run` | | bool | `false` | Show what would be synced |

**Behavior** (per spec section 4.7):
1. Fetch remote registry manifest
2. Fetch remote catalog
3. Compare with local catalog
4. Download new/updated shims with conditional requests (ETag)
5. Verify signatures if required
6. Update local catalog

**JSON Output**:
```json
{
  "synced": 15,
  "unchanged": 4256,
  "failed": 0,
  "duration_ms": 12000,
  "registry": "https://atip.dev",
  "shims": [
    {
      "hash": "sha256:a1b2c3d4...",
      "name": "curl",
      "version": "8.5.0",
      "platform": "linux-amd64",
      "status": "new"
    }
  ]
}
```

**Exit Codes**:
- `0` - Sync completed successfully
- `1` - Some shims failed to sync
- `2` - Registry unreachable
- `3` - Signature verification failed

---

### catalog

Manage the catalog index.

#### catalog build

Rebuild the catalog index from shim files.

```
atip-registry catalog build [flags]
```

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--output` | `-o` | string | `shims/index.json` | Output path |

**JSON Output**:
```json
{
  "built": true,
  "tools": 847,
  "shims": 4271,
  "path": "/data/shims/index.json"
}
```

#### catalog stats

Show catalog statistics.

```
atip-registry catalog stats
```

**JSON Output**:
```json
{
  "total_tools": 847,
  "total_shims": 4271,
  "platforms": {
    "linux-amd64": 847,
    "linux-arm64": 623,
    "darwin-arm64": 712,
    "darwin-amd64": 698,
    "windows-amd64": 412
  },
  "by_source": {
    "native": 23,
    "community": 612,
    "inferred": 212
  },
  "missing": [
    {"name": "ffmpeg", "platforms": ["windows-amd64"]},
    {"name": "imagemagick", "platforms": ["darwin-arm64", "windows-amd64"]}
  ]
}
```

---

### init

Initialize a new registry.

```
atip-registry init [flags] [directory]
```

**Arguments**:
- `directory` (optional): Directory to initialize (default: current)

**Flags**:

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--name` | | string | `My ATIP Registry` | Registry name |
| `--url` | | string | | Registry base URL |
| `--require-signatures` | | bool | `false` | Require shim signatures |

**Behavior**:
1. Create directory structure:
   ```
   directory/
   ├── .well-known/
   │   └── atip-registry.json
   ├── shims/
   │   └── sha256/
   ├── manifests/
   └── config.yaml
   ```
2. Generate registry manifest
3. Generate default config

**JSON Output**:
```json
{
  "initialized": true,
  "path": "/path/to/registry",
  "manifest": "/path/to/registry/.well-known/atip-registry.json",
  "config": "/path/to/registry/config.yaml"
}
```

---

## Data Types

### RegistryManifest

Per spec section 4.4.2:

```go
// RegistryManifest describes a registry and its capabilities.
type RegistryManifest struct {
    // ATIP protocol version.
    ATIP ATIPVersion `json:"atip"`

    // Registry information.
    Registry RegistryInfo `json:"registry"`

    // Endpoint URL templates.
    Endpoints Endpoints `json:"endpoints"`

    // Trust requirements.
    Trust TrustRequirements `json:"trust"`
}

type ATIPVersion struct {
    Version string `json:"version"`
}

type RegistryInfo struct {
    Name    string `json:"name"`
    URL     string `json:"url"`
    Type    string `json:"type"` // "static"
    Version string `json:"version"` // Date-based version
}

type Endpoints struct {
    Shims      string `json:"shims"`      // "/shims/sha256/{hash}.json"
    Signatures string `json:"signatures"` // "/shims/sha256/{hash}.json.bundle"
    Catalog    string `json:"catalog"`    // "/shims/index.json"
}

type TrustRequirements struct {
    RequireSignatures bool     `json:"requireSignatures"`
    Signers           []Signer `json:"signers"`
}

type Signer struct {
    Identity string `json:"identity"`
    Issuer   string `json:"issuer"`
}
```

### Shim

ATIP shim metadata (subset relevant to registry):

```go
// Shim is ATIP metadata for a specific binary.
type Shim struct {
    ATIP        ATIPVersion     `json:"atip"`
    Binary      BinaryInfo      `json:"binary"`
    Trust       TrustInfo       `json:"trust"`
    Name        string          `json:"name"`
    Version     string          `json:"version"`
    Description string          `json:"description"`
    Commands    json.RawMessage `json:"commands"` // Full command tree
}

type BinaryInfo struct {
    Hash     string `json:"hash"`     // "sha256:..."
    Name     string `json:"name"`     // Tool name
    Version  string `json:"version"`  // Tool version
    Platform string `json:"platform"` // "linux-amd64", etc.
}

type TrustInfo struct {
    Source   string `json:"source"` // "native", "community", "inferred"
    Verified bool   `json:"verified"`
}
```

### Catalog

Per spec section 4.4.4:

```go
// Catalog is the browsable index of all shims.
type Catalog struct {
    Version     string              `json:"version"`
    Updated     time.Time           `json:"updated"`
    Tools       map[string]ToolInfo `json:"tools"`
    TotalShims  int                 `json:"totalShims"`
    Coverage    Coverage            `json:"coverage,omitempty"`
}

type ToolInfo struct {
    Description string                       `json:"description"`
    Homepage    string                       `json:"homepage,omitempty"`
    Note        string                       `json:"note,omitempty"`
    Versions    map[string]map[string]string `json:"versions"` // version -> platform -> hash
}

type Coverage struct {
    TrackedTools int            `json:"tracked_tools"`
    Platforms    map[string]int `json:"platforms"`
    BySource     map[string]int `json:"by_source"`
    Missing      []MissingEntry `json:"missing,omitempty"`
}

type MissingEntry struct {
    Name      string   `json:"name"`
    Platforms []string `json:"platforms"`
}
```

### ToolManifest

Per spec section 4.10.2:

```go
// ToolManifest configures the crawler for a tool.
type ToolManifest struct {
    Name        string            `yaml:"name"`
    Homepage    string            `yaml:"homepage"`
    Description string            `yaml:"description"`
    Sources     SourceConfig      `yaml:"sources"`
    Template    string            `yaml:"template"` // JSON template for shim
}

type SourceConfig struct {
    GitHub   *GitHubSource   `yaml:"github,omitempty"`
    Homebrew *HomebrewSource `yaml:"homebrew,omitempty"`
    APT      *APTSource      `yaml:"apt,omitempty"`
}

type GitHubSource struct {
    Repo          string            `yaml:"repo"` // "owner/repo"
    AssetPatterns map[string]string `yaml:"asset_patterns"` // platform -> glob
    BinaryPath    string            `yaml:"binary_path"` // Path within archive
}

type HomebrewSource struct {
    Formula   string   `yaml:"formula"`
    Platforms []string `yaml:"platforms"`
}

type APTSource struct {
    Package   string   `yaml:"package"`
    Platforms []string `yaml:"platforms"`
}
```

---

## Configuration File

Located at `config.yaml`:

```yaml
# Registry configuration
registry:
  name: "My ATIP Registry"
  url: "https://registry.example.com"
  version: "2026.01.15"

# Server settings
server:
  addr: ":8080"
  read_timeout: 30s
  write_timeout: 30s
  tls:
    cert: ""
    key: ""

# Storage settings
storage:
  type: filesystem
  path: ./data
  # Or for S3:
  # type: s3
  # bucket: my-registry-bucket
  # prefix: shims/

# Trust requirements
trust:
  require_signatures: true
  signers:
    - identity: "shim-maintainers@atip.dev"
      issuer: "https://accounts.google.com"

# Crawler settings
crawler:
  manifests_dir: ./manifests
  output_dir: ./output
  parallelism: 2
  github_token_env: GITHUB_TOKEN

# Sync settings
sync:
  upstream_registries:
    - url: "https://atip.dev"
      priority: 100
      verify_signatures: true
  cache_ttl: 24h

# Logging
logging:
  level: info
  format: json
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ATIP_REGISTRY_CONFIG` | Config file path | `./config.yaml` |
| `ATIP_REGISTRY_DATA_DIR` | Data directory | `./data` |
| `ATIP_REGISTRY_ADDR` | Server listen address | `:8080` |
| `GITHUB_TOKEN` | GitHub API token for crawler | (none) |
| `COSIGN_EXPERIMENTAL` | Enable keyless Cosign | `1` |
| `ATIP_REFRESH` | Force cache refresh (per spec) | `0` |

---

## Exit Codes Summary

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Partial success / recoverable error |
| `2` | Configuration / validation error |
| `3` | Fatal / network error |

---

## ATIP Metadata (--agent)

When invoked with `--agent`, outputs:

```json
{
  "atip": {"version": "0.6"},
  "name": "atip-registry",
  "version": "0.1.0",
  "description": "Content-addressable registry server for ATIP shims",
  "homepage": "https://github.com/atip/atip-registry",
  "trust": {
    "source": "native",
    "verified": true
  },
  "commands": {
    "serve": {
      "description": "Start the registry HTTP server",
      "options": [
        {"name": "addr", "flags": ["-a", "--addr"], "type": "string",
         "default": ":8080", "description": "Listen address"}
      ],
      "effects": {
        "network": true,
        "idempotent": true
      }
    },
    "add": {
      "description": "Add a shim to the registry",
      "arguments": [
        {"name": "shim-file", "type": "file", "required": true,
         "description": "Path to shim JSON file"}
      ],
      "effects": {
        "filesystem": {"write": true},
        "idempotent": false
      }
    },
    "crawl": {
      "description": "Run the community crawler to generate shims",
      "effects": {
        "network": true,
        "filesystem": {"write": true},
        "idempotent": false,
        "duration": {"typical": "1-10m"}
      }
    },
    "sync": {
      "description": "Sync shims from a remote registry",
      "arguments": [
        {"name": "registry-url", "type": "url", "required": true,
         "description": "URL of remote registry"}
      ],
      "effects": {
        "network": true,
        "filesystem": {"write": true},
        "idempotent": true
      }
    }
  }
}
```
