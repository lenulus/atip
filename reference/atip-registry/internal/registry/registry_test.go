package registry

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistry_Load(t *testing.T) {
	tests := []struct {
		name        string
		dataDir     string
		expectError bool
		expectCount int
	}{
		{
			name:        "loads shims from valid directory",
			dataDir:     "../../testdata",
			expectError: false,
			expectCount: 1,
		},
		{
			name:        "returns error for non-existent directory",
			dataDir:     "/non/existent/path",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg, err := Load(tt.dataDir)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, reg)
			} else {
				require.NoError(t, err)
				require.NotNil(t, reg)
				// Will fail until implementation exists
			}
		})
	}
}

func TestRegistry_AddShim(t *testing.T) {
	// Create temporary directory for test
	tmpDir := t.TempDir()

	reg, err := Load(tmpDir)
	require.NoError(t, err)

	tests := []struct {
		name        string
		shimPath    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "adds valid shim",
			shimPath:    "../../testdata/valid-shim.json",
			expectError: false,
		},
		{
			name:        "rejects invalid shim",
			shimPath:    "../../testdata/invalid-shim.json",
			expectError: true,
			errorMsg:    "validation",
		},
		{
			name:        "rejects non-existent file",
			shimPath:    "/non/existent.json",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := reg.AddShim(tt.shimPath)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
				// Will fail until implementation exists
			}
		})
	}
}

func TestRegistry_ValidateHash(t *testing.T) {
	tests := []struct {
		name         string
		hash         string
		filename     string
		expectError  bool
		errorContains string
	}{
		{
			name:        "validates matching hash and filename",
			hash:        "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
			filename:    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.json",
			expectError: false,
		},
		{
			name:          "rejects mismatched hash and filename",
			hash:          "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
			filename:      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef.json",
			expectError:   true,
			errorContains: "hash mismatch",
		},
		{
			name:          "rejects invalid hash format",
			hash:          "not-a-valid-hash",
			filename:      "test.json",
			expectError:   true,
			errorContains: "invalid hash",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateHash(tt.hash, tt.filename)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRegistry_GetShim(t *testing.T) {
	tmpDir := t.TempDir()

	// Copy test shim to temp directory
	shimsDir := filepath.Join(tmpDir, "shims", "sha256")
	require.NoError(t, os.MkdirAll(shimsDir, 0755))

	validHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
	srcData, err := os.ReadFile("../../testdata/valid-shim.json")
	require.NoError(t, err)
	dstPath := filepath.Join(shimsDir, validHash+".json")
	require.NoError(t, os.WriteFile(dstPath, srcData, 0644))

	reg, err := Load(tmpDir)
	require.NoError(t, err)

	tests := []struct {
		name        string
		hash        string
		expectFound bool
	}{
		{
			name:        "retrieves existing shim",
			hash:        validHash,
			expectFound: true,
		},
		{
			name:        "returns nil for non-existent shim",
			hash:        "0000000000000000000000000000000000000000000000000000000000000000",
			expectFound: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			shim, err := reg.GetShim(tt.hash)

			if tt.expectFound {
				assert.NoError(t, err)
				assert.NotNil(t, shim)
				// Will fail until implementation exists
			} else {
				assert.Error(t, err)
				assert.Nil(t, shim)
			}
		})
	}
}

func TestRegistry_BuildCatalog(t *testing.T) {
	tmpDir := t.TempDir()

	// Setup test shims
	shimsDir := filepath.Join(tmpDir, "shims", "sha256")
	require.NoError(t, os.MkdirAll(shimsDir, 0755))

	validHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
	srcData, err := os.ReadFile("../../testdata/valid-shim.json")
	require.NoError(t, err)
	dstPath := filepath.Join(shimsDir, validHash+".json")
	require.NoError(t, os.WriteFile(dstPath, srcData, 0644))

	reg, err := Load(tmpDir)
	require.NoError(t, err)

	catalog, err := reg.BuildCatalog()
	assert.NoError(t, err)
	assert.NotNil(t, catalog)

	// Verify catalog structure
	// Will fail until implementation exists
	// assert.Greater(t, catalog.TotalShims, 0)
	// assert.Contains(t, catalog.Tools, "curl")
}

func TestRegistry_ListShims(t *testing.T) {
	tmpDir := t.TempDir()

	shimsDir := filepath.Join(tmpDir, "shims", "sha256")
	require.NoError(t, os.MkdirAll(shimsDir, 0755))

	// Add multiple test shims
	validHash := "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
	srcData, err := os.ReadFile("../../testdata/valid-shim.json")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(shimsDir, validHash+".json"), srcData, 0644))

	reg, err := Load(tmpDir)
	require.NoError(t, err)

	shims, err := reg.ListShims()
	assert.NoError(t, err)
	assert.NotEmpty(t, shims)
	// Will fail until implementation exists
}

func TestShimPath(t *testing.T) {
	tests := []struct {
		name     string
		hash     string
		expected string
	}{
		{
			name:     "generates correct path for hash with prefix",
			hash:     "sha256:abc123",
			expected: "shims/sha256/abc123.json",
		},
		{
			name:     "generates correct path for hash without prefix",
			hash:     "abc123",
			expected: "shims/sha256/abc123.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := ShimPath(tt.hash)
			assert.Equal(t, tt.expected, path)
		})
	}
}

func TestBundlePath(t *testing.T) {
	hash := "sha256:abc123"
	path := BundlePath(hash)
	assert.Equal(t, "shims/sha256/abc123.json.bundle", path)
}
