# Troubleshooting Guide

Solutions to common issues with Redis ACL Builder.

---

## Desktop App Issues

### macOS

#### "App is damaged and can't be opened"

**Cause:** Gatekeeper quarantine attribute (rare with signed apps)

**Solution:**

```bash
xattr -cr "/Applications/Redis ACL Builder.app"
```

#### "Cannot be opened because the developer cannot be verified"

**Cause:** Corrupted app signature

**Solution:**

```bash
xattr -d com.apple.quarantine "/Applications/Redis ACL Builder.app"
```

#### App won't launch (no error)

**Diagnosis:**

```bash
# Check for errors
open -a "Redis ACL Builder" 2>&1

# View system log
log show --predicate 'process == "Redis ACL Builder"' --last 5m
```

**Common causes:**

- Insufficient permissions
- Corrupted installation
- Missing dependencies

**Solution:** Reinstall from official DMG

---

### Windows

#### "Windows protected your PC" (SmartScreen)

**Cause:** New release without established reputation

**Solution:**

1. Click "More info"
2. Click "Run anyway"

#### Antivirus blocking installation

**Cause:** False positive on packaged Python executable

**Solution:**

1. Add exception for Redis ACL Builder
2. Verify checksum from GitHub Releases
3. Temporarily disable antivirus during install

#### App crashes on launch

**Diagnosis:**

Check Event Viewer:

- Windows Logs → Application
- Look for Redis ACL Builder errors

**Common causes:**

- Missing Visual C++ Redistributable
- Corrupted installation

**Solution:**

1. Install Visual C++ Redistributable 2015-2022
2. Reinstall Redis ACL Builder

---

### Linux

#### "No such file or directory" (AppImage)

**Cause:** Missing FUSE

**Solution:**

```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs

# Arch
sudo pacman -S fuse2
```

#### AppImage won't run on headless server

**Cause:** AppImages require display server

**Solution:** Use Docker deployment instead

---

## Docker Issues

### Port Already in Use

**Diagnosis:**

```bash
# macOS/Linux
lsof -i :7380

# Windows
netstat -ano | findstr :7380
```

**Solution:**

```bash
# Option 1: Stop conflicting process
kill <PID>

# Option 2: Use different port
docker run -p 8080:7380 markotrapani608/redis-acl-builder:latest
```

### Container Exits Immediately

**Diagnosis:**

```bash
docker logs redis-acl-builder
```

**Common causes:**

- Port binding failure
- Missing environment variables
- Permission issues

**Solution:**

```bash
# Run in foreground for debugging
docker run --rm -it -p 7380:7380 markotrapani608/redis-acl-builder:latest
```

### Cannot Pull Image

**Cause:** Network issues or incorrect tag

**Solution:**

```bash
# Verify tag exists
docker search markotrapani608/redis-acl-builder

# Pull with explicit tag
docker pull markotrapani608/redis-acl-builder:latest

# Check Docker Hub status
curl -s https://hub.docker.com/v2/repositories/markotrapani608/redis-acl-builder/tags
```

---

## Web App Issues

### Flask Server Won't Start

**Diagnosis:**

```bash
python backend/app.py
```

**Common errors:**

#### "ModuleNotFoundError: No module named 'flask'"

Solution:

```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

#### "Address already in use"

Solution:

```bash
# Find process using port 7380
lsof -i :7380

# Kill the process
kill -9 <PID>

# Or run on different port
FLASK_PORT=8080 python backend/app.py
```

#### "Python version too old"

Solution:

```bash
# Check Python version
python3 --version

# Install Python 3.10+
# macOS: brew install python@3.11
# Ubuntu: sudo apt install python3.11
```

### Web Page Won't Load

**Check 1: Is server running?**

```bash
curl http://localhost:7380/health
# Expected: {"status": "healthy"}
```

**Check 2: Port accessible?**

```bash
nc -zv localhost 7380
# Expected: Connection succeeded
```

**Check 3: Firewall blocking?**

```bash
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps

# Linux
sudo ufw status

# Windows
netsh advfirewall firewall show rule name=all
```

---

## Feature Issues

### ACL Parsing Errors

#### "Invalid category"

**Cause:** Typo or unsupported category

**Solution:**

- Check spelling: `@read`, not `@reads`
- Verify category exists in your Redis version
- Use `/api/categories` to list valid categories

#### "Invalid command"

**Cause:** Command doesn't exist or typo

**Solution:**

- Check Redis documentation for correct command name
- Use lowercase: `get`, not `GET`
- Verify command exists in selected Redis version

### Command Testing Not Working

**Issue:** Command test returns unexpected results

**Diagnosis:**

1. **Check ACL rule syntax** - Ensure rule is valid
2. **Verify Redis version** - Command may not exist in selected version
3. **Test with simple rule** - `+@all ~*` should allow everything

**Common causes:**

- Selector syntax not fully supported in UI
- Redis Enterprise command restrictions
- Rule precedence misunderstanding

### Optimization Suggestions Incorrect

**Issue:** Optimization doesn't seem optimal

**Cause:** Complex rule with edge cases

**Solution:**

- Review the "What does this optimize?" explanation
- Consider if manual rule is intentionally specific
- Dismiss suggestion if not applicable

### Search Not Finding Commands

**Issue:** Search returns no results

**Diagnosis:**

1. **Check search mode** - Toggle between fuzzy/exact
2. **Try partial match** - "get" finds GET, GETSET, HGET
3. **Clear filters** - Click X to reset search

---

## Performance Issues

### Slow Loading

**Cause:** Large ACL rules with many terms

**Solution:**

- Optimize rule using suggestions
- Use categories instead of individual commands
- Reduce number of selectors

### UI Freezing

**Cause:** Rendering lag on large rule updates

**Solution:**

- Avoid rapidly clicking many commands
- Use manual editing for bulk changes
- Reload page if frozen

---

## Data Issues

### Lost Configuration

**Cause:** localStorage cleared or disabled

**Solution:**

- Enable localStorage in browser settings
- Use "Save Rule" feature to persist important rules
- Export rules before clearing browser data

### Theme Not Persisting

**Cause:** localStorage disabled or browser privacy mode

**Solution:**

- Disable private/incognito mode
- Allow localStorage for the site
- Check browser extensions blocking storage

---

## Getting Help

Still having issues?

1. **[FAQ](./FAQ)** - Check frequently asked questions
2. **[GitHub
   Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)**
   - Ask the community
3. **[Issue
   Tracker](https://github.com/markotrapani/redis-acl-builder/issues)** -
   Report bugs
4. **[User Guide](./User-Guide)** - Review documentation

---

When reporting issues, include:

- Platform (macOS/Windows/Linux/Docker)
- Version (check Help → About or `--version`)
- Steps to reproduce
- Error messages
- Screenshots if applicable

---

**Need immediate help?** Visit [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)!
