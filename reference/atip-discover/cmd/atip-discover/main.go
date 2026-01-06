package main

import (
	"fmt"
	"os"
)

// Version information (set via build flags)
var (
	Version   = "0.1.0"
	GoVersion = "unknown"
	BuildDate = "unknown"
	Commit    = "unknown"
)

func main() {
	// TODO: Implement CLI
	fmt.Fprintf(os.Stderr, "atip-discover not yet implemented\n")
	os.Exit(1)
}
