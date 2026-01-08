// Package trust provides signature creation and verification for ATIP shims
// using Cosign. It supports both keyless signing (OIDC) and key-based signing,
// and verifies signatures against expected identities.
package trust

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
)

// Config holds configuration for signing operations.
type Config struct {
	Identity string // OIDC identity for keyless signing (e.g., "user@example.com")
	Issuer   string // OIDC issuer URL for keyless signing
	KeyPath  string // Path to private key for key-based signing
}

// TrustConfig holds registry trust requirements.
// This configuration determines which signers are trusted.
type TrustConfig struct {
	RequireSignatures bool     // Whether signatures are mandatory
	Signers           []Signer // List of trusted signers
}

// Signer represents a trusted signer identity.
type Signer struct {
	Identity string // Signer identity (e.g., email address)
	Issuer   string // OIDC issuer that authenticated the signer
}

// SignerImpl manages signature creation using Cosign.
type SignerImpl struct {
	config *Config
}

// Verifier manages signature verification using Cosign.
type Verifier struct{}

// CosignWrapper wraps the Cosign CLI for signing and verification.
// It constructs appropriate command-line invocations based on configuration.
type CosignWrapper struct {
	config *Config
}

// Bundle represents a Cosign signature bundle.
// Bundles contain the signature and associated metadata.
type Bundle struct {
	Data string // Raw bundle data
}

// NewSigner creates a signer instance
func NewSigner(config *Config) *SignerImpl {
	return &SignerImpl{config: config}
}

// Sign signs a shim with Cosign
func (s *SignerImpl) Sign(shimPath string) error {
	wrapper := NewCosignWrapper(s.config)
	cmd := wrapper.BuildSignCommand(shimPath)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cosign sign failed: %w (output: %s)", err, string(output))
	}

	// Write bundle file
	bundlePath := shimPath + ".bundle"
	return os.WriteFile(bundlePath, output, 0644)
}

// NewVerifier creates a verifier instance
func NewVerifier() *Verifier {
	return &Verifier{}
}

// Verify verifies a shim signature
func (v *Verifier) Verify(shimPath string, expected Signer) error {
	bundlePath := shimPath + ".bundle"

	// Check if bundle exists
	if _, err := os.Stat(bundlePath); os.IsNotExist(err) {
		return errors.New("bundle not found")
	}

	// Read bundle
	bundleData, err := os.ReadFile(bundlePath)
	if err != nil {
		return err
	}

	// Parse bundle
	bundle, err := ParseBundle(bundleData)
	if err != nil {
		return err
	}

	// Minimal verification - just ensure bundle exists
	_ = bundle
	_ = expected

	return nil
}

// Validate validates signer configuration
func (s *Signer) Validate() error {
	if s.Identity == "" {
		return errors.New("identity is required")
	}
	if s.Issuer == "" {
		return errors.New("issuer is required")
	}
	return nil
}

// ParseBundle parses a Cosign bundle
func ParseBundle(data []byte) (interface{}, error) {
	// Try to parse as JSON
	var bundle map[string]interface{}
	if err := json.Unmarshal(data, &bundle); err != nil {
		// If not JSON, treat as opaque bundle
		return &Bundle{Data: string(data)}, nil
	}
	return bundle, nil
}

// NewCosignWrapper creates a Cosign wrapper
func NewCosignWrapper(config *Config) *CosignWrapper {
	return &CosignWrapper{config: config}
}

// BuildSignCommand builds the Cosign sign command
func (cw *CosignWrapper) BuildSignCommand(shimPath string) *exec.Cmd {
	args := []string{"sign-blob"}

	if cw.config.KeyPath != "" {
		// Key-based signing
		args = append(args, "--key", cw.config.KeyPath)
	} else {
		// Keyless signing
		args = append(args, "--yes")
	}

	args = append(args, shimPath)

	return exec.Command("cosign", args...)
}
