# Manual Testing Checklist - Redis ACL Builder

**Test Date:** _____________
**Tester:** _____________
**Environment:** [ ] Web (localhost:5001) [ ] Desktop App [ ] Docker

---

## 🆕 Partial Category Detection Tests

### Cross-Category Command Grant Detection

- [ ] **Test Case 1: @admin granting commands from @hyperloglog**
  - [ ] Clear ACL rule, start fresh
  - [ ] Enter rule: `+@admin`
  - [ ] Verify @hyperloglog appears in **Blocked Commands** panel
  - [ ] Check @hyperloglog styling: Should show **hollow yellow/orange** (partial)
  - [ ] Tooltip should indicate "partially blocked" or similar
  - [ ] Expand @hyperloglog category
  - [ ] Verify some commands are **granted** (e.g., pfdebug, pfselftest)
  - [ ] Verify some commands are **blocked** (remaining hyperloglog commands)

- [ ] **Test Case 2: Multiple overlapping categories**
  - [ ] Clear ACL rule
  - [ ] Enter rule: `+@read +@write`
  - [ ] Check categories with partial grants (e.g., @admin, @dangerous)
  - [ ] Verify partial categories show **hollow styling** (not solid)
  - [ ] Verify fully blocked categories show **solid styling**
  - [ ] Verify granted categories appear in Granted Commands panel

- [ ] **Test Case 3: Available category → Partial detection**
  - [ ] Start with minimal rule: `+@read`
  - [ ] Grant additional category: `+@admin`
  - [ ] Check if previously "fully available" categories now show as "partial"
  - [ ] Example: @hyperloglog was fully blocked, now shows as partial
  - [ ] Verify styling changes from solid to hollow yellow/orange

### Visual Styling Verification

- [ ] **Partial categories show hollow styling:**
  - [ ] Background: Transparent or light fill
  - [ ] Border: Yellow/orange dashed or dotted border
  - [ ] Icon: Warning triangle or partial indicator
  - [ ] Text: Italic or muted color

- [ ] **Full categories show solid styling:**
  - [ ] Background: Solid color fill
  - [ ] Border: Solid border (if any)
  - [ ] Icon: X or block symbol
  - [ ] Text: Normal weight

### State Consistency

- [ ] Partial detection works in **OSS Mode**
- [ ] Partial detection works in **Enterprise Mode**
- [ ] Partial detection works with **Redis 7**
- [ ] Partial detection works with **Redis 8**
- [ ] Switching modes preserves partial detection accuracy
- [ ] Switching Redis versions updates partial detection correctly

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
- [ ] Partial category detection updates when switching modes
- [ ] No page reload required
- [ ] No flash or visual glitches during transition

### ACL Rule Preservation

- [ ] Enter ACL rule in OSS mode
- [ ] Switch to Enterprise mode
- [ ] **ACL rule text preserved** (not cleared)
- [ ] Rule re-parsed with Enterprise command set
- [ ] Partial categories recalculated correctly
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
- [ ] Check if @hyperloglog shows as partial (not full)
- [ ] Switch to Enterprise mode
- [ ] CLUSTER commands disappear from granted list
- [ ] Category still shows as granted (but fewer commands)
- [ ] Partial detection still accurate in Enterprise mode
- [ ] Switch back to OSS mode
- [ ] CLUSTER commands reappear
- [ ] Partial categories still styled correctly

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
- [ ] No partial categories shown when ACL is empty
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
- [ ] Partial detection works in all 4 combinations
- [ ] No JavaScript errors in console

### Rapid Mode Switching

- [ ] Toggle OSS → Enterprise → OSS → Enterprise rapidly (5x fast)
- [ ] App remains responsive
- [ ] Partial category calculations don't cause race conditions
- [ ] No race conditions or stuck states
- [ ] Final mode reflects last toggle

### Browser Compatibility

- [ ] Test in **Chrome/Edge** (Chromium)
- [ ] Test in **Firefox**
- [ ] Test in **Safari** (macOS only)
- [ ] All visual styles render correctly
- [ ] Partial category hollow styling works in all browsers
- [ ] localStorage persistence works

---

## 📱 Responsive Design Tests

### Desktop (1920x1080)

- [ ] Toggle layout perfect (side-by-side)
- [ ] No wrapping or overflow
- [ ] Proper spacing and alignment
- [ ] Partial category styling visible and clear

### Tablet (768x1024)

- [ ] Toggle layout adapts (may stack vertically)
- [ ] Still functional and usable
- [ ] Text readable
- [ ] Partial category indicators still visible

### Mobile (375x667)

- [ ] Toggle stacks vertically or adapts
- [ ] Touch targets large enough (min 44x44px)
- [ ] No horizontal scrolling
- [ ] Partial categories distinguishable from full categories

---

## 🖥️ Desktop App Specific Tests

### Electron App

- [ ] Mode toggle renders correctly in Electron
- [ ] Partial category detection works in Electron
- [ ] localStorage works in Electron context
- [ ] No preload.js security errors
- [ ] Mode persists across app restarts

### Auto-Update

- [ ] Previous app version updates to latest
- [ ] All features work after update
- [ ] No migration issues from previous versions

---

## ✅ Final Checks

- [ ] All E2E tests passing (42/42)
- [ ] No JavaScript console errors
- [ ] No visual glitches or flashing
- [ ] Partial category detection accurate and consistent
- [ ] Feature matches design specs
- [ ] Documentation updated (README, ROADMAP, CLAUDE.md)
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
