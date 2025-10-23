# Frequently Asked Questions (FAQ)

Quick answers to common questions about Redis ACL Builder.

---

## General Questions

### What is Redis ACL Builder?

Redis ACL Builder is a desktop and web application for creating, testing, and
validating Redis Access Control List (ACL) rules with real-time command
analysis.

### Is it free?

Yes! Redis ACL Builder is open source under the MIT License and completely free
to use.

### Does it work with Redis 7 and Redis 8?

Yes! You can switch between Redis 7 (379 commands) and Redis 8 (488 commands)
modes.

### Does it connect to my Redis server?

No, Redis ACL Builder runs entirely offline. It simulates Redis ACL behavior
without needing a live connection. This makes it safe for testing ACL rules
without affecting production systems.

### Can I use it for Redis Enterprise?

Yes, but be aware that Redis Enterprise restricts certain OSS commands (CLUSTER,
MODULE, REPLICATION, etc.) for security. If a command test shows "allowed" but
fails in Redis Enterprise, the command is likely restricted.

### Do I need Python installed for the desktop app?

No! The desktop app includes a bundled Python runtime. Just download and run -
no dependencies required.

### What's the difference between web app and desktop app?

| Feature | Web App | Desktop App |
|---------|---------|-------------|
| Installation | Docker or Python required | Standalone installer |
| Updates | Manual pull/update | Automatic updates |
| Offline | Requires server running | Works offline |
| Performance | Good | Excellent (native) |
| Best for | Servers, shared access | Personal use |

---

## Technical Questions

### What Python version is required?

- **Desktop app:** None (Python bundled)
- **Web app (local dev):** Python 3.10 or higher
- **Docker:** None (containerized)

### What browsers are supported?

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Modern browsers with ES6 module support.

### Can I run it on Kubernetes?

Yes! The Docker image supports Kubernetes deployment. Helm chart coming soon.

### How do I report a bug?

Use the [GitHub issue
tracker](https://github.com/markotrapani/redis-acl-builder/issues) with the bug
report template.

### How do I request a feature?

Use [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions) in
the Ideas category.

### Can I contribute code?

Absolutely! See the [Development Guide](./Development) and
[Contributing](https://github.com/markotrapani/redis-acl-builder/blob/main/CONTRIBUTING.md).

---

## Usage Questions

### How do I create my first ACL rule?

See the [Getting Started Guide](./Getting-Started) for a step-by-step tutorial.

### What does "+@read ~*" mean?

- `+@read` - Grant all read commands
- `~*` - Allow access to all keys (wildcard pattern)

This creates a read-only user with access to all keys.

### How do I block dangerous commands?

Add `-@dangerous` to your ACL rule:

```acl
+@read +@write -@dangerous ~*
```

This blocks FLUSHDB, FLUSHALL, KEYS, SHUTDOWN, and other dangerous operations.

### What's the difference between +@all and ~*?

- `+@all` - Grants **all commands**
- `~*` - Allows **all key patterns**

Both are needed for full access:

```acl
+@all ~*
```

### How do I grant only specific keys?

Use key patterns:

```acl
+@read ~user:* ~cache:*
```

This allows read operations only on keys starting with "user:" or "cache:".

### What are selectors?

Selectors (Redis 7.0+) allow multiple permission sets for one user:

```acl
(+@read ~cache:*) (+@write ~data:*)
```

This allows:

- Read operations on cache keys **OR**
- Write operations on data keys

Selectors use OR logic - command granted if ANY selector permits.

### How does the optimization engine work?

The optimizer detects when all commands in a category are granted and suggests
using `+@category` instead:

**Example:**

```text
Before: +pfadd +pfcount +pfmerge (3 terms)
After:  +@hyperloglog (1 term - saves 2 terms!)
```

### Why isn't my rule optimizing?

Optimization only triggers when:

- All commands in a category are granted
- Using individual commands (not already using category)
- Optimization actually saves terms

Some rules are already optimal!

---

## Troubleshooting Questions

### macOS says "App is damaged"

This is a Gatekeeper warning. Solution:

```bash
xattr -cr "/Applications/Redis ACL Builder.app"
```

See [Troubleshooting](./Troubleshooting#macos) for details.

### Windows SmartScreen blocks the app

This may occur for new releases:

1. Click "More info"
2. Click "Run anyway"

See [Troubleshooting](./Troubleshooting#windows) for details.

### Docker container won't start

Check if port 7380 is already in use:

```bash
lsof -i :7380  # macOS/Linux
netstat -ano | findstr :7380  # Windows
```

See [Troubleshooting](./Troubleshooting#docker-issues) for solutions.

### Web page loads but shows errors

Check browser console (F12) for errors. Common causes:

- JavaScript disabled
- Browser cache issue (hard refresh: Ctrl+Shift+R)
- localStorage disabled

### Command test says "denied" but I granted it

Possible causes:

1. **Rule precedence** - Later rules override earlier ones
2. **Category exclusion** - `-@category` blocks the command
3. **Selector isolation** - Command not in any selector's grant list

Use the **Command Tester** to see which rule is denying it.

### Theme won't stay after reload

**Cause:** localStorage disabled or browser privacy mode

**Solution:**

- Disable private/incognito mode
- Allow localStorage for the site
- Check browser extensions

---

## Feature Requests

### Can you add support for Redis 9?

Redis ACL Builder is updated for new Redis versions shortly after release. Watch
the [GitHub repository](https://github.com/markotrapani/redis-acl-builder) for
updates.

### Can you add multi-language support?

This is on the roadmap! Community translations welcome - see
[Contributing](https://github.com/markotrapani/redis-acl-builder/blob/main/CONTRIBUTING.md).

### Can you add a CLI version?

The API can be used programmatically! See [API Reference](./API-Reference).

A dedicated CLI tool is planned for future releases.

### Can I export/import ACL rules?

Yes! Use the "Save Rule" feature to persist rules to localStorage. Export
functionality coming in future releases.

### Can it connect to my Redis server and apply rules?

Not yet. This is a planned feature for future releases. Currently, you must
manually copy ACL rules to your Redis server.

### Will there be a mobile app?

Mobile app is on the long-term roadmap. The web app is mobile-responsive in the
meantime.

---

## Security Questions

### Is my data stored anywhere?

No! All processing happens locally:

- **Desktop app:** Everything runs on your machine
- **Web app:** Server runs locally, no external connections
- **Docker:** Containerized, no external data transfer

### Does it send telemetry?

No. Redis ACL Builder does not collect or send any usage data, telemetry, or
analytics.

### Can I use it on sensitive systems?

Yes! Since it's offline and self-hosted, it's safe for sensitive environments.
The desktop app doesn't require network access.

### Is the desktop app code signed?

Yes! The macOS app is signed and notarized with an Apple Developer ID. Windows
and Linux builds are signed where applicable.

---

## Deployment Questions

### Can I deploy on a private network?

Yes! Both Docker and web app support private network deployment. No external
dependencies required.

### Can I customize the UI?

Yes! The source code is open source. You can fork and customize. See
[Development Guide](./Development).

### Can I use it behind a reverse proxy?

Yes! The web app works behind nginx, Apache, Traefik, etc. Standard reverse
proxy configurations apply.

### How do I upgrade the Docker deployment?

```bash
docker pull markotrapani608/redis-acl-builder:latest
docker stop redis-acl-builder
docker rm redis-acl-builder
docker run -d --name redis-acl-builder -p 7380:7380 markotrapani608/redis-acl-builder:latest
```

Or with Docker Compose:

```bash
docker compose pull && docker compose up -d
```

---

## Licensing Questions

### Can I use it commercially?

Yes! The MIT License permits commercial use, modification, and distribution.

### Can I fork and modify it?

Yes! You can fork, modify, and redistribute under the MIT License. Attribution
appreciated but not required.

### Can I include it in my product?

Yes! Under the MIT License, you can include Redis ACL Builder in your product.

---

## Still Have Questions?

- **[User Guide](./User-Guide)** - Comprehensive feature documentation
- **[Getting Started](./Getting-Started)** - Step-by-step tutorial
- **[Troubleshooting](./Troubleshooting)** - Common issues and solutions
- **[GitHub
  Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)**
  - Ask the community
- **[Issue
  Tracker](https://github.com/markotrapani/redis-acl-builder/issues)** - Report
  bugs

---

**Can't find your answer?** Ask on [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)!
