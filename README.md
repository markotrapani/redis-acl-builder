# Redis Enterprise ACL Builder

**Version v2.0.3-alpha** - Desktop + Web App

A comprehensive application for testing and validating Redis Access Control List (ACL) rules with real-time command analysis. Available as both a web application and native macOS desktop app with an elegant resizable interface and drag-drop panel reordering.

## 🚀 Quick Start

### Option 1: Docker (Fastest - Recommended)

**Ready to deploy? Get started in seconds:**

🐳 **[Docker Hub Repository](https://hub.docker.com/r/markotrapani608/redis-acl-builder)** - Latest builds with automated CI/CD

```bash
# Run the latest version directly from Docker Hub
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest

# Access the application
open http://localhost:7380
```

**Upgrade to latest version (one-liner):**
```bash
docker stop redis-acl-builder 2>/dev/null; docker rm redis-acl-builder 2>/dev/null; docker pull markotrapani608/redis-acl-builder:latest && docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest
```

### Option 2: Local Installation

**Prerequisites:**
- Python 3.7 or higher
- pip (Python package installer)

**Installation Steps:**

1. **Download/Clone the project:**
   ```bash
   # Clone from repository
   git clone https://github.com/markotrapani/redis-acl-builder.git
   cd redis-acl-builder
   ```

2. **Create virtual environment (recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Run the application:**
   ```bash
   # Option 1: Use helper script
   ./scripts/run-web.sh

   # Option 2: Run directly
   python backend/app.py
   ```

5. **Open your browser:**
   Navigate to `http://localhost:7380`

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
- **Keyboard Shortcuts**: Enter key submits ACL changes
- **Enhanced Resize Handles**: Rounded square corner handles with active state feedback
- **Optimized CSS Architecture**: Streamlined stylesheets with reusable variables and reduced redundancy
- **Redis Enterprise Compliance**: Full validation against Redis ACL specifications
- **Advanced Keyspace Testing**: Full glob pattern support (*, ?, [abc], [a-z], [^abc]) with real-time validation
- **Dismissible Test Results**: Auto-timeout after 5 seconds with manual close buttons and smooth fade animations
- **Smart Button States**: Intelligent disabled states for empty inputs with visual feedback
- **Version Switching**: Seamless switching between Redis 7/8 with full UI updates
- **Theme Persistence**: User theme choice saved in localStorage with system preference fallback
- **Comprehensive Testing**: 223 automated tests - 195 backend (pytest) + 28 E2E (Playwright) with 100% pass rate
- **Optimized Architecture**: ES6 modules + streamlined CSS (27 lines of redundant code removed)
- **Production Ready**: Professional code structure with perfect visual consistency and maintainable codebase

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

### Docker Deployment (Recommended)

See **Quick Start** section above for Docker deployment options.

**Additional deployment configurations:**

```bash
# Specific version
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:2.0.3-alpha

# Custom port mapping
docker run -d --name redis-acl-builder -p 8080:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest
```

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
curl -X POST http://localhost:7380/api/parse \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read -@dangerous", "version": "redis7"}'

# Test a command
curl -X POST http://localhost:7380/api/test-command \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read", "command": "GET", "version": "redis7"}'

# Validate rule syntax
curl -X POST http://localhost:7380/api/validate-rule \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read +get", "version": "redis7"}'
```

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
   pip install -r backend/requirements.txt
   npm install  # For E2E testing
   ```

4. **Run the application:**

   ```bash
   # Option 1: Use helper script
   ./scripts/run-web.sh

   # Option 2: Run directly
   python backend/app.py
   ```

5. **Run tests:**

   ```bash
   # Backend tests
   pytest tests/backend/ -v

   # E2E tests
   npx playwright test
   ```

### Code Organization (Monorepo Structure - v2.0.3)

- **Backend**: `backend/` - Python Flask app, helpers, models
- **Frontend**: `frontend/` - Static assets (CSS/JS) and templates
- **Scripts**: `scripts/` - Helper scripts (run-web.sh, build-web.sh)
- **Tests**: `tests/backend/` (pytest) and `tests/e2e/` (Playwright)
- **Electron**: `electron/` - Desktop app wrapper (v2.0 - see [docs/ELECTRON-ROADMAP.md](docs/ELECTRON-ROADMAP.md))

## Testing

The project includes a comprehensive test suite with 223 tests covering all functionality.

### Test Coverage Summary

- **Overall Coverage**: 85%
- **Core Logic** (helpers/): 95-100%
- **API Endpoints**: 78%
- **All tests passing**: ✓

### Running Tests

#### Method 1: Backend Tests (Recommended)

```bash
# Run all backend tests
pytest tests/backend/ -v

# With coverage
pytest tests/backend/ --cov=backend --cov-report=html
```

#### Method 2: E2E Tests

```bash
# Run Playwright E2E tests
npx playwright test

# Run in UI mode
npx playwright test --ui
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

## CI/CD & Build System

**All automated builds are now managed in the redis-acl-builder repository.**

### GitHub Actions Workflows

**Repository**: [github.com/markotrapani/redis-acl-builder/actions](https://github.com/markotrapani/redis-acl-builder/actions)

#### 🐳 Docker Builds (Web Application)
- **Workflow**: `.github/workflows/docker-publish.yml`
- **Triggers**: Version tags (`v*.*.*`, `v*.*.*-alpha`, `v*.*.*-beta`)
- **Platforms**: linux/amd64, linux/arm64 (multi-arch)
- **Outputs**: Docker images published to [Docker Hub](https://hub.docker.com/r/markotrapani608/redis-acl-builder)
- **Features**: Automated CVE scanning with Docker Scout

#### 💻 Desktop Builds (Electron App)
- **Workflow**: `.github/workflows/build-desktop.yml`
- **Triggers**: Version tags (`v*.*.*`, `v*.*.*-desktop*`) + manual dispatch
- **Platforms**: Windows (x64), macOS (ARM64 + Intel x64), Linux (x64)
- **Outputs**:
  - Windows: NSIS installer + ZIP
  - macOS: DMG + ZIP (separate ARM64 and Intel builds)
  - Linux: AppImage + .deb package
- **Features**: PyInstaller backend bundling, platform-specific installers

### Migration Notice (October 2025)

> **Important**: CI/CD workflows were migrated from the parent `marko-projects` repository to `redis-acl-builder` on 2025-10-15.
>
> - **Old builds** (pre-October 2025): Available at [github.com/markotrapani/marko-projects/actions](https://github.com/markotrapani/marko-projects/actions) (historical reference only)
> - **New builds** (October 2025+): All builds now run in [github.com/markotrapani/redis-acl-builder/actions](https://github.com/markotrapani/redis-acl-builder/actions)
>
> This consolidation provides better organization, with each submodule owning its own build pipelines.

### Version Tag Strategy

**For Docker builds** (web app):
```bash
git tag v2.0.4-alpha    # Triggers Docker build
git push origin v2.0.4-alpha
```

**For Desktop builds** (Electron app):
```bash
git tag v2.0.4-desktop  # Triggers Desktop build only
git push origin v2.0.4-desktop
```

**For both Docker + Desktop**:
```bash
git tag v2.0.4          # Triggers BOTH Docker and Desktop builds
git push origin v2.0.4
```

**For documentation updates only**:
```bash
git tag v2.0.4-docs     # No builds triggered
git push origin v2.0.4-docs
```

## Project Structure

```txt
redis-acl-builder/
├── backend/                    # Flask application
│   ├── app.py                 # Main Flask app
│   ├── helpers/               # Core logic modules
│   │   ├── data_loader.py    # Redis command database
│   │   └── acl_parser.py     # ACL parsing engine
│   ├── models/                # Data models
│   └── requirements.txt       # Python dependencies
├── frontend/                   # Web interface
│   ├── static/
│   │   ├── css/              # Modular CSS (6 files)
│   │   └── js/               # Modular ES6 JS (13 files)
│   └── templates/
│       └── index.html        # Main interface
├── electron/                   # Desktop app wrapper
│   ├── main.js               # Electron main process
│   ├── preload.js            # Preload script
│   └── package.json          # Electron config
├── scripts/                    # Helper scripts
│   ├── run-web.sh            # Start web app
│   └── build-web.sh          # Build script
├── tests/                      # Test suites
│   ├── backend/              # Backend tests (pytest)
│   └── e2e/                  # E2E tests (Playwright)
└── docs/                       # Documentation
    └── ELECTRON-ROADMAP.md   # Desktop app roadmap
```

## 🏗️ Architecture

The application features modern, modular frontend and backend architectures with a **monorepo structure** (v2.0.3-alpha):

- **Monorepo**: Organized into `backend/`, `frontend/`, `electron/`, `scripts/`, and `tests/` directories - single source of truth for both web app and Electron desktop app
- **Frontend**: Modular ES6 JavaScript (13 modules) + Optimized Modular CSS (6 modules) with professional desktop-like resize experience
- **Backend**: Flask with comprehensive Redis ACL parsing and API layer
- **Database**: Hardcoded Redis command databases for Redis 7 (311 commands) and Redis 8 (446 commands)
- **Testing**: 223 automated tests - 195 backend (pytest) + 28 E2E (Playwright) with 100% pass rate
- **Type Safety**: Enterprise-grade type annotations with 94% reduction in Pylance strict errors (comprehensive typing across all modules)
- **UI/UX**: Elegant resizable container system with real-time content synchronization, drag-drop panel reordering, and perfect responsive design

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

## ✨ What's New

### v2.0.3-alpha - Enhanced Category Tooltips with Smart Command Highlighting

- **🎨 Intelligent Command Highlighting**: Category tooltips now display relevant commands first with color-coded bold text
  - Granted commands highlighted in **bold green** (#22c55e)
  - Blocked commands highlighted in **bold red** (#f44336)
  - Works in both abbreviated and expanded tooltip views
  - Example: Hovering over partially granted `@read` category shows granted commands (like `get`, `mget`) first in green
- **🔧 Parameter Passing Fix**: Resolved three-layer function wrapper issue preventing bold/color styling
  - Fixed wrapper in InteractiveACLBuilder passing all 5 parameters correctly
  - Fixed method signature accepting boldItems and boldColor parameters
  - Ensured proper parameter flow from tooltip expansion to ACLUIRenderer
- **🧹 Code Cleanup**: Removed all debug console.log statements and redundant inline styling
  - Clean CSS-based styling using data-column attributes
  - Removed unnecessary CSS rules and placeholder code
  - Rebuilt minified assets (110.71 KB, 34.5% savings)
- **✅ Bug Fix**: Tooltip expansion now correctly displays full command list without hiding commands

### v2.0.0-alpha - Command Sort Order & Rule Preservation Fixes

- **🔧 Command Sort Order**: Fixed sorting to prioritize explicit commands before implicit (priority-based)
- **💾 Rule Preservation**: Rules like `-get` now preserved on page refresh (no longer cleared to empty)
- **🎯 Empty ACL Detection**: Fixed to check for blocked categories/commands too
- **⚠️ Implicit Partial Styling**: Proper hollow yellow ⚠ display for implicitly partial categories
- **📊 Search Enhancements**: Fuzzy relevance scoring, order restoration, "Showing X of Y" positioning
- **🧹 Visual Polish**: Eliminated gaps from empty command-buttons containers

### v1.25.1-beta - Optimization Box Persistence & Backend Error Fix

- **🐛 Critical Backend Fix**: Fixed undefined `warnings` variable error in `optimize_rule()` method that broke all optimization
  - Was returning `savings=0` instead of actual savings
  - Changed to parse rule tokens directly to detect inefficient +@all placement patterns
  - "Saves X terms" now displays correctly in optimization suggestions
- **📌 Optimization Persistence**: Optimization suggestions now remain visible while typing
  - Suggestions persist when temporarily deleting text in textarea
  - Only hide on: submit new rule, click X dismiss button, or explicit clear operation
  - Skip redundancy analysis during typing no longer hides existing warnings
- **✅ Manual Testing**: Complete validation of @all category button states, button ordering priorities, and auto-optimization triggers
- **📝 Documentation**: Updated testing plan with all v1.25.0-v1.25.1 completed tests

### v1.25.0-beta - Backend Category Analysis & Test Suite Expansion

- **🧠 Backend Category Intelligence**: Complete category analysis engine classifies categories as fully granted, partially granted (with percentages), or blocked based on actual command permissions
- **📊 API Enhancement**: `/api/parse` endpoint now returns comprehensive category analysis including `granted_categories`, `partial_categories` (with grant counts and percentages), and `blocked_categories`
- **✅ Test Suite Explosion**: Expanded from 127 → 195 passing tests (+68 new tests, 0 skipped)
  - 12 comprehensive API-level category analysis tests
  - 19 button interaction tests validating UI logic
  - 16 @all category behavior tests
  - 8 ACL precedence validation tests
- **🧹 Code Cleanup**: Removed 16 obsolete skipped tests (-319 lines) with proper documentation
- **🔧 Test Fixes**: Fixed all test signature mismatches and API response structure assertions
- **📈 Coverage Improvement**: Test coverage increased from 82% → 85% (API coverage: 71% → 78%)

### v1.21.3-beta - Version Prefix Standardization

- **📐 Consistent Versioning**: Standardized version prefix usage across all documentation
- **🏷️ Git Tags**: All git tags use `v` prefix (v1.21.3-beta)
- **🐳 Docker Tags**: All Docker image tags use no prefix (1.21.3-beta)
- **📚 Documentation**: Clear separation between git and Docker version references
- **🧹 Cleanup**: Removed inconsistent `1.16.0-beta` tag, replaced with `v1.16.0-beta`

### v1.21.2-beta - Testing Section Flash Fix

- **✨ Zero Flash Rendering**: Eliminated visual flash when testing panels are in custom order
- **🎯 CSS Order Properties**: Uses flexbox `order` property set by inline script for instant correct rendering
- **🚀 Performance**: Testing sections now render in correct order from the first frame
- **🔧 Smart Detection**: Only applies ordering when panels differ from default position

### v1.21.1-beta - Docker Build Performance Optimization

- **⚡ 42% Faster Builds**: Multi-arch Docker builds reduced from 2m 40s to ~1m 30s
- **📦 Split Dependencies**: Separated production (`requirements-prod.txt`) and test (`requirements-test.txt`) dependencies
- **🚀 ARM64 Optimization**: Eliminated coverage compilation (100 seconds saved on ARM64 builds)
- **🔄 Coverage Upgrade**: Updated to 7.6.9 with pre-built ARM64 wheels
- **🐳 Smaller Production Image**: Docker image excludes test dependencies for faster deployments
- **🛠️ Dev Workflow Unchanged**: Local development still uses `pip install -r requirements.txt`

### v1.21.0-beta - Testing Section Drag-and-Drop Feature

- **🎨 Complete Drag-and-Drop System**: Full drag-and-drop reordering for testing sections
- **⋮⋮ Grabbable Handles**: Visual drag handles matching three-column panel design
- **✨ Smooth Animations**: Professional animations with flash prevention and localStorage persistence
- **🎯 Perfect UX**: Universal pointer-events approach disables all hover effects during drag

### v1.20.5-beta - Critical Docker Bugfix

- **🐛 CRITICAL FIX**: Added missing `models/` directory to Docker image (ModuleNotFoundError resolved)
- **✅ Production Ready**: Docker image now fully functional with all required Python modules
- **⚠️ Note**: Docker images v1.20.0 through v1.20.3 were non-functional and removed from Docker Hub

### v1.20.0-beta - Rule Selectors & Advanced Key Permissions

- **Rule Selectors**: Complete frontend & backend support
  - Full UI integration for selector syntax with proper command display
  - Real-time validation with "Selector #1:" error prefixes
  - Enhanced testing showing which selector granted access
  - Perfect selector isolation with informative error messages
  - OR logic implementation

- **Advanced Key Permissions**: Bug fixes & improvements
  - Full keyspace access fix (no key patterns = access to all keys)
  - Better error messages for permission type mismatches
  - Smart isolation hints only when relevant
  - Proper handling of read-write commands like GETSET

### v1.15.10-beta - Documentation Synchronization & Docker Hub Integration

- **📋 Documentation Workflow**: Comprehensive synchronization process preventing version drift across releases
- **🐳 Docker Hub Prominence**: Direct repository link and quick-start deployment prominently featured
- **⚙️ Mandatory Process**: Systematic version update workflow ensuring documentation accuracy

### v1.15.8-beta - Enterprise-Grade Type Safety

- **🔍 Pylance Compliance**: 94% reduction in strict type checking errors across all modules
- **📝 Comprehensive Annotations**: Full type annotations for Flask routes, helper functions, and data structures
- **🎯 Python 3.13 Support**: Updated to latest Python version with enhanced type safety features
- **✅ Zero Breaking Changes**: Maintained 100% test coverage throughout type safety implementation

### v1.15.7-beta - Production CI/CD Pipeline

- **🚀 Automated Docker Hub**: Multi-architecture builds (AMD64/ARM64) with automated publishing
- **🔒 Security Scanning**: Docker Scout CVE analysis with vulnerability management
- **🏷️ Smart Tagging**: Automatic version tagging with :latest, :beta, and semver tags
- **⚡ Optimized Builds**: Docker layer caching reducing build times from 15+ to 5-10 minutes

## Acknowledgments

Special thanks to **Michael Tchistopolskii** (<michael.tchistopolskii@redis.com>) for substantial improvement ideas and architectural guidance that helped shape the development of this application.

## License

This project is provided as-is for educational and development purposes.

## Support

For questions, feedback, or issues:

1. **Contact**: [Marko Trapani](mailto:marko.trapani@redis.com) - Project Developer
2. **Technical Issues**: Run `python test_imports.py` for diagnostics
3. **Test Verification**: Check results with `./tests/run_tests.sh`
4. **Docker Deployment**: See [Docker Hub Repository](https://hub.docker.com/r/markotrapani608/redis-acl-builder)
5. **Setup Issues**: Ensure all files are in the correct locations per installation guide

---

**Redis ACL Builder v1.15.14-beta** - Enterprise-Grade Optimized Docker Build & Simplified Dependencies
