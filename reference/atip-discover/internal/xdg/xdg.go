package xdg

// DataHome returns the XDG_DATA_HOME directory.
// Falls back to ~/.local/share if XDG_DATA_HOME is not set.
func DataHome() string {
	// TODO: Implement
	panic("not implemented")
}

// ConfigHome returns the XDG_CONFIG_HOME directory.
// Falls back to ~/.config if XDG_CONFIG_HOME is not set.
func ConfigHome() string {
	// TODO: Implement
	panic("not implemented")
}

// AgentToolsDataDir returns the agent-tools data directory.
func AgentToolsDataDir() string {
	// TODO: Implement
	panic("not implemented")
}

// AgentToolsConfigDir returns the agent-tools config directory.
func AgentToolsConfigDir() string {
	// TODO: Implement
	panic("not implemented")
}

// EnsureDataDirs creates the necessary data directories if they don't exist.
func EnsureDataDirs() error {
	// TODO: Implement
	panic("not implemented")
}

// ExpandTilde expands ~ to the user's home directory.
func ExpandTilde(path string) string {
	// TODO: Implement
	panic("not implemented")
}
