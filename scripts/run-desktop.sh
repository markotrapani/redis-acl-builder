#!/bin/bash
# Run the Electron desktop app (will be implemented in v2.0)
# Usage: ./scripts/run-desktop.sh

cd "$(dirname "$0")/.."

echo "🖥️  Starting Redis ACL Builder (Desktop App)..."
echo "📍 Working directory: $(pwd)"
echo ""

if [ ! -d "electron" ]; then
    echo "❌ Electron directory not found!"
    echo "The desktop app will be implemented in v2.0."
    echo "For now, use the web app: ./scripts/run-web.sh"
    exit 1
fi

# Run Electron
cd electron
npm start
