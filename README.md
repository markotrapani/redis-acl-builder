# Redis Enterprise ACL Builder

**Version v2.2.0-beta** - Multi-Platform Desktop + Web App

A comprehensive application for testing and validating Redis Access Control List (ACL) rules with real-time command analysis. Available as both a web application and native desktop app (macOS, Windows, Linux) with an elegant resizable interface, drag-drop panel reordering, and auto-update infrastructure.

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

**Upgrade to latest version:**
```bash
# Simple one-liner (stops, removes, and recreates with latest image)
docker rm -f redis-acl-builder; docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest

# Or use docker-compose (recommended)
docker compose pull && docker compose up -d
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

Redis ACL Builder is a powerful tool that helps developers and system administrators understand and test Redis ACL configurations before deploying them to production.

**Core Capabilities:**
- ✅ Parse and validate Redis ACL rule syntax with real-time feedback
- ✅ Test commands and keyspace patterns with dual testing interface
- ✅ Visualize granted/blocked commands organized by categories
- ✅ Support for Redis 7 (311 commands) and Redis 8 (446 commands)
- ✅ Light/Dark mode theme system with localStorage persistence
- ✅ Available as web app (Docker/local) and native desktop app (macOS, Windows, Linux)

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

### Code Organization (Monorepo Structure - v2.1.7)

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

**Fast macOS ARM64 build** (debugging/testing - ~2 minutes):
```bash
git tag v2.1.8-test && git push origin v2.1.8-test
git tag v2.1.8-debug && git push origin v2.1.8-debug
```

**Full multi-platform build** (production - ~5 minutes):
```bash
git tag v2.1.8-beta && git push origin v2.1.8-beta   # macOS, Windows, Linux + Docker
git tag v2.1.8-alpha && git push origin v2.1.8-alpha
git tag v2.1.8 && git push origin v2.1.8
```

**Docker build only** (web app):
```bash
git tag v2.1.8-docker && git push origin v2.1.8-docker
```

**Documentation updates only**:
```bash
git tag v2.1.8-docs && git push origin v2.1.8-docs
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

The application features modern, modular frontend and backend architectures with a **monorepo structure** (v2.1.7-beta):

- **Monorepo**: Organized into `backend/`, `frontend/`, `electron/`, `scripts/`, and `tests/` directories - single source of truth for both web app and Electron desktop app
- **Frontend**: Modular ES6 JavaScript (13 modules) + Optimized Modular CSS (6 modules) with professional desktop-like resize experience
- **Backend**: Flask with comprehensive Redis ACL parsing and API layer
- **Database**: Hardcoded Redis command databases for Redis 7 (311 commands) and Redis 8 (446 commands)
- **Testing**: 223 automated tests - 195 backend (pytest) + 28 E2E (Playwright) with 100% pass rate
- **Type Safety**: Enterprise-grade type annotations with 94% reduction in Pylance strict errors (comprehensive typing across all modules)
- **UI/UX**: Elegant resizable container system with real-time content synchronization, drag-drop panel reordering, and perfect responsive design

## ✨ What's New

### v2.1.9-beta - Debug Builds, Build Optimization & Release Cleanup

- **🐛 Debug Build Configuration**: Detached DevTools for debugging without UI disruption
  - `-debug` tags open DevTools in separate window (doesn't crush main app)
  - Marker-based detection (`.debug-build` file created during builds)
  - Perfect for debugging and testing without obstructing the interface
- **⚡ Build Performance**: 20-30% faster builds with aggressive caching
  - Python pip dependency caching
  - PyInstaller build artifact caching
  - Reduced multi-platform build time from ~5m17s to ~4min
- **🧹 Automated Release Cleanup**: Auto-delete source code archives
  - GitHub's auto-generated source archives removed automatically
  - Cleaner release pages without manual intervention
- **📦 Reduced Release Bloat**: ~40% fewer files per release
  - macOS: DMG only (removed ZIP)
  - Windows: NSIS installer only (removed ZIP)
  - Linux: AppImage only (removed .deb)
  - Streamlined releases with only essential installers
- **🏷️ Enhanced Tag Strategy**: Clear separation of build types
  - `-test`: Local builds only (npm run build:mac) - no workflows
  - `-test-release`: ARM64 + GitHub release for auto-update testing
  - `-debug`: ARM64 with detached DevTools
  - `-desktop`: Multi-platform desktop-only (no Docker rebuild)
  - `-beta/-alpha`: Full production releases (Docker + all platforms)
- **🎨 UI Enhancements**: Version indicator and consistent panel borders
  - Version indicator in bottom-left corner (e.g., "v2.1.9-beta")
  - Consistent light gray borders across all panels
  - Better visual hierarchy and polish

### v2.1.7-beta - Auto-Update Infrastructure & Fast Build Workflow

- **🔄 Auto-Update System**: Complete auto-update infrastructure with electron-updater
  - ✅ Automatic update detection on app launch
  - ✅ Manual update check via application menu
  - ✅ User-friendly download/install dialogs with progress tracking
  - ✅ GitHub releases integration for update distribution
  - ⚠️ Note: Installation requires code signing (Apple Developer account)
- **⚡ Fast Build Workflow**: Dedicated macOS ARM64-only workflow for debugging
  - 2-minute builds vs 5-minute multi-platform builds
  - Auto-publishes to GitHub releases on `-test`/`-debug` tags
  - Perfect for rapid iteration and testing
- **🏷️ Smart Tag Strategy**: Tag suffixes control which builds run
  - `-test`, `-debug`: Fast macOS ARM64 only
  - `-beta`, `-alpha`: Full multi-platform + Docker
  - `-docker`: Docker only
  - `-docs`: No builds
- **📦 Multi-Platform Ready**: macOS (ARM64 + Intel), Windows (NSIS + ZIP), Linux (AppImage + .deb)
- **🔐 Code Signing Infrastructure**: Ready for Apple Developer setup
  - Entitlements and notarization scripts prepared
  - Auto-updates will work automatically once code signing enabled

### v2.0.3-alpha - Enhanced Category Tooltips

- **🎨 Intelligent Command Highlighting**: Category tooltips display relevant commands with color-coded bold text
- **🔧 Parameter Passing Fix**: Resolved function wrapper issues preventing bold/color styling
- **✅ Bug Fix**: Tooltip expansion correctly displays full command list

### v2.0.0-alpha - Electron Desktop App & UI Polish

- **🖥️ Native Desktop App**: macOS desktop app with Electron + PyInstaller backend bundling
- **🔧 Command Sort Order**: Fixed sorting to prioritize explicit commands before implicit
- **💾 Rule Preservation**: Rules preserved on page refresh
- **📊 Search Enhancements**: Fuzzy relevance scoring and improved UI feedback

---

<details>
<summary><strong>View Full Version History</strong></summary>

### v1.25.1-beta - Optimization Box Persistence & Backend Error Fix

- **🐛 Critical Backend Fix**: Fixed undefined `warnings` variable error in `optimize_rule()` method
- **📌 Optimization Persistence**: Optimization suggestions now remain visible while typing

### v1.25.0-beta - Backend Category Analysis

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

</details>

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
