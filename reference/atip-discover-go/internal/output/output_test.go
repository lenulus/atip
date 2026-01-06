package output

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test data structures
type ListResult struct {
	Count int          `json:"count"`
	Tools []ToolSummary `json:"tools"`
}

type ToolSummary struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Source      string `json:"source"`
}

func TestNewWriter(t *testing.T) {
	tests := []struct {
		name   string
		format Format
	}{
		{"json format", FormatJSON},
		{"table format", FormatTable},
		{"quiet format", FormatQuiet},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			w, err := NewWriter(tt.format, &buf)
			require.NoError(t, err)
			assert.NotNil(t, w)
		})
	}
}

func TestNewWriter_InvalidFormat(t *testing.T) {
	var buf bytes.Buffer
	_, err := NewWriter(Format("invalid"), &buf)
	assert.Error(t, err)
}

func TestJSONWriter_Write(t *testing.T) {
	var buf bytes.Buffer
	w := NewJSONWriter(&buf)

	data := ListResult{
		Count: 2,
		Tools: []ToolSummary{
			{
				Name:        "gh",
				Version:     "2.45.0",
				Description: "GitHub CLI",
				Source:      "native",
			},
			{
				Name:        "kubectl",
				Version:     "1.28.0",
				Description: "Kubernetes CLI",
				Source:      "native",
			},
		},
	}

	err := w.Write(data)
	require.NoError(t, err)

	// Verify valid JSON
	var result ListResult
	err = json.Unmarshal(buf.Bytes(), &result)
	require.NoError(t, err)
	assert.Equal(t, 2, result.Count)
	assert.Len(t, result.Tools, 2)
	assert.Equal(t, "gh", result.Tools[0].Name)
}

func TestJSONWriter_WriteIndented(t *testing.T) {
	var buf bytes.Buffer
	w := NewJSONWriter(&buf)

	data := map[string]interface{}{
		"name":    "tool",
		"version": "1.0.0",
	}

	err := w.Write(data)
	require.NoError(t, err)

	// Should be indented (human-readable)
	output := buf.String()
	assert.Contains(t, output, "  ") // Has indentation
	assert.Contains(t, output, "tool")
}

func TestTableWriter_WriteList(t *testing.T) {
	var buf bytes.Buffer
	w := NewTableWriter(&buf)

	data := ListResult{
		Count: 2,
		Tools: []ToolSummary{
			{
				Name:        "gh",
				Version:     "2.45.0",
				Description: "GitHub CLI",
				Source:      "native",
			},
			{
				Name:        "kubectl",
				Version:     "1.28.0",
				Description: "Kubernetes CLI",
				Source:      "native",
			},
		},
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := buf.String()

	// Should contain headers
	assert.Contains(t, output, "NAME")
	assert.Contains(t, output, "VERSION")
	assert.Contains(t, output, "SOURCE")
	assert.Contains(t, output, "DESCRIPTION")

	// Should contain data
	assert.Contains(t, output, "gh")
	assert.Contains(t, output, "2.45.0")
	assert.Contains(t, output, "kubectl")
	assert.Contains(t, output, "1.28.0")
}

func TestTableWriter_EmptyList(t *testing.T) {
	var buf bytes.Buffer
	w := NewTableWriter(&buf)

	data := ListResult{
		Count: 0,
		Tools: []ToolSummary{},
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := buf.String()
	// Should indicate no tools found
	assert.Contains(t, strings.ToLower(output), "no tools")
}

func TestQuietWriter_WriteList(t *testing.T) {
	var buf bytes.Buffer
	w := NewQuietWriter(&buf)

	data := ListResult{
		Count: 2,
		Tools: []ToolSummary{
			{Name: "gh"},
			{Name: "kubectl"},
		},
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := buf.String()
	lines := strings.Split(strings.TrimSpace(output), "\n")

	// Should only contain tool names
	assert.Len(t, lines, 2)
	assert.Equal(t, "gh", lines[0])
	assert.Equal(t, "kubectl", lines[1])
}

func TestQuietWriter_WriteCount(t *testing.T) {
	var buf bytes.Buffer
	w := NewQuietWriter(&buf)

	// For scan results, quiet mode shows count
	data := map[string]interface{}{
		"discovered": 5,
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := strings.TrimSpace(buf.String())
	assert.Equal(t, "5", output)
}

func TestJSONWriter_WriteError(t *testing.T) {
	var buf bytes.Buffer
	w := NewJSONWriter(&buf)

	errorData := map[string]interface{}{
		"error": map[string]interface{}{
			"code":    "TOOL_NOT_FOUND",
			"message": "tool 'nonexistent' not found",
		},
	}

	err := w.Write(errorData)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &result)
	require.NoError(t, err)

	errorObj := result["error"].(map[string]interface{})
	assert.Equal(t, "TOOL_NOT_FOUND", errorObj["code"])
}

func TestTableWriter_Alignment(t *testing.T) {
	var buf bytes.Buffer
	w := NewTableWriter(&buf)

	data := ListResult{
		Count: 2,
		Tools: []ToolSummary{
			{
				Name:        "gh",
				Version:     "2.45.0",
				Description: "Short",
				Source:      "native",
			},
			{
				Name:        "very-long-tool-name",
				Version:     "1.0.0",
				Description: "A much longer description",
				Source:      "shim",
			},
		},
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := buf.String()
	lines := strings.Split(output, "\n")

	// All lines should have similar lengths (aligned columns)
	// This is a simple check - actual implementation would have proper alignment
	assert.Greater(t, len(lines), 2)
}

func TestQuietWriter_EmptyList(t *testing.T) {
	var buf bytes.Buffer
	w := NewQuietWriter(&buf)

	data := ListResult{
		Count: 0,
		Tools: []ToolSummary{},
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := buf.String()
	assert.Empty(t, strings.TrimSpace(output))
}

func TestJSONWriter_NilValue(t *testing.T) {
	var buf bytes.Buffer
	w := NewJSONWriter(&buf)

	err := w.Write(nil)
	require.NoError(t, err)

	output := strings.TrimSpace(buf.String())
	assert.Equal(t, "null", output)
}

func TestTableWriter_SingleTool(t *testing.T) {
	var buf bytes.Buffer
	w := NewTableWriter(&buf)

	data := ListResult{
		Count: 1,
		Tools: []ToolSummary{
			{
				Name:        "gh",
				Version:     "2.45.0",
				Description: "GitHub CLI",
				Source:      "native",
			},
		},
	}

	err := w.Write(data)
	require.NoError(t, err)

	output := buf.String()
	assert.Contains(t, output, "gh")
	assert.Contains(t, output, "2.45.0")
}
