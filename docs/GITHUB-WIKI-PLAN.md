# GitHub Wiki Content Plan - v2.6.0 GA Release

**Status:** Ready for Implementation
**Target:** Launch with v2.6.0 GA release
**Purpose:** Comprehensive documentation hub for users and contributors

---

## 📚 Wiki Structure

### Home Page

**Content Source:** README.md (summarized)
**Purpose:** Welcome page with quick links

### Getting Started

**Content Source:** README.md Installation section
**Purpose:** Step-by-step installation and first-time setup

### User Guide

**Content Source:** New content + README.md features
**Purpose:** Complete user manual for all features

### Developer Guide

**Content Source:** CONTRIBUTING.md + CLAUDE.md
**Purpose:** How to contribute and develop

### Deployment Guide

**Content Source:** docker/README.md + deployment sections
**Purpose:** Production deployment instructions

### API Reference

**Content Source:** backend/models/api_models.py + API documentation
**Purpose:** Complete API endpoint documentation

### Troubleshooting

**Content Source:** New content + Known Issues
**Purpose:** Common problems and solutions

### FAQ

**Content Source:** New content
**Purpose:** Frequently asked questions

### Changelog

**Content Source:** ROADMAP.md version history
**Purpose:** Version history and release notes

---

## 📄 Detailed Page Content

### 1. Home (Wiki Home Page)

```markdown
# Welcome to Redis ACL Builder Wiki

**Version:** v2.6.0 (Production Release)

Redis 7.0+ allows multiple ACL rule sets in a single user
definition:

## Quick Navigation

- **[Getting Started](Getting-Started)** - Installation and setup
- **[User Guide](User-Guide)** - Complete feature documentation
- **[Deployment Guide](Deployment-Guide)** - Docker and production deployment
- **[API Reference](API-Reference)** - REST API documentation
- **[Developer Guide](Developer-Guide)** - Contributing and development
- **[Troubleshooting](Troubleshooting)** - Common issues and solutions
- **[FAQ](FAQ)** - Frequently asked questions
- **[Changelog](Changelog)** - Version history

## Features

- ✅ **Multi-Platform Desktop App** - macOS, Windows, and Linux
- 🐳 **Docker Deployment** - Easy web app deployment
- 🔐 **Complete Redis 7 & 8 Support** - 379+ commands validated
- 🎯 **100% Test Coverage** - 195 backend + 28 E2E tests
- 🎨 **Modern UI** - Dark/light themes, responsive design
- 🔄 **Auto-Update System** - Seamless desktop app updates

## Supported Platforms

**Desktop Applications:**
- macOS (ARM64 + Intel)
- Windows (x64)
- Linux (x64)

**Web/Docker:**
- Multi-arch support (AMD64 + ARM64)
- Python 3.12+ compatible
- Flask + Gunicorn production server

## Community

- **GitHub Issues:** [Report bugs or request features](https://github.com/markotrapani/redis-acl-builder/issues)
- **Discussions:** [Ask questions or share ideas](https://github.com/markotrapani/redis-acl-builder/discussions)
- **Contributing:** See [Developer Guide](Developer-Guide)

## License

MIT License - See [LICENSE](https://github.com/markotrapani/redis-acl-builder/blob/main/LICENSE)

---

### 2. Getting Started

**Content Source:** README.md Installation + Quick Start

```markdown
# Getting Started

This guide will help you install and run Redis ACL Builder for the first time.

## Choose Your Installation Method

### Option 1: Desktop Application (Recommended)

**macOS:**
1. Download `Redis-ACL-Builder-2.6.0-arm64.dmg` (Apple Silicon) or
   `Redis-ACL-Builder-2.6.0-x64.dmg` (Intel)
2. Open the DMG file
3. Drag Redis ACL Builder to Applications folder
4. Launch from Applications

**Windows:**
1. Download `Redis-ACL-Builder-2.6.0-x64.exe`
2. Run the installer
3. Follow installation wizard
4. Launch from Start Menu

**Linux:**
1. Download `Redis-ACL-Builder-2.6.0-x86_64.AppImage`
2. Make executable: `chmod +x Redis-ACL-Builder-*.AppImage`
3. Run: `./Redis-ACL-Builder-*.AppImage`

### Option 2: Docker (For Servers)

```bash
# Pull and run
docker run -d -p 7380:7380 markotrapani608/redis-acl-builder:latest

# Or use Docker Compose
curl -O https://raw.githubusercontent.com/markotrapani/redis-acl-builder/main/docker/docker-compose.yml
docker-compose up -d
```

Access at: <http://localhost:7380>

### Option 3: Local Python Development

```bash
# Clone repository
git clone https://github.com/markotrapani/redis-acl-builder.git
cd redis-acl-builder

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run application
python backend/app.py
```

Access at: <http://localhost:5001>

## First Steps

1. **Choose Redis Version:** Select Redis 7 or Redis 8 from dropdown
2. **Try Quick Examples:** Click "Quick Examples" button for pre-built ACL rules
3. **Interactive Builder:** Click categories/commands to build ACL rules
   visually
4. **Test Commands:** Use Command Tester to validate specific command access
5. **Save Rules:** Save frequently used rules for quick access

## Next Steps

- Read the [User Guide](User-Guide) for detailed feature documentation
- Explore [API Reference](API-Reference) for programmatic access
- Check out [Deployment Guide](Deployment-Guide) for production setup

```text

---

### 3. User Guide

**Content Source:** Comprehensive feature documentation

```markdown
# User Guide

Complete guide to all Redis ACL Builder features.

## Table of Contents

1. [Interface Overview](#interface-overview)
2. [Building ACL Rules](#building-acl-rules)
3. [Testing Commands](#testing-commands)
4. [Testing Keyspace Patterns](#testing-keyspace-patterns)
5. [Rule Optimization](#rule-optimization)
6. [Saved Rules](#saved-rules)
7. [Redis Version Switching](#redis-version-switching)
8. [Theme Customization](#theme-customization)

## Interface Overview

### Three-Column Layout

**Left Column - Blocked Commands (❌):**
- Shows commands currently blocked by your ACL rule
- Click any command to grant access (adds to ACL rule)
- Search and filter blocked commands
- Expand/collapse categories for better organization

**Center Column - ACL Rule Configuration (📝):**
- Manual ACL rule text editor
- Syntax validation with error messages
- Submit Changes button (appears when rule is modified)
- Clear and Copy functionality
- Quick Examples dropdown

**Right Column - Granted Commands (✅):**
- Shows commands allowed by current ACL rule
- Click any command to revoke access (removes from ACL rule)
- Visual indicators for full/partial category grants
- Category-level permission management

### Testing Section (Bottom)

**Command Tester:**
- Test if specific command is allowed
- Supports Redis subcommands (e.g., `CONFIG|GET`)
- Real-time validation with detailed feedback

**Keyspace Tester:**
- Test if key patterns are accessible
- Full glob pattern support (*, ?, [abc], [a-z])
- Validates read/write/read-write permissions

**Integrated Tester:**
- Combines command + key testing
- Tests complete command+key access in one step
- Shows which permission type granted access

## Building ACL Rules

### Interactive Click-to-Build

1. **Grant Category:** Click category name (e.g., `@read`) in Blocked column
2. **Grant Command:** Click individual command (e.g., `GET`) in Blocked column
3. **Revoke Access:** Click granted command/category in Granted column
4. **Auto-Optimization:** Rules are automatically optimized when using
   interactive builder

### Manual Text Editing

1. Type ACL rule directly in center column text area
2. Use syntax: `+@category`, `-@category`, `+command`, `-command`, `~pattern`
3. Submit Changes button appears when rule is modified
4. Click Submit to validate and apply rule

### Supported ACL Syntax

```text
+@category          Grant entire category
-@category          Block entire category
+command            Grant specific command
-command            Block specific command
~pattern            Allow key pattern (read-write)
%R~pattern          Allow key pattern (read-only)
%W~pattern          Allow key pattern (write-only)
&channel            Allow pub/sub channel pattern

```

### Rule Precedence

Redis processes ACL rules **left to right**:

```text
+@all -@dangerous   # Grants all EXCEPT dangerous commands
-@dangerous +@all   # Grants all (last rule wins)

```

## Testing Commands

### Basic Command Testing

1. Enter command name in Command Tester (e.g., `GET`)
2. Click Test button
3. Result shows: ✅ Allowed or ❌ Blocked

### Testing Subcommands

Redis subcommands use pipe notation:

```text
CONFIG|GET      # Test CONFIG GET subcommand
ACL|SETUSER     # Test ACL SETUSER subcommand
CLIENT|LIST     # Test CLIENT LIST subcommand

```

### Integrated Command + Key Testing

1. Enter command in integrated tester
2. Enter key pattern
3. Test validates both command access AND key pattern match
4. Shows which permission granted access (%R, %W, or %RW)

## Testing Keyspace Patterns

### Glob Pattern Support

```text
*               Match any characters
?               Match single character
[abc]           Match any character in set
[a-z]           Match any character in range
[^abc]          Match any character NOT in set
\*              Escape special characters
```

### Pattern Examples

```text
user:*          Match all keys starting with "user:"
session:????        Match session keys with 4-character IDs
cache:[a-z]*        Match cache keys starting with lowercase letter
temp:[^0-9]*        Match temp keys NOT starting with digit

```

## Rule Optimization

### Auto-Optimization

When using interactive builder:

- Redundant commands are automatically removed
- Categories are suggested when most commands are granted
- Empty rules and contradictions are detected

### Manual Optimization

Click "Optimize Rule" suggestion when shown:

- Simplifies complex rules
- Reduces number of terms
- Maintains identical permissions

### Optimization Examples

```text
Before: +pfadd +pfcount +pfmerge
After:  +@hyperloglog
Saves:  2 terms

Before: +@transaction -discard -exec -multi
After:  +unwatch +watch
Saves:  2 terms

```

## Saved Rules

### Saving Rules

1. Create ACL rule using interactive builder or manual entry
2. Rule is automatically saved to localStorage
3. Access from "Saved Rules" dropdown in Quick Examples

### Managing Saved Rules

- **Load:** Click rule name in dropdown
- **Delete:** Click X button next to rule name
- **Rename:** Edit rule name when saving

### Quick Examples vs. Saved Rules

- **Quick Examples:** Pre-built example rules (cannot be deleted)
- **Saved Rules:** Your custom rules (can be managed)
- Both appear in same dropdown for easy access

## Redis Version Switching

### Supported Versions

- **Redis 7:** 379 commands across 21 categories
- **Redis 8:** 446 commands across 29 categories (adds modules)

### Switching Versions

1. Use dropdown in top-right corner
2. Select Redis 7 or Redis 8
3. Command lists and categories update automatically
4. Current ACL rule is preserved

### Redis 8 Module Commands

Redis 8 includes additional module commands:

- **RediSearch** (ft.*): 38 commands
- **RedisJSON** (json.*): 25 commands
- **TimeSeries** (ts.*): 17 commands
- **Bloom** (bf.*): 11 commands
- **Cuckoo** (cf.*): 14 commands
- **Count-Min Sketch** (cms.*): 6 commands
- **Top-K** (topk.*): 7 commands
- **T-Digest** (tdigest.*): 14 commands

## Theme Customization

### Automatic Theme Detection

- App detects OS theme preference on startup
- Automatically switches between light/dark mode

### Manual Theme Toggle

1. Click theme toggle button (top-right)
2. Choice is saved to localStorage
3. Preference persists across sessions

### Theme Features

- **Dark Mode:** Dark backgrounds, high contrast
- **Light Mode:** Light backgrounds, optimized readability
- Both themes support all features equally

```text

---

### 4. Deployment Guide

**Content Source:** docker/README.md + Production deployment

```markdown
# Deployment Guide

Production deployment options for Redis ACL Builder.

## Docker Deployment (Recommended)

### Quick Start

```bash
docker run -d -p 7380:7380 markotrapani608/redis-acl-builder:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  redis-acl-builder:
    image: markotrapani608/redis-acl-builder:latest
    ports:
      - "7380:7380"
    restart: unless-stopped
    environment:
      - FLASK_ENV=production
```

Save as `docker-compose.yml` and run:

```bash
docker-compose up -d
```

### Advanced Configuration

```yaml
services:
  redis-acl-builder:
    image: markotrapani608/redis-acl-builder:latest
    ports:
      - "7380:7380"
    restart: unless-stopped
    environment:
      - FLASK_ENV=production
      - WORKERS=4
      - LOG_LEVEL=info
    volumes:
      - ./logs:/app/logs
    networks:
      - redis-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.redis-acl.rule=Host(`acl.example.com`)"
```

### Multi-Arch Support

Docker image supports:

- **linux/amd64** (Intel/AMD x86_64)
- **linux/arm64** (ARM64, Apple Silicon)

Docker automatically pulls correct architecture.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `production` | Flask environment mode |
| `FLASK_DEBUG` | `False` | Enable Flask debug mode |
| `PORT` | `7380` | Server port |
| `WORKERS` | `4` | Gunicorn worker processes |
| `LOG_LEVEL` | `info` | Logging verbosity |

### Health Checks

```bash
# Check if container is running
docker ps | grep redis-acl-builder

# View logs
docker logs redis-acl-builder

# Check application health
curl http://localhost:7380/
```

## Python/Flask Deployment

### System Requirements

- Python 3.12 or higher
- pip package manager
- Virtual environment (recommended)

### Installation

```bash
# Clone repository
git clone https://github.com/markotrapani/redis-acl-builder.git
cd redis-acl-builder

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r backend/requirements-prod.txt
```

### Running with Gunicorn

```bash
cd backend
gunicorn --bind 0.0.0.0:7380 --workers 4 app:app
```

### Systemd Service (Linux)

Create `/etc/systemd/system/redis-acl-builder.service`:

```ini
[Unit]
Description=Redis ACL Builder
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/redis-acl-builder/backend
- Both themes support all features equally with
  optimized contrast
- Both themes support all features equally with optimized
  contrast
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable redis-acl-builder
sudo systemctl start redis-acl-builder
```

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 80;
    server_name acl.example.com;

    location / {
        proxy_pass http://localhost:7380;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Apache

```apache
<VirtualHost *:80>
    ServerName acl.example.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:7380/
    ProxyPassReverse / http://localhost:7380/
</VirtualHost>
```

### Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.redis-acl.rule=Host(`acl.example.com`)"
  - "traefik.http.routers.redis-acl.entrypoints=websecure"
  - "traefik.http.routers.redis-acl.tls.certresolver=letsencrypt"
```

## Security Considerations

### Production Checklist

- [ ] Run behind reverse proxy with HTTPS/TLS
- [ ] Implement authentication (OAuth, basic auth, etc.)
- [ ] Use firewall to restrict access
- [ ] Keep Docker image updated
- [ ] Monitor logs for security events
- [ ] Set appropriate CORS headers if needed

### Example: Basic Auth with Nginx

```nginx
location / {
    auth_basic "Redis ACL Builder";
    auth_basic_user_file /etc/nginx/.htpasswd;

    proxy_pass http://localhost:7380;
}
```

## Monitoring and Logging

### Docker Logs

```bash
# View logs
docker logs -f redis-acl-builder

# Save logs to file
docker logs redis-acl-builder > app.log 2>&1
```

### Log Rotation

```yaml
services:
  redis-acl-builder:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Scaling

### Horizontal Scaling

Run multiple instances behind load balancer:

```yaml
services:
  redis-acl-builder-1:
    image: markotrapani608/redis-acl-builder:latest
    ports:
      - "7380:7380"

  redis-acl-builder-2:
    image: markotrapani608/redis-acl-builder:latest
    ports:
      - "7381:7380"

  load-balancer:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Vertical Scaling

```yaml
services:
  redis-acl-builder:
    environment:
      - WORKERS=8  # Increase worker processes
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

## Deployment Troubleshooting

See [Troubleshooting Guide](Troubleshooting) for common deployment issues.

```text

---

## 🚀 Implementation Plan

### Phase 1: Content Creation (Day 1-2)

- [ ] Generate all 9 wiki pages from existing documentation
- [ ] Convert markdown files to wiki-compatible format
- [ ] Create screenshots and diagrams
- [ ] Add navigation links between pages

### Phase 2: GitHub Wiki Setup (Day 2-3)

- [ ] Enable Wiki feature in repository settings
- [ ] Create wiki pages in correct order
- [ ] Set up Home page with navigation
- [ ] Add all content pages
- [ ] Configure sidebar navigation

### Phase 3: Quality Assurance (Day 3)

- [ ] Review all pages for accuracy
- [ ] Test all internal links
- [ ] Verify code examples work
- [ ] Check formatting and styling
- [ ] Mobile responsiveness check

### Phase 4: Launch (Day 4)

- [ ] Final review and approval
- [ ] Publish all pages
- [ ] Update README with wiki link
- [ ] Announce wiki in v2.6.0 release notes

---

## 📝 Wiki Page List (Complete)

1. **Home** - Welcome and navigation
2. **Getting-Started** - Installation and setup
3. **User-Guide** - Complete feature documentation
4. **Deployment-Guide** - Docker and production
5. **API-Reference** - REST API documentation
6. **Developer-Guide** - Contributing guidelines
7. **Troubleshooting** - Common issues
8. **FAQ** - Frequently asked questions
9. **Changelog** - Version history

---

## 🔗 Navigation Structure

### Sidebar (Wiki Sidebar)

```markdown
**Getting Started**
- [Home](Home)
- [Installation](Getting-Started)

**Documentation**
- [User Guide](User-Guide)
- [Deployment Guide](Deployment-Guide)
- [API Reference](API-Reference)

**Development**
- [Developer Guide](Developer-Guide)
- [Troubleshooting](Troubleshooting)

**Resources**
- [FAQ](FAQ)
- [Changelog](Changelog)
```

---

## ✅ Ready for v2.6.0 GA Release

This wiki structure provides:

- ✅ Comprehensive user documentation
- ✅ Clear deployment instructions
- ✅ Developer onboarding guide
- ✅ Troubleshooting resources
- ✅ Professional presentation
- ✅ Easy navigation

**Status:** Ready to implement and launch with v2.6.0 GA release!
