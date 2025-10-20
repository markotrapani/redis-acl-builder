# Redis ACL Builder - Product Roadmap

**Current Version:** v2.4.4-beta

**Status:** ✅ Production Ready - Multi-Platform Desktop App + Web/Docker Deployment

**Last Updated:** 2025-10-20

---

## 📋 Overview

The Redis ACL Builder is a tool for creating, testing, and managing Redis Access Control Lists (ACLs). It supports both web/Docker deployment and native desktop applications across macOS, Windows, and Linux.

---

## 🎯 Version History

### v2.4.4-beta (2025-10-20)

**Release Notes Quality Improvement**
- Fixed automated release notes to filter out "Bump version" commits
- Release notes now show actual user-facing changes in summary
- Version bump commits still appear in Full Changelog but not in "What's New"
- Prevents misleading release summaries
- Better user experience when reading release notes on GitHub

**Technical:** [See ELECTRON-ROADMAP.md for build system details](./ELECTRON-ROADMAP.md)

---

### v2.4.3-beta (2025-10-20)

**Auto-Update Notification UX Refinement**
- Fixed button color to stay red (normal) instead of blue
- Only notification badge is blue with pulse animation
- More subtle and professional appearance
- Maintains consistent button styling across the app

**Technical:** CSS animation improvements, removed button glow effect

---

### v2.4.1-beta (2025-10-20)

**Automatic Update Notifications for Web/Docker**
- Silent auto-check for updates on page load (web/Docker only)
- Blue pulsing notification badge appears on "Check for Updates" button
- Button text changes to "Update Available" when update detected
- Non-intrusive 1-second delay after page load
- Perfect integration with existing manual check functionality

**Technical:** New `VersionChecker.silentCheckOnPageLoad()` method, CSS badge animations

---

### v2.4.0-beta (2025-10-20)

**Major UI/UX Enhancements**
- Enhanced Electron app info page with comprehensive feature showcase
- Redesigned layout with feature cards and better visual hierarchy
- Improved icons, spacing, and typography throughout the app
- Better user experience for both web and desktop versions

**Technical:** Info page redesign, improved CSS structure

---

### v2.3.4-beta (2025-10-20)

**Automated Release Notes Generation**
- Replaced manual README-based release notes with conventional commit parser
- Auto-categorizes commits by type: feat → ✨ New Features, fix → 🐛 Bug Fixes, etc.
- Generates formatted "What's New" sections automatically
- Successfully integrated into CI/CD workflow

**Version Synchronization Fix**
- Documented complete 6-file version update checklist
- Fixed version drift across all documentation files

**Documentation Consolidation**
- Updated all version references across README.md, CLAUDE.md, ELECTRON-ROADMAP.md
- Ensures documentation parity between Docker and Desktop platforms

---

### v2.3.2-beta (2025-10-20)

**UI/UX Improvements**
- Moved version badge from bottom-left to top-left corner for better visibility
- Positioned "Check for Updates" button to right of version badge
- Fine-tuned heights and padding for visual consistency

**Update Modal Cleanup**
- Simplified Docker upgrade experience
- Added browser refresh instruction for Docker users
- Reduced minified JS by 31.7% (5.71 KB → 3.90 KB)

**Docker Hub Integration Fix**
- Resolved "blob upload unknown to registry" error
- Successfully published v2.3.2-beta to Docker Hub

---

### v2.3.1-beta (2025-10-20)

**Auto-Update UX Refinement**
- Fixed annoying "You have the latest version!" dialog appearing on every app startup
- Silent background checks at startup (only shows dialog if update IS available)
- Manual "Check for Updates..." always shows dialog for all outcomes
- Matches standard desktop app patterns (Slack, VS Code, etc.)

**Git Tag Cleanup**
- Removed 51 incorrect version tags from parent repository

---

### v2.3.0-beta (2025-10-19)

**macOS Notarization**
- Professional Apple code signing with App Store Connect API
- Signed and notarized installers - no security warnings on macOS
- Full trust chain validation for macOS Gatekeeper

**Auto-Update System Complete**
- Automatic update checks on app launch
- Manual update checks via application menu
- User-friendly download and install dialogs with progress tracking

**Production-Ready Multi-Platform Builds**
- macOS (ARM64 + Intel): Signed, notarized DMG installers
- Windows: NSIS installers
- Linux: AppImage + .deb packages

**Check for Updates Feature (Docker/Web)**
- Added red button in top-left corner for Docker/web users
- Hidden in Electron (uses native auto-update)
- Modal shows current version, latest version, and upgrade instructions

**Artifact Management**
- Automated cleanup workflow to manage GitHub storage costs
- Preserves last 3 releases, cleans up older artifacts weekly
- Reduced storage from 6.47 GB to 2.08 GB (~70% savings)

---

### v2.2.10-beta (2025-10-19)

**Documentation Improvements**
- README scannability improvements with collapsible sections
- Updated all version references
- Parent repo README updated with desktop installation instructions

---

### v2.2.9-beta (2025-10-19)

**Workflow Reliability**
- Fixed GitHub Actions tag trigger bug (YAML syntax error from emoji)
- Desktop builds now correctly trigger ONLY on tag pushes

---

### v2.2.6-beta (2025-10-15)

**Auto-Update System Fully Working**
- Code signing enabled with Developer ID Application certificate
- Successfully tested auto-update flow (v2.2.5-beta → v2.2.6-beta)
- Artifact naming fixed with consistent hyphenation
- Draft cleanup automation in CI/CD
- Production ready for seamless automatic updates

---

### v2.2.0-beta (2025-10-14)

**Dead Code Cleanup & Optimization**
- Removed unused code (acl-state-coordinator.js)
- Cleaned 711MB of build artifacts
- Zero dead code confirmed through comprehensive analysis
- Perfect .gitignore coverage

---

### v2.1.9-beta (2025-10-14)

**Debug Builds & Build Optimization**
- Debug build configuration with detached DevTools
- 20-30% faster builds with aggressive caching
- Python pip dependency caching
- npm dependency caching

---

### v2.1.7-beta (2025-10-13)

**Multi-Platform Builds**
- macOS ARM64 + Intel builds
- Windows NSIS installer
- Linux AppImage + .deb packages
- GitHub Actions CI/CD pipeline

---

### v2.0.0 (2025-10-08)

**Initial Electron Desktop App Release**
- Converted Flask web app to Electron desktop application
- Hybrid architecture preserving 95%+ existing code
- Native file dialogs for save/load
- System tray integration
- Menu bar with standard desktop shortcuts
- localStorage persistence
- All original web features preserved

---

## 🚀 Future Roadmap

### Planned Features

**v2.5.x - Enhanced Testing & Validation**
- Live Redis connection testing
- ACL rule validation against real Redis instances
- Connection profiles for multiple Redis servers

**v2.6.x - Templates & Presets**
- Pre-built ACL templates for common use cases
- Custom template creation and sharing
- Template library with best practices

**v2.7.x - Advanced Features**
- Rule comparison mode (side-by-side)
- ACL diff tool
- Bulk operations for managing multiple ACL rules
- Export to multiple formats (JSON, YAML, TOML)

**v3.0.x - Redis Enterprise Integration**
- Direct integration with Redis Enterprise clusters
- Role-based access management
- Audit logging
- Team collaboration features

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

## 🔗 Related Documentation

- **[ELECTRON-ROADMAP.md](./ELECTRON-ROADMAP.md)** - Electron technical implementation details
- **[CODE-SIGNING.md](./CODE-SIGNING.md)** - Code signing and notarization setup
- **[CICD-WORKFLOWS.md](./CICD-WORKFLOWS.md)** - CI/CD pipeline documentation
- **[README.md](../README.md)** - User-facing documentation and quick start

---

## 📝 Notes

This roadmap tracks high-level product features and version history. For technical implementation details specific to the Electron desktop app, see [ELECTRON-ROADMAP.md](./ELECTRON-ROADMAP.md).
