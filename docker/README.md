# Redis ACL Builder - Docker Deployment

This folder contains all Docker-related files for the Redis ACL Builder v1.15.12-beta.

## 📁 Contents

- `Dockerfile` - Production-ready Docker image configuration
- `.dockerignore` - Docker build context optimization
- `docker-compose.yml` - Docker Compose configuration
- `deploy-beta.sh` - Automated deployment script
- `BETA-README.md` - Complete beta testing documentation
- `DISTRIBUTION-README.md` - Distribution package instructions
- **Note**: Docker image files (*.tar) are built locally (not stored in git due to 100MB+ size)

## 🚀 Quick Start

### Option 1: Docker Hub (Fastest)

```bash
# Run the latest version directly from Docker Hub
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest

# Access the application
open http://localhost:7380
```

#### Upgrade to Latest Version (One-Liner)

```bash
# Stop, remove, pull latest, and restart with one command
docker stop redis-acl-builder 2>/dev/null; docker rm redis-acl-builder 2>/dev/null; docker pull markotrapani608/redis-acl-builder:latest && docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest
```

### Option 2: Automated Script (Build Locally)

```bash
chmod +x deploy-beta.sh
./deploy-beta.sh
```

### Option 2: Docker Compose

```bash
docker-compose up -d
```

### Option 4: Build and Export Image (for distribution)

```bash
# Build image
docker build -t redis-acl-builder:1.15.12-beta -f Dockerfile ..

# Export image (if needed for distribution) - uncompressed for simplicity
docker save redis-acl-builder:1.15.12-beta > redis-acl-builder-1.15.12-beta.tar

# Run with consistent naming and restart policy
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped redis-acl-builder:1.15.12-beta
```

### Option 5: Alternative Build Locations

```bash
# From docker folder
docker build -t redis-acl-builder:1.15.12-beta -f Dockerfile ..
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped redis-acl-builder:1.15.12-beta

# From project root
docker build -t redis-acl-builder:1.15.12-beta -f docker/Dockerfile .
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped redis-acl-builder:1.15.12-beta
```

## 📋 Image Details

- **Base Image**: python:3.13-alpine
- **Runtime**: Gunicorn with 4 workers
- **Port**: 7380
- **Health Checks**: Built-in HTTP health monitoring
- **Security**: Non-root user execution
- **Size**: ~252MB (compressed: 120MB)

## 🔧 Configuration

The Docker image is configured for production use with:

- Production Flask environment (`FLASK_ENV=production`)
- Debug mode disabled (`FLASK_DEBUG=False`)
- Gunicorn WSGI server with 4 worker processes
- 120-second timeout for long-running requests
- Automatic restart on failure

## 📖 Full Documentation

- See `BETA-README.md` for complete feature documentation
- See `DISTRIBUTION-README.md` for distribution package details
- See `../CLAUDE.md` for development and project information

## 🆘 Support

For issues with Docker deployment:

1. Check container logs: `docker logs redis-acl-builder`
2. Verify port availability: `lsof -i :7380`
3. Test manually: `curl http://localhost:7380/`

The application should be accessible at <http://localhost:7380> once deployed.
