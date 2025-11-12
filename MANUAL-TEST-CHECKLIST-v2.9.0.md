# Manual Testing Checklist - v2.9.0-beta: Enterprise/OSS Mode Toggle

**Test Date:** _____________
**Tester:** _____________
**Environment:** [ ] Web (localhost:5001) [ ] Desktop App [ ] Docker

---

## 🎨 UI/Visual Tests

### Mode Toggle Display

- [ ] Toggle switch appears next to Redis Version selector
- [ ] Toggle has two states: OSS (left) and Enterprise (right)
- [ ] **OSS Mode (default):**
  - [ ] Left pill shows **purple gradient** background
  - [ ] Text reads "OSS" in **white** on purple
  - [ ] Right pill shows **white** background with black text
  - [ ] Version label shows "Redis X" (no prefix)
- [ ] **Enterprise Mode:**
  - [ ] Right pill shows **gold gradient** background (#FFD700 to #FFA500)
  - [ ] Text reads "Enterprise" in **white** on gold
  - [ ] Left pill shows **white** background with black text
  - [ ] Version label shows "**Redis E. X**" (bold "E." prefix)

### Command Count Display

- [ ] **Redis 7 + OSS Mode:** Shows "379 commands"
- [ ] **Redis 7 + Enterprise Mode:** Shows "305 commands"
- [ ] **Redis 8 + OSS Mode:** Shows "488 commands"
- [ ] **Redis 8 + Enterprise Mode:** Shows "440 commands"
- [ ] Command count updates **immediately** when toggling mode
- [ ] Command count updates when switching Redis version

### Layout & Positioning

- [ ] Mode toggle and Redis version toggle side-by-side (horizontal layout)
- [ ] Command count appears below toggles, centered
- [ ] Version info text doesn't wrap (`white-space: nowrap`)
- [ ] Proper spacing between toggles (gap: 1rem)
- [ ] Responsive on tablet/mobile (stacks properly)

---

## ⚡ Functionality Tests

### Mode Switching

- [ ] Click OSS → Enterprise: Mode changes immediately
- [ ] Click Enterprise → OSS: Mode changes back immediately
- [ ] Mode change triggers ACL rule re-parsing
- [ ] Granted/blocked command lists update in real-time
- [ ] No page reload required
- [ ] No flash or visual glitches during transition

### ACL Rule Preservation

- [ ] Enter ACL rule in OSS mode
- [ ] Switch to Enterprise mode
- [ ] **ACL rule text preserved** (not cleared)
- [ ] Rule re-parsed with Enterprise command set
- [ ] Switch back to OSS mode
- [ ] Rule still preserved, re-parsed with OSS commands

### Command Filtering

- [ ] **OSS Mode includes:**
  - [ ] CLUSTER commands (CLUSTER INFO, CLUSTER NODES, etc.)
  - [ ] MODULE commands (MODULE LOAD, MODULE UNLOAD, etc.)
  - [ ] Replication commands (REPLICAOF, ROLE, etc.)
  - [ ] All dangerous commands (FLUSHALL, FLUSHDB, SHUTDOWN, etc.)
- [ ] **Enterprise Mode excludes:**
  - [ ] CLUSTER commands (not in granted/blocked lists)
  - [ ] MODULE commands (not available)
  - [ ] Some replication commands (restricted)
  - [ ] Some dangerous commands (restricted)

### State Persistence

- [ ] Set mode to Enterprise
- [ ] Refresh page (F5 or Cmd+R)
- [ ] Mode still set to Enterprise after reload
- [ ] Set mode to OSS
- [ ] Refresh page
- [ ] Mode still set to OSS after reload

### URL Parameter Support

- [ ] Navigate to `?mode=oss`
  - [ ] OSS mode activated
  - [ ] Purple gradient visible
- [ ] Navigate to `?mode=enterprise`
  - [ ] Enterprise mode activated
  - [ ] Gold gradient visible
- [ ] URL parameter overrides localStorage
- [ ] Change mode → URL updates with new mode

---

## 🔄 Integration Tests

### Interactive ACL Builder

- [ ] Grant a category in OSS mode (e.g., `+@admin`)
- [ ] Verify CLUSTER commands appear in granted list
- [ ] Switch to Enterprise mode
- [ ] CLUSTER commands disappear from granted list
- [ ] Category still shows as granted (but fewer commands)
- [ ] Switch back to OSS mode
- [ ] CLUSTER commands reappear

### Command Tester

- [ ] **In OSS Mode:**
  - [ ] Test `CLUSTER INFO` → Shows as **Granted** or **Blocked** based on ACL
  - [ ] Result appears correctly
- [ ] **Switch to Enterprise Mode:**
  - [ ] Test `CLUSTER INFO` → Should show **error or blocked** (command not in set)
  - [ ] Test valid Enterprise command (e.g., `GET`) → Works normally

### Keyspace Tester

- [ ] Enter keyspace pattern (e.g., `~*`)
- [ ] Switch between OSS/Enterprise modes
- [ ] Keyspace test results remain consistent
- [ ] No unexpected errors

### Search Functionality

- [ ] **In OSS Mode:**
  - [ ] Search "CLUSTER" in blocked/granted panels
  - [ ] CLUSTER commands appear in search results
- [ ] **Switch to Enterprise Mode:**
  - [ ] Search "CLUSTER" in panels
  - [ ] No CLUSTER commands in results (filtered out)

---

## 🧪 Edge Cases & Error Handling

### Empty/Invalid ACL Rules

- [ ] Mode toggle works with **no ACL rule** entered
- [ ] Mode toggle works with **invalid ACL rule**
- [ ] Error messages display correctly in both modes
- [ ] Switching modes doesn't crash app

### Redis Version + Mode Combinations

- [ ] Test all 4 combinations:
  - [ ] Redis 7 + OSS
  - [ ] Redis 7 + Enterprise
  - [ ] Redis 8 + OSS
  - [ ] Redis 8 + Enterprise
- [ ] Command counts correct for each combination
- [ ] No JavaScript errors in console

### Rapid Mode Switching

- [ ] Toggle OSS → Enterprise → OSS → Enterprise rapidly (5x fast)
- [ ] App remains responsive
- [ ] No race conditions or stuck states
- [ ] Final mode reflects last toggle

### Browser Compatibility

- [ ] Test in **Chrome/Edge** (Chromium)
- [ ] Test in **Firefox**
- [ ] Test in **Safari** (macOS only)
- [ ] All visual styles render correctly
- [ ] localStorage persistence works

---

## 📱 Responsive Design Tests

### Desktop (1920x1080)

- [ ] Toggle layout perfect (side-by-side)
- [ ] No wrapping or overflow
- [ ] Proper spacing and alignment

### Tablet (768x1024)

- [ ] Toggle layout adapts (may stack vertically)
- [ ] Still functional and usable
- [ ] Text readable

### Mobile (375x667)

- [ ] Toggle stacks vertically or adapts
- [ ] Touch targets large enough (min 44x44px)
- [ ] No horizontal scrolling

---

## 🖥️ Desktop App Specific Tests

### Electron App

- [ ] Mode toggle renders correctly in Electron
- [ ] localStorage works in Electron context
- [ ] No preload.js security errors
- [ ] Mode persists across app restarts

### Auto-Update

- [ ] Previous app version updates to v2.9.0-beta
- [ ] Mode toggle appears after update
- [ ] No migration issues from older versions

---

## ✅ Final Checks

- [ ] All E2E tests passing (42/42)
- [ ] No JavaScript console errors
- [ ] No visual glitches or flashing
- [ ] Feature matches design specs
- [ ] Documentation updated (README, ROADMAP, wiki)
- [ ] GitHub release notes accurate

---

## 🐛 Bugs Found

_Document any issues discovered during testing:_

1.
2.
3.

---

## 📝 Notes

_Any additional observations or feedback:_

---

**Sign-off:**

- [ ] All critical tests passed
- [ ] Ready for production release

**Tester Signature:** _____________
**Date:** _____________
