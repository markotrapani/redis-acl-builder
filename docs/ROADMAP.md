# Redis ACL Builder - Product Roadmap

**Current Version:** v2.6.3-beta

**Status:** ✅ Production Ready - Multi-Platform Desktop App + Web/Docker
Deployment

**Last Updated:** 2025-10-28

---

## 📋 Overview

The Redis ACL Builder is a tool for creating, testing, and managing Redis Access
Control Lists (ACLs). It supports both web/Docker deployment and native desktop
applications across macOS, Windows, and Linux.

---

## 🎯 Version History

### v2.6.3-beta (2025-10-28)

#### Tooltip UX Improvements

- ✅ **Category Tooltip Text Wrapping Fix** - Improved command name readability
  - Command names no longer wrap when tooltip is compressed against window edge
  - Added `white-space: nowrap` for cleaner visual appearance
  - Added fine outline around each command name to visually distinguish them
  - Better professional appearance and readability

**Technical:** CSS `white-space: nowrap` on command name elements, subtle
border styling for visual distinction

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
   - **Current:** Tooltip calculates position based on collapsed height, then
     repositions when expanded, causing it to jump from below to above button
   - **Need:** Calculate final position anticipating expanded height before
     initial display
   - **Implementation:** Detect if expanded tooltip will fit below button,
     if not position above from the start
   - **Benefits:** Smooth UX, tooltip stays near mouse cursor, no jarring jumps
   - Estimate: 1-2 hours

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

### Future Features (v2.7.x+)

#### Category Display Improvements

**Category Organization by Type** - Split categories into logical sections

- Separate categories into two vertical sections in both Blocked/Granted panels:
  1. **Data Type Categories**: set, hash, string, sortedset, list, stream, etc.
  2. **ACL Categories**: fast, slow, admin, dangerous, read, write, etc.
- Better visual organization and easier category discovery
- Clearer separation between data structure permissions and operational
  permissions
- Estimate: 2-3 hours

#### Smart Keyspace Pattern Optimization

**Keyspace Pattern Redundancy Detection** - Detect and simplify redundant key
patterns

- Analyze keyspace access patterns (`~pattern`) for redundancy
- Detect when one pattern makes another redundant (e.g., `~*` makes `~abc:*`
  redundant)
- Show optimization suggestions similar to command/category optimization
- Examples:
  - `~* ~abc:*` → `~*` (saves 1 term)
  - `~user:* ~user:123:*` → `~user:*` (saves 1 term)
  - `~* ~cache:*` → `~*` (universal pattern covers all)
- Backend pattern analysis with glob matching logic
- Frontend integration with existing optimization UI
- Estimate: 4-6 hours

#### Docker Update Modal UX Improvements

**Copy Button Positioning** - Improve upgrade command copy experience

- Move copy button out of code block and position it above the Docker CLI
  command
- Better UX for copying upgrade commands
- Prevents button from being part of the command text
- Consistent with modern CLI documentation patterns
- Estimate: 15-30 minutes

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
