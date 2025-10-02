# Redis ACL Builder v1.13.0-beta - Distribution Package

## 📦 Package Contents

This distribution package contains:

- `Dockerfile` - Production-ready Docker image configuration
- `BETA-README.md` - Comprehensive user guide
- `deploy-beta.sh` - Automated deployment script
- `docker-compose.yml` - Docker Compose configuration
- Source code and configuration files
- **Note**: Docker image files (*.tar) are generated locally due to GitHub's 100MB file size limit

## 🚀 Quick Start Options

### Option 1: Automated Deployment (Recommended)

```bash
# Navigate to the docker folder
cd docker

# Make the script executable and run it
chmod +x deploy-beta.sh
./deploy-beta.sh
```

This script will:

- Check Docker installation
- Verify port 8000 availability
- Build and deploy the application
- Perform health checks
- Provide access information

### Option 2: Build and Run Manually

```bash
# Build the Docker image
docker build -t redis-acl-builder:1.13.0-beta -f Dockerfile ..

# Run the container
docker run -d -p 8000:8000 --name redis-acl-builder redis-acl-builder:1.13.0-beta

# Access the application
open http://localhost:8000
```

### Option 3: Docker Compose

```bash
# Navigate to docker folder and start with Docker Compose
cd docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📋 System Requirements

- **Docker**: Version 20.10 or later
- **Memory**: Minimum 512MB available
- **Port**: 8000 must be available
- **OS**: Any Docker-supported platform (Linux, macOS, Windows)

## ✅ Verification

Once deployed, verify the installation:

```bash
# Check container status
docker ps

# Test API endpoint
curl http://localhost:8000/api/categories

# Check health
curl http://localhost:8000/
```

Expected response: HTTP 200 with the Redis ACL Builder interface.

## 🔧 Configuration

The application runs with production settings:

- **Port**: 8000
- **Workers**: 4 Gunicorn workers
- **Environment**: Production mode
- **Logging**: Info level
- **Health Checks**: Built-in monitoring

## 📖 Full Documentation

See `BETA-README.md` for complete feature documentation, API reference, and testing guidelines.

## 🆘 Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8000
lsof -i :8000

# Use different port
docker run -d -p 8080:8000 --name redis-acl-builder redis-acl-builder:1.13.0-beta
```

### Container Won't Start

```bash
# Check container logs
docker logs redis-acl-builder

# Remove and retry
docker stop redis-acl-builder && docker rm redis-acl-builder
./deploy-beta.sh
```

### Docker Permission Issues (Linux)

```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in, then retry
```

---

**Ready to test the future of Redis ACL management!** 🎯
