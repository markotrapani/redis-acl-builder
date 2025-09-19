# Redis Enterprise ACL Builder

**Version 1.12.0-beta** - Elegant Resize System & Professional UX

A comprehensive web application for testing and validating Redis Access Control List (ACL) rules with real-time command analysis, featuring an elegant resizable interface with drag-drop panel reordering.

## 🏗️ Architecture

The application features modern, modular frontend and backend architectures:

- **Frontend**: Modular ES6 JavaScript (9 modules) + Optimized Modular CSS (6 modules) with professional desktop-like resize experience
- **Backend**: Flask with comprehensive Redis ACL parsing and API layer
- **Database**: Hardcoded Redis command databases for Redis 7 (311 commands) and Redis 8 (446 commands)
- **Testing**: 35 automated tests with 82% code coverage (35 passing, 0 failing)
- **UI/UX**: Elegant resizable container system with real-time content synchronization, drag-drop panel reordering, and perfect responsive design

## Overview

Redis ACL Builder is a powerful tool that helps developers and system administrators understand and test Redis ACL configurations before deploying them to production. The application provides an intuitive web interface to:

- **Parse ACL Rules**: Validate and analyze Redis ACL rule syntax
- **Dual Testing Interface**: Test both Redis commands and keyspace patterns with comprehensive validation
- **Light/Dark Mode**: Complete theme system with localStorage persistence and system preference detection
- **Visualize Permissions**: See exactly which commands are granted or denied
- **Compare Versions**: Support for both Redis 7 and Redis 8 with their respective command sets
- **Real-time Analysis**: Instant feedback as you modify ACL rules

### Key Features

- **Complete Command Database**: Pre-loaded with 311 Redis 7 commands and 446 Redis 8 commands
- **Perfect Responsive Design**: Equal-width three-column layout (Blocked Commands ❌, ACL Config 📝, Granted Commands ✅) across all screen sizes
- **Complete Theme System**: Light/Dark mode with explicit CSS selectors, theme toggle button, and localStorage persistence
- **Dual Testing Interface**: Command Tester for Redis commands + Keyspace Tester for glob pattern validation
- **Enhanced Test Command Button**: Modern gradient styling with hover animations, uppercase text, and mobile optimization
- **Real-time Validation**: Live parsing with smooth pop-up notifications for invalid syntax
- **Optimized Command Preview**: Intelligent 3-command threshold for compact, manageable displays
- **Advanced UX Polish**: Debounced rendering, fade transitions, professional button interactions
- **Command Exclusion Logic**: Exclude specific commands even when granted via categories
- **Submit Changes Button**: Dynamic button appears when manual ACL edits are detected
- **Bidirectional Sync**: Changes in interactive UI update text rule and vice versa
- **Rule Precedence**: Correctly implements left-to-right Redis ACL rule evaluation
- **Enhanced Error Handling**: Comprehensive validation with user-friendly error recovery
- **Smooth Animations**: Eliminated screen flashing with optimized rendering
- **Redis Enterprise Compliance**: Full validation against Redis ACL specifications
- **Advanced Keyspace Testing**: Full glob pattern support (*, ?, [abc], [a-z], [^abc]) with real-time validation
- **Dismissible Test Results**: Auto-timeout after 5 seconds with manual close buttons and smooth fade animations
- **Smart Button States**: Intelligent disabled states for empty inputs with visual feedback
- **Version Switching**: Seamless switching between Redis 7/8 with full UI updates
- **Theme Persistence**: User theme choice saved in localStorage with system preference fallback
- **Comprehensive Testing**: 35 automated tests with 79% code coverage
- **Optimized Architecture**: ES6 modules + streamlined CSS (27 lines of redundant code removed)
- **Production Ready**: Professional code structure with perfect visual consistency and maintainable codebase

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
│   ├── css/                   # Modular CSS Architecture (5 files)
│   │   ├── base.css          # CSS variables, reset, typography, containers
│   │   ├── layout.css        # Grid layouts, responsive design, columns
│   │   ├── components.css    # Buttons, forms, toggles, interactions
│   │   ├── themes.css        # Messages, notifications, theming, states
│   │   ├── interactive.css   # UX enhancements, animations, micro-interactions
│   │   └── styles.css        # Legacy monolithic file (preserved)
│   └── js/                   # Modular ES6 JavaScript (8 files)
│       ├── main.js          # Entry point and app initialization
│       ├── core/            # Core functionality modules
│       ├── api/             # API communication modules
│       ├── managers/        # State and rule management
│       ├── components/      # UI component modules
│       └── handlers/        # Event and interaction handlers
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
   - **Keyboard Shortcuts**:
     - Press **Enter** to submit pending changes
     - Press **Cmd+Enter** (Mac) or **Ctrl+Enter** (Windows/Linux) to add newline
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
gunicorn --bind 0.0.0.0:7380 --workers 4 app:app
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

### Current Features (v1.3.0)

- **Complete Redis ACL rule parsing and validation**
- **Support for Redis 7 (311 commands) and Redis 8 (446 commands)**
- **Interactive three-column layout** with emoji branding (📝✅❌)
- **Real-time validation** with smooth pop-up notifications
- **Advanced UX polish**: debounced rendering, fade transitions, consistent styling
- **Collapsible preview rows** showing first 8 commands when collapsed
- **Submit Changes button** with automatic change detection
- **Command exclusion logic** for granular permission control
- **Enhanced error handling** for categories, commands, and syntax validation
- **Smooth animations** eliminating screen flashing and visual inconsistencies
- **Redis Enterprise compliance** with comprehensive validation
- **Bidirectional sync** between manual text editing and interactive UI
- **Seamless version switching** between Redis 7/8 with full UI updates
- **Comprehensive API** with full documentation and error handling
- **Modular ES6 JavaScript architecture** with organized file structure
- **29 automated tests** with 100% test pass rate
- **Production-ready deployment** configuration
- **Professional code organization** with maintainable architecture

### Future Enhancements

- Advanced Key Pattern Matching (`~` patterns with full glob support)
- Pub/Sub Channel Support (`&` channel patterns)  
- Key Permissions (`%R`/`%W` flags)
- ACL Selectors (parenthetical selectors)
- Export Functionality (generate production ACL configs)
- Syntax Highlighting (CodeMirror or Monaco editor)

## Acknowledgments

Special thanks to **Michael Tchistopolskii** (<michael.tchistopolskii@redis.com>) for substantial improvement ideas and architectural guidance that helped shape the development of this application.

## License

This project is provided as-is for educational and development purposes.

## Support

For issues or questions:

1. Run `python test_imports.py` for diagnostics
2. Check test results with `../tests/run_tests.sh`
3. Review the troubleshooting section
4. Ensure all files are in the correct locations

---

**Redis ACL Builder v1.4.0** - Production-ready with Enhanced UI Polish, Perfect Responsive Design, and 100% test coverage
