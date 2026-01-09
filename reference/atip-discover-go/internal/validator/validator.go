// Package validator provides JSON schema validation for ATIP metadata,
// ensuring tool metadata conforms to the ATIP specification.
package validator

import (
	"encoding/json"
	"errors"
	"fmt"
)

// AtipMetadata represents the ATIP metadata structure.
type AtipMetadata struct {
	Atip        interface{}            `json:"atip"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Description string                 `json:"description"`
	Trust       *Trust                 `json:"trust,omitempty"`
	Commands    map[string]interface{} `json:"commands,omitempty"`
}

// Trust represents the trust and provenance information.
type Trust struct {
	Source     string      `json:"source"`
	Verified   bool        `json:"verified,omitempty"`
	Integrity  *Integrity  `json:"integrity,omitempty"`
	Provenance *Provenance `json:"provenance,omitempty"`
}

// Integrity represents Sigstore integrity information.
type Integrity struct {
	Checksum  string           `json:"checksum"`
	Signature *IntegritySignal `json:"signature,omitempty"`
}

// IntegritySignal represents a Sigstore signature.
type IntegritySignal struct {
	Type     string `json:"type"`
	Identity string `json:"identity"`
	Issuer   string `json:"issuer,omitempty"`
	Bundle   string `json:"bundle,omitempty"`
}

// Provenance represents SLSA provenance information.
type Provenance struct {
	URL       string `json:"url"`
	Format    string `json:"format"`
	SLSALevel int    `json:"slsaLevel"`
	Builder   string `json:"builder,omitempty"`
}

// Validator validates ATIP metadata against the schema.
type Validator struct {
	schemaPath string
}

// New creates a new validator.
func New() (*Validator, error) {
	return &Validator{}, nil
}

// NewWithSchema creates a validator with a custom schema path.
func NewWithSchema(schemaPath string) (*Validator, error) {
	return &Validator{schemaPath: schemaPath}, nil
}

// Validate validates ATIP metadata JSON against the schema.
func (v *Validator) Validate(data []byte) (*AtipMetadata, error) {
	metadata, err := ParseJSON(data)
	if err != nil {
		return nil, err
	}

	if err := v.ValidateMetadata(metadata); err != nil {
		return nil, err
	}

	return metadata, nil
}

// ValidateMetadata validates an already-parsed AtipMetadata struct.
func (v *Validator) ValidateMetadata(metadata *AtipMetadata) error {
	// Validate required fields
	if metadata.Atip == nil {
		return &ValidationError{Field: "atip", Message: "field is required"}
	}

	if metadata.Name == "" {
		return &ValidationError{Field: "name", Message: "field is required"}
	}

	if metadata.Version == "" {
		return &ValidationError{Field: "version", Message: "field is required"}
	}

	if metadata.Description == "" {
		return &ValidationError{Field: "description", Message: "field is required"}
	}

	// Validate atip field format
	if err := validateAtipField(metadata.Atip); err != nil {
		return err
	}

	// Validate commands if present
	if metadata.Commands != nil {
		if err := validateCommands(metadata.Commands); err != nil {
			return err
		}
	}

	return nil
}

// validateAtipField validates the atip field (supports legacy and new format)
func validateAtipField(atip interface{}) error {
	switch v := atip.(type) {
	case string:
		// Legacy format: "atip": "0.3"
		if v != "0.1" && v != "0.2" && v != "0.3" && v != "0.4" && v != "0.5" && v != "0.6" {
			return &ValidationError{Field: "atip", Message: fmt.Sprintf("unsupported version: %s", v)}
		}
	case map[string]interface{}:
		// New format: "atip": {"version": "0.6"}
		version, ok := v["version"]
		if !ok {
			return &ValidationError{Field: "atip.version", Message: "field is required"}
		}
		versionStr, ok := version.(string)
		if !ok {
			return &ValidationError{Field: "atip.version", Message: "must be a string"}
		}
		if versionStr != "0.1" && versionStr != "0.2" && versionStr != "0.3" && versionStr != "0.4" && versionStr != "0.5" && versionStr != "0.6" {
			return &ValidationError{Field: "atip.version", Message: fmt.Sprintf("unsupported version: %s", versionStr)}
		}
	default:
		return &ValidationError{Field: "atip", Message: "must be a string or object"}
	}
	return nil
}

// validateCommands validates the commands structure
func validateCommands(commands map[string]interface{}) error {
	for cmdName, cmdData := range commands {
		cmd, ok := cmdData.(map[string]interface{})
		if !ok {
			return &ValidationError{
				Field:   fmt.Sprintf("commands.%s", cmdName),
				Message: "must be an object",
			}
		}

		// Check if this is a leaf command (has effects) or a parent command (has nested commands)
		hasEffects := cmd["effects"] != nil
		hasCommands := cmd["commands"] != nil

		if !hasEffects && !hasCommands {
			return &ValidationError{
				Field:   fmt.Sprintf("commands.%s", cmdName),
				Message: "must have either 'effects' or nested 'commands'",
			}
		}

		// Validate effects if present
		if hasEffects {
			effects, ok := cmd["effects"].(map[string]interface{})
			if !ok {
				return &ValidationError{
					Field:   fmt.Sprintf("commands.%s.effects", cmdName),
					Message: "must be an object",
				}
			}

			// Validate effect types (all should be boolean or have specific types)
			for effectName, effectValue := range effects {
				switch effectName {
				case "destructive", "reversible", "idempotent", "network":
					if _, ok := effectValue.(bool); !ok {
						return &ValidationError{
							Field:   fmt.Sprintf("commands.%s.effects.%s", cmdName, effectName),
							Message: "must be a boolean",
						}
					}
				}
			}
		}

		// Recursively validate nested commands
		if hasCommands {
			nestedCommands, ok := cmd["commands"].(map[string]interface{})
			if !ok {
				return &ValidationError{
					Field:   fmt.Sprintf("commands.%s.commands", cmdName),
					Message: "must be an object",
				}
			}
			if err := validateCommands(nestedCommands); err != nil {
				return err
			}
		}
	}
	return nil
}

// ParseJSON parses JSON into AtipMetadata without schema validation.
func ParseJSON(data []byte) (*AtipMetadata, error) {
	var metadata AtipMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, err
	}
	return &metadata, nil
}

// ValidationError represents a schema validation error.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("validation error on field '%s': %s", e.Field, e.Message)
	}
	return fmt.Sprintf("validation error: %s", e.Message)
}

// IsValidationError checks if an error is a ValidationError
func IsValidationError(err error) bool {
	var ve *ValidationError
	return errors.As(err, &ve)
}
