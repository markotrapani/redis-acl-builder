# Monorepo Restructure Plan

**Version:** v1.27.0 (proposed)
**Status:** Planning Phase
**Goal:** Reorganize codebase to support both web app AND Electron desktop app with single source of truth

---

## 🎯 Problem Statement

Currently:
- **v2-electron branch** has full Electron implementation plan (ELECTRON-ROADMAP.md)
- **main branch** has complete web app codebase
- **Issue**: When we add new features, we need to develop on EITHER web OR desktop
- **Concern**: Iterating/testing in web app is faster than Electron

**Solution:** Monorepo structure where backend/frontend code exists ONCE, used by BOTH web AND desktop

---

## 📦 Proposed Directory Structure

```
redis-acl-builder/
├── backend/                    # Shared Python backend (SINGLE SOURCE OF TRUTH)
│   ├── app.py                 # Flask application
│   ├── helpers/
│   │   ├── __init__.py
│   │   ├── data_loader.py
│   │   └── acl_parser.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── api_models.py
│   ├── requirements.txt        # All Python dependencies
│   ├── requirements-prod.txt   # Production dependencies only
│   └── requirements-test.txt   # Test dependencies only
│
├── frontend/                   # Shared frontend assets (SINGLE SOURCE OF TRUTH)
│   ├── static/
│   │   ├── css/               # 6 CSS modules
│   │   └── js/                # 13 JavaScript ES6 modules
│   └── templates/
│       ├── index.html         # Main application
│       └── info.html          # Documentation page
│
├── electron/                   # Desktop app wrapper (ONLY Electron-specific code)
│   ├── main.js                # Main process (spawns backend/, loads frontend/)
│   ├── preload.js             # IPC bridge
│   ├── menu.js                # Native menus
│   ├── file-handlers.js       # File dialogs
│   ├── package.json           # Electron dependencies
│   ├── index-desktop.html     # Simplified HTML (references ../frontend/)
│   └── build/
│       ├── icon.icns          # macOS icon
│       ├── icon.ico           # Windows icon
│       └── icon.png           # Linux icon
│
├── docker/                     # Web app Docker deployment
│   ├── Dockerfile             # References ../backend/ and ../frontend/
│   ├── docker-compose.yml
│   ├── deploy-beta.sh
│   └── README.md
│
├── tests/                      # Shared test suite
│   ├── backend/               # Backend tests (work for both web + desktop)
│   │   ├── test_app.py
│   │   ├── test_data_loader.py
│   │   └── test_acl_parser.py
│   ├── e2e/                   # Web app E2E tests (Playwright)
│   │   ├── 01-page-load.spec.js
│   │   └── ... (28 tests)
│   └── e2e-electron/          # Desktop app E2E tests (future)
│       └── ... (adapt from e2e/)
│
├── scripts/                    # Helper scripts
│   ├── run-web.sh             # Start web app: python backend/app.py
│   ├── run-desktop.sh         # Start Electron: cd electron && npm start
│   ├── build-web.sh           # Build Docker image
│   └── build-desktop.sh       # Build Electron app with electron-builder
│
├── docs/                       # Documentation
│   ├── ELECTRON-ROADMAP.md    # Preserved from v2-electron branch
│   ├── WEB-DEPLOYMENT.md      # Web app deployment guide
│   └── DEVELOPMENT.md         # Development workflow guide
│
├── CLAUDE.md                   # Project instructions (updated for monorepo)
├── README.md                   # Main project README (updated for monorepo)
├── .gitignore                  # Updated for new structure
├── playwright.config.js        # E2E test configuration
└── pytest.ini                  # Backend test configuration
```

---

## ✅ Benefits

### 1. Single Source of Truth
- **Backend code**: Exists ONCE in `backend/`
- **Frontend code**: Exists ONCE in `frontend/`
- **Fix a bug**: Both web and desktop get it automatically

### 2. Fast Development Workflow
```bash
# Develop new feature in web app (fast iteration)
cd redis-acl-builder
source venv/bin/activate
python backend/app.py  # localhost:5001

# Test in Electron (when ready)
cd electron
npm start  # Launches Electron with backend/ + frontend/
```

### 3. Independent Deployment
- **Web app**: Docker builds from `backend/` + `frontend/`
- **Desktop app**: Electron bundles `backend/` + `frontend/` into native app
- **Same code, different packaging**

### 4. No Branch Juggling
- Everything on `main` branch
- Release both from tags:
  - `v1.x` tags → Docker images (web only)
  - `v2.x` tags → Desktop releases (Electron)

---

## 📋 Migration Steps

### Phase 1: Reorganize Existing Code (1-2 hours)

**Step 1.1: Create new directories**
```bash
cd redis-acl-builder
mkdir backend frontend scripts docs
```

**Step 1.2: Move backend files**
```bash
git mv app.py helpers/ models/ backend/
git mv requirements*.txt backend/
git mv pytest.ini backend/
```

**Step 1.3: Move frontend files**
```bash
git mv static/ templates/ frontend/
```

**Step 1.4: Move documentation**
```bash
# Copy Electron roadmap from v2-electron branch
git show v2-electron:ELECTRON-ROADMAP.md > docs/ELECTRON-ROADMAP.md
```

**Step 1.5: Update import paths**
```python
# backend/app.py
from backend.helpers.data_loader import load_redis_data
from backend.helpers.acl_parser import ACLParser
from backend.models.api_models import ParseRequest, TestCommandRequest
```

**Step 1.6: Update Docker files**
```dockerfile
# docker/Dockerfile
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
WORKDIR /app
CMD ["python", "backend/app.py"]
```

**Step 1.7: Update test references**
```bash
# tests/backend/test_app.py
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'backend'))
```

**Step 1.8: Update Playwright config**
```javascript
// playwright.config.js
webServer: {
  command: 'source venv/bin/activate && python backend/app.py',
  url: 'http://localhost:5001',
}
```

**Step 1.9: Create helper scripts**
```bash
# scripts/run-web.sh
#!/bin/bash
cd "$(dirname "$0")/.."
source venv/bin/activate
python backend/app.py

# scripts/run-desktop.sh
#!/bin/bash
cd "$(dirname "$0")/../electron"
npm start
```

**Step 1.10: Update documentation**
- Update `README.md` with new structure
- Update `CLAUDE.md` with monorepo workflow
- Update `docker/README.md` with new paths

---

### Phase 2: Test Web App (30 minutes)

```bash
# Activate venv
source venv/bin/activate

# Start web app
python backend/app.py

# Run backend tests
cd tests/backend
pytest -v

# Run E2E tests
cd ../..
npx playwright test
```

**Expected Result:** All 195 backend tests + 28 E2E tests passing

---

### Phase 3: Add Electron Structure (Future)

**When ready to implement Electron (v2.0 development):**

```bash
# Create electron directory
mkdir electron
cd electron

# Initialize npm
npm init -y

# Install Electron
npm install --save-dev electron electron-builder

# Copy implementation plan files
# (main.js, preload.js, menu.js, etc. from ELECTRON-ROADMAP.md)
```

**Electron will reference existing code:**
```javascript
// electron/main.js
const backendPath = path.join(__dirname, '../backend/app.py');
const pythonProcess = spawn('python', [backendPath]);

// Load frontend
mainWindow.loadFile('../frontend/templates/index.html');
```

---

## 🔄 Development Workflow

### Adding New Feature (e.g., ACL Diff Viewer)

**1. Develop in web app (fast iteration):**
```bash
# Edit backend/app.py - add /api/diff-acl endpoint
# Edit frontend/static/js/components/acl-diff.js - add UI
# Test at localhost:5001
```

**2. Test with backend tests:**
```bash
pytest tests/backend/test_diff.py
```

**3. Test with E2E:**
```bash
npx playwright test tests/e2e/10-acl-diff.spec.js
```

**4. Commit changes:**
```bash
git add backend/ frontend/ tests/
git commit -m "feat: Add ACL diff viewer"
```

**5. Electron automatically picks it up:**
```bash
cd electron
npm start  # Uses updated backend/ and frontend/
```

**Zero code duplication. Single commit. Works everywhere.**

---

## 📦 Release Strategy

### Web App (Docker)
```bash
# Build Docker image
cd docker
./deploy-beta.sh

# Tag version
git tag v1.27.0-beta
git push origin v1.27.0-beta

# CI/CD publishes to Docker Hub
```

### Desktop App (Electron)
```bash
# Build for all platforms
cd electron
npm run build  # Creates DMG, EXE, AppImage

# Tag version
git tag v2.0.0-beta
git push origin v2.0.0-beta

# CI/CD publishes to GitHub Releases
```

**Both use the same backend/ and frontend/ code at that tag**

---

## ⚠️ Considerations

### Virtual Environment Location
Keep `venv/` in project root:
```
redis-acl-builder/
├── venv/           # Python virtual environment (gitignored)
├── backend/
├── frontend/
└── electron/
```

**Why?** Both web and desktop development use the same venv.

### Import Path Updates
Python imports need adjustment:
```python
# Before
from helpers.data_loader import load_redis_data

# After
from backend.helpers.data_loader import load_redis_data
```

### Docker Path Updates
Dockerfile references new structure:
```dockerfile
# Before
COPY . /app/

# After
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
```

### Test Path Updates
Tests import from new locations:
```python
# tests/backend/test_app.py
sys.path.insert(0, '../backend')
from app import app
```

---

## 🎯 Success Criteria

- [ ] All backend code moved to `backend/`
- [ ] All frontend code moved to `frontend/`
- [ ] All 195 backend tests passing
- [ ] All 28 E2E tests passing
- [ ] Docker build successful
- [ ] Web app runs at localhost:5001
- [ ] Documentation updated (README, CLAUDE.md)
- [ ] Electron roadmap preserved in `docs/ELECTRON-ROADMAP.md`
- [ ] Helper scripts created (`run-web.sh`, `run-desktop.sh`)
- [ ] Git history preserved (using `git mv`)

---

## 🚀 Timeline

**Total Estimated Time:** 2-3 hours

- **Phase 1**: Reorganize code (1-2 hours)
- **Phase 2**: Test and verify (30 minutes)
- **Phase 3**: Update documentation (30 minutes)
- **Phase 4**: Commit and tag (15 minutes)

---

## 📝 Next Steps

1. **Review this plan** - Confirm approach is sound
2. **Execute Phase 1** - Reorganize directories and update paths
3. **Execute Phase 2** - Test everything works
4. **Commit as v1.27.0** - "refactor: Monorepo structure for web + desktop support"
5. **Delete v2-electron branch** - No longer needed (roadmap preserved in docs/)

---

## ✨ Final State

After restructure:
- ✅ **Single codebase** for both web and desktop
- ✅ **Fast web development** workflow preserved
- ✅ **Electron roadmap** preserved and ready for implementation
- ✅ **No breaking changes** to existing functionality
- ✅ **Future-proof** for v2.0 desktop app development

**When v2.0 development begins**: Just create `electron/` directory and implement from roadmap. Backend and frontend are already ready!
