# Redis ACL Builder - Product Roadmap

**Current Version:** v2.7.28-beta

**Status:** ✅ Production Ready - Multi-Platform Desktop App + Web/Docker
Deployment

**Last Updated:** 2025-11-01

---

## 📋 Overview

The Redis ACL Builder is a tool for creating, testing, and managing Redis Access
Control Lists (ACLs). It supports both web/Docker deployment and native desktop
applications across macOS, Windows, and Linux.

---

## 🎯 Version History

### v2.7.28-beta (2025-11-01) - CURRENT

#### Auto-Update System Fully Functional

- ✅ **Progress Window Close Fix** - Resolved hanging issue
  - Fixed progress window closing with `destroy()` instead of `close()`
  - Root cause: `.close()` waits for 'closed' event which wasn't firing
  - Solution: Use `.destroy()` for immediate synchronous cleanup
  - Auto-update now works seamlessly without timeouts

- ✅ **Clean Logging** - Improved log clarity
  - Flask stderr output now labeled as `[Python]` instead of `[Python Error]`
  - Persistent logs in `~/Library/Logs/Redis ACL Builder/auto-updater.log`
  - Help menu provides easy access to logs

**Status:** ✅ Tested and working - Auto-update chain v2.7.27 → v2.7.28 successful

**Technical:** Changed `closeProgressWindow()` to use `progressWindow.destroy()`
for immediate cleanup, eliminating dependency on 'closed' event in
[main.js](electron/main.js)

---

### v2.7.27-beta (2025-11-01)

#### Progress Window Close Fix Implementation

- 🔧 **BrowserWindow Lifecycle Fix** - Proper window cleanup
  - Switched from `.close()` to `.destroy()` for progress window
  - Added debug logging to track window state during close attempts
  - Researched Electron documentation confirming 'closed' event fires after
  destruction

**Technical:** Updated `closeProgressWindow()` function in
[main.js](electron/main.js) to use synchronous `destroy()` method

---

### v2.7.26-beta (2025-11-01)

#### Auto-Update Logging and Debugging

- 🔧 **File-Based Logging** - Debug auto-update event issues
  - Persistent log file survives app restarts
  - Log location: `~/Library/Logs/Redis ACL Builder/auto-updater.log`
  - Help menu items for easy log access

- ⚠️ **Known Issue** - Progress window hung on close (fixed in v2.7.27)

**Technical:** Logging system in [main.js](electron/main.js) intercepts
console methods

---

### v2.7.20-beta (2025-10-31)

#### Auto-Update Timeout Fallback

- ⚠️ **Temporary Workaround** - 10-second timeout after download completion
  - If `update-downloaded` event doesn't fire within 10 seconds, force-show
  restart dialog
  - Timeout only starts after download reaches 100%
  - Not ideal solution but prevents users from getting stuck

**Technical:** Timeout logic in download-progress handler in
[main.js](electron/main.js)

---

### v2.7.18-beta (2025-10-31)

#### Auto-Updater Error Handling

- ✅ **Prevent Crash on Auto-Updater Errors** - Fixed app crashing on startup
  - Modified unhandledRejection handler to ignore auto-updater errors
  - App won't crash if latest-mac.yml is missing or update check fails
  - Non-critical auto-updater errors no longer terminate app
  - Fixes crash loop when release builds fail or are incomplete

**Technical:** Error filtering in global unhandledRejection handler in
[main.js](electron/main.js)

---

### v2.7.13-beta (2025-10-31)

#### Docker Update Modal Button Positioning

- ✅ **Copy Button Layout** - Restored far-right button positioning
  - Reverted Copy button to use `space-between` justification
  - Button positioned at far right of modal header (not inline with text)
  - Gap restored to 15px for proper spacing
  - Text uses `flex: 1` to fill available space

- ⚠️ **Known Security Issue** - CVE-2025-6176 (brotli)
  - HIGH severity DoS vulnerability in brotli (transitive dependency)
  - No fix available yet - temporarily suppressed in Docker Scout
  - Impact: Uncontrolled resource consumption (DoS only, not data breach)
  - Action: Monitor for upstream fix and update when available
  - Suppressed in: `.github/workflows/docker-publish.yml`

**Technical:** CSS layout in
[components.css](frontend/static/css/components.css) with `justify-content:
space-between`, `gap: 15px`, restored `flex: 1` on paragraph element. CVE
suppression added to Docker Scout workflow with inline comment.

---

### v2.7.12-beta (2025-10-31)

#### Version Controls Spacing Refinement

- ✅ **Compact Version Controls** - Production build with optimized spacing
  - Built and published Docker image with gap: 8px
  - Built and published Electron apps with gap: 8px
  - All platforms include version controls flexbox refactoring
  - Clean spacing between version label and Check for Updates button

**Technical:** First production build with flexbox container layout from
v2.7.11-beta, Docker image published to Docker Hub, desktop installers
published to GitHub releases

---

### v2.7.11-beta (2025-10-31)

#### Version Controls UI Refinement

- ✅ **Flexbox Container Layout** - Simplified version indicator positioning
  - Refactored version indicator and "Check for Updates" button to use flexbox
    container
  - Eliminated JavaScript-based dynamic positioning logic
  - Pure CSS solution with `.version-controls-container` wrapper
  - Automatic spacing and alignment with flexbox properties
  - Cleaner, more maintainable code

- ✅ **Optimized Visual Spacing** - Compact button positioning
  - Reduced flexbox gap from 15px to 8px for tighter spacing
  - Better visual balance between version label and update button
  - More compact top-left corner layout
  - Consistent spacing across all themes

**Technical:** HTML structure refactoring with flexbox wrapper in
[index.html](frontend/templates/index.html) and
[info.html](frontend/templates/info.html), CSS flexbox layout in
[components.css](frontend/static/css/components.css) with `gap: 8px`, removed
JavaScript positioning code

---

### v2.7.3-beta (2025-10-29)

#### Docker Update Modal UX Improvements

- ✅ **Copy Button Repositioning** - Fixed visual overlap in update modal
  - Moved copy button outside code-block div to prevent text overlap
  - Button now appears cleanly above Docker CLI command
  - Removed absolute positioning for better visual hierarchy
  - Enhanced hover effect with lift animation and shadow
  - Improved UX for Docker users upgrading installations

**Technical:** Restructured HTML with `.upgrade-command-section` wrapper,
changed copy button from absolute to inline-block positioning, enhanced CSS
hover effects at
[frontend/static/js/version-checker.js:131-136](frontend/static/js/version-checker.js#L131-L136)
and
[frontend/static/css/components.css:3012-3053](frontend/static/css/components.css#L3012-L3053)

---

### v2.7.2-beta (2025-10-29)

#### Local Build Workflow & Documentation

- ✅ **Automated Local Build Script** - Fixed local desktop build process
  - Created `scripts/build-local-desktop.sh` for reliable local DMG builds
  - Fixed PyInstaller output path issue (`--distpath ../dist`)
  - Verified complete backend bundle with `_internal` directory
  - Build script validates bundle structure before Electron packaging
  - Eliminates manual path copying and ensures reproducible builds

**Technical:** Automated build script with validation checks, PyInstaller
`--distpath` argument fix, comprehensive build verification

---

### v2.7.1-beta (2025-10-29) - Deleted/Rolled into v2.7.2-beta

#### Critical Auto-Update Fix

- ✅ **Auto-Update Restart Fix** - Resolved critical regression in Electron app
  - Fixed restart button not closing app during auto-update flow
  - Set `app.isQuitting = true` before calling `autoUpdater.quitAndInstall()`
  - Prevents window close handler from blocking the update restart
  - Ensures smooth auto-update experience for users

**Technical:** Added `app.isQuitting = true` in `update-downloaded` event handler
before `autoUpdater.quitAndInstall()` call at [electron/main.js:424](electron/main.js#L424)

---

### v2.7.0-beta (2025-10-29)

#### Category UI & Organization Improvements

- ✅ **Category Organization** - Improved category panel structure
  - Separated categories into "Data Types" and "ACL/Operational" sections
  - Section headers clearly indicate category type (📦 Data Types vs ⚙️
    ACL/Operational)
  - Maintains priority ordering within each section (explicit → implicit,
    full → partial)
  - Better visual hierarchy and navigation

- ✅ **Category Search Refinement** - Enhanced search experience
  - Section headers automatically hide during active searches
  - Matched categories display prominently without visual clutter
  - Perfect restoration of original layout when search is cleared
  - DOM cloning ensures button positions remain stable after search

- ✅ **Accurate Category Counts** - Fixed count display logic
  - Count headers now accurately reflect all visible categories
  - Includes both fully and partially granted/blocked categories in totals
  - Eliminates confusing discrepancies between count and visible buttons
  - Fixed double-counting bug in granted/blocked category calculations

- ✅ **Button Layout Optimization** - Improved category button wrapping
  - Better space utilization with `flex: 0 1 auto` + `min-width: fit-content`
  - Reduced awkward gaps and orphaned buttons on wrapping
  - Natural wrapping behavior that respects content width

- ✅ **Tooltip Positioning** - Smart tooltip expansion behavior
  - Tooltips stay near trigger button when expanding (instead of always
    jumping to top)
  - Falls back to viewport top only when necessary to prevent overflow
  - Improved user experience when exploring command details

### v2.6.5-beta (2025-10-29)

#### Smart Keyspace Pattern Optimization

- ✅ **Backend Pattern Analysis Engine** - Intelligent redundancy detection
  - Glob-to-regex conversion for pattern matching (~*, ?, [abc], [a-z])
  - Universal pattern detection: ~* makes all patterns redundant
  - Heuristic redundancy detection: prefix matching + sample-based testing
  - 95% threshold for sample-based redundancy detection
  - RESTful API endpoint: POST /api/optimize-keyspace

- ✅ **Frontend Pattern Extraction** - ACL rule pattern parsing
  - Extracts keyspace patterns: ~*, ~user:*, ~cache:*
  - Handles permission-flagged patterns: %R~*, %W~user:*, %RW~cache:*
  - Returns cleaned patterns without ~ prefix for backend analysis

- ✅ **UI Integration** - One-click optimization
  - Yellow warning message for redundant patterns detected
  - Blue clickable suggestion with optimized rule preview
  - One-click application applies fixes automatically
  - Integrated with existing optimization suggestion system

- ✅ **Code Quality** - Debug logging cleanup
  - Removed excessive console.log statements from category rendering
  - Removed debug logs from category classification
  - Cleaner console output for production use

- ✅ **Info Page Styling** - Visual consistency improvements
  - Added matching border to header: 1px solid var(--border)
  - Added matching border to sections for visual consistency
  - Consistent border-radius and box-shadow throughout

**Technical:** backend/helpers/pattern_optimizer.py with PatternOptimizer class,
/api/optimize-keyspace endpoint, extractKeyspacePatterns() and
analyzeKeyspacePatterns() frontend methods, displayOptimizationSuggestions()
UI integration

---

### v2.6.4-beta (2025-10-29)

#### Category Organization by Type

- ✅ **Visual Category Organization** - Improved UI structure for category
  display
  - Categories now grouped into "📦 Data Types" and "⚙️ ACL/Operational"
    sections
  - Data types: hash, list, string, json, timeseries, bloom, etc.
  - ACL/Operational: read, write, admin, dangerous, fast, slow, etc.
  - Alphabetical sorting within each section
  - @all category always appears first (above both sections)
  - Consistent minimal spacing (4px) between all buttons and sections

- ✅ **SearchManager Integration** - Smart handling of category sections
  - Prevents section buttons from being reordered during search operations
  - Special @all button handling to maintain top position
  - Section headers remain visible with organized categories

- ✅ **CSS Optimization** - Consistent spacing throughout UI
  - Unified button spacing: 4px gap for categories, commands, and sections
  - Removed conflicting margin rules from themes.css
  - Clean section styling with subtle headers

**Technical:** Category classification with DATA_TYPE_CATEGORIES and
ACL_CATEGORIES constants, renderCategorySection() helper method,
SearchManager skip logic for `.category-section` elements, CSS
`gap: var(--spacing-xs)` consistency

---

### v2.6.3-beta (2025-10-28)

#### Tooltip UX Improvements (5 fixes)

- ✅ **Collapsed Tooltip Width Optimization** - Precise content-based sizing
  - Changed from fixed `min(50vw, 300px)` to `fit-content`
  - Tooltips now size precisely to their content width
  - Eliminates unnecessary horizontal whitespace

- ✅ **Expanded Tooltip Bottom Padding** - Better space utilization
  - Reduced from 40px to 12px
  - Maximizes content visibility while maintaining breathing room
  - Eliminates excessive whitespace at bottom

- ✅ **Tooltip Column Widths** - Efficient multi-column layout
  - Changed from fixed 180px to `fit-content` with 160px minimum
  - Columns now size to actual content
  - Removes excessive whitespace in third column

- ✅ **Description Text Wrapping** - Narrower, more efficient tooltips
  - Added 250px max-width constraint
  - Long descriptions wrap onto multiple lines
  - Command names remain on single lines with `white-space: nowrap`

- ✅ **Category Tooltip Text Wrapping** - Visual distinction
  - Added fine outline around command names
  - Better professional appearance and readability

**Technical:** CSS width optimizations (`fit-content`, `max-width: 250px`),
padding adjustments, `white-space: nowrap` on command names

---

### v2.6.2-beta (2025-10-28)

#### Tooltip Rendering Improvements

- ✅ **Fixed Multi-Column Tooltip Clipping** - Command names now display fully
  - Fixed visual clipping where command names were cut off mid-button
  - Changed `.tooltip-column` CSS from `overflow: hidden` to `overflow: visible`
  - Optimized `.tooltip-columns` max-height to maximize available space
  - Eliminated wasted empty space at bottom of expanded tooltips

**Technical:** CSS overflow property fix in
[components.css:2301](frontend/static/css/components.css#L2301), max-height
optimization to `calc(100vh - 180px)`

---

### v2.6.1-beta (2025-10-27)

#### Performance & UX Improvements

- ✅ **API Call Optimization** - Reduced startup API calls from 23 to
  3-4 (80-85% reduction)
  - Pre-populated category commands cache during initial data load
  - Faster app startup and reduced server load
  - Benefits all deployment methods (Electron, Docker, Web)

- ✅ **System Tray Icon Optimization** - Professional tray icon appearance
  - Fixed small, pixelated icon in menu bar
  - Implemented aggressive cropping (60% of original) for proper sizing
  - Now matches quality and size of other menu bar icons

- ✅ **System Tray Menu UX** - Improved user control over app state
  - Replaced automatic toggle behavior with context menu
  - Added "Open ACL Builder" and "Quit" options for explicit user control
  - Consistent behavior across all platforms (macOS, Windows, Linux)

**Technical:** Cache pre-population in `loadAllData()`, aggressive icon
cropping, context menu implementation

---

### v2.6.1-beta (2025-10-23)

#### Electron App Info Page Scroll Behavior Fix

- Fixed info page scroll behavior to properly hide content under title bar
- Content now scrolls smoothly under the fixed title bar area
- Background SVG pattern blends seamlessly between title bar and content
- Added visible separator line below title bar (z-index fix)
- Refined button positioning (back button and theme toggle)
- Improved visual consistency and polish

**Technical:** CSS clip-path for scroll clipping, separator line z-index
optimization, button positioning refinements

---

### v2.6.0-beta (2025-10-23)

#### Redis Command Database Accuracy Improvements

- Removed 8 internal RediSearch commands from Redis 8 command set
- Updated command counts: Redis 8 total 496 → 488 commands (-8)
- Updated RediSearch module: 38 → 32 commands (-6)
- Removed: `_ft.debug`, `_ft.config`, `ft._createifnx`, `ft._dropifx`,
  `ft._alterifnx`, `ft._dropindexifx`, `ft._aliasdelifx`, `ft._aliasaddifnx`
- Kept: `ft._list` (only usable `ft._` command)
- Updated all documentation and wiki pages with correct command counts
- All 227 backend tests passing with updated assertions

#### GitHub Wiki Documentation

- Created comprehensive 8-page GitHub Wiki (~60K of documentation)
- Wiki pages: Home, Installation, Getting Started, User Guide, API Reference,
  Development, Troubleshooting, FAQ
- Fixed all markdown linting issues across wiki and documentation
- Zero markdown linting errors across all files

#### Electron App UI Improvements

- Fixed title bar button positioning (Check for Updates button)
- Improved Electron app info page layout and styling
- Enhanced visual consistency between web and desktop versions
- Refined info page button placement (theme toggle and back button in header)
- Better visual hierarchy on info page

#### Performance Optimizations

- Implemented Tier 1 API caching for improved performance
- Optimized backend response times

#### Roadmap Documentation Consolidation

- Moved all roadmap content to docs/ROADMAP.md (single source of truth)
- Removed duplicate roadmap information from CLAUDE.md
- CLAUDE.md now references ROADMAP.md for version/status information

**Technical:** Backend command database cleanup, wiki documentation, Electron UI
polish

---

### v2.4.7-beta (2025-10-22)

#### Comprehensive Test Suite Enhancements

- Enhanced test suite to 255 total tests (227 backend + 28 E2E)
- Fixed critical Redis 8 data accuracy issues (47 missing @admin commands, 45
  missing @dangerous commands)
- Updated command counts: 379 (Redis 7 OSS), 496 (Redis 8 OSS with modules)
- All tests passing with 100% success rate

**Technical:** Property-based testing with Hypothesis, integration tests, Redis
8 command database corrections

---

### v2.4.6-beta (2025-10-22)

#### Documentation and Release Process Improvements

- Enhanced README with professional badge row and better visual hierarchy
- Added Redis Enterprise vs OSS compatibility warning
- Created comprehensive CONTRIBUTING.md guide for community contributors
- Simplified release notes format to match successful open source projects
- Fixed outdated UI feature description in README

**Technical:** Updated GitHub Actions workflows for cleaner auto-generated
release notes

---

### v2.4.5-beta (2025-10-22)

#### Category Styling and Ordering Bug Fix

- Fixed incorrect styling for explicitly granted categories with category-level
  exclusions
- Categories like `@read` in `+@read +@write -@dangerous ~*` now correctly show
  partial styling (hollow yellow ⚠)
- Enhanced `detectPartialCategory()` to detect both `-command` and `-@category`
  exclusions
- Fixed category ordering: Explicit full → Implicit full → Explicit partial →
  Implicit partial
- Applied fix to both code paths (with and without `@all` explicitly granted)
- Perfect visual consistency between styling and actual permissions

**Technical:** Enhanced detection logic in interactive-acl-builder.js, improved
category rendering priority

---

### v2.4.4-beta (2025-10-20)

#### Release Notes Quality Improvement

- Fixed automated release notes to filter out "Bump version" commits
- Release notes now show actual user-facing changes in summary
- Version bump commits still appear in Full Changelog but not in "What's New"
- Prevents misleading release summaries
- Better user experience when reading release notes on GitHub

**Technical:** Build system improvements and automated release notes

---

### v2.4.3-beta (2025-10-20)

#### Auto-Update Notification UX Refinement

- Fixed button color to stay red (normal) instead of blue
- Only notification badge is blue with pulse animation
- More subtle and professional appearance
- Maintains consistent button styling across the app

**Technical:** CSS animation improvements, removed button glow effect

---

### v2.4.1-beta (2025-10-20)

#### Automatic Update Notifications for Web/Docker

- Silent auto-check for updates on page load (web/Docker only)
- Blue pulsing notification badge appears on "Check for Updates" button
- Button text changes to "Update Available" when update detected
- Non-intrusive 1-second delay after page load
- Perfect integration with existing manual check functionality

**Technical:** New `VersionChecker.silentCheckOnPageLoad()` method, CSS badge
animations

---

### v2.4.0-beta (2025-10-20)

#### Major UI/UX Enhancements

- Enhanced Electron app info page with comprehensive feature showcase
- Redesigned layout with feature cards and better visual hierarchy
- Improved icons, spacing, and typography throughout the app
- Better user experience for both web and desktop versions

**Technical:** Info page redesign, improved CSS structure

---

### v2.3.4-beta (2025-10-20)

#### Automated Release Notes Generation

- Replaced manual README-based release notes with conventional commit parser
- Auto-categorizes commits by type: feat → ✨ New Features, fix → 🐛 Bug Fixes,
etc.
- Generates formatted "What's New" sections automatically
- Successfully integrated into CI/CD workflow

#### Version Synchronization Fix

- Documented complete 6-file version update checklist
- Fixed version drift across all documentation files

#### Documentation Consolidation

- Updated all version references across README.md, CLAUDE.md, ROADMAP.md
- Ensures documentation parity between Docker and Desktop platforms

---

### v2.3.2-beta (2025-10-20)

#### UI/UX Improvements

- Moved version badge from bottom-left to top-left corner for better visibility
- Positioned "Check for Updates" button to right of version badge
- Fine-tuned heights and padding for visual consistency

#### Update Modal Cleanup

- Simplified Docker upgrade experience
- Added browser refresh instruction for Docker users
- Reduced minified JS by 31.7% (5.71 KB → 3.90 KB)

#### Docker Hub Integration Fix

- Resolved "blob upload unknown to registry" error
- Successfully published v2.3.2-beta to Docker Hub

---

### v2.3.1-beta (2025-10-20)

#### Auto-Update UX Refinement

- Fixed annoying "You have the latest version!" dialog appearing on every app
  startup
- Silent background checks at startup (only shows dialog if update IS available)
- Manual "Check for Updates..." always shows dialog for all outcomes
- Matches standard desktop app patterns (Slack, VS Code, etc.)

#### Git Tag Cleanup

- Removed 51 incorrect version tags from parent repository

---

### v2.3.0-beta (2025-10-19)

#### macOS Notarization

- Professional Apple code signing with App Store Connect API
- Signed and notarized installers - no security warnings on macOS
- Full trust chain validation for macOS Gatekeeper

#### Auto-Update System Complete

- Automatic update checks on app launch
- Manual update checks via application menu
- User-friendly download and install dialogs with progress tracking

#### Production-Ready Multi-Platform Builds

- macOS (ARM64 + Intel): Signed, notarized DMG installers
- Windows: NSIS installers
- Linux: AppImage + .deb packages

#### Check for Updates Feature (Docker/Web)

- Added red button in top-left corner for Docker/web users
- Hidden in Electron (uses native auto-update)
- Modal shows current version, latest version, and upgrade instructions

#### Artifact Management

- Automated cleanup workflow to manage GitHub storage costs
- Preserves last 3 releases, cleans up older artifacts weekly
- Reduced storage from 6.47 GB to 2.08 GB (~70% savings)

---

### v2.2.10-beta (2025-10-19)

#### Documentation Improvements

- README scannability improvements with collapsible sections
- Updated all version references
- Parent repo README updated with desktop installation instructions

---

### v2.2.9-beta (2025-10-19)

#### Workflow Reliability

- Fixed GitHub Actions tag trigger bug (YAML syntax error from emoji)
- Desktop builds now correctly trigger ONLY on tag pushes

---

### v2.2.6-beta (2025-10-15)

#### Auto-Update System Fully Working

- Code signing enabled with Developer ID Application certificate
- Successfully tested auto-update flow (v2.2.5-beta → v2.2.6-beta)
- Artifact naming fixed with consistent hyphenation
- Draft cleanup automation in CI/CD
- Production ready for seamless automatic updates

---

### v2.2.0-beta (2025-10-14)

#### Dead Code Cleanup & Optimization

- Removed unused code (acl-state-coordinator.js)
- Cleaned 711MB of build artifacts
- Zero dead code confirmed through comprehensive analysis
- Perfect .gitignore coverage

---

### v2.1.9-beta (2025-10-14)

#### Debug Builds & Build Optimization

- Debug build configuration with detached DevTools
- 20-30% faster builds with aggressive caching
- Python pip dependency caching
- npm dependency caching

---

### v2.1.7-beta (2025-10-13)

#### Multi-Platform Builds

- macOS ARM64 + Intel builds
- Windows NSIS installer
- Linux AppImage + .deb packages
- GitHub Actions CI/CD pipeline

---

### v2.0.0 (2025-10-08)

#### Initial Electron Desktop App Release

- Converted Flask web app to Electron desktop application
- Hybrid architecture preserving 95%+ existing code
- Native file dialogs for save/load
- System tray integration
- Menu bar with standard desktop shortcuts
- localStorage persistence
- All original web features preserved

---

## 🚀 Future Roadmap

### Completed Desktop Features (v2.x)

- ✅ **System Theme Sync** - Auto-detects OS dark/light mode (v1.x - works in web
  and desktop)
- ✅ **Application Menu** - Native macOS/Windows menus with keyboard shortcuts
  (v2.0.0)
- ✅ **Auto-Update System** - Silent checks with user-friendly update dialogs
  (v2.3.0)
- ✅ **App Notarization** - Signed and notarized with Apple Developer ID for
  trusted first install (v2.3.0)
- ✅ **Custom Title Bar** - macOS draggable title bar with traffic light button
  support (v2.5.0)
- ✅ **Help Menu Enhancements** - Documentation (F1), Report Issue, View on GitHub
  (v2.6.1)
- ✅ **System Tray Integration** - Optional minimize to tray with menu bar
  icon and context menu (v2.6.1)
- ✅ **Templates & Presets** - Quick Examples + Saved Rules with localStorage
  (v1.x)

### Next Up: Desktop App Polish (v2.7.x)

**Priority Order**: Quick Wins (#5 below) → Custom App Icons → Medium Priority items

#### High Priority (User Requested)

1. **Create Custom App Icons** (Design Improvement)
   - **Current:** Using default/placeholder icon
   - **Need:** Create new custom icons that better represent the application
   - **Dock Icon Formats Needed:**
     - macOS: .icns file (1024x1024 down to 16x16)
     - Windows: .ico file (256x256 down to 16x16)
     - Linux: .png files (512x512, 256x256, 128x128, 64x64, 32x32)
   - **Tray Icon Formats Needed:**
     - macOS: 22x22 optimized for menu bar visibility
     - Windows: 16x16 optimized for system tray
     - Linux: 24x24 optimized for system tray
   - **Design Considerations:**
     - Should reflect Redis ACL Builder branding
     - Dock icon: Detailed design for larger display sizes
     - Tray icon: Simplified design optimized for small sizes (22x22)
     - Both should be recognizable and professional
   - **Implementation:**
     - Create new icon files for dock/app display
     - Create separate optimized tray icon (not just cropped version)
     - Update electron/build/icon.* files and rebuild installers

#### Quick Wins (Low Effort, High Impact)

1. **Performance Optimization** - Reduce API calls during app initialization
   - **Current:** 23 API calls during startup (1 GET + 22 POST)
   - **Optimized:** 3-4 API calls (80-85% reduction)
   - **Implementation:** Pre-populate category commands cache during
     initial data load
   - **Impact:** Faster app startup, reduced server load, better UX
   - **Status:** ✅ Completed (v2.6.1)

2. **System Tray Icon Optimization** - Professional tray icon appearance
   - **Current:** Icon appeared small and pixelated in menu bar
   - **Fixed:** Aggressive cropping (60% of original) for proper sizing
   - **Result:** Professional-looking tray icon matching other menu bar icons
   - **Status:** ✅ Completed (v2.6.1)

3. **System Tray Menu UX** - Improved user control over app state
   - **Current:** Automatic toggle behavior on tray click
   - **Improved:** Context menu with "Open ACL Builder" and "Quit" options
   - **Benefits:** User has explicit control, clearer intent, standard behavior
   - **Status:** ✅ Completed (v2.6.1)

4. **Category Tooltip Text Wrapping** - Improve command name readability
   - **Status:** ✅ Completed (v2.6.3-beta)

5. **Smart Tooltip Positioning** - Prevent jarring repositioning on expansion
   - **Status:** ✅ Completed (v2.7.0-beta)
   - Tooltips now stay near trigger button when expanding
   - Falls back to viewport top only when necessary to prevent overflow
   - Smooth UX with no jarring jumps

#### Medium Priority (Nice to Have)

**Test Windows and Linux Auto-Update** (Untested - Complex Setup Required)

- ⚠️ **macOS only tested** - v2.2.5-beta → v2.2.6-beta verified working
- ❓ Windows auto-update untested (uses .exe for updates)
- ❓ Linux auto-update untested (uses AppImage)
- **Requires:** Windows VM (Parallels/VMware) + Linux VM setup
- **Complexity:** Significant time investment for VM setup and testing
- **Alternative:** Wait for user feedback from Windows/Linux beta testers
- May require fixes to ensure cross-platform auto-update works

### Completed Features (v2.6.x)

#### Test Suite Expansion and Improvements

- ✅ **Integration Tests** (10 new tests) - Full API workflow testing
  - Tests complete user journeys across multiple endpoints
  - Validates API contracts and error handling
  - Catches integration bugs that unit tests miss
- ✅ **Property-Based Tests** (12 new tests) - Hypothesis library testing
  - Generates 1000+ randomized test cases
  - Validates critical invariants across edge cases
  - Tests API stability, optimization correctness, fuzz resistance
- ✅ **Performance Benchmarks** (11 new tests) - Sub-millisecond validation
  - All critical operations complete in sub-millisecond time
  - Proves production-ready performance
  - Sample results: Simple parsing 0.002ms, optimization 0.069ms
- ✅ **Redis 8 Data Accuracy** - Fixed 92 missing commands
  - @admin category: 22 → 69 commands (+47)
  - @dangerous category: 34 → 79 commands (+45)
  - Data sourced from actual Redis 8 Docker ACL CAT output
- ✅ **Mutation Testing Infrastructure** - Quality validation ready
  - 2,665 mutants identified across backend
  - Infrastructure ready for future CI/CD integration
- ✅ **Total Test Suite** - 255 tests (227 backend + 28 E2E), 100% pass
  rate

### Completed Features (v2.6.4-beta)

#### Feature: Category Organization by Type

**Status**: ✅ Complete

**Goal**: Split categories into two logical sections in Blocked/Granted panels

**Implementation**:

- ✅ Phase 1: Classification infrastructure (DATA_TYPE_CATEGORIES,
  ACL_CATEGORIES constants)
- ✅ Phase 2: Helper function classifyCategory()
- ✅ Phase 3: renderCategorySection() method with alphabetical sorting
- ✅ Phase 4: Integrated section rendering into renderCategoryButtons()
- ✅ Phase 5: Added subtle CSS styling for section headers
- ✅ Phase 6: SearchManager integration with skip logic
- ✅ Phase 7: CSS optimization for consistent spacing (4px gaps)

**Design**:

1. **📦 Data Type Categories** (16): bitmap, bloom, cms, cuckoo, geo, hash,
   hyperloglog, json, list, pubsub, set, sortedset, stream, string, tdigest,
   timeseries, topk
2. **⚙️ ACL/Operational Categories** (13): admin, blocking, connection,
   dangerous, fast, keyspace, read, scripting, search, slow, transaction, write

**Benefits**: Better visual organization, easier category discovery, clearer
separation between data structures and operations

**Remaining Time**: 1-2 hours

---

### Future Features (v2.7.x+)

#### Advanced ACL Tools

- Rule comparison mode (side-by-side diff viewer)
- ACL diff tool showing permission changes
- Import existing Redis ACL configs for editing
- Export to Redis config file format
- Rule validation history with localStorage

---

## 🏗️ Desktop App Architecture

### Hybrid Electron + Python Architecture

The desktop app uses a hybrid architecture that preserves 95%+ of existing code:

```text
┌─────────────────────────────────────────┐
│         Electron Main Process           │
│  (Node.js - main.js)                    │
│                                         │
│  1. Create BrowserWindow                │
│  2. Spawn Python child process          │
│  3. IPC communication with renderer     │
│  4. Handle window lifecycle             │
│  5. File system dialogs                 │
│  6. Auto-updates                        │
└─────────────────────────────────────────┘
              │
              │ spawns
              ▼
┌─────────────────────────────────────────┐
│      Python Child Process               │
│  (Flask Backend on localhost:PORT)      │
│                                         │
│  - helpers/data_loader.py               │
│  - helpers/acl_parser.py                │
│  - All 12 API endpoints                 │
│  - Pydantic validation                  │
│  - UNCHANGED from v1.x!                 │
└─────────────────────────────────────────┘
              ▲
              │ fetch() API calls
              │
┌─────────────────────────────────────────┐
│      Electron Renderer Process          │
│  (Chromium - index.html)                │
│                                         │
│  - All existing JS modules (23 files)   │
│  - All existing CSS modules (6 files)   │
│  - localStorage → works identically!    │
│  - fetch() → calls localhost Flask      │
│  - UNCHANGED from v1.x!                 │
└─────────────────────────────────────────┘
```

### Code Reuse Analysis

- **Unchanged:** 95% (10,000+ lines) - All Python backend, JavaScript modules, CSS
- **New:** 4% (~550 lines) - Electron wrapper, build configuration, title bar
- **Modified:** 1% (~70 lines) - HTML template, CSS additions

## 📊 Platform Support

### Desktop Applications

- ✅ macOS (ARM64 + Intel) - Signed & Notarized
- ✅ Windows (x64) - NSIS Installer
- ✅ Linux (x64) - AppImage + .deb

### Web/Docker Deployment

- ✅ Docker multi-arch (AMD64 + ARM64)
- ✅ Local Python/Flask deployment
- ✅ Automatic update notifications

---

## 🚀 GA Release Plan (v3.0.0)

**Target:** Q2 2025 (after sufficient beta testing)

**📄 Full Details:** [GA-RELEASE-PLAN.md](./GA-RELEASE-PLAN.md)

### Quick Summary

**Pre-GA Requirements:**

- [ ] 6+ months of beta testing with user feedback
- [ ] Test suite at 90%+ coverage
- [ ] Security audit complete (no HIGH/CRITICAL vulnerabilities)
- [ ] Complete user documentation (guide, API reference, FAQ)
- [ ] All platforms tested and stable (macOS, Windows, Linux, Docker)
- [ ] Community infrastructure ready (Discussions, issue templates)

**Release Day Tasks:**

1. Create v3.0.0 tag and trigger builds
2. Publish GitHub release with all binaries
3. Update Docker Hub (:latest, :stable tags)
4. Public announcements (GitHub, social media, Reddit, HN)
5. Monitor for critical issues (48-hour watch period)

**Post-GA Support:**

- Critical bugs: 24-hour fix target
- Security updates: 24-hour patch target
- Minor releases: Every 4-6 weeks
- Major releases: Annually

**📖 See [GA-RELEASE-PLAN.md](./GA-RELEASE-PLAN.md) for complete checklist and
timeline**

---

## 📚 Documentation Strategy

### Current Documentation

- ✅ **README.md** - User-facing documentation and quick start
- ✅ **CLAUDE.md** - Project instructions for AI assistance
- ✅ **ROADMAP.md** - Product roadmap and version history (this file)
- ✅ **CODE-SIGNING.md** - Code signing and notarization setup
- ✅ **CICD-WORKFLOWS.md** - CI/CD pipeline documentation
- ✅ **CONTRIBUTING.md** - Contribution guidelines
- ✅ **PERFORMANCE-PLAN.md** - Performance optimization roadmap
- ✅ **GA-RELEASE-PLAN.md** - GA release checklist
- ✅ **WIKI-PLAN.md** - GitHub Wiki structure plan

### Planned Documentation (Pre-GA)

**📄 Full Details:** [WIKI-PLAN.md](./WIKI-PLAN.md)

**Quick Summary:**

- [ ] **User Guide** - Installation, features, troubleshooting (8-10 hours)
- [ ] **Video Tutorials** - Installation, basic usage, advanced features
  (12-15 hours)
- [ ] **FAQ** - Common questions and answers (3-4 hours)
- [ ] **API Documentation** - All 12 endpoints with examples (6-8 hours)
- [ ] **Architecture Guide** - System design and data flow (5-6 hours)
- [ ] **Testing Guide** - How to run and write tests (4-5 hours)

### GitHub Wiki Plan

**📄 Full Details:** [WIKI-PLAN.md](./WIKI-PLAN.md)

**Timeline:** Create after GA release (v3.0.0) to avoid duplicate maintenance

**8-Section Structure:**

1. Home - Welcome and navigation
2. Installation - All platforms (Desktop, Docker, Local Python)
3. User Guide - Complete feature documentation
4. Advanced Topics - Selectors, patterns, versioning
5. API Reference - Complete endpoint documentation
6. Development - Contributing, testing, architecture
7. Troubleshooting - Common issues and solutions
8. FAQ - Quick answers to common questions

**Implementation:** 48-64 hours total (3 phases over 8 weeks post-GA)

---

## 🔗 Related Documentation

- **[CODE-SIGNING.md](./CODE-SIGNING.md)** - Code signing and notarization setup
- **[CICD-WORKFLOWS.md](./CICD-WORKFLOWS.md)** - CI/CD pipeline documentation
- **[README.md](../README.md)** - User-facing documentation and quick start

---

## 📝 Notes

This roadmap tracks high-level product features, version history, and desktop
app architecture.
All Electron-specific technical details have been consolidated into this single
roadmap file.
