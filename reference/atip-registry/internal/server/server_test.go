package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServer_GetRegistryManifest(t *testing.T) {
	tests := []struct {
		name           string
		expectedStatus int
		checkHeaders   bool
	}{
		{
			name:           "returns valid manifest",
			expectedStatus: http.StatusOK,
			checkHeaders:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewServer(&Config{
				DataDir: "../../testdata",
			})

			req := httptest.NewRequest(http.MethodGet, "/.well-known/atip-registry.json", nil)
			w := httptest.NewRecorder()

			server.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkHeaders {
				assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
				assert.Equal(t, "public, max-age=3600", w.Header().Get("Cache-Control"))
			}

			// Verify manifest structure
			// Will fail until implementation exists
		})
	}
}

func TestServer_GetShimByHash(t *testing.T) {
	validHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

	tests := []struct {
		name           string
		hash           string
		expectedStatus int
		checkETag      bool
	}{
		{
			name:           "returns shim for valid hash",
			hash:           validHash,
			expectedStatus: http.StatusOK,
			checkETag:      true,
		},
		{
			name:           "returns 404 for non-existent hash",
			hash:           "0000000000000000000000000000000000000000000000000000000000000000",
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "returns 400 for invalid hash format",
			hash:           "invalid-hash",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "returns 400 for short hash",
			hash:           "abc123",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "returns 400 for uppercase hash",
			hash:           "A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewServer(&Config{
				DataDir: "../../testdata",
			})

			req := httptest.NewRequest(http.MethodGet, "/shims/sha256/"+tt.hash+".json", nil)
			w := httptest.NewRecorder()

			server.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkETag && w.Code == http.StatusOK {
				assert.NotEmpty(t, w.Header().Get("ETag"))
				assert.Equal(t, "public, max-age=86400, immutable", w.Header().Get("Cache-Control"))
			}
		})
	}
}

func TestServer_GetShimWithConditionalRequest(t *testing.T) {
	validHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

	server := NewServer(&Config{
		DataDir: "../../testdata",
	})

	// First request to get ETag
	req1 := httptest.NewRequest(http.MethodGet, "/shims/sha256/"+validHash+".json", nil)
	w1 := httptest.NewRecorder()
	server.ServeHTTP(w1, req1)
	require.Equal(t, http.StatusOK, w1.Code)

	etag := w1.Header().Get("ETag")
	require.NotEmpty(t, etag)

	// Second request with If-None-Match
	req2 := httptest.NewRequest(http.MethodGet, "/shims/sha256/"+validHash+".json", nil)
	req2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	server.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusNotModified, w2.Code)
	assert.Equal(t, etag, w2.Header().Get("ETag"))
}

func TestServer_GetSignatureBundle(t *testing.T) {
	validHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

	tests := []struct {
		name           string
		hash           string
		expectedStatus int
	}{
		{
			name:           "returns bundle for valid hash",
			hash:           validHash,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "returns 404 for non-existent bundle",
			hash:           "0000000000000000000000000000000000000000000000000000000000000000",
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewServer(&Config{
				DataDir: "../../testdata",
			})

			req := httptest.NewRequest(http.MethodGet, "/shims/sha256/"+tt.hash+".json.bundle", nil)
			w := httptest.NewRecorder()

			server.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if w.Code == http.StatusOK {
				assert.Equal(t, "application/octet-stream", w.Header().Get("Content-Type"))
				assert.Equal(t, "public, max-age=86400, immutable", w.Header().Get("Cache-Control"))
			}
		})
	}
}

func TestServer_GetCatalog(t *testing.T) {
	server := NewServer(&Config{
		DataDir: "../../testdata",
	})

	req := httptest.NewRequest(http.MethodGet, "/shims/index.json", nil)
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.Equal(t, "public, max-age=3600", w.Header().Get("Cache-Control"))
	assert.NotEmpty(t, w.Header().Get("ETag"))

	// Verify catalog structure
	// Will fail until implementation exists
}

func TestServer_HealthCheck(t *testing.T) {
	server := NewServer(&Config{
		DataDir: "../../testdata",
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	// Verify health response structure
	// Will fail until implementation exists
}

func TestServer_PathTraversalPrevention(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		expectedStatus int
	}{
		{
			name:           "prevents ../ in path",
			path:           "/shims/sha256/../../../etc/passwd",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "prevents absolute path",
			path:           "/shims/sha256/%2Fetc%2Fpasswd",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewServer(&Config{
				DataDir: "../../testdata",
			})

			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			w := httptest.NewRecorder()

			server.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestServer_CORSHeaders(t *testing.T) {
	server := NewServer(&Config{
		DataDir:    "../../testdata",
		CORSOrigin: "*",
	})

	req := httptest.NewRequest(http.MethodOptions, "/.well-known/atip-registry.json", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
}
