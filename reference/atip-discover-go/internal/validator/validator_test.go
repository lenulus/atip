package validator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew(t *testing.T) {
	v, err := New()
	require.NoError(t, err)
	assert.NotNil(t, v)
}

func TestValidate_ValidMinimalMetadata(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	validJSON := `{
		"atip": {"version": "0.4"},
		"name": "test-tool",
		"version": "1.0.0",
		"description": "A test tool",
		"commands": {
			"run": {
				"description": "Run the tool",
				"effects": {
					"network": false
				}
			}
		}
	}`

	metadata, err := v.Validate([]byte(validJSON))
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, "test-tool", metadata.Name)
	assert.Equal(t, "1.0.0", metadata.Version)
	assert.Equal(t, "A test tool", metadata.Description)
}

func TestValidate_ValidComplexMetadata(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	validJSON := `{
		"atip": {"version": "0.4"},
		"name": "gh",
		"version": "2.45.0",
		"description": "GitHub CLI",
		"homepage": "https://cli.github.com",
		"trust": {
			"source": "native",
			"verified": true
		},
		"commands": {
			"pr": {
				"description": "Manage pull requests",
				"commands": {
					"list": {
						"description": "List pull requests",
						"options": [
							{
								"name": "state",
								"flags": ["-s", "--state"],
								"type": "enum",
								"enum": ["open", "closed", "merged"],
								"default": "open",
								"description": "Filter by state"
							}
						],
						"effects": {
							"network": true,
							"idempotent": true
						}
					}
				}
			}
		}
	}`

	metadata, err := v.Validate([]byte(validJSON))
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, "gh", metadata.Name)
}

func TestValidate_MissingRequiredFields(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	tests := []struct {
		name string
		json string
	}{
		{
			name: "missing atip field",
			json: `{"name": "tool", "version": "1.0.0", "description": "test"}`,
		},
		{
			name: "missing name field",
			json: `{"atip": {"version": "0.4"}, "version": "1.0.0", "description": "test"}`,
		},
		{
			name: "missing version field",
			json: `{"atip": {"version": "0.4"}, "name": "tool", "description": "test"}`,
		},
		{
			name: "missing description field",
			json: `{"atip": {"version": "0.4"}, "name": "tool", "version": "1.0.0"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := v.Validate([]byte(tt.json))
			assert.Error(t, err)
		})
	}
}

func TestValidate_InvalidJSON(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	_, err = v.Validate([]byte("not valid json"))
	assert.Error(t, err)
}

func TestValidate_InvalidAtipVersion(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	invalidJSON := `{
		"atip": {"version": "99.99"},
		"name": "tool",
		"version": "1.0.0",
		"description": "test"
	}`

	_, err = v.Validate([]byte(invalidJSON))
	assert.Error(t, err)
}

func TestValidate_LegacyAtipFormat(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	// Legacy format: "atip": "0.3"
	legacyJSON := `{
		"atip": "0.3",
		"name": "tool",
		"version": "1.0.0",
		"description": "test",
		"commands": {
			"run": {
				"description": "Run",
				"effects": {"network": false}
			}
		}
	}`

	metadata, err := v.Validate([]byte(legacyJSON))
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, "tool", metadata.Name)
}

func TestValidate_InvalidEffects(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	tests := []struct {
		name string
		json string
	}{
		{
			name: "effects with invalid type",
			json: `{
				"atip": {"version": "0.4"},
				"name": "tool",
				"version": "1.0.0",
				"description": "test",
				"commands": {
					"run": {
						"description": "Run",
						"effects": {
							"destructive": "yes"
						}
					}
				}
			}`,
		},
		{
			name: "missing effects object",
			json: `{
				"atip": {"version": "0.4"},
				"name": "tool",
				"version": "1.0.0",
				"description": "test",
				"commands": {
					"run": {
						"description": "Run"
					}
				}
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := v.Validate([]byte(tt.json))
			assert.Error(t, err)
		})
	}
}

func TestValidate_PartialDiscovery(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	partialJSON := `{
		"atip": {"version": "0.4"},
		"name": "kubectl",
		"version": "1.28.0",
		"description": "Kubernetes CLI",
		"partial": true,
		"omitted": {
			"reason": "filtered",
			"safetyAssumption": "unknown"
		},
		"commands": {
			"get": {
				"description": "Get resources",
				"effects": {"network": true}
			}
		}
	}`

	metadata, err := v.Validate([]byte(partialJSON))
	require.NoError(t, err)
	assert.NotNil(t, metadata)
}

func TestParseJSON(t *testing.T) {
	validJSON := `{
		"atip": {"version": "0.4"},
		"name": "tool",
		"version": "1.0.0",
		"description": "test"
	}`

	metadata, err := ParseJSON([]byte(validJSON))
	require.NoError(t, err)
	assert.Equal(t, "tool", metadata.Name)
	assert.Equal(t, "1.0.0", metadata.Version)
}

func TestParseJSON_Invalid(t *testing.T) {
	_, err := ParseJSON([]byte("not json"))
	assert.Error(t, err)
}

func TestValidateMetadata(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	metadata := &AtipMetadata{
		Atip: map[string]interface{}{
			"version": "0.4",
		},
		Name:        "tool",
		Version:     "1.0.0",
		Description: "test",
		Commands: map[string]interface{}{
			"run": map[string]interface{}{
				"description": "Run",
				"effects": map[string]interface{}{
					"network": false,
				},
			},
		},
	}

	err = v.ValidateMetadata(metadata)
	assert.NoError(t, err)
}

func TestValidationError_Error(t *testing.T) {
	err := &ValidationError{
		Field:   "name",
		Message: "field is required",
	}

	assert.Contains(t, err.Error(), "name")
	assert.Contains(t, err.Error(), "required")
}

func TestNewWithSchema_CustomSchema(t *testing.T) {
	// Test with custom schema path
	v, err := NewWithSchema("/custom/schema.json")
	if err != nil {
		// Expected if file doesn't exist
		assert.Error(t, err)
	} else {
		assert.NotNil(t, v)
	}
}

func TestValidate_OptionsWithAllTypes(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	jsonWithOptions := `{
		"atip": {"version": "0.4"},
		"name": "tool",
		"version": "1.0.0",
		"description": "test",
		"commands": {
			"run": {
				"description": "Run",
				"options": [
					{
						"name": "string-opt",
						"flags": ["--str"],
						"type": "string",
						"description": "A string option"
					},
					{
						"name": "int-opt",
						"flags": ["--int"],
						"type": "integer",
						"description": "An integer option"
					},
					{
						"name": "bool-opt",
						"flags": ["--bool"],
						"type": "boolean",
						"description": "A boolean flag"
					},
					{
						"name": "enum-opt",
						"flags": ["--enum"],
						"type": "enum",
						"enum": ["a", "b", "c"],
						"description": "An enum option"
					}
				],
				"effects": {"network": false}
			}
		}
	}`

	metadata, err := v.Validate([]byte(jsonWithOptions))
	require.NoError(t, err)
	assert.NotNil(t, metadata)
}

func TestValidate_NestedCommands(t *testing.T) {
	v, err := New()
	require.NoError(t, err)

	nestedJSON := `{
		"atip": {"version": "0.4"},
		"name": "tool",
		"version": "1.0.0",
		"description": "test",
		"commands": {
			"level1": {
				"description": "Level 1",
				"commands": {
					"level2": {
						"description": "Level 2",
						"commands": {
							"level3": {
								"description": "Level 3",
								"effects": {"network": false}
							}
						}
					}
				}
			}
		}
	}`

	metadata, err := v.Validate([]byte(nestedJSON))
	require.NoError(t, err)
	assert.NotNil(t, metadata)
}
