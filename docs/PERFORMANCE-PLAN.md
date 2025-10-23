# Redis ACL Builder - Performance Optimization Plan

**Status:** Planning Phase

**Target Version:** v2.7.x - v2.9.x

**Last Updated:** 2025-10-22

---

## 📋 Overview

This document outlines a comprehensive performance optimization roadmap for the
Redis ACL Builder application. Optimizations are organized into three tiers
based on impact and implementation effort.

**Current Performance Baseline:**

- **Startup Time:** 2-3 seconds (acceptable)
- **Memory Usage:** ~150-200MB (includes bundled Python + Chromium)
- **API Response Times:** Sub-millisecond for most operations (validated by
  performance benchmarks)
- **Test Results:** All 11 performance benchmarks passing with sub-millisecond
  times

**Optimization Goals:**

- Reduce initial page load time by 40-50%
- Improve input responsiveness by 5-10x
- Reduce API round-trips by 50-60%
- Eliminate UI freezing during heavy operations

---

## 🚀 Tier 1: High Impact, Low Effort

**Priority:** Implement First

**Total Time:** ~3.5 hours

**Combined Impact:** 2-3x faster for common operations

### 1. Debounce Input Updates ⚡ HIGH IMPACT

**Problem:** Every keystroke triggers full ACL generation + syntax highlighting

**Solution:** Add 300ms debounce delay on text inputs

**Impact:** 70-80% reduction in unnecessary processing

**Time Estimate:** 30 minutes

**Implementation:**

```javascript
// In frontend/static/js/components/interactive-acl-builder.js
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Apply to ACL textarea
const debouncedUpdateACL = debounce(updateACLRule, 300);
aclTextarea.addEventListener('input', debouncedUpdateACL);
```

**Files to Modify:**

- `frontend/static/js/components/interactive-acl-builder.js`
- `frontend/static/js/core/utils.js` (add debounce helper)

**Testing:**

- Verify ACL updates still trigger after 300ms of inactivity
- Ensure no regression in manual Submit Changes button behavior
- Test with rapid typing (should only process final state)

---

### 2. Cache API Responses ⚡ HIGH IMPACT

**Problem:** Same API calls made repeatedly (especially during testing)

**Solution:** Implement client-side cache with TTL (Time To Live)

**Impact:** 50-60% reduction in API round-trips

**Time Estimate:** 1 hour

**Implementation:**

```javascript
// In frontend/static/js/api/api-client.js
class APICache {
    constructor(ttl = 60000) { // 60 second default TTL
        this.cache = new Map();
        this.ttl = ttl;
    }

    generateKey(endpoint, params) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }

    get(endpoint, params) {
        const key = this.generateKey(endpoint, params);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }

        this.cache.delete(key);
        return null;
    }

    set(endpoint, params, data) {
        const key = this.generateKey(endpoint, params);
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    invalidate(endpoint) {
        // Remove all entries matching endpoint
        for (const key of this.cache.keys()) {
            if (key.startsWith(endpoint + ':')) {
                this.cache.delete(key);
            }
        }
    }
}

const apiCache = new APICache();

// Update fetch wrapper
async function cachedFetch(endpoint, params) {
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;

    const response = await fetch(endpoint, params);
    const data = await response.json();
    apiCache.set(endpoint, params, data);
    return data;
}
```

**Cache Invalidation Rules:**

- Invalidate `/api/parse` cache when ACL rule changes
- Invalidate `/api/test-command` cache when ACL rule changes
- Keep `/api/categories` cached for entire session (static data)
- Keep `/api/command-info` cached for entire session (static data)

**Files to Modify:**

- `frontend/static/js/api/api-client.js` (add APICache class)
- Update all API calls to use cached fetch wrapper

**Testing:**

- Verify cache hits reduce network requests
- Ensure cache invalidation works when ACL changes
- Test cache expiration after TTL

---

### 3. Lazy Load Categories ⚡ HIGH IMPACT

**Problem:** All command categories loaded immediately on page load

**Solution:** Load categories only when first expanded

**Impact:** 40-50% faster initial page load

**Time Estimate:** 2 hours

**Implementation:**

```javascript
// In frontend/static/js/components/interactive-acl-builder.js
function createCategoryButton(categoryName, commandCount) {
    const button = document.createElement('button');
    button.className = 'category-button';
    button.dataset.category = categoryName;
    button.dataset.loaded = 'false';

    button.addEventListener('click', async () => {
        if (button.dataset.loaded === 'false') {
            // Show loading spinner
            button.classList.add('loading');

            // Fetch category commands
            const commands = await fetchCategoryCommands(categoryName);

            // Render commands
            renderCategoryCommands(categoryName, commands);

            button.dataset.loaded = 'true';
            button.classList.remove('loading');
        }

        // Toggle expand/collapse
        toggleCategory(categoryName);
    });

    return button;
}
```

**Initial Load Strategy:**

- Load only category names and command counts
- Load @all category commands (most commonly used)
- Load other categories on first expand

**Files to Modify:**

- `frontend/static/js/components/interactive-acl-builder.js`
- `frontend/static/css/components.css` (add loading spinner styles)

**Testing:**

- Verify categories load on first expand
- Ensure subsequent expands are instant
- Test with all 29 Redis 8 categories

---

## 🔧 Tier 2: Medium Impact, Medium Effort

**Priority:** Implement After Tier 1

**Total Time:** ~9-10 hours

**Combined Impact:** 1.5-2x faster rendering

### 4. Optimize DOM Manipulation 🔧 MEDIUM IMPACT

**Problem:** Individual DOM updates for each change (causes reflows)

**Solution:** Batch DOM updates using DocumentFragment

**Impact:** 30-40% reduction in render time

**Time Estimate:** 3 hours

**Implementation:**

```javascript
// In frontend/static/js/components/interactive-acl-builder.js
function renderCommandList(commands) {
    const fragment = document.DocumentFragment();

    commands.forEach(command => {
        const button = createCommandButton(command);
        fragment.appendChild(button);
    });

    // Single DOM update instead of N updates
    commandContainer.innerHTML = '';
    commandContainer.appendChild(fragment);
}
```

**Target Areas:**

- Category command rendering
- Granted/blocked command list updates
- Search results rendering

**Files to Modify:**

- `frontend/static/js/components/interactive-acl-builder.js`
- `frontend/static/js/managers/category-manager.js`

**Testing:**

- Measure render time before/after with Chrome DevTools Performance tab
- Verify no visual regression
- Test with large category lists (200+ commands)

---

### 5. Request Deduplication 🔧 MEDIUM IMPACT

**Problem:** Multiple identical requests sent simultaneously

**Solution:** Queue identical requests and share results

**Impact:** 30-40% reduction in redundant API calls

**Time Estimate:** 2 hours

**Implementation:**

```javascript
// In frontend/static/js/api/api-client.js
class RequestDeduplicator {
    constructor() {
        this.pending = new Map();
    }

    async request(endpoint, params) {
        const key = `${endpoint}:${JSON.stringify(params)}`;

        // Return existing pending request
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        // Create new request
        const promise = fetch(endpoint, params)
            .then(r => r.json())
            .finally(() => this.pending.delete(key));

        this.pending.set(key, promise);
        return promise;
    }
}

const deduplicator = new RequestDeduplicator();
```

**Files to Modify:**

- `frontend/static/js/api/api-client.js`

**Testing:**

- Trigger multiple identical requests rapidly
- Verify only one network request sent
- Ensure all callers receive the same response

---

### 6. Virtual Scrolling for Long Lists 🔧 MEDIUM IMPACT

**Problem:** Rendering hundreds of commands causes lag

**Solution:** Only render visible items in viewport

**Impact:** 50-60% faster rendering for large category lists

**Time Estimate:** 4-5 hours

**Implementation:**

Use a lightweight virtual scrolling library or implement custom:

```javascript
// Simple virtual scrolling implementation
class VirtualScroller {
    constructor(container, items, itemHeight) {
        this.container = container;
        this.items = items;
        this.itemHeight = itemHeight;
        this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
        this.scrollTop = 0;

        this.container.addEventListener('scroll', () => this.render());
        this.render();
    }

    render() {
        const scrollTop = this.container.scrollTop;
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleCount, this.items.length);

        // Render only visible items
        const fragment = document.createDocumentFragment();
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.createItem(this.items[i], i);
            fragment.appendChild(item);
        }

        this.container.innerHTML = '';
        this.container.appendChild(fragment);

        // Set container height for scrollbar
        this.container.style.height = `${this.items.length * this.itemHeight}px`;
    }
}
```

**Target Areas:**

- Category command lists (200+ commands in some categories)
- Search results (can show hundreds of matches)

**Files to Modify:**

- `frontend/static/js/components/interactive-acl-builder.js`
- `frontend/static/css/components.css` (virtual scroll container styles)

**Testing:**

- Test with @all category (496 commands in Redis 8)
- Verify smooth scrolling performance
- Ensure all items accessible via scroll

---

## 💎 Tier 3: High Impact, High Effort

**Priority:** Long-term Improvements

**Total Time:** ~15-19 hours

**Combined Impact:** 10-20x faster for heavy operations

### 7. Backend Caching 💎 HIGH IMPACT

**Problem:** Redis command metadata regenerated on every request

**Solution:** Add server-side Redis cache or in-memory cache

**Impact:** 80-90% reduction in backend processing time

**Time Estimate:** 6-8 hours

**Implementation:**

```python
# In backend/app.py
from flask_caching import Cache

cache = Cache(app, config={
    'CACHE_TYPE': 'simple',  # or 'redis' for production
    'CACHE_DEFAULT_TIMEOUT': 3600
})

@app.route('/api/categories', methods=['GET'])
@cache.cached(timeout=3600, query_string=True)
def get_categories():
    version = request.args.get('version', 'redis7')
    # ... existing logic
```

**Cache Strategy:**

- Cache static data indefinitely (categories, command info)
- Cache parsed ACL rules with 5-minute TTL
- Cache optimization results with 1-hour TTL
- Invalidate cache on data updates

**Files to Modify:**

- `backend/app.py` (add Flask-Caching)
- `backend/requirements.txt` (add flask-caching)

**Testing:**

- Measure API response times before/after
- Verify cache invalidation works
- Test with Redis backend for production

---

### 8. Web Workers for ACL Generation 💎 HIGH IMPACT

**Problem:** ACL generation blocks main UI thread

**Solution:** Move heavy computation to background Web Worker

**Impact:** 90-95% reduction in UI freezing

**Time Estimate:** 5-6 hours

**Implementation:**

```javascript
// In frontend/static/js/workers/acl-worker.js
self.addEventListener('message', async (event) => {
    const { type, rule, version } = event.data;

    if (type === 'PARSE_ACL') {
        const response = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule, version })
        });

        const result = await response.json();
        self.postMessage({ type: 'PARSE_COMPLETE', result });
    }
});

// In main thread
const aclWorker = new Worker('/static/js/workers/acl-worker.js');

aclWorker.addEventListener('message', (event) => {
    if (event.data.type === 'PARSE_COMPLETE') {
        updateUI(event.data.result);
    }
});

// Send parsing work to worker
aclWorker.postMessage({ type: 'PARSE_ACL', rule, version });
```

**Files to Create:**

- `frontend/static/js/workers/acl-worker.js`

**Files to Modify:**

- `frontend/static/js/components/interactive-acl-builder.js`

**Testing:**

- Verify UI remains responsive during parsing
- Test with complex ACL rules (100+ tokens)
- Ensure error handling works in worker

---

### 9. IndexedDB for Client-Side Storage 💎 MEDIUM IMPACT

**Problem:** All state lost on page refresh

**Solution:** Persist ACL rules and settings to IndexedDB

**Impact:** Better user experience with state persistence

**Time Estimate:** 4-5 hours

**Implementation:**

```javascript
// In frontend/static/js/core/storage.js
class IndexedDBStorage {
    constructor(dbName, version) {
        this.dbName = dbName;
        this.version = version;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('rules')) {
                    db.createObjectStore('rules', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }
            };
        });
    }

    async saveRule(rule) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['rules'], 'readwrite');
            const store = transaction.objectStore('rules');
            const request = store.add({ rule, timestamp: Date.now() });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
```

**Migration Path:**

- Phase 1: Migrate from localStorage to IndexedDB
- Phase 2: Add cross-tab synchronization
- Phase 3: Add export/import functionality

**Files to Create:**

- `frontend/static/js/core/storage.js`

**Files to Modify:**

- `frontend/static/js/components/saved-rules.js`

**Testing:**

- Verify data persists across browser restarts
- Test with 100+ saved rules
- Ensure migration from localStorage works

---

## 📊 Performance Optimization Summary

### Recommended Implementation Order

1. **Start with Tier 1** (3.5 hours) - Maximum impact for minimal time investment
2. **Evaluate results and user feedback**
3. **Proceed to Tier 2** (9-10 hours) if needed for better UX
4. **Consider Tier 3** (15-19 hours) for production-ready polish

### Total Estimated Time for All Tiers

**27.5-32.5 hours** of focused development

### Expected Overall Performance Gains

- **Initial page load:** 2-3x faster
- **Input responsiveness:** 5-10x faster
- **API operations:** 2-4x faster
- **Large dataset handling:** 10-20x faster

### Success Metrics

**Tier 1 Complete:**

- [ ] Page load time < 1 second
- [ ] Input lag < 50ms
- [ ] API cache hit rate > 60%

**Tier 2 Complete:**

- [ ] Render time for 200+ commands < 100ms
- [ ] Zero redundant API calls detected
- [ ] Smooth scrolling at 60 FPS

**Tier 3 Complete:**

- [ ] Backend response time < 10ms
- [ ] UI remains responsive during all operations
- [ ] State persists across sessions

---

## 🔗 Related Documentation

- **[ROADMAP.md](./ROADMAP.md)** - Product roadmap and version history
- **[ELECTRON-ROADMAP.md](./ELECTRON-ROADMAP.md)** - Electron technical
  implementation
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Development guidelines

---

## 📝 Notes

**Current Status:** All optimizations are in planning phase. None have been
implemented yet.

**Performance Baseline:** Established via 11 performance benchmark tests (all
passing, sub-millisecond times)

**Next Steps:** Prioritize Tier 1 optimizations for v2.7.x release
