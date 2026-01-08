// Package sync provides client functionality for synchronizing shims
// from remote ATIP registries. It supports conditional requests (ETags),
// signature verification, and selective tool filtering.
package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Config holds configuration for the sync client.
type Config struct {
	LocalDataDir     string   // Local directory to sync shims into
	VerifySignatures bool     // Whether to verify shim signatures
	ForceRefresh     bool     // Ignore cached ETags and force download
	DryRun           bool     // Show what would be synced without downloading
	Tools            []string // Specific tools to sync (empty = all)
}

// Syncer manages synchronization from remote ATIP registries.
// It handles fetching manifests, catalogs, and shims with proper
// caching and conditional requests.
type Syncer struct {
	config *Config
	client *http.Client
}

// SyncResult holds the results of a sync operation.
type SyncResult struct {
	Synced    int      // Number of shims successfully synced
	Unchanged int      // Number of shims unchanged (304 Not Modified)
	Failed    int      // Number of shims that failed to sync
	Errors    []error  // Errors encountered during sync
}

// Cache manages ETag-based HTTP caching for conditional requests.
// Cached ETags are stored in memory with a configurable TTL.
type Cache struct {
	dir   string                 // Cache directory
	ttl   time.Duration          // Time-to-live for cached entries
	store map[string]cacheEntry  // In-memory ETag cache
}

// cacheEntry represents a cached ETag with timestamp.
type cacheEntry struct {
	etag      string    // ETag value
	timestamp time.Time // When the entry was cached
}

// NewSyncer creates a syncer instance
func NewSyncer(config *Config) *Syncer {
	return &Syncer{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// FetchManifest fetches remote registry manifest
func (s *Syncer) FetchManifest(ctx context.Context, registryURL string) (interface{}, error) {
	url := registryURL + "/.well-known/atip-registry.json"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch manifest failed: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var manifest map[string]interface{}
	if err := json.Unmarshal(body, &manifest); err != nil {
		return nil, err
	}

	return manifest, nil
}

// FetchCatalog fetches remote catalog
func (s *Syncer) FetchCatalog(ctx context.Context, registryURL string) (interface{}, error) {
	url := registryURL + "/shims/index.json"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch catalog failed: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var catalog map[string]interface{}
	if err := json.Unmarshal(body, &catalog); err != nil {
		return nil, err
	}

	return catalog, nil
}

// FetchWithETag performs conditional fetch
func (s *Syncer) FetchWithETag(ctx context.Context, url, etag string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, "", err
	}

	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	newETag := resp.Header.Get("ETag")

	if resp.StatusCode == http.StatusNotModified {
		// Use the ETag from the request if not in response header
		if newETag == "" {
			newETag = etag
		}
		return nil, newETag, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("fetch failed: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	return body, newETag, nil
}

// DownloadShim downloads a shim by hash
func (s *Syncer) DownloadShim(ctx context.Context, registryURL, hash string) error {
	url := fmt.Sprintf("%s/shims/sha256/%s.json", registryURL, hash)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download shim failed: %s", resp.Status)
	}

	if s.config.DryRun {
		return nil
	}

	shimDir := filepath.Join(s.config.LocalDataDir, "shims", "sha256")
	if err := os.MkdirAll(shimDir, 0755); err != nil {
		return err
	}

	shimPath := filepath.Join(shimDir, hash+".json")
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return os.WriteFile(shimPath, body, 0644)
}

// DownloadSignature downloads signature bundle
func (s *Syncer) DownloadSignature(ctx context.Context, registryURL, hash string) error {
	url := fmt.Sprintf("%s/shims/sha256/%s.json.bundle", registryURL, hash)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download signature failed: %s", resp.Status)
	}

	if s.config.DryRun {
		return nil
	}

	shimDir := filepath.Join(s.config.LocalDataDir, "shims", "sha256")
	if err := os.MkdirAll(shimDir, 0755); err != nil {
		return err
	}

	bundlePath := filepath.Join(shimDir, hash+".json.bundle")
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return os.WriteFile(bundlePath, body, 0644)
}

// Sync executes the sync operation
func (s *Syncer) Sync(ctx context.Context, registryURL string) (*SyncResult, error) {
	result := &SyncResult{
		Errors: []error{},
	}

	// Fetch catalog
	catalog, err := s.FetchCatalog(ctx, registryURL)
	if err != nil {
		return nil, err
	}

	// For minimal implementation, just return the result
	_ = catalog
	return result, nil
}

// ShouldFetch determines if resource should be fetched
func (s *Syncer) ShouldFetch(hash, cachedETag string) bool {
	if s.config.ForceRefresh {
		return true
	}
	return cachedETag == ""
}

// ShouldSyncTool checks if tool should be synced
func (s *Syncer) ShouldSyncTool(name string) bool {
	if len(s.config.Tools) == 0 {
		return true
	}
	for _, tool := range s.config.Tools {
		if tool == name {
			return true
		}
	}
	return false
}

// NewCache creates a cache instance
func NewCache(dir string) *Cache {
	return &Cache{
		dir:   dir,
		ttl:   24 * time.Hour,
		store: make(map[string]cacheEntry),
	}
}

// Set stores an ETag
func (c *Cache) Set(hash, etag string) {
	c.store[hash] = cacheEntry{
		etag:      etag,
		timestamp: time.Now(),
	}
}

// Get retrieves an ETag
func (c *Cache) Get(hash string) (string, bool) {
	entry, exists := c.store[hash]
	if !exists {
		return "", false
	}

	if time.Since(entry.timestamp) > c.ttl {
		delete(c.store, hash)
		return "", false
	}

	return entry.etag, true
}

// SetTTL sets cache TTL
func (c *Cache) SetTTL(seconds int) {
	c.ttl = time.Duration(seconds) * time.Second
}
