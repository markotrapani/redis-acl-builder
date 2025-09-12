# Redis ACL Builder - Docker Deployment

This folder contains all Docker-related files for the Redis ACL Builder v1.7.0-beta.

## 📁 Contents

- `Dockerfile` - Production-ready Docker image configuration
- `.dockerignore` - Docker build context optimization
- `docker-compose.yml` - Docker Compose configuration
- `deploy-beta.sh` - Automated deployment script
- `BETA-README.md` - Complete beta testing documentation
- `DISTRIBUTION-README.md` - Distribution package instructions
- **Note**: Docker image files (*.tar) are built locally (not stored in git due to 100MB+ size)

## 🚀 Quick Start

### Option 1: Automated Script (Recommended)
```bash
chmod +x deploy-beta.sh
./deploy-beta.sh
```

### Option 2: Docker Compose
```bash
docker-compose up -d
```

### Option 3: Build and Export Image (for distribution)
```bash
# Build image
docker build -t redis-acl-builder:v1.7.0-beta -f Dockerfile ..

# Export image (if needed for distribution) - uncompressed for simplicity
docker save redis-acl-builder:v1.7.0-beta > redis-acl-builder-v1.7.0-beta.tar

# Run
docker run -d -p 8000:8000 --name redis-acl-builder redis-acl-builder:v1.7.0-beta
```

### Option 4: Alternative Build Locations
```bash
# From docker folder
docker build -t redis-acl-builder:v1.7.0-beta -f Dockerfile ..

# From project root
docker build -t redis-acl-builder:v1.7.0-beta -f docker/Dockerfile .
```

## 📋 Image Details

- **Base Image**: python:3.12-slim
- **Runtime**: Gunicorn with 4 workers
- **Port**: 8000
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
2. Verify port availability: `lsof -i :8000`
3. Test manually: `curl http://localhost:8000/`

The application should be accessible at http://localhost:8000 once deployed.