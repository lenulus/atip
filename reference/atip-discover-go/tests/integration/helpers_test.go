package integration

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
)

var (
	binaryPath string
	buildOnce  sync.Once
	buildErr   error
)

// getBinaryPath builds the atip-discover binary once and returns its path
func getBinaryPath(t *testing.T) string {
	t.Helper()

	buildOnce.Do(func() {
		// Build to a temp directory
		tmpDir, err := os.MkdirTemp("", "atip-discover-test-*")
		if err != nil {
			buildErr = err
			return
		}

		binaryPath = filepath.Join(tmpDir, "atip-discover")

		// Build the binary
		cmd := exec.Command("go", "build", "-o", binaryPath, "../../cmd/atip-discover")
		cmd.Dir = filepath.Join(getProjectRoot(), "tests", "integration")
		output, err := cmd.CombinedOutput()
		if err != nil {
			buildErr = &BuildError{output: string(output), err: err}
			return
		}
	})

	if buildErr != nil {
		t.Fatalf("Failed to build binary: %v", buildErr)
	}

	return binaryPath
}

// getProjectRoot returns the project root directory
func getProjectRoot() string {
	// Walk up from the test file to find go.mod
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// runCommand executes atip-discover with the given arguments
func runCommand(t *testing.T, args ...string) ([]byte, error) {
	t.Helper()
	binary := getBinaryPath(t)
	cmd := exec.Command(binary, args...)
	return cmd.Output()
}

// runCommandWithEnv executes atip-discover with custom environment
func runCommandWithEnv(t *testing.T, env []string, args ...string) ([]byte, error) {
	t.Helper()
	binary := getBinaryPath(t)
	cmd := exec.Command(binary, args...)
	cmd.Env = append(os.Environ(), env...)
	return cmd.Output()
}

// BuildError wraps build errors with output
type BuildError struct {
	output string
	err    error
}

func (e *BuildError) Error() string {
	return e.output + ": " + e.err.Error()
}
