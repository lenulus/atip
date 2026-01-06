package output

import (
	"io"
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
	// TODO: Implement
	panic("not implemented")
}

// JSONWriter writes output in JSON format.
type JSONWriter struct {
	w io.Writer
}

// NewJSONWriter creates a new JSON writer.
func NewJSONWriter(w io.Writer) *JSONWriter {
	// TODO: Implement
	panic("not implemented")
}

// Write writes v as JSON.
func (jw *JSONWriter) Write(v interface{}) error {
	// TODO: Implement
	panic("not implemented")
}

// TableWriter writes output in table format.
type TableWriter struct {
	w io.Writer
}

// NewTableWriter creates a new table writer.
func NewTableWriter(w io.Writer) *TableWriter {
	// TODO: Implement
	panic("not implemented")
}

// Write writes v as a formatted table.
func (tw *TableWriter) Write(v interface{}) error {
	// TODO: Implement
	panic("not implemented")
}

// QuietWriter writes minimal output.
type QuietWriter struct {
	w io.Writer
}

// NewQuietWriter creates a new quiet writer.
func NewQuietWriter(w io.Writer) *QuietWriter {
	// TODO: Implement
	panic("not implemented")
}

// Write writes minimal output for v.
func (qw *QuietWriter) Write(v interface{}) error {
	// TODO: Implement
	panic("not implemented")
}
