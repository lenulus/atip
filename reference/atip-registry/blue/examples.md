# Usage Examples: atip-registry

## Basic Usage

### Example 1: Initialize a New Registry

Create a new ATIP registry with default configuration.

```bash
mkdir my-registry && cd my-registry
atip-registry init --name "My Company Registry" --url "https://atip.example.com"
```

**Expected Output**:
```json
{
  "initialized": true,
  "path": "/home/user/my-registry",
  "manifest": "/home/user/my-registry/.well-known/atip-registry.json",
  "config": "/home/user/my-registry/config.yaml"
}
```

**Created Directory Structure**:
```
my-registry/
├── .well-known/
│   └── atip-registry.json
├── shims/
│   └── sha256/
├── manifests/
└── config.yaml
```

**Generated Manifest** (`.well-known/atip-registry.json`):
```json
{
  "atip": {"version": "0.6"},
  "registry": {
    "name": "My Company Registry",
    "url": "https://atip.example.com",
    "type": "static",
    "version": "2026.01.15"
  },
  "endpoints": {
    "shims": "/shims/sha256/{hash}.json",
    "signatures": "/shims/sha256/{hash}.json.bundle",
    "catalog": "/shims/index.json"
  },
  "trust": {
    "requireSignatures": false,
    "signers": []
  }
}
```

**Explanation**: The `init` command creates the directory structure defined in spec section 4.4.1 and generates a registry manifest.

---

### Example 2: Start the Registry Server

Start the HTTP server to serve shims.

```bash
atip-registry serve --addr :8080
```

**Expected Output** (stderr):
```
2026/01/15 10:30:00 INFO Starting ATIP registry server
2026/01/15 10:30:00 INFO Loaded 0 shims from storage
2026/01/15 10:30:00 INFO Server listening addr=:8080
```

**Verify with curl**:
```bash
curl http://localhost:8080/.well-known/atip-registry.json
```

```json
{
  "atip": {"version": "0.6"},
  "registry": {
    "name": "My Company Registry",
    "url": "https://atip.example.com",
    "type": "static",
    "version": "2026.01.15"
  },
  "endpoints": {...}
}
```

**Explanation**: The server starts and serves the registry manifest at the well-known URL per spec section 4.4.2.

---

### Example 3: Add a Shim Manually

Add a pre-created shim file to the registry.

```bash
# Create a shim file
cat > curl-darwin-arm64.json << 'EOF'
{
  "atip": {"version": "0.6"},
  "binary": {
    "hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "name": "curl",
    "version": "8.5.0",
    "platform": "darwin-arm64"
  },
  "name": "curl",
  "version": "8.5.0",
  "description": "Transfer data from or to a server",
  "trust": {
    "source": "community",
    "verified": true
  },
  "commands": {
    "": {
      "description": "Transfer a URL",
      "options": [
        {"name": "request", "flags": ["-X", "--request"], "type": "enum",
         "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
         "description": "HTTP method to use"},
        {"name": "data", "flags": ["-d", "--data"], "type": "string",
         "description": "Data to send in request body"},
        {"name": "header", "flags": ["-H", "--header"], "type": "string",
         "variadic": true, "description": "Custom header to include"},
        {"name": "output", "flags": ["-o", "--output"], "type": "file",
         "description": "Write output to file"}
      ],
      "effects": {
        "network": true,
        "idempotent": false,
        "filesystem": {"write": true}
      }
    }
  }
}
EOF

# Add to registry
atip-registry add curl-darwin-arm64.json
```

**Expected Output**:
```json
{
  "added": true,
  "hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "path": "./shims/sha256/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.json",
  "signed": false
}
```

**Verify via HTTP**:
```bash
curl http://localhost:8080/shims/sha256/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.json
```

**Explanation**: The `add` command validates the shim against the ATIP 0.6 schema and stores it using the hash as the filename per spec section 4.4.1.

---

### Example 4: Fetch a Shim by Hash

Retrieve shim metadata from the registry.

```bash
curl -i http://localhost:8080/shims/sha256/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.json
```

**Expected Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=86400, immutable
ETag: "abc123def456..."

{
  "atip": {"version": "0.6"},
  "binary": {
    "hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "name": "curl",
    "version": "8.5.0",
    "platform": "darwin-arm64"
  },
  ...
}
```

**Conditional Request** (using ETag):
```bash
curl -i -H 'If-None-Match: "abc123def456..."' \
  http://localhost:8080/shims/sha256/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.json
```

**Expected Response**:
```http
HTTP/1.1 304 Not Modified
ETag: "abc123def456..."
```

**Explanation**: The server returns caching headers per spec section 4.7. The `immutable` directive indicates the content will not change for this hash.

---

## Signing and Verification

### Example 5: Sign a Shim with Cosign

Sign a shim using keyless Cosign (OIDC).

```bash
# Ensure COSIGN_EXPERIMENTAL is set for keyless signing
export COSIGN_EXPERIMENTAL=1

# Sign the shim
atip-registry sign a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

**Interactive Output** (opens browser for OIDC):
```
Opening browser for authentication...
Successfully signed shim

{
  "signed": true,
  "shim_path": "./shims/sha256/a1b2c3d4...a1b2.json",
  "bundle_path": "./shims/sha256/a1b2c3d4...a1b2.json.bundle",
  "identity": "user@example.com",
  "issuer": "https://accounts.google.com"
}
```

**Result**: Creates `.json.bundle` file alongside the shim.

**Explanation**: Keyless Cosign uses OIDC to identify the signer. The bundle contains the signature, certificate, and rekor entry.

---

### Example 6: Verify a Shim Signature

Verify that a shim was signed by an expected identity.

```bash
atip-registry verify a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 \
  --identity "shim-maintainers@atip.dev" \
  --issuer "https://accounts.google.com"
```

**Expected Output** (success):
```json
{
  "verified": true,
  "shim_path": "./shims/sha256/a1b2c3d4...a1b2.json",
  "signer": {
    "identity": "shim-maintainers@atip.dev",
    "issuer": "https://accounts.google.com"
  }
}
```

**Expected Output** (failure):
```json
{
  "verified": false,
  "error": "identity mismatch: expected shim-maintainers@atip.dev, got user@example.com"
}
```

**Exit Code**: `0` on success, `2` on verification failure.

**Explanation**: Verification checks that the signature was created by the expected OIDC identity, per spec section 3.2.2.

---

## Crawler Usage

### Example 7: Create a Tool Manifest

Create a YAML manifest for the crawler.

```bash
mkdir -p manifests

cat > manifests/jq.yaml << 'EOF'
name: jq
homepage: https://jqlang.github.io/jq/
description: Lightweight and flexible command-line JSON processor

sources:
  github:
    repo: jqlang/jq
    asset_patterns:
      linux-amd64: "jq-linux-amd64"
      linux-arm64: "jq-linux-arm64"
      darwin-amd64: "jq-macos-amd64"
      darwin-arm64: "jq-macos-arm64"
      windows-amd64: "jq-windows-amd64.exe"
    binary_path: ""  # Direct binary, no archive

template: |
  {
    "commands": {
      "": {
        "description": "Filter JSON input",
        "arguments": [
          {"name": "filter", "type": "string", "required": true,
           "description": "jq filter expression"}
        ],
        "options": [
          {"name": "raw-output", "flags": ["-r", "--raw-output"], "type": "boolean",
           "description": "Output raw strings, not JSON texts"},
          {"name": "compact-output", "flags": ["-c", "--compact-output"], "type": "boolean",
           "description": "Compact output"},
          {"name": "slurp", "flags": ["-s", "--slurp"], "type": "boolean",
           "description": "Read entire input into array"},
          {"name": "null-input", "flags": ["-n", "--null-input"], "type": "boolean",
           "description": "Don't read any input"}
        ],
        "effects": {
          "network": false,
          "idempotent": true,
          "filesystem": {"read": true}
        }
      }
    }
  }
EOF
```

**Explanation**: The manifest defines where to find binaries (GitHub Releases) and a template for the shim metadata per spec section 4.10.2.

---

### Example 8: Run the Crawler

Generate shims for a tool.

```bash
# Set GitHub token for API access
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Crawl for jq
atip-registry crawl jq
```

**Expected Output**:
```json
{
  "crawled": 1,
  "new_releases": 1,
  "shims_generated": 5,
  "duration_ms": 12340,
  "tools": [
    {
      "name": "jq",
      "version": "1.7.1",
      "platforms": ["linux-amd64", "linux-arm64", "darwin-amd64", "darwin-arm64", "windows-amd64"],
      "shims": [
        {"hash": "sha256:1111...", "platform": "linux-amd64"},
        {"hash": "sha256:2222...", "platform": "linux-arm64"},
        {"hash": "sha256:3333...", "platform": "darwin-amd64"},
        {"hash": "sha256:4444...", "platform": "darwin-arm64"},
        {"hash": "sha256:5555...", "platform": "windows-amd64"}
      ]
    }
  ],
  "errors": []
}
```

**Generated Files**:
```
shims/sha256/
├── 1111111111111111111111111111111111111111111111111111111111111111.json
├── 2222222222222222222222222222222222222222222222222222222222222222.json
├── 3333333333333333333333333333333333333333333333333333333333333333.json
├── 4444444444444444444444444444444444444444444444444444444444444444.json
└── 5555555555555555555555555555555555555555555555555555555555555555.json
```

**Explanation**: The crawler downloads each platform binary, computes its SHA-256 hash, and generates a shim using the template per spec section 4.10.1.

---

### Example 9: Check for New Releases (Dry Run)

Check for updates without downloading.

```bash
atip-registry crawl --check-only
```

**Expected Output**:
```json
{
  "tools": [
    {
      "name": "curl",
      "current_version": "8.4.0",
      "latest_version": "8.5.0",
      "new_release": true,
      "missing_platforms": ["linux-arm64"]
    },
    {
      "name": "jq",
      "current_version": "1.7.1",
      "latest_version": "1.7.1",
      "new_release": false,
      "missing_platforms": []
    }
  ]
}
```

**Explanation**: Check-only mode queries release APIs without downloading binaries, useful for monitoring.

---

### Example 10: Crawl Specific Platforms

Generate shims for only certain platforms.

```bash
atip-registry crawl curl --platform=linux-amd64,darwin-arm64
```

**Expected Output**:
```json
{
  "crawled": 1,
  "new_releases": 1,
  "shims_generated": 2,
  "duration_ms": 8500,
  "tools": [
    {
      "name": "curl",
      "version": "8.5.0",
      "platforms": ["linux-amd64", "darwin-arm64"],
      "shims": [
        {"hash": "sha256:aaaa...", "platform": "linux-amd64"},
        {"hash": "sha256:bbbb...", "platform": "darwin-arm64"}
      ]
    }
  ],
  "errors": []
}
```

**Explanation**: Platform filtering reduces download time when only certain platforms are needed.

---

## Syncing from Remote Registries

### Example 11: Sync from Community Registry

Download shims from the public ATIP registry.

```bash
atip-registry sync https://atip.dev
```

**Expected Output**:
```json
{
  "synced": 127,
  "unchanged": 4144,
  "failed": 0,
  "duration_ms": 45000,
  "registry": "https://atip.dev",
  "shims": [
    {
      "hash": "sha256:aaaa...",
      "name": "curl",
      "version": "8.5.0",
      "platform": "linux-amd64",
      "status": "new"
    },
    {
      "hash": "sha256:bbbb...",
      "name": "gh",
      "version": "2.46.0",
      "platform": "darwin-arm64",
      "status": "updated"
    }
  ]
}
```

**Explanation**: Sync downloads new and updated shims from the remote registry, respecting ETag for conditional requests per spec section 4.7.

---

### Example 12: Sync Specific Tools

Sync only certain tools from the remote registry.

```bash
atip-registry sync https://atip.dev --tools=curl,jq,gh
```

**Expected Output**:
```json
{
  "synced": 15,
  "unchanged": 12,
  "failed": 0,
  "duration_ms": 3500,
  "registry": "https://atip.dev"
}
```

**Explanation**: Filtering by tool name reduces sync time for targeted updates.

---

### Example 13: Sync with Signature Verification

Force signature verification on sync.

```bash
atip-registry sync https://atip.dev --verify-signatures
```

**Expected Output** (success):
```json
{
  "synced": 127,
  "unchanged": 4144,
  "failed": 0,
  "verified": 127,
  "duration_ms": 52000,
  "registry": "https://atip.dev"
}
```

**Expected Output** (verification failure):
```json
{
  "synced": 125,
  "unchanged": 4144,
  "failed": 2,
  "verified": 125,
  "duration_ms": 51000,
  "errors": [
    {
      "hash": "sha256:cccc...",
      "error": "signature verification failed: bundle not found"
    },
    {
      "hash": "sha256:dddd...",
      "error": "signature verification failed: identity mismatch"
    }
  ]
}
```

**Exit Code**: `1` if any verifications fail.

**Explanation**: When `--verify-signatures` is set, each shim's signature bundle is verified against the registry's trusted signers.

---

### Example 14: Dry Run Sync

Preview what would be synced without making changes.

```bash
atip-registry sync https://atip.dev --dry-run
```

**Expected Output**:
```json
{
  "would_sync": {
    "new": 45,
    "updated": 12,
    "unchanged": 4214
  },
  "tools": [
    {"name": "curl", "version": "8.5.0", "action": "new"},
    {"name": "gh", "version": "2.46.0", "action": "update"}
  ]
}
```

**Explanation**: Dry run compares local and remote catalogs without downloading shims.

---

## Catalog Management

### Example 15: Build Catalog Index

Rebuild the catalog from shim files.

```bash
atip-registry catalog build
```

**Expected Output**:
```json
{
  "built": true,
  "tools": 127,
  "shims": 543,
  "path": "./shims/index.json"
}
```

**Generated Catalog** (`shims/index.json`):
```json
{
  "version": "1",
  "updated": "2026-01-15T10:30:00Z",
  "tools": {
    "curl": {
      "description": "Transfer data from or to a server",
      "homepage": "https://curl.se",
      "versions": {
        "8.4.0": {
          "linux-amd64": "sha256:a1b2c3d4...",
          "darwin-arm64": "sha256:b2c3d4e5..."
        },
        "8.5.0": {
          "linux-amd64": "sha256:c3d4e5f6...",
          "darwin-arm64": "sha256:d4e5f6g7..."
        }
      }
    },
    "jq": {...}
  },
  "totalShims": 543
}
```

**Explanation**: The catalog provides a browsable index per spec section 4.4.4.

---

### Example 16: View Catalog Statistics

Show coverage statistics for the registry.

```bash
atip-registry catalog stats
```

**Expected Output**:
```json
{
  "total_tools": 127,
  "total_shims": 543,
  "platforms": {
    "linux-amd64": 127,
    "linux-arm64": 98,
    "darwin-amd64": 115,
    "darwin-arm64": 121,
    "windows-amd64": 82
  },
  "by_source": {
    "native": 12,
    "community": 98,
    "inferred": 17
  },
  "missing": [
    {"name": "ffmpeg", "platforms": ["windows-amd64"]},
    {"name": "imagemagick", "platforms": ["darwin-arm64", "windows-amd64"]}
  ]
}
```

**Explanation**: Statistics help identify gaps in platform coverage per spec section 4.10.5.

---

## Error Handling

### Example 17: Invalid Hash Format

Request a shim with an invalid hash.

```bash
curl -i http://localhost:8080/shims/sha256/invalid-hash.json
```

**Expected Response**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_hash",
  "message": "hash must be 64 lowercase hex characters"
}
```

**Explanation**: The server validates hash format before attempting to load the shim.

---

### Example 18: Shim Not Found

Request a shim that doesn't exist.

```bash
curl -i http://localhost:8080/shims/sha256/0000000000000000000000000000000000000000000000000000000000000000.json
```

**Expected Response**:
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "not_found",
  "message": "no shim for hash 0000000000000000000000000000000000000000000000000000000000000000"
}
```

**Explanation**: The server returns a descriptive 404 for missing shims.

---

### Example 19: Validation Error on Add

Attempt to add an invalid shim.

```bash
cat > invalid.json << 'EOF'
{
  "atip": {"version": "0.6"},
  "name": "test"
}
EOF

atip-registry add invalid.json
```

**Expected Output** (stderr):
```
Error: validation failed: missing required field "version"
```

**Exit Code**: `2`

**Explanation**: All shims are validated against the ATIP 0.6 schema before being added.

---

### Example 20: Hash Mismatch

Add a shim where the filename doesn't match the content hash.

```bash
cp some-shim.json wrong-hash.json
atip-registry add wrong-hash.json
```

**Expected Output** (stderr):
```
Warning: Filename 'wrong-hash.json' does not match binary.hash
Shim will be stored as: shims/sha256/{actual-hash}.json
```

**Explanation**: The server uses the hash from `binary.hash` field, not the filename.

---

## Server Configuration

### Example 21: TLS Configuration

Start server with TLS.

```bash
atip-registry serve \
  --addr :8443 \
  --tls-cert /path/to/cert.pem \
  --tls-key /path/to/key.pem
```

**Expected Output**:
```
2026/01/15 10:30:00 INFO Starting ATIP registry server
2026/01/15 10:30:00 INFO TLS enabled cert=/path/to/cert.pem
2026/01/15 10:30:00 INFO Server listening addr=:8443
```

**Explanation**: TLS is recommended for production deployments.

---

### Example 22: Read-Only Mode

Start server in read-only mode (for mirroring).

```bash
atip-registry serve --read-only
```

**Expected Behavior**:
- GET requests work normally
- POST/PUT requests return 405 Method Not Allowed
- CLI commands that write (add, sign) are disabled

**Explanation**: Read-only mode is useful for mirrors and CDN origins.

---

### Example 23: Metrics Endpoint

Enable Prometheus metrics.

```bash
atip-registry serve --metrics-addr :9090
```

**Metrics available at** `http://localhost:9090/metrics`:
```
# HELP atip_registry_shims_total Total number of shims
# TYPE atip_registry_shims_total gauge
atip_registry_shims_total 543

# HELP atip_registry_requests_total Total HTTP requests
# TYPE atip_registry_requests_total counter
atip_registry_requests_total{method="GET",path="/shims/sha256/",status="200"} 1234
atip_registry_requests_total{method="GET",path="/shims/sha256/",status="404"} 56
```

**Explanation**: Metrics help monitor registry health and usage patterns.

---

## Integration Examples

### Example 24: Agent Integration

How an agent discovers and uses the registry.

```bash
#!/bin/bash

# 1. Compute hash of local binary
BINARY_PATH="/usr/local/bin/curl"
HASH=$(sha256sum "$BINARY_PATH" | cut -d' ' -f1)
echo "Binary hash: $HASH"

# 2. Query registry for shim
REGISTRY="https://atip.dev"
SHIM_URL="${REGISTRY}/shims/sha256/${HASH}.json"

# 3. Fetch shim (with caching)
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/atip/shims"
mkdir -p "$CACHE_DIR"
CACHE_FILE="$CACHE_DIR/${HASH}.json"

if [ -f "$CACHE_FILE" ]; then
    # Conditional fetch
    ETAG=$(cat "$CACHE_FILE.etag" 2>/dev/null)
    RESPONSE=$(curl -s -w "\n%{http_code}" -H "If-None-Match: $ETAG" "$SHIM_URL")
    STATUS=$(echo "$RESPONSE" | tail -1)

    if [ "$STATUS" = "304" ]; then
        echo "Using cached shim"
        cat "$CACHE_FILE"
    elif [ "$STATUS" = "200" ]; then
        echo "Updating cached shim"
        echo "$RESPONSE" | head -n -1 > "$CACHE_FILE"
        curl -sI "$SHIM_URL" | grep -i etag | cut -d' ' -f2 > "$CACHE_FILE.etag"
        cat "$CACHE_FILE"
    fi
else
    # Fresh fetch
    curl -s "$SHIM_URL" > "$CACHE_FILE"
    curl -sI "$SHIM_URL" | grep -i etag | cut -d' ' -f2 > "$CACHE_FILE.etag"
    cat "$CACHE_FILE"
fi
```

**Explanation**: Agents compute the binary hash, query the registry, and cache the shim with ETag for efficient updates per spec section 4.7.

---

### Example 25: CI/CD Pipeline Integration

Use the registry in a CI pipeline to generate shims on release.

```yaml
# .github/workflows/publish-shims.yml
name: Publish ATIP Shims

on:
  release:
    types: [published]

jobs:
  generate-shims:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install atip-registry
        run: go install github.com/atip/atip-registry@latest

      - name: Download release assets
        run: |
          gh release download ${{ github.event.release.tag_name }} \
            --pattern '*.tar.gz' --dir ./dist

      - name: Generate shims
        run: |
          for asset in ./dist/*.tar.gz; do
            # Extract binary
            tar xzf "$asset" -C ./dist

            # Find binary
            BINARY=$(find ./dist -type f -executable | head -1)

            # Compute hash
            HASH=$(sha256sum "$BINARY" | cut -d' ' -f1)

            # Generate shim
            atip-registry crawl --from-binary "$BINARY" \
              --hash "$HASH" \
              --template ./shim-template.json \
              --output "./shims/${HASH}.json"
          done

      - name: Sign shims
        env:
          COSIGN_EXPERIMENTAL: 1
        run: |
          for shim in ./shims/*.json; do
            atip-registry sign "$shim"
          done

      - name: Upload to registry
        run: |
          for shim in ./shims/*.json; do
            aws s3 cp "$shim" "s3://atip-registry/shims/sha256/"
            aws s3 cp "${shim}.bundle" "s3://atip-registry/shims/sha256/"
          done
```

**Explanation**: Automated shim generation and signing on release ensures the registry stays up-to-date.

---

### Example 26: Docker Deployment

Deploy the registry as a Docker container.

```dockerfile
# Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o atip-registry ./cmd/atip-registry

FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/atip-registry /usr/local/bin/
EXPOSE 8080
ENTRYPOINT ["atip-registry", "serve"]
CMD ["--addr", ":8080"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  registry:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - ATIP_REGISTRY_DATA_DIR=/data

  # Optional: Nginx for TLS termination
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - registry
```

```bash
# Run
docker-compose up -d

# Test
curl https://localhost/.well-known/atip-registry.json
```

**Explanation**: Docker deployment provides a consistent environment and easy scaling.

---

### Example 27: ATIP Metadata for atip-registry

The registry itself implements `--agent` for dogfooding.

```bash
atip-registry --agent
```

**Expected Output**:
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

**Explanation**: The registry implements `--agent` per the dogfooding requirement in TODO.md Phase 4.5.
