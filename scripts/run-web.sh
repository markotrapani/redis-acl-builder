#!/bin/bash
# Run the web app in development mode
# Usage: ./scripts/run-web.sh

cd "$(dirname "$0")/.."

echo "🚀 Starting Redis ACL Builder (Web App)..."
echo "📍 Working directory: $(pwd)"
echo ""

# Activate virtual environment
if [ -d "venv" ]; then
    echo "✅ Activating virtual environment..."
    source venv/bin/activate
else
    echo "❌ Virtual environment not found!"
    echo "Please run: python -m venv venv && source venv/bin/activate && pip install -r backend/requirements.txt"
    exit 1
fi

# Run the Flask app
echo "🌐 Starting Flask server..."
python backend/app.py
