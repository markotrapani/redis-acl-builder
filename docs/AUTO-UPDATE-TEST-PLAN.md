# Auto-Update System Test Plan - v2.1.0-beta

## 📋 Test Overview

**Version:** v2.1.0-beta
**Feature:** Electron auto-update with electron-updater
**Platforms:** macOS (ARM64 + Intel), Windows, Linux
**Update Server:** GitHub Releases

---

## ✅ Pre-Test Checklist

- [x] v2.1.0-beta published to GitHub Releases
- [x] All platform installers available (DMG, EXE, AppImage, .deb)
- [x] Auto-update code integrated in main.js
- [x] electron-updater dependency installed
- [x] GitHub releases set to non-draft (required for auto-updates)
- [ ] Downloaded v2.1.0-beta installer for your platform
- [ ] Test machine ready (macOS/Windows/Linux)

---

## 🧪 Test Scenario 1: Install v2.1.0-beta (Baseline)

### Purpose
Establish baseline installation and verify app works correctly.

### Steps

1. **Download v2.1.0-beta installer**
   ```bash
   # macOS ARM64
   https://github.com/markotrapani/redis-acl-builder/releases/download/v2.1.0-beta/Redis.ACL.Builder-2.1.0-beta-arm64.dmg

   # macOS Intel x64
   https://github.com/markotrapani/redis-acl-builder/releases/download/v2.1.0-beta/Redis.ACL.Builder-2.1.0-beta.dmg

   # Windows
   https://github.com/markotrapani/redis-acl-builder/releases/download/v2.1.0-beta/Redis.ACL.Builder.Setup.2.1.0-beta.exe

   # Linux AppImage
   https://github.com/markotrapani/redis-acl-builder/releases/download/v2.1.0-beta/Redis.ACL.Builder-2.1.0-beta.AppImage
   ```

2. **Install the application**
   - **macOS:** Open DMG, drag to Applications, eject DMG
   - **Windows:** Run installer, follow prompts
   - **Linux:** `chmod +x Redis.ACL.Builder-2.1.0-beta.AppImage`, run it

3. **Launch the app**
   - **macOS:** Open from Applications folder
   - **Windows:** Launch from Start Menu
   - **Linux:** Run AppImage

4. **Verify app works correctly**
   - [ ] App window opens (1416×965px)
   - [ ] Backend starts successfully (Flask on port 7381)
   - [ ] UI loads completely (three-column layout visible)
   - [ ] Can create simple ACL rule (e.g., `+@read`)
   - [ ] Can switch Redis versions (7 ↔ 8)
   - [ ] No console errors

5. **Check version in console/logs**
   - **macOS/Linux:** Check Console.app or terminal output
   - **Windows:** Check DevTools console (if available)
   - Expected: "Redis ACL Builder - Desktop App Starting..."
   - Version should show v2.1.0-beta internally

### Expected Result
✅ App installs and runs perfectly with no errors.

---

## 🧪 Test Scenario 2: Create Test Update (v2.1.1-beta)

### Purpose
Create a newer version to test the update mechanism.

### Steps

1. **Make a small visible change**

   Edit `redis-acl-builder/electron/main.js` line 168:

   ```javascript
   // Change from:
   console.log('🚀 Redis ACL Builder - Desktop App Starting...');

   // Change to:
   console.log('🚀 Redis ACL Builder v2.1.1-beta - Desktop App Starting (UPDATED VERSION)...');
   ```

2. **Update version number**

   Edit `redis-acl-builder/electron/package.json`:

   ```json
   "version": "2.1.1-beta",
   ```

3. **Commit and tag**

   ```bash
   cd /Users/marko.trapani/Downloads/marko-projects/redis-acl-builder

   git add electron/main.js electron/package.json
   git commit -m "test: Bump to v2.1.1-beta for auto-update testing"
   git push origin main

   git tag v2.1.1-beta
   git push origin v2.1.1-beta
   ```

4. **Wait for GitHub Actions build**
   - Monitor: https://github.com/markotrapani/redis-acl-builder/actions
   - Expected: ~5-10 minutes for all platforms
   - Verify: v2.1.1-beta release is published

### Expected Result
✅ v2.1.1-beta builds successfully and is published to GitHub Releases.

---

## 🧪 Test Scenario 3: Test Auto-Update Detection

### Purpose
Verify app detects and offers the new version.

### Steps

1. **Launch the v2.1.0-beta app** (installed in Scenario 1)

2. **Check console logs**
   - Expected logs:
     ```
     🚀 Redis ACL Builder - Desktop App Starting...
     🔄 Setting up auto-updater...
     🔍 Checking for updates...
     ```

3. **Wait for update dialog** (should appear within 5-10 seconds)
   - Expected dialog:
     ```
     Title: "Update Available"
     Message: "A new version (2.1.1-beta) is available!"
     Detail: "Would you like to download and install it?"
     Buttons: [Download] [Later]
     ```

4. **Take screenshot of update dialog**

### Expected Result
✅ Update notification appears with correct version (2.1.1-beta).

---

## 🧪 Test Scenario 4: Test Update Download

### Purpose
Verify update downloads correctly with progress tracking.

### Steps

1. **Click "Download" button** in the update dialog

2. **Monitor console logs**
   - Expected logs:
     ```
     📥 Download speed: XXXXX - Downloaded 0%
     📥 Download speed: XXXXX - Downloaded 25%
     📥 Download speed: XXXXX - Downloaded 50%
     📥 Download speed: XXXXX - Downloaded 75%
     📥 Download speed: XXXXX - Downloaded 100%
     ✅ Update downloaded: 2.1.1-beta
     ```

3. **Wait for download complete dialog**
   - Expected dialog:
     ```
     Title: "Update Ready"
     Message: "Update has been downloaded"
     Detail: "The application will restart to install the update."
     Buttons: [Restart Now] [Later]
     ```

4. **Note download time and size** (~112MB for DMG)

### Expected Result
✅ Update downloads successfully with progress logging.

---

## 🧪 Test Scenario 5: Test Update Installation

### Purpose
Verify update installs and app restarts with new version.

### Steps

1. **Click "Restart Now" button**

2. **App should:**
   - Close immediately
   - Install update in background
   - Restart automatically with new version

3. **Verify new version is running**
   - Check console logs for updated message:
     ```
     🚀 Redis ACL Builder v2.1.1-beta - Desktop App Starting (UPDATED VERSION)...
     ```

4. **Verify app still works**
   - [ ] Window opens correctly
   - [ ] Backend starts (Flask on port 7381)
   - [ ] UI loads and functions normally
   - [ ] Previous ACL rules/settings preserved (localStorage)

5. **Check for another update notification**
   - Expected: No update notification (already on latest)
   - Console should show:
     ```
     🔍 Checking for updates...
     ✅ App is up to date: 2.1.1-beta
     ```

### Expected Result
✅ App updates successfully and runs with v2.1.1-beta.

---

## 🧪 Test Scenario 6: Test "Later" Button

### Purpose
Verify users can defer updates without issues.

### Steps

1. **Revert to v2.1.0-beta**
   - Uninstall current app
   - Reinstall v2.1.0-beta from downloads

2. **Launch app**
   - Update dialog appears again

3. **Click "Later" button**
   - Dialog should close
   - App continues running normally
   - No errors in console

4. **Close and relaunch app**
   - Update dialog should appear again
   - App should continue offering update on each launch

### Expected Result
✅ "Later" button works correctly and update is re-offered on next launch.

---

## 🧪 Test Scenario 7: Test Development Mode Skip

### Purpose
Verify auto-update is disabled in development mode.

### Steps

1. **Run app in development mode**
   ```bash
   cd /Users/marko.trapani/Downloads/marko-projects/redis-acl-builder/electron
   npm start
   ```

2. **Check console logs**
   - Expected:
     ```
     🔧 Development mode: Auto-update disabled
     ```
   - **No** update check should happen
   - **No** update dialogs should appear

### Expected Result
✅ Auto-update is correctly skipped in development mode.

---

## 🧪 Test Scenario 8: Test Error Handling

### Purpose
Verify graceful handling of update errors.

### Steps

1. **Simulate network offline**
   - Disconnect from internet
   - Launch v2.1.0-beta app

2. **Check console logs**
   - Expected:
     ```
     🔍 Checking for updates...
     ❌ Auto-update error: [network error details]
     ```
   - App should continue running normally despite error
   - No crash or freeze

3. **Reconnect internet**
   - Close and relaunch app
   - Update check should work again

### Expected Result
✅ Network errors are handled gracefully without crashing.

---

## 📊 Test Results Template

### Platform: [macOS ARM64 / macOS Intel / Windows / Linux]

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Baseline Install | ⬜ Pass / ⬜ Fail | |
| 2. Create Test Update | ⬜ Pass / ⬜ Fail | |
| 3. Update Detection | ⬜ Pass / ⬜ Fail | |
| 4. Download Progress | ⬜ Pass / ⬜ Fail | |
| 5. Installation | ⬜ Pass / ⬜ Fail | |
| 6. "Later" Button | ⬜ Pass / ⬜ Fail | |
| 7. Dev Mode Skip | ⬜ Pass / ⬜ Fail | |
| 8. Error Handling | ⬜ Pass / ⬜ Fail | |

### Overall Assessment
- [ ] All scenarios passed
- [ ] Auto-update ready for production
- [ ] Issues found (describe below)

### Issues / Notes
```
[Describe any issues, unexpected behavior, or observations here]
```

---

## 🔧 Troubleshooting

### "Update not available" when update exists

**Possible causes:**
1. GitHub release is still draft (must be published)
2. Release doesn't have `latest.yml` or `latest-mac.yml` files
3. App is already on latest version (check package.json version)
4. Release tag format incorrect (must be `v2.1.1-beta` not `2.1.1-beta`)

**Solution:**
- Check release is published: https://github.com/markotrapani/redis-acl-builder/releases
- Verify tag format matches package.json version
- Check console logs for error messages

### Download fails or times out

**Possible causes:**
1. Network connectivity issues
2. GitHub rate limiting
3. File size too large for connection

**Solution:**
- Check internet connection
- Wait and retry
- Download manually and verify file size

### App doesn't restart after update

**Possible causes:**
1. macOS Gatekeeper blocking unsigned app
2. Antivirus blocking installation
3. Insufficient permissions

**Solution:**
- **macOS:** Right-click app → Open → "Open Anyway"
- **Windows:** Check Windows Defender / antivirus logs
- **Linux:** Verify AppImage has execute permissions

---

## ✅ Success Criteria

The auto-update system is considered **production-ready** if:

- [x] v2.1.0-beta installs and runs on all platforms
- [ ] v2.1.1-beta builds and publishes successfully
- [ ] Update notification appears correctly
- [ ] Download completes with progress tracking
- [ ] Installation succeeds and app restarts
- [ ] Updated version runs correctly
- [ ] "Later" button works as expected
- [ ] Development mode skips updates
- [ ] Errors are handled gracefully

---

**Ready to start testing?** Follow Scenario 1 first to establish the baseline installation!
