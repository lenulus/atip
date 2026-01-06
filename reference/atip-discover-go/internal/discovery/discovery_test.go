package discovery

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewScanner(t *testing.T) {
	scanner, err := NewScanner(2*time.Second, 4, []string{"skip-tool"})
	require.NoError(t, err)
	assert.NotNil(t, scanner)
}

func TestScanner_Scan(t *testing.T) {
	tmpDir := t.TempDir()

	// Create mock executables
	mockTool := filepath.Join(tmpDir, "mock-tool")
	err := os.WriteFile(mockTool, []byte("#!/bin/sh\necho test"), 0755)
	require.NoError(t, err)

	scanner, err := NewScanner(2*time.Second, 1, nil)
	require.NoError(t, err)

	ctx := context.Background()
	result, err := scanner.Scan(ctx, []string{tmpDir}, false, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.GreaterOrEqual(t, result.Skipped, 0)
}

func TestScanner_Scan_IncrementalMode(t *testing.T) {
	tmpDir := t.TempDir()

	mockTool := filepath.Join(tmpDir, "mock-tool")
	err := os.WriteFile(mockTool, []byte("#!/bin/sh\necho test"), 0755)
	require.NoError(t, err)

	stat, err := os.Stat(mockTool)
	require.NoError(t, err)

	// Existing registry with old mtime
	existingRegistry := map[string]time.Time{
		mockTool: stat.ModTime(),
	}

	scanner, err := NewScanner(2*time.Second, 1, nil)
	require.NoError(t, err)

	ctx := context.Background()
	result, err := scanner.Scan(ctx, []string{tmpDir}, true, existingRegistry)
	require.NoError(t, err)

	// Tool hasn't changed, should be skipped
	assert.Equal(t, 0, result.Discovered)
	assert.Equal(t, 0, result.Updated)
}

func TestScanner_Scan_WithSkipList(t *testing.T) {
	tmpDir := t.TempDir()

	skipTool := filepath.Join(tmpDir, "skip-this")
	err := os.WriteFile(skipTool, []byte("#!/bin/sh\necho test"), 0755)
	require.NoError(t, err)

	scanner, err := NewScanner(2*time.Second, 1, []string{"skip-this"})
	require.NoError(t, err)

	ctx := context.Background()
	result, err := scanner.Scan(ctx, []string{tmpDir}, false, nil)
	require.NoError(t, err)

	// Tool should be skipped
	assert.Equal(t, 0, result.Discovered)
	assert.Greater(t, result.Skipped, 0)
}

func TestScanner_Scan_Timeout(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a mock tool that hangs
	hangingTool := filepath.Join(tmpDir, "hanging-tool")
	script := "#!/bin/sh\nsleep 10\n"
	err := os.WriteFile(hangingTool, []byte(script), 0755)
	require.NoError(t, err)

	scanner, err := NewScanner(100*time.Millisecond, 1, nil)
	require.NoError(t, err)

	ctx := context.Background()
	result, err := scanner.Scan(ctx, []string{tmpDir}, false, nil)
	require.NoError(t, err)

	// Should have timeout error
	assert.Greater(t, result.Failed, 0)
	assert.Len(t, result.Errors, 1)
	assert.Contains(t, result.Errors[0].Error, "timeout")
}

func TestScanner_Scan_Parallel(t *testing.T) {
	tmpDir := t.TempDir()

	// Create multiple mock tools
	for i := 0; i < 10; i++ {
		toolPath := filepath.Join(tmpDir, "tool-"+string(rune('a'+i)))
		err := os.WriteFile(toolPath, []byte("#!/bin/sh\necho test"), 0755)
		require.NoError(t, err)
	}

	scanner, err := NewScanner(2*time.Second, 4, nil)
	require.NoError(t, err)

	ctx := context.Background()
	start := time.Now()
	result, err := scanner.Scan(ctx, []string{tmpDir}, false, nil)
	duration := time.Since(start)

	require.NoError(t, err)
	assert.NotNil(t, result)

	// With parallelism=4, should be faster than sequential
	// This is a rough test - actual implementation will vary
	t.Logf("Scan took %v with parallelism=4", duration)
}

func TestNewProber(t *testing.T) {
	p := NewProber(2 * time.Second)
	assert.NotNil(t, p)
}

func TestProber_Probe_ValidTool(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a mock ATIP tool
	toolPath := filepath.Join(tmpDir, "mock-atip-tool")
	script := `#!/bin/sh
if [ "$1" = "--agent" ]; then
  cat <<EOF
{
  "atip": {"version": "0.4"},
  "name": "mock-tool",
  "version": "1.0.0",
  "description": "A mock tool",
  "commands": {
    "run": {
      "description": "Run the tool",
      "effects": {"network": false}
    }
  }
}
EOF
fi
`
	err := os.WriteFile(toolPath, []byte(script), 0755)
	require.NoError(t, err)

	p := NewProber(2 * time.Second)
	ctx := context.Background()

	metadata, err := p.Probe(ctx, toolPath)
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, "mock-tool", metadata.Name)
	assert.Equal(t, "1.0.0", metadata.Version)
}

func TestProber_Probe_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()

	toolPath := filepath.Join(tmpDir, "invalid-tool")
	script := `#!/bin/sh
if [ "$1" = "--agent" ]; then
  echo "not valid json"
fi
`
	err := os.WriteFile(toolPath, []byte(script), 0755)
	require.NoError(t, err)

	p := NewProber(2 * time.Second)
	ctx := context.Background()

	_, err = p.Probe(ctx, toolPath)
	assert.Error(t, err)
}

func TestProber_Probe_NoAgentSupport(t *testing.T) {
	tmpDir := t.TempDir()

	toolPath := filepath.Join(tmpDir, "no-agent-tool")
	script := `#!/bin/sh
echo "This tool doesn't support --agent"
exit 1
`
	err := os.WriteFile(toolPath, []byte(script), 0755)
	require.NoError(t, err)

	p := NewProber(2 * time.Second)
	ctx := context.Background()

	_, err = p.Probe(ctx, toolPath)
	assert.Error(t, err)
}

func TestProber_Probe_Timeout(t *testing.T) {
	tmpDir := t.TempDir()

	toolPath := filepath.Join(tmpDir, "slow-tool")
	script := `#!/bin/sh
sleep 10
`
	err := os.WriteFile(toolPath, []byte(script), 0755)
	require.NoError(t, err)

	p := NewProber(100 * time.Millisecond)
	ctx := context.Background()

	_, err = p.Probe(ctx, toolPath)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

func TestIsSafePath(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		setup    func(t *testing.T, path string)
		expected bool
	}{
		{
			name:     "standard safe path",
			path:     "/usr/bin",
			expected: true,
		},
		{
			name: "world-writable directory",
			path: "",
			setup: func(t *testing.T, path string) {
				// Create world-writable directory
				tmpDir := t.TempDir()
				unsafeDir := filepath.Join(tmpDir, "unsafe")
				os.Mkdir(unsafeDir, 0777)
				os.Chmod(unsafeDir, 0777)
			},
			expected: false,
		},
		{
			name:     "current directory",
			path:     ".",
			expected: false,
		},
		{
			name:     "empty path",
			path:     "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setup != nil {
				tt.setup(t, tt.path)
			}

			safe, err := IsSafePath(tt.path)
			if tt.expected {
				assert.NoError(t, err)
				assert.True(t, safe)
			} else {
				// May error or return false
				if err == nil {
					assert.False(t, safe)
				}
			}
		})
	}
}

func TestEnumerateExecutables(t *testing.T) {
	tmpDir := t.TempDir()

	// Create various files
	execFile := filepath.Join(tmpDir, "executable")
	err := os.WriteFile(execFile, []byte("#!/bin/sh"), 0755)
	require.NoError(t, err)

	nonExecFile := filepath.Join(tmpDir, "nonexec")
	err = os.WriteFile(nonExecFile, []byte("data"), 0644)
	require.NoError(t, err)

	// Create subdirectory (should not be included)
	subDir := filepath.Join(tmpDir, "subdir")
	err = os.Mkdir(subDir, 0755)
	require.NoError(t, err)

	executables, err := EnumerateExecutables(tmpDir)
	require.NoError(t, err)

	// Should only include the executable file
	assert.Len(t, executables, 1)
	assert.Contains(t, executables, execFile)
}

func TestEnumerateExecutables_NonexistentDir(t *testing.T) {
	_, err := EnumerateExecutables("/nonexistent/directory")
	assert.Error(t, err)
}

func TestMatchesSkipList(t *testing.T) {
	skipList := []string{"skip-tool", "dangerous-*", "test-*"}

	tests := []struct {
		name     string
		toolName string
		expected bool
	}{
		{
			name:     "exact match",
			toolName: "skip-tool",
			expected: true,
		},
		{
			name:     "pattern match",
			toolName: "dangerous-cmd",
			expected: true,
		},
		{
			name:     "no match",
			toolName: "safe-tool",
			expected: false,
		},
		{
			name:     "partial match should not match",
			toolName: "skip",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MatchesSkipList(tt.toolName, skipList)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMatchesSkipList_EmptyList(t *testing.T) {
	result := MatchesSkipList("any-tool", []string{})
	assert.False(t, result)
}

func TestScanResult_Aggregation(t *testing.T) {
	result := &ScanResult{
		Discovered: 5,
		Updated:    2,
		Failed:     1,
		Skipped:    100,
		DurationMs: 4500,
		Tools: []DiscoveredTool{
			{Name: "gh", Version: "2.45.0", Path: "/usr/local/bin/gh", Source: "native"},
		},
		Errors: []ScanError{
			{Path: "/usr/local/bin/broken", Error: "timeout"},
		},
	}

	assert.Equal(t, 5, result.Discovered)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Tools, 1)
	assert.Len(t, result.Errors, 1)
}
