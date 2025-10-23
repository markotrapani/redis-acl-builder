# Welcome to the Redis ACL Builder Wiki

Redis ACL Builder is a high-performance application for testing and validating
Redis Access Control List (ACL) rules with real-time command analysis and
interactive visual feedback.

![license MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![version](https://img.shields.io/badge/version-2.6.0--beta-green.svg)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20Docker-lightgrey.svg)
![Redis](https://img.shields.io/badge/Redis-7%20%7C%208-red.svg)

> **Note:** Available as both a native desktop application and web/Docker
deployment. Desktop apps feature auto-updates, offline support, and native
performance without requiring Python installation.

---

## 🚀 Quick Start

### New Users

- **[Download Desktop App][installation]** - Recommended for end users
  (Windows, macOS, Linux)
- **[Docker Deployment](./Installation#docker-deployment)** - Fastest for
  servers/web
- **[Local Development][development]** - For developers contributing to the
  project

### Getting Started

1. **[Installation Guide][installation]** - Choose your platform and get
   started
2. **[Getting Started Tutorial][getting-started]** - Learn the basics in 5
   minutes
3. **[User Guide][user-guide]** - Comprehensive feature documentation

---

## 📚 Documentation

### User Documentation

- **[Installation][installation]** - Platform-specific installation
  instructions
- **[Getting Started][getting-started]** - Your first ACL rule in 5 minutes
- **[User Guide][user-guide]** - Complete feature reference
  - ACL Rule Syntax
  - Interactive Builder
  - Command Testing
  - Keyspace Testing
  - Optimization Engine
- **[API Reference][api-reference]** - RESTful API documentation for
  programmatic access

### Developer Documentation

- **[Development Guide][development]** - Local setup, testing, building
- **[Contributing][contributing]** - How to contribute to the project
- **[Architecture](./Development#architecture)** - System architecture and code
  organization

### Support & Community

- **[Troubleshooting][troubleshooting]** - Common issues and solutions
- **[FAQ][faq]** - Frequently asked questions
- **[GitHub
  Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)**
  - Ask questions and share ideas
- **[Issue
  Tracker](https://github.com/markotrapani/redis-acl-builder/issues)** -
  Report bugs and request features

---

## ✨ Key Features

### 🎯 Core Capabilities

- ✅ Parse and validate Redis ACL rule syntax with real-time feedback
- ✅ Test commands and keyspace patterns with dual testing interface
- ✅ Visualize granted/blocked commands organized by categories
- ✅ Support for Redis 7 (379 commands) and Redis 8 (488 commands including
  modules)
- ✅ Light/Dark mode theme system with localStorage persistence
- ✅ Available as web app (Docker/local) and native desktop app (macOS,
  Windows, Linux)

### 🖥️ Desktop Application Features

- ✅ **No Python Required** - Standalone bundled application
- ✅ **Auto-Updates** - Automatic updates with code signing
- ✅ **Offline Support** - Works without internet connection
- ✅ **Native Performance** - Fast and responsive UI
- ✅ **Multi-Platform** - macOS (Intel + Apple Silicon), Windows, Linux

### 🔧 Advanced Features

- ✅ **Smart Optimization** - Automatic ACL rule simplification
- ✅ **Redundancy Detection** - Identifies duplicate/unnecessary terms
- ✅ **Category Completion** - Suggests category optimizations
- ✅ **Partial Category Detection** - Intelligent mixed permission handling
- ✅ **Resizable Panels** - Customizable three-column layout
- ✅ **Drag-and-Drop** - Reorder panels and testing sections
- ✅ **Search & Filter** - Find commands quickly with fuzzy/exact search

---

## 🎯 Latest Release

**Current Version:** v2.6.0-beta

**What's New in v2.6.0-beta:**

- 🎯 **Comprehensive test suite enhancements** - 255 total tests (227 backend
  - 28 E2E)
- ⚡ **Redis 8 data accuracy fixes** - Corrected 47 missing @admin commands,
  45 missing @dangerous commands
- 📦 **Integration tests** - 10 new tests covering full API workflows
- 🧪 **Property-based testing** - 12 tests with Hypothesis generating 1000+
  test cases
- 📊 **Performance benchmarks** - 11 tests validating sub-millisecond
  performance

**[View Full Changelog →][releases]**

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide][contributing]
for details on:

- Code of Conduct
- Development workflow
- Pull request process
- Testing requirements
- Code style guidelines

---

## 📖 About This Wiki

This Wiki serves as the primary documentation resource for Redis ACL Builder.
It is maintained by the project team and community contributors.

**Navigation:**

- Use the sidebar to browse documentation sections
- Use the search feature (top right) to find specific topics
- All pages include links to related sections

**Contributing to the Wiki:**

- Wiki pages are maintained alongside the codebase
- Pull requests welcome for improvements and corrections
- See [Contributing Guide][contributing] for details

---

## 📝 License

Redis ACL Builder is open source software licensed under the [MIT
License](https://github.com/markotrapani/redis-acl-builder/blob/main/LICENSE).

---

## 🔗 External Links

- **[GitHub
  Repository](https://github.com/markotrapani/redis-acl-builder)** - Source
  code
- **[Docker Hub
  Repository](https://hub.docker.com/r/markotrapani608/redis-acl-builder)** -
  Docker images
- **[Latest
  Releases](https://github.com/markotrapani/redis-acl-builder/releases)** -
  Download installers

---

**Questions?** Check the [FAQ][faq] or start a [GitHub
Discussion](https://github.com/markotrapani/redis-acl-builder/discussions)!

[installation]: ./Installation
[getting-started]: ./Getting-Started
[user-guide]: ./User-Guide
[api-reference]: ./API-Reference
[development]: ./Development
[contributing]: ./Contributing
[troubleshooting]: ./Troubleshooting
[faq]: ./FAQ
[releases]: https://github.com/markotrapani/redis-acl-builder/releases
