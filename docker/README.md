# Redis ACL Builder - Docker Deployment

**Related Documentation:**

- [Multi-Architecture Builds](MULTI-ARCH-README.md) - Building for AMD64/ARM64
- [CI/CD Setup Guide](CI-CD-SETUP.md) - GitHub Actions automation

**Version v1.0.0** - First Stable Release

A comprehensive application for testing and validating Redis Access Control List
(ACL) rules with real-time command analysis, featuring Rule Selectors, Advanced
Key Permissions, comprehensive E2E testing with 100% test coverage (65/65
Playwright tests), and an elegant drag-drop interface. Also available as a
native desktop application (macOS, Windows, Linux).

**What's New in v1.0.0**:

- **🎉 First Stable Release**: Production-ready with comprehensive test coverage
- **🏢 Enterprise/OSS Mode Toggle**: Switch between Redis deployment types
- **🔧 Health Endpoint Fix**: Repaired health check endpoint for monitoring
- **✅ 65/65 E2E Tests Passing**: 100% Playwright test coverage

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
docker pull markotrapani608/redis-acl-builder:1.0.0

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
- Dual testing modes: split or integrated with smooth animations
- Interactive hover feedback showing button actions (emoji swap)
- Real-time validation with auto-optimization
- Light/dark theme with system preference detection

### Redis Support

- Full Redis 7 (379 commands, 21 categories)
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

- **Email**: <marko.trapani@redis.com>
- **GitHub Issues**: [Report bugs and feature
  requests](https://github.com/markotrapani/marko-projects/issues)

## 📚 Additional Resources

- **GitHub Repository**:
  [markotrapani/redis-acl-builder](https://github.com/markotrapani/redis-acl-builder)
- **Wiki**: [Comprehensive documentation](https://github.com/markotrapani/redis-acl-builder/wiki)
- **Issue Tracker**: [Report bugs and feature requests](https://github.com/markotrapani/redis-acl-builder/issues)
- **Documentation**: Full docs available in the running application (click
  "Info" in header)

## 🏷️ Available Tags

- `latest` - Latest stable release (currently v1.0.0)
- `1.0.0` - First Stable Release
- Multi-architecture support (AMD64/ARM64)

## 🔒 Security

**Security Features:**

- **Python 3.13** with latest security patches
- **Gunicorn** with HTTP Request Smuggling fixes
- **Automated package upgrades** via `apk upgrade` on every build
- **Non-root user** execution (UID 1000)
- **Alpine Linux** base with minimal attack surface
- **Build-time dependency installation** - pip not used at runtime
- **Docker Scout CVE scanning** on every build

We continuously monitor security advisories and update dependencies as fixes
become available.

---

**Redis ACL Builder** - Built with ❤️ for Redis Enterprise ACL testing and
validation
