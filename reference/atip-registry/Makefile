.PHONY: test test-unit test-integration test-coverage clean help

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
BINARY_NAME=atip-registry
COVERAGE_FILE=coverage.out

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

test: ## Run all tests (expected to fail in RED phase)
	@echo "Running all tests..."
	@echo "⚠️  RED PHASE: Tests are expected to FAIL (not implemented)"
	$(GOTEST) -v ./...

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	$(GOTEST) -v -short ./internal/...

test-integration: ## Run integration tests only
	@echo "Running integration tests..."
	$(GOTEST) -v -run Integration ./...

test-coverage: ## Run tests with coverage report
	@echo "Running tests with coverage..."
	$(GOTEST) -coverprofile=$(COVERAGE_FILE) ./...
	$(GOCMD) tool cover -html=$(COVERAGE_FILE)

test-coverage-text: ## Run tests with coverage (text output)
	@echo "Running tests with coverage..."
	$(GOTEST) -cover ./...

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy

build: ## Build the binary
	@echo "Building $(BINARY_NAME)..."
	$(GOBUILD) -o $(BINARY_NAME) ./cmd/atip-registry

clean: ## Clean build artifacts and coverage files
	@echo "Cleaning..."
	rm -f $(BINARY_NAME)
	rm -f $(COVERAGE_FILE)
	rm -rf dist/

verify: ## Verify tests compile
	@echo "Verifying tests compile..."
	@$(GOTEST) -run=^$$ ./... && echo "✓ All tests compile successfully" || echo "✗ Test compilation failed"

lint: ## Run linter (if golangci-lint is installed)
	@which golangci-lint > /dev/null && golangci-lint run || echo "golangci-lint not installed, skipping"

red-phase: verify ## Verify RED phase (tests compile and fail)
	@echo "========================================"
	@echo "RED PHASE VERIFICATION"
	@echo "========================================"
	@echo ""
	@echo "1. Verifying tests compile..."
	@$(GOTEST) -run=^$$ ./... > /dev/null 2>&1 && echo "   ✓ All tests compile" || (echo "   ✗ Tests do not compile" && exit 1)
	@echo ""
	@echo "2. Verifying tests fail (as expected)..."
	@$(GOTEST) ./... > /dev/null 2>&1 && echo "   ✗ Tests passed (unexpected - should fail in RED phase)" || echo "   ✓ Tests fail (expected in RED phase)"
	@echo ""
	@echo "3. Test coverage breakdown:"
	@$(GOTEST) -cover ./internal/server 2>/dev/null || true
	@$(GOTEST) -cover ./internal/registry 2>/dev/null || true
	@$(GOTEST) -cover ./internal/crawler 2>/dev/null || true
	@$(GOTEST) -cover ./internal/sync 2>/dev/null || true
	@$(GOTEST) -cover ./internal/trust 2>/dev/null || true
	@$(GOTEST) -cover ./cmd/atip-registry 2>/dev/null || true
	@echo ""
	@echo "========================================"
	@echo "RED PHASE: Tests ready for GREEN phase"
	@echo "========================================"

.DEFAULT_GOAL := help
