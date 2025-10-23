# Redis ACL Builder - Product Roadmap

**Current Version:** v2.4.7-beta

**Status:** ✅ Production Ready - Multi-Platform Desktop App + Web/Docker
Deployment

**Last Updated:** 2025-10-22

---

## 📋 Overview

The Redis ACL Builder is a tool for creating, testing, and managing Redis Access
Control Lists (ACLs). It supports both web/Docker deployment and native desktop
applications across macOS, Windows, and Linux.

---

## 🎯 Version History

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

**Technical:** [See ELECTRON-ROADMAP.md for build system
details](./ELECTRON-ROADMAP.md)

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

- Updated all version references across README.md, CLAUDE.md,
ELECTRON-ROADMAP.md
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
- ✅ **Templates & Presets** - Quick Examples + Saved Rules with localStorage
  (v1.x)

### Next Up: Desktop App Polish (v2.5.x)

#### High Priority (User Requested)

**Custom Title Bar** - Replace default Electron chrome with themed custom design

- Match app's visual style and theme
- Professional appearance
- Custom window controls
- Estimate: 6-8 hours

#### Medium Priority (Nice to Have)

**System Tray Integration** - Optional minimize to tray

- App icon in macOS menu bar / Windows system tray
- Quick access menu
- "Hide to tray" functionality
- Estimate: 4-5 hours

### Completed Features (v2.6.x)

#### Comprehensive Test Suite Enhancements

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

#### Advanced ACL Tools

- Rule comparison mode (side-by-side diff viewer)
- ACL diff tool showing permission changes
- Import existing Redis ACL configs for editing
- Export to Redis config file format
- Rule validation history with localStorage

---

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

## 🐛 Known Issues

### Category Styling Bug - Explicitly Granted Categories with Category Exclusions

- **Node Export**: Save rules to files for
  Redis configuration
    configuration

**Description:**
When an ACL rule explicitly grants categories that have some commands blocked by
category exclusions, the granted categories showed incorrect styling and
ordering.

**Example:**
Rule: `+@read +@write -@dangerous ~*`

**Issues (Before Fix):**

- `@read` and `@write` appeared with "fully granted" styling (solid green ✓)
  instead of "partially granted" (hollow yellow ⚠)
- Explicit partial categories appeared BEFORE implicit full categories in the
  granted list (incorrect priority)
- Hovering revealed blocked commands but visual styling didn't match

**Root Cause:**

1. **Styling Issue:** The `detectPartialCategory()` method only checked for
   individual `-command` exclusions, not category-level exclusions like
   `-@dangerous`
2. **Ordering Issue:** Category rendering logic didn't properly separate
   explicit full/partial grants when ordering the display

**Fix Applied:**

1. **Enhanced detection**
       ([interactive-acl-builder.js:2453-2515](../frontend/static/js/components/interactive-acl-builder.js#L2453-L2515)):
   - Now detects both `-command` and `-@category` exclusions
   - Uses actual granted/blocked command lists from API to determine partial
     status
   - Correctly identifies when category exclusions block some commands

2. **Fixed ordering** ([interactive-acl-builder.js:1448-1469,
   1506-1559](../frontend/static/js/components/interactive-acl-builder.js)):
   - Explicit FULL grants → Implicit FULL grants → Explicit PARTIAL grants →
     Implicit PARTIAL grants
   - Applied to both code paths (with and without `@all` explicitly granted)
   - Clear visual hierarchy showing fully granted categories before partial ones

**Impact:**
Perfect visual consistency - users now see correct styling (hollow yellow ⚠ for
partial grants) and logical ordering (full grants before partial grants) that
matches the actual permissions.

---

## 🚀 GA Release Plan (v3.0.0)

**Target:** Q2 2025 (after sufficient beta testing)

### Pre-GA Checklist

**Quality Assurance:**

- [ ] 6+ months of beta testing with user feedback
- [ ] All critical bugs resolved
- [ ] Test suite at 90%+ coverage
- [ ] Performance benchmarks meet SLA (all operations <10ms)
- [ ] Security audit complete (no HIGH/CRITICAL vulnerabilities)

**Documentation:**

- [ ] Complete user guide (Getting Started, Features, Troubleshooting)
- [ ] API documentation for all endpoints
- [ ] Comprehensive FAQ
- [ ] Video tutorials (installation, basic usage, advanced features)
- [ ] Migration guide from beta to GA

**Platform Stability:**

- [ ] Windows code signing implemented (remove SmartScreen warnings)
- [ ] All platforms tested on latest OS versions
- [ ] Auto-update tested on all platforms (macOS, Windows, Linux)
- [ ] Docker image optimized and stable

**Community:**

- [ ] GitHub Discussions enabled
- [ ] Issue templates created (bug report, feature request)
- [ ] Contributing guide finalized
- [ ] Code of Conduct published
- [ ] Contributor License Agreement (if needed)

**Release Infrastructure:**

- [ ] Semantic versioning strategy documented
- [ ] Release notes automation working
- [ ] Automated changelog generation
- [ ] Deprecation policy documented
- [ ] Support policy documented (bug fixes, security updates)

### GA Release Day Tasks

1. Update version to v3.0.0 across all files
2. Create comprehensive release notes
3. Publish GitHub release with all platform binaries
4. Update Docker Hub with :latest and :stable tags
5. Announce on social media / community channels
6. Monitor for critical issues (48-hour watch period)

### Post-GA Support

- **Bug Fixes:** Critical bugs within 24 hours, high priority within 7 days
- **Security Updates:** Critical patches within 24 hours
- **Minor Releases:** Every 4-6 weeks (v3.1.0, v3.2.0, etc.)
- **Major Releases:** Annually (v4.0.0 in 2026)

---

## 📚 Documentation Strategy

### Current Documentation Status

- ✅ **README.md** - User-facing documentation and quick start
- ✅ **CLAUDE.md** - Project instructions for AI assistance
- ✅ **ROADMAP.md** - Product roadmap and version history (this file)
- ✅ **ELECTRON-ROADMAP.md** - Electron technical implementation details
- ✅ **CODE-SIGNING.md** - Code signing and notarization setup
- ✅ **CICD-WORKFLOWS.md** - CI/CD pipeline documentation
- ✅ **CONTRIBUTING.md** - Contribution guidelines

### Planned Documentation (Pre-GA)

**User Documentation:**

- [ ] **User Guide** - Comprehensive feature documentation
  - Installation and setup
  - Basic ACL rule creation
  - Advanced features (selectors, key patterns, optimization)
  - Testing commands and keyspace patterns
  - Troubleshooting common issues
  - Estimate: 8-10 hours
- [ ] **Video Tutorials** - Visual learning resources
  - Installation walkthrough (5 min)
  - Creating your first ACL rule (10 min)
  - Advanced features deep dive (15 min)
  - Estimate: 12-15 hours (scripting, recording, editing)
- [ ] **FAQ** - Common questions and answers
  - Installation issues
  - ACL syntax questions
  - Feature requests
  - Estimate: 3-4 hours

**Developer Documentation:**

- [ ] **API Documentation** - Backend API reference
  - All 12 endpoints documented
  - Request/response schemas (Pydantic models)
  - Error codes and handling
  - Examples for each endpoint
  - Estimate: 6-8 hours
- [ ] **Architecture Guide** - System design documentation
  - Frontend module structure
  - Backend architecture
  - Data flow diagrams
  - Database schema (if applicable)
  - Estimate: 5-6 hours
- [ ] **Testing Guide** - How to run and write tests
  - Unit test examples
  - Integration test patterns
  - E2E test setup
  - Property-based testing guide
  - Estimate: 4-5 hours

### GitHub Wiki Plan

**Proposed Wiki Structure:**

1. **Home** - Welcome and navigation
2. **Installation**
   - Desktop App (macOS, Windows, Linux)
   - Docker Deployment
   - Local Python Setup
3. **User Guide**
   - Getting Started
   - ACL Rule Syntax
   - Interactive Builder
   - Command Testing
   - Keyspace Testing
   - Optimization Engine
4. **Advanced Topics**
   - Rule Selectors
   - Key Permission Patterns
   - Redis 7 vs Redis 8
   - Performance Optimization
5. **API Reference**
   - Endpoint Documentation
   - Request/Response Schemas
   - Error Handling
6. **Development**
   - Contributing Guide
   - Local Development Setup
   - Testing Guide
   - Build Process
7. **Troubleshooting**
   - Common Issues
   - Platform-Specific Problems
   - Known Limitations
8. **FAQ**
   - General Questions
   - Technical Questions
   - Feature Requests

**Wiki Timeline:** Create after GA release (v3.0.0) to avoid duplicate
maintenance

---

## 🔗 Related Documentation

- **[ELECTRON-ROADMAP.md](./ELECTRON-ROADMAP.md)** - Electron technical
  implementation details
- **[CODE-SIGNING.md](./CODE-SIGNING.md)** - Code signing and notarization setup
- **[CICD-WORKFLOWS.md](./CICD-WORKFLOWS.md)** - CI/CD pipeline documentation
- **[README.md](../README.md)** - User-facing documentation and quick start

---

## 📝 Notes

This roadmap tracks high-level product features and version history.
For technical implementation details specific to the Electron desktop app, see
[ELECTRON-ROADMAP.md](./ELECTRON-ROADMAP.md).
