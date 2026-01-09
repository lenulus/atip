#!/bin/bash

# Script to verify RED phase is complete
# All tests should fail with import errors because src/ doesn't exist

set -e

echo "=================================================="
echo "RED Phase Verification for atip-diff"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track verification status
all_checks_passed=true

# Function to print check result
print_check() {
    local status=$1
    local message=$2

    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✓${NC} $message"
    elif [ "$status" = "fail" ]; then
        echo -e "${RED}✗${NC} $message"
        all_checks_passed=false
    else
        echo -e "${YELLOW}⚠${NC} $message"
    fi
}

echo "1. Checking directory structure..."
echo ""

# Check if src/ does NOT exist
if [ -d "src" ]; then
    print_check "fail" "src/ directory exists (should not exist in RED phase)"
else
    print_check "pass" "src/ directory does not exist (correct for RED phase)"
fi

# Check if tests/ exists
if [ -d "tests" ]; then
    print_check "pass" "tests/ directory exists"
else
    print_check "fail" "tests/ directory does not exist"
fi

# Check if blue/ exists
if [ -d "blue" ]; then
    print_check "pass" "blue/ directory exists"
else
    print_check "fail" "blue/ directory does not exist"
fi

echo ""
echo "2. Counting test files..."
echo ""

# Count unit tests
unit_test_count=$(find tests/unit -name "*.test.ts" 2>/dev/null | wc -l | xargs)
if [ "$unit_test_count" -ge 8 ]; then
    print_check "pass" "Found $unit_test_count unit test files (expected 8+)"
else
    print_check "fail" "Found $unit_test_count unit test files (expected 8+)"
fi

# Count integration tests
integration_test_count=$(find tests/integration -name "*.test.ts" 2>/dev/null | wc -l | xargs)
if [ "$integration_test_count" -ge 2 ]; then
    print_check "pass" "Found $integration_test_count integration test files (expected 2+)"
else
    print_check "fail" "Found $integration_test_count integration test files (expected 2+)"
fi

# Count fixtures
fixture_count=$(find tests/fixtures -name "*.json" 2>/dev/null | wc -l | xargs)
if [ "$fixture_count" -ge 10 ]; then
    print_check "pass" "Found $fixture_count test fixtures (expected 10+)"
else
    print_check "fail" "Found $fixture_count test fixtures (expected 10+)"
fi

echo ""
echo "3. Checking configuration files..."
echo ""

# Check package.json
if [ -f "package.json" ]; then
    print_check "pass" "package.json exists"

    # Check for required dependencies
    if grep -q "vitest" package.json; then
        print_check "pass" "vitest dependency found"
    else
        print_check "fail" "vitest dependency not found"
    fi

    if grep -q "typescript" package.json; then
        print_check "pass" "typescript dependency found"
    else
        print_check "fail" "typescript dependency not found"
    fi
else
    print_check "fail" "package.json does not exist"
fi

# Check tsconfig.json
if [ -f "tsconfig.json" ]; then
    print_check "pass" "tsconfig.json exists"
else
    print_check "fail" "tsconfig.json does not exist"
fi

# Check vitest.config.ts
if [ -f "vitest.config.ts" ]; then
    print_check "pass" "vitest.config.ts exists"
else
    print_check "fail" "vitest.config.ts does not exist"
fi

echo ""
echo "4. Checking Blue phase documentation..."
echo ""

if [ -f "blue/api.md" ]; then
    print_check "pass" "blue/api.md exists"
else
    print_check "fail" "blue/api.md does not exist"
fi

if [ -f "blue/design.md" ]; then
    print_check "pass" "blue/design.md exists"
else
    print_check "fail" "blue/design.md does not exist"
fi

if [ -f "blue/examples.md" ]; then
    print_check "pass" "blue/examples.md exists"
else
    print_check "fail" "blue/examples.md does not exist"
fi

echo ""
echo "5. Verifying test imports reference src/..."
echo ""

# Check that tests import from src/
import_count=$(grep -r "from '../../src" tests --include="*.test.ts" 2>/dev/null | wc -l | xargs)
if [ "$import_count" -gt 0 ]; then
    print_check "pass" "Found $import_count imports from src/ (tests reference implementation)"
else
    print_check "fail" "No imports from src/ found in tests"
fi

echo ""
echo "6. Checking test structure..."
echo ""

# Check for describe blocks
describe_count=$(grep -r "describe(" tests 2>/dev/null | wc -l | xargs)
if [ "$describe_count" -gt 0 ]; then
    print_check "pass" "Found $describe_count describe blocks"
else
    print_check "fail" "No describe blocks found"
fi

# Check for it blocks
it_count=$(grep -r "it('should" tests 2>/dev/null | wc -l | xargs)
if [ "$it_count" -ge 80 ]; then
    print_check "pass" "Found $it_count test cases (expected 80+)"
else
    print_check "fail" "Found $it_count test cases (expected 80+)"
fi

echo ""
echo "7. Checking documentation..."
echo ""

if [ -f "tests/README.md" ]; then
    print_check "pass" "tests/README.md exists"
else
    print_check "fail" "tests/README.md does not exist"
fi

if [ -f "README.md" ]; then
    print_check "pass" "README.md exists"
else
    print_check "fail" "README.md does not exist"
fi

if [ -f "TESTING.md" ]; then
    print_check "pass" "TESTING.md exists"
else
    print_check "fail" "TESTING.md does not exist"
fi

echo ""
echo "8. Checking fixture categories..."
echo ""

if [ -d "tests/fixtures/base" ]; then
    base_count=$(ls tests/fixtures/base/*.json 2>/dev/null | wc -l | xargs)
    print_check "pass" "Found $base_count base fixtures"
else
    print_check "fail" "tests/fixtures/base/ does not exist"
fi

if [ -d "tests/fixtures/breaking" ]; then
    breaking_count=$(ls tests/fixtures/breaking/*.json 2>/dev/null | wc -l | xargs)
    print_check "pass" "Found $breaking_count breaking change fixtures"
else
    print_check "fail" "tests/fixtures/breaking/ does not exist"
fi

if [ -d "tests/fixtures/non-breaking" ]; then
    non_breaking_count=$(ls tests/fixtures/non-breaking/*.json 2>/dev/null | wc -l | xargs)
    print_check "pass" "Found $non_breaking_count non-breaking change fixtures"
else
    print_check "fail" "tests/fixtures/non-breaking/ does not exist"
fi

if [ -d "tests/fixtures/effects" ]; then
    effects_count=$(ls tests/fixtures/effects/*.json 2>/dev/null | wc -l | xargs)
    print_check "pass" "Found $effects_count effects change fixtures"
else
    print_check "fail" "tests/fixtures/effects/ does not exist"
fi

echo ""
echo "=================================================="
echo "Summary"
echo "=================================================="
echo ""

if [ "$all_checks_passed" = true ]; then
    echo -e "${GREEN}✓ All RED phase checks passed!${NC}"
    echo ""
    echo "The test suite is ready. Tests should fail with import errors"
    echo "because the implementation (src/) doesn't exist yet."
    echo ""
    echo "Next steps:"
    echo "  1. Run 'npm install' to install dependencies"
    echo "  2. Run 'npm test' to verify tests fail correctly"
    echo "  3. Proceed to GREEN phase to implement src/"
    exit 0
else
    echo -e "${RED}✗ Some RED phase checks failed${NC}"
    echo ""
    echo "Please review the failures above and ensure all"
    echo "tests and fixtures are properly created."
    exit 1
fi
