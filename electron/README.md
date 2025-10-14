# Redis ACL Builder - Desktop App (Electron)

> **Status**: v2.0.3-alpha - In Development

Desktop application wrapper for Redis ACL Builder using Electron.

## Quick Start

```bash
# From the electron directory
npm start

# With DevTools open
npm start:devtools
```

## Architecture

The Electron app wraps the existing Flask + JavaScript web application:

- **Backend**: Python Flask server (shared from `../backend/`)
- **Frontend**: HTML/CSS/JS interface (shared from `../frontend/`)
- **Port**: Flask runs on port **7381** for Electron (vs 5001 for web dev, 7380 for Docker)

## Project Structure

```
electron/
├── main.js           # Main Electron process
├── preload.js        # Preload script for security
├── package.json      # Node dependencies
├── build/            # App icons and resources
│   ├── icon.icns    # macOS icon
│   ├── icon.ico     # Windows icon
│   ├── icon.png     # Linux icon
│   └── icon-*.png   # Various sizes and variants
└── README.md        # This file
```

## Development Workflow

### Starting the App

```bash
cd redis-acl-builder/electron
npm start
```

The app will:
1. Activate the Python virtual environment (`../venv`)
2. Start Flask backend on port 7381
3. Open Electron window loading `http://localhost:7381`

### Making Changes

**Backend changes** (Python):
- Edit files in `../backend/`
- Flask will auto-reload (development mode)
- Refresh the Electron window (Cmd+R / Ctrl+R)

**Frontend changes** (HTML/CSS/JS):
- Edit files in `../frontend/`
- Refresh the Electron window (Cmd+R / Ctrl+R)

**Electron wrapper changes** (main.js, preload.js):
- Edit files in `electron/`
- Restart the Electron app (npm start)

### ⚠️ **CRITICAL: Process Management Warning**

**NEVER use `killall Electron` or `pkill Electron`!**

VS Code, Claude Code, and many other apps run on Electron. Killing all Electron processes will close your IDE!

**Safe ways to restart the app:**

```bash
# Option 1: Find specific process by path
ps aux | grep "redis-acl-builder/electron" | grep node
# Then kill by PID: kill <PID>

# Option 2: Close the app window normally
# The app will clean up processes automatically

# Option 3: Use the app name
ps aux | grep "redis-acl-builder-desktop"
```

### Debugging

```bash
# Open with DevTools
npm run start:devtools

# Or toggle DevTools in running app
# macOS: Cmd+Option+I
# Windows/Linux: Ctrl+Shift+I
```

## Icon Management

The app uses different icon sizes for different platforms:

- **macOS**: `icon.icns` (for app), `icon-cropped-larger.png` (for dock, 1.10x scaled)
- **Windows**: `icon.ico`
- **Linux**: `icon.png`

### Adjusting Dock Icon Size (macOS)

If the dock icon appears too large or too small compared to other apps:

```bash
# Adjust the scale factor (currently 1.10x)
cd build
python3 /tmp/scale_icon.py icon-cropped.png icon-cropped-larger.png 1.10
```

Scale factors:
- `1.00` = Original size
- `1.10` = 10% larger (current, matches VS Code icon size)
- `1.15` = 15% larger (too big)

The script scales the entire icon (red background + lock together) and centers it on a transparent canvas.

## Building for Distribution

```bash
# Build for all platforms
npm run build

# Build for specific platform
npm run build:mac      # macOS (DMG + ZIP)
npm run build:win      # Windows (NSIS installer + ZIP)
npm run build:linux    # Linux (AppImage + DEB)
```

Built apps will be in `dist/` directory.

## Configuration

### Window Size

Default: 1416×938 (matches web version panel-container)
- Minimum: 1016×800

Edit in `main.js`:
```javascript
const PANEL_WIDTH = 1416;
const PANEL_HEIGHT = 938;
```

### Flask Port

Default: 7381 (Electron), 5001 (web dev), 7380 (Docker)

Edit in `main.js`:
```javascript
const FLASK_PORT = 7381;
```

### Development vs Production

Auto-detected based on file structure:
- **Development**: Source files exist (`../backend/app.py`)
- **Production**: Packaged app bundle

## Requirements

- Node.js 18+ and npm
- Python 3.13+ (from parent project)
- Virtual environment at `../venv` (from parent project)
- All dependencies from `../backend/requirements.txt`

## Troubleshooting

### App won't start

```bash
# Check if port 7381 is already in use
lsof -i :7381

# If occupied, kill the process
kill <PID>
```

### Backend errors

```bash
# Activate venv and test Flask manually
cd ../
source venv/bin/activate
python backend/app.py
```

### Icon doesn't appear

Check icon files exist:
```bash
ls -lh build/icon*
```

Ensure paths are correct in `main.js` lines 122-136.

## Related Documentation

- **Main Project**: `../README.md`
- **Backend API**: `../backend/README.md` (if exists)
- **Electron Roadmap**: `../docs/ELECTRON-ROADMAP.md`
- **Web Version**: See parent directory's web deployment docs

## License

ISC License - See parent project for details.
