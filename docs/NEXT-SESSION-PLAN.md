# Next Session: Enterprise/OSS Mode Toggle UI Implementation

## Current Status: 75% Complete ✅

- ✅ Backend (100%) - Mode filtering, dual parsers, endpoints
- ✅ Frontend Infrastructure (100%) - AppState, API client, URL params
- ✅ Frontend Integration (100%) - 18 API call sites, minified assets
- ⏳ UI Implementation (0%) - **THIS IS WHAT WE'LL TACKLE NEXT**
- ⏳ Testing (0%)

---

## 🎯 Next Session Goals

### 1. Implement UI Toggle Component (2-3 hours)

**Location:** [frontend/templates/index.html:308](frontend/templates/index.html#L308)
(Same row as Redis Version toggle)

**Design Specs:**

- Purple/gold color scheme for Enterprise mode
- Format: `Mode: [OSS] [Enterprise]`
- Same styling as Redis Version toggle (button-style tabs)
- Tooltip: "OSS: All Redis commands | Enterprise: Cloud-restricted command set"

**HTML Structure:**

```html
<!-- Add after Redis Version toggle, around line 320 -->
<div class="toggle-group">
    <label class="toggle-label">Mode:</label>
    <div class="toggle-buttons" id="modeToggle">
        <button class="toggle-btn active" data-mode="oss">OSS</button>
        <button class="toggle-btn" data-mode="enterprise">Enterprise</button>
    </div>
    <span class="info-icon"
        title="OSS: All commands | Enterprise: Restricted set">ℹ️</span>
</div>
```

**CSS Additions:**

```css
/* Add to frontend/static/css/components.css */

/* Enterprise mode styling */
.toggle-btn[data-mode="enterprise"].active {
    background: linear-gradient(135deg, #6B46C1 0%, #9333EA 100%);
    color: #FFD700; /* Gold text */
    border-color: #9333EA;
}

.toggle-btn[data-mode="enterprise"]:hover {
    background: linear-gradient(135deg, #553C9A 0%, #7E22CE 100%);
}
```

**JavaScript Event Handler:**

```javascript
// Add to frontend/static/js/handlers/event-handlers.js

// Mode toggle handler
const modeToggle = document.getElementById('modeToggle');
if (modeToggle) {
    modeToggle.addEventListener('click', async (e) => {
        if (e.target.classList.contains('toggle-btn')) {
            const newMode = e.target.dataset.mode;

            // Update active state
            modeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // Update AppState and persist
            AppState.update({ currentMode: newMode });
            AppState.updateURL(AppState.currentVersion, newMode);

            // Invalidate caches
            API.invalidateCaches();

            // Re-render UI with new command set
            // TODO: Trigger re-render of interactive builder
            console.log(`Switched to ${newMode} mode`);
        }
    });
}

// Initialize mode toggle on page load
document.addEventListener('DOMContentLoaded', () => {
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        const currentMode = AppState.currentMode;
        modeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
    }
});
```

### 2. Update Command Count Display (30 minutes)

**Location:** Version detail line (where it shows
"Redis 8 (29 categories, 446 commands)")

**New Format:**

```text
Redis 8 OSS (29 categories, 446 commands)
Redis 8 Enterprise (28/29 categories, 440/446 commands)
```

**Implementation:**

```javascript
// Update the version display function
function updateVersionDisplay() {
    const versionDetail = document.getElementById('versionDetail');
    const version = AppState.currentVersion === 'redis8' ? '8' : '7';
    const mode = AppState.currentMode === 'oss' ? 'OSS' : 'Enterprise';

    // Fetch current counts from API
    const data = await API.getCategories(
        AppState.currentVersion, AppState.currentMode);
    const currentCategories = data.categories.length;
    const currentCommands = /* get from API */;

    if (AppState.currentMode === 'enterprise') {
        // Show current/total format
        const totalCategories = /* OSS count */;
        const totalCommands = /* OSS count */;
        versionDetail.textContent =
            `Redis ${version} ${mode} (${currentCategories}/` +
            `${totalCategories} categories, ` +
            `${currentCommands}/${totalCommands} commands)`;
    } else {
        // Show normal format
        versionDetail.textContent =
            `Redis ${version} ${mode} ` +
            `(${currentCategories} categories, ${currentCommands} commands)`;
    }
}
```

### 3. Wire Up Re-Rendering (1 hour)

**Challenge:** When mode switches, need to refresh the interactive
ACL builder

**Solution:** Add a re-render trigger to the mode toggle handler

```javascript
// After mode switch in event-handlers.js
const builderExists = typeof InteractiveACLBuilder !== 'undefined';
if (builderExists && InteractiveACLBuilder.state.isInitialized) {
    // Reload all data with new mode
    await InteractiveACLBuilder.loadAllData();

    // Re-sync from current rule text
    await InteractiveACLBuilder.syncFromRuleText();

    // Re-render the UI
    InteractiveACLBuilder.scheduleRender();
}
```

---

## 📝 Implementation Checklist

### HTML Changes

- [ ] Add mode toggle HTML structure to index.html
- [ ] Add info icon with tooltip
- [ ] Position correctly (same row as version toggle)

### CSS Changes

- [ ] Add purple/gold Enterprise mode styling
- [ ] Add hover states
- [ ] Ensure consistent with existing toggle styling
- [ ] Test in light and dark themes

### JavaScript Changes

- [ ] Add mode toggle event handler
- [ ] Add DOMContentLoaded initialization
- [ ] Add re-render trigger for interactive builder
- [ ] Update command count display function
- [ ] Handle cache invalidation

### Testing Before Commit

- [ ] Toggle switches between OSS and Enterprise visually
- [ ] URL updates correctly (?mode=enterprise)
- [ ] localStorage persists mode selection
- [ ] Page reload preserves mode from URL or localStorage
- [ ] Command counts update when mode switches
- [ ] Interactive builder refreshes with new command set
- [ ] Restricted commands disappear in Enterprise mode
- [ ] Cache invalidation works (no stale data)
- [ ] Rebuild minified assets: `python3 scripts/build_minified.py`

---

## 🧪 Quick Test Plan

### Manual Testing Workflow

1. **Fresh Load:**
   - Open `http://localhost:5001`
   - Should default to Redis 8 OSS mode
   - Verify command count shows all 446 commands

2. **Toggle to Enterprise:**
   - Click "Enterprise" button
   - URL should update to `?version=redis8&mode=enterprise`
   - Command count should show 440/446 commands
   - Interactive builder should refresh

3. **Test Restricted Commands:**
   - Try adding `cluster|addslots` command
   - Should not appear in command list in Enterprise mode
   - Switch to OSS mode - should now appear

4. **Test Persistence:**
   - Switch to Enterprise mode
   - Refresh page
   - Should stay in Enterprise mode (localStorage)

5. **Test URL Parameters:**
   - Navigate to `http://localhost:5001/?version=redis7&mode=enterprise`
   - Should load Redis 7 Enterprise mode
   - Command count should show 305/379 commands

### Backend API Test

```bash
# Test Enterprise mode returns fewer commands
curl -X POST http://localhost:5001/api/parse \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@all", "version": "redis8", "mode": "enterprise"}' | \
  jq '.total_granted'

# Should return 440 (vs 446 for OSS)
```

---

## 📂 Files to Modify

| File | Changes | LOC |
|------|---------|-----|
| `frontend/templates/index.html` | Add toggle HTML | +15 |
| `frontend/static/css/components.css` | Enterprise style | +30 |
| `frontend/static/js/handlers/event-handlers.js` | Toggle logic | +40 |
| `frontend/static/js/components/interactive-acl-builder.js` | Count | +25 |

**Total:** ~110 lines of new code

---

## 🚀 Quick Start for Next Session

```bash
# 1. Activate virtual environment
cd redis-acl-builder
source venv/bin/activate

# 2. Ensure dev server is running
python backend/app.py
# Server should be at http://localhost:5001

# 3. Open browser to test
open http://localhost:5001

# 4. Start implementing:
#    - Edit index.html (add toggle HTML)
#    - Edit components.css (add Enterprise styling)
#    - Edit event-handlers.js (add toggle logic)
#    - Test in browser
#    - Rebuild minified: python3 scripts/build_minified.py
#    - Commit and push
```

---

## 💡 Tips & Gotchas

1. **Don't forget to rebuild minified assets** after any CSS/JS changes
2. **Test both light and dark themes** - Enterprise purple should work
3. **Clear localStorage** during testing: `localStorage.clear()`
4. **Check browser console** for any JavaScript errors during mode switch
5. **URL should update** without page reload (using History API)
6. **Cache invalidation is critical** - verify with Network tab

---

## 🎨 Design Reference

The existing Redis Version toggle looks like this:

```text
Version: [Redis 7] [Redis 8]  ℹ️
```

We're adding this right below it:

```text
Mode:    [OSS]     [Enterprise]  ℹ️
```

**Color Palette:**

- OSS (default): Blue gradient (existing style)
- Enterprise: Purple (#6B46C1 → #9333EA) with gold text (#FFD700)

---

## 📊 Progress Tracking

After UI implementation completes, we'll be at:

- **Backend**: 100% ✅
- **Frontend Infrastructure**: 100% ✅
- **Frontend Integration**: 100% ✅
- **UI Implementation**: 100% ✅
- **Testing**: 0% ⏳

Final remaining work:

- Write backend API tests for Enterprise mode
- Write E2E Playwright tests for mode toggle
- Update existing tests to cover both modes

**Estimated time to 100% completion:** ~3-4 hours after UI is done
