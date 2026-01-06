package validator

// AtipMetadata represents the ATIP metadata structure.
type AtipMetadata struct {
	Atip        interface{}            `json:"atip"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Description string                 `json:"description"`
	Commands    map[string]interface{} `json:"commands,omitempty"`
}

// Validator validates ATIP metadata against the schema.
type Validator struct {
	schemaPath string
}

// New creates a new validator.
func New() (*Validator, error) {
	// TODO: Implement
	panic("not implemented")
}

// NewWithSchema creates a validator with a custom schema path.
func NewWithSchema(schemaPath string) (*Validator, error) {
	// TODO: Implement
	panic("not implemented")
}

// Validate validates ATIP metadata JSON against the schema.
func (v *Validator) Validate(data []byte) (*AtipMetadata, error) {
	// TODO: Implement
	panic("not implemented")
}

// ValidateMetadata validates an already-parsed AtipMetadata struct.
func (v *Validator) ValidateMetadata(metadata *AtipMetadata) error {
	// TODO: Implement
	panic("not implemented")
}

// ParseJSON parses JSON into AtipMetadata without schema validation.
func ParseJSON(data []byte) (*AtipMetadata, error) {
	// TODO: Implement
	panic("not implemented")
}

// ValidationError represents a schema validation error.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	// TODO: Implement
	panic("not implemented")
}
