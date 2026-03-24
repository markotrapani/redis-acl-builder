<!--
  CONFLUENCE PAGE: Redis ACL Builder - Internal Tool Guide

  HOW TO USE THIS FILE:
  Confluence Cloud doesn't support raw wiki markup anymore. The best workflow is:

  1. Create a new Confluence page
  2. Copy-paste this entire document into the editor (Markdown auto-converts)
  3. Then use the slash commands below to add rich Confluence elements

  After pasting, use these slash commands in the Confluence editor:
  - /info    → Blue info panel
  - /note    → Yellow note panel
  - /warning → Red warning panel
  - /tip     → Green tip panel
  - /expand  → Collapsible section
  - /status  → Colored status lozenge (STABLE, BETA, etc.)
  - /toc     → Auto-generated table of contents
  - /code    → Code block with syntax highlighting

  Instructions marked with ⚙️ CONFLUENCE below tell you where to add
  these rich elements after pasting.
-->

# Redis ACL Builder - Internal Tool Guide

<!-- ⚙️ CONFLUENCE: Add a /status lozenge here: "STABLE" in Green -->
<!-- ⚙️ CONFLUENCE: Add /toc (Table of Contents) here -->

**Version:** v1.0.0 (First Stable Release)
**Maintainer:** Marko Trapani (<marko.trapani@redis.com>)
**Repository:** [github.com/markotrapani/redis-acl-builder](https://github.com/markotrapani/redis-acl-builder) (private)
**Docker Hub:** [markotrapani608/redis-acl-builder](https://hub.docker.com/r/markotrapani608/redis-acl-builder)

---

## What is Redis ACL Builder?

Redis ACL Builder is a visual tool for creating, testing, and validating Redis Access Control List (ACL) rules. It provides real-time command analysis with an interactive three-column interface where you can build ACL rules by clicking commands or typing rules directly.

<!-- ⚙️ CONFLUENCE: Replace the paragraph below with a /info panel titled "Runs Entirely Offline" -->

**Key point:** It runs entirely offline — no connection to any Redis instance is required. It simulates Redis ACL behavior locally, making it safe for testing rules before deploying to production. No telemetry, no analytics, no external connections.

---

## Who is this for?

| Role | Use Case |
|------|----------|
| **Solutions Architects** | Building ACL rules for customer deployments |
| **Support Engineers** | Debugging ACL permission issues reported by customers |
| **Field Engineers** | Demonstrating Redis ACL capabilities in live demos |
| **Developers** | Testing ACL configurations before applying them to Redis |

---

## Quick Start

<!-- ⚙️ CONFLUENCE: Replace the paragraph below with a /tip panel titled "Recommended: Desktop App" -->

**The fastest way to get started is the Desktop App** — no dependencies, no setup, just download and run. It includes auto-updates so you'll always have the latest version.

### Desktop App Downloads

Download from [GitHub Releases](https://github.com/markotrapani/redis-acl-builder/releases/latest):

| Platform | File | Notes |
|----------|------|-------|
| macOS (Apple Silicon) | `Redis-ACL-Builder-1.0.0-arm64.dmg` | M1/M2/M3/M4 |
| macOS (Intel) | `Redis-ACL-Builder-1.0.0-x64.dmg` | Intel Macs |
| Windows | `Redis-ACL-Builder-Setup-1.0.0.exe` | NSIS installer |
| Linux (All distros) | `Redis-ACL-Builder-1.0.0.AppImage` | Universal |
| Linux (Debian/Ubuntu) | `Redis-ACL-Builder_1.0.0_amd64.deb` | .deb package |

<!-- ⚙️ CONFLUENCE: Wrap the Docker and Source sections below in /expand macros -->

### Docker (Click to expand)

```bash
docker run -d \
  --name redis-acl-builder \
  -p 7380:7380 \
  --restart unless-stopped \
  markotrapani608/redis-acl-builder:latest

# Open in browser
open http://localhost:7380
```

Docker images are multi-architecture (AMD64 + ARM64) on [Docker Hub](https://hub.docker.com/r/markotrapani608/redis-acl-builder).

**Upgrade:** `docker pull markotrapani608/redis-acl-builder:latest && docker restart redis-acl-builder`

### Run from Source (Click to expand)

```bash
git clone https://github.com/markotrapani/redis-acl-builder.git
cd redis-acl-builder
python -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
python backend/app.py
# Open http://localhost:5001
```

Requires Python 3.10+ (3.12+ recommended).

---

## Features Overview

### Redis Version Support

| Version | Commands | Categories | Includes |
|---------|----------|------------|----------|
| Redis 7 OSS | 379 | 21 | Core commands, cluster, replication |
| Redis 7 Enterprise | 305 | 21 | Excludes restricted commands |
| Redis 8 OSS | 446+ | 29 | Adds RediSearch, JSON, TimeSeries, Bloom |
| Redis 8 Enterprise | 440 | 29 | Excludes restricted commands |

<!-- ⚙️ CONFLUENCE: Replace the paragraph below with a /note panel titled "Enterprise vs OSS Mode" -->

**Enterprise Mode** excludes commands that are restricted in Redis Cloud — cluster management, replication, certain dangerous operations. Toggle between modes to see which commands are available in each deployment type. This is especially useful when building ACLs for customers running Redis Cloud.

### Interactive ACL Builder

The main interface has three columns:

1. **ACL Rule Editor** (center) — Type rules manually or use presets
2. **Blocked Commands** (left) — Click any command/category to grant it
3. **Granted Commands** (right) — Click any command/category to revoke it

Changes are reflected in real-time across all columns.

### Dual Testing Interface

- **Command Tester** — Test if a specific command (e.g., `GET`, `SET`, `FLUSHDB`) is allowed
- **Keyspace Tester** — Test if a key name (e.g., `user:123`, `cache:data`) matches allowed patterns
- **Integrated Tester** — Test command + key together

### Smart Optimization Engine

The optimizer automatically detects opportunities to simplify ACL rules:

- **Category completion** — If all commands in `@hyperloglog` are granted individually (`+pfadd +pfcount +pfmerge`), suggests `+@hyperloglog`
- **Redundant pattern detection** — If rule has `~* ~user:* ~cache:*`, detects that `~*` makes others redundant
- **One-click apply** — Click the suggestion to apply

<!-- ⚙️ CONFLUENCE: Wrap the section below in an /expand macro titled "Additional Features" -->

### Additional Features

- Light/Dark mode with automatic system preference detection
- Panel resizing and drag-drop reordering
- Fuzzy and exact command search
- ACL rule presets (read-only, read-write, admin, etc.)
- Saved rules with localStorage persistence
- Auto-updates for desktop app

---

## Common Use Cases

<!-- ⚙️ CONFLUENCE: Use /code blocks with language "text" for the ACL rules below -->

### 1. Read-Only Application User

```text
+@read ~app:* ~cache:*
```

Grants all read commands, limited to keys starting with `app:` or `cache:`.

### 2. Read-Write with Safety Rails

```text
+@read +@write -@dangerous ~*
```

Allows reads and writes to all keys, but blocks dangerous commands like `FLUSHDB`, `FLUSHALL`, `KEYS`, and `SHUTDOWN`.

### 3. Redis Modules User (Redis 8)

```text
+@read +@write +@search +@json -@dangerous ~*
```

Grants access to core read/write plus RediSearch and RedisJSON module commands.

### 4. Selector-Based Permissions (Redis 7.0+)

```text
(+@read ~cache:*) (+@write ~data:*)
```

Allows read operations on cache keys **OR** write operations on data keys. Selectors use OR logic.

### 5. Enterprise Mode Testing

<!-- ⚙️ CONFLUENCE: Replace the paragraph below with a /tip panel -->

Toggle to Enterprise Mode to validate that your ACL rules work within Redis Cloud restrictions. Commands that exist in OSS but are blocked in Enterprise (like `CLUSTER`, `MODULE`, `REPLCONF`) are excluded from the command set. This helps you catch permission issues before customers do.

---

## REST API

<!-- ⚙️ CONFLUENCE: Wrap this entire section in an /expand macro titled "REST API Reference" -->

The application exposes a REST API for programmatic access — useful for scripting or CI/CD integration.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Parse ACL rule, return granted/blocked commands |
| `/api/test-command` | POST | Test if a command is allowed |
| `/api/test-command-key` | POST | Test command + key combination |
| `/api/validate-rule` | POST | Validate ACL rule syntax |
| `/api/command-info` | POST | Get command category information |
| `/api/categories` | GET | List available categories |
| `/api/search-commands` | POST | Search commands by pattern |
| `/api/optimize-rule` | POST | Get optimization suggestions |
| `/health` | GET | Health check |

**Example:**

```bash
curl -X POST http://localhost:7380/api/parse \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read -@dangerous", "version": "redis7"}'
```

Full API documentation: [Wiki - API Reference](https://github.com/markotrapani/redis-acl-builder/wiki/API-Reference)

---

## Architecture & Tech Stack

<!-- ⚙️ CONFLUENCE: Wrap this section in an /expand macro titled "Architecture & Tech Stack" -->

```text
redis-acl-builder/
├── backend/           # Python Flask backend
│   ├── app.py        # Main app + API routes
│   └── helpers/      # ACL parser + Redis command database
├── frontend/          # Web UI
│   ├── static/css/   # Modular CSS (6 modules)
│   ├── static/js/    # Modular ES6 JavaScript (13 modules)
│   └── templates/    # HTML templates
├── electron/          # Desktop app (Electron wrapper)
├── docker/            # Docker deployment configs
├── tests/
│   ├── backend/      # 227+ pytest tests
│   └── e2e/          # 65 Playwright E2E tests (100% passing)
└── scripts/           # Build and deployment helpers
```

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.12+, Flask, Gunicorn |
| Frontend | Vanilla ES6 JavaScript (no framework), modular CSS |
| Desktop | Electron with PyInstaller-bundled backend |
| Testing | pytest (backend), Playwright (E2E) — 100% pass rate |
| CI/CD | GitHub Actions (Docker multi-arch builds, Electron packaging) |
| Container | Alpine Linux, multi-arch (AMD64/ARM64) |

---

## Deployment Comparison

| Method | Port | Best For | Auto-Updates | Dependencies |
|--------|------|----------|--------------|-------------|
| Desktop App | 7381 | Personal use, demos, offline | Yes | None |
| Docker | 7380 | Shared team access, servers | Pull latest | Docker |
| Local Dev | 5001 | Development, contributing | Git pull | Python 3.10+ |

---

## Documentation & Support

| Resource | Link |
|----------|------|
| GitHub Wiki (full docs) | [redis-acl-builder/wiki](https://github.com/markotrapani/redis-acl-builder/wiki) |
| Getting Started (5-min tutorial) | [Wiki - Getting Started](https://github.com/markotrapani/redis-acl-builder/wiki/Getting-Started) |
| User Guide | [Wiki - User Guide](https://github.com/markotrapani/redis-acl-builder/wiki/User-Guide) |
| API Reference | [Wiki - API Reference](https://github.com/markotrapani/redis-acl-builder/wiki/API-Reference) |
| Troubleshooting | [Wiki - Troubleshooting](https://github.com/markotrapani/redis-acl-builder/wiki/Troubleshooting) |
| FAQ | [Wiki - FAQ](https://github.com/markotrapani/redis-acl-builder/wiki/FAQ) |
| Releases / Downloads | [GitHub Releases](https://github.com/markotrapani/redis-acl-builder/releases) |
| Docker Hub | [markotrapani608/redis-acl-builder](https://hub.docker.com/r/markotrapani608/redis-acl-builder) |
| Issues / Feedback | [GitHub Issues](https://github.com/markotrapani/redis-acl-builder/issues) |
| Contact | <marko.trapani@redis.com> |

---

## FAQ

<!-- ⚙️ CONFLUENCE: Make each Q&A below an /expand macro with the question as the title -->

**Does it connect to a live Redis instance?**

No. It simulates ACL behavior entirely offline using hardcoded Redis command databases. No network connection is needed.

**Does it support Redis Enterprise-specific restrictions?**

Yes. Toggle Enterprise Mode to see which commands are restricted in Redis Cloud. This helps validate ACLs for customer deployments.

**Do I need Python for the desktop app?**

No. The desktop app bundles everything — just download and run. No dependencies required.

**Is my data sent anywhere?**

No. All processing is local. No telemetry, no analytics, no external connections. Safe for use with sensitive ACL configurations.

**Can I use it in customer-facing demos?**

Yes. The tool is designed for exactly this — visually demonstrating how Redis ACL rules work. The Enterprise/OSS toggle is particularly useful for showing customers which commands are available in their deployment type.

**How do I get updates?**

Desktop app auto-updates on launch. Docker: `docker pull markotrapani608/redis-acl-builder:latest`. Source: `git pull origin main`.

<!-- ⚙️ CONFLUENCE: Add a /warning panel at the bottom with this text: -->
<!-- "This is an internal tool hosted in a private GitHub repository. -->
<!--  Access requires GitHub org membership. Contact marko.trapani@redis.com for access." -->
