# Pre-Release Manual Testing Checklist

**Release Version:** _____________
**Test Date:** _____________
**Tester:** _____________

> **Note:** Functional tests (mode switching, category detection, URL parameters, etc.) are covered by automated Playwright tests (65/65 passing). This checklist focuses on **manual-only items** that require human judgment and cannot be easily automated.

---

## ✅ Automated Test Status

Run automated tests **before** manual testing:

```bash
npx playwright test --config=tests/playwright.config.js
```

- [ ] All 65 Playwright E2E tests passing (100%)
- [ ] No console errors reported by automated tests
- [ ] All test screenshots/videos reviewed (if any failures)

---

## 🎨 Visual Quality & UX Feel

### Color & Gradients

- [ ] **OSS mode toggle** - Purple gradient looks **vibrant and professional** (not washed out)
- [ ] **Enterprise mode toggle** - Gold gradient looks **premium and polished** (not garish)
- [ ] **Partial category styling** - Hollow yellow/orange border is **clearly distinguishable** from solid blocked categories
- [ ] **Color contrast** - All text is **easily readable** against backgrounds
- [ ] **Dark/light theme** - Colors work well in both themes, no jarring transitions

### Typography & Layout

- [ ] **Font sizes** - All text is **comfortable to read** (not too small/large)
- [ ] **Line spacing** - Text doesn't feel **cramped or too loose**
- [ ] **Alignment** - Elements are **visually aligned** (toggles, labels, counts)
- [ ] **Spacing** - White space feels **balanced and intentional**
- [ ] **Version label** - "Redis E. 7" prefix is **bold and noticeable** in Enterprise mode

### Animation & Smoothness

- [ ] **Mode toggle transition** - Switches **smoothly** without jarring jumps
- [ ] **Category expand/collapse** - Animations feel **fluid and responsive**
- [ ] **Panel updates** - Granted/blocked lists update **without visual glitches**
- [ ] **Loading states** - API calls show appropriate feedback (no frozen UI)
- [ ] **Hover effects** - Category buttons respond **smoothly** to mouse hover

### Responsive Design

- [ ] **Desktop (1920x1080)** - Layout is **spacious and uncluttered**
- [ ] **Laptop (1440x900)** - All elements visible, **no awkward wrapping**
- [ ] **Tablet (768x1024)** - Toggles stack vertically or adapt **gracefully**
- [ ] **Mobile (375x667)** - Touch targets are **large enough**, text is **readable**

---

## 🌐 Cross-Browser Visual Testing

> **Note:** Automated tests only run in Chromium. Manual testing ensures visual consistency across browsers.

### Firefox

- [ ] Open <http://localhost:5001> in **Firefox**
- [ ] Purple/gold gradients render **correctly** (no color banding)
- [ ] Partial category hollow styling **matches Chromium** appearance
- [ ] All fonts render **clearly** (no substitution issues)
- [ ] Flexbox layouts **don't break** (toggles, panels, buttons)
- [ ] localStorage persistence works (mode/theme/version)

### Safari (macOS only)

- [ ] Open <http://localhost:5001> in **Safari**
- [ ] Purple/gold gradients render **correctly** (Safari can have gradient issues)
- [ ] Partial category styling **visible and clear**
- [ ] No font rendering issues (Safari renders fonts differently)
- [ ] CSS transforms/transitions work **smoothly**
- [ ] localStorage persistence works

### Edge (if different from Chrome)

- [ ] Verify visual appearance in **Edge** (usually same as Chrome, but check)
- [ ] No unexpected styling differences

---

## 🖥️ Desktop App Experience (Electron)

> **Note:** Desktop app testing requires building and installing the app locally or downloading from GitHub releases.

### Installation & First Launch

- [ ] **macOS** - DMG installs without errors, app is **signed and notarized** (no security warnings)
- [ ] **Windows** - NSIS installer runs smoothly, app appears in **Start Menu**
- [ ] **Linux** - AppImage runs without errors, .deb package installs correctly
- [ ] First launch opens to **clean state** (no localStorage from web version)
- [ ] App icon appears correctly in **dock/taskbar**

### Native Integration

- [ ] **Window management** - Resize, minimize, maximize work smoothly
- [ ] **Menu bar** - All menu items functional (File, Edit, View, etc.)
- [ ] **Keyboard shortcuts** - Cmd+Q (macOS) / Alt+F4 (Windows) quits app
- [ ] **System tray** - If implemented, icon appears and functions correctly
- [ ] **Multi-window** - Opening multiple instances works (if supported)

### Auto-Update Flow

- [ ] Install **previous version** (e.g., v2.9.0-beta)
- [ ] Launch app, check for updates
- [ ] Update notification appears with **correct version** (v2.9.1-beta)
- [ ] Click "Update Now" - download starts with **progress indicator**
- [ ] After download, app **restarts automatically** or prompts to restart
- [ ] New version launches successfully, mode toggle works
- [ ] User data preserved (ACL rules, settings, localStorage)

### Offline Functionality

- [ ] Disconnect from internet
- [ ] Launch desktop app - should work **fully offline**
- [ ] All features function (parsing, testing, mode switching)
- [ ] Only auto-update check should fail gracefully

---

## ♿ Accessibility Testing

> **Note:** Basic keyboard navigation is covered by automated tests. This focuses on screen readers and advanced accessibility.

### Screen Reader Testing

- [ ] **macOS VoiceOver** (Cmd+F5) - Navigate app with screen reader
  - [ ] Mode toggle announced correctly ("OSS mode" / "Enterprise mode")
  - [ ] Category buttons read with status ("@read category, granted")
  - [ ] Partial categories announced ("@hyperloglog category, partially blocked")
  - [ ] Command counts read aloud ("Redis 7, 379 commands")
  - [ ] No unlabeled buttons or inputs

- [ ] **Windows NVDA/JAWS** (if available) - Test with Windows screen reader
  - [ ] All interactive elements have **proper labels**
  - [ ] Navigation follows **logical tab order**

### Keyboard Navigation

- [ ] **Tab order** - Pressing Tab moves through elements **in logical order**
- [ ] **Focus indicators** - Currently focused element has **clearly visible outline**
- [ ] **Enter/Space** - Activates buttons (mode toggle, category buttons)
- [ ] **Escape key** - Closes modals/dialogs (if any)
- [ ] **No keyboard traps** - Can navigate out of all sections

### Color Contrast

- [ ] **WCAG AA compliance** - Use browser DevTools or axe DevTools to check contrast ratios
- [ ] Purple text on white background: **Ratio ≥ 4.5:1**
- [ ] Gold text on white background: **Ratio ≥ 4.5:1**
- [ ] Partial category hollow styling: **Border contrast sufficient**

---

## 🔍 Exploratory Testing

> **Note:** Try unexpected things, look for bugs, test creative scenarios automated tests don't cover.

### Edge Cases

- [ ] Enter **extremely long ACL rule** (1000+ characters) - Does UI handle it gracefully?
- [ ] Grant **all categories** (`+@all`) - Does app handle 379/488 granted commands?
- [ ] Block **all categories** (`-@all`) - Does UI show all categories as blocked correctly?
- [ ] Mix **many overlapping categories** (`+@read +@write +@admin +@dangerous`) - Performance OK?
- [ ] Switch modes/versions **very rapidly** (10+ times) - Any visual glitches or race conditions?

### Real-World ACL Rules

Test with actual production ACL rules:

- [ ] **Simple production rule** - e.g., `+@read ~cache:* -flushall -flushdb`
- [ ] **Complex multi-user rule** - e.g., `+@admin ~admin:* -acl -cluster -module`
- [ ] **Enterprise-restricted rule** - Use Enterprise mode with cloud-restricted commands
- [ ] **Keyspace patterns** - Complex patterns like `~user:*:sessions ~cache:*:data`

### Performance Testing

- [ ] **Large ACL rules** - 50+ individual commands granted - UI responsive?
- [ ] **Rapid category clicks** - Click 10+ categories quickly - No lag or freezing?
- [ ] **Network latency simulation** - Use Chrome DevTools to throttle network to "Slow 3G"
  - [ ] App shows loading states appropriately
  - [ ] No timeout errors or crashes

### Browser DevTools Checks

- [ ] Open **Console** - No JavaScript errors during normal operation
- [ ] Open **Network** - No failed API requests (404, 500 errors)
- [ ] Open **Performance** - Record interaction, check for long tasks (> 50ms)
- [ ] Open **Memory** - No obvious memory leaks after extended use

---

## 📊 Final Checks

### Documentation

- [ ] **README** - Installation instructions match current version
- [ ] **CHANGELOG** - All new features/fixes documented for this release
- [ ] **GitHub Release Notes** - Draft release notes accurate and complete

### Release Artifacts

- [ ] **GitHub Actions** - All workflows passed (Docker build, Electron packaging)
- [ ] **Docker Hub** - New image tagged and pushed (`latest`, `v2.9.1-beta`)
- [ ] **GitHub Releases** - All installers uploaded (DMG, EXE, AppImage, .deb)
- [ ] **Source code archives** - DELETED (users should use installers, not source)

### Smoke Test (5 Minutes)

Quick sanity check on each platform:

- [ ] **Web (localhost:5001)** - Mode toggle, partial detection, all features work
- [ ] **Desktop (macOS)** - Launch app, basic features work
- [ ] **Desktop (Windows)** - Launch app, basic features work
- [ ] **Desktop (Linux)** - Launch app, basic features work
- [ ] **Docker** - Pull image, run container, access <http://localhost:7380>

---

## ✅ Sign-Off

- [ ] **All critical manual tests passed**
- [ ] **All automated tests passed (65/65)**
- [ ] **No P0/P1 bugs found during testing**
- [ ] **Visual quality meets release standards**
- [ ] **Cross-browser compatibility verified**
- [ ] **Desktop app experience polished**
- [ ] **Accessibility requirements met**

**Ready for production release:** [ ] Yes [ ] No

**Tester Signature:** _____________
**Date:** _____________

---

## 🐛 Bugs Found

_Document any issues discovered during manual testing:_

| Priority | Issue | Repro Steps | Status |
|----------|-------|-------------|--------|
| P0 (Critical) | | | |
| P1 (High) | | | |
| P2 (Medium) | | | |
| P3 (Low) | | | |

---

## 📝 Notes

_Any additional observations, feedback, or suggestions:_
