package integration

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFullScanWorkflow tests the complete scan workflow from design.md
func TestFullScanWorkflow(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	// Create mock ATIP tools
	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")
	createMockATIPTool(t, mockToolsDir, "kubectl", "1.28.0", "Kubernetes CLI")
	createMockATIPTool(t, mockToolsDir, "terraform", "1.6.0", "Infrastructure as Code")

	// Run scan
	cmd := exec.Command(binary, "scan", "--allow-path="+mockToolsDir, "-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	// Parse result
	var result struct {
		Discovered int `json:"discovered"`
		Updated    int `json:"updated"`
		Failed     int `json:"failed"`
		Skipped    int `json:"skipped"`
		Tools      []struct {
			Name    string `json:"name"`
			Version string `json:"version"`
			Source  string `json:"source"`
		} `json:"tools"`
	}

	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	// Validate results match Example 1 expectations
	assert.Equal(t, 3, result.Discovered)
	assert.Len(t, result.Tools, 3)
	assert.Contains(t, getToolNames(result.Tools), "gh")
	assert.Contains(t, getToolNames(result.Tools), "kubectl")
	assert.Contains(t, getToolNames(result.Tools), "terraform")
}

// TestIncrementalScan tests incremental vs full scan behavior from Example 7
func TestIncrementalScan(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	_ = createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")

	// First scan
	cmd := exec.Command(binary, "scan", "--allow-path="+mockToolsDir)
	_, err := cmd.Output()
	require.NoError(t, err)

	// Second scan (incremental, no changes)
	cmd = exec.Command(binary, "scan", "--allow-path="+mockToolsDir, "-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	var result struct {
		Discovered int `json:"discovered"`
		Updated    int `json:"updated"`
	}
	json.Unmarshal(output, &result)

	// Should have 0 discovered and 0 updated (tool unchanged)
	assert.Equal(t, 0, result.Discovered)
	assert.Equal(t, 0, result.Updated)

	// Update the tool
	time.Sleep(10 * time.Millisecond)
	createMockATIPTool(t, mockToolsDir, "gh", "2.46.0", "GitHub CLI")

	// Third scan (incremental, tool changed)
	cmd = exec.Command(binary, "scan", "--allow-path="+mockToolsDir, "-o", "json")
	output, err = cmd.Output()
	require.NoError(t, err)

	json.Unmarshal(output, &result)

	// Should detect update
	assert.Equal(t, 0, result.Discovered) // Not new
	assert.Equal(t, 1, result.Updated)    // Updated
}

// TestListCommand tests the list command from Example 2
func TestListCommand(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")
	createMockATIPTool(t, mockToolsDir, "kubectl", "1.28.0", "Kubernetes CLI")

	// Scan first
	cmd := exec.Command(binary, "scan", "--allow-path="+mockToolsDir)
	_, err := cmd.Output()
	require.NoError(t, err)

	// List tools
	cmd = exec.Command(binary, "list", "-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	var result struct {
		Count int `json:"count"`
		Tools []struct {
			Name        string `json:"name"`
			Version     string `json:"version"`
			Description string `json:"description"`
			Source      string `json:"source"`
		} `json:"tools"`
	}

	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	assert.Equal(t, 2, result.Count)
	assert.Len(t, result.Tools, 2)
}

// TestGetCommand tests the get command from Example 3
func TestGetCommand(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")

	// Scan first
	cmd := exec.Command(binary, "scan", "--allow-path="+mockToolsDir)
	_, err := cmd.Output()
	require.NoError(t, err)

	// Get tool metadata
	cmd = exec.Command(binary, "get", "gh")
	output, err := cmd.Output()
	require.NoError(t, err)

	var metadata struct {
		Atip struct {
			Version string `json:"version"`
		} `json:"atip"`
		Name        string `json:"name"`
		Version     string `json:"version"`
		Description string `json:"description"`
	}

	err = json.Unmarshal(output, &metadata)
	require.NoError(t, err)

	assert.Equal(t, "0.4", metadata.Atip.Version)
	assert.Equal(t, "gh", metadata.Name)
	assert.Equal(t, "2.45.0", metadata.Version)
}

// TestGetCommand_NotFound tests error handling from Example 19
func TestGetCommand_NotFound(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	// Try to get nonexistent tool
	cmd := exec.Command(binary, "get", "nonexistent-tool", "-o", "json")
	output, err := cmd.CombinedOutput()

	// Should exit with code 1
	assert.Error(t, err)

	// Should have error message
	var errorResult struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	err = json.Unmarshal(output, &errorResult)
	if err == nil {
		assert.Equal(t, "TOOL_NOT_FOUND", errorResult.Error.Code)
		assert.Contains(t, errorResult.Error.Message, "nonexistent-tool")
	}
}

// TestSkipList tests skip list functionality from Example 6
func TestSkipList(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")
	createMockATIPTool(t, mockToolsDir, "skip-this", "1.0.0", "Skipped tool")

	// Scan with skip list
	cmd := exec.Command(binary, "scan",
		"--allow-path="+mockToolsDir,
		"--skip=skip-this",
		"-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	var result struct {
		Discovered int `json:"discovered"`
		Tools      []struct {
			Name string `json:"name"`
		} `json:"tools"`
	}

	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	// Should only discover gh, not skip-this
	assert.Equal(t, 1, result.Discovered)
	assert.Len(t, result.Tools, 1)
	assert.Equal(t, "gh", result.Tools[0].Name)
}

// TestDryRun tests dry run mode from Example 8
func TestDryRun(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")

	// Dry run scan
	cmd := exec.Command(binary, "scan",
		"--allow-path="+mockToolsDir,
		"--dry-run",
		"-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	var result struct {
		WouldScan []string `json:"would_scan"`
		ScanPaths []string `json:"scan_paths"`
	}

	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	// Should show what would be scanned
	assert.NotEmpty(t, result.ScanPaths)
	assert.Contains(t, result.ScanPaths, mockToolsDir)
}

// TestOutputFormats tests different output formats from Examples 2
func TestOutputFormats(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")

	// Scan first
	cmd := exec.Command(binary, "scan", "--allow-path="+mockToolsDir)
	_, err := cmd.Output()
	require.NoError(t, err)

	// Test JSON output
	cmd = exec.Command(binary, "list", "-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)
	assert.True(t, json.Valid(output))

	// Test table output
	cmd = exec.Command(binary, "list", "-o", "table")
	output, err = cmd.Output()
	require.NoError(t, err)
	assert.Contains(t, string(output), "NAME")
	assert.Contains(t, string(output), "VERSION")

	// Test quiet output
	cmd = exec.Command(binary, "list", "-o", "quiet")
	output, err = cmd.Output()
	require.NoError(t, err)
	assert.Contains(t, string(output), "gh")
	assert.NotContains(t, string(output), "NAME") // No headers in quiet mode
}

// TestRefreshCommand tests the refresh command from Example 15
func TestRefreshCommand(t *testing.T) {
	binary := getBinaryPath(t)

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "gh", "2.44.0", "GitHub CLI")

	// Initial scan
	cmd := exec.Command(binary, "scan", "--allow-path="+mockToolsDir)
	_, err := cmd.Output()
	require.NoError(t, err)

	// Update tool
	time.Sleep(10 * time.Millisecond)
	createMockATIPTool(t, mockToolsDir, "gh", "2.45.0", "GitHub CLI")

	// Refresh
	cmd = exec.Command(binary, "refresh", "-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	var result struct {
		Refreshed int `json:"refreshed"`
		Tools     []struct {
			Name       string `json:"name"`
			Status     string `json:"status"`
			OldVersion string `json:"old_version,omitempty"`
			NewVersion string `json:"new_version,omitempty"`
		} `json:"tools"`
	}

	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	assert.Greater(t, result.Refreshed, 0)
}

// Helper functions

func createMockATIPTool(t *testing.T, dir, name, version, description string) string {
	toolPath := filepath.Join(dir, name)
	script := `#!/bin/sh
if [ "$1" = "--agent" ]; then
  cat <<EOF
{
  "atip": {"version": "0.4"},
  "name": "` + name + `",
  "version": "` + version + `",
  "description": "` + description + `",
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
	return toolPath
}

func getToolNames(tools []struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Source  string `json:"source"`
}) []string {
	names := make([]string, len(tools))
	for i, tool := range tools {
		names[i] = tool.Name
	}
	return names
}
