# Manual Testing Checklist - Enterprise/OSS Mode Toggle

**Feature:** Redis Enterprise/OSS Mode Toggle UI
**Version:** v2.8.x
**Date:** 2025-11-12
**Server:** <http://localhost:5001>

---

## ✅ API Backend Tests (COMPLETED)

### Command Count Tests

- ✅ Redis 7 OSS: 379 commands
- ✅ Redis 7 Enterprise: 305 commands (74 restricted)
- ✅ Redis 8 OSS: 488 commands
- ✅ Redis 8 Enterprise: 440 commands (48 restricted)

### Restricted Command Tests

- ✅ CLUSTER ADDSLOTS: Blocked in Enterprise, Allowed in OSS
- ✅ MODULE LOAD: Blocked in Enterprise, Allowed in OSS
- ✅ GET: Allowed in both modes

### Categories Endpoint

- ✅ /api/categories returns 29 categories for Redis 8

---

## 🔲 UI Manual Tests (TO DO)

### 1. Initial Page Load

- [ ] Open <http://localhost:5001> in browser
- [ ] Verify mode toggle appears next to Redis Version toggle
- [ ] Verify default state is "OSS" (blue gradient, left position)
- [ ] Verify toggle label says "Mode:"
- [ ] Verify tooltip shows: "OSS: All Redis commands | Enterprise: Cloud-restricted"
- [ ] Verify command count shows "488 commands" (Redis 8 OSS by default)

### 2. Mode Toggle Switching

- [ ] Click mode toggle to switch to Enterprise
- [ ] Verify toggle animates smoothly to right position
- [ ] Verify background changes to purple gradient (#6B46C1 → #9333EA)
- [ ] Verify "Enterprise" text shows in gold color (#FFD700)
- [ ] Verify command count updates to "440/488 commands"
- [ ] Click toggle again to switch back to OSS
- [ ] Verify toggle returns to left position (blue gradient)
- [ ] Verify command count returns to "488 commands"

### 3. Command Count Display Format

**OSS Mode:**

- [ ] Redis 7 OSS: Shows "379 commands"
- [ ] Redis 8 OSS: Shows "488 commands"

**Enterprise Mode:**

- [ ] Redis 7 Enterprise: Shows "305/379 commands"
- [ ] Redis 8 Enterprise: Shows "440/488 commands"

### 4. Version + Mode Combinations

Test all 4 combinations:

- [ ] Redis 7 + OSS: 379 commands
- [ ] Redis 7 + Enterprise: 305/379 commands
- [ ] Redis 8 + OSS: 488 commands
- [ ] Redis 8 + Enterprise: 440/488 commands

### 5. ACL Rule Testing with Restricted Commands

**Test Rule:** `+@all ~*`

**In Enterprise Mode:**

- [ ] Enter ACL rule: `+@all ~*`
- [ ] Verify blocked commands panel INCLUDES restricted commands
- [ ] Test command "CLUSTER ADDSLOTS" → Should show as BLOCKED
- [ ] Test command "MODULE LOAD" → Should show as BLOCKED
- [ ] Test command "SAVE" → Should show as BLOCKED

**In OSS Mode:**

- [ ] Switch to OSS mode
- [ ] Same ACL rule: `+@all ~*`
- [ ] Verify blocked commands panel does NOT include those commands
- [ ] Test command "CLUSTER ADDSLOTS" → Should show as GRANTED
- [ ] Test command "MODULE LOAD" → Should show as GRANTED
- [ ] Test command "SAVE" → Should show as GRANTED

### 6. localStorage Persistence

- [ ] Switch to Enterprise mode
- [ ] Verify command count shows Enterprise format
- [ ] Reload page (Cmd+R or F5)
- [ ] Verify mode toggle still shows Enterprise (purple, right position)
- [ ] Verify command count still shows Enterprise format
- [ ] Switch back to OSS
- [ ] Reload page
- [ ] Verify mode toggle shows OSS (blue, left position)

### 7. URL Parameter Support

- [ ] Navigate to: <http://localhost:5001/?mode=enterprise>
- [ ] Verify toggle is in Enterprise position on page load
- [ ] Verify command count shows Enterprise format
- [ ] Navigate to: <http://localhost:5001/?version=redis7&mode=enterprise>
- [ ] Verify both Redis 7 AND Enterprise mode are active
- [ ] Verify command count shows "305/379 commands"

### 8. URL Parameter Persistence

- [ ] Start at <http://localhost:5001> (default OSS mode)
- [ ] Switch to Enterprise mode using toggle
- [ ] Verify URL updates to: <http://localhost:5001/?version=redis8&mode=enterprise>
- [ ] Switch back to OSS
- [ ] Verify URL updates to: <http://localhost:5001/?version=redis8&mode=oss>

### 9. Browser Console Check

- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Reload page
- [ ] Verify NO JavaScript errors
- [ ] Switch mode toggle
- [ ] Verify console logs show: "Mode switched from oss to enterprise"
- [ ] Verify NO errors during mode switch

### 10. Visual Styling Verification

**OSS Mode (Blue):**

- [ ] Background: Blue gradient (visible)
- [ ] "OSS" text: Black with white glow/shadow (on white slider)
- [ ] "Enterprise" text: White (on blue background)
- [ ] Box shadow: Blue glow

**Enterprise Mode (Purple/Gold):**

- [ ] Background: Purple gradient (visible)
- [ ] "OSS" text: White (on purple background)
- [ ] "Enterprise" text: Gold (#FFD700) with dark shadow (on white slider)
- [ ] Box shadow: Purple glow

### 11. Toggle Animation

- [ ] Click toggle rapidly 5 times
- [ ] Verify smooth transitions (no flickering)
- [ ] Verify slider moves exactly 72px horizontally
- [ ] Verify background color transitions smoothly
- [ ] Verify text colors transition smoothly

### 12. Responsive Design (Optional)

- [ ] Resize browser to tablet width (768px)
- [ ] Verify mode toggle still visible and functional
- [ ] Resize to mobile width (480px)
- [ ] Verify mode toggle wraps properly or scrolls
- [ ] Verify clicking still works on small screens

---

## 🐛 Known Issues / Edge Cases to Test

### Edge Case 1: localStorage Disabled

- [ ] Disable localStorage in browser (DevTools → Application → Storage)
- [ ] Reload page
- [ ] Verify app doesn't crash
- [ ] Verify defaults to OSS mode

### Edge Case 2: Invalid URL Parameters

- [ ] Navigate to: <http://localhost:5001/?mode=invalid>
- [ ] Verify console warning appears
- [ ] Verify defaults to OSS mode

### Edge Case 3: Rapid Toggle Clicking

- [ ] Click toggle 10 times rapidly
- [ ] Verify no console errors
- [ ] Verify final state is correct
- [ ] Verify localStorage matches final state

---

## 📊 Test Results Summary

**API Tests:** ✅ 9/9 PASS (100%)
**UI Tests:** ⏳ PENDING MANUAL VERIFICATION

**Tested By:** _________________
**Date:** _________________
**Browser:** _________________
**OS:** _________________

---

## 🚀 Next Steps After Testing

If all tests pass:

1. ✅ Mark feature as complete in ROADMAP.md
2. Update README.md with Enterprise mode documentation
3. Update GitHub Wiki with Enterprise mode info
4. Create E2E Playwright tests
5. Consider release (v2.8.x or v2.9.0)

If tests fail:

1. Document failures in GitHub issue
2. Fix bugs
3. Re-test
4. Update ROADMAP.md with blockers
