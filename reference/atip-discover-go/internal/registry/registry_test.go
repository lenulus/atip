package registry

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")

	r := New(regPath, tmpDir)
	assert.NotNil(t, r)
	assert.Equal(t, "1", r.Version)
	assert.Empty(t, r.Tools)
}

func TestLoad_FileNotExists(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "nonexistent.json")

	r, err := Load(regPath, tmpDir)
	require.NoError(t, err) // Should create new registry
	assert.NotNil(t, r)
	assert.Empty(t, r.Tools)
}

func TestLoad_ValidRegistry(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")

	// Create a valid registry file
	registryJSON := `{
		"version": "1",
		"last_scan": "2026-01-05T10:30:00Z",
		"tools": [
			{
				"name": "gh",
				"version": "2.45.0",
				"path": "/usr/local/bin/gh",
				"source": "native",
				"discovered_at": "2026-01-05T10:30:00Z",
				"last_verified": "2026-01-05T10:30:00Z"
			}
		]
	}`

	err := os.WriteFile(regPath, []byte(registryJSON), 0644)
	require.NoError(t, err)

	r, err := Load(regPath, tmpDir)
	require.NoError(t, err)
	assert.Len(t, r.Tools, 1)
	assert.Equal(t, "gh", r.Tools[0].Name)
	assert.Equal(t, "2.45.0", r.Tools[0].Version)
}

func TestSave(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")

	r := New(regPath, tmpDir)
	r.Tools = []*RegistryEntry{
		{
			Name:         "gh",
			Version:      "2.45.0",
			Path:         "/usr/local/bin/gh",
			Source:       "native",
			DiscoveredAt: time.Now(),
			LastVerified: time.Now(),
		},
	}

	err := r.Save()
	require.NoError(t, err)

	// Verify file was created
	_, err = os.Stat(regPath)
	assert.NoError(t, err)

	// Verify content
	r2, err := Load(regPath, tmpDir)
	require.NoError(t, err)
	assert.Len(t, r2.Tools, 1)
	assert.Equal(t, "gh", r2.Tools[0].Name)
}

func TestSave_Atomic(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")

	r := New(regPath, tmpDir)

	err := r.Save()
	require.NoError(t, err)

	// No .tmp file should remain
	tmpFiles, _ := filepath.Glob(filepath.Join(tmpDir, "*.tmp"))
	assert.Empty(t, tmpFiles)
}

func TestAdd(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	entry := &RegistryEntry{
		Name:         "gh",
		Version:      "2.45.0",
		Path:         "/usr/local/bin/gh",
		Source:       "native",
		DiscoveredAt: time.Now(),
		LastVerified: time.Now(),
	}

	err := r.Add(entry)
	require.NoError(t, err)

	assert.Len(t, r.Tools, 1)
	assert.Equal(t, "gh", r.Tools[0].Name)
}

func TestAdd_Update(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	// Add initial entry
	entry := &RegistryEntry{
		Name:         "gh",
		Version:      "2.44.0",
		Path:         "/usr/local/bin/gh",
		Source:       "native",
		DiscoveredAt: time.Now(),
		LastVerified: time.Now(),
	}
	r.Add(entry)

	// Update with new version
	updated := &RegistryEntry{
		Name:         "gh",
		Version:      "2.45.0",
		Path:         "/usr/local/bin/gh",
		Source:       "native",
		DiscoveredAt: entry.DiscoveredAt, // Keep original
		LastVerified: time.Now(),
	}

	err := r.Add(updated)
	require.NoError(t, err)

	// Should still have only one entry
	assert.Len(t, r.Tools, 1)
	assert.Equal(t, "2.45.0", r.Tools[0].Version)
	// DiscoveredAt should remain the original
	assert.Equal(t, entry.DiscoveredAt, r.Tools[0].DiscoveredAt)
}

func TestRemove(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	r.Tools = []*RegistryEntry{
		{Name: "gh", Version: "2.45.0", Path: "/usr/local/bin/gh", Source: "native"},
		{Name: "kubectl", Version: "1.28.0", Path: "/usr/local/bin/kubectl", Source: "native"},
	}

	err := r.Remove("gh")
	require.NoError(t, err)

	assert.Len(t, r.Tools, 1)
	assert.Equal(t, "kubectl", r.Tools[0].Name)
}

func TestRemove_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	err := r.Remove("nonexistent")
	assert.Error(t, err)
}

func TestGet(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	r.Tools = []*RegistryEntry{
		{Name: "gh", Version: "2.45.0", Path: "/usr/local/bin/gh", Source: "native"},
	}

	entry, err := r.Get("gh")
	require.NoError(t, err)
	assert.Equal(t, "gh", entry.Name)
	assert.Equal(t, "2.45.0", entry.Version)
}

func TestGet_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	_, err := r.Get("nonexistent")
	assert.Error(t, err)
}

func TestList_All(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	r.Tools = []*RegistryEntry{
		{Name: "gh", Version: "2.45.0", Source: "native"},
		{Name: "kubectl", Version: "1.28.0", Source: "native"},
		{Name: "curl", Version: "8.4.0", Source: "shim"},
	}

	tools, err := r.List("", "all")
	require.NoError(t, err)
	assert.Len(t, tools, 3)
}

func TestList_FilterBySource(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	r.Tools = []*RegistryEntry{
		{Name: "gh", Version: "2.45.0", Source: "native"},
		{Name: "kubectl", Version: "1.28.0", Source: "native"},
		{Name: "curl", Version: "8.4.0", Source: "shim"},
	}

	tools, err := r.List("", "native")
	require.NoError(t, err)
	assert.Len(t, tools, 2)

	tools, err = r.List("", "shim")
	require.NoError(t, err)
	assert.Len(t, tools, 1)
	assert.Equal(t, "curl", tools[0].Name)
}

func TestList_FilterByPattern(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	r.Tools = []*RegistryEntry{
		{Name: "gh", Version: "2.45.0", Source: "native"},
		{Name: "kubectl", Version: "1.28.0", Source: "native"},
		{Name: "kustomize", Version: "5.0.0", Source: "native"},
	}

	// Pattern matching "k*"
	tools, err := r.List("k*", "all")
	require.NoError(t, err)
	assert.Len(t, tools, 2)
	assert.Contains(t, []string{tools[0].Name, tools[1].Name}, "kubectl")
	assert.Contains(t, []string{tools[0].Name, tools[1].Name}, "kustomize")
}

func TestClear(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	r := New(regPath, tmpDir)

	r.Tools = []*RegistryEntry{
		{Name: "gh", Version: "2.45.0", Source: "native"},
		{Name: "kubectl", Version: "1.28.0", Source: "native"},
	}

	err := r.Clear()
	require.NoError(t, err)
	assert.Empty(t, r.Tools)
}

func TestLoadShims(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	shimsDir := filepath.Join(tmpDir, "shims")

	err := os.MkdirAll(shimsDir, 0755)
	require.NoError(t, err)

	// Create a shim file
	shimJSON := `{
		"atip": {"version": "0.4"},
		"name": "curl",
		"version": "8.4.0",
		"description": "Transfer data from or to a server",
		"trust": {"source": "community", "verified": false},
		"commands": {
			"": {
				"description": "Make HTTP request",
				"effects": {"network": true}
			}
		}
	}`

	err = os.WriteFile(filepath.Join(shimsDir, "curl.json"), []byte(shimJSON), 0644)
	require.NoError(t, err)

	r := New(regPath, tmpDir)
	err = r.LoadShims()
	require.NoError(t, err)

	assert.Len(t, r.Tools, 1)
	assert.Equal(t, "curl", r.Tools[0].Name)
	assert.Equal(t, "shim", r.Tools[0].Source)
}

func TestLoadShims_InvalidFile(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "registry.json")
	shimsDir := filepath.Join(tmpDir, "shims")

	err := os.MkdirAll(shimsDir, 0755)
	require.NoError(t, err)

	// Create invalid shim file
	err = os.WriteFile(filepath.Join(shimsDir, "invalid.json"), []byte("not json"), 0644)
	require.NoError(t, err)

	r := New(regPath, tmpDir)
	err = r.LoadShims()
	// Should not error, but should skip invalid file
	require.NoError(t, err)
	assert.Empty(t, r.Tools)
}

func TestIsStale(t *testing.T) {
	// Create a temporary executable
	tmpDir := t.TempDir()
	exePath := filepath.Join(tmpDir, "test-tool")
	err := os.WriteFile(exePath, []byte("#!/bin/sh\necho test"), 0755)
	require.NoError(t, err)

	stat, err := os.Stat(exePath)
	require.NoError(t, err)

	entry := &RegistryEntry{
		Name:    "test-tool",
		Path:    exePath,
		ModTime: stat.ModTime(),
	}

	// Should not be stale initially
	assert.False(t, entry.IsStale())

	// Modify file
	time.Sleep(10 * time.Millisecond)
	err = os.WriteFile(exePath, []byte("#!/bin/sh\necho modified"), 0755)
	require.NoError(t, err)

	// Now should be stale
	assert.True(t, entry.IsStale())
}

func TestCachePath(t *testing.T) {
	entry := &RegistryEntry{
		Name: "gh",
	}

	dataDir := "/home/user/.local/share/agent-tools"
	cachePath := entry.CachePath(dataDir)

	expected := filepath.Join(dataDir, "tools", "gh.json")
	assert.Equal(t, expected, cachePath)
}

func TestSave_CreateDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	regPath := filepath.Join(tmpDir, "subdir", "registry.json")

	r := New(regPath, tmpDir)

	err := r.Save()
	require.NoError(t, err)

	// Directory should be created
	_, err = os.Stat(filepath.Dir(regPath))
	assert.NoError(t, err)
}
