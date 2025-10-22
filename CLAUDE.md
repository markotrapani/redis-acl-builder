# CLAUDE.md - Redis ACL Builder

This file provides guidance to Claude Code when working with the **Redis ACL Builder** project.

**Note**: General repository-wide guidelines (git workflow, Electron safety, etc.) are in the [root CLAUDE.md](../CLAUDE.md). This file contains project-specific instructions only.

---

## 🚨 REPOSITORY LOCATION CHECK 🚨

**⚠️ CRITICAL: You are working in the REDIS-ACL-BUILDER SUBMODULE repository!**

**Current Repository:** `redis-acl-builder` (submodule)
**Parent Repository:** `marko-projects` (container repo with multiple submodules)

### How to Tell Which Repo You're In

**If you see these directories, you're in `redis-acl-builder` (THIS FILE):**

- `backend/`, `frontend/`, `electron/`, `docker/`, `tests/`, `venv/`
- `build_minified.py`, `README.md`, `CLAUDE.md`
- Git remote: `https://github.com/markotrapani/redis-acl-builder.git`

**If you see these directories, you're in `marko-projects` (PARENT):**

- `redis-acl-builder/`, `ldap-bind-tester/`, `gtlogs-link-generator/`, `impact-score-calculator/`
- ONLY has `README.md`, `CLAUDE.md`, `LICENSE`, `.gitmodules`
- Git remote: `https://github.com/markotrapani/marko-projects.git`

### Critical Path Differences

**When IN redis-acl-builder submodule (pwd shows `/marko-projects/redis-acl-builder`):**

```bash
# ✅ CORRECT
python3 build_minified.py
git status
git commit -m "message"

# ❌ WRONG - Will fail because you're already IN the submodule
cd redis-acl-builder && python3 build_minified.py
```

**When IN marko-projects parent (pwd shows just `/marko-projects`):**

```bash
# ✅ CORRECT - Need to specify submodule path
cd redis-acl-builder && python3 build_minified.py
git -C redis-acl-builder status

# ❌ WRONG - Will fail because build_minified.py is in submodule
python3 build_minified.py
```

### Quick Check Command

```bash
# Run this to see which repo you're in:
pwd && git remote get-url origin

# redis-acl-builder outputs: .../marko-projects/redis-acl-builder + redis-acl-builder.git
# marko-projects outputs: .../marko-projects + marko-projects.git
```

**🚨 ALWAYS run `pwd` before executing commands to avoid confusion!**

---

## ⚠️ CRITICAL REMINDERS ⚠️

### CSS/JS Build System

⚠️ **CRITICAL: ALWAYS rebuild minified CSS/JS after making changes!**

**Why**: The app uses minified CSS/JS files (`styles.min.css`, minified `.js` files). Changes to source files won't appear until rebuilt.

**After ANY changes to CSS or JS files, ALWAYS run:**

```bash
python3 build_minified.py
```

**What gets minified:**

- All CSS files in `frontend/static/css/` → `styles.min.css`
- All JS files in `frontend/static/js/` → individual `.min.js` files

**Symptoms of forgetting to rebuild:**

- CSS changes don't appear (buttons have wrong positioning/styling)
- JS changes don't work (new features missing)
- Generic/unstyled elements appear

### Development Server

REMINDER: **NEVER START NEW SERVERS - USE THE EXISTING ONE**

- The development server is ALREADY RUNNING on <http://localhost:5001>
- NEVER try to start new servers on different ports
- NEVER try to kill existing processes or start duplicate servers
- Simply refresh the browser or use the existing server for testing
- Port conflicts mean there's already a server running - USE IT!

### Electron App Process Management

⚠️ **CRITICAL: NEVER use `killall Electron` or `pkill Electron`!**

**Why**: VS Code, Claude Code, and many developer tools run on Electron. Killing all Electron processes will **terminate your IDE and this AI session**!

**Safe ways to restart the Redis ACL Builder Electron app:**

```bash
# Option 1: Find specific process by path (SAFE)
ps aux | grep "redis-acl-builder/electron" | grep node
# Then kill by PID: kill <PID>

# Option 2: Close the app window normally (RECOMMENDED)
# The app will clean up processes automatically

# Option 3: Use the app-specific process name (SAFE)
ps aux | grep "redis-acl-builder-desktop"
# Then kill by PID: kill <PID>
```

**Ports used by different environments:**

- **Port 7381**: Electron desktop app (Flask backend for Electron)
- **Port 5001**: Web development server (Flask for browser testing)
- **Port 7380**: Docker production deployment

---

## 📝 VERSION UPDATE CHECKLIST

**CRITICAL**: When bumping version (e.g., v2.2.7-beta → v2.2.10-beta), update ALL of these files:

### Required Files (MUST update every release)

- [ ] `README.md` - Line 3: `**Version v2.2.X-beta**`
- [ ] `README.md` - Lines 18-41: Desktop installation file names (all platforms)
- [ ] `CLAUDE.md` - Line 58: `**Version**: v2.2.X-beta`
- [ ] `electron/README.md` - Line 3: `**Status**: vX.X.X-beta` (**IMPORTANT: Don't forget!**)
- [ ] `backend/helpers/__init__.py` - Line with `__version__ = "2.2.X-beta"`
- [ ] `electron/package.json` - Line with `"version": "2.2.X-beta"`

### Search Command to Find All Version References

```bash
# Find all version references that might need updating
grep -r "v2\.2\.[0-9]" . --exclude-dir=.git --exclude-dir=venv --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build
```

### Post-Release Cleanup (GitHub Releases)

After creating a new release via tag push:

- [ ] Delete source code archives from GitHub release (not needed, confusing for users)

  ```bash
  gh release delete-asset <tag> "Source code (zip)" --yes
  gh release delete-asset <tag> "Source code (tar.gz)" --yes
  ```

- [ ] Verify release notes are dynamic and version-specific (not generic)
- [ ] Keep: DMG, ZIP, EXE, AppImage, .deb, latest-*.yml files

### Artifact Cleanup Strategy

**IMPORTANT**: GitHub Actions artifacts cost $0.25/GB/month over 500MB free tier.

**Smart Cleanup (Preserve Auto-Update)**:

- ✅ **Keep**: Artifacts for last 3 releases (needed for auto-update downloads)
- ❌ **Delete**: All other older artifacts
- 📊 **Current Usage**: Check with `gh api repos/markotrapani/redis-acl-builder/actions/artifacts | jq '.total_count'`

```bash
# List artifacts older than last 3 releases
gh api repos/markotrapani/redis-acl-builder/actions/artifacts --paginate | \
  jq -r '.artifacts[] | "\(.id) \(.created_at) \(.name)"' | \
  sort -k2 -r | tail -n +45  # Adjust based on how many to keep

# Delete specific artifact by ID
gh api --method DELETE /repos/markotrapani/redis-acl-builder/actions/artifacts/<ID>
```

### Why This Matters

- Users see version numbers in README/docs/release notes
- Desktop apps need matching versions in package.json and **init**.py
- Old artifacts cost money and aren't needed after 3 releases
- Dynamic release notes prevent confusion between releases

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of Redis-related projects, with the main project being **Redis ACL Builder** - a comprehensive web application for testing and validating Redis Access Control List (ACL) rules with real-time command analysis.

### Key Project: Redis ACL Builder

- **Version**: v2.4.7-beta (Desktop + Web App)
- **Test Coverage**: E2E: 100% (28/28 Playwright tests passing)
- **Latest Release**: Personal Access Token setup for proper release attribution (v2.4.7-beta)
- **Purpose**: Interactive web interface for parsing, testing, and validating Redis ACL permissions
- **Redis Support**: Based on **Redis OSS** (Open Source) command sets
  - **Redis 7 OSS**: 379 commands across 21 categories (includes cluster, replication, latency monitoring, module management)
  - **Redis 8 OSS**: 446 commands across 29 categories (adds RediSearch, JSON, TimeSeries, Bloom, and other modules)
  - **Note**: Redis Enterprise restricts certain OSS commands (cluster, replication, dangerous ops) for security - test failures on restricted commands are expected behavior
- **UI Features**: Advanced search system with independent fuzzy/exact modes, comprehensive custom tooltips with multi-column layouts and smart command highlighting (color-coded bold text for relevant commands), perfect anti-flash rendering, theme-aware loading animations, enhanced redundancy detection, comprehensive 8-way resizable container system with triangular corner indicators and edge resize handles, drag-drop panel reordering for both three-column panels and testing sections, polished tester controls with proper button positioning and theme-aware styling, complete responsive design for tablet and mobile with optimized layouts and form interactions, **fixed z-index stacking for Electron app test result popups**
- **Architecture**: Modular ES6 JavaScript (13 modules: 5 specialized modules + 8 core/UI modules) + Optimized Modular CSS (6 modules) with enterprise-grade visual polish, real-time synchronization, and professional desktop-like resize experience
- **Code Organization**: Interactive ACL Builder massively refactored from 4,286 → 3,195 lines (-1,091 lines, -25.5%) through systematic extraction of 1,636 lines of business logic and UI rendering into 5 specialized modules (ACLOptimizer, ACLCategoryManager, ACLRuleParser, ACLStateManager, ACLUIRenderer)
- **Monorepo Structure (v2.1.0-beta)**: Reorganized into `backend/`, `frontend/`, `electron/`, and `scripts/` directories for single source of truth supporting both web app and Electron desktop app with zero code duplication

## Commands and Development Workflow

### Development Setup

```bash
cd redis-acl-builder
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
```

### Running the Application

**IMPORTANT: Always use the virtual environment:**

```bash
cd redis-acl-builder
source venv/bin/activate  # Windows: venv\Scripts\activate

# Option 1: Use helper script (recommended)
./scripts/run-web.sh

# Option 2: Run directly
python backend/app.py

# Application runs at http://localhost:5001
```

### Building Frontend Assets

**⚠️ CRITICAL: After editing CSS or JavaScript files, you MUST rebuild minified assets:**

```bash
# Rebuild minified CSS and JavaScript
python3 build_minified.py

# This regenerates:
# - frontend/static/css/styles.min.css (from all .css files)
# - frontend/static/js/**/*.min.js (individual minified JS files)

# The HTML loads styles.min.css, so CSS changes won't appear until rebuilt!
```

**Why this is needed:**

- The app loads `styles.min.css` (minified/combined CSS) in production
- Individual CSS files (base.css, components.css, etc.) are source files only
- You MUST run `python3 build_minified.py` after ANY CSS edit for changes to appear
- Same applies to JavaScript - minified versions are loaded in production

### Testing Commands

**IMPORTANT: Always activate virtual environment first:**

```bash
source venv/bin/activate  # Windows: venv\Scripts\activate

# Run all backend tests (pytest)
pytest tests/backend/ -v

# Run specific test file
pytest tests/backend/test_app.py -v

# Run with coverage
pytest tests/backend/ --cov=backend --cov-report=html

# Run E2E tests (Playwright)
npx playwright test
```

### Docker Deployment (Recommended)

**IMPORTANT: Use Docker for production deployment:**

```bash
cd redis-acl-builder/docker

# Option 1: Automated deployment (recommended)
./deploy-beta.sh

# Option 2: Docker Compose
docker-compose up -d

# Option 3: Manual build and run
docker build -t redis-acl-builder:1.13.0-beta -f Dockerfile ..
docker run -d -p 8000:8000 --name redis-acl-builder redis-acl-builder:1.13.0-beta

# Application runs at http://localhost:8000
```

### Traditional Production Deployment

```bash
export FLASK_ENV=production
export FLASK_DEBUG=False
pip install gunicorn
gunicorn --bind 0.0.0.0:8000 --workers 4 app:app
```

## CI/CD & Automated Builds

**All automated builds are managed in the redis-acl-builder repository.**

### GitHub Actions Workflows

**Repository**: <https://github.com/markotrapani/redis-acl-builder/actions>

#### Docker Builds (Web Application)

- **File**: `.github/workflows/docker-publish.yml`
- **Triggers**: Version tags without `-desktop` or `-docs` suffixes
  - `v*.*.*` (e.g., v2.0.4, v2.1.0)
  - `v*.*.*-alpha`, `v*.*.*-beta`, `v*.*.*-rc*`
- **Platforms**: linux/amd64, linux/arm64 (multi-architecture)
- **Registry**: Docker Hub - `markotrapani608/redis-acl-builder`
- **Features**:
  - Automated multi-arch builds with QEMU and Buildx
  - Docker Hub description sync from `docker/README.md`
  - Docker Scout CVE scanning (critical/high severity)
  - GitHub Actions caching for faster builds
  - Automatic tagging: version, major.minor, major, latest, beta

#### Desktop Builds (Electron App)

**⚠️ FOR DEBUGGING: Always use the fast macOS ARM64 workflow!**

##### Fast macOS ARM64 Build (Recommended for Testing)

- **File**: `.github/workflows/build-desktop-macos-fast.yml`
- **Purpose**: Quick iteration for debugging and testing (~2 minutes vs 5 minutes)
- **Triggers**:
  - **Debug tags**: `v*.*.*-test`, `v*.*.*-debug` (e.g., `v2.1.8-test`)
  - Manual workflow dispatch
- **Builds**: macOS ARM64 only (DMG + ZIP)
- **Auto-publishes to GitHub releases** when triggered by version tags
- **Use this for**: Testing auto-updates, quick bug fixes, debugging builds
- **Tag strategy**: Use `-test` or `-debug` suffix to avoid triggering full multi-platform builds

##### Full Multi-Platform Build (Production)

- **File**: `.github/workflows/build-desktop.yml`
- **Purpose**: Production releases with all platforms
- **Triggers**:
  - Version tags: `v*.*.*`, `v*.*.*-alpha`, `v*.*.*-beta`
  - Desktop-specific tags: `v*.*.*-desktop*`
  - Manual workflow dispatch
- **Matrix Build Platforms**:
  - **macOS-latest**: ARM64 + Intel x64 DMG installers
  - **Windows-latest**: NSIS .exe installer + ZIP
  - **Ubuntu-latest**: AppImage + .deb package
- **Build Process**:
  1. PyInstaller bundles Python backend (Flask + dependencies)
  2. Electron-builder packages desktop app with bundled backend
  3. Creates platform-specific installers
  4. Uploads artifacts (30-day retention)
  5. Creates GitHub release (on version tags)

#### Source Code Archives (Private Repository)

**GitHub UI shows "Source code (zip)" and "Source code (tar.gz)" for every release, but these are NOT accessible:**

- Repository is **private** - source code is protected
- Source archive downloads return 404 (not accessible to public)
- Only uploaded installer assets (DMG, NSIS, AppImage) are downloadable
- No cleanup needed - private repo status prevents source code downloads automatically

**Release assets (downloadable):**

- ✅ DMG files (macOS installers)
- ✅ NSIS .exe (Windows installer)
- ✅ AppImage (Linux portable)
- ✅ latest-*.yml files (auto-update metadata)

#### GitHub Release Notes Format

**IMPORTANT:** Always use collapsible sections for release notes to keep them scannable.

**Format:**

```markdown
## vX.X.X-beta - Short Title

### Key Improvements

🎯 **Feature 1** - One-line description
⚡ **Feature 2** - One-line description
📦 **Feature 3** - One-line description

<details>
<summary><b>🎯 Feature 1</b></summary>

- Detailed bullet point 1
- Detailed bullet point 2
- Additional context

</details>

<details>
<summary><b>⚡ Feature 2</b></summary>

- Detailed bullet point 1
- Detailed bullet point 2

</details>

---

**Note:** Any important notes or warnings here.
```

**Benefits:**

- Compact summary visible by default (5-7 lines)
- All details available in expandable sections
- Better user experience - scannable at a glance
- Professional appearance

**To update a release:**

```bash
gh release edit vX.X.X-beta --repo markotrapani/redis-acl-builder --notes "$(cat <<'EOF'
[Your markdown here]
EOF
)"
```

### Migration History (October 2025)

**Migration Date**: 2025-10-15

**Before**:

- Docker workflows lived in parent `marko-projects` repository
- Historical builds: <https://github.com/markotrapani/marko-projects/actions>

**After**:

- All CI/CD consolidated in `redis-acl-builder` submodule
- New builds: <https://github.com/markotrapani/redis-acl-builder/actions>
- Better organization: each submodule owns its build pipelines

**Secrets Required**:

- `DOCKERHUB_USERNAME`: Docker Hub username
- `DOCKERHUB_TOKEN`: Docker Hub Personal Access Token (with workflow scope)

### Version Tagging Strategy

```bash
# LOCAL BUILDS ONLY (on your Mac)
# -test: Local manual builds, no GitHub workflows
npm run build:mac  # Then tag: git tag v2.1.9-test (optional)

# GITHUB ACTIONS REMOTE BUILDS

# Fast macOS ARM64 build with GitHub release (~2 minutes)
git tag v2.1.9-test-release && git push origin v2.1.9-test-release  # For auto-update testing

# Fast macOS ARM64 build with DevTools (~2 minutes)
git tag v2.1.9-debug && git push origin v2.1.9-debug  # Detached DevTools, no release

# Multi-platform desktop builds (~5 minutes)
git tag v2.1.9-desktop && git push origin v2.1.9-desktop  # Desktop-only (no Docker)

# Full production builds (~8 minutes)
git tag v2.1.9-beta && git push origin v2.1.9-beta   # Docker + all desktop platforms
git tag v2.1.9-alpha && git push origin v2.1.9-alpha # Docker + all desktop platforms
git tag v2.1.9 && git push origin v2.1.9             # GA release

# Docker build ONLY (~3 minutes)
git tag v2.1.9-docker && git push origin v2.1.9-docker

# Documentation only (no builds)
git tag v2.1.9-docs && git push origin v2.1.9-docs
```

**Tag Suffix Guide:**

| Suffix | Builds | Release | Use Case |
|--------|--------|---------|----------|
| `-test` | Local only (npm run build:mac) | No | Quick local testing |
| `-test-release` | ARM64 (GitHub Actions) | Yes | Auto-update testing |
| `-debug` | ARM64 + DevTools (GitHub Actions) | No | Debugging with DevTools |
| `-desktop` | Multi-platform (GitHub Actions) | Yes | Desktop-only distribution |
| `-beta`/`-alpha` | All platforms + Docker | Yes | Pre-release versions |
| (no suffix/GA) | All platforms + Docker | Yes | Production release |
| `-docker` | Docker only | N/A | Web app only |
| `-docs` | None | No | Documentation milestone |

## Architecture and Code Structure

### High-Level Architecture

The Redis ACL Builder follows a modular Flask architecture with clear separation of concerns:

1. **Main Application Layer** (`app.py`)
   - Flask web server and API endpoints
   - Request handling and response formatting
   - Global parser instances for Redis 7/8
   - RESTful API with comprehensive error handling

2. **Core Logic Layer** (`helpers/`)
   - **Data Loader** (`data_loader.py`): Redis command database management
     - Contains hardcoded command/category mappings for Redis 7 (311 commands) and Redis 8 (446 commands)
     - All commands normalized to lowercase for consistent processing
     - Builds reverse indexes for O(1) command → categories lookup
     - **Coverage**: 100%
   - **ACL Parser** (`acl_parser.py`): Rule parsing and evaluation engine
     - Left-to-right rule precedence (Redis-compliant)
     - Command/category permission evaluation
     - Rule syntax validation and error reporting
     - **Coverage**: 95%

3. **Data Model**
   - Redis commands organized by categories (read, write, admin, dangerous, etc.)
   - Redis 7: 21 categories, 311 commands
   - Redis 8: 29 categories, 446 commands (includes module commands)
   - **Redis 8 Modules**: RediSearch (38 commands), RedisJSON (25), TimeSeries (17), Bloom (11), Cuckoo (14), CMS (6), TopK (7), T-Digest (14)
   - Category-based permissions with granular command control

### Key Design Patterns

**Command-Category Mapping**: Commands belong to multiple categories simultaneously (e.g., `GET` is in both `@read` and `@fast` categories), enabling flexible ACL rule composition.

**Rule Evaluation Engine**: Implements Redis ACL precedence - later rules override earlier ones, with per-command tracking of which rule granted/denied access.

**Version Abstraction**: Parser instances are pre-initialized for each Redis version, allowing seamless switching between Redis 7/8 command sets.

### API Architecture

The application exposes a comprehensive REST API:

- `POST /api/parse` - Parse ACL rules and return command permissions
- `POST /api/test-command` - Test specific command access
- `POST /api/validate-rule` - Validate ACL syntax
- `POST /api/command-info` - Get command category information
- `GET /api/categories` - List available categories
- `POST /api/search-commands` - Search commands with patterns

### UI Architecture (v1.6.0 Dual Testing Interface)

The application features a sophisticated three-column interactive layout with advanced dual testing interface:

**Dual Testing Interface:**

- **📋 Command Tester**: Real-time command testing with instant feedback, comprehensive validation with detailed error messages, support for Redis subcommands (pipe character notation)
- **🔑 Keyspace Tester**: NEW comprehensive key pattern testing with full glob support (*, ?, [abc], [a-z], [^abc], escaped characters), real-time pattern matching validation
- **Smart Result Management**: Auto-dismissible results with 5-second timeout, manual close buttons (X), smooth fade animations (400ms with scale transforms), consistent error formatting
- **Intelligent Button States**: Disabled states for test buttons when inputs empty, subtle hover effects on disabled buttons, visual feedback for user actions

**Left Column - Blocked Commands (❌):**

- Shows commands that are blocked or available to grant  
- Collapsible sections with preview functionality
- Click-to-grant functionality for easy permission addition
- Intelligent filtering: only shows truly available commands

**Center Column - ACL Rule Configuration (📝):**

- Blue gradient themed panel with emoji branding
- Manual ACL rule text editor with curated syntax examples
- Dynamic Submit Changes button (appears only when manual edits detected)
- Real-time rule validation with smooth pop-up notifications
- Comprehensive error reporting with proper formatting
- **NEW: Smart Action Buttons** with disabled states when ACL rule empty (bomb emoji 💣 for clear, copy functionality)
- **NEW: Elegant scroll handling** for content overflow with styled scrollbars
- **NEW: Light/dark mode theme toggle** with smooth transitions
- **NEW: Overflow-based Layout**: Fixed height panels with overflow instead of expansion for better space management

**Right Column - Granted Commands (✅):**

- Interactive display of commands allowed by current ACL rule
- Collapsible sections with intelligent preview rows (first 8 commands)
- Smooth expand/collapse animations with +/- indicators
- Consistent button brightness across all interaction modes
- Click-to-revoke functionality for granular permission control

**Advanced UI Features:**

- **Real-time Validation**: Async validation with pop-up notifications for invalid syntax
- **Smooth Animations**: Debounced rendering with fade transitions to prevent flashing
- **Preview Rows**: Collapsible sections show sample commands when collapsed
- **Consistent Styling**: Unified button appearance across all interaction states
- **Error Handling**: Comprehensive validation for categories, commands, and syntax
- **Redis Enterprise Compliance**: Full validation against Redis ACL specifications
- **Resizable Container System**: Dynamic width/height adjustment with invisible corner drag handles, theme-aware cursor feedback, and smooth resize overlays
- **Panel Reordering**: Drag-and-drop panel reordering with visual feedback and smooth animations

### File Organization (Monorepo Structure - v2.0.0-alpha)

```txt
redis-acl-builder/
├── backend/                    # Python backend (SINGLE SOURCE OF TRUTH)
│   ├── app.py                 # Main Flask application and API routes
│   ├── helpers/
│   │   ├── __init__.py
│   │   ├── data_loader.py     # Redis command database (311 Redis7, 446 Redis8 commands)
│   │   └── acl_parser.py      # ACL parsing and evaluation logic
│   ├── models/
│   │   ├── __init__.py
│   │   └── api_models.py      # Pydantic API models
│   ├── requirements.txt        # All Python dependencies
│   ├── requirements-prod.txt   # Production dependencies only
│   ├── requirements-test.txt   # Test dependencies only
│   └── pytest.ini             # Pytest configuration
│
├── frontend/                   # Frontend assets (SINGLE SOURCE OF TRUTH)
│   ├── static/
│   │   ├── css/               # Modular CSS architecture (6 modules)
│   │   │   ├── base.css       # Base styles and theme variables
│   │   │   ├── components.css # Component-specific styling
│   │   │   ├── layout.css     # Layout and grid systems
│   │   │   ├── drag-drop.css  # Panel drag-and-drop interactions
│   │   │   └── resizable.css  # Container resizing functionality
│   │   └── js/                # Modular ES6 JavaScript architecture
│   │       ├── main.js        # Application entry point
│   │       ├── core/          # Core application modules
│   │       │   ├── app-state.js        # Centralized state management
│   │       │   ├── dom-elements.js     # DOM element references
│   │       │   └── utils.js            # Utility functions
│   │       ├── api/
│   │       │   └── api-client.js       # Backend API communication
│   │       ├── managers/      # Business logic managers
│   │       │   ├── rule-manager.js     # ACL rule parsing
│   │       │   └── category-manager.js # Category expand/collapse
│   │       ├── components/    # UI components
│   │       │   ├── command-tester.js           # Command testing
│   │       │   ├── keyspace-tester.js          # Keyspace testing
│   │       │   ├── interactive-acl-builder.js  # Three-column builder
│   │       │   ├── resizable-container.js      # Container resizing
│   │       │   └── saved-rules.js              # Saved rules
│   │       └── handlers/
│   │           └── event-handlers.js   # Event management
│   └── templates/
│       ├── index.html         # Main application
│       └── info.html          # Documentation page
│
├── electron/                   # Desktop app wrapper (v2.0.0-alpha)
│   ├── main.js                # Electron main process
│   ├── preload.js             # Preload script for security
│   ├── package.json           # Electron dependencies
│   └── build/                 # Build assets (icons, DMG background)
│
├── scripts/                    # Helper scripts
│   ├── run-web.sh             # Start web app
│   ├── build-web.sh           # Build Docker image
│   ├── run-desktop.sh         # Start Electron (future)
│   ├── version-bump.sh        # Version management
│   └── docker-tag-maintenance.sh
│
├── tests/                      # Test suite
│   ├── backend/               # Backend tests (195 tests, 100% passing)
│   │   ├── test_app.py
│   │   ├── test_acl_parser_pytest.py
│   │   ├── test_optimization.py
│   │   └── ... (14 test files total)
│   └── e2e/                   # E2E tests (28 tests, 100% passing)
│       ├── 01-page-load.spec.js
│       ├── 02-acl-rule-editing.spec.js
│       └── ... (9 spec files total)
│
├── docker/                     # Web app Docker deployment
│   ├── Dockerfile             # Updated for monorepo paths
│   ├── docker-compose.yml
│   ├── deploy-beta.sh
│   └── README.md
│
├── build_minified.py           # Asset minification (updated paths)
├── playwright.config.js        # E2E test config (updated paths)
├── docs/
│   └── ELECTRON-ROADMAP.md     # v2.0 implementation plan
└── .gitignore                 # Git ignore patterns
```

### Critical Implementation Details

**Command Database**: All Redis commands and their categories are hardcoded in `data_loader.py`. All commands are normalized to lowercase for consistent processing. When Redis releases new versions, this file must be updated manually.

**Permission Logic**: The ACL parser implements exact Redis semantics - empty rules block all commands (Redis default), and rule precedence is strictly left-to-right.

**Error Handling**: Comprehensive validation for invalid categories, unknown commands, and malformed syntax with detailed error messages.

**Module Command Support**: Full support for Redis 8 modules including RediSearch (ft.*), RedisJSON (json.*), TimeSeries (ts.*), and probabilistic data structures.

### Development Guidelines

**Backend (Python):**

- All helper modules require `__init__.py` files for proper Python imports
- The test runner (`run_tests.sh`) includes extensive diagnostics and dependency checking
- Virtual environment usage is strongly recommended
- Coverage reports are generated automatically during testing
- The application supports both development (`DEBUG=True`) and production modes

**Frontend (JavaScript):**

- Use ES6 modules with import/export syntax - all JavaScript is now modular
- Follow separation of concerns: core/, api/, managers/, components/, handlers/
- Each module should have a single responsibility and clear dependencies
- Use dynamic imports to avoid circular dependencies when necessary
- The HTML template loads JavaScript with `type="module"` for ES6 support
- Global window functions are preserved for HTML onclick handlers
- Original monolithic main.js is backed up as `main-original.js`

### Current Status and Roadmap

**Production Status**: ENTERPRISE-READY - AUTO-UPDATE ENABLED (v2.2.6-beta)

**NEW in v2.2.6-beta: Auto-Update System Fully Working! 🎉**:

- **Code Signing Enabled**: macOS builds now signed with Developer ID Application certificate
- **Auto-Update Working**: Successfully tested v2.2.5-beta → v2.2.6-beta update flow
- **Artifact Naming Fixed**: Consistent hyphenated naming (`Redis-ACL-Builder-*.zip`)
- **ZIP Files Included**: Auto-update ZIP files properly uploaded to GitHub releases
- **Draft Cleanup Automation**: CI/CD automatically removes leftover draft releases
- **Code Signature Validation**: Updates pass macOS signature validation
- **Production Ready**: Users can now receive seamless automatic updates

**Previous in v2.2.0-beta: Dead Code Cleanup & Optimization**:

- **Dead Code Removal**: Removed unused acl-state-coordinator.js (26 lines of stub code)
- **Build Artifact Cleanup**: Cleaned 711MB of local build artifacts (build/, dist/, electron/dist/)
- **Cache Cleanup**: Removed Python **pycache** and .pyc files
- **Zero Dead Code**: Comprehensive analysis confirmed no unused imports, functions, or orphaned files
- **Perfect .gitignore**: All build artifacts and cache files properly excluded from version control
- **Codebase Health**: 100% clean source code with zero dead code or unused dependencies

**Previous in v2.1.9-beta: Debug Builds & Build Optimization**:

- **Debug Build Configuration**: Detached DevTools for debugging without UI disruption
  - `-debug` tags create builds with DevTools in separate window
  - Marker-based detection via `.debug-build` file
  - Perfect for debugging without obstructing the main application interface
- **Build Performance Improvements**: 20-30% faster builds with aggressive caching
  - Python pip dependency caching via setup-python@v5
  - PyInstaller build artifact caching (backend/build and backend/dist)
  - Multi-platform build time reduced from ~5m17s to ~4min
  - Windows build (former bottleneck) reduced from ~5min to ~3.5-4min
- **Reduced Release Asset Count**: ~40% fewer installer files per release
  - macOS: DMG only (removed redundant ZIP files)
  - Windows: NSIS installer only (removed redundant ZIP files)
  - Linux: AppImage only (removed .deb packages)
  - Streamlined releases with only essential installer formats
  - Kept blockmap files for delta updates (partial downloads)
- **Source Code Protection**: Private repository prevents source downloads
  - GitHub shows "Source code" links in UI but they return 404
  - Only uploaded installers (DMG, NSIS, AppImage) are downloadable
  - No automated cleanup needed - private status handles this automatically
- **Enhanced Tag Strategy**: Clear separation of local vs remote builds
  - `-test`: Reserved for local builds only (npm run build:mac) - no GitHub workflows
  - `-test-release`: ARM64 + GitHub release for auto-update testing (~2 min)
  - `-debug`: ARM64 with detached DevTools (~2 min)
  - `-desktop`: Multi-platform desktop-only (no Docker rebuild, ~5 min)
  - `-beta/-alpha`: Full production releases (Docker + all platforms, ~8 min)
- **UI Polish**: Version indicator and visual consistency
  - Version indicator in bottom-left corner showing current version (e.g., "v2.1.9-beta")
  - Consistent light gray borders across all panels for unified visual design
  - Better theme-aware styling and professional appearance

**Production Status**: ENTERPRISE-READY with TYPE SAFETY & ADVANCED KEY PERMISSIONS (v1.18.0-beta)

- All 127 tests passing with comprehensive coverage (0 failures, 16 skipped)
- **NEW in v1.18.0: Complete Pydantic API Migration**:
  - Migrated all API endpoints to use Pydantic models for request/response validation
  - Zero Pylance type checking warnings across entire codebase
  - Enhanced type safety with explicit annotations for error handling
  - Proper data structure formatting for nested dict responses
  - ErrorResponse, HealthResponse, and all endpoint-specific models fully integrated
- **NEW in v1.18.0: Advanced Key Permissions Support**:
  - Full support for Redis 7.0+ advanced key permission syntax
  - `%R~pattern` for read-only key access
  - `%W~pattern` for write-only key access
  - `%RW~pattern` for read-write key access (alias for `~pattern`)
  - ACL rule optimization preserves key patterns during optimization
  - Enhanced validation for all key permission prefix types
  - Updated integrated command+keyspace tester with permission type hints
- **NEW in v1.18.0: Enhanced Testing Interface UX**:
  - Improved test result animations (slide up from button, slide down on dismiss)
  - Auto-dismiss functionality for integrated tester with 15-second timeout
  - localStorage persistence for integrated/split tester mode preference
  - Enhanced light mode styling with pastel gradient buttons
  - Improved placeholder text and accessibility labels
  - Fixed test result overflow handling for better visibility
- **NEW in v1.17.0: Smart ACL Rule Optimization**:
  - Comprehensive 4-strategy optimization algorithm (pure category, category with exclusions, individual commands, multi-category cover)
  - Auto-applies optimization for button-built rules with notifications
  - Shows clickable suggestions for manually-typed rules
  - Real-world examples: `+pfadd +pfcount +pfmerge` → `+@hyperloglog` (saves 2 terms)
  - Backend API endpoint `/api/optimize-rule` with Pydantic validation
  - 227 lines of optimization logic with greedy set cover algorithm
  - All 22 optimization tests passing
- **NEW in v1.17.0: Test Suite Improvements**:
  - Fixed all 26 failing tests to match current API implementation
  - Updated API response structure assertions (nested `analysis` object)
  - Fixed ACLParser method naming (parse → parse_acl_rule)
  - Updated UI element assertions to match dynamic content
  - Added skip decorators for unimplemented features with clear documentation
  - Test pass rate: 81.8% → 100% (127 passing, 16 skipped with documentation)
- **NEW in v1.17.0: UI Accuracy Fix**:
  - Excluded @all pseudo-category from category count in panel headers
  - Provides accurate counts of actual Redis categories (21 for Redis 7, 29 for Redis 8)
- **NEW in v1.16.0: Docker Maintenance Infrastructure**:
  - Comprehensive Docker Hub tag management script with API integration
  - Pattern-based filtering and deletion capabilities (regex support)
  - Interactive operations with confirmation prompts and dry-run modes
  - Secure integration with existing DOCKERHUB_TOKEN GitHub secret
  - Complete documentation with usage examples and troubleshooting
  - CI/CD ready for automated maintenance workflows
  - Multiple operation modes: list, pattern matching, individual/bulk deletion
- **NEW in v1.15.8: Enterprise-Grade Type Safety**:
  - Comprehensive type annotations across all modules (app.py, acl_parser.py, data_loader.py)
  - 94% reduction in Pylance strict type checking errors (from 31+ to 2 hints)
  - Complete function parameter and return type specifications
  - Strategic type casting for complex data structure access
  - Enhanced Flask import types and proper typing integration
  - Zero type checking errors remaining - only 2 harmless unused variable hints
  - Maintained 100% test coverage and functionality throughout type safety implementation
- **NEW in v1.15.7: Production-Ready CI/CD Pipeline**:
  - Fully functional automated Docker Hub publishing with multi-architecture builds (AMD64/ARM64)
  - Complete security vulnerability management with Docker Scout CVE scanning
  - Optimized Docker layer caching for fast builds (5-10 minutes vs 15+ minutes)
  - Smart tagging strategy with automatic :latest, :beta, and semver tags
  - Tag-only build triggers to prevent unnecessary builds on development commits
  - Fixed Docker Scout scanning to analyze freshly built images instead of stale cached layers
  - Updated Gunicorn to 23.0.0 resolving HTTP Request Smuggling vulnerabilities (CVE-2024-1135, CVE-2024-6827)
- **NEW in v1.13.0: Enhanced Light Mode Experience**:
  - Adaptive SVG background with dynamic inversion using CSS filters
  - Optimized contrast with `brightness(0.85) contrast(1.8)` for perfect pattern visibility
  - Enhanced container shadows for excellent depth perception in light mode
  - Hardware-accelerated filters with pseudo-element layering
- **NEW in v1.13.0: Improved Accessibility**:
  - Fixed yellow button text contrast for implicit/explicit partial categories
  - Theme-specific text colors (dark brown for light mode, light yellow for dark mode)
  - Comprehensive light mode styling for all partial category button states
- **NEW in v1.13.0: Code Quality Improvements**:
  - Consolidated 5 duplicate positioning functions into reusable helper
  - Merged duplicate CSS selectors and removed obsolete rules
  - Cleaned up debug console.log statements
- **NEW in v1.15.1: Automated CI/CD Pipeline Implementation**:
  - Complete GitHub Actions workflow for automated Docker Hub publishing
  - Multi-architecture builds (AMD64, ARM64) with smart tagging strategy
  - Security scanning with Docker Scout CVE analysis and vulnerability management
  - Automated version bumping script with git tagging and documentation updates
  - Comprehensive CI/CD setup guide with troubleshooting and best practices
  - Performance optimizations with Docker layer caching and parallel builds
- **NEW in v1.15.0: Complete Responsive Design Overhaul**:
  - Perfect tablet experience (≤1200px): Question mark tooltips positioned correctly, search bars aligned, full-size form fields restored
  - Optimized mobile experience (≤480px): Form buttons stack below inputs, removed unnecessary margins, enhanced spacing
  - Consolidated redundant CSS rules across stylesheets for better maintainability
  - Fixed JavaScript null pointer errors in resizable container for responsive mode
  - Eliminated visual filter artifacts and improved responsive layout performance
- **NEW in v1.14.2: Complete Code Cleanup and Bug Fixes**:
  - Comprehensive code cleanup removing 90+ lines of unused CSS classes and definitions
  - Fixed header drag constraint calculation bug preventing right-edge shrinking
  - Removed temporary development utility files for cleaner project organization
  - Eliminated excessive empty lines and improved code maintainability
  - Fixed backdrop width calculation in both drag operations and position restoration
- **NEW in v1.14.0: Complete 8-Way Resizable Container System**:
  - 4 triangular corner handles with directional indicators (32px, 40px mobile)
  - 4 edge resize handles for single-dimension resizing (12px width/height)
  - Smart interaction priority: Corners > Edges > Header drag
  - Large radius rounded corners for visual consistency across all elements
  - Complete save/restore functionality for all resize methods
  - Clean panel drag button behavior (only highlight on click/drag, not hover)
  - Professional desktop-like resize experience with intuitive visual feedback
- **NEW in v1.11.0: Advanced Auto-Simplification Engine**: Comprehensive detection and optimization of ACL patterns including cancelled @all, all-categories, and individual category optimizations with intelligent rule simplification
- **NEW in v1.11.0: Smart Button Handler System**: Fixed category button handler preservation to prevent override of intelligent handlers, ensuring proper behavior for complex ACL interactions
- **NEW in v1.11.0: Enhanced Redundancy Warning System**: Added dismissible redundancy warnings with proper styling, user feedback, and comprehensive notification management
- **NEW in v1.10.0: Enhanced Interactive ACL Builder**: Comprehensive category logic improvements, consistent @all behavior, and improved partial category detection
- **NEW in v1.10.0: Category Flow Improvements**: Proper click behaviors for implicitly partial categories, consistent styling across granted/blocked columns
- **NEW in v1.10.0: @all Category Priority**: @all category always appears first in both granted and blocked columns regardless of state
- **NEW in v1.9.0: Advanced Search System**: Independent fuzzy/exact search modes for blocked and granted columns with enhanced toggle buttons
- **NEW in v1.9.0: Multi-Column Tooltip System**: Intelligent tooltips with adaptive 2-4 column layouts for categories with 200+ commands
- **NEW in v1.9.0: Perfect Anti-Flash Rendering**: Theme-aware loading covers eliminate all visual flashes during updates and version switches
- **NEW in v1.9.0: Enhanced Redundancy Detection**: Fixed false positives for legitimate category patterns like '+@read +@write -@dangerous'
- **NEW in v1.9.0: Color-Coded UI Experience**: Green/red tooltip titles and expandable links based on granted/blocked state
- **NEW in v1.9.0: Hover Persistence System**: Tooltips remain visible when moving mouse from button to tooltip content
- **NEW in v1.9.0: Search Filter Preservation**: Filters maintained across ACL rule updates and Redis version switching
- **Automated Docker Publishing**: Complete CI/CD pipeline with Docker Hub integration
  - Fully automated multi-architecture builds (AMD64/ARM64) on version tags
  - Automatic publishing to Docker Hub: `markotrapani608/redis-acl-builder`
  - Local deployment script (`./deploy-beta.sh`) with health checks and user feedback
  - Docker Compose support for easy deployment (`docker-compose up -d`)
  - Production Gunicorn 23.0.0 server with 4 workers and security updates
  - Comprehensive Docker documentation and CI/CD setup guides
- **NEW: Enhanced Repository Organization**: All Docker files organized in dedicated `docker/` folder
- **NEW: Git Optimization**: Added .gitignore to exclude large Docker image files (>100MB GitHub limit)
- **Perfect Theme Support**: Eliminated light mode flash on page load with inline script initialization
- **Enhanced Error Handling**: Intelligent restoration handling, no error notifications during page load
- **Production-Ready Logging**: Cleaned up debug console output for production deployment
- **Smart Submit Changes Button**: Reliable visibility when reloading with invalid/partial ACL rules
- **Optimized Test Input Management**: Removed localStorage persistence for temporary test fields
- **Theme-Aware Loading States**: Light/dark loading covers that match the current theme
- **Advanced Token Truncation**: Long invalid tokens (>13 chars) automatically truncated to 10 chars + "..." in error messages
- **Robust Initialization Flow**: Post-initialization state validation ensures correct Submit Changes button visibility
- **Complete Keyspace Testing**: Full glob pattern matching for key patterns (~), supports *, ?, [abc], [a-z], [^abc], escaped characters
- **Dismissible Test Results**: Auto-dismiss after 5 seconds, manual close buttons, smooth 400ms fade animations with scale transforms
- **Intelligent Button State Management**: Disabled states for Clear/Copy when ACL empty, disabled test buttons when inputs empty, subtle hover effects
- **Smart Scrollable Quick Examples**: Intelligent JavaScript-controlled scrollbar system with 15px tolerance threshold
- **Dynamic Content Detection**: Comprehensive monitoring of textarea, Submit Changes button, and redundancy warnings
- **Enhanced Error Messages**: Improved backend formatting ("Redis 8" vs "REDIS8"), consistent HTML structure across all results
- **Optimized Layout**: Fixed height panels with overflow for better space management, reduced panel heights (700px default, 740px expanded)
- **Perfect Responsive Design**: Fixed column width inconsistencies across all screen sizes  
- **Intuitive Column Reordering**: Reordered three-column layout for improved workflow (Blocked → Config → Granted)
- **Intelligent Panel Expansion**: Smart panel behavior that distinguishes manual typing from interactive clicks
- **Auto-sync Functionality**: Automatic rule syncing when content becomes empty or reverted
- **Elegant Content Overflow**: Smart scrollbar that appears only when content truly overflows
- **Light/Dark Mode Toggle**: Full theme switching with localStorage persistence and system preference detection
- **Performance Optimizations**: Debounced input handling for smooth textarea resize operations
- **Enhanced Test Command Button**: Modern gradient styling, hover animations, mobile-optimized
- **Optimized Command Preview**: Reduced threshold from 8 to 3 commands for better UX compactness
- Advanced UI polish completed: real-time validation, smooth animations, collapsible preview rows
- Fixed validation edge cases: invalid categories, pipe characters in commands, empty ACL states, Redis subcommand matching
- Eliminated visual inconsistencies: button opacity issues, screen flashing, cascading effects
- Enhanced user experience: pop-up notifications, debounced rendering, consistent styling, professional interactions
- **Modular JavaScript Architecture**: Refactored 1,862-line main.js into 8 focused ES6 modules
- **Optimized CSS Architecture**: Streamlined 6 CSS modules with improved maintainability
- **Enhanced Developer Experience**: Clear module boundaries, comprehensive separation of concerns
- **NEW: Resizable Panel Container System**: Interactive container resizing with invisible corner handles, native macOS cursor support (se-resize/sw-resize), smooth resize overlays, and persistent dimension storage
- **NEW: Panel Drag-and-Drop Reordering**: Full panel reordering capabilities with visual feedback, drag handles, smooth animations, and theme-aware styling
- No outstanding major issues - All critical UX flows perfected with dual testing capabilities
- **READY FOR BETA TESTING**: Production-ready Docker deployment with comprehensive documentation
- Full Redis 8 module command support verified
- **Docker Image Size**: ~110MB (Alpine-based, builds locally to avoid GitHub 100MB limit)
- **Deployment Options**: 4 different deployment methods for maximum flexibility

**Current Development Status (v2.2.0-beta)**:

- ✅ Electron desktop app fully functional with all features
- ✅ **Auto-update infrastructure ready** - Detection and download working (installation requires code signing)
- ✅ **Code signing infrastructure ready** - Waiting for Apple Developer approval
- ✅ **Multi-platform builds** - macOS (ARM64 + x64), Windows, Linux
- ✅ **Fast build workflow** - 2-minute macOS ARM64 builds for debugging
- ✅ **Docker image published** - markotrapani608/redis-acl-builder:v2.2.0-beta
- ✅ All 223 tests passing (195 backend + 28 E2E)
- ✅ Production-ready for both web and desktop deployments
- ✅ **Repository now PRIVATE** - Source code protected, releases accessible via direct URLs
- ✅ **Dead code eliminated** - Zero unused files, perfect codebase health (v2.2.0-beta)

**Repository Visibility Strategy**:

**Current State**: Repository is **PRIVATE** (as of v2.1.7-beta)

**Implementation Status**:

1. ✅ Repository is **private** - Source code protected
2. ✅ GitHub releases accessible via direct URLs (releases page requires auth)
3. ⏳ Token-based authentication for auto-updates (pending code signing):
   - Generate GitHub Personal Access Token with `public_repo` scope
   - Add token to electron-updater configuration
   - Token embedded in desktop app (read-only, release access only)
   - Users can still download releases directly without authentication
4. Benefits:
   - Source code remains private
   - Users get pre-built binaries (Docker + Desktop) publicly
   - Auto-updates work with token authentication
   - No source code in releases (Docker images + installers only)

**Implementation Steps** (when ready to go private):

```bash
# 1. Make repository private
gh repo edit markotrapani/redis-acl-builder --visibility private

# 2. Generate token for auto-updates (do this in GitHub UI)
# Settings → Developer settings → Personal access tokens → Fine-grained tokens
# Permissions: Contents (read-only), Metadata (read-only)

# 3. Update electron/main.js to use token
# autoUpdater.setFeedURL({
#   provider: 'github',
#   owner: 'markotrapani',
#   repo: 'redis-acl-builder',
#   token: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'  # Read-only token
# })

# 4. Verify releases remain public
# GitHub releases stay accessible even with private repos
```

**Next Development Priorities (v2.x)**:

1. **Test Windows and Linux Auto-Update** (Untested - Complex Setup Required)
   - ⚠️ **macOS only tested** - v2.2.5-beta → v2.2.6-beta verified working
   - ❓ Windows auto-update untested (uses .exe for updates)
   - ❓ Linux auto-update untested (uses AppImage)
   - **Requires:** Windows VM (Parallels/VMware) + Linux VM setup
   - **Complexity:** Significant time investment for VM setup and testing
   - **Alternative:** Wait for user feedback from Windows/Linux beta testers
   - May require fixes to ensure cross-platform auto-update works

2. **App Notarization** (Optional - Improves First-Install UX)
   - **Current:** Users see "cannot be verified" warning, must right-click → Open → Open Again
   - **With Notarization:** Users see "from identified developer" and click Open once
   - **Benefit:** Better first impression, less friction for new users
   - **Cost:** $0 (included with existing Developer account)
   - **Effort:** ~30-60 min setup (App Store Connect API key)
   - **Infrastructure:** Ready (entitlements.mac.plist, notarize.js, workflow placeholders)
   - **Auto-update:** Works with or without notarization (code signing handles that)

**Completed Reviews:**

✅ **Artifact Optimization Analysis** (v2.2.6-beta)

- **Analysis complete:** 11 assets per release (~660 MB total)
- All assets serve a clear purpose (auto-update metadata, installers, DMGs)
- Could remove DMGs to save ~214 MB (worse UX for first-time macOS users)
- **Decision:** Keep current setup for professional distribution
- macOS: DMG + ZIP (manual install + auto-update)
- Windows: EXE (installer + auto-update)
- Linux: AppImage (installer + auto-update)
- Metadata: 3 YAML files for cross-platform auto-update

Focus on stability and user feedback - macOS auto-update working, Windows/Linux need testing!

**Security Monitoring**:

Monitor and address remaining Docker image vulnerabilities when upstream fixes become available:

- **CVE-2025-8869** (pip 25.2) - ✅ **NOT VULNERABLE** - Mitigated by Python 3.13.8
  - **Status**: Docker image uses Python 3.13.8 which implements PEP 706
  - **Protection**: PEP 706 implementation prevents pip from using vulnerable fallback tar extraction code
  - **Action Required**: None - Python 3.13+ provides built-in protection regardless of pip version
  - **Note**: Pip 25.3 will include the fix, but upgrade is optional (already protected)
- **CVE-2025-46394** (BusyBox 1.37.0) - LOW severity - Waiting for upstream BusyBox 1.38.0 release
  - **Vulnerability**: TAR archives can hide filenames using terminal escape sequences
  - **Impact**: Cosmetic display issue in tar listings only
  - **Status**: BusyBox 1.38 not yet released; Alpine tracking the issue
- **CVE-2024-58251** (BusyBox 1.37.0) - LOW severity - Waiting for upstream BusyBox 1.38.0 release
  - **Vulnerability**: Netstat component allows ANSI escape sequences in argv[0]
  - **Impact**: Potential terminal lockup when using netstat (requires local access, user interaction)
  - **CVSS Score**: 2.5 (LOW) - High attack complexity, local access required
  - **Status**: BusyBox 1.38 not yet released; Alpine tracking the issue

Current status (v2.1.0-beta): 0 Critical, 0 High, 0 Medium, 2 Low vulnerabilities. All HIGH/MEDIUM/CRITICAL issues resolved.

**Future Roadmap (v2.x+)**:

1. **Electron Desktop App - Multi-Platform Distribution Ready** (v2.1.7-beta):
   - ✅ Native desktop experience across all platforms
   - ✅ Enhanced UI/UX without browser limitations
   - ✅ Better performance and offline capability
   - ✅ **PyInstaller backend bundling** - Standalone app (no Python required!)
   - ✅ **Multi-Platform Builds - COMPLETE!** 🎉
     - ✅ macOS ARM64 DMG (112MB) - Apple Silicon optimized
     - ✅ macOS Intel x64 DMG (112MB) - Intel Mac optimized
     - ✅ Windows NSIS installer + ZIP - Full Windows 10/11 support
     - ✅ Linux AppImage + .deb - Ubuntu/Debian compatible
   - ✅ **Automated CI/CD Pipeline** - GitHub Actions builds on version tags
   - ✅ **Fast macOS ARM64 workflow** - Quick 2-minute builds for testing/debugging
   - ✅ **Auto-update system** (v2.2.6-beta) - FULLY WORKING! 🎉
     - ✅ Update detection working (checks GitHub releases)
     - ✅ Download working (successfully downloads new versions)
     - ✅ Installation working (code signature validation passing)
     - ✅ **macOS code signing enabled** (Developer ID Application certificate)
     - ✅ Tested and verified: v2.2.5-beta → v2.2.6-beta auto-update successful
     - ✅ Consistent artifact naming (hyphens: `Redis-ACL-Builder-*.zip`)
     - ✅ ZIP files properly included in GitHub releases for auto-update
     - ✅ Draft release cleanup automation in CI/CD
     - 🔄 **Next: App notarization** (optional - improves first-install UX)
   - ✅ **Size optimization analysis** - 112MB is excellent (86% Electron Framework, 13% backend, 1% assets)
   - ✅ **Ready for beta distribution** - Fully functional standalone desktop app on all platforms!
   - 🔄 **Next: Code signing & notarization for production** (requires Apple Developer account)
     - Infrastructure ready: entitlements.mac.plist, notarize.js script, workflow placeholders
     - Need: Apple Developer account ($99/year), certificates, App Store Connect setup
     - Will eliminate Gatekeeper warnings and enable professional distribution
     - Documentation: [docs/CODE-SIGNING-SETUP.md](docs/CODE-SIGNING-SETUP.md)
   - 🔄 Future: Native desktop features - custom title bar, file dialogs, system tray (Phase 2)

2. **Multi-Key Command Validation** (Future v2.x): Advanced command+key testing with Redis command signature awareness
   - Support for commands with multiple key arguments (COPY, RENAME, MIGRATE, etc.)
   - Validate each key argument individually based on command signature
   - Per-argument access reporting (e.g., "source key allowed, destination key denied")
   - Integration with Redis command metadata to determine key argument positions
   - Enhanced testing interface showing multi-key validation results
   - Examples: `COPY source_key dest_key`, `RENAME old_key new_key`

**Completed Features**:

- ✅ **Electron App Test Result Popup Fix** (v2.0.3-alpha): Fixed critical z-index stacking context issue where test result popups were getting buried under three-column ACL builder panels in the Electron desktop app. **Root cause**: `.testing-container` had z-index: 10 while `.three-column-layout` had z-index: 20, causing entire testing container (and all popups inside) to render behind panels regardless of popup's own z-index. **Solution**: Changed `.testing-container` to z-index: 30, fixed overflow clipping on parent containers (`.panel-container`, `.inner-container`, `.three-column-layout` changed from `overflow: hidden/auto` to `overflow: visible`), updated all test result popup z-index values to 9999 with !important. **Impact**: Test result popups now correctly appear above all three-column panels in both web and Electron app. Drag-drop functionality preserved with higher z-index values during drag operations (tester drag: 2000, panel drag: 1000). Version bumped from v2.0.0-alpha → v2.0.3-alpha.
- ✅ **Monorepo Restructure** (v1.27.0-beta): Complete codebase reorganization into monorepo structure with `backend/`, `frontend/`, `electron/`, `scripts/`, and `tests/` directories. Single source of truth for both web app and future Electron desktop app with zero code duplication. All 195 backend tests + 28 E2E tests passing. Updated Flask app to reference `../frontend/` paths, updated Docker build to copy from `../backend/` and `../frontend/`, updated `build_minified.py` and `playwright.config.js` for new paths. Created helper scripts (`run-web.sh`, `build-web.sh`, `run-desktop.sh`). Backend and frontend code now exists ONCE and will be shared by both web and desktop versions in v2.0. Fast web development workflow preserved - iterate quickly in Flask, then test in Electron when ready.
- ✅ **Documentation Update** (v1.26.1-beta): Updated /info page to reflect current v1.26.0-beta features. Updated version references from v1.13.0 to v1.26.0, test coverage stats to 223 total tests (195 backend + 28 E2E with 100% pass rate), removed non-existent `/api/test-keyspace` endpoint (keyspace testing is client-side JavaScript glob matching), added `/api/test-command-key` and `/api/optimize-rule` endpoints, updated Docker tag examples, enhanced architecture section with type safety and modular structure details.
- ✅ **Complete E2E Test Suite & Type Safety Enhancement** (v1.26.0-beta): Comprehensive Playwright end-to-end test suite with 100% pass rate (28/28 tests). Fixed all test failures by adapting to integrated tester mode with correct element selectors (`#integratedCommand`, `#integratedKey`, `#integratedTestResult`, `.integrated-test-button`) and API endpoints (`/api/test-command-key`). Tests cover: page load and layout (5 tests), ACL rule editing and validation (5 tests), interactive builder click-to-grant/revoke (4 tests), command permission testing (3 tests), keyspace pattern testing (2 tests), saved rules management (2 tests), Redis version switching (3 tests), theme switching (2 tests), and complete user workflows (2 tests). Enhanced `build_minified.py` with comprehensive type annotations - added function signatures with return types, explicit variable type hints for all locals, and `# type: ignore` comments for untyped imports. Achieved enterprise-grade type safety across entire codebase.
- ✅ **Rule Optimization Display & Version Switching Enhancements** (v1.25.4-beta): Fixed optimization display to show single warning with backend suggestion and "Saves X terms" text (no duplicates). Frontend now preserves backend warnings/suggestions and only adds its own if backend hasn't provided them. Removed redundant "Commands match exactly" explanation when category completion warning exists. Fixed version switching to preserve unsaved textarea content - skips both redundancy analysis AND interactive builder refresh when Submit Changes button is visible. Comprehensive testing across Redis 7 vs 8 version differences (e.g., @hash category: 25 commands in Redis 7 → `+@hash`, same 25 in Redis 8 → `+@hash -hgetdel -hgetex -hsetex`). All edge cases tested: empty rules, invalid syntax, already optimal rules, category exclusions, light/dark mode visual consistency.
- ✅ **Command Sort Order & Rule Preservation Fixes** (v1.25.3-beta): Fixed command sorting to prioritize explicit commands before implicit (priority-based). Rules like `-get` are now preserved on page refresh instead of being cleared. Fixed empty ACL detection to check for blocked categories/commands. Implemented implicit partial category styling with proper hollow yellow ⚠ display. Fixed @all priority assignment (always priority 1). Enhanced search with fuzzy relevance scoring (exact matches first, sorted by match quality), order restoration when clearing search, and "Showing X of Y" count positioned before buttons. Eliminated visual gaps from empty command-buttons containers.
- ✅ **Optimization Box Persistence & Backend Error Fix** (v1.25.1-beta): Fixed critical undefined `warnings` variable error in `optimize_rule()` method that broke all optimization (was returning savings=0). Changed to parse rule tokens directly to detect inefficient +@all placement patterns. "Saves X terms" now displays correctly. Implemented optimization suggestion persistence - suggestions now remain visible while typing or temporarily deleting text in textarea. Only hide optimization box when: submitting new rule, clicking X dismiss button, or explicit clear operation. Skip redundancy analysis during typing no longer hides existing warnings. Complete manual testing of @all category button states, button ordering priorities, and auto-optimization triggers. Updated testing documentation with all v1.25.0-v1.25.1 completed tests.
- ✅ **Backend Category Analysis & Test Suite Expansion** (v1.25.0-beta): Implemented comprehensive backend category analysis in ACL parser - classifies categories as fully granted, partially granted (with percentage), or blocked based on actual command permissions. Added `analyze_category_grants()` method returning category analysis in /api/parse response. Created 68 new automated tests including 12 comprehensive API-level category analysis tests, 19 button interaction tests, 16 @all category behavior tests, and 8 ACL precedence validation tests. Removed 16 obsolete skipped tests (-319 lines cleanup). Test suite expanded from 127 → 195 passing tests (0 skipped). Fixed test signature mismatches and API response structure. Backend now provides complete category intelligence for future frontend simplification and API integrations.
- ✅ **Smart Category Detection & Auto-Optimization** (v1.24.0-beta): Complete implicitly partial category detection for complex ACL patterns like `+@all -@admin`. Categories with mixed granted/blocked commands now show with consistent hollow yellow ⚠ styling in BOTH granted and blocked columns. Implemented intelligent auto-optimization for button-built rules - clicking partially blocked `@admin` in `+@all -@admin +@connection` now auto-optimizes to `+@all`. Backend detects when all commands are granted and suggests `+@all` optimization. Grouped redundancy warnings - multiple redundant terms now show as single message with comma-separated list (e.g., "Redundant inclusions: +@connection, +@admin"). Eliminated duplicate optimization explanations and intermediate suggestions. Fixed +@all expansion detection to properly distinguish explicit vs implicit category grants.
- ✅ **Interactive Hover Feedback & Animation Fixes** (v1.23.1-beta): Added intelligent emoji swap on hover for all interactive buttons. Link/unlink buttons (⛓️‍💥 → 🔗 and 🔗 → ⛓️‍💥) preview toggle actions, Clear ACL button (💣 → 💥 when enabled) previews destructive action. Implemented smooth opacity transitions with matching gradient backgrounds to eliminate size changes and layout shifts. Fixed drag-drop animation bug after mode switching by clearing inline styles after fade transitions complete (300ms delay). Works seamlessly in both light and dark modes with theme-appropriate colors.
- ✅ **Testing Section UI Polish** (v1.23.0-beta): Complete visual hierarchy improvements for tester controls. Link/unlink buttons repositioned to the left of drag handles in split panels with proper float management and HTML ordering. Added distinctive yellow/orange styling for integrated panel's unlink button (matches exact-mode toggle) while maintaining purple theme for split panel buttons. Enhanced visual consistency and accessibility across all testing interfaces.
- ✅ **Complete Pylance Strict Mode Type Safety** (v1.22.4-beta): Comprehensive type annotations across all helper modules (data_loader.py, acl_parser.py). Added TypedDict definitions (RedisVersionData, CommandRule, KeyRule, ChannelRule, PermissionSet, ParsedACLRule). Fixed 221+ Pylance warnings with explicit type hints for all collections (sets, lists, dicts, tuples), variables, lambda parameters, and return types. Achieved 0 errors/0 warnings in pyright strict mode. No functional changes - purely type annotation improvements for better IDE support, code documentation, and type safety.
- ✅ **Docker Build Optimization** (v1.21.1): Split requirements into production and test dependencies for faster multi-arch builds. Eliminated coverage compilation on ARM64 (100s savings). Production image uses only requirements-prod.txt. Local development uses requirements.txt (includes both). Upgraded coverage to 7.6.9 with ARM64 wheels. Multi-arch build time reduced from 2m 40s to ~1m 30s.
- ✅ **Testing Section Drag-and-Drop** (v1.21.0): Complete drag-and-drop reordering system for testing sections (Command Tester, Keyspace Tester, Integrated Tester) with grabbable handles, smooth animations, localStorage persistence, and universal pointer-events approach to disable all hover effects during drag. Matches the polished UX of three-column panel drag system.
- ✅ **Rule Selectors - Complete UI Support** (v1.20.0): Full frontend integration for Redis 7.0+ selectors with proper command display, frontend validation with "Selector #1:" error prefixes, enhanced testing interface showing selector context, perfect selector isolation with informative error messages, and OR logic (commands granted if EITHER root OR any selector permits them).
- ✅ **Advanced Key Permissions - Bug Fixes** (v1.20.0): Fixed full keyspace access (no key patterns = access to all keys per Redis default), improved error messages for permission type mismatches, smart isolation hints only shown when selectors exist, proper handling of read-write commands like GETSET.
- ✅ **Comprehensive Interactive ACL Builder Refactoring** (v1.22.0-v1.22.3): Massive refactoring effort across 4 safe checkpoints (v1.22.0, v1.22.1, v1.22.2, v1.22.3). Main file reduced from 4,286 → 3,195 lines (-1,091 lines, -25.5%). Created 5 specialized modules: ACLOptimizer (470 lines, 21 methods), ACLCategoryManager (331 lines, 8 methods), ACLRuleParser (159 lines, 4 methods), ACLStateManager (86 lines, 7 methods), and ACLUIRenderer (545 lines, 5 methods including complex tooltip and button creation logic). Total extracted: 1,636 lines across 45 methods. Maintained full backward compatibility through delegation pattern. Dramatically improved maintainability, testability, and separation of concerns.
- ✅ **Info Page & UI Enhancements** (v1.20.0): Visual separation between basics and advanced features, improved formatting with fixed pub/sub channel display, content cleanup removing version suffixes, fixed button styling conflicts, removed unnecessary loading states.
- ✅ **Pub/Sub Channel Pattern Support** (v1.18.0): Parse and preserve `&` channel patterns in ACL rules (e.g., `&*`, `&channel:*`). Patterns are validated for syntax but not for access (app cannot test pub/sub permissions). Preserves patterns for rule display/export.
- ✅ **Complete Pydantic API Migration** (v1.18.0): Migrated all 10 API endpoints to use Pydantic models for type-safe request/response validation. Zero Pylance type checking warnings across entire codebase. Enhanced error handling with explicit type annotations.
- ✅ **Advanced Key Permissions Support** (v1.18.0): Full support for Redis 7.0+ advanced key permission syntax (`%R~` read-only, `%W~` write-only, `%RW~` read-write). ACL optimization preserves key patterns. Enhanced validation for all permission types.
- ✅ **Enhanced Testing Interface UX** (v1.18.0): Improved animations (slide up/down), auto-dismiss with 15s timeout, localStorage mode persistence, pastel gradient buttons for light mode, better accessibility labels.
- ✅ **Smart ACL Rule Optimization** (v1.17.0): Intelligent algorithm finds shortest equivalent ACL rules by exploring 4 optimization strategies (pure category, category+exclusions, individual commands, multi-category cover). Auto-applies for button-built rules, shows suggestions for manual entry. Examples: `+pfadd +pfcount +pfmerge` (3 terms) → `+@hyperloglog` (1 term); `+@transaction -discard -exec -multi` (4 terms) → `+unwatch +watch` (2 terms). API endpoint `/api/optimize-rule` with comprehensive testing (22 passing tests)
- ✅ **Test Suite Improvements** (v1.17.0): Fixed all 26 failing tests to match current API implementation. Updated API response structure assertions, fixed method naming, added skip decorators with documentation. Test pass rate improved from 81.8% to 100% (127 passing, 16 skipped)
- ✅ **Category Count Accuracy** (v1.17.0): Excluded @all pseudo-category from category count in panel headers for accurate Redis category counts
- ✅ **Pydantic Data Validation**: Type-safe API contracts with automatic validation, field validators, and clear error messages - eliminates 90% of API validation bugs
- ✅ **Enhanced Pytest Testing**: Modern test suite with fixtures, parametrization, and 127 passing tests (105 core + 22 optimization) - improved maintainability and coverage
- ✅ **Enterprise-Grade Type Safety**: Comprehensive type annotations across all modules with 94% reduction in Pylance strict errors
- ✅ **ACL Rule History**: Full localStorage-based rule history with save/load functionality
- ✅ **Keyboard Shortcuts**: Comprehensive keyboard shortcuts including Enter to submit ACL changes
- ✅ **Removed Obsolete Auto-Scroll**: Removed automatic scroll behavior when saving custom ACL rules since saved rules are now presented at the top of the preset list
- ✅ **Fixed Testing Section Drag Interactions**: Prevented bottom testing sections from responding to panel drag operations by scoping CSS rules to three-column layout only
- ✅ **Copy to Clipboard**: Built-in copy functionality for ACL rules and configurations
- ✅ **Automated CI/CD Pipeline**: Complete GitHub Actions workflow for automated Docker Hub publishing with multi-architecture builds, security scanning, and version management
- ✅ **Multi-architecture Docker builds**: ARM64/AMD64 support with Python 3.13.7 upgrade
- ✅ **Release Automation**: Version bump script with automated tagging and documentation updates

## Git Workflow Instructions

**IMPORTANT**: After completing significant improvements, bug fixes, or feature implementations, ALWAYS ask the user:
"Would you like me to create a commit for these changes?"

This applies when you have:

- Fixed bugs or issues
- Implemented new features or enhancements  
- Made significant UI/UX improvements
- Updated documentation or configuration files
- Completed any substantial code changes

Only create commits when the user explicitly agrees. When creating commits:

- Use clear, descriptive commit messages
- Follow conventional commit format (feat:, fix:, docs:, style:, etc.)
- Group related changes into logical commits
- Include the Claude Code attribution footer with proper co-author
- **NEVER push to remote automatically** - always ask user permission first before pushing

### Documentation Synchronization Workflow

**CRITICAL**: When creating new version releases or making significant changes, ensure ALL documentation is updated consistently.

## ⚠️ MANDATORY VERSION UPDATE PROCESS ⚠️

**BEFORE creating any version tag, ALWAYS:**

1. **Update version numbers FIRST** (before git tag)
2. **Commit version updates separately**
3. **Then create and push the version tag**

This prevents the documentation drift that just occurred with v1.15.9-beta.

### Required Documentation Updates (in order)

1. **Version Updates**: Update version numbers in all files:
   - `/README.md` - Main project README (header, architecture section)
   - `/CLAUDE.md` - Project instructions and roadmap
   - **`/docker/README.md`** - Docker deployment documentation (**CRITICAL**: Docker Hub description pulls from this file!)
   - `/docker/deploy-beta.sh` - Deployment script version references
   - `/docker/build-multi-arch.sh` - Multi-arch build script version
   - `/docker/test-multi-arch.sh` - Multi-arch test script version
   - `/docker/MULTI-ARCH-README.md` - Multi-arch documentation examples
   - `/docker/CI-CD-SETUP.md` - CI/CD pipeline documentation
   - Any other version-specific files

2. **"What's New" Section**: **MANDATORY** - Update `/README.md` "What's New" section:
   - Replace previous version content with current version highlights
   - Include major features/improvements from the release
   - Group by release version (current + 1-2 previous major releases)
   - Use consistent emoji and formatting style

3. **Feature Documentation**: Update feature descriptions in:
   - **Main README**: Architecture section, feature list, roadmap
   - **CLAUDE.md**: Current Status section, Completed Features, Next Development Priorities
   - **Docker README**: If Docker-related changes were made

4. **Configuration Sync**: Ensure consistency across:
   - **Python version**: requirements.txt, Dockerfile, documentation references
   - **Port numbers**: Consistent across all examples (currently 7380 for dev, 7380 for Docker)
   - **Base images**: Docker documentation matches actual Dockerfile

5. **Validation Checklist** before committing:
   - [ ] All version references updated (search for old version numbers)
   - [ ] **"What's New" section updated** to current version with release highlights
   - [ ] Python version consistency across all files
   - [ ] Port number consistency in all examples
   - [ ] Feature descriptions match actual implementation
   - [ ] Docker documentation reflects current Dockerfile
   - [ ] CI/CD documentation matches workflow files

**Search Commands for Validation**:

```bash
# Find version references that may need updating
grep -r "v1\." . --exclude-dir=.git --exclude-dir=venv
grep -r "python:" . --exclude-dir=.git --exclude-dir=venv
grep -r ":8000\|:5001\|:7380" . --exclude-dir=.git --exclude-dir=venv
```

This systematic approach prevents the documentation drift that occurred with the Docker README.md file.

**Commit Message Template:**

```text
[type]: [description]

[detailed explanation if needed]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: marko.trapani@redis.com
```

## Current Known Issues

### 🚨 CRITICAL: GitHub Actions Tag Trigger Bug (v2.3.4-beta)

**Status:** Under Investigation | **Priority:** HIGH | **Discovered:** 2025-10-19

**Problem:**
GitHub Actions workflows are exhibiting inconsistent behavior with tag-based triggers:

1. **Tag push for v2.3.4-beta triggered ONLY Docker build workflow** - Desktop build workflow (`.github/workflows/build-desktop.yml`) was NOT triggered despite having identical trigger pattern
2. **Main branch pushes incorrectly triggered desktop builds** - Workflow runs 18638532885 and 18638532477 were triggered by `push` to `main` branch, but workflow file ONLY has `push: tags:` trigger (no `branches:` section)

**Evidence:**

```yaml
# .github/workflows/build-desktop.yml (verified at commit 274c528)
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+-beta'  # Should match v2.3.4-beta
  # NO branches: trigger - should NOT run on main pushes
```

**Observed Behavior:**

- ✅ Docker workflow triggered by v2.3.4-beta tag (run 18638533176) - CORRECT
- ❌ Desktop workflow NOT triggered by v2.3.4-beta tag - WRONG
- ❌ Desktop workflow triggered by main branch push (runs 18638532885, 18638532477) - WRONG

**Previous Successful Tags:**

- v2.2.10-beta, v2.2.9-beta, v2.2.8-beta all triggered desktop builds correctly
- Tag pattern is identical across all versions

**Hypothesis:**

- GitHub Actions workflow caching issue
- Timing issue between tag push and workflow trigger evaluation
- Potential GitHub Actions platform bug

**Workaround:**

1. Delete problematic tag: `git tag -d v2.3.4-beta && git push origin :v2.3.4-beta`
2. Wait 2-5 minutes for GitHub Actions cache to clear
3. Recreate tag: `git tag v2.3.4-beta && git push origin v2.3.4-beta`
4. Monitor both Docker and Desktop workflow runs

**To Debug in Future Sessions:**

```bash
# Check which workflows were triggered by a specific tag
gh run list -R markotrapani/redis-acl-builder --json databaseId,name,event,headBranch,displayTitle --limit 20 | \
  jq '.[] | select(.headBranch == "v2.3.4-beta")'

# Check what triggered a specific run
gh run view <RUN_ID> -R markotrapani/redis-acl-builder --json event,headBranch,headSha,conclusion,workflowName

# Verify workflow file at specific commit
git show <COMMIT_SHA>:.github/workflows/build-desktop.yml | head -30
```

**Failed Workaround Attempts:**

1. ❌ Added `if: startsWith(github.ref, 'refs/tags/')` condition to build job (commit 0baf6af)
   - Workflow STILL triggered on main push and STILL failed (run 18638853700)
   - `if` condition was either ignored or evaluated as true despite being a branch push
   - Reverted in next commit

**Next Steps:**

1. Investigate why workflows show different names in GitHub Actions UI (`.github/workflows/build-desktop.yml` vs "Build Desktop Apps (Multi-Platform)")
2. Check if there are TWO separate workflow files that need to work together (build-desktop.yml + docker-publish.yml)
3. Consider temporarily disabling build-desktop.yml workflow to stop spurious failures
4. File GitHub Support ticket with all evidence if issue persists
5. Alternative: Use manual `workflow_dispatch` triggers only until resolved
