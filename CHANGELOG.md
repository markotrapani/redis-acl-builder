# Changelog

Release notes for Redis ACL Builder. The latest releases are also summarized in
the [README](README.md#whats-new).

> **Versioning note:** Builds tagged `v1.x`-`v2.x` with an `-alpha` or `-beta`
> suffix are pre-release builds that came before the first stable release,
> `v1.0.0`. Current releases follow `v1.0.x` and later.

## Pre-1.0 release history

### v2.9.1-beta

- **🐛 Bug Fix**: URL parameter synchronization
  - Fixed URL not updating when switching between Redis 7 and Redis 8
  - URL now correctly reflects selected Redis version (e.g., `?version=redis8`)
  - Ensures URL state stays in sync with application state

### v2.9.0-beta

- **🏢 Enterprise/OSS Mode Toggle**: New mode selector for Redis deployment types
  - Toggle between OSS (all commands) and Enterprise (cloud-restricted) modes
  - Purple gradient for OSS mode, gold gradient for Enterprise mode
  - Shows "Redis E. X" prefix when in Enterprise mode
  - Command counts update in real-time: Redis 7 (379 OSS / 305 ENT),
    Redis 8 (488 OSS / 440 ENT)
- **✨ UI Enhancements**: Polished toggle interface
  - Matches Redis Version toggle styling for consistency
  - Proper layout with toggles side-by-side and version info below
  - Text colors adapt to background (black on white pill, white on colored background)
  - No text wrapping with `white-space: nowrap` on version detail
- **🔧 Mode Switching Logic**: Seamless mode transitions
  - Preserves ACL rules when switching modes
  - Re-parses rules with new command set automatically
  - localStorage persistence and URL parameter support
  - Updates Interactive ACL Builder lists in real-time
- **✅ Test Coverage**: 100% passing (42/42 E2E tests)
  - 14 new tests specifically for Enterprise/OSS mode toggle
  - All core functionality tests updated and passing

### v2.7.0-beta

- **📦 Category Organization**: Improved category panel structure and clarity
  - Separated categories into "Data Types" and "ACL/Operational" sections
  - Section headers clearly indicate category type for better navigation
  - Maintains priority ordering within each section (explicit → implicit, full →
    partial)
- **🔍 Category Search Refinement**: Enhanced search experience
  - Category section headers automatically hide during active searches
  - Matched categories display prominently without visual clutter
  - Perfect restoration of original layout when search is cleared
  - DOM cloning ensures button positions remain stable
- **📊 Accurate Category Counts**: Fixed category count display logic
  - Count headers now accurately reflect all visible categories
  - Includes both fully and partially granted/blocked categories in totals
  - Eliminates confusing discrepancies between count and visible buttons
- **🎨 Button Layout Optimization**: Improved category button wrapping
  - Better space utilization with `flex: 0 1 auto` and `min-width: fit-content`
  - Reduced awkward gaps and orphaned buttons
  - Natural wrapping behavior that respects content width
- **🔧 Tooltip Positioning**: Smart tooltip expansion behavior
  - Tooltips stay near trigger button when expanding (instead of always jumping
    to top)
  - Falls back to viewport top only when necessary to prevent overflow
  - Improved user experience when exploring command details

### v2.3.4-beta

- **🎨 UI/UX Improvements** (from v2.3.2-beta): Version badge and update button
  repositioning
  - Moved version badge from bottom-left to top-left corner for better
    visibility
  - Positioned "Check for Updates" button to right of version badge with optimal
    spacing
  - Fine-tuned heights and padding for visual consistency
- **📦 Update Modal Cleanup** (from v2.3.2-beta): Simplified Docker upgrade
  experience
  - Removed redundant "Alternative: Pull and restart manually" section
  - Added browser refresh instruction for Docker users after upgrade
  - Reduced minified JS by 31.7% (5.71 KB → 3.90 KB)
- **📚 Documentation Consolidation**: Complete version synchronization
  - Updated all version references across README.md, CLAUDE.md, ROADMAP.md
  - Added comprehensive v2.3.2-beta and v2.3.4-beta accomplishment tracking
  - Ensures complete documentation parity between Docker and Desktop platforms

### v2.3.2-beta

- **🎨 UI/UX Improvements**: Version badge and update button repositioning
  - Moved version badge from bottom-left to top-left corner for better
    visibility
  - Positioned "Check for Updates" button to right of version badge with optimal
    spacing
  - Fine-tuned heights and padding for visual consistency
- **📦 Update Modal Cleanup**: Simplified Docker upgrade experience
  - Removed redundant "Alternative: Pull and restart manually" section
  - Added browser refresh instruction for Docker users after upgrade
  - Reduced minified JS by 31.7% (5.71 KB → 3.90 KB)

### v2.3.1-beta

- **✅ Auto-Update UX Refinement**: Improved update notification behavior
  - Fixed annoying "You have the latest version!" dialog that appeared on EVERY
    app startup
  - Silent background checks at startup (only shows dialog if update IS
    available)
  - Manual "Check for Updates..." always shows dialog for all outcomes
  - Matches standard desktop app auto-update UX patterns (Slack, VS Code, etc.)

### v2.3.0-beta

- **🔐 macOS Notarization**: Professional Apple code signing with App Store
  Connect API
  - Signed and notarized installers - no security warnings on macOS
  - Full trust chain validation for macOS Gatekeeper
- **✅ Auto-Update System**: Complete implementation with update detection and
  download
  - Automatic update checks on app launch
  - Manual update checks via application menu
  - User-friendly download and install dialogs with progress tracking
- **🚀 Production-Ready**: All platform builds working with auto-update
  infrastructure
  - macOS (ARM64 + Intel): Signed, notarized DMG installers
  - Windows: NSIS installers
  - Linux: AppImage + .deb packages
- **📦 Artifact Management**: Automated cleanup workflow to manage storage costs
  - Weekly cleanup of old build artifacts
  - Preserves last 3 releases for auto-update functionality
  - Reduces GitHub Actions storage costs by ~70%

### v2.1.9-beta - Debug Builds, Build Optimization & Release Cleanup

- **🐛 Debug Build Configuration**: Detached DevTools for debugging without UI
  disruption
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

- **🔄 Auto-Update System**: Complete auto-update infrastructure with
  electron-updater
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
- **📦 Multi-Platform Ready**: macOS (ARM64 + Intel), Windows (NSIS + ZIP), Linux
(AppImage + .deb)
- **🔐 Code Signing Infrastructure**: Ready for Apple Developer setup
  - Entitlements and notarization scripts prepared
  - Auto-updates will work automatically once code signing enabled

### v2.0.3-alpha - Enhanced Category Tooltips

- **🎨 Intelligent Command Highlighting**: Category tooltips display relevant
  commands with color-coded bold text
- **🔧 Parameter Passing Fix**: Resolved function wrapper issues preventing
  bold/color styling
- **✅ Bug Fix**: Tooltip expansion correctly displays full command list

### v2.0.0-alpha - Electron Desktop App & UI Polish

- **🖥️ Native Desktop App**: macOS desktop app with Electron + PyInstaller
  backend bundling
- **🔧 Command Sort Order**: Fixed sorting to prioritize explicit commands before
  implicit
- **💾 Rule Preservation**: Rules preserved on page refresh
- **📊 Search Enhancements**: Fuzzy relevance scoring and improved UI feedback

### v1.25.1-beta - Optimization Box Persistence & Backend Error Fix

- **🐛 Critical Backend Fix**: Fixed undefined `warnings` variable error in
  `optimize_rule` method
- **📌 Optimization Persistence**: Optimization suggestions now remain visible
  while typing

### v1.25.0-beta - Backend Category Analysis

- **🧠 Backend Category Intelligence**: Complete category analysis engine
classifies categories as fully granted, partially granted (with percentages), or
blocked based on actual command permissions
- **📊 API Enhancement**: `/api/parse` endpoint now returns comprehensive
category analysis including `granted_categories`, `partial_categories` (with
grant counts and percentages), and `blocked_categories`
- **✅ Test Suite Explosion**: Expanded from 127 → 195 passing tests (+68 new
tests, 0 skipped)
  - 12 comprehensive API-level category analysis tests
  - 19 button interaction tests validating UI logic
  - 16 @all category behavior tests
  - 8 ACL precedence validation tests
- **🧹 Code Cleanup**: Removed 16 obsolete skipped tests (-319 lines) with proper
  documentation
- **🔧 Test Fixes**: Fixed all test signature mismatches and API response
  structure assertions
- **📈 Coverage Improvement**: Test coverage increased from 82% → 85% (API
  coverage: 71% → 78%)

### v1.21.3-beta - Version Prefix Standardization

- **📐 Consistent Versioning**: Standardized version prefix usage across all
  documentation
- **🏷️ Git Tags**: All git tags use `v` prefix (v1.21.3-beta)
- **🐳 Docker Tags**: All Docker image tags use no prefix (1.21.3-beta)
- **📚 Documentation**: Clear separation between git and Docker version
  references
- **🧹 Cleanup**: Removed inconsistent `1.16.0-beta` tag, replaced with
`v1.16.0-beta`

### v1.21.2-beta - Testing Section Flash Fix

- **✨ Zero Flash Rendering**: Eliminated visual flash when testing panels are in
  custom order
- **🎯 CSS Order Properties**: Uses flexbox `order` property set by inline script
  for instant correct rendering
- **🚀 Performance**: Testing sections now render in correct order from the first
  frame
- **🔧 Smart Detection**: Only applies ordering when panels differ from default
  position

### v1.21.1-beta - Docker Build Performance Optimization

- **⚡ 42% Faster Builds**: Multi-arch Docker builds reduced from 2m 40s to ~1m
  30s
- **📦 Split Dependencies**: Separated production (`requirements-prod.txt`) and
  test (`requirements-test.txt`) dependencies
- **🚀 ARM64 Optimization**: Eliminated coverage compilation (100 seconds saved
  on ARM64 builds)
- **🔄 Coverage Upgrade**: Updated to 7.6.9 with pre-built ARM64 wheels
- **🐳 Smaller Production Image**: Docker image excludes test dependencies for
  faster deployments
- **🛠️ Dev Workflow Unchanged**: Local development still uses `pip install -r
  requirements.txt`

### v1.21.0-beta - Testing Section Drag-and-Drop Feature

- **🎨 Complete Drag-and-Drop System**: Full drag-and-drop reordering for testing
  sections
- **⋮⋮ Grabbable Handles**: Visual drag handles matching three-column panel
  design
- **✨ Smooth Animations**: Professional animations with flash prevention and
  localStorage persistence
- **🎯 Perfect UX**: Universal pointer-events approach disables all hover effects
  during drag

### v1.20.5-beta - Critical Docker Bugfix

- **🐛 CRITICAL FIX**: Added missing `models/` directory to Docker image
  (ModuleNotFoundError resolved)
- **✅ Production Ready**: Docker image now fully functional with all required
  Python modules
- **⚠️ Note**: Docker images v1.20.0 through v1.20.3 were non-functional and
  removed from Docker Hub

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

- **📋 Documentation Workflow**: Comprehensive synchronization process preventing
  version drift across releases
- **🐳 Docker Hub Prominence**: Direct repository link and quick-start deployment
  prominently featured
- **⚙️ Mandatory Process**: Systematic version update workflow ensuring
  documentation accuracy

### v1.15.8-beta - Professional Type Safety

- **🔍 Pylance Compliance**: 94% reduction in strict type checking errors across
  all modules
- **📝 Comprehensive Annotations**: Full type annotations for Flask routes,
helper functions, and data structures
- **🎯 Python 3.13 Support**: Updated to latest Python version with enhanced type
  safety features
- **✅ Zero Breaking Changes**: Maintained 100% test coverage throughout type
  safety implementation

### v1.15.7-beta - Production CI/CD Pipeline

- **🚀 Automated Docker Hub**: Multi-architecture builds (AMD64/ARM64) with
  automated publishing
- **🔒 Security Scanning**: Docker Scout CVE analysis with vulnerability
  management
- **🏷️ Smart Tagging**: Automatic version tagging with :latest, :beta, and
semver tags
- **⚡ Optimized Builds**: Docker layer caching reducing build times from 15+ to
  5-10 minutes
