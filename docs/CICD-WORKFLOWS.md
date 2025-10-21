# CI/CD Workflows Guide

Complete reference for GitHub Actions workflows used in this project. Use this as a template for future projects.

## Table of Contents

- [Overview](#overview)
- [Workflow: Desktop App Build](#workflow-desktop-app-build)
- [Workflow: Docker Build & Publish](#workflow-docker-build--publish)
- [Secrets Management](#secrets-management)
- [Release Automation](#release-automation)
- [Best Practices](#best-practices)

---

## Overview

This project uses GitHub Actions for continuous integration and deployment:

1. **Desktop Apps Workflow** (`build-desktop.yml`)
   - Multi-platform builds (macOS, Windows, Linux)
   - Code signing and notarization (macOS)
   - Automated GitHub releases with installers

2. **Docker Workflow** (`build-docker.yml`)
   - Multi-architecture builds (amd64, arm64)
   - Automated Docker Hub publishing
   - Intelligent tag management

**Trigger Strategy:**

- Tag-based releases: `v*.*.*`, `v*.*.*-alpha`, `v*.*.*-beta`
- Special suffixes control which workflows run:
  - No suffix or `-alpha`/`-beta`: Triggers both workflows
  - `-desktop`: Desktop apps only (future)
  - `-docs`: Documentation only (no builds)
  - `-docker`: Docker only (future)

---

## Workflow: Desktop App Build

**File:** `.github/workflows/build-desktop.yml`

### Architecture

```text
┌─────────────────┐
│   Push v*.*.    │
│      Tag         │
└────────┬─────────┘
         │
    ┌────▼────┐
    │ Trigger │
    │ Workflow│
    └────┬────┘
         │
    ┌────▼──────────────────────────────────────┐
    │    Matrix Build (3 platforms)             │
    │  ┌──────────┐ ┌───────────┐ ┌──────────┐ │
    │  │  macOS   │ │  Windows  │ │  Linux   │ │
    │  │ (ARM+x64)│ │   (x64)   │ │  (x64)   │ │
    │  └─────┬────┘ └─────┬─────┘ └────┬─────┘ │
    │        │            │             │       │
    │        └────────────┴─────────────┘       │
    └──────────────────┬─────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Create Release │
              │  Upload Assets  │
              └─────────────────┘
```

### Full Workflow File

```yaml
name: Build Desktop Apps (Multi-Platform)

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'           # v2.1.8
      - 'v[0-9]+.[0-9]+.[0-9]+-alpha'     # v2.1.8-alpha
      - 'v[0-9]+.[0-9]+.[0-9]+-beta'      # v2.1.8-beta
      - 'v[0-9]+.[0-9]+.[0-9]+-desktop'   # v2.1.8-desktop (future)
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g., v2.0.3-alpha)'
        required: false
        default: 'manual-build'

permissions:
  contents: write  # Required for creating releases

jobs:
  build:
    name: Build ${{ matrix.os }} Desktop App
    runs-on: ${{ matrix.os }}

    strategy:
      fail-fast: false
      matrix:
        include:
          # macOS builds (ARM64 + Intel)
          - os: macos-latest
            platform: mac
            arch: 'arm64 x64'
            python_version: '3.12'
            artifact_name: 'macos-dmg'

          # Windows build
          - os: windows-latest
            platform: win
            arch: 'x64'
            python_version: '3.12'
            artifact_name: 'windows-installer'

          # Linux build
          - os: ubuntu-latest
            platform: linux
            arch: 'x64'
            python_version: '3.12'
            artifact_name: 'linux-packages'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Python ${{ matrix.python_version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python_version }}
          cache: 'pip'
          cache-dependency-path: backend/requirements-prod.txt

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: electron/package-lock.json

      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements-prod.txt
          pip install pyinstaller

      - name: Cache PyInstaller build
        uses: actions/cache@v4
        with:
          path: |
            backend/build
            backend/dist
          key: ${{ runner.os }}-pyinstaller-${{ hashFiles('backend/**/*.py', 'backend/requirements-prod.txt') }}
          restore-keys: |
            ${{ runner.os }}-pyinstaller-

      - name: Build Python backend with PyInstaller (macOS/Linux)
        if: matrix.platform != 'win'
        working-directory: backend
        run: |
          pyinstaller redis-acl-builder.spec
          ls -lah dist/redis-acl-builder-backend/
          mkdir -p ../dist
          mv dist/redis-acl-builder-backend ../dist/

      - name: Build Python backend with PyInstaller (Windows)
        if: matrix.platform == 'win'
        working-directory: backend
        shell: pwsh
        run: |
          pyinstaller redis-acl-builder.spec
          New-Item -ItemType Directory -Force -Path ../dist
          Move-Item -Path dist/redis-acl-builder-backend -Destination ../dist/

      - name: Install Electron dependencies
        working-directory: electron
        run: npm ci

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

      - name: Build Electron app (Windows)
        if: matrix.platform == 'win'
        working-directory: electron
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if ("${{ github.ref }}".StartsWith("refs/tags/")) {
            npx electron-builder --win --publish=always
          } else {
            npm run build:win
          }

      - name: Build Electron app (Linux)
        if: matrix.platform == 'linux'
        working-directory: electron
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [[ "${{ github.ref }}" == refs/tags/* ]]; then
            npx electron-builder --linux --publish=always
          else
            npm run build:linux
          fi

      - name: Upload macOS artifacts
        if: matrix.platform == 'mac'
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: |
            electron/dist/*.dmg
            electron/dist/*.zip
            electron/dist/latest-mac.yml
          retention-days: 30

      - name: Upload Windows artifacts
        if: matrix.platform == 'win'
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: |
            electron/dist/*.exe
            electron/dist/latest.yml
          retention-days: 30

      - name: Upload Linux artifacts
        if: matrix.platform == 'linux'
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: |
            electron/dist/*.AppImage
            electron/dist/latest-linux.yml
          retention-days: 30

  release:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    needs: build
    if: startsWith(github.ref, 'refs/tags/')

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: ./artifacts

      - name: Extract version from tag
        id: version
        run: |
          VERSION="${GITHUB_REF#refs/tags/}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Clean up draft releases
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          DRAFT_IDS=$(gh api /repos/${{ github.repository }}/releases \
            --jq ".[] | select(.draft == true and .tag_name == \"$VERSION\") | .id")

          if [ -n "$DRAFT_IDS" ]; then
            for ID in $DRAFT_IDS; do
              gh api -X DELETE /repos/${{ github.repository }}/releases/$ID
            done
          fi

      - name: Generate release notes
        id: release_notes
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          PREV_TAG=$(git describe --abbrev=0 --tags HEAD^ 2>/dev/null || echo "")

          if [ -n "$PREV_TAG" ]; then
            COMMITS=$(git log ${PREV_TAG}..HEAD --pretty=format:"- %s" --no-merges)
          else
            COMMITS=$(git log --pretty=format:"- %s" --no-merges -10)
          fi

          cat > release_notes.md << EOF
          ## ${VERSION} - Automated Release

          ### Key Changes

          📦 Multi-Platform Desktop Build
          ⚡ Auto-Update Ready
          🐳 Docker Image Available

          <details>
          <summary><b>📝 Commits in This Release</b></summary>

          ${COMMITS}

          </details>
          EOF

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            artifacts/**/*.dmg
            artifacts/**/*.zip
            artifacts/**/*.exe
            artifacts/**/*.AppImage
            artifacts/**/*.yml
          body_path: release_notes.md
          draft: false
          prerelease: ${{ contains(github.ref, '-alpha') || contains(github.ref, '-beta') }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Key Features

1. **Matrix Strategy** - Parallel builds across platforms
2. **Conditional Publishing** - Only publish on tag pushes
3. **Artifact Caching** - PyInstaller and npm caches for faster builds
4. **Release Automation** - Automatic GitHub release creation
5. **Draft Cleanup** - Removes stale draft releases

### Build Times

| Platform | Without Notarization | With Notarization |
|----------|---------------------|-------------------|
| macOS    | 2-3 min            | 10-20 min         |
| Windows  | 2-3 min            | 2-3 min           |
| Linux    | 1-2 min            | 1-2 min           |

---

## Workflow: Docker Build & Publish

**File:** `.github/workflows/build-docker.yml`

### Docker Build Architecture

```text
┌────────────────┐
│ Push v*.*.*    │
│     Tag        │
└───────┬────────┘
        │
   ┌────▼─────┐
   │ Extract  │
   │ Version  │
   │  Tags    │
   └────┬─────┘
        │
   ┌────▼──────────────────┐
   │ Build Multi-Arch      │
   │ (amd64 + arm64)       │
   └────┬──────────────────┘
        │
   ┌────▼──────────────────┐
   │ Push to Docker Hub    │
   │ - v2.2.7-beta         │
   │ - 2.2-beta (minor)    │
   │ - 2-beta (major)      │
   │ - beta (latest beta)  │
   └───────────────────────┘
```

### Full Workflow File

```yaml
name: Build and Publish Docker Images

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'       # v2.1.8
      - 'v[0-9]+.[0-9]+.[0-9]+-*'     # v2.1.8-alpha, v2.1.8-beta
  workflow_dispatch:

permissions:
  contents: read

jobs:
  docker:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract version and tags
        id: meta
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}

          # Determine if pre-release
          if [[ $VERSION =~ -alpha$ ]]; then
            SUFFIX="-alpha"
            MAJOR=$(echo $VERSION | cut -d. -f1)
            MINOR=$(echo $VERSION | cut -d. -f1-2)
            echo "tags=markotrapani608/redis-acl-builder:${VERSION},markotrapani608/redis-acl-builder:${MINOR}${SUFFIX},markotrapani608/redis-acl-builder:${MAJOR}${SUFFIX},markotrapani608/redis-acl-builder:alpha" >> $GITHUB_OUTPUT
          elif [[ $VERSION =~ -beta$ ]]; then
            SUFFIX="-beta"
            MAJOR=$(echo $VERSION | cut -d. -f1)
            MINOR=$(echo $VERSION | cut -d. -f1-2)
            echo "tags=markotrapani608/redis-acl-builder:${VERSION},markotrapani608/redis-acl-builder:${MINOR}${SUFFIX},markotrapani608/redis-acl-builder:${MAJOR}${SUFFIX},markotrapani608/redis-acl-builder:beta" >> $GITHUB_OUTPUT
          else
            MAJOR=$(echo $VERSION | cut -d. -f1)
            MINOR=$(echo $VERSION | cut -d. -f1-2)
            echo "tags=markotrapani608/redis-acl-builder:${VERSION},markotrapani608/redis-acl-builder:${MINOR},markotrapani608/redis-acl-builder:${MAJOR},markotrapani608/redis-acl-builder:latest" >> $GITHUB_OUTPUT
          fi

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Tag Strategy

| Version Tag | Docker Tags Created |
|-------------|-------------------|
| `v2.2.7` | `2.2.7`, `2.2`, `2`, `latest` |
| `v2.2.7-beta` | `2.2.7-beta`, `2.2-beta`, `2-beta`, `beta` |
| `v2.2.7-alpha` | `2.2.7-alpha`, `2.2-alpha`, `2-alpha`, `alpha` |

---

## Secrets Management

### Required Secrets

#### Code Signing (macOS)

| Secret | Description | How to Get |
|--------|-------------|------------|
| `CSC_LINK` | Base64-encoded `.p12` certificate | See [Code Signing Guide](./CODE-SIGNING.md) |
| `CSC_KEY_PASSWORD` | Certificate password | Password used when exporting `.p12` |

#### Notarization (macOS)

| Secret | Description | How to Get |
|--------|-------------|------------|
| `APPLE_API_KEY` | Base64-encoded `.p8` API key | See [Notarization Guide](./MACOS-NOTARIZATION.md) |
| `APPLE_API_ISSUER` | App Store Connect Issuer ID | UUID from App Store Connect API page |
| `APPLE_API_KEY_ID` | API Key ID | 10-char ID from App Store Connect |

#### Docker Hub

| Secret | Description | How to Get |
|--------|-------------|------------|
| `DOCKERHUB_USERNAME` | Docker Hub username | Your Docker Hub account name |
| `DOCKERHUB_TOKEN` | Docker Hub access token | Account Settings → Security → Access Tokens |

### Adding Secrets

```bash
# Using GitHub CLI
gh secret set SECRET_NAME -R owner/repo

# Or via web UI:
# GitHub Repo → Settings → Secrets and variables → Actions → New repository secret
```

---

## Release Automation

### Triggering a Release

1. **Update version numbers** in all files:

   ```bash
   # backend/helpers/__init__.py
   __version__ = "2.2.7-beta"

   # electron/package.json
   "version": "2.2.7-beta"
   ```

2. **Commit version updates:**

   ```bash
   git add backend/helpers/__init__.py electron/package.json
   git commit -m "chore: Bump version to v2.2.7-beta"
   git push origin main
   ```

3. **Create and push tag:**

   ```bash
   git tag v2.2.7-beta
   git push origin v2.2.7-beta
   ```

4. **Monitor builds:**

   ```bash
   # Watch Desktop Apps build
   gh run watch --interval 30 -R owner/repo

   # Watch Docker build
   gh run list -R owner/repo --limit 5
   ```

### Release Artifacts

After successful build, GitHub Release will contain:

**macOS:**

- `YourApp-{version}-arm64.dmg` - ARM64 installer
- `YourApp-{version}-arm64.zip` - ARM64 update package
- `YourApp-{version}-x64.dmg` - Intel installer
- `YourApp-{version}-x64.zip` - Intel update package
- `latest-mac.yml` - Auto-update metadata

**Windows:**

- `YourApp-{version}-x64.exe` - Installer + updater
- `latest.yml` - Auto-update metadata

**Linux:**

- `YourApp-{version}-x86_64.AppImage` - Portable app
- `latest-linux.yml` - Auto-update metadata

### Cleaning Up Releases

```bash
# Delete a release and its tag
gh release delete v2.2.7-beta -R owner/repo --yes
git tag -d v2.2.7-beta
git push origin :refs/tags/v2.2.7-beta

# Delete old draft releases
gh api /repos/owner/repo/releases \
  --jq '.[] | select(.draft == true) | .id' \
  | xargs -I {} gh api -X DELETE /repos/owner/repo/releases/{}
```

---

## Best Practices

### 1. Version Management

✅ **Do:**

- Use semantic versioning (major.minor.patch)
- Add suffixes for pre-releases (`-alpha`, `-beta`)
- Update all version references before tagging
- Use consistent version format across all files

❌ **Don't:**

- Mix version formats (v2.2.7 vs 2.2.7)
- Skip version updates in any file
- Reuse version tags
- Push versions with local changes

### 2. Build Optimization

✅ **Do:**

- Use caching for dependencies (npm, pip, PyInstaller)
- Run builds in parallel with matrix strategy
- Set `fail-fast: false` to see all platform failures
- Use `--publish=always` only for tag pushes

❌ **Don't:**

- Rebuild dependencies every time
- Run builds sequentially
- Fail entire build on single platform failure
- Publish from manual/branch builds

### 3. Secret Security

✅ **Do:**

- Rotate secrets periodically (every 6-12 months)
- Use separate secrets for dev/prod
- Base64-encode binary secrets (certificates, keys)
- Document what each secret is for

❌ **Don't:**

- Commit secrets to repository
- Share secrets across multiple projects
- Use production secrets for testing
- Hard-code secrets in workflows

### 4. Release Notes

✅ **Do:**

- Auto-generate from commit messages
- Use collapsible sections for details
- Include installation instructions
- Link to detailed changelogs

❌ **Don't:**

- Copy-paste from previous releases
- Include internal/technical jargon
- Forget to update for each release
- Make notes too verbose

### 5. Monitoring

✅ **Do:**

- Watch builds in real-time for important releases
- Check artifact sizes for bloat
- Verify release assets after publishing
- Test installers from actual release

❌ **Don't:**

- Assume build succeeded without checking
- Ignore warnings in build logs
- Skip testing release artifacts
- Push fixes without verifying root cause

---

## Troubleshooting

### Build Fails on One Platform

**Check:**

- Platform-specific dependencies
- Path separators (Windows uses `\`)
- Shell syntax (`bash` vs `pwsh`)
- Architecture compatibility (arm64 vs x64)

**Solution:**

```yaml
# Use conditional steps
- name: Step for Windows only
  if: runner.os == 'Windows'
  shell: pwsh
  run: |
    # PowerShell commands here

- name: Step for Unix only
  if: runner.os != 'Windows'
  run: |
    # Bash commands here
```

### Artifacts Not Uploading

**Check:**

- File paths are correct
- Files actually exist at build time
- Upload paths use `*` wildcards correctly
- Artifacts aren't too large (>2GB warning)

**Solution:**

```yaml
# List files before upload
- name: List build artifacts
  run: find dist/ -type f -name "*.dmg" -o -name "*.zip"

# Then upload
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    path: dist/*.{dmg,zip}
```

### Release Creation Fails

**Check:**

- `contents: write` permission set
- No duplicate releases exist
- Tag exists and matches trigger pattern
- Artifact downloads completed

**Solution:**

```yaml
# Add cleanup step
- name: Clean up existing release
  continue-on-error: true
  run: gh release delete ${{ github.ref_name }} --yes
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Docker Build Fails

**Check:**

- Dockerfile syntax
- Base image availability
- Multi-platform support (arm64)
- Build context size

**Solution:**

```yaml
# Add debug output
- name: Docker build debug
  run: |
    docker buildx ls
    docker buildx inspect --bootstrap

# Build single platform first
- name: Test build (amd64 only)
  run: docker buildx build --platform linux/amd64 .
```

---

## Template Checklist

When setting up CI/CD for a new project:

- [ ] Copy workflow files to `.github/workflows/`
- [ ] Update repository name in all workflows
- [ ] Configure required secrets
- [ ] Update version numbers in workflow triggers
- [ ] Customize release notes template
- [ ] Test manual workflow dispatch first
- [ ] Verify artifact sizes and retention
- [ ] Document any project-specific steps
- [ ] Set up status badge in README
- [ ] Configure branch protection rules

---

**Last Updated:** 2025-10-19
**Tested With:**

- GitHub Actions (ubuntu-latest, macos-latest, windows-latest)
- electron-builder 24.13.3
- Docker Buildx 0.12.0
