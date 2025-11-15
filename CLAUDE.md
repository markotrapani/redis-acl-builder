# CLAUDE.md - Redis ACL Builder

This file provides guidance to Claude Code when working with the **Redis ACL
Builder** project.

**Note**: General repository-wide guidelines (git workflow, Electron safety,
etc.) are in the [root CLAUDE.md](../CLAUDE.md). This file contains
project-specific instructions only.

---

## 🚨 REPOSITORY LOCATION CHECK 🚨

**⚠️ CRITICAL: You are working in the REDIS-ACL-BUILDER SUBMODULE repository!**

**Current Repository:** `redis-acl-builder` (submodule)
**Parent Repository:** `marko-projects` (container repo with multiple
submodules)

### How to Tell Which Repo You're In

**If you see these directories, you're in `redis-acl-builder` (THIS FILE):**

- `backend/`, `frontend/`, `electron/`, `docker/`, `tests/`, `venv/`
- `build_minified.py`, `README.md`, `CLAUDE.md`
- Git remote: `https://github.com/markotrapani/redis-acl-builder.git`

**If you see these directories, you're in `marko-projects` (PARENT):**

- `redis-acl-builder/`, `ldap-bind-tester/`, `gtlogs-link-generator/`,
`impact-score-calculator/`
- ONLY has `README.md`, `CLAUDE.md`, `LICENSE`, `.gitmodules`
- Git remote: `https://github.com/markotrapani/marko-projects.git`

### Critical Path Differences

**When IN redis-acl-builder submodule (pwd shows
`/marko-projects/redis-acl-builder`):**

```bash
# ✅ CORRECT
python3 scripts/build_minified.py
git status
git commit -m "message"

# ❌ WRONG - Will fail because you're already IN the submodule
cd redis-acl-builder && python3 scripts/build_minified.py
```

**When IN marko-projects parent (pwd shows just `/marko-projects`):**

```bash
# ✅ CORRECT - Need to specify submodule path
cd redis-acl-builder && python3 scripts/build_minified.py
git -C redis-acl-builder status

# ❌ WRONG - Will fail because build_minified.py is in submodule
python3 scripts/build_minified.py
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

### Git Commit Message Quality

⚠️ **CRITICAL: NEVER create meaningless version bump commit messages!**

**❌ UNACCEPTABLE commit messages:**

- `chore: Bump version to v2.9.0-beta` - Tells NOTHING about what changed
- `chore: Update version to v2.7.15-beta` - Useless for git history
- `release: v2.9.0-beta` - Missing description of changes
- `docs: Update version numbers` - What feature/fix is this for?

**✅ REQUIRED commit message format:**

- `release: v2.9.0-beta - Enterprise/OSS Mode Toggle`
- `release: v2.8.0-beta - Custom App Icons Complete`
- `fix: Resolve critical auto-update restart regression (v2.7.1-beta)`
- `docs: Update v2.9.0-beta release notes with mode toggle feature`

**Why this matters:**

- Git history should explain WHAT changed, not just that version incremented
- Meaningless commits make debugging and code archaeology impossible
- Version numbers alone don't tell contributors what features/fixes shipped
- Good commit messages help users understand release history

**Format template:**

```text
[type]: vX.X.X-beta - [Feature/Fix Summary]

[Optional: Detailed explanation of major changes]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: marko.trapani@redis.com
```

See "Version Update Commit Message Requirements" section below for full details.

### CSS/JS Build System

⚠️ **CRITICAL: ALWAYS rebuild minified CSS/JS after making changes!**

⚠️ **CRITICAL: ALWAYS review NON-MINIFIED CSS source files, NOT
styles.min.css!**

**Why**: The app uses minified CSS/JS files (`styles.min.css`, minified `.js`
files). Changes to source files won't appear until rebuilt.

**CSS Source Files** (modular, non-minified):

- `frontend/static/css/base.css` - Base styles and theme variables
- `frontend/static/css/components.css` - Component-specific styling
- `frontend/static/css/layout.css` - Layout and grid systems
- `frontend/static/css/themes.css` - Theme-specific rules
- `frontend/static/css/drag-drop.css` - Panel drag-and-drop interactions
- `frontend/static/css/resizable.css` - Container resizing functionality

**NEVER edit `styles.min.css` directly - it's auto-generated!**

**After ANY changes to CSS or JS files, ALWAYS run:**

```bash
python3 scripts/build_minified.py
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

**Why**: VS Code, Claude Code, and many developer tools run on Electron. Killing
all Electron processes will **terminate your IDE and this AI session**!

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

**CRITICAL**: When bumping version (e.g., v2.2.7-beta → v2.2.10-beta), update
ALL of these files:

### Required Files (MUST update every release)

- [ ] `README.md` - Line 3: `**Version v2.2.X-beta**`
- [ ] `README.md` - Lines 18-41: Desktop installation file names (all platforms)
- [ ] `CLAUDE.md` - Line 58: `**Version**: v2.2.X-beta`
- [ ] `electron/README.md` - Line 3: `**Status**: vX.X.X-beta` (**IMPORTANT:
  Don't forget!**)
- [ ] `backend/helpers/__init__.py` - Line with `__version__ = "2.2.X-beta"`
- [ ] `electron/package.json` - Line with `"version": "2.2.X-beta"`

### Search Command to Find All Version References

```bash
# Find all version references that might need updating
grep -r "v2\.2\.[0-9]" . --exclude-dir=.git --exclude-dir=venv \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build
```

### Post-Release Cleanup (GitHub Releases)

After creating a new release via tag push:

- [ ] Delete source code archives from GitHub release (not needed, confusing for
users)

  ```bash
  gh release delete-asset <tag> "Source code (zip)" --yes
  gh release delete-asset <tag> "Source code (tar.gz)" --yes
  ```

- [ ] Verify release notes are dynamic and version-specific (not generic)
- [ ] Keep: DMG, ZIP, EXE, AppImage, .deb, latest-*.yml files

### Artifact Cleanup Strategy

**IMPORTANT**: GitHub Actions artifacts cost $0.25/GB/month over 500MB free
tier.

**Smart Cleanup (Preserve Auto-Update)**:

- ✅ **Keep**: Artifacts for last 3 releases (needed for auto-update downloads)
- ❌ **Delete**: All other older artifacts
- 📊 **Current Usage**: Check with `gh api
repos/markotrapani/redis-acl-builder/actions/artifacts | jq '.total_count'`

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

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is a collection of Redis-related projects, with the main project being
**Redis ACL Builder** - a comprehensive web application for testing and
validating Redis Access Control List (ACL) rules with real-time command
analysis.

### Key Project: Redis ACL Builder

- **Version**: v2.9.0-beta (Enterprise/OSS Mode Toggle Release)
- **Test Coverage**: E2E: 100% (42/42 Playwright tests passing)
- **Latest Release**: Enterprise/OSS Mode Toggle (v2.9.0-beta)
- **Purpose**: Interactive web interface for parsing, testing, and validating
Redis ACL permissions
- **Redis Support**: Based on **Redis OSS** (Open Source) command sets
  - **Redis 7 OSS**: 379 commands across 21 categories (includes cluster,
  replication, latency monitoring, module management)
  - **Redis 8 OSS**: 446 commands across 29 categories (adds RediSearch, JSON,
  TimeSeries, Bloom, and other modules)
  - **Note**: Redis Enterprise restricts certain OSS commands (cluster,
  replication, dangerous ops) for security - test failures on restricted
  commands are expected behavior
- **UI Features**:
  - Advanced search system with independent fuzzy/exact modes
  - Comprehensive custom tooltips with multi-column layouts
  - Smart command highlighting (color-coded bold text)
  - Perfect anti-flash rendering
  - Theme-aware loading animations
  - Enhanced redundancy detection
  - Comprehensive 8-way resizable container system
  - Triangular corner indicators and edge resize handles
  - Drag-drop panel reordering for panels and testing sections
  - Polished tester controls with proper button positioning
  - Complete responsive design for tablet and mobile
  - Fixed z-index stacking for Electron app test result popups
- **Architecture**: Modular ES6 JavaScript (13 modules: 5 specialized + 8
  core/UI modules) + Optimized Modular CSS (6 modules) with enterprise-grade
  visual polish, real-time synchronization, and professional desktop-like
  resize experience
- **Code Organization**: Interactive ACL Builder massively refactored from
  4,286 → 3,195 lines (-1,091 lines, -25.5%) through systematic extraction
  of 1,636 lines of business logic and UI rendering into 5 specialized
  modules (ACLOptimizer, ACLCategoryManager, ACLRuleParser, ACLStateManager,
  ACLUIRenderer)
- **Monorepo Structure (v2.1.0-beta)**: Reorganized into `backend/`,
  `frontend/`, `electron/`, and `scripts/` directories for single source of
  truth supporting both web app and Electron desktop app with zero code
  duplication

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

**⚠️ CRITICAL: After editing CSS or JavaScript files, you MUST rebuild minified
assets:**

```bash
# Rebuild minified CSS and JavaScript
python3 scripts/build_minified.py

# This regenerates:
# - frontend/static/css/styles.min.css (from all .css files)
# - frontend/static/js/**/*.min.js (individual minified JS files)

# The HTML loads styles.min.css, so CSS changes won't appear until rebuilt!
```

### Building Electron Desktop App

**⚠️ CRITICAL: PyInstaller spec outputs to correct location for electron-builder:**

```bash
# 1. Rebuild minified assets (if CSS/JS changed)
python3 scripts/build_minified.py

# 2. Build backend bundle (outputs to dist/redis-acl-builder-backend/)
cd backend
pyinstaller redis-acl-builder.spec --clean --noconfirm

# 3. Build Electron app (reads from dist/)
cd ../electron
npm run build:mac
```

**Key Points:**

- PyInstaller spec outputs to project root `dist/` (not `backend/dist/`)
- Electron-builder expects bundle at `../dist/redis-acl-builder-backend`
- Always rebuild minified assets before building backend bundle
- Backend bundle includes all frontend assets (templates, CSS, JS)

**Why this is needed:**

- The app loads `styles.min.css` (minified/combined CSS) in production
- Individual CSS files (base.css, components.css, etc.) are source files only
- You MUST run `python3 scripts/build_minified.py` after ANY CSS edit for changes
  to appear
- Same applies to JavaScript - minified versions are loaded in production

### Troubleshooting Build Issues

**Problem**: Electron app missing recent changes despite rebuilding

**Solution**: Check the build pipeline:

1. Verify minified assets are updated: `grep "your-change" frontend/static/css/styles.min.css`
2. Verify backend bundle includes changes: `grep "your-change" dist/redis-acl-builder-backend/_internal/static/css/styles.min.css`
3. Verify Electron app includes changes:
   `grep "your-change" electron/dist/mac-arm64/"Redis ACL Builder.app"/Contents/Resources/dist/redis-acl-builder-backend/_internal/static/css/styles.min.css`

**Common Issues**:

- PyInstaller outputting to wrong location (should be `dist/`, not `backend/dist/`)
- Forgetting to rebuild minified assets before backend bundle
- Electron-builder using stale bundle from previous build

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

**Repository**:
<https://github.com/markotrapani/redis-acl-builder/actions>

#### Docker Builds (Web Application)

- **File**: `.github/workflows/docker-publish.yml`
- **Triggers**: Version tags without `-desktop` or `-docs` suffixes
  - `v*.*.*` (e.g., v2.0.4, v2.1.0)
  - `v*.*.*-alpha`, `v*.*.*-beta`, `v*.*.*-rc*`
- **Platforms**: linux/amd64, linux/arm64 (multi-architecture)
- **Registry**: Docker Hub
  - `markotrapani608/redis-acl-builder`
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
- **Purpose**: Quick iteration for debugging and testing (~2 minutes vs 5
  minutes)
- **Triggers**:
  - **Debug tags**: `v*.*.*-test`, `v*.*.*-debug` (e.g., `v2.1.8-test`)
  - Manual workflow dispatch
- **Builds**: macOS ARM64 only (DMG + ZIP)
- **Auto-publishes to GitHub releases** when triggered by version tags
- **Use this for**: Testing auto-updates, quick bug fixes, debugging builds
- **Tag strategy**: Use `-test` or `-debug` suffix to avoid triggering full
  multi-platform builds

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
  1. PyInstaller bundles Python backend (Flask + dependencies) to `dist/redis-acl-builder-backend/`
  2. Electron-builder packages desktop app with bundled backend from `dist/`
  3. Creates platform-specific installers
  4. Uploads artifacts (30-day retention)
  5. Creates GitHub release (on version tags)

#### Source Code Archives (Private Repository)

**GitHub UI shows "Source code (zip)" and "Source code (tar.gz)" for every
release, but these are NOT accessible:**

- Repository is **private** - source code is protected
- Source archive downloads return 404 (not accessible to public)
- Only uploaded installer assets (DMG, NSIS, AppImage) are downloadable
- No cleanup needed - private repo status prevents source code downloads
  automatically

**Release assets (downloadable):**

- ✅ DMG files (macOS installers)
- ✅ NSIS .exe (Windows installer)
- ✅ AppImage (Linux portable)
- ✅ latest-*.yml files (auto-update metadata)

#### GitHub Release Notes Format

**IMPORTANT:** Always use collapsible sections for release notes to keep them
scannable.

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
gh release edit vX.X.X-beta --repo \
  markotrapani/redis-acl-builder --notes "$(cat <<'EOF'
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
git tag v2.1.9-test-release && \
  git push origin v2.1.9-test-release  # For auto-update

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
| `-test` | Local (npm run build:mac) | No | Quick test |
| `-test-release` | ARM64 (GitHub Actions) | Yes | Auto-update testing |
| `-debug` | ARM64 + DevTools (GitHub Actions) | No | Debugging with DevTools |
| `-desktop` | Multi-platform (GH Actions) | Yes | Desktop only |
| `-beta`/`-alpha` | All platforms + Docker | Yes | Pre-release versions |
| (no suffix/GA) | All platforms + Docker | Yes | Production release |
| `-docker` | Docker only | N/A | Web app only |
| `-docs` | None | No | Documentation milestone |

## Architecture and Code Structure

### High-Level Architecture

The Redis ACL Builder follows a modular Flask architecture with clear separation
of concerns:

1. **Main Application Layer** (`app.py`)
   - Flask web server and API endpoints
   - Request handling and response formatting
   - Global parser instances for Redis 7/8
   - RESTful API with comprehensive error handling

2. **Core Logic Layer** (`helpers/`)
   - **Data Loader** (`data_loader.py`): Redis command database management
     - Contains hardcoded command/category mappings for Redis 7 (311 commands)
       and Redis 8 (446 commands)
     - All commands normalized to lowercase for consistent processing
     - Builds reverse indexes for O(1) command → categories lookup
     - **Coverage**: 100%
   - **ACL Parser** (`acl_parser.py`): Rule parsing and evaluation engine
     - Left-to-right rule precedence (Redis-compliant)
     - Command/category permission evaluation
     - Rule syntax validation and error reporting
     - **Coverage**: 95%

3. **Data Model**
   - Redis commands organized by categories (read, write, admin, dangerous,
     etc.)
   - Redis 7: 21 categories, 311 commands
   - Redis 8: 29 categories, 446 commands (includes module commands)
   - **Redis 8 Modules**: RediSearch (38 commands), RedisJSON (25), TimeSeries
   (17), Bloom (11), Cuckoo (14), CMS (6), TopK (7), T-Digest (14)
   - Category-based permissions with granular command control

### Key Design Patterns

**Command-Category Mapping**: Commands belong to multiple categories
simultaneously (e.g., `GET` is in both `@read` and `@fast` categories), enabling
flexible ACL rule composition.

**Rule Evaluation Engine**: Implements Redis ACL precedence - later rules
override earlier ones, with per-command tracking of which rule granted/denied
access.

**Version Abstraction**: Parser instances are pre-initialized for each Redis
version, allowing seamless switching between Redis 7/8 command sets.

### API Architecture

The application exposes a comprehensive REST API:

- `POST /api/parse` - Parse ACL rules and return command permissions
- `POST /api/test-command` - Test specific command access
- `POST /api/validate-rule` - Validate ACL syntax
- `POST /api/command-info` - Get command category information
- `GET /api/categories` - List available categories
- `POST /api/search-commands` - Search commands with patterns

### UI Architecture (v1.6.0 Dual Testing Interface)

The application features a sophisticated three-column interactive layout with
advanced dual testing interface:

**Dual Testing Interface:**

- **📋 Command Tester**: Real-time command testing with instant feedback,
comprehensive validation with detailed error messages, support for Redis
subcommands (pipe character notation)
- **🔑 Keyspace Tester**: NEW comprehensive key pattern testing with full glob
support (*, ?, [abc], [a-z], [^abc], escaped characters), real-time pattern
matching validation
- **Smart Result Management**: Auto-dismissible results with 5-second timeout,
manual close buttons (X), smooth fade animations (400ms with scale transforms),
consistent error formatting
- **Intelligent Button States**: Disabled states for test buttons when inputs
empty, subtle hover effects on disabled buttons, visual feedback for user
actions

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
- **NEW: Smart Action Buttons** with disabled states when ACL rule empty (bomb
emoji 💣 for clear, copy functionality)
- **NEW: Elegant scroll handling** for content overflow with styled scrollbars
- **NEW: Light/dark mode theme toggle** with smooth transitions
- **NEW: Overflow-based Layout**: Fixed height panels with overflow instead of
  expansion for better space management

**Right Column - Granted Commands (✅):**

- Interactive display of commands allowed by current ACL rule
- Collapsible sections with intelligent preview rows (first 8 commands)
- Smooth expand/collapse animations with +/- indicators
- Consistent button brightness across all interaction modes
- Click-to-revoke functionality for granular permission control

**Advanced UI Features:**

- **Real-time Validation**: Async validation with pop-up notifications for
  invalid syntax
- **Smooth Animations**: Debounced rendering with fade transitions to prevent
  flashing
- **Preview Rows**: Collapsible sections show sample commands when collapsed
- **Consistent Styling**: Unified button appearance across all interaction
  states
- **Error Handling**: Comprehensive validation for categories, commands, and
syntax
- **Redis Enterprise Compliance**: Full validation against Redis ACL
  specifications
- **Resizable Container System**: Dynamic width/height adjustment with invisible
corner drag handles, theme-aware cursor feedback, and smooth resize overlays
- **Panel Reordering**: Drag-and-drop panel reordering with visual feedback and
  smooth animations

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
├── scripts/
│   └── build_minified.py       # Asset minification (updated paths)
├── tests/
│   ├── backend/
│   │   └── setup.cfg           # Mutation testing config
│   ├── e2e/
│   └── playwright.config.js    # E2E test config (updated paths)
├── docs/
│   └── ROADMAP.md           # Product roadmap (includes desktop app details)
└── .gitignore                 # Git ignore patterns
```

### Critical Implementation Details

**Command Database**: All Redis commands and their categories are hardcoded in
`data_loader.py`. All commands are normalized to lowercase for consistent
processing. When Redis releases new versions, this file must be updated
manually.

**Permission Logic**: The ACL parser implements exact Redis semantics - empty
rules block all commands (Redis default), and rule precedence is strictly
left-to-right.

**Error Handling**: Comprehensive validation for invalid categories, unknown
commands, and malformed syntax with detailed error messages.

**Module Command Support**: Full support for Redis 8 modules including
RediSearch (ft.*), RedisJSON (json.*), TimeSeries (ts.*), and probabilistic data
structures.

### Development Guidelines

**Backend (Python):**

- All helper modules require `__init__.py` files for proper Python imports
- The test runner (`run_tests.sh`) includes extensive diagnostics and dependency
  checking
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

**⚠️ IMPORTANT: For current version, status, and roadmap information, always
check [docs/ROADMAP.md](docs/ROADMAP.md)**

All product roadmap, version history, development priorities, and feature status
information is maintained in the ROADMAP.md file to avoid duplication and keep
documentation consistent.

---

## Git Workflow Instructions

After completing significant work (bug fixes, features, documentation updates),
create commits automatically with clear, descriptive messages. Git's revert
capability makes this safe - no need to ask permission first.

**Commit Guidelines:**

- Use conventional commit format (feat:, fix:, docs:, style:, refactor:, test:,
  chore:)
- Group related changes into logical commits
- Include clear descriptions of what changed and why
- Add Claude Code attribution footer

**Commit Message Template:**

```text
[type]: [description]

[detailed explanation if needed]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: marko.trapani@redis.com
```

### Documentation Synchronization Workflow

**CRITICAL**: When creating new version releases or making significant changes,
ensure ALL documentation is updated consistently.

## ⚠️ MANDATORY VERSION UPDATE PROCESS ⚠️

**BEFORE creating any version tag, ALWAYS:**

1. **Update version numbers FIRST** (before git tag)
2. **Commit version updates with MEANINGFUL commit message**
3. **Then create and push the version tag**

### Version Update Commit Message Requirements

**❌ NEVER use meaningless commit messages like:**

- `chore: Bump version to v2.9.0-beta`
- `chore: Update version to v2.7.15-beta`
- `release: v2.9.0-beta` (no description)

These commits are useless - they don't tell anyone WHAT changed in the version.

**✅ ALWAYS use descriptive commit messages that explain WHAT changed:**

- `release: v2.9.0-beta - Enterprise/OSS Mode Toggle`
- `release: v2.8.0-beta - Custom App Icons Complete`
- `release: v2.7.0-beta - Category UI Improvements`
- `fix: Resolve critical auto-update restart regression (v2.7.1-beta)`

**Format:**

```text
release: vX.X.X-beta - [Short Feature/Fix Summary]

[Optional: Detailed explanation of major changes]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: marko.trapani@redis.com
```

This prevents the documentation drift that just occurred with v1.15.9-beta.

### Required Documentation Updates (in order)

1. **Version Updates**: Update version numbers in all files:
   - `/README.md` - Main project README (header, architecture section)
   - `/CLAUDE.md` - Project instructions and roadmap
   - **`/docker/README.md`** - Docker deployment documentation (**CRITICAL**:
     Docker Hub description pulls from this file!)
   - `/docker/deploy-beta.sh` - Deployment script version references
   - `/docker/build-multi-arch.sh` - Multi-arch build script version
   - `/docker/test-multi-arch.sh` - Multi-arch test script version
   - `/docker/MULTI-ARCH-README.md` - Multi-arch documentation examples
   - `/docker/CI-CD-SETUP.md` - CI/CD pipeline documentation
   - Any other version-specific files

2. **"What's New" Section**: **MANDATORY** - Update `/README.md` "What's New"
   section:
   - Replace previous version content with current version highlights
   - Include major features/improvements from the release
   - Group by release version (current + 1-2 previous major releases)
   - Use consistent emoji and formatting style

3. **Feature Documentation**: Update feature descriptions in:
   - **Main README**: Architecture section, feature list, roadmap
   - **CLAUDE.md**: Current Status section, Completed Features, Next Development
     Priorities
   - **Docker README**: If Docker-related changes were made

4. **Configuration Sync**: Ensure consistency across:
   - **Python version**: requirements.txt, Dockerfile, documentation references
   - **Port numbers**: Consistent across all examples (currently 7380 for dev,
   7380 for Docker)
   - **Base images**: Docker documentation matches actual Dockerfile

5. **Validation Checklist** before committing:
   - [ ] All version references updated (search for old version numbers)
   - [ ] **"What's New" section updated** to current version with release
     highlights
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

This systematic approach prevents the documentation drift that occurred with the
Docker README.md file.

**Commit Message Template:**

```text
[type]: [description]

[detailed explanation if needed]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: marko.trapani@redis.com
```

## Current Known Issues

*No known critical issues at this time.*

## 📝 Markdown Linting Standards

**CRITICAL**: All markdown files in this repository MUST pass markdownlint with
zero
errors before committing.

### Running Markdown Linting

```bash
# Check all markdown files
npx markdownlint '**/*.md' --ignore node_modules --ignore venv

# Auto-fix issues where possible
npx markdownlint --fix '**/*.md' --ignore node_modules --ignore venv
```

### Key Rules to Follow

1. **Line Length (MD013)**: Maximum 80 characters per line
   - Break long sentences at natural boundaries (periods, commas)
   - Use reference-style links for long URLs: `[text][1]` then `[1]: url` at
     bottom
   - Break long bullet points into sub-bullets or multiple lines with
     continuation
     indentation

2. **Headings**:
   - Use ATX-style headings (`#`, `##`, `###`) not underlined headings
   - Surround headings with blank lines above and below
   - Don't use emphasis (`*text*`) as headings - use proper heading syntax

3. **Lists**:
   - Surround lists with blank lines before and after
   - Use consistent list markers (prefer `-` for unordered lists)
   - Don't mix `+` and `-` in the same document

4. **Code Blocks**:
   - Always specify language for fenced code blocks: ` ```bash ` not ` ``` `
   - Surround code blocks with blank lines

5. **Tables**:
   - Always include trailing pipes `|` on table rows
   - Ensure all rows have the same number of columns

### Quick Fixes for Common Issues

**Long URLs:**

```markdown
<!-- ❌ Bad - line too long -->
See the [documentation](https://github.com/very-long-url-that-exceeds-eighty-characters/path)

<!-- ✅ Good - use reference links -->
See the [documentation][1]

[1]: https://github.com/very-long-url-that-exceeds-eighty-characters/path
```

**Long Bullet Points:**

```markdown
<!-- ❌ Bad - single long line -->
- This is a very long bullet point that contains multiple ideas and exceeds the
eighty character line limit

<!-- ✅ Good - break into sub-bullets -->
- Main point:
  - Sub-point 1
  - Sub-point 2
  - Sub-point 3

<!-- ✅ Also good - continuation lines with indentation -->
- This is a long bullet point that is broken across multiple lines with proper
  continuation indentation to stay under 80 characters
```

### Pre-Commit Checklist

Before committing markdown changes:

- [ ] Run `npx markdownlint '**/*.md' --ignore node_modules --ignore venv`
- [ ] Fix all reported issues (aim for zero errors)
- [ ] Verify changes didn't break formatting with `git diff`

### .markdownlintignore

The repository includes a `.markdownlintignore` file to exclude:

- `node_modules/` - Third-party dependencies
- `electron/node_modules/` - Electron dependencies
- `venv/` - Python virtual environment
- `dist/` and `build/` - Build outputs

These directories contain auto-generated or third-party markdown files that we
don't
control.
