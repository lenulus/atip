// Package registry provides content-addressable storage and retrieval
// for ATIP shim metadata. Shims are indexed by the SHA-256 hash of the
// binary they describe, enabling deterministic lookups and verification.
package registry

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	// HashPrefix is the standard prefix for SHA-256 hashes in ATIP metadata.
	HashPrefix = "sha256:"

	// HashLength is the expected length of a SHA-256 hash in hexadecimal (64 characters).
	HashLength = 64

	// ShimExtension is the file extension for ATIP shim files.
	ShimExtension = ".json"

	// BundleExtension is the file extension for Cosign signature bundles.
	BundleExtension = ".json.bundle"

	// ShimSubdir is the subdirectory path for storing shims.
	ShimSubdir = "shims/sha256"
)

var (
	// ErrNotFound indicates a shim was not found in the registry.
	ErrNotFound = errors.New("shim not found")

	// ErrInvalidHash indicates the hash format is invalid (must be 64 lowercase hex characters).
	ErrInvalidHash = errors.New("invalid hash format")

	// ErrHashMismatch indicates the hash value does not match the filename.
	ErrHashMismatch = errors.New("hash mismatch between metadata and filename")

	// ErrValidation indicates the shim failed schema or field validation.
	ErrValidation = errors.New("validation failed")
)

// hashRegex validates SHA-256 hashes (64 lowercase hex chars).
var hashRegex = regexp.MustCompile(`^[a-f0-9]{64}$`)

// Registry manages shim storage and retrieval using a content-addressable
// file system structure. Shims are stored as {hash}.json files organized
// by hash prefix for efficient lookups.
type Registry struct {
	dataDir string
}

// Catalog represents the browsable index of all shims in the registry.
// It provides a human-friendly view organized by tool name, version, and platform,
// mapping each combination to its content-addressable hash.
type Catalog struct {
	Version    string              `json:"version"`     // Catalog schema version
	Updated    time.Time           `json:"updated"`     // Last update timestamp
	Tools      map[string]ToolInfo `json:"tools"`       // Tool name -> ToolInfo
	TotalShims int                 `json:"totalShims"`  // Total number of shims
}

// ToolInfo describes a tool in the catalog, aggregating all available
// versions and platforms for that tool.
type ToolInfo struct {
	Description string                       `json:"description"`           // Tool description
	Homepage    string                       `json:"homepage,omitempty"`    // Tool homepage URL
	Versions    map[string]map[string]string `json:"versions"`              // version -> platform -> hash
}

// Shim represents ATIP metadata for a specific binary. It contains all
// the information an agent needs to understand and invoke the tool.
type Shim struct {
	ATIP        map[string]interface{} `json:"atip"`        // ATIP version info
	Binary      BinaryInfo             `json:"binary"`      // Binary identification
	Name        string                 `json:"name"`        // Tool name
	Version     string                 `json:"version"`     // Tool version
	Description string                 `json:"description"` // Tool description
	Trust       TrustInfo              `json:"trust"`       // Trust metadata
	Commands    json.RawMessage        `json:"commands"`    // Command tree (raw JSON)
}

// BinaryInfo identifies the specific binary this shim describes.
type BinaryInfo struct {
	Hash     string `json:"hash"`     // SHA-256 hash with "sha256:" prefix
	Name     string `json:"name"`     // Binary name
	Version  string `json:"version"`  // Binary version
	Platform string `json:"platform"` // Target platform (e.g., "linux-amd64")
}

// TrustInfo describes the provenance and verification status of the shim metadata.
type TrustInfo struct {
	Source   string `json:"source"`   // Source: "native", "community", or "inferred"
	Verified bool   `json:"verified"` // Whether signature has been verified
}

// Load creates a Registry instance from the specified data directory.
// The directory must exist; if it doesn't, an error is returned.
//
// The expected directory structure is:
//   - {dataDir}/shims/sha256/{hash}.json - Shim files
//   - {dataDir}/shims/sha256/{hash}.json.bundle - Signature bundles (optional)
//
// Returns an error if the directory doesn't exist or is inaccessible.
func Load(dataDir string) (*Registry, error) {
	// Check if directory exists
	if _, err := os.Stat(dataDir); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("data directory does not exist: %s", dataDir)
		}
		return nil, fmt.Errorf("cannot access data directory: %w", err)
	}

	return &Registry{
		dataDir: dataDir,
	}, nil
}

// AddShim adds a shim to the registry by reading it from the filesystem,
// validating its contents, and storing it in the content-addressable structure.
//
// The shim file is validated to ensure:
//   - It contains valid JSON
//   - Required fields are present (binary.hash, name, version)
//   - The hash is properly formatted (64 lowercase hex characters)
//
// The shim is stored at: {dataDir}/shims/sha256/{hash}.json
//
// Returns ErrValidation if the shim is invalid, ErrInvalidHash if the hash
// format is incorrect, or a filesystem error if the write fails.
func (r *Registry) AddShim(shimPath string) error {
	// Read shim file
	data, err := os.ReadFile(shimPath)
	if err != nil {
		return fmt.Errorf("failed to read shim file: %w", err)
	}

	// Parse shim
	var shim Shim
	if err := json.Unmarshal(data, &shim); err != nil {
		return fmt.Errorf("%w: invalid JSON: %v", ErrValidation, err)
	}

	// Validate required fields
	if shim.Binary.Hash == "" {
		return fmt.Errorf("%w: missing required field 'binary.hash'", ErrValidation)
	}
	if shim.Name == "" {
		return fmt.Errorf("%w: missing required field 'name'", ErrValidation)
	}
	if shim.Version == "" {
		return fmt.Errorf("%w: missing required field 'version'", ErrValidation)
	}

	// Extract hash without prefix
	hash := strings.TrimPrefix(shim.Binary.Hash, HashPrefix)

	// Validate hash format
	if !hashRegex.MatchString(hash) {
		return fmt.Errorf("%w: must be 64 lowercase hex characters, got %q", ErrInvalidHash, hash)
	}

	// Create destination directory
	shimDir := filepath.Join(r.dataDir, ShimSubdir)
	if err := os.MkdirAll(shimDir, 0755); err != nil {
		return fmt.Errorf("failed to create shim directory: %w", err)
	}

	// Write shim to destination
	destPath := filepath.Join(shimDir, hash+ShimExtension)
	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write shim file: %w", err)
	}

	return nil
}

// GetShim retrieves a shim by its SHA-256 hash.
//
// The hash parameter can be provided with or without the "sha256:" prefix.
// The hash must be exactly 64 lowercase hexadecimal characters.
//
// Returns ErrNotFound if no shim exists for the given hash,
// ErrInvalidHash if the hash format is invalid, or an error if
// the shim file cannot be read or parsed.
func (r *Registry) GetShim(hash string) (*Shim, error) {
	// Remove prefix if present
	hash = strings.TrimPrefix(hash, HashPrefix)

	// Validate hash format
	if !hashRegex.MatchString(hash) {
		return nil, fmt.Errorf("%w: must be 64 lowercase hex characters, got %q", ErrInvalidHash, hash)
	}

	// Read shim file
	shimPath := filepath.Join(r.dataDir, ShimSubdir, hash+ShimExtension)
	data, err := os.ReadFile(shimPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: no shim found for hash %s", ErrNotFound, hash)
		}
		return nil, fmt.Errorf("failed to read shim file: %w", err)
	}

	// Parse shim
	var shim Shim
	if err := json.Unmarshal(data, &shim); err != nil {
		return nil, fmt.Errorf("failed to parse shim JSON: %w", err)
	}

	return &shim, nil
}

// BuildCatalog generates the catalog index by scanning all shims in the registry.
//
// The catalog provides a browsable index organized by tool name, version, and platform.
// Each entry maps to the content-addressable hash of the shim file.
//
// If the shims directory doesn't exist, an empty catalog is returned.
// Invalid or corrupted shim files are silently skipped.
//
// Returns a Catalog with the current timestamp, or an error if the directory
// cannot be read.
func (r *Registry) BuildCatalog() (*Catalog, error) {
	catalog := &Catalog{
		Version: "1",
		Updated: time.Now(),
		Tools:   make(map[string]ToolInfo),
	}

	// Walk shims directory
	shimsDir := filepath.Join(r.dataDir, ShimSubdir)
	if _, err := os.Stat(shimsDir); os.IsNotExist(err) {
		// No shims yet, return empty catalog
		return catalog, nil
	}

	entries, err := os.ReadDir(shimsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read shims directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ShimExtension) {
			continue
		}

		// Skip bundle files
		if strings.HasSuffix(entry.Name(), BundleExtension) {
			continue
		}

		// Read shim
		hash := strings.TrimSuffix(entry.Name(), ShimExtension)
		shim, err := r.GetShim(hash)
		if err != nil {
			continue // Skip invalid shims
		}

		catalog.TotalShims++

		// Add to tools map
		toolInfo, ok := catalog.Tools[shim.Name]
		if !ok {
			toolInfo = ToolInfo{
				Description: shim.Description,
				Versions:    make(map[string]map[string]string),
			}
		}

		// Add version/platform mapping
		if toolInfo.Versions[shim.Version] == nil {
			toolInfo.Versions[shim.Version] = make(map[string]string)
		}
		toolInfo.Versions[shim.Version][shim.Binary.Platform] = HashPrefix + hash

		catalog.Tools[shim.Name] = toolInfo
	}

	return catalog, nil
}

// ListShims returns all shims in the registry.
//
// Invalid or corrupted shim files are silently skipped.
// If the shims directory doesn't exist, an empty slice is returned.
//
// Returns a slice of Shim pointers, or an error if the directory cannot be read.
func (r *Registry) ListShims() ([]*Shim, error) {
	var shims []*Shim

	shimsDir := filepath.Join(r.dataDir, ShimSubdir)
	if _, err := os.Stat(shimsDir); os.IsNotExist(err) {
		return shims, nil
	}

	entries, err := os.ReadDir(shimsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read shims directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ShimExtension) {
			continue
		}

		// Skip bundle files
		if strings.HasSuffix(entry.Name(), BundleExtension) {
			continue
		}

		hash := strings.TrimSuffix(entry.Name(), ShimExtension)
		shim, err := r.GetShim(hash)
		if err != nil {
			continue
		}

		shims = append(shims, shim)
	}

	return shims, nil
}

// ValidateHash validates that a hash has the correct format and matches the filename.
//
// The hash parameter can include the "sha256:" prefix, which will be stripped for validation.
// The filename should be in the format "{hash}.json".
//
// Returns ErrInvalidHash if the hash format is incorrect,
// ErrHashMismatch if the hash doesn't match the filename,
// or nil if validation passes.
func ValidateHash(hash, filename string) error {
	// Remove prefix from hash if present
	hashValue := strings.TrimPrefix(hash, HashPrefix)

	// Validate hash format
	if !hashRegex.MatchString(hashValue) {
		return fmt.Errorf("%w: must be 64 lowercase hex characters, got %q", ErrInvalidHash, hashValue)
	}

	// Extract hash from filename
	filenameHash := strings.TrimSuffix(filename, ShimExtension)

	// Compare
	if hashValue != filenameHash {
		return fmt.Errorf("%w: hash %s does not match filename hash %s", ErrHashMismatch, hashValue, filenameHash)
	}

	return nil
}

// ShimPath returns the relative path for a shim file given its hash.
//
// The hash parameter can include the "sha256:" prefix, which will be stripped.
// Returns a path in the format: shims/sha256/{hash}.json
func ShimPath(hash string) string {
	hashValue := strings.TrimPrefix(hash, HashPrefix)
	return filepath.Join(ShimSubdir, hashValue+ShimExtension)
}

// BundlePath returns the relative path for a signature bundle given its hash.
//
// The hash parameter can include the "sha256:" prefix, which will be stripped.
// Returns a path in the format: shims/sha256/{hash}.json.bundle
func BundlePath(hash string) string {
	return ShimPath(hash) + ".bundle"
}
