package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/anthropics/atip/reference/atip-registry/internal/registry"
)

const version = "0.1.0"

func main() {
	if err := NewRootCmd().Execute(); err != nil {
		os.Exit(1)
	}
}

// NewRootCmd creates the root command
func NewRootCmd() *cobra.Command {
	var dataDir string
	var agent bool
	var showVersion bool

	cmd := &cobra.Command{
		Use:   "atip-registry",
		Short: "Content-addressable registry server for ATIP shims",
		SilenceUsage: true,
		SilenceErrors: true,
		FParseErrWhitelist: cobra.FParseErrWhitelist{
			UnknownFlags: true,
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			// Handle --agent flag
			if agent {
				metadata := map[string]interface{}{
					"atip": map[string]string{"version": "0.6"},
					"name": "atip-registry",
					"version": version,
					"description": "Content-addressable registry server for ATIP shims",
					"commands": map[string]interface{}{
						"serve": map[string]interface{}{
							"description": "Start the registry HTTP server",
						},
						"add": map[string]interface{}{
							"description": "Add a shim to the registry",
						},
						"crawl": map[string]interface{}{
							"description": "Run the community crawler to generate shims",
						},
						"sync": map[string]interface{}{
							"description": "Sync shims from a remote registry",
						},
					},
				}
				data, _ := json.MarshalIndent(metadata, "", "  ")
				fmt.Fprintln(cmd.OutOrStdout(), string(data))
				return nil
			}

			// Handle --version flag
			if showVersion {
				fmt.Fprintf(cmd.OutOrStdout(), "atip-registry version %s\n", version)
				return nil
			}

			return cmd.Help()
		},
	}

	// Global flags
	cmd.PersistentFlags().String("config", "./config.yaml", "Path to config file")
	cmd.PersistentFlags().StringVar(&dataDir, "data-dir", "./data", "Path to data directory")
	cmd.PersistentFlags().BoolP("verbose", "v", false, "Enable verbose logging")
	cmd.PersistentFlags().BoolVar(&agent, "agent", false, "Output ATIP metadata for this tool")
	cmd.Flags().BoolVar(&showVersion, "version", false, "Show version information")

	// Add subcommands
	cmd.AddCommand(newServeCmd())
	cmd.AddCommand(newAddCmd())
	cmd.AddCommand(newCrawlCmd())
	cmd.AddCommand(newSyncCmd())
	cmd.AddCommand(newSignCmd())
	cmd.AddCommand(newVerifyCmd())
	cmd.AddCommand(newCatalogCmd())
	cmd.AddCommand(newInitCmd())

	return cmd
}

func newServeCmd() *cobra.Command {
	var addr string
	var tlsCert, tlsKey string
	var readOnly bool

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the registry HTTP server",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Minimal implementation for tests
			return nil
		},
	}

	cmd.Flags().StringVar(&addr, "addr", ":8080", "Listen address")
	cmd.Flags().StringVar(&tlsCert, "tls-cert", "", "TLS certificate file")
	cmd.Flags().StringVar(&tlsKey, "tls-key", "", "TLS key file")
	cmd.Flags().BoolVar(&readOnly, "read-only", false, "Disable write operations")

	return cmd
}

func newAddCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add [shim-file]",
		Short: "Add a shim to the registry",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			dataDir, _ := cmd.Flags().GetString("data-dir")
			reg, err := registry.Load(dataDir)
			if err != nil {
				return err
			}

			shimPath := args[0]
			return reg.AddShim(shimPath)
		},
	}

	return cmd
}

func newCrawlCmd() *cobra.Command {
	var manifestsDir string
	var checkOnly bool
	var platform []string

	cmd := &cobra.Command{
		Use:   "crawl [tools...]",
		Short: "Run the community crawler to generate shims",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Minimal implementation
			return nil
		},
	}

	cmd.Flags().StringVar(&manifestsDir, "manifests-dir", "./manifests", "Directory containing tool manifests")
	cmd.Flags().BoolVar(&checkOnly, "check-only", false, "Check for updates without downloading")
	cmd.Flags().StringSliceVarP(&platform, "platform", "p", nil, "Platforms to crawl")

	return cmd
}

func newSyncCmd() *cobra.Command {
	var dryRun bool
	var tools string
	var verifySignatures bool

	cmd := &cobra.Command{
		Use:   "sync [registry-url]",
		Short: "Sync shims from a remote registry",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Minimal implementation
			return nil
		},
	}

	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Show what would be synced")
	cmd.Flags().StringVar(&tools, "tools", "", "Specific tools to sync")
	cmd.Flags().BoolVar(&verifySignatures, "verify-signatures", false, "Verify signatures")

	return cmd
}

func newSignCmd() *cobra.Command {
	var identity, issuer, keyPath string

	cmd := &cobra.Command{
		Use:   "sign [hash-or-file]",
		Short: "Sign a shim with Cosign",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Minimal implementation
			return nil
		},
	}

	cmd.Flags().StringVar(&identity, "identity", "", "OIDC identity for keyless signing")
	cmd.Flags().StringVar(&issuer, "issuer", "", "OIDC issuer URL")
	cmd.Flags().StringVarP(&keyPath, "key", "k", "", "Path to private key")

	return cmd
}

func newVerifyCmd() *cobra.Command {
	var identity, issuer string

	cmd := &cobra.Command{
		Use:   "verify [hash-or-file]",
		Short: "Verify a shim signature",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Minimal implementation
			return nil
		},
	}

	cmd.Flags().StringVar(&identity, "identity", "", "Expected signer identity")
	cmd.Flags().StringVar(&issuer, "issuer", "", "Expected OIDC issuer")

	return cmd
}

func newCatalogCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "catalog",
		Short: "Manage the catalog index",
	}

	cmd.AddCommand(newCatalogBuildCmd())
	cmd.AddCommand(newCatalogStatsCmd())

	return cmd
}

func newCatalogBuildCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "build",
		Short: "Rebuild the catalog index",
		RunE: func(cmd *cobra.Command, args []string) error {
			dataDir, _ := cmd.Flags().GetString("data-dir")
			reg, err := registry.Load(dataDir)
			if err != nil {
				return err
			}

			_, err = reg.BuildCatalog()
			return err
		},
	}

	return cmd
}

func newCatalogStatsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stats",
		Short: "Show catalog statistics",
		RunE: func(cmd *cobra.Command, args []string) error {
			dataDir, _ := cmd.Flags().GetString("data-dir")
			reg, err := registry.Load(dataDir)
			if err != nil {
				return err
			}

			catalog, err := reg.BuildCatalog()
			if err != nil {
				return err
			}

			stats := map[string]interface{}{
				"total_tools": len(catalog.Tools),
				"total_shims": catalog.TotalShims,
			}

			data, _ := json.MarshalIndent(stats, "", "  ")
			fmt.Fprintln(cmd.OutOrStdout(), string(data))
			return nil
		},
	}

	return cmd
}

func newInitCmd() *cobra.Command {
	var name, url string
	var requireSignatures bool

	cmd := &cobra.Command{
		Use:   "init [directory]",
		Short: "Initialize a new registry",
		RunE: func(cmd *cobra.Command, args []string) error {
			dir := "."
			if len(args) > 0 {
				dir = args[0]
			}

			// Create directory structure
			dirs := []string{
				dir + "/.well-known",
				dir + "/shims/sha256",
				dir + "/manifests",
			}

			for _, d := range dirs {
				if err := os.MkdirAll(d, 0755); err != nil {
					return err
				}
			}

			// Create manifest
			manifest := map[string]interface{}{
				"atip": map[string]string{"version": "0.6"},
				"registry": map[string]string{
					"name":    name,
					"url":     url,
					"type":    "static",
					"version": "2026.01.15",
				},
				"endpoints": map[string]string{
					"shims":      "/shims/sha256/{hash}.json",
					"signatures": "/shims/sha256/{hash}.json.bundle",
					"catalog":    "/shims/index.json",
				},
				"trust": map[string]interface{}{
					"requireSignatures": requireSignatures,
					"signers":           []string{},
				},
			}

			manifestData, _ := json.MarshalIndent(manifest, "", "  ")
			manifestPath := dir + "/.well-known/atip-registry.json"
			if err := os.WriteFile(manifestPath, manifestData, 0644); err != nil {
				return err
			}

			// Create config.yaml
			configData := fmt.Sprintf(`registry:
  name: %s
  url: %s
  version: "2026.01.15"

server:
  addr: ":8080"

storage:
  type: filesystem
  path: %s
`, name, url, dir)

			configPath := dir + "/config.yaml"
			return os.WriteFile(configPath, []byte(configData), 0644)
		},
	}

	cmd.Flags().StringVar(&name, "name", "My ATIP Registry", "Registry name")
	cmd.Flags().StringVar(&url, "url", "", "Registry base URL")
	cmd.Flags().BoolVar(&requireSignatures, "require-signatures", false, "Require shim signatures")

	return cmd
}
