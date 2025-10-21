# Desktop App Code Signing & Notarization Guide

Complete guide for setting up code signing and notarization for macOS and Windows Electron apps.

## Table of Contents

- [Overview](#overview)
- [macOS Notarization](#macos-notarization)
  - [Prerequisites](#prerequisites)
  - [Step 1: Apple Developer Setup](#step-1-apple-developer-setup)
  - [Step 2: Code Signing Setup](#step-2-code-signing-setup)
  - [Step 3: Notarization Setup](#step-3-notarization-setup)
  - [Step 4: GitHub Actions Integration](#step-4-github-actions-integration)
  - [Step 5: Testing](#step-5-testing)
  - [Troubleshooting](#troubleshooting)
  - [Key Learnings](#key-learnings)
- [Windows Code Signing](#windows-code-signing)
  - [Overview](#windows-overview)
  - [Certificate Providers](#certificate-providers)
  - [Setup Steps](#windows-setup-steps)
  - [GitHub Integration](#windows-github-integration)

---

## macOS Notarization

### Overview

**What is notarization?**

- Apple's security process that scans macOS apps for malware before distribution
- Required for all apps distributed outside the Mac App Store (macOS 10.15+)
- Provides users with a better first-install experience

**User Experience:**

- **Without notarization:** "cannot be verified" warning → right-click → Open → Open again
- **With notarization:** "from identified developer" → single Open button
- **With auto-update:** Seamless updates with no security warnings (code signing handles this)

**Important:** Notarization improves first-install UX but is NOT required for auto-updates. Code signing alone is sufficient for auto-updates to work.

---

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Individual or Organization account
   - <https://developer.apple.com/programs/>

2. **Xcode Command Line Tools**

   ```bash
   xcode-select --install
   ```

3. **Electron app configured with:**
   - Code signing (Developer ID Application certificate)
   - Hardened runtime enabled
   - Proper entitlements

---

## Step 1: Apple Developer Setup

### 1.1 Create App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com/access/integrations/api)
   - Or navigate: Account → Integrations → App Store Connect API

2. Click **"+"** to create a new key

3. Configure the key:
   - **Name:** "Notarization Key" (or any descriptive name)
   - **Access:** "App Manager"
   - **Key Type:** Team Key (not Individual)

4. Click **Generate**

5. **Important:** Download the `.p8` file immediately - you can only download it once!
   - File format: `AuthKey_<KeyID>.p8`
   - Save to a secure location (e.g., `~/Downloads/certs/AuthKey_XXXXXXXXXX.p8`)

6. **Note down these values:**
   - **Issuer ID:** UUID format (e.g., `46162619-ec79-4d58-9203-c6ce3179a9f7`)
   - **Key ID:** 10-character alphanumeric (e.g., `36NW7V7TNJ`)
   - **Team ID:** Your developer team ID (e.g., `L56TPJWPSM`)
     - Find at: <https://developer.apple.com/account> → Membership → Team ID

---

## Step 2: Code Signing Setup

### 2.1 Export Developer ID Certificate

If you haven't already set up code signing, see the main CI/CD documentation. You need:

- Developer ID Application certificate
- Certificate exported as `.p12` file
- Base64 encoded for GitHub secrets

### 2.2 Verify Code Signing Works

Before adding notarization, ensure code signing works:

```bash
# Build and sign the app locally
cd electron
npm run build:mac

# Verify signature
codesign -dvv "dist/mac/YourApp.app"

# Should show:
# Authority=Developer ID Application: Your Name (TEAMID)
# Signature=adhoc  # or valid signature
```

---

## Step 3: Notarization Setup

### 3.1 Install @electron/notarize

```bash
cd electron
npm install @electron/notarize --save-dev
```

Update `package.json`:

```json
{
  "devDependencies": {
    "@electron/notarize": "^2.1.0"
  }
}
```

### 3.2 Create notarize.js Script

Create `electron/notarize.js`:

```javascript
const { notarize } = require('@electron/notarize');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Only notarize if we have API key credentials
  if (!process.env.APPLE_API_KEY || !process.env.APPLE_API_ISSUER || !process.env.APPLE_API_KEY_ID) {
    console.log('Skipping notarization - API key credentials not found');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  // Decode base64-encoded API key and write to temp file
  const apiKeyContent = Buffer.from(process.env.APPLE_API_KEY, 'base64').toString('utf8');
  console.log(`Decoded API key length: ${apiKeyContent.length} bytes`);
  console.log(`First 50 chars: ${apiKeyContent.substring(0, 50)}`);

  const tempKeyPath = path.join(os.tmpdir(), 'AuthKey.p8');
  fs.writeFileSync(tempKeyPath, apiKeyContent);
  console.log(`Wrote API key to: ${tempKeyPath}`);

  try {
    await notarize({
      appPath,
      appleApiKey: tempKeyPath,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempKeyPath)) {
      fs.unlinkSync(tempKeyPath);
    }
  }
};
```

**Key points:**

- ✅ Decode base64 API key before using
- ✅ Write to temp file (notarize expects file path, not content)
- ✅ Do NOT pass `teamId` parameter (causes credential conflict)
- ✅ Only pass three required params: `appleApiKey`, `appleApiIssuer`, `appleApiKeyId`
- ✅ Clean up temp file after notarization

### 3.3 Update package.json Build Config

Add `afterSign` hook and disable auto-notarization:

```json
{
  "build": {
    "appId": "com.yourcompany.yourapp",
    "afterSign": "notarize.js",
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "build/icon.icns",
      "target": [
        { "target": "dmg", "arch": ["arm64", "x64"] },
        { "target": "zip", "arch": ["arm64", "x64"] }
      ],
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "notarize": false
    }
  }
}
```

**Critical:** Set `"notarize": false` to prevent electron-builder from auto-notarizing. This ensures only your custom `afterSign` hook runs notarization.

### 3.4 Create/Verify Entitlements File

Create `electron/build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
  </dict>
</plist>
```

**Note:** For Electron 12+, only use `com.apple.security.cs.allow-jit`. The `allow-unsigned-executable-memory` entitlement is needed for older Electron versions or apps with Python backends.

---

## Step 4: GitHub Actions Integration

### 4.1 Encode API Key as Base64

```bash
# Encode the .p8 file
base64 -i ~/Downloads/certs/AuthKey_XXXXXXXXXX.p8 | pbcopy

# The base64 string is now in your clipboard
```

### 4.2 Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these three secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `APPLE_API_KEY` | Base64-encoded `.p8` file content | `LS0tLS1CRUdJTi...` |
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect | `46162619-ec79-4d58-9203-c6ce3179a9f7` |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect | `36NW7V7TNJ` |

**Do NOT add:**

- ❌ `APPLE_TEAM_ID` (causes credential conflict)
- ❌ `APPLE_ID` or `APPLE_APP_SPECIFIC_PASSWORD` (old password-based auth)

### 4.3 Update GitHub Actions Workflow

In `.github/workflows/build-desktop.yml`:

```yaml
- name: Build Electron app (macOS)
  if: matrix.platform == 'mac'
  working-directory: electron
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
    APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
    APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
  run: |
    if [[ "${{ github.ref }}" == refs/tags/* ]]; then
      npx electron-builder --mac --arm64 --x64 --publish=always
    else
      npx electron-builder --mac --arm64 --x64
    fi
```

---

## Step 5: Testing

### 5.1 Local Testing (Optional)

You can test notarization locally before pushing to CI:

```bash
# Set environment variables
export APPLE_API_KEY="<base64-encoded-key>"
export APPLE_API_ISSUER="<issuer-id>"
export APPLE_API_KEY_ID="<key-id>"

# Build with notarization
cd electron
npm run build:mac
```

**Expected output:**

```text
• signing         file=dist/mac/YourApp.app
• skipped macOS notarization  reason=`notarize` options were set explicitly `false`
Notarizing /path/to/YourApp.app...
Decoded API key length: 257 bytes
First 50 chars: -----BEGIN PRIVATE KEY-----
Wrote API key to: /var/folders/.../AuthKey.p8
Notarization complete!
```

### 5.2 CI/CD Testing

1. **Push a version tag:**

   ```bash
   git tag v1.0.0-beta
   git push origin v1.0.0-beta
   ```

2. **Monitor the build:**

   ```bash
   gh run watch --interval 30 -R owner/repo
   ```

3. **Expected timeline:**
   - Code signing: ~10 seconds
   - Notarization: 5-15 minutes (Apple's servers)
   - DMG/ZIP creation: ~30 seconds
   - **Total:** 10-20 minutes (vs 1-2 minutes without notarization)

### 5.3 Verify Notarization

After the build completes:

1. **Download the DMG** from GitHub Releases

2. **Remove any quarantine flags** (to simulate fresh download):

   ```bash
   xattr -d com.apple.quarantine ~/Downloads/YourApp-1.0.0-beta-arm64.dmg
   ```

3. **Open the DMG** (double-click, not right-click)

4. **Expected behavior:**
   - ✅ **With notarization:** "YourApp is from an identified developer. Are you sure you want to open it?" with "Open" button
   - ❌ **Without notarization:** "YourApp cannot be verified" with only "Cancel" and "Move to Trash"

5. **Verify with stapler** (optional):

   ```bash
   stapler validate /Applications/YourApp.app
   # Output: The validate action worked!
   ```

---

## Troubleshooting

### Build Fails in ~1 minute

**Symptom:** Build fails quickly (1-2 minutes) instead of taking 10-15+ minutes

**Common causes:**

1. **Credential conflict error:**

   ```
   Cannot use password credentials, API key credentials and keychain credentials at once
   ```

   **Solutions:**
   - ✅ Remove `teamId` parameter from `notarize()` call in `notarize.js`
   - ✅ Delete old `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` secrets
   - ✅ Do NOT set `APPLE_TEAM_ID` environment variable in workflow
   - ✅ Set `"notarize": false` in `package.json` mac config

2. **JSON parsing error:**

   ```
   Unexpected token E in JSON at position 0
   ```

   **Solutions:**
   - ✅ Ensure API key is base64-encoded before storing in GitHub secrets
   - ✅ Decode base64 in `notarize.js` before writing to temp file
   - ✅ Pass file path (not content) to `notarize()` function

3. **electron-builder auto-notarization conflict:**

   ```
   • signing         file=dist/mac/YourApp.app
   ⨯ Unexpected token E in JSON...
   ```

   **Solution:**
   - ✅ Set `"notarize": false` in package.json mac config
   - This prevents electron-builder from auto-detecting and notarizing

### Notarization Takes Too Long

**Symptom:** Build hangs at "Notarizing..." for 30+ minutes

**Possible causes:**

- Apple's notarization servers are slow (happens occasionally)
- App bundle is very large (>500 MB)

**Solutions:**

- Wait it out (Apple recommends up to 1 hour)
- Check Apple's system status: <https://developer.apple.com/system-status/>
- Consider reducing app bundle size

### "401 Unauthorized" Error

**Symptom:**

```text
Error: HTTP status code: 401. Invalid credentials.
```

**Solutions:**

- ✅ Verify Issuer ID is correct (UUID format)
- ✅ Verify Key ID is correct (10 characters)
- ✅ Verify `.p8` file is encoded correctly
- ✅ Ensure API key has "App Manager" access
- ✅ If using Individual key (not Team key), omit `appleApiIssuer` parameter

### Debug Logging

Enable debug output in notarize.js:

```javascript
// Add at the top of notarize.js
process.env.DEBUG = 'electron-notarize*';
```

Or run locally with debug flag:

```bash
DEBUG=electron-notarize* npm run build:mac
```

---

## Key Learnings

### What Worked

1. **App Store Connect API key authentication** (modern, recommended)
   - More secure than password-based auth
   - No 2FA complications
   - Can be revoked independently

2. **Custom afterSign hook** with explicit credential handling
   - Full control over notarization process
   - Clear error messages
   - Easy to debug

3. **Disabling electron-builder auto-notarization**
   - Prevents credential detection conflicts
   - Ensures only our custom logic runs

4. **Base64 encoding for GitHub secrets**
   - Safely stores binary `.p8` file
   - Works across all CI/CD platforms

### What Didn't Work

1. ❌ **Using `notarize` section in package.json**
   - electron-builder auto-detects credentials incorrectly
   - Causes "multiple credentials at once" errors

2. ❌ **Passing `teamId` to notarize() function**
   - Triggers "keychain credentials" detection
   - Conflicts with API key credentials

3. ❌ **Setting APPLE_TEAM_ID environment variable**
   - Detected as keychain credentials
   - Team ID not needed for API key auth

4. ❌ **Password-based authentication (appleId/appleIdPassword)**
   - Legacy method, more complex
   - Requires app-specific password
   - Conflicts with API key auth if both are present

### Best Practices

1. **Always use API key authentication** (not password-based)
2. **Store credentials as GitHub secrets** (never in code)
3. **Use afterSign hook** for custom notarization logic
4. **Set `notarize: false`** in package.json to prevent auto-notarization
5. **Test locally first** before pushing to CI/CD
6. **Keep debug logging** in production (helps troubleshoot issues)
7. **Document your setup** for future reference

### Time Estimates

| Task | Duration |
|------|----------|
| Apple Developer setup | 15-30 min |
| Code signing setup | 30-60 min |
| Notarization code changes | 15-30 min |
| GitHub Actions configuration | 10-15 min |
| Testing and verification | 15-30 min |
| **Total first-time setup** | **~2-3 hours** |
| Notarization per build | 10-20 min |

---

## References

- [@electron/notarize Documentation](https://github.com/electron/notarize)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [App Store Connect API Keys](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)

---

## Windows Code Signing

### Windows Overview

**What is Windows code signing?**

- Digital signature that verifies the publisher of Windows applications
- Prevents "Unknown Publisher" warnings in Windows SmartScreen
- Builds user trust and provides professional distribution
- Optional for testing, recommended for production releases

**User Experience:**

- **Without signing:** "Windows protected your PC" warning → "More info" → "Run anyway"
- **With signing:** "Do you want to allow this app from a verified publisher to make changes?" → cleaner experience

**Note:** Unlike macOS notarization, Windows code signing is optional. The app will still work unsigned, but users will see security warnings.

---

### Certificate Providers

You need to purchase a code signing certificate from a trusted Certificate Authority (CA).

#### Recommended Providers

**1. DigiCert**

- Website: <https://www.digicert.com/signing/code-signing-certificates>
- Cost: ~$200-500/year
- Best for: Established businesses
- Pros:
  - Excellent reputation
  - Widely trusted by Windows
  - Fast verification process
  - Good customer support
- Cons:
  - More expensive
  - Requires business verification

**2. Sectigo (formerly Comodo)**

- Website: <https://sectigo.com/ssl-certificates-tls/code-signing>
- Cost: ~$100-300/year
- Best for: Small businesses and individuals
- Pros:
  - More affordable
  - Still widely trusted
  - Good for beta/internal distribution
- Cons:
  - Slightly longer verification process
  - Less premium brand

**3. SSL.com**

- Website: <https://www.ssl.com/certificates/code-signing/>
- Cost: ~$150-400/year
- Best for: Budget-conscious developers
- Pros:
  - Competitive pricing
  - Multiple certificate options
- Cons:
  - Less well-known than DigiCert/Sectigo

#### Certificate Types

- **Standard Code Signing:** File-based certificate (.pfx or .p12)
- **EV Code Signing:** Hardware token-based (USB stick)
  - More expensive (~$300-600/year)
  - Provides "immediate" SmartScreen reputation
  - Required for kernel-mode drivers
  - Overkill for most Electron apps

**Recommendation:** Standard code signing certificate is sufficient for most desktop applications.

---

### Windows Setup Steps

#### Step 1: Purchase Certificate

1. **Choose a provider** (DigiCert, Sectigo, or SSL.com)

2. **Select certificate type:**
   - Standard Code Signing Certificate (recommended)
   - Validity: 1-3 years

3. **Complete verification:**
   - Business verification (usually 1-3 business days)
   - Required documents:
     - Business registration documents
     - Tax ID / EIN
     - Phone verification
     - Domain verification (sometimes)

4. **Download certificate:**
   - Provider sends `.pfx` or `.p12` file
   - Save securely with password

#### Step 2: Convert Certificate for GitHub Secrets

Convert the `.pfx` file to base64 for secure storage in GitHub:

**On macOS/Linux:**

```bash
base64 -i your-certificate.pfx -o certificate-base64.txt
cat certificate-base64.txt | pbcopy  # Copies to clipboard
```

**On Windows (PowerShell):**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("your-certificate.pfx")) | Out-File certificate-base64.txt
Get-Content certificate-base64.txt | Set-Clipboard
```

#### Step 3: Test Certificate Locally (Optional)

Test on Windows machine before adding to CI/CD:

```powershell
# Install certificate to test
# (Right-click .pfx → Install PFX → Enter password)

# Test signing manually
signtool sign /f your-certificate.pfx /p YOUR_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "YourApp.exe"

# Verify signature
signtool verify /pa "YourApp.exe"
```

---

### Windows GitHub Integration

#### Step 1: Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these two secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` file content | Certificate file |
| `WIN_CSC_KEY_PASSWORD` | Certificate password | Password for `.pfx` file |

#### Step 2: Update GitHub Actions Workflow

In `.github/workflows/build-desktop.yml`:

```yaml
- name: Build Electron app (Windows)
  if: matrix.platform == 'windows'
  working-directory: electron
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
  run: |
    if [[ "${{ github.ref }}" == refs/tags/* ]]; then
      npx electron-builder --win --x64 --publish=always
    else
      npx electron-builder --win --x64
    fi
```

**Note:** electron-builder automatically detects `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables and signs Windows builds.

#### Step 3: Verify Signing in CI/CD

After the build completes:

1. Download the `.exe` installer from GitHub Releases
2. Right-click → Properties → Digital Signatures tab
3. Should show your certificate details and valid signature

---

### Windows Troubleshooting

#### "SmartScreen can't be reached" Warning

**Problem:** Even with valid signature, Windows shows SmartScreen warning.

**Cause:** New certificates lack reputation. Windows SmartScreen builds reputation over time based on:

- Number of downloads
- Number of users who run the app
- Time since first signature

**Solutions:**

- This is normal for new certificates
- Reputation builds over weeks/months as more users download
- EV Code Signing certificates get instant reputation (expensive)
- For beta testing, users can click "More info" → "Run anyway"

#### "Unknown Publisher" Warning

**Problem:** App shows as "Unknown Publisher" even though it's signed.

**Possible causes:**

1. Certificate not trusted by Windows (wrong CA)
2. Certificate expired
3. Timestamp server unreachable during signing
4. Wrong signing algorithm (use SHA-256, not SHA-1)

**Solutions:**

- Verify certificate is from trusted CA (DigiCert, Sectigo, etc.)
- Check certificate expiration date
- Ensure electron-builder uses SHA-256 timestamps
- Use timestamp server: `http://timestamp.digicert.com` or `http://timestamp.sectigo.com`

#### Signature Verification Fails

**Problem:** `signtool verify` fails even though signing succeeded.

**Solutions:**

```powershell
# Check if certificate chain is complete
certutil -verify your-certificate.pfx

# Re-import certificate with full chain
# Right-click .pfx → Install → Include all certificates in chain
```

---

### Best Practices for Windows Signing

1. **Always use SHA-256** (not SHA-1, deprecated)
2. **Include timestamp** - allows signature to remain valid after certificate expires
3. **Use dual signatures** - SHA-1 for older Windows + SHA-256 for newer Windows (electron-builder does this automatically)
4. **Test on clean Windows VM** before releasing
5. **Renew certificates before expiration** - allow 30-day buffer
6. **Keep certificate password secure** - use GitHub secrets, never commit to code

---

### Cost Comparison

| Provider | Standard Certificate | EV Certificate | Renewal |
|----------|---------------------|----------------|---------|
| DigiCert | ~$474/year | ~$595/year | Same price |
| Sectigo | ~$199/year | ~$349/year | Often discounted |
| SSL.com | ~$179/year | ~$299/year | Often discounted |

**Note:** Prices vary. Check provider websites for current pricing. Multi-year purchases often get discounts.

---

### When to Skip Windows Code Signing

You can safely skip Windows code signing if:

- ✅ Beta testing only (testers can bypass SmartScreen)
- ✅ Internal company distribution
- ✅ Budget constraints (can add later)
- ✅ Low download volume

You should get Windows code signing if:

- 🔐 Public production release
- 🔐 Professional image important
- 🔐 Non-technical users (can't bypass SmartScreen easily)
- 🔐 High download volume

---

**Last Updated:** 2025-10-19

**Tested With:**

- Electron 27.3.11
- electron-builder 24.13.3
- @electron/notarize 2.1.0
- macOS 14.6 (Sonoma)
- Windows 11 (code signing)
