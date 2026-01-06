package registry

import (
	"time"
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
	// TODO: Implement
	panic("not implemented")
}

// Load loads a registry from disk.
func Load(path string, dataDir string) (*Registry, error) {
	// TODO: Implement
	panic("not implemented")
}

// Save saves the registry to disk atomically.
func (r *Registry) Save() error {
	// TODO: Implement
	panic("not implemented")
}

// Add adds or updates a tool in the registry.
func (r *Registry) Add(entry *RegistryEntry) error {
	// TODO: Implement
	panic("not implemented")
}

// Remove removes a tool from the registry by name.
func (r *Registry) Remove(name string) error {
	// TODO: Implement
	panic("not implemented")
}

// Get retrieves a tool by name.
func (r *Registry) Get(name string) (*RegistryEntry, error) {
	// TODO: Implement
	panic("not implemented")
}

// List returns all tools, optionally filtered by pattern.
func (r *Registry) List(pattern string, source string) ([]*RegistryEntry, error) {
	// TODO: Implement
	panic("not implemented")
}

// Clear removes all entries from the registry.
func (r *Registry) Clear() error {
	// TODO: Implement
	panic("not implemented")
}

// LoadShims loads shim files from the shims directory.
func (r *Registry) LoadShims() error {
	// TODO: Implement
	panic("not implemented")
}

// IsStale returns true if the entry's executable has been modified.
func (e *RegistryEntry) IsStale() bool {
	// TODO: Implement
	panic("not implemented")
}

// CachePath returns the path to the cached metadata file.
func (e *RegistryEntry) CachePath(dataDir string) string {
	// TODO: Implement
	panic("not implemented")
}
