package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/atip/atip-discover/internal/validator"
)

// RegistryEntry represents a discovered tool in the registry.
type RegistryEntry struct {
	Name         string    `json:"name"`
	Version      string    `json:"version"`
	Path         string    `json:"path"`
	Source       string    `json:"source"` // "native" or "shim"
	DiscoveredAt time.Time `json:"discovered_at"`
	LastVerified time.Time `json:"last_verified"`
	MetadataFile string    `json:"metadata_file,omitempty"`
	Checksum     string    `json:"checksum,omitempty"`
	ModTime      time.Time `json:"mod_time,omitempty"`
}

// Registry is the index of discovered ATIP tools.
type Registry struct {
	Version  string           `json:"version"`
	LastScan time.Time        `json:"last_scan"`
	Tools    []*RegistryEntry `json:"tools"`
	path     string           // File path (not serialized)
	dataDir  string           // Data directory (not serialized)
}

// New creates a new empty registry.
func New(path string, dataDir string) *Registry {
	return &Registry{
		Version: "1",
		Tools:   []*RegistryEntry{},
		path:    path,
		dataDir: dataDir,
	}
}

// Load loads a registry from disk.
func Load(path string, dataDir string) (*Registry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return New(path, dataDir), nil
		}
		return nil, err
	}

	var r Registry
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}

	r.path = path
	r.dataDir = dataDir

	return &r, nil
}

// Save saves the registry to disk atomically.
func (r *Registry) Save() error {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return err
	}

	// Ensure parent directory exists
	dir := filepath.Dir(r.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// Write to temp file
	tmpPath := r.path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}

	// Atomic rename
	if err := os.Rename(tmpPath, r.path); err != nil {
		os.Remove(tmpPath) // Clean up temp file
		return err
	}

	return nil
}

// Add adds or updates a tool in the registry.
func (r *Registry) Add(entry *RegistryEntry) error {
	// Check if tool already exists
	for i, existing := range r.Tools {
		if existing.Name == entry.Name {
			// Update existing entry
			// Preserve DiscoveredAt from original
			if !entry.DiscoveredAt.IsZero() {
				// Use provided DiscoveredAt
			} else {
				entry.DiscoveredAt = existing.DiscoveredAt
			}
			r.Tools[i] = entry
			return nil
		}
	}

	// Add new entry
	if entry.DiscoveredAt.IsZero() {
		entry.DiscoveredAt = time.Now()
	}
	if entry.LastVerified.IsZero() {
		entry.LastVerified = time.Now()
	}
	r.Tools = append(r.Tools, entry)
	return nil
}

// Remove removes a tool from the registry by name.
func (r *Registry) Remove(name string) error {
	for i, entry := range r.Tools {
		if entry.Name == name {
			r.Tools = append(r.Tools[:i], r.Tools[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("tool not found: %s", name)
}

// Get retrieves a tool by name.
func (r *Registry) Get(name string) (*RegistryEntry, error) {
	for _, entry := range r.Tools {
		if entry.Name == name {
			return entry, nil
		}
	}
	return nil, fmt.Errorf("tool not found: %s", name)
}

// List returns all tools, optionally filtered by pattern.
func (r *Registry) List(pattern string, source string) ([]*RegistryEntry, error) {
	var result []*RegistryEntry

	for _, entry := range r.Tools {
		// Filter by source
		if source != "" && source != "all" && entry.Source != source {
			continue
		}

		// Filter by pattern (simple glob-style matching)
		if pattern != "" {
			matched, err := filepath.Match(pattern, entry.Name)
			if err != nil {
				return nil, err
			}
			if !matched {
				continue
			}
		}

		result = append(result, entry)
	}

	return result, nil
}

// Clear removes all entries from the registry.
func (r *Registry) Clear() error {
	r.Tools = []*RegistryEntry{}
	return nil
}

// LoadShims loads shim files from the shims directory.
func (r *Registry) LoadShims() error {
	shimsDir := filepath.Join(r.dataDir, "shims")
	entries, err := os.ReadDir(shimsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No shims directory is OK
		}
		return err
	}

	v, err := validator.New()
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		if filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		shimPath := filepath.Join(shimsDir, entry.Name())
		data, err := os.ReadFile(shimPath)
		if err != nil {
			continue // Skip unreadable shims
		}

		metadata, err := v.Validate(data)
		if err != nil {
			continue // Skip invalid shims
		}

		// Add to registry as shim source
		r.Add(&RegistryEntry{
			Name:         metadata.Name,
			Version:      metadata.Version,
			Path:         shimPath,
			Source:       "shim",
			DiscoveredAt: time.Now(),
			LastVerified: time.Now(),
			MetadataFile: entry.Name(),
		})
	}

	return nil
}

// IsStale returns true if the entry's executable has been modified.
func (e *RegistryEntry) IsStale() bool {
	if e.Source == "shim" {
		return false // Shims don't change
	}

	info, err := os.Stat(e.Path)
	if err != nil {
		return true // File gone or inaccessible
	}

	if e.ModTime.IsZero() {
		return false // No mod time recorded, assume not stale
	}

	return info.ModTime().After(e.ModTime)
}

// CachePath returns the path to the cached metadata file.
func (e *RegistryEntry) CachePath(dataDir string) string {
	if e.MetadataFile != "" {
		return filepath.Join(dataDir, "tools", e.MetadataFile)
	}
	return filepath.Join(dataDir, "tools", e.Name+".json")
}

// Matches returns true if the entry matches the pattern
func (e *RegistryEntry) Matches(pattern string) bool {
	if pattern == "" {
		return true
	}

	// Simple glob matching
	if strings.Contains(pattern, "*") {
		matched, _ := filepath.Match(pattern, e.Name)
		return matched
	}

	// Exact match
	return e.Name == pattern
}
