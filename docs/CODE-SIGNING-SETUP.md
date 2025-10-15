# Code Signing & Auto-Update Setup Guide

This guide walks you through setting up code signing for macOS and Windows, and configuring auto-updates for the Redis ACL Builder desktop application.

**Version:** v2.1-beta
**Last Updated:** 2025-10-15

---

## 📋 Overview

**What's Already Implemented:**
- ✅ Auto-update system with electron-updater
- ✅ GitHub Actions workflow with publish support
- ✅ Update notification UI with user prompts
- ✅ Automatic release creation on version tags

**What You Need to Do:**
- 🔐 Set up Apple Developer account (for macOS code signing)
- 🔐 (Optional) Get Windows code signing certificate
- 🔑 Add secrets to GitHub repository
- 📦 Install new npm dependencies
- 🧪 Test the auto-update flow

---

## 🍎 Part 1: macOS Code Signing Setup

### Step 1.1: Apple Developer Account

**Time Required:** 1-2 business days (approval process)

1. **Sign up for Apple Developer Program:**
   - Go to: https://developer.apple.com/programs/
   - Cost: $99/year
   - You'll need:
     - Apple ID
     - Credit card for payment
     - Business information (if enrolling as organization)

2. **Wait for approval:**
   - Apple reviews applications within 1-2 business days
   - You'll receive an email when approved

### Step 1.2: Create Developer ID Certificate

**Once your Apple Developer account is approved:**

1. **Generate Certificate Signing Request (CSR):**

   On your Mac:
   - Open "Keychain Access" app
   - Menu: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Enter your email address
   - Common Name: "Your Name" or "Your Company"
   - Select "Saved to disk"
   - Click Continue and save the CSR file

2. **Create Developer ID Application Certificate:**

   - Go to: https://developer.apple.com/account/resources/certificates/list
   - Click "+" to create new certificate
   - Select "Developer ID Application" (for apps distributed outside Mac App Store)
   - Upload your CSR file
   - Download the certificate (.cer file)
   - Double-click to install it in your Keychain

3. **Verify installation:**

   ```bash
   # List signing identities
   security find-identity -v -p codesigning

   # You should see something like:
   # 1) ABC123... "Developer ID Application: Your Name (TEAM_ID)"
   ```

### Step 1.3: Get Your Team ID

1. Go to: https://developer.apple.com/account
2. Look for "Team ID" in the "Membership Details" section
3. It's a 10-character string like "ABC123XYZ4"
4. **Save this** - you'll need it for GitHub Secrets

### Step 1.4: Create App-Specific Password

**For notarization automation:**

1. Go to: https://appleid.apple.com/account/manage
2. Under "Security" → "App-Specific Passwords"
3. Click "Generate Password"
4. Label it: "Redis ACL Builder Notarization"
5. **Copy and save the password** - you can't view it again!

---

## 🪟 Part 2: Windows Code Signing Setup (Optional)

**Note:** Windows code signing is optional for beta testing. You can skip this section and add it later for public release.

### Step 2.1: Purchase Code Signing Certificate

**Recommended Providers:**

- **DigiCert:** https://www.digicert.com/signing/code-signing-certificates
  - Cost: ~$200-500/year
  - Good reputation, widely trusted

- **Sectigo (formerly Comodo):** https://sectigo.com/ssl-certificates-tls/code-signing
  - Cost: ~$100-300/year
  - More affordable option

**Requirements:**
- Business verification (usually 1-3 business days)
- Valid business documents (incorporation papers, tax ID, etc.)

### Step 2.2: Install Certificate

1. **Download certificate:**
   - Provider will send you a `.pfx` or `.p12` file
   - Save it securely

2. **Convert to base64 for GitHub Secrets:**

   ```bash
   # On macOS/Linux:
   base64 -i your-certificate.pfx -o certificate-base64.txt

   # On Windows (PowerShell):
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("your-certificate.pfx")) | Out-File certificate-base64.txt
   ```

3. **Save certificate password** - you'll need it for GitHub Secrets

---

## 🔑 Part 3: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

**Go to:** https://github.com/markotrapani/redis-acl-builder/settings/secrets/actions

### macOS Code Signing Secrets

Add these secrets (click "New repository secret"):

| Secret Name | Value | Description |
|------------|-------|-------------|
| `APPLE_ID` | your-apple-id@email.com | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | xxxx-xxxx-xxxx-xxxx | App-specific password from Step 1.4 |
| `APPLE_TEAM_ID` | ABC123XYZ4 | Your Team ID from Step 1.3 |

### Windows Code Signing Secrets (Optional)

| Secret Name | Value | Description |
|------------|-------|-------------|
| `WIN_CSC_LINK` | (base64 content) | Base64-encoded certificate from Step 2.2 |
| `WIN_CSC_KEY_PASSWORD` | your-cert-password | Certificate password |

---

## 📦 Part 4: Install Dependencies

**On your development machine:**

```bash
cd /Users/marko.trapani/Downloads/marko-projects/redis-acl-builder/electron

# Install new npm dependencies
npm install

# This will install:
# - @electron/notarize@^2.1.0 (for macOS notarization)
# - electron-updater@^6.1.4 (for auto-updates)
```

**Verify installation:**

```bash
npm list @electron/notarize electron-updater

# Should show:
# ├── @electron/notarize@2.1.0
# └── electron-updater@6.1.4
```

---

## 🧪 Part 5: Testing Auto-Updates

### 5.1: Test Local Build (No Code Signing)

**First, test that everything works without code signing:**

```bash
cd /Users/marko.trapani/Downloads/marko-projects/redis-acl-builder

# Make sure you've run the build_minified.py script if you changed CSS/JS
python3 build_minified.py

# Build the Electron app locally
cd electron
npm run build:mac

# Verify the build
ls -lh dist/

# You should see:
# - Redis ACL Builder-2.0.3-alpha-arm64.dmg
# - Redis ACL Builder-2.0.3-alpha-x64.dmg
# - Redis ACL Builder-2.0.3-alpha-arm64-mac.zip
# - Redis ACL Builder-2.0.3-alpha-mac.zip
```

### 5.2: Test Auto-Update Flow

**To test the complete auto-update flow:**

1. **Create a test release:**

   ```bash
   cd /Users/marko.trapani/Downloads/marko-projects/redis-acl-builder

   # Update version in package.json to v2.1.0-beta
   # Then commit and tag
   git add -A
   git commit -m "feat: Add auto-update system for desktop app"
   git tag v2.1.0-beta
   git push origin main
   git push origin v2.1.0-beta
   ```

2. **Wait for GitHub Actions to build:**
   - Go to: https://github.com/markotrapani/redis-acl-builder/actions
   - Wait for the "Build Desktop Apps" workflow to complete (~5-10 minutes)
   - Verify that all three platforms built successfully

3. **Check GitHub Release:**
   - Go to: https://github.com/markotrapani/redis-acl-builder/releases
   - You should see a new release "v2.1.0-beta" (not a draft!)
   - It should be marked as "Pre-release" (because of -beta suffix)
   - All build artifacts should be attached

4. **Install the app:**
   - Download the DMG for your architecture (ARM64 or x64)
   - Install the app
   - **Important:** This will be your "old" version

5. **Create a newer version:**
   - Update version to v2.1.1-beta
   - Make a small change (e.g., update a console.log message)
   - Commit, tag, push
   - Wait for build to complete

6. **Test the update:**
   - Launch the app you installed in step 4
   - You should see a dialog: "A new version (2.1.1-beta) is available!"
   - Click "Download"
   - Wait for download to complete
   - You should see: "Update has been downloaded"
   - Click "Restart Now"
   - App should restart with the new version

---

## 🔧 Part 6: Enable Code Signing in GitHub Actions

**Once you've added the secrets (Step 3), update the workflow:**

```bash
cd /Users/marko.trapani/Downloads/marko-projects/redis-acl-builder
```

Edit `.github/workflows/build-desktop.yml`:

**For macOS**, change line 105 from:

```yaml
CSC_IDENTITY_AUTO_DISCOVERY: false  # Disable code signing for now
```

To:

```yaml
CSC_IDENTITY_AUTO_DISCOVERY: true  # Enable code signing
APPLE_ID: ${{ secrets.APPLE_ID }}
APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

**For Windows** (if you have a certificate), uncomment lines 124-126:

```yaml
WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

**Commit and push:**

```bash
git add .github/workflows/build-desktop.yml
git commit -m "ci: Enable code signing for desktop builds"
git push origin main
```

---

## ✅ Part 7: Verification Checklist

**Before releasing v2.1-beta publicly:**

- [ ] Apple Developer account approved
- [ ] Developer ID certificate installed locally
- [ ] Team ID obtained
- [ ] App-specific password created
- [ ] All GitHub secrets added correctly
- [ ] npm dependencies installed (`npm install` in electron/)
- [ ] Local build successful (unsigned)
- [ ] GitHub Actions build successful (signed)
- [ ] Auto-update test successful (old version → new version)
- [ ] macOS Gatekeeper test: App opens without warnings
- [ ] Windows SmartScreen test (if using Windows cert): App opens without warnings

---

## 🚨 Troubleshooting

### "Update not available" when testing

**Problem:** App says it's up to date even though there's a newer release.

**Solutions:**
1. Check that GitHub release is **published** (not draft)
2. Verify release has the correct tag format (v2.1.0-beta, not just 2.1.0-beta)
3. Check that `latest.yml` / `latest-mac.yml` files are present in the release
4. Clear app cache: Delete `~/Library/Application Support/redis-acl-builder-desktop/`

### "Code signing failed" during build

**Problem:** GitHub Actions build fails with code signing error.

**Solutions:**
1. Verify all secrets are added correctly (no typos, no extra spaces)
2. Check that certificate is valid (not expired)
3. For macOS: Run `security find-identity -v -p codesigning` locally to verify cert
4. Check GitHub Actions logs for specific error message

### Notarization takes forever

**Problem:** macOS notarization step times out or takes 20+ minutes.

**Solutions:**
1. This is normal for first-time notarization (can take 10-20 minutes)
2. Subsequent builds are usually faster (5-10 minutes)
3. If it consistently times out, check Apple Developer status page
4. Verify app-specific password is correct

### Windows Defender blocks the app

**Problem:** Windows shows security warning when opening the app.

**Solutions:**
1. This is expected for **unsigned** Windows builds
2. Solution: Get a Windows code signing certificate (Part 2)
3. Temporary workaround: Right-click → Properties → "Unblock" checkbox

---

## 📚 Additional Resources

**Electron Code Signing:**
- https://www.electron.build/code-signing

**macOS Notarization:**
- https://www.electron.build/configuration/mac
- https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution

**electron-updater:**
- https://www.electron.build/auto-update
- https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater

**GitHub Releases:**
- https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

---

## 🎯 Next Steps After v2.1-beta

Once code signing and auto-updates are working:

1. **Phase 2: Native Desktop Features** (Optional)
   - Custom title bar
   - File dialogs for save/load
   - System tray integration
   - Native menus

2. **Production Release (v2.1.0)**
   - Remove `-beta` suffix
   - Publish to product website
   - Announce on social media / blog

3. **Future Enhancements**
   - Windows/Linux code signing
   - Delta updates for faster downloads
   - Multiple update channels (stable, beta, nightly)

---

**Questions or issues?** Open an issue on GitHub: https://github.com/markotrapani/redis-acl-builder/issues
