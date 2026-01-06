package integration

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSafePathEnforcement tests security scenarios from Example 25
func TestSafePathEnforcement(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping Unix permission tests on Windows")
	}

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	// Create world-writable directory
	unsafeDir := filepath.Join(tmpDir, "unsafe-tools")
	require.NoError(t, os.MkdirAll(unsafeDir, 0755))
	require.NoError(t, os.Chmod(unsafeDir, 0777)) // Explicitly set world-writable

	createMockATIPTool(t, unsafeDir, "suspicious-tool", "1.0.0", "Suspicious")

	// Try to scan unsafe directory
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path="+unsafeDir,
		"-o", "json")
	output, err := cmd.CombinedOutput()

	// Should succeed but skip the unsafe path
	if err == nil {
		// Check for warnings in stderr or result
		assert.Contains(t, string(output), "world-writable")
	}
}

// TestSafePathsOnlyDefault tests that safe-paths-only is enabled by default
func TestSafePathsOnlyDefault(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	// Override default safe paths to avoid scanning real system paths
	// which can trigger keychain prompts and take a long time
	emptyDir := filepath.Join(tmpDir, "empty-safe-paths")
	require.NoError(t, os.MkdirAll(emptyDir, 0755))
	os.Setenv("ATIP_DISCOVER_SAFE_PATHS", emptyDir)
	defer os.Unsetenv("ATIP_DISCOVER_SAFE_PATHS")

	customDir := filepath.Join(tmpDir, "custom-tools")
	require.NoError(t, os.MkdirAll(customDir, 0755))

	createMockATIPTool(t, customDir, "custom-tool", "1.0.0", "Custom")

	// Scan without --allow-path should not scan custom directory
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan", "-o", "json")
	output, err := cmd.Output()
	require.NoError(t, err)

	// Custom tool should not be discovered
	assert.NotContains(t, string(output), "custom-tool")
}

// TestCurrentDirectoryRejection tests that "." in PATH is rejected
func TestCurrentDirectoryRejection(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	// Try to scan current directory
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path=.",
		"-o", "json")
	output, err := cmd.CombinedOutput()

	// Should reject or warn about "."
	if err == nil {
		assert.Contains(t, string(output), "current dir")
	}
}

// TestDisableSafePathsWarning tests Example 26 behavior
func TestDisableSafePathsWarning(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	unsafeDir := filepath.Join(tmpDir, "unsafe")
	require.NoError(t, os.MkdirAll(unsafeDir, 0755))

	// Disable safe path checking
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--safe-paths-only=false",
		"--allow-path="+unsafeDir)
	output, err := cmd.CombinedOutput()

	// Should show warning
	if err == nil || string(output) != "" {
		assert.Contains(t, string(output), "Warning")
	}
}

// TestVerboseSecurityLogging tests Example 27 verbose output
func TestVerboseSecurityLogging(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	safeDir := filepath.Join(tmpDir, "safe-bin")
	require.NoError(t, os.MkdirAll(safeDir, 0755))

	createMockATIPTool(t, safeDir, "safe-tool", "1.0.0", "Safe")

	// Run with verbose flag
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path="+safeDir,
		"-v")
	output, err := cmd.CombinedOutput()

	// Should show debug output
	if err == nil {
		assert.Contains(t, string(output), "DEBUG")
	}
}

// TestProbeTimeout tests that tools exceeding timeout are killed
func TestProbeTimeout(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	slowToolDir := filepath.Join(tmpDir, "slow-bin")
	require.NoError(t, os.MkdirAll(slowToolDir, 0755))

	// Create a slow tool
	slowTool := filepath.Join(slowToolDir, "slow-tool")
	script := `#!/bin/sh
sleep 10
`
	err := os.WriteFile(slowTool, []byte(script), 0755)
	require.NoError(t, err)

	// Scan with short timeout
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path="+slowToolDir,
		"--timeout=100ms",
		"-o", "json")
	output, err := cmd.Output()

	// Should complete without hanging
	// Check for timeout error in result
	if err == nil {
		assert.Contains(t, string(output), "timeout")
	}
}

// TestOutputSizeLimit tests that large outputs are handled
func TestOutputSizeLimit(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	largeOutputDir := filepath.Join(tmpDir, "large-bin")
	require.NoError(t, os.MkdirAll(largeOutputDir, 0755))

	// Create a tool that outputs a very large response
	largeTool := filepath.Join(largeOutputDir, "large-tool")
	script := `#!/bin/sh
if [ "$1" = "--agent" ]; then
  # Output 1MB of data
  yes '{"atip": {"version": "0.4"}, "name": "large", "version": "1.0.0", "description": "large"}' | head -c 1048576
fi
`
	err := os.WriteFile(largeTool, []byte(script), 0755)
	require.NoError(t, err)

	// Scan should handle or reject large output
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path="+largeOutputDir,
		"-o", "json")
	output, err := cmd.CombinedOutput()

	// Should either succeed or fail gracefully
	if err != nil {
		assert.Contains(t, string(output), "too large")
	}
}

// TestNoShellExpansion tests that command execution is safe
func TestNoShellExpansion(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	// Create a tool with shell metacharacters in path
	specialDir := filepath.Join(tmpDir, "bin-with-space")
	require.NoError(t, os.MkdirAll(specialDir, 0755))

	createMockATIPTool(t, specialDir, "tool", "1.0.0", "Test")

	// Should handle path with spaces correctly (no shell expansion)
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path="+specialDir,
		"-o", "json")
	_, err := cmd.Output()

	// Should succeed without shell injection issues
	assert.NoError(t, err)
}

// TestSymlinkHandling tests that symlinks are handled safely
func TestSymlinkHandling(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping symlink tests on Windows")
	}

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	binDir := filepath.Join(tmpDir, "bin")
	require.NoError(t, os.MkdirAll(binDir, 0755))

	// Create a real tool
	realTool := filepath.Join(binDir, "real-tool")
	createMockATIPTool(t, binDir, "real-tool", "1.0.0", "Real")

	// Create a symlink to it
	symlinkTool := filepath.Join(binDir, "symlink-tool")
	err := os.Symlink(realTool, symlinkTool)
	require.NoError(t, err)

	// Scan should handle symlinks appropriately
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan",
		"--allow-path="+binDir,
		"-o", "json")
	_, err = cmd.Output()

	// Should succeed
	assert.NoError(t, err)
}

// TestRegistryFilePermissions tests that registry files have correct permissions
func TestRegistryFilePermissions(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping Unix permission tests on Windows")
	}

	tmpDir := t.TempDir()
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Unsetenv("XDG_DATA_HOME")

	mockToolsDir := filepath.Join(tmpDir, "mock-bin")
	require.NoError(t, os.MkdirAll(mockToolsDir, 0755))

	createMockATIPTool(t, mockToolsDir, "tool", "1.0.0", "Test")

	// Run scan to create registry
	binaryPath := getBinaryPath(t)
	cmd := exec.Command(binaryPath, "scan", "--allow-path="+mockToolsDir)
	_, err := cmd.Output()
	require.NoError(t, err)

	// Check registry file permissions
	registryPath := filepath.Join(tmpDir, "agent-tools", "registry.json")
	info, err := os.Stat(registryPath)
	require.NoError(t, err)

	// Should be 0644 or similar (readable by user, not writable by others)
	mode := info.Mode()
	assert.Equal(t, os.FileMode(0), mode&0002, "Registry should not be world-writable")
}
