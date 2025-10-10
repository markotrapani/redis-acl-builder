#!/bin/bash
# Build the Docker image for web deployment
# Usage: ./scripts/build-web.sh

cd "$(dirname "$0")/.."

echo "🐳 Building Redis ACL Builder Docker Image..."
echo "📍 Working directory: $(pwd)"
echo ""

# Build Docker image from docker/ directory
cd docker
docker build -t redis-acl-builder:latest -f Dockerfile ..

echo ""
echo "✅ Docker build complete!"
echo "🚀 To run: docker run -d -p 7380:7380 --name redis-acl-builder redis-acl-builder:latest"
