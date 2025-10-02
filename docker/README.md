# Redis ACL Builder - Docker Deployment

**Version v1.21.0-beta** - Testing Section Drag-and-Drop

A comprehensive web application for testing and validating Redis Access Control List (ACL) rules with real-time command analysis, featuring Rule Selectors, Advanced Key Permissions, and an elegant drag-drop interface.

## 🚀 Quick Start

### Pull and Run from Docker Hub

```bash
# Run the latest version
docker run -d \
  --name redis-acl-builder \
  -p 7380:7380 \
  --restart unless-stopped \
  markotrapani608/redis-acl-builder:latest

# Access the application
open http://localhost:7380
```

### Version-Specific Tags

```bash
# Latest stable
docker pull markotrapani608/redis-acl-builder:latest

# Specific version
docker pull markotrapani608/redis-acl-builder:v1.21.0-beta

# Beta releases
docker pull markotrapani608/redis-acl-builder:beta
```

### Upgrade to Latest Version (One-Liner)

```bash
# Stop, remove, pull latest, and restart
docker stop redis-acl-builder 2>/dev/null; \
docker rm redis-acl-builder 2>/dev/null; \
docker pull markotrapani608/redis-acl-builder:latest && \
docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped markotrapani608/redis-acl-builder:latest
```

## 🎯 Key Features

### Rule Selectors
- Full UI integration for selector syntax `(+@read ~logs:*)`
- Perfect isolation between root and selector key patterns
- OR logic: commands granted if root OR any selector permits
- Enhanced testing showing which selector granted access

### Advanced Key Permissions
- Read-only keys: `%R~pattern`
- Write-only keys: `%W~pattern`
- Read-write keys: `%RW~pattern` or `~pattern`
- Smart error messages for permission mismatches

### Interactive Interface
- 8-way resizable panels with drag-drop reordering
- Dual testing modes: split or integrated
- Real-time validation with auto-optimization
- Light/dark theme with system preference detection

### Redis Support
- Full Redis 7 (311 commands, 21 categories)
- Full Redis 8 (446 commands, 29 categories including modules)
- Module support: RediSearch, RedisJSON, TimeSeries, Bloom, etc.

## 📋 Image Details

- **Base**: python:3.13-alpine
- **Runtime**: Gunicorn with 4 workers
- **Port**: 7380
- **Architecture**: AMD64, ARM64
- **Size**: ~110MB (multi-arch)
- **Security**: Non-root user execution, CVE scanned

## 🔧 Configuration

The image is production-ready with:
- Production Flask environment
- Debug mode disabled
- Automatic health checks every 30 seconds
- Graceful restart on failure
- 4 Gunicorn workers with automatic recycling

## 🆘 Troubleshooting

```bash
# Check container logs
docker logs redis-acl-builder

# Verify port availability
lsof -i :7380

# Test connectivity
curl http://localhost:7380/

# Restart container
docker restart redis-acl-builder
```

## 📧 Support

For questions about usage, feedback, or to report bugs, please reach out to:
- **Email**: marko.trapani@redis.com
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/markotrapani/marko-projects/issues)

## 📚 Additional Resources

- **GitHub Repository**: [markotrapani/marko-projects](https://github.com/markotrapani/marko-projects)
- **Issue Tracker**: Report bugs and feature requests on GitHub
- **Documentation**: Full docs available in the running application (click "Info" in header)

## 🏷️ Available Tags

- `latest` - Latest stable release (currently v1.21.0-beta)
- `beta` - Latest beta release
- `v1.21.0-beta` - Specific version tag
- Multi-architecture support (AMD64/ARM64)

---

**Redis ACL Builder** - Built with ❤️ for Redis Enterprise ACL testing and validation
