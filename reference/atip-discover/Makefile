.PHONY: test test-unit test-integration test-coverage clean build install lint

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOMOD=$(GOCMD) mod
BINARY_NAME=atip-discover
MAIN_PATH=./cmd/atip-discover

# Build the binary
build:
	$(GOBUILD) -o $(BINARY_NAME) $(MAIN_PATH)

# Install the binary to GOPATH/bin
install:
	$(GOCMD) install $(MAIN_PATH)

# Run all tests (will fail in RED phase - expected)
test:
	$(GOTEST) -v ./...

# Run only unit tests
test-unit:
	$(GOTEST) -v ./internal/...

# Run only integration tests
test-integration:
	$(GOTEST) -v ./tests/integration/...

# Run tests with coverage
test-coverage:
	$(GOTEST) -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Run tests with race detector
test-race:
	$(GOTEST) -race -v ./...

# Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Verify tests fail (RED phase verification)
verify-red:
	@echo "Verifying RED phase: All tests should FAIL (not implemented)"
	@$(GOTEST) ./internal/xdg 2>&1 | grep -q "not implemented" && echo "✓ XDG tests fail as expected" || echo "✗ XDG tests unexpected behavior"
	@$(GOTEST) ./internal/config 2>&1 | grep -q "not implemented" && echo "✓ Config tests fail as expected" || echo "✗ Config tests unexpected behavior"
	@$(GOTEST) ./internal/validator 2>&1 | grep -q "not implemented" && echo "✓ Validator tests fail as expected" || echo "✗ Validator tests unexpected behavior"
	@$(GOTEST) ./internal/output 2>&1 | grep -q "not implemented" && echo "✓ Output tests fail as expected" || echo "✗ Output tests unexpected behavior"
	@$(GOTEST) ./internal/registry 2>&1 | grep -q "not implemented" && echo "✓ Registry tests fail as expected" || echo "✗ Registry tests unexpected behavior"
	@$(GOTEST) ./internal/discovery 2>&1 | grep -q "not implemented" && echo "✓ Discovery tests fail as expected" || echo "✗ Discovery tests unexpected behavior"
	@echo ""
	@echo "RED phase verified: Implementation needed to make tests pass"

# Make test fixtures executable
fixtures:
	chmod +x testdata/tools/*

# Clean build artifacts
clean:
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html
	rm -rf dist/

# Lint code (requires golangci-lint)
lint:
	golangci-lint run

# Help
help:
	@echo "Available targets:"
	@echo "  build            - Build the binary"
	@echo "  install          - Install to GOPATH/bin"
	@echo "  test             - Run all tests"
	@echo "  test-unit        - Run unit tests only"
	@echo "  test-integration - Run integration tests only"
	@echo "  test-coverage    - Generate coverage report"
	@echo "  test-race        - Run tests with race detector"
	@echo "  deps             - Download dependencies"
	@echo "  verify-red       - Verify RED phase (tests fail)"
	@echo "  fixtures         - Make test fixtures executable"
	@echo "  clean            - Clean build artifacts"
	@echo "  lint             - Run linter"
