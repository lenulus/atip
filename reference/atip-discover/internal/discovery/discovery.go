package discovery

import (
	"context"
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
	// TODO: Implement
	panic("not implemented")
}

// Scan scans the specified directories for ATIP tools.
func (s *Scanner) Scan(ctx context.Context, paths []string, incremental bool, existingRegistry map[string]time.Time) (*ScanResult, error) {
	// TODO: Implement
	panic("not implemented")
}

// Prober executes tools with --agent flag to retrieve metadata.
type Prober struct {
	timeout time.Duration
}

// NewProber creates a new prober.
func NewProber(timeout time.Duration) *Prober {
	// TODO: Implement
	panic("not implemented")
}

// Probe executes a tool with --agent and returns parsed metadata.
func (p *Prober) Probe(ctx context.Context, path string) (*validator.AtipMetadata, error) {
	// TODO: Implement
	panic("not implemented")
}

// ScanResult holds the outcome of a discovery scan.
type ScanResult struct {
	Discovered  int               `json:"discovered"`
	Updated     int               `json:"updated"`
	Failed      int               `json:"failed"`
	Skipped     int               `json:"skipped"`
	DurationMs  int64             `json:"duration_ms"`
	Tools       []DiscoveredTool  `json:"tools"`
	Errors      []ScanError       `json:"errors"`
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

// IsSafePath checks if a path is safe to scan.
func IsSafePath(path string) (bool, error) {
	// TODO: Implement
	panic("not implemented")
}

// EnumerateExecutables finds all executables in a directory.
func EnumerateExecutables(dir string) ([]string, error) {
	// TODO: Implement
	panic("not implemented")
}

// MatchesSkipList checks if a tool name is in the skip list.
func MatchesSkipList(toolName string, skipList []string) bool {
	// TODO: Implement
	panic("not implemented")
}
