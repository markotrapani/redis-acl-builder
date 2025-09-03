#!/bin/bash

# Redis ACL Builder - Test Runner Script

echo "🔐 Redis ACL Builder - Test Suite Runner"
echo "========================================"

# Get the project root directory (parent of tests directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📁 Script location: $SCRIPT_DIR"
echo "📁 Project root: $PROJECT_ROOT"

# Change to project root for proper imports
cd "$PROJECT_ROOT"

# Check if we're in the right directory by looking for key files
echo ""
echo "🔍 Validating project structure..."
echo "=================================="

PROJECT_VALID=1

if [ ! -f "app.py" ]; then
    echo "❌ Error: app.py not found"
    PROJECT_VALID=0
fi

if [ ! -d "helpers" ]; then
    echo "❌ Error: helpers/ directory not found"
    PROJECT_VALID=0
fi

if [ ! -f "helpers/__init__.py" ]; then
    echo "❌ Error: helpers/__init__.py not found"
    echo "   Creating empty __init__.py file..."
    touch helpers/__init__.py
fi

if [ ! -f "helpers/data_loader.py" ]; then
    echo "❌ Error: helpers/data_loader.py not found"
    PROJECT_VALID=0
fi

if [ ! -f "helpers/acl_parser.py" ]; then
    echo "❌ Error: helpers/acl_parser.py not found"  
    PROJECT_VALID=0
fi

if [ ! -f "tests/test_app.py" ]; then
    echo "❌ Error: tests/test_app.py not found"
    PROJECT_VALID=0
fi

if [ ! -f "tests/__init__.py" ]; then
    echo "ℹ️  Creating tests/__init__.py..."
    touch tests/__init__.py
fi

if [ $PROJECT_VALID -eq 0 ]; then
    echo ""
    echo "❌ Project structure validation failed!"
    echo ""
    echo "Expected structure:"
    echo "  redis_acl_builder/"
    echo "  ├── app.py"
    echo "  ├── helpers/"
    echo "  │   ├── __init__.py"
    echo "  │   ├── data_loader.py"
    echo "  │   └── acl_parser.py"
    echo "  ├── tests/"
    echo "  │   ├── __init__.py"
    echo "  │   └── test_app.py"
    echo "  ├── static/"
    echo "  └── templates/"
    echo ""
    echo "💡 Run the import test to diagnose issues:"
    echo "   python test_imports.py"
    exit 1
fi

echo "✅ Project structure validated"

# Check if virtual environment is activated
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "✅ Virtual environment detected: $VIRTUAL_ENV"
else
    echo "⚠️  No virtual environment detected. Consider activating one:"
    echo "   python -m venv venv"
    echo "   source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
    echo ""
fi

# Check Python version
PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2)
echo "🐍 Python version: $PYTHON_VERSION"

# Check if dependencies are installed
echo ""
echo "🔍 Checking dependencies..."
echo "=========================="

MISSING_DEPS=0

# Check Flask
if python -c "import flask" 2>/dev/null; then
    FLASK_VERSION=$(python -c "import flask; print(flask.__version__)" 2>/dev/null)
    echo "✅ Flask $FLASK_VERSION installed"
else
    echo "❌ Flask not found"
    MISSING_DEPS=1
fi

# Test helper imports
echo ""
echo "🧪 Testing helper imports..."
echo "============================"

export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

if python -c "from helpers.data_loader import get_redis_data; print('✅ helpers.data_loader import successful')" 2>/dev/null; then
    echo "✅ helpers.data_loader imports correctly"
else
    echo "❌ helpers.data_loader import failed"
    echo "   Please check that helpers/__init__.py exists and helpers/data_loader.py is correct"
    MISSING_DEPS=1
fi

if python -c "from helpers.acl_parser import ACLParser; print('✅ helpers.acl_parser import successful')" 2>/dev/null; then
    echo "✅ helpers.acl_parser imports correctly"  
else
    echo "❌ helpers.acl_parser import failed"
    echo "   Please check that helpers/__init__.py exists and helpers/acl_parser.py is correct"
    MISSING_DEPS=1
fi

# Install missing dependencies if needed
if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo "❌ Missing required dependencies or import issues detected."
    echo ""
    echo "🔧 Troubleshooting steps:"
    echo "1. Install dependencies: pip install -r requirements.txt"
    echo "2. Run import test: python test_imports.py"
    echo "3. Check file structure matches expected layout"
    echo ""
    read -p "🤔 Try installing dependencies now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pip install -r requirements.txt
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install dependencies"
            exit 1
        fi
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Cannot continue without proper dependencies"
        exit 1
    fi
fi

# Check optional testing tools
if python -c "import pytest" 2>/dev/null; then
    PYTEST_VERSION=$(python -c "import pytest; print(pytest.__version__)" 2>/dev/null)
    echo "✅ pytest $PYTEST_VERSION installed"
else
    echo "⚠️  pytest not found (optional but recommended)"
fi

if python -c "import coverage" 2>/dev/null; then
    COVERAGE_VERSION=$(python -c "import coverage; print(coverage.__version__)" 2>/dev/null)
    echo "✅ coverage $COVERAGE_VERSION installed"
else
    echo "⚠️  coverage not found (optional)"
fi

echo ""
echo "🧪 Running test suite..."
echo "========================"

# Set PYTHONPATH to ensure proper imports
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

# Run the test suite from project root
python tests/test_app.py

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "📊 Running tests with coverage..."
echo "================================="

# Run coverage if available
if python -c "import coverage" 2>/dev/null; then
    echo "Running coverage analysis..."
    python -m coverage run --source=. --omit="tests/*,venv/*,test_imports.py" tests/test_app.py 2>/dev/null
    if [ $? -eq 0 ]; then
        echo ""
        echo "Coverage report:"
        echo "----------------"
        python -m coverage report -m --include="*.py,helpers/*.py" --omit="tests/*,venv/*,test_imports.py"
        echo ""
        echo "💡 Generate detailed HTML coverage report with:"
        echo "   python -m coverage html"
        echo "   # Then open htmlcov/index.html in your browser"
    else
        echo "⚠️  Coverage run failed, but tests completed"
    fi
else
    echo "ℹ️  Coverage not available. Install with: pip install coverage"
fi

# Additional test methods information
echo ""
echo "🎯 Alternative test methods:"
echo "============================"
echo "• Direct execution: python tests/test_app.py"
echo "• With pytest: pytest tests/test_app.py -v"  
echo "• With coverage: coverage run tests/test_app.py && coverage report"
echo "• Import diagnostics: python test_imports.py"

echo ""
echo "📁 Project structure verification:"
echo "=================================="
echo "✅ Main app: $([ -f "app.py" ] && echo "app.py found" || echo "❌ app.py missing")"
echo "✅ Helpers: $([ -d "helpers" ] && echo "helpers/ found" || echo "❌ helpers/ missing")"
echo "✅ Helper init: $([ -f "helpers/__init__.py" ] && echo "__init__.py found" || echo "❌ __init__.py missing")"
echo "✅ Data loader: $([ -f "helpers/data_loader.py" ] && echo "data_loader.py found" || echo "❌ data_loader.py missing")"
echo "✅ ACL parser: $([ -f "helpers/acl_parser.py" ] && echo "acl_parser.py found" || echo "❌ acl_parser.py missing")"
echo "✅ Tests: $([ -f "tests/test_app.py" ] && echo "test_app.py found" || echo "❌ test_app.py missing")"
echo "✅ Static: $([ -d "static" ] && echo "static/ found" || echo "⚠️  static/ missing (optional for tests)")"
echo "✅ Templates: $([ -f "templates/index.html" ] && echo "index.html found" || echo "⚠️  index.html missing (optional for tests)")"

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 All tests completed successfully!"
    echo "🚀 Ready to run the application with: python app.py"
    echo "🌐 Then visit: http://localhost:5000"
else
    echo "❌ Some tests failed. Check the output above for details."
    echo ""
    echo "🔧 Troubleshooting tips:"
    echo "• Run import test: python test_imports.py"
    echo "• Ensure all files are in the correct locations"
    echo "• Check that helpers/__init__.py exists (can be empty)"
    echo "• Verify virtual environment is activated"  
    echo "• Run: pip install -r requirements.txt"
fi

echo ""
echo "================================================================"

exit $TEST_EXIT_CODE