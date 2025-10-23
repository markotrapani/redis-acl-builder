# Installation Guide

This guide covers installation instructions for all supported platforms and
deployment methods.

---

## 🖥️ Desktop Applications (Recommended for End Users)

### macOS Installation

#### Method 1: DMG Installer (Recommended)

1. **Download the appropriate DMG file:**
   - **Apple Silicon (M1/M2/M3/M4):** `Redis-ACL-Builder-2.6.0-beta-arm64.dmg`
   - **Intel Macs:** `Redis-ACL-Builder-2.6.0-beta-x64.dmg`
   - **[Download from GitHub
     Releases](https://github.com/markotrapani/redis-acl-builder/releases/latest)**

2. **Install the application:**
   - Open the downloaded DMG file
   - Drag "Redis ACL Builder" to the Applications folder
   - Eject the DMG

3. **First launch (signed and notarized - no security warnings!):**
   - Open Applications folder
   - Double-click "Redis ACL Builder"
   - App launches immediately (no security dialogs needed)

#### Method 2: ZIP Archive

```bash
# Download the ZIP file for your architecture
# - Redis-ACL-Builder-2.6.0-beta-arm64.zip (Apple Silicon)
# - Redis-ACL-Builder-2.6.0-beta-x64.zip (Intel)

# Extract the ZIP
unzip Redis-ACL-Builder-2.6.0-beta-arm64.zip

# Move to Applications
mv "Redis ACL Builder.app" /Applications/

# Launch
open -a "Redis ACL Builder"
```

#### Troubleshooting macOS

**"App is damaged and can't be opened"** (Rare - only if downloaded from
non-official source)

This is a Gatekeeper quarantine attribute. Solution:

```bash
xattr -cr "/Applications/Redis ACL Builder.app"
```

**"Cannot be opened because the developer cannot be verified"** (Should not
occur - app is signed and notarized)

If you see this, the app signature may have been corrupted:

```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine "/Applications/Redis ACL Builder.app"
```

---

### Windows Installation

#### Method 1: NSIS Installer (Recommended)

1. **Download the installer:**
   - `Redis-ACL-Builder-Setup-2.6.0-beta.exe`
   - **[Download from GitHub
     Releases](https://github.com/markotrapani/redis-acl-builder/releases/latest)**

2. **Run the installer:**
   - Double-click the downloaded `.exe` file
   - Click "Yes" on the UAC prompt (if shown)
   - Follow the installation wizard
   - Choose installation location (default: `C:\Program Files\Redis ACL
     Builder`)
   - Select "Create desktop shortcut" (optional)

3. **Launch the application:**
   - Find "Redis ACL Builder" in Start Menu
   - Or double-click the desktop shortcut

#### Method 2: Portable ZIP

```powershell
# Download Redis-ACL-Builder-2.6.0-beta-win.zip

# Extract to desired location
Expand-Archive -Path Redis-ACL-Builder-2.6.0-beta-win.zip -DestinationPath "C:\Tools\Redis-ACL-Builder"

# Run the application
& "C:\Tools\Redis-ACL-Builder\Redis ACL Builder.exe"
```

#### Troubleshooting Windows

##### "Windows protected your PC" (SmartScreen warning)

This may occur for new releases before Windows builds reputation:

1. Click "More info"
2. Click "Run anyway"

##### Antivirus blocking the app

Some antivirus software may flag the packaged Python executable. This is a
false positive. You can:

1. Add an exception for the Redis ACL Builder executable
2. Verify the installer checksum from GitHub Releases

---

### Linux Installation

#### Method 1: AppImage (All Distributions)

```bash
# Download the AppImage
wget https://github.com/markotrapani/redis-acl-builder/releases/download/v2.6.0-beta/Redis-ACL-Builder-2.6.0-beta.AppImage

# Make executable
chmod +x Redis-ACL-Builder-2.6.0-beta.AppImage

# Run the application
./Redis-ACL-Builder-2.6.0-beta.AppImage

# Optional: Install to system
sudo mv Redis-ACL-Builder-2.6.0-beta.AppImage /usr/local/bin/redis-acl-builder
```

#### Method 2: .deb Package (Debian/Ubuntu)

```bash
# Download the .deb package
wget https://github.com/markotrapani/redis-acl-builder/releases/download/v2.6.0-beta/Redis-ACL-Builder_2.6.0-beta_amd64.deb

# Install the package
sudo dpkg -i Redis-ACL-Builder_2.6.0-beta_amd64.deb

# If missing dependencies:
sudo apt-get install -f

# Launch from application menu or terminal
redis-acl-builder
```

#### Troubleshooting Linux

##### "No such file or directory" when running AppImage

You may need FUSE to run AppImages:

```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs

# Arch
sudo pacman -S fuse2
```

##### AppImage won't run on headless server

AppImages require a display server. For headless servers, use the [Docker
deployment](#docker-deployment) instead.

---

## 🐳 Docker Deployment

### Quick Start

```bash
# Pull and run the latest version
docker run -d \
  --name redis-acl-builder \
  -p 7380:7380 \
  --restart unless-stopped \
  markotrapani608/redis-acl-builder:latest

# Access the application
open http://localhost:7380
```

### Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  redis-acl-builder:
    image: markotrapani608/redis-acl-builder:latest
    container_name: redis-acl-builder
    ports:
      - "7380:7380"
    restart: unless-stopped
    environment:
      - FLASK_ENV=production
      - FLASK_DEBUG=False
```

Run with Docker Compose:

```bash
# Start the service
docker compose up -d

# View logs
docker compose logs -f

# Stop the service
docker compose down

# Update to latest version
docker compose pull && docker compose up -d
```

### Available Docker Tags

- **`latest`** - Most recent stable release (currently v2.6.0-beta)
- **`beta`** - Latest beta release with newest features
- **`v2.6.0-beta`** - Specific version tag
- **`v2.4.7-beta`** - Previous stable version

### Docker Configuration

#### Custom Port Mapping

```bash
# Run on port 8080 instead of 7380
docker run -d \
  --name redis-acl-builder \
  -p 8080:7380 \
  markotrapani608/redis-acl-builder:latest
```

#### Environment Variables

```bash
docker run -d \
  --name redis-acl-builder \
  -p 7380:7380 \
  -e FLASK_ENV=production \
  -e FLASK_DEBUG=False \
  markotrapani608/redis-acl-builder:latest
```

#### Health Checks

```bash
# Check container health
curl http://localhost:7380/health

# Expected response:
# {"status": "healthy"}
```

### Upgrading Docker Deployment

```bash
# Stop and remove existing container
docker stop redis-acl-builder
docker rm redis-acl-builder

# Pull latest image
docker pull markotrapani608/redis-acl-builder:latest

# Start new container with latest image
docker run -d \
  --name redis-acl-builder \
  -p 7380:7380 \
  --restart unless-stopped \
  markotrapani608/redis-acl-builder:latest
```

Or with Docker Compose:

```bash
docker compose pull && docker compose up -d
```

### Troubleshooting Docker

#### Port already in use

```bash
# Find what's using port 7380
lsof -i :7380  # macOS/Linux
netstat -ano | findstr :7380  # Windows

# Use a different port
docker run -d -p 8080:7380 markotrapani608/redis-acl-builder:latest
```

#### Container exits immediately

```bash
# Check logs
docker logs redis-acl-builder

# Run in foreground for debugging
docker run --rm -it -p 7380:7380 markotrapani608/redis-acl-builder:latest
```

---

## 💻 Local Development Installation

### Prerequisites

- **Python 3.10 or higher** (Python 3.11+ recommended)
- **Node.js 18+** (for E2E testing only)
- **Git** (for cloning the repository)

### Step-by-Step Setup

1. **Clone the repository:**

```bash
git clone https://github.com/markotrapani/redis-acl-builder.git
cd redis-acl-builder
```

1. **Create a virtual environment:**

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

1. **Install Python dependencies:**

```bash
pip install -r backend/requirements.txt
```

1. **Run the application:**

```bash
# Option 1: Use helper script
./scripts/run-web.sh

# Option 2: Run directly
python backend/app.py
```

1. **Access the application:**

   Open your browser and navigate to `http://localhost:7380`

### Development Tools

**Install E2E testing dependencies:**

```bash
npm install
npx playwright install
```

**Run tests:**

```bash
# Backend tests
pytest tests/backend/ -v

# E2E tests
npx playwright test

# With coverage
pytest tests/backend/ --cov=backend --cov-report=html
```

**Build minified assets:**

```bash
python3 build_minified.py
```

---

## 🔄 Auto-Updates

Desktop applications include automatic update functionality:

- **macOS/Windows/Linux:** Auto-update checks on launch
- **Update notification:** Appears when new version available
- **Download:** Automatic in background
- **Installation:** One-click update (restarts app)

**Manual update check:**

- Desktop app: Help menu → Check for Updates
- Docker: Pull latest image and restart container
- Local dev: `git pull origin main` and restart server

---

## 📋 System Requirements

### Desktop Applications

**macOS:**

- macOS 10.13 (High Sierra) or later
- 64-bit Intel or Apple Silicon processor
- 100 MB free disk space

**Windows:**

- Windows 10 (1809) or later
- 64-bit processor
- 150 MB free disk space

**Linux:**

- Ubuntu 18.04+ / Debian 10+ / Fedora 30+ / Arch
- 64-bit x86_64 processor
- 150 MB free disk space
- FUSE installed (for AppImages)

### Docker Deployment

- Docker 20.10+
- 512 MB RAM minimum (1 GB recommended)
- 200 MB disk space

### Local Development

- Python 3.10+ (3.11+ recommended)
- 1 GB RAM minimum
- 500 MB disk space (including dependencies)

---

## 📝 Next Steps

After installation:

1. **[Getting Started Guide](./Getting-Started)** - Create your first ACL rule
2. **[User Guide](./User-Guide)** - Learn about features and capabilities
3. **[Troubleshooting](./Troubleshooting)** - Common issues and solutions

---

**Need help?** Check the [FAQ](./FAQ) or visit [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)!
