# Redis ACL Builder - GitHub Wiki Plan

**Status:** Planning Phase

**Implementation Timeline:** Post-GA (v3.0.0)

**Last Updated:** 2025-10-22

---

## 📋 Overview

This document outlines the comprehensive plan for creating a GitHub Wiki for the
Redis ACL Builder project. The Wiki will serve as the primary user documentation
resource, complementing the README and technical documentation.

**Why Post-GA?**

- Avoid duplicate maintenance during active beta development
- Ensure documentation reflects stable GA features
- Leverage community contributions after launch
- Focus pre-GA efforts on critical path items

**Timeline:**

- **Current:** Minimal documentation in README.md
- **Pre-GA (v2.x - v3.0.0):** Focus on inline docs and CONTRIBUTING.md
- **GA Launch (v3.0.0):** Create Wiki structure and seed content
- **Post-GA (v3.1.0+):** Expand Wiki with community contributions

---

## 🏗️ Wiki Structure

### 1. Home

**Purpose:** Welcome page and navigation hub

**Content:**

- Project overview and key features
- Quick links to popular sections
- Latest release information
- Getting started quickstart
- Community resources

**Example Layout:**

```markdown
# Welcome to Redis ACL Builder Wiki

Redis ACL Builder is a comprehensive tool for creating, testing, and managing
Redis Access Control Lists (ACLs) with real-time command analysis.

## 🚀 Quick Start

- [Installation Guide](Installation)
- [Your First ACL Rule](Getting-Started)
- [Interactive Builder Tutorial](Interactive-Builder)

## 📚 Documentation

- [User Guide](User-Guide)
- [API Reference](API-Reference)
- [Troubleshooting](Troubleshooting)

## 🤝 Community

- [GitHub Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)
- [Issue Tracker](https://github.com/markotrapani/redis-acl-builder/issues)
- [Contributing Guide](Contributing)
```

**Estimated Time:** 2 hours

---

### 2. Installation

**Purpose:** Comprehensive installation guide for all platforms

**Sections:**

1. **Desktop Applications**
   - macOS Installation (DMG + ZIP)
   - Windows Installation (NSIS installer)
   - Linux Installation (AppImage + .deb)
   - Troubleshooting installation issues

2. **Docker Deployment**
   - Quick start with `docker run`
   - Docker Compose setup
   - Kubernetes deployment (Helm chart)
   - Environment variables
   - Volume mounting
   - Networking configuration

3. **Local Python Setup** (Advanced)
   - Prerequisites (Python 3.10+, Node.js 18+)
   - Virtual environment setup
   - Dependency installation
   - Running in development mode
   - Building from source

**Example Content:**

```markdown
## macOS Installation

### Method 1: DMG Installer (Recommended)

1. Download the latest DMG from [Releases](https://github.com/markotrapani/redis-acl-builder/releases)
   - **Apple Silicon (M1/M2/M3):** Redis-ACL-Builder-arm64.dmg
   - **Intel Macs:** Redis-ACL-Builder-x64.dmg

2. Open the DMG and drag "Redis ACL Builder" to Applications

3. First launch:
   - Right-click the app → "Open"
   - Click "Open" in the security dialog
   - (macOS will remember this choice)

### Method 2: ZIP Archive

[Instructions for ZIP installation...]

### Troubleshooting

**"App is damaged and can't be opened"**

This is a Gatekeeper warning. Solution:
\`\`\`bash
xattr -cr "/Applications/Redis ACL Builder.app"
\`\`\`
```

**Estimated Time:** 6-8 hours (all platforms)

---

### 3. User Guide

**Purpose:** Comprehensive feature documentation

**Sections:**

#### 3.1 Getting Started

- **What are Redis ACLs?** - Introduction to Redis access control
- **Creating Your First Rule** - Step-by-step tutorial
- **Understanding Rule Syntax** - ACL command syntax reference
- **Redis 7 vs Redis 8** - Version differences and compatibility

**Content Example:**

```markdown
## Creating Your First ACL Rule

Let's create a simple read-only user ACL:

1. **Open Redis ACL Builder**

2. **Start with a template:**
   - Click "Quick Examples" dropdown
   - Select "Read-Only User"

3. **The rule appears:**
   \`\`\`
   on >password ~* +@read -@dangerous
   \`\`\`

4. **Understanding the rule:**
   - `on` - User is enabled
   - `>password` - Set password
   - `~*` - Access to all keys
   - `+@read` - Grant all read commands
   - `-@dangerous` - Deny dangerous commands (KEYS, FLUSHDB, etc.)

5. **Test the rule:**
   - Enter "GET mykey" in Command Tester
   - Click "Test Command" → ✅ Allowed
   - Enter "SET mykey value"
   - Click "Test Command" → ❌ Denied
```

#### 3.2 ACL Rule Syntax

- **User Control:** `on`, `off`, `reset`
- **Password Management:** `>password`, `<password`, `nopass`
- **Command Permissions:** `+command`, `-command`, `+@category`, `-@category`
- **Key Patterns:** `~pattern`, `%R~pattern`, `%W~pattern`, `%RW~pattern`
- **Channel Patterns:** `&channel`
- **Selectors:** `(...)` selector syntax

#### 3.3 Interactive Builder

- **Three-Column Layout** - Blocked, Config, Granted
- **Click-to-Grant** - Adding commands interactively
- **Click-to-Revoke** - Removing commands
- **Category Management** - Expanding/collapsing categories
- **Search Functionality** - Finding commands quickly
- **Panel Resizing** - Customizing layout

#### 3.4 Command Testing

- **Integrated Tester** - Combined command + key testing
- **Split Mode** - Separate command and keyspace testers
- **Test Results** - Understanding allowed/denied output
- **Redis Subcommands** - Pipe character notation

#### 3.5 Keyspace Testing

- **Glob Patterns** - `*`, `?`, `[abc]`, `[a-z]`, `[^abc]`
- **Key Permissions** - Read-only, write-only, read-write
- **Pattern Matching** - Testing key access
- **Escaped Characters** - Literal `*`, `?`, `[` in patterns

#### 3.6 Optimization Engine

- **Auto-Optimization** - Automatic rule simplification
- **Category Completion** - Detecting full category grants
- **Redundancy Detection** - Finding duplicate terms
- **Manual Optimization** - Applying suggestions

**Estimated Time:** 12-15 hours

---

### 4. Advanced Topics

**Purpose:** Deep dives into complex features

**Sections:**

#### 4.1 Rule Selectors

- **What are Selectors?** - Multi-permission sets in one user
- **Selector Syntax:** `(+@read ~cache:*) (+@write ~data:*)`
- **OR Logic** - Command granted if ANY selector permits
- **Use Cases** - Read-only on cache, write on data
- **Limitations** - Testing limitations in UI

#### 4.2 Key Permission Patterns

- **Advanced Patterns** - `%R~`, `%W~`, `%RW~` prefixes
- **Read-Only Keys** - `%R~user:*:profile`
- **Write-Only Keys** - `%W~logs:*`
- **Read-Write Keys** - `%RW~session:*` (alias for `~`)
- **Pattern Precedence** - How Redis evaluates patterns

#### 4.3 Redis 7 vs Redis 8

- **Command Differences** - 379 vs 496 commands
- **New Categories** - Additional categories in Redis 8
- **Module Commands** - RediSearch, RedisJSON, TimeSeries, Bloom
- **Compatibility** - Writing rules that work on both versions

#### 4.4 Redis Enterprise vs OSS

- **Blocked Commands** - Commands unavailable in Enterprise
- **Clustering** - CLUSTER commands blocked
- **Replication** - REPLICAOF, SYNC blocked
- **Server Control** - SHUTDOWN, DEBUG, MODULE blocked
- **Planning ACLs** - Enterprise-compatible rules

#### 4.5 Performance Optimization

- **Large Rules** - Handling 100+ term ACL rules
- **Complex Patterns** - Optimizing glob patterns
- **Selector Performance** - Impact of multiple selectors
- **Best Practices** - Rule organization tips

**Estimated Time:** 8-10 hours

---

### 5. API Reference

**Purpose:** Complete backend API documentation

**Sections:**

#### 5.1 Overview

- **Base URL** - `http://localhost:5001` (dev), `http://localhost:7380` (Docker)
- **Content Type** - `application/json`
- **Error Handling** - Standard error response format
- **Rate Limiting** - None (local/self-hosted)

#### 5.2 Endpoints

##### POST /api/parse

```json
Request:
{
  "rule": "+@read ~cache:*",
  "version": "redis7"
}

Response:
{
  "granted_commands": ["get", "mget", "getrange", ...],
  "blocked_commands": ["set", "del", ...],
  "granted_categories": ["@read"],
  "blocked_categories": ["@write", "@dangerous"],
  ...
}
```

##### POST /api/test-command

```json
Request:
{
  "rule": "+@read",
  "command": "GET",
  "version": "redis7"
}

Response:
{
  "is_granted": true,
  "reason": "Command allowed by @read category",
  "matching_rule": "+@read"
}
```

**[All 12 endpoints documented with examples]**

#### 5.3 Error Codes

- **400 Bad Request** - Invalid input
- **422 Unprocessable Entity** - Validation error
- **500 Internal Server Error** - Server error

#### 5.4 Pydantic Models

- **ParseACLRequest** - Schema for /api/parse
- **TestCommandRequest** - Schema for /api/test-command
- **[All request/response models]**

**Estimated Time:** 6-8 hours

---

### 6. Development

**Purpose:** Developer documentation for contributors

**Sections:**

#### 6.1 Contributing Guide

- Link to [CONTRIBUTING.md](../CONTRIBUTING.md)
- Code of Conduct
- Development workflow
- Pull request process

#### 6.2 Local Development Setup

- Prerequisites and system requirements
- Cloning and initial setup
- Virtual environment creation
- Dependency installation
- Running in development mode
- Environment variables

#### 6.3 Testing Guide

- Running unit tests (`pytest`)
- Running E2E tests (`npx playwright test`)
- Running performance benchmarks
- Property-based tests with Hypothesis
- Mutation testing with mutmut
- Coverage reports

#### 6.4 Build Process

- **Web App:** Minifying CSS/JS with `build_minified.py`
- **Docker:** Multi-arch builds with Docker Buildx
- **Desktop:** Electron builds with electron-builder
- **CI/CD:** GitHub Actions workflows

#### 6.5 Architecture

- Frontend module structure (13 ES6 modules)
- Backend architecture (Flask + Pydantic)
- Data loader and ACL parser
- Test suite organization

**Estimated Time:** 6-8 hours

---

### 7. Troubleshooting

**Purpose:** Solutions to common issues

**Sections:**

#### 7.1 Common Issues

##### Desktop App Won't Launch (macOS)

- Gatekeeper warnings
- Damaged app errors
- Permission issues
- Solution: `xattr -cr` command

##### Desktop App Won't Launch (Windows)

- SmartScreen warnings
- Missing .NET dependencies
- Firewall blocking
- Solutions and workarounds

##### Docker Container Won't Start

- Port conflicts
- Permission errors
- Volume mount issues
- Solutions with `docker logs`

##### Web App Not Loading

- Flask server not starting
- Port already in use
- Missing dependencies
- Python version issues

#### 7.2 Platform-Specific Problems

- macOS issues and solutions
- Windows issues and solutions
- Linux issues and solutions
- Docker issues and solutions

#### 7.3 Feature Issues

- ACL parsing errors
- Command testing not working
- Optimization suggestions incorrect
- Search not finding commands

#### 7.4 Getting Help

- GitHub Discussions (preferred)
- Issue tracker (bugs only)
- Email support (enterprise)

**Estimated Time:** 4-6 hours

---

### 8. FAQ

**Purpose:** Quick answers to common questions

**Sections:**

#### 8.1 General Questions

**Q: What is Redis ACL Builder?**

A: A desktop and web application for creating, testing, and validating Redis
Access Control List (ACL) rules with real-time command analysis.

**Q: Is it free?**

A: Yes, Redis ACL Builder is open source (MIT License) and completely free.

**Q: Does it work with Redis 7 and Redis 8?**

A: Yes! You can switch between Redis 7 (379 commands) and Redis 8 (496 commands)
modes.

**Q: Does it connect to my Redis server?**

A: No, it runs entirely offline. It simulates Redis ACL behavior without
needing a live connection.

**Q: Can I use it for Redis Enterprise?**

A: Yes, but be aware that some commands (CLUSTER, MODULE, etc.) are blocked in
managed Redis environments.

#### 8.2 Technical Questions

**Q: What Python version is required?**

A: Python 3.10 or higher (for local development; desktop apps include bundled
Python)

**Q: What browsers are supported?**

A: Chrome, Firefox, Safari, Edge (latest versions)

**Q: Can I run it on Kubernetes?**

A: Yes, Docker image supports Kubernetes deployment (Helm chart coming soon)

**Q: How do I report a bug?**

A: Use the [GitHub issue tracker](https://github.com/markotrapani/redis-acl-builder/issues)
with the bug report template

#### 8.3 Feature Requests

**Q: Can you add [feature]?**

A: Feature requests are welcome! Please use the [GitHub Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)
Ideas category

**Q: Can I contribute code?**

A: Absolutely! See the [Contributing Guide](Contributing)

**Estimated Time:** 3-4 hours

---

## 📊 Wiki Implementation Plan

### Phase 1: GA Launch (Week 1)

**Timeline:** 1 week after v3.0.0 release

**Tasks:**

- [x] Create Wiki repository (automatic with GitHub)
- [ ] Create Home page with navigation
- [ ] Create Installation page (all platforms)
- [ ] Create Getting Started page (basic tutorial)
- [ ] Create FAQ page (20+ questions)
- [ ] Create Troubleshooting page (common issues)

**Goal:** Minimum viable documentation for new users

**Time Estimate:** 16-20 hours

---

### Phase 2: User Guide Expansion (Month 1)

**Timeline:** 2-4 weeks after GA

**Tasks:**

- [ ] Complete User Guide sections (syntax, builder, testing)
- [ ] Add Advanced Topics (selectors, patterns, versioning)
- [ ] Create video tutorials (embed in Wiki)
- [ ] Add screenshots and GIFs for tutorials

**Goal:** Comprehensive user-facing documentation

**Time Estimate:** 20-25 hours

---

### Phase 3: Developer Documentation (Month 2)

**Timeline:** 5-8 weeks after GA

**Tasks:**

- [ ] Complete API Reference (all 12 endpoints)
- [ ] Create Development guide (setup, testing, build)
- [ ] Add Architecture diagrams
- [ ] Document contribution workflow

**Goal:** Enable community contributions

**Time Estimate:** 12-16 hours

---

### Phase 4: Community Contributions (Ongoing)

**Timeline:** Month 3+

**Tasks:**

- [ ] Encourage community Wiki edits
- [ ] Review and merge Wiki pull requests
- [ ] Add user-contributed tutorials
- [ ] Translate pages (if community interest)

**Goal:** Community-maintained documentation

**Time Estimate:** Ongoing (2-4 hours/month)

---

## 🎯 Success Metrics

**Launch Metrics (Month 1):**

- [ ] All Phase 1 pages complete and published
- [ ] 10+ FAQ questions answered
- [ ] 5+ troubleshooting solutions documented
- [ ] 100+ Wiki page views

**Growth Metrics (Month 3):**

- [ ] All Phase 2 pages complete
- [ ] 20+ FAQ questions answered
- [ ] 15+ troubleshooting solutions
- [ ] 1000+ Wiki page views

**Community Metrics (Month 6):**

- [ ] 5+ community-contributed pages
- [ ] 10+ community Wiki edits
- [ ] 30+ FAQ questions answered
- [ ] 5000+ Wiki page views

---

## 🔗 Related Documentation

- **[ROADMAP.md](./ROADMAP.md)** - Product roadmap
- **[GA-RELEASE-PLAN.md](./GA-RELEASE-PLAN.md)** - GA release checklist
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines

---

## 📝 Notes

**Current Status:** Planning phase, Wiki creation scheduled post-GA

**Why Post-GA?** Avoid duplicate maintenance during rapid beta development

**Timeline:** Wiki creation starts 1 week after v3.0.0 GA release

**Maintenance Strategy:** Community-driven after initial seed

**Total Estimated Time:** 48-64 hours for complete Wiki (Phases 1-3)
