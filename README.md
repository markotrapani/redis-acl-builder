# Redis ACL Builder

Initial project commit with full README and project setup documentation.

Project structured for initial development and testing.

A comprehensive web application for testing and validating Redis Access Control List (ACL) rules with real-time command analysis.

## Overview

Redis ACL Builder is a powerful tool that helps developers and system administrators understand and test Redis ACL configurations before deploying them to production. The application provides an intuitive web interface to:

- **Parse ACL Rules**: Validate and analyze Redis ACL rule syntax
- **Test Commands**: Check if specific Redis commands are allowed by your ACL rules
- **Visualize Permissions**: See exactly which commands are granted or denied
- **Compare Versions**: Support for both Redis 7 and Redis 8 with their respective command sets
- **Real-time Analysis**: Instant feedback as you modify ACL rules

### Key Features

- **Complete Command Database**: Pre-loaded with 311 Redis 7 commands and 446 Redis 8 commands
- **Interactive Three-Column Layout**: ACL Config, Granted Commands, and Blocked Commands panels
- **Real-time Validation**: Live parsing and validation of ACL rule syntax
- **Category Organization**: Commands grouped by Redis categories (read, write, admin, etc.)
- **Command Exclusion Logic**: Exclude specific commands even when granted via categories
- **Submit Changes Button**: Dynamic button appears when manual ACL edits are detected
- **Bidirectional Sync**: Changes in interactive UI update text rule and vice versa
- **Rule Precedence**: Correctly implements left-to-right Redis ACL rule evaluation
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Enhanced Dark Mode**: Improved theme with better visual distinction between panels
- **Collapsible Sections**: Individual Commands sections can be expanded/collapsed
- **Version Switching**: Seamless switching between Redis 7/8 with full UI updates
- **Comprehensive Testing**: 28 automated tests with 82% code coverage
- **Production Ready**: Professional code structure with proper error handling

## Quick Start

### Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

### Installation

1. **Download/Clone the project:**

   ```bash
   # Download and extract the project files
   # Or clone from your repository
   cd redis_acl_builder
   ```

2. **Create the proper directory structure:**

   ```bash
   mkdir -p helpers tests static/css static/js templates
   
   # Create required package files
   touch helpers/__init__.py
   touch tests/__init__.py
   ```

3. **Place files in correct locations:**
   - `app.py` → project root
   - `helpers/data_loader.py` → helpers folder
   - `helpers/acl_parser.py` → helpers folder
   - `tests/test_app.py` → tests folder
   - `static/css/styles.css` → static/css folder
   - `static/js/main.js` → static/js folder
   - `templates/index.html` → templates folder

4. **Create virtual environment (recommended):**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

5. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

6. **Test the setup:**

   ```bash
   # Run diagnostic test
   python test_imports.py
   
   # Run full test suite
   chmod +x tests/run_tests.sh
   tests/run_tests.sh
   ```

7. **Run the application:**

   ```bash
   python app.py
   ```

8. **Open your browser:**
   Navigate to `http://localhost:5001`

## Project Structure

```txt
redis_acl_builder/
├── app.py                      # Main Flask application
├── test_imports.py             # Import diagnostic tool
├── requirements.txt            # Python dependencies
├── README.md                   # This file
├── project_status.json         # Project progress tracker
├── helpers/
│   ├── __init__.py            # Package initialization (must exist)
│   ├── data_loader.py         # Redis command data management
│   └── acl_parser.py          # ACL parsing and evaluation logic
├── static/
│   ├── css/
│   │   └── styles.css         # Application styles and responsive design
│   └── js/
│       └── main.js            # Client-side functionality and API communication
├── templates/
│   └── index.html             # Main web interface
└── tests/
    ├── __init__.py            # Test package initialization
    ├── test_app.py            # Comprehensive test suite (28 tests)
    └── run_tests.sh           # Enhanced test runner script
```

## Usage Guide

### Basic Usage

1. **Select Redis Version**: Choose between Redis 7 or Redis 8 using the radio buttons
2. **Enter ACL Rule**: Type your ACL rule in the text area (left column)
3. **Interactive Management**: 
   - Click granted commands (center column) to revoke them
   - Click blocked commands (right column) to grant them
   - Use Submit Changes button when manually editing rules
4. **View Results**: See granted and blocked commands organized by categories and individual commands
5. **Test Commands**: Use the command tester at the top to check specific commands
6. **Collapsible Sections**: Click on "Individual Commands" headers to expand/collapse sections

### ACL Rule Syntax

The application supports standard Redis ACL syntax:

#### Command and Category Rules

- `+@read` - Grant all read commands
- `-@write` - Deny all write commands  
- `+@all` - Grant all commands
- `+get` - Grant specific GET command
- `-flushdb` - Deny specific FLUSHDB command

#### Key Pattern Rules

- `~user:*` - Allow access to keys matching pattern
- `~cache:*` - Allow access to cache keys

#### Rule Examples

**Read-only access:**

```acl
+@read ~data:*
```

**Application user with restrictions:**

```acl
+@read +@write -@dangerous -@admin ~app:* ~session:*
```

**Developer access:**

```acl
+@all -flushdb -flushall -shutdown
```

**Monitoring user:**

```acl
+@read +info +ping +client
```

**Analytics user:**

```acl
+@read +@bitmap +@hyperloglog -@admin
```

### Command Testing

Use the **Command Tester** section to:

1. Enter a Redis command (e.g., `GET`, `SET`, `HGETALL`)
2. Click "Test Command" 
3. See if the command is allowed and why
4. View which categories the command belongs to

## API Endpoints

The application provides a RESTful API for programmatic access:

### Core Endpoints

- `POST /api/parse` - Parse ACL rule and return granted commands
- `POST /api/test-command` - Test if a specific command is allowed
- `POST /api/validate-rule` - Validate ACL rule syntax
- `POST /api/command-info` - Get information about a command
- `GET /api/categories` - Get all available categories
- `POST /api/search-commands` - Search commands with patterns
- `GET /health` - Application health check

### Example API Usage

```bash
# Parse an ACL rule
curl -X POST http://localhost:5001/api/parse \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read -@dangerous", "version": "redis7"}'

# Test a command
curl -X POST http://localhost:5001/api/test-command \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read", "command": "GET", "version": "redis7"}'

# Validate rule syntax
curl -X POST http://localhost:5001/api/validate-rule \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read +get", "version": "redis7"}'
```

## Testing

The project includes a comprehensive test suite with 28 tests covering all functionality.

### Test Coverage Summary

- **Overall Coverage**: 82%
- **Core Logic** (helpers/): 95-100%
- **API Endpoints**: 71%
- **All tests passing**: ✓

### Running Tests

#### Method 1: Enhanced Test Runner (Recommended)

```bash
chmod +x tests/run_tests.sh
tests/run_tests.sh
```

#### Method 2: Direct Python Execution

```bash
python tests/test_app.py
```

#### Method 3: With Coverage Analysis

```bash
python -m coverage run --source=app,helpers tests/test_app.py
python -m coverage report -m
python -m coverage html  # Generate HTML report
```

#### Method 4: Using Pytest

```bash
pip install pytest pytest-flask
pytest tests/test_app.py -v
```

### Test Categories

- **Unit Tests**: Core functionality validation
  - Data loading and indexing
  - ACL rule parsing accuracy  
  - Permission evaluation logic
  - Search and validation features

- **API Tests**: All endpoint validation
  - Request/response handling
  - Error cases and status codes
  - Version switching
  - Input validation

- **Integration Tests**: End-to-end scenarios
  - Complete workflow testing
  - Complex ACL rule patterns
  - Real-world use cases

## Development

### Setting Up Development Environment

1. **Fork/Clone the repository**
2. **Create virtual environment:**

   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Run tests:**

   ```bash
   ./tests/run_tests.sh
   ```

### Code Organization

- **Backend Logic**: `helpers/` folder
- **Frontend Assets**: `static/` folder  
- **Templates**: `templates/` folder
- **Tests**: `tests/` folder

## Production Deployment

### Basic Deployment

```bash
# Set production environment
export FLASK_ENV=production
export FLASK_DEBUG=False

# Run with Gunicorn
pip install gunicorn
gunicorn --bind 0.0.0.0:8000 --workers 4 app:app
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN touch helpers/__init__.py tests/__init__.py

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

## Features

### Current Features (v1.1.0)

- Complete Redis ACL rule parsing and validation
- Support for Redis 7 (311 commands) and Redis 8 (446 commands)  
- Interactive three-column layout with real-time command management
- Submit Changes button with automatic change detection
- Command exclusion logic for granular permission control
- Bidirectional sync between manual text editing and interactive UI
- Enhanced dark theme with improved visual distinction
- Collapsible Individual Commands sections
- Seamless version switching between Redis 7/8
- Real-time web interface with responsive design
- Comprehensive API with full documentation
- 28 automated tests with 82% code coverage
- Production-ready deployment configuration
- Professional code organization and structure
- Import diagnostics and troubleshooting tools

### Future Enhancements

- Advanced Key Pattern Matching (`~` patterns with full glob support)
- Pub/Sub Channel Support (`&` channel patterns)  
- Key Permissions (`%R`/`%W` flags)
- ACL Selectors (parenthetical selectors)
- Export Functionality (generate production ACL configs)
- Syntax Highlighting (CodeMirror or Monaco editor)

## License

This project is provided as-is for educational and development purposes.

## Support

For issues or questions:

1. Run `python test_imports.py` for diagnostics
2. Check test results with `tests/run_tests.sh`
3. Review the troubleshooting section
4. Ensure all files are in the correct locations

---

**Redis ACL Builder v1.1.0** - Production-ready with Enhanced UI and 82% test coverage
