#!/bin/bash
# Local desktop build script for Redis ACL Builder
# This script builds a complete local DMG with all the correct paths

set -e  # Exit on error

echo "============================================================"
echo "Redis ACL Builder - Local Desktop Build"
echo "============================================================"

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

echo ""
echo "Step 1: Clean previous builds..."
rm -rf dist/ backend/dist/ backend/build/ electron/dist/
echo "✅ Cleaned"

echo ""
echo "Step 2: Rebuild minified CSS/JS assets..."
python3 scripts/build_minified.py
echo "✅ Minified assets built"

echo ""
echo "Step 3: Build PyInstaller backend bundle..."
cd backend
source ../venv/bin/activate
pyinstaller redis-acl-builder.spec --clean --noconfirm --distpath ../dist
cd ..
echo "✅ PyInstaller bundle built to dist/redis-acl-builder-backend/"

echo ""
echo "Step 4: Verify backend bundle structure..."
if [ ! -d "dist/redis-acl-builder-backend/_internal" ]; then
    echo "❌ ERROR: Backend bundle missing _internal directory!"
    exit 1
fi
echo "✅ Backend bundle structure verified"

echo ""
echo "Step 5: Build Electron desktop app..."
cd electron
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac -- --arm64
cd ..
echo "✅ Electron app built"

echo ""
echo "Step 6: Verify Electron app bundle..."
ELECTRON_BUNDLE="electron/dist/mac-arm64/Redis ACL Builder.app"
if [ ! -d "$ELECTRON_BUNDLE" ]; then
    echo "❌ ERROR: Electron app bundle not found!"
    exit 1
fi

BACKEND_IN_APP="$ELECTRON_BUNDLE/Contents/Resources/dist/redis-acl-builder-backend"
if [ ! -d "$BACKEND_IN_APP/_internal" ]; then
    echo "❌ ERROR: Electron app missing backend _internal directory!"
    exit 1
fi
echo "✅ Electron app bundle verified"

echo ""
echo "============================================================"
echo "✅ Build Complete!"
echo "============================================================"
echo ""
echo "DMG Location:"
echo "  electron/dist/Redis-ACL-Builder-*.dmg"
echo ""
echo "To install:"
echo "  open electron/dist/Redis-ACL-Builder-*-arm64.dmg"
echo ""
