# Development Guide

Guide for developers contributing to Redis ACL Builder.

---

## Contributing

See [CONTRIBUTING.md](https://github.com/markotrapani/redis-acl-builder/blob/main/CONTRIBUTING.md)
for full contribution guidelines.

---

## Prerequisites

- **Python 3.10+** (3.12+ recommended)
- **Node.js 18+**
- **Git**

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/markotrapani/redis-acl-builder.git
cd redis-acl-builder
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Run Web Application

```bash
# Option 1: Helper script
./scripts/run-web.sh

# Option 2: Direct execution
python backend/app.py
```

Access at `http://localhost:7380`

### 4. Desktop App Development

```bash
cd electron
npm install
npm start
```

---

## Testing

### Backend Tests

```bash
# All backend tests
pytest tests/backend/ -v

# With coverage
pytest tests/backend/ --cov=backend --cov-report=html

# Specific test file
pytest tests/backend/test_app.py -v

# Property-based tests
pytest tests/backend/test_property_based.py -v
```

### E2E Tests

```bash
# Install Playwright (first time)
npx playwright install

# Run all E2E tests
npx playwright test

# Run specific test
npx playwright test tests/e2e/01-page-load.spec.js

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

### Performance Tests

```bash
pytest tests/backend/test_benchmarks.py -v
```

---

## Building

### Frontend Assets

```bash
# Minify CSS and JavaScript
python3 build_minified.py
```

### Docker Image

```bash
cd docker

# Build image
./build-multi-arch.sh

# Test image
docker run --rm -p 7380:7380 redis-acl-builder:local
```

### Desktop App

```bash
cd electron

# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

---

## Project Structure

```
redis-acl-builder/
├── backend/              # Python Flask backend
│   ├── app.py           # Main application
│   ├── helpers/         # Core logic
│   │   ├── data_loader.py
│   │   └── acl_parser.py
│   └── models/          # Pydantic models
├── frontend/            # Web UI
│   ├── static/
│   │   ├── css/        # Modular CSS (6 modules)
│   │   └── js/         # Modular ES6 (13 modules)
│   └── templates/
│       ├── index.html
│       └── info.html
├── electron/            # Desktop app
│   ├── main.js         # Electron main process
│   └── preload.js      # Preload script
├── tests/              # Test suite
│   ├── backend/        # Backend tests (227)
│   └── e2e/            # E2E tests (28)
├── docs/               # Documentation
└── scripts/            # Helper scripts
```

---

## Architecture

### Backend

**Flask Application** (`backend/app.py`)

- RESTful API with 12 endpoints
- Pydantic request/response validation
- Comprehensive error handling

**Data Loader** (`backend/helpers/data_loader.py`)

- Redis command database
- Category-command mappings
- Supports Redis 7 (379 commands) and Redis 8 (496 commands)

**ACL Parser** (`backend/helpers/acl_parser.py`)

- Rule parsing engine
- Command permission evaluation
- Optimization suggestions
- Redundancy detection

### Frontend

**Modular ES6 Architecture:**

- 13 JavaScript modules
- Clear separation of concerns
- Event-driven architecture

**Key Modules:**

- `interactive-acl-builder.js` - Main UI logic
- `acl-optimizer.js` - Optimization engine
- `acl-category-manager.js` - Category management
- `api-client.js` - Backend communication

**Modular CSS:**

- 6 CSS modules
- Theme system (light/dark)
- Responsive design

---

## Code Style

### Python

- Follow **PEP 8** style guidelines
- Use **type annotations**
- Docstrings for all public functions
- Maximum line length: 88 characters (Black formatter)

### JavaScript

- **ES6+** syntax
- **Modular** structure (import/export)
- **camelCase** for variables/functions
- **PascalCase** for classes
- Comprehensive **JSDoc** comments

### CSS

- **BEM** naming convention
- **CSS custom properties** for theming
- **Mobile-first** responsive design

---

## Git Workflow

### Branch Naming

- `feat/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/doc-name` - Documentation
- `chore/task-name` - Maintenance

### Commit Messages

Follow **Conventional Commits**:

```
feat: Add support for Redis 9 commands
fix: Correct category detection logic
docs: Update API documentation
chore: Update dependencies
```

### Pull Requests

1. Create feature branch from `main`
2. Make changes with clear commits
3. Add tests for new functionality
4. Update documentation
5. Submit PR with description
6. Address code review feedback

---

## Debugging

### Backend Debugging

```python
# Enable debug mode
export FLASK_DEBUG=True
python backend/app.py
```

### Frontend Debugging

- Use browser DevTools (F12)
- Check Console for errors
- Network tab for API calls
- Lighthouse for performance

### Electron Debugging

```bash
# Run with DevTools
cd electron
npm start  # DevTools open automatically in debug builds
```

---

## CI/CD

### GitHub Actions

**Docker Builds:**

- `.github/workflows/docker-publish.yml`
- Triggers on version tags
- Multi-arch builds (AMD64, ARM64)
- Publishes to Docker Hub

**Desktop Builds:**

- `.github/workflows/build-desktop.yml`
- Builds for macOS, Windows, Linux
- Creates GitHub releases
- Code signing and notarization

---

## Resources

- [GitHub
  Repository](https://github.com/markotrapani/redis-acl-builder)
- [Issue
  Tracker](https://github.com/markotrapani/redis-acl-builder/issues)
- [GitHub
  Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)
- [Contributing
  Guide](https://github.com/markotrapani/redis-acl-builder/blob/main/CONTRIBUTING.md)

---

**Questions?** Visit [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)!
