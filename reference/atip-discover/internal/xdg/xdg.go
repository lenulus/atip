package xdg

import (
	"os"
	"path/filepath"
	"strings"
)

// DataHome returns the XDG_DATA_HOME directory.
// Falls back to ~/.local/share if XDG_DATA_HOME is not set.
func DataHome() string {
	if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
		return dir
	}
	return filepath.Join(os.Getenv("HOME"), ".local", "share")
}

// ConfigHome returns the XDG_CONFIG_HOME directory.
// Falls back to ~/.config if XDG_CONFIG_HOME is not set.
func ConfigHome() string {
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		return dir
	}
	return filepath.Join(os.Getenv("HOME"), ".config")
}

// AgentToolsDataDir returns the agent-tools data directory.
func AgentToolsDataDir() string {
	return filepath.Join(DataHome(), "agent-tools")
}

// AgentToolsConfigDir returns the agent-tools config directory.
func AgentToolsConfigDir() string {
	return filepath.Join(ConfigHome(), "agent-tools")
}

// EnsureDataDirs creates the necessary data directories if they don't exist.
func EnsureDataDirs() error {
	dirs := []string{
		AgentToolsDataDir(),
		filepath.Join(AgentToolsDataDir(), "tools"),
		filepath.Join(AgentToolsDataDir(), "shims"),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

// ExpandTilde expands ~ to the user's home directory.
func ExpandTilde(path string) string {
	if path == "~" {
		return os.Getenv("HOME")
	}
	if strings.HasPrefix(path, "~/") {
		return filepath.Join(os.Getenv("HOME"), path[2:])
	}
	return path
}
