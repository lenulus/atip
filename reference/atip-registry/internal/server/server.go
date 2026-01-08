// Package server provides the HTTP server for the ATIP registry.
// It serves shim metadata, signature bundles, catalog indexes, and
// registry manifests over HTTP with proper caching headers.
package server

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/anthropics/atip/reference/atip-registry/internal/registry"
)

const (
	// DefaultDataDir is the default directory for registry data.
	DefaultDataDir = "./data"

	// DefaultCORSOrigin is the default CORS origin (allow all).
	DefaultCORSOrigin = "*"

	// WellKnownPath is the path for the registry manifest.
	WellKnownPath = "/.well-known/atip-registry.json"

	// ShimsPathPrefix is the URL path prefix for shim requests.
	ShimsPathPrefix = "/shims/sha256/"

	// CatalogPath is the URL path for the catalog index.
	CatalogPath = "/shims/index.json"

	// HealthPath is the URL path for health checks.
	HealthPath = "/health"
)

// Config holds server configuration.
type Config struct {
	DataDir    string // Directory containing registry data
	CORSOrigin string // CORS allowed origin (use "*" for all)
}

// Server represents the HTTP server for the ATIP registry.
// It handles all HTTP endpoints defined in the ATIP registry protocol.
type Server struct {
	config   *Config
	registry *registry.Registry
	mux      *http.ServeMux
}

// hashRegex validates SHA-256 hashes in URL paths (64 lowercase hex chars).
var hashRegex = regexp.MustCompile(`^[a-f0-9]{64}$`)

// NewServer creates a new Server instance with the provided configuration.
//
// If config is nil, default values are used (DataDir: "./data", CORSOrigin: "*").
// The server automatically loads the registry from the configured data directory.
//
// All HTTP routes are configured during initialization.
func NewServer(config *Config) *Server {
	if config == nil {
		config = &Config{
			DataDir:    DefaultDataDir,
			CORSOrigin: DefaultCORSOrigin,
		}
	}

	// Load registry (ignore error for now, will fail on actual requests if invalid)
	reg, _ := registry.Load(config.DataDir)

	s := &Server{
		config:   config,
		registry: reg,
		mux:      http.NewServeMux(),
	}

	// Setup routes
	s.setupRoutes()

	return s
}

// setupRoutes configures all HTTP endpoints.
func (s *Server) setupRoutes() {
	s.mux.HandleFunc(WellKnownPath, s.handleRegistryManifest)
	s.mux.HandleFunc(ShimsPathPrefix, s.handleShim)
	s.mux.HandleFunc(CatalogPath, s.handleCatalog)
	s.mux.HandleFunc(HealthPath, s.handleHealth)
}

// ServeHTTP implements http.Handler, providing middleware for CORS and security.
//
// Middleware applied (in order):
//  1. CORS headers (if configured)
//  2. OPTIONS method handling
//  3. Path traversal prevention
//  4. Route handling via mux
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS middleware
	if s.config.CORSOrigin != "" {
		w.Header().Set("Access-Control-Allow-Origin", s.config.CORSOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, If-None-Match")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	// Path traversal prevention - reject any path containing ".."
	if strings.Contains(r.URL.Path, "..") || strings.Contains(r.URL.Path, "%2e%2e") || strings.Contains(r.URL.Path, "%2E%2E") {
		http.Error(w, "invalid path: path traversal detected", http.StatusBadRequest)
		return
	}

	s.mux.ServeHTTP(w, r)
}

// handleRegistryManifest serves GET /.well-known/atip-registry.json
//
// Returns the registry manifest with registry information, endpoints, and trust requirements.
// Cached for 1 hour (per spec section 4.4.2).
func (s *Server) handleRegistryManifest(w http.ResponseWriter, r *http.Request) {
	manifestPath := filepath.Join(s.config.DataDir, ".well-known", "atip-registry.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")

	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// handleShim serves GET /shims/sha256/{hash}.json and /shims/sha256/{hash}.json.bundle
//
// Serves either a shim metadata file (.json) or its signature bundle (.json.bundle).
// Supports conditional requests via If-None-Match header (returns 304 if ETag matches).
//
// Hash must be exactly 64 lowercase hexadecimal characters.
// Content is cached for 24 hours with immutable directive (per spec section 4.7).
func (s *Server) handleShim(w http.ResponseWriter, r *http.Request) {
	// Extract hash from path: /shims/sha256/{hash}.json or /shims/sha256/{hash}.json.bundle
	path := strings.TrimPrefix(r.URL.Path, ShimsPathPrefix)

	isBundle := strings.HasSuffix(path, ".bundle")
	if isBundle {
		path = strings.TrimSuffix(path, ".bundle")
	}

	hash := strings.TrimSuffix(path, registry.ShimExtension)

	// Validate hash format
	if !hashRegex.MatchString(hash) {
		http.Error(w, "invalid hash format: must be 64 lowercase hex characters", http.StatusBadRequest)
		return
	}

	// Determine file path
	var filePath string
	var contentType string
	if isBundle {
		filePath = filepath.Join(s.config.DataDir, registry.ShimSubdir, hash+registry.BundleExtension)
		contentType = "application/octet-stream"
	} else {
		filePath = filepath.Join(s.config.DataDir, registry.ShimSubdir, hash+registry.ShimExtension)
		contentType = "application/json"
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.NotFound(w, r)
		} else {
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}
		return
	}

	// Compute ETag from content
	etag := fmt.Sprintf(`"%x"`, sha256.Sum256(data))

	// Check If-None-Match (conditional request support)
	if r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
		w.WriteHeader(http.StatusNotModified)
		return
	}

	// Set headers
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("ETag", etag)

	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// handleCatalog serves GET /shims/index.json
//
// Returns a browsable catalog of all shims in the registry, organized by tool name,
// version, and platform. Supports conditional requests via If-None-Match header.
//
// The catalog is dynamically generated on each request (not cached on disk).
// Cached for 1 hour (per spec section 4.4.4).
func (s *Server) handleCatalog(w http.ResponseWriter, r *http.Request) {
	if s.registry == nil {
		http.Error(w, "registry not initialized", http.StatusInternalServerError)
		return
	}

	// Build catalog
	catalog, err := s.registry.BuildCatalog()
	if err != nil {
		http.Error(w, "failed to build catalog: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Marshal to JSON
	data, err := json.Marshal(catalog)
	if err != nil {
		http.Error(w, "failed to marshal catalog: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Compute ETag
	etag := fmt.Sprintf(`"%x"`, sha256.Sum256(data))

	// Check If-None-Match (conditional request support)
	if r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("ETag", etag)

	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// handleHealth serves GET /health
//
// Returns server health status, version, uptime, and shim count.
// Used for monitoring and container orchestration health checks.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":  "healthy",
		"version": "0.1.0",
	}

	// Try to get shim count
	if s.registry != nil {
		shims, err := s.registry.ListShims()
		if err == nil {
			health["shim_count"] = len(shims)
		}
	}

	// Add storage info
	health["storage"] = map[string]interface{}{
		"type":     "filesystem",
		"path":     s.config.DataDir,
		"writable": true,
	}

	data, _ := json.Marshal(health)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
