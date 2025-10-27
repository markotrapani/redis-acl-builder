# Contributing to Redis ACL Builder

Thank you for your interest in contributing to Redis ACL Builder! We welcome
contributions from the community.

## How to Contribute

### Reporting Issues

If you encounter a bug or have a feature request:

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** with a clear title and description
3. **Include details** such as:
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (OS, browser, Redis version)
   - Screenshots if applicable

### Submitting Changes

1. **Fork the repository** and create a new branch for your feature/fix
2. **Make your changes** following our coding standards:
   - Python: Follow PEP 8 style guidelines
   - JavaScript: Use ES6+ syntax, maintain modular structure
   - Add tests for new functionality
   - Update documentation as needed
3. **Test your changes**:
   - Run backend tests: `pytest tests/backend/ -v`
   - Run E2E tests: `npx playwright test --config=tests/playwright.config.js --config=tests/playwright.config.js`
   - Test manually in both web and desktop modes
4. **Commit your changes** with clear, descriptive messages:
   - Use conventional commit format: `feat:`, `fix:`, `docs:`, `chore:`, etc.
   - Example: `feat: Add support for Redis 9 commands`
5. **Push to your fork** and submit a pull request

### Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure all tests pass
- Update documentation if needed
- Be responsive to code review feedback

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/markotrapani/redis-acl-builder.git
cd redis-acl-builder

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run the web application
python backend/app.py

# Access at http://localhost:5001
```

### Desktop App Development

```bash
# Install Electron dependencies
cd electron
npm install

# Run in development mode
npm start
```

### Running Tests

```bash
# Backend tests
pytest tests/backend/ -v --cov=backend

# E2E tests
npx playwright test --config=tests/playwright.config.js

# Install Playwright browsers (first time only)
npx playwright install
```

## Code Style

### Python

- Follow PEP 8 guidelines
- Use type hints for function parameters and return values
- Maximum line length: 120 characters
- Use meaningful variable and function names

### JavaScript

- Use ES6+ features (modules, arrow functions, async/await)
- Maintain modular structure (separate files for components)
- Use camelCase for variables and functions
- Add JSDoc comments for complex functions

### CSS

- Use CSS variables for theming
- Follow BEM naming convention where applicable
- Keep selectors specific but not overly nested

## Project Structure

```text
redis-acl-builder/
├── backend/          # Python Flask backend
│   ├── app.py       # Main application
│   ├── helpers/     # ACL parsing logic
│   └── models/      # API models
├── frontend/        # Web UI
│   ├── static/      # CSS and JavaScript
│   └── templates/   # HTML templates
├── electron/        # Desktop app wrapper
├── tests/           # Test suites
│   ├── backend/     # Python tests
│   └── e2e/         # Playwright tests
└── docs/            # Documentation
```

## Release Process

Releases are automated via GitHub Actions:

1. Update version numbers in:
   - `README.md`
   - `CLAUDE.md`
   - `backend/helpers/__init__.py`
   - `electron/package.json`
   - `electron/README.md`
   - `docs/ROADMAP.md`

2. Commit changes with conventional commit format

3. Create and push a version tag:

   ```bash
   git tag v2.x.x-beta
   git push origin v2.x.x-beta
   ```

4. GitHub Actions will automatically:
   - Build multi-platform desktop installers
   - Build and publish Docker images
   - Create GitHub release with auto-generated notes

## Questions?

Feel free to open an issue for any questions about contributing!

## License

By contributing to Redis ACL Builder, you agree that your contributions will be
licensed under the MIT License.
