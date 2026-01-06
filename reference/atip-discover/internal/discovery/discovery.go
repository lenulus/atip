// Package discovery provides tools for scanning directories and discovering
// ATIP-compatible command-line tools by probing executables with the --agent flag.
package discovery

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/atip/atip-discover/internal/validator"
)

// Scanner handles the discovery of ATIP tools.
type Scanner struct {
	validator   *validator.Validator
	timeout     time.Duration
	parallelism int
	skipList    []string
}

// NewScanner creates a new scanner.
func NewScanner(timeout time.Duration, parallelism int, skipList []string) (*Scanner, error) {
	v, err := validator.New()
	if err != nil {
		return nil, err
	}

	return &Scanner{
		validator:   v,
		timeout:     timeout,
		parallelism: parallelism,
		skipList:    skipList,
	}, nil
}

// Scan scans the specified directories for ATIP-compatible tools.
// It enumerates executables, filters by skip list, and probes them in parallel.
// When incremental is true, only probes tools that have been modified since last scan.
// Returns aggregated scan results including discovered tools and errors.
func (s *Scanner) Scan(ctx context.Context, paths []string, incremental bool, existingRegistry map[string]time.Time) (*ScanResult, error) {
	start := time.Now()
	result := &ScanResult{
		Tools:  []DiscoveredTool{},
		Errors: []ScanError{},
	}

	// Collect all executables
	var executables []string
	for _, dir := range paths {
		execs, err := EnumerateExecutables(dir)
		if err != nil {
			continue
		}
		executables = append(executables, execs...)
	}

	// Filter by skip list and incremental
	var toProbe []string
	for _, exec := range executables {
		name := filepath.Base(exec)
		if MatchesSkipList(name, s.skipList) {
			result.Skipped++
			continue
		}

		// Check if changed for incremental mode
		if incremental {
			if modTime, exists := existingRegistry[exec]; exists {
				info, err := os.Stat(exec)
				if err == nil && !info.ModTime().After(modTime) {
					result.Skipped++
					continue
				}
			}
		}

		toProbe = append(toProbe, exec)
	}

	// Probe in parallel
	prober := NewProber(s.timeout)
	jobs := make(chan string, len(toProbe))
	results := make(chan probeResult, len(toProbe))

	var wg sync.WaitGroup
	for i := 0; i < s.parallelism; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for path := range jobs {
				metadata, err := prober.Probe(ctx, path)
				results <- probeResult{path: path, metadata: metadata, err: err}
			}
		}()
	}

	for _, path := range toProbe {
		jobs <- path
	}
	close(jobs)

	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	for res := range results {
		if res.err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ScanError{
				Path:  res.path,
				Error: res.err.Error(),
			})
			continue
		}

		if res.metadata != nil {
			// Validate
			if err := s.validator.ValidateMetadata(res.metadata); err != nil {
				result.Failed++
				result.Errors = append(result.Errors, ScanError{
					Path:  res.path,
					Error: fmt.Sprintf("validation failed: %v", err),
				})
				continue
			}

			result.Discovered++
			result.Tools = append(result.Tools, DiscoveredTool{
				Name:         res.metadata.Name,
				Version:      res.metadata.Version,
				Path:         res.path,
				Source:       "native",
				DiscoveredAt: time.Now(),
			})
		}
	}

	result.DurationMs = time.Since(start).Milliseconds()
	return result, nil
}

type probeResult struct {
	path     string
	metadata *validator.AtipMetadata
	err      error
}

// Prober executes tools with --agent flag to retrieve metadata.
type Prober struct {
	timeout time.Duration
}

// NewProber creates a new prober.
func NewProber(timeout time.Duration) *Prober {
	return &Prober{timeout: timeout}
}

// Probe executes a tool with --agent flag and returns parsed ATIP metadata.
// Respects the configured timeout and validates the JSON output.
// Returns an error if the tool doesn't support --agent, times out, or returns invalid JSON.
func (p *Prober) Probe(ctx context.Context, path string) (*validator.AtipMetadata, error) {
	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, path, "--agent")
	output, err := cmd.Output()

	if ctx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("timeout after %s", p.timeout)
	}

	if err != nil {
		return nil, err
	}

	metadata, err := validator.ParseJSON(output)
	if err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	return metadata, nil
}

// ScanResult holds the outcome of a discovery scan.
type ScanResult struct {
	Discovered int              `json:"discovered"`
	Updated    int              `json:"updated"`
	Failed     int              `json:"failed"`
	Skipped    int              `json:"skipped"`
	DurationMs int64            `json:"duration_ms"`
	Tools      []DiscoveredTool `json:"tools"`
	Errors     []ScanError      `json:"errors"`
}

// DiscoveredTool represents a tool found during scanning.
type DiscoveredTool struct {
	Name         string    `json:"name"`
	Version      string    `json:"version"`
	Path         string    `json:"path"`
	Source       string    `json:"source"`
	DiscoveredAt time.Time `json:"discovered_at"`
}

// ScanError represents a failed probe.
type ScanError struct {
	Path  string `json:"path"`
	Error string `json:"error"`
}

// IsSafePath checks if a path is safe to scan based on ownership and permissions.
// Returns false if the path is world-writable, owned by another user, or is the current directory.
func IsSafePath(path string) (bool, error) {
	// Reject current directory
	if path == "." || path == "" {
		return false, fmt.Errorf("current directory not allowed")
	}

	info, err := os.Stat(path)
	if err != nil {
		return false, fmt.Errorf("failed to stat path %s: %w", path, err)
	}

	// Check world-writable (on Unix systems)
	if runtime.GOOS != "windows" {
		if info.Mode()&0002 != 0 {
			return false, fmt.Errorf("world-writable directory")
		}

		// Check ownership
		stat, ok := info.Sys().(*syscall.Stat_t)
		if ok {
			uid := os.Getuid()
			if stat.Uid != uint32(uid) && stat.Uid != 0 {
				return false, fmt.Errorf("directory owned by other user")
			}
		}
	}

	return true, nil
}

// EnumerateExecutables finds all executables in a directory.
// Returns a list of absolute paths to executable files.
func EnumerateExecutables(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory %s: %w", dir, err)
	}

	var executables []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}

		// Check if executable
		if runtime.GOOS == "windows" {
			// On Windows, check file extension
			ext := strings.ToLower(filepath.Ext(entry.Name()))
			if ext == ".exe" || ext == ".bat" || ext == ".cmd" {
				executables = append(executables, path)
			}
		} else {
			// On Unix, check executable bit
			if info.Mode()&0111 != 0 {
				executables = append(executables, path)
			}
		}
	}

	return executables, nil
}

// MatchesSkipList checks if a tool name matches any pattern in the skip list.
// Supports both exact matches and glob patterns (e.g., "test*").
func MatchesSkipList(toolName string, skipList []string) bool {
	for _, skip := range skipList {
		// Support glob patterns
		matched, err := filepath.Match(skip, toolName)
		if err == nil && matched {
			return true
		}
		// Exact match
		if skip == toolName {
			return true
		}
	}
	return false
}
