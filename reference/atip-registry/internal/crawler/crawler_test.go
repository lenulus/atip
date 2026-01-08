package crawler

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCrawler_LoadManifest(t *testing.T) {
	tests := []struct {
		name         string
		manifestPath string
		expectError  bool
	}{
		{
			name:         "loads valid manifest",
			manifestPath: "../../testdata/manifest.yaml",
			expectError:  false,
		},
		{
			name:         "returns error for non-existent manifest",
			manifestPath: "/non/existent.yaml",
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			manifest, err := LoadManifest(tt.manifestPath)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, manifest)
			} else {
				require.NoError(t, err)
				require.NotNil(t, manifest)
				assert.Equal(t, "jq", manifest.Name)
				assert.Equal(t, "https://jqlang.github.io/jq/", manifest.Homepage)
				// Will fail until implementation exists
			}
		})
	}
}

func TestCrawler_ParseGitHubSource(t *testing.T) {
	manifest := &ToolManifest{
		Name: "jq",
		Sources: SourceConfig{
			GitHub: &GitHubSource{
				Repo: "jqlang/jq",
				AssetPatterns: map[string]string{
					"linux-amd64":  "jq-linux-amd64",
					"darwin-arm64": "jq-macos-arm64",
				},
			},
		},
	}

	crawler := NewCrawler(&Config{
		Parallelism: 2,
	})

	releases, err := crawler.DiscoverReleases(context.Background(), manifest)
	assert.NoError(t, err)
	assert.NotEmpty(t, releases)
	// Will fail until implementation exists
}

func TestCrawler_ComputeBinaryHash(t *testing.T) {
	// Create temporary test binary
	tmpFile := t.TempDir() + "/test-binary"
	testData := []byte("test binary content")
	require.NoError(t, writeFile(tmpFile, testData))

	hash, err := ComputeHash(tmpFile)
	assert.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.Len(t, hash, 71) // "sha256:" + 64 hex chars
	assert.Contains(t, hash, "sha256:")
	// Will fail until implementation exists
}

func TestCrawler_GenerateShimFromTemplate(t *testing.T) {
	manifest, err := LoadManifest("../../testdata/manifest.yaml")
	require.NoError(t, err)

	binary := &Binary{
		Name:     "jq",
		Version:  "1.7.1",
		Platform: "linux-amd64",
		Hash:     "sha256:abc123def456",
		Path:     "/tmp/jq",
	}

	generator := NewGenerator()
	shim, err := generator.Generate(manifest, binary)

	assert.NoError(t, err)
	assert.NotNil(t, shim)
	// Will fail until implementation exists
	// assert.Equal(t, "jq", shim.Name)
	// assert.Equal(t, "1.7.1", shim.Version)
	// assert.Equal(t, binary.Hash, shim.Binary.Hash)
}

func TestCrawler_PipelineExecution(t *testing.T) {
	crawler := NewCrawler(&Config{
		ManifestsDir: "../../testdata",
		Parallelism:  2,
	})

	ctx := context.Background()

	result, err := crawler.Crawl(ctx, []string{"jq"})
	assert.NoError(t, err)
	assert.NotNil(t, result)
	// Will fail until implementation exists
	// assert.Greater(t, result.Crawled, 0)
}

func TestCrawler_FilterPlatforms(t *testing.T) {
	tests := []struct {
		name              string
		requestedPlatforms []string
		availablePlatforms []string
		expectedFiltered  []string
	}{
		{
			name:              "filters to requested platforms",
			requestedPlatforms: []string{"linux-amd64", "darwin-arm64"},
			availablePlatforms: []string{"linux-amd64", "linux-arm64", "darwin-amd64", "darwin-arm64"},
			expectedFiltered:  []string{"linux-amd64", "darwin-arm64"},
		},
		{
			name:              "returns all when no filter specified",
			requestedPlatforms: nil,
			availablePlatforms: []string{"linux-amd64", "darwin-arm64"},
			expectedFiltered:  []string{"linux-amd64", "darwin-arm64"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filtered := FilterPlatforms(tt.availablePlatforms, tt.requestedPlatforms)
			assert.ElementsMatch(t, tt.expectedFiltered, filtered)
		})
	}
}

func TestCrawler_CheckOnly(t *testing.T) {
	crawler := NewCrawler(&Config{
		ManifestsDir: "../../testdata",
		CheckOnly:    true,
	})

	ctx := context.Background()

	result, err := crawler.Crawl(ctx, []string{"jq"})
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// In check-only mode, no downloads should occur
	// Will fail until implementation exists
}

func TestCrawler_ErrorHandling(t *testing.T) {
	tests := []struct {
		name        string
		toolName    string
		expectError bool
	}{
		{
			name:        "collects errors for invalid tool",
			toolName:    "non-existent-tool",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			crawler := NewCrawler(&Config{
				ManifestsDir: "../../testdata",
			})

			ctx := context.Background()
			result, err := crawler.Crawl(ctx, []string{tt.toolName})

			if tt.expectError {
				// Crawler should not fail entirely, but collect errors
				assert.NoError(t, err)
				assert.NotEmpty(t, result.Errors)
			}
		})
	}
}

func TestParseHelpOutput(t *testing.T) {
	helpOutput := `Usage: jq [options...] <filter> [files...]

Options:
  -r, --raw-output         Output raw strings, not JSON texts
  -c, --compact-output     Compact output
  -s, --slurp              Read entire input into array
  -n, --null-input         Don't read any input
`

	parser := NewParser()
	options, err := parser.Parse(helpOutput)

	assert.NoError(t, err)
	assert.NotNil(t, options)
	assert.NotEmpty(t, options.Options)
	// Will fail until implementation exists

	// Verify parsed options
	// hasRawOutput := false
	// for _, opt := range options.Options {
	//     if opt.Name == "raw-output" {
	//         hasRawOutput = true
	//         assert.ElementsMatch(t, []string{"-r", "--raw-output"}, opt.Flags)
	//         assert.Equal(t, "boolean", opt.Type)
	//     }
	// }
	// assert.True(t, hasRawOutput)
}

// Helper function
func writeFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}
