#!/bin/bash

# Redis ACL Builder Beta Deployment Script
# Version 1.14.1-beta

set -e

echo "🚀 Redis ACL Builder Beta v1.21.0-beta - Deployment Script"
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if port 7380 is available
if lsof -Pi :7380 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 7380 is already in use. Please stop the service using port 7380 or choose a different port."
    echo "   You can check what's using the port with: lsof -i :7380"
    exit 1
fi

echo "✅ Docker is available"
echo "✅ Port 7380 is free"

# Stop and remove existing container if it exists
if docker ps -a --format 'table {{.Names}}' | grep -q "redis-acl-builder"; then
    echo "🔄 Stopping existing redis-acl-builder container..."
    docker stop redis-acl-builder 2>/dev/null || true
    docker rm redis-acl-builder 2>/dev/null || true
fi

# Build the optimized Docker image (multi-stage Alpine build: ~110MB vs 1.23GB)
echo "🔨 Building optimized Docker image (multi-stage Alpine build with Python 3.13)..."
echo "   📦 Target size: ~110MB (91% reduction from 1.23GB, improved security)"
docker build -t redis-acl-builder:1.21.0-beta -f Dockerfile ..

# Run the container
echo "🐳 Starting Redis ACL Builder container..."
docker run -d \
    --name redis-acl-builder \
    -p 7380:7380 \
    --restart unless-stopped \
    redis-acl-builder:1.21.0-beta

# Wait for container to be healthy
echo "⏳ Waiting for application to start..."
sleep 5

# Check if container is running
if docker ps --format 'table {{.Names}}' | grep -q "redis-acl-builder"; then
    echo "✅ Container is running successfully!"
    
    # Test the application
    if curl -f -s http://localhost:7380/ > /dev/null; then
        echo "✅ Application is responding correctly!"
        echo ""
        echo "🎉 SUCCESS! Redis ACL Builder is now running at:"
        echo "   http://localhost:7380"
        echo ""
        echo "📊 Container Status:"
        docker ps --filter name=redis-acl-builder --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "📝 To view logs: docker logs redis-acl-builder"
        echo "🛑 To stop: docker stop redis-acl-builder"
        echo "🔄 To restart: docker restart redis-acl-builder"
    else
        echo "❌ Application is not responding. Checking container logs..."
        docker logs redis-acl-builder
        exit 1
    fi
else
    echo "❌ Container failed to start. Checking logs..."
    docker logs redis-acl-builder 2>/dev/null || echo "No logs available"
    exit 1
fi