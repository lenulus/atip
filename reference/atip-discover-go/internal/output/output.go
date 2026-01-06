// Package output provides output formatters for displaying scan results
// and tool metadata in various formats (JSON, table, quiet).
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"reflect"
)

// Format represents an output format.
type Format string

const (
	FormatJSON  Format = "json"
	FormatTable Format = "table"
	FormatQuiet Format = "quiet"
)

// Writer is the interface for output formatters.
type Writer interface {
	Write(v interface{}) error
}

// NewWriter creates a writer for the specified format.
func NewWriter(format Format, w io.Writer) (Writer, error) {
	switch format {
	case FormatJSON:
		return NewJSONWriter(w), nil
	case FormatTable:
		return NewTableWriter(w), nil
	case FormatQuiet:
		return NewQuietWriter(w), nil
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
}

// JSONWriter writes output in JSON format.
type JSONWriter struct {
	w io.Writer
}

// NewJSONWriter creates a new JSON writer.
func NewJSONWriter(w io.Writer) *JSONWriter {
	return &JSONWriter{w: w}
}

// Write writes v as JSON.
func (jw *JSONWriter) Write(v interface{}) error {
	encoder := json.NewEncoder(jw.w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(v)
}

// TableWriter writes output in table format.
type TableWriter struct {
	w io.Writer
}

// NewTableWriter creates a new table writer.
func NewTableWriter(w io.Writer) *TableWriter {
	return &TableWriter{w: w}
}

// Write writes v as a formatted table.
func (tw *TableWriter) Write(v interface{}) error {
	// Use reflection to handle different types
	val := reflect.ValueOf(v)
	if val.Kind() == reflect.Struct {
		return tw.writeStruct(v)
	}

	// Fallback to JSON output for unknown types
	encoder := json.NewEncoder(tw.w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(v)
}

func (tw *TableWriter) writeStruct(v interface{}) error {
	// Extract fields using reflection
	val := reflect.ValueOf(v)
	typ := val.Type()

	// Look for a "Tools" field (for list results)
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		fieldName := typ.Field(i).Name

		if fieldName == "Tools" && field.Kind() == reflect.Slice {
			return tw.writeToolsList(field.Interface())
		}

		if fieldName == "Count" {
			// Check if tools list is empty
			count := field.Interface()
			if c, ok := count.(int); ok && c == 0 {
				fmt.Fprintln(tw.w, "No tools found")
				return nil
			}
		}
	}

	// Fallback
	encoder := json.NewEncoder(tw.w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(v)
}

func (tw *TableWriter) writeToolsList(tools interface{}) error {
	toolsSlice := reflect.ValueOf(tools)
	if toolsSlice.Len() == 0 {
		fmt.Fprintln(tw.w, "No tools found")
		return nil
	}

	// Write header
	fmt.Fprintf(tw.w, "%-20s %-10s %-8s %s\n", "NAME", "VERSION", "SOURCE", "DESCRIPTION")

	// Write rows
	for i := 0; i < toolsSlice.Len(); i++ {
		tool := toolsSlice.Index(i)

		name := getFieldString(tool, "Name")
		version := getFieldString(tool, "Version")
		source := getFieldString(tool, "Source")
		description := getFieldString(tool, "Description")

		// Truncate description if too long
		if len(description) > 50 {
			description = description[:47] + "..."
		}

		fmt.Fprintf(tw.w, "%-20s %-10s %-8s %s\n", name, version, source, description)
	}

	return nil
}

func getFieldString(val reflect.Value, fieldName string) string {
	if val.Kind() != reflect.Struct {
		return ""
	}

	field := val.FieldByName(fieldName)
	if !field.IsValid() {
		return ""
	}

	if field.Kind() == reflect.String {
		return field.String()
	}

	return fmt.Sprintf("%v", field.Interface())
}

// QuietWriter writes minimal output.
type QuietWriter struct {
	w io.Writer
}

// NewQuietWriter creates a new quiet writer.
func NewQuietWriter(w io.Writer) *QuietWriter {
	return &QuietWriter{w: w}
}

// Write writes minimal output for v.
func (qw *QuietWriter) Write(v interface{}) error {
	val := reflect.ValueOf(v)

	// Handle structs with Tools field
	if val.Kind() == reflect.Struct {
		for i := 0; i < val.NumField(); i++ {
			field := val.Field(i)
			fieldName := val.Type().Field(i).Name

			if fieldName == "Tools" && field.Kind() == reflect.Slice {
				for j := 0; j < field.Len(); j++ {
					tool := field.Index(j)
					name := getFieldString(tool, "Name")
					if name != "" {
						fmt.Fprintln(qw.w, name)
					}
				}
				return nil
			}
		}
	}

	// Handle maps (for scan results with "discovered" field)
	if val.Kind() == reflect.Map {
		m, ok := v.(map[string]interface{})
		if ok {
			if discovered, exists := m["discovered"]; exists {
				fmt.Fprintln(qw.w, discovered)
				return nil
			}
		}
	}

	// Empty output for empty lists
	return nil
}
