# Feature Implementation Plans

<!-- markdownlint-disable MD024 MD029 MD013 -->

This document contains detailed implementation plans for upcoming features in the
Redis ACL Builder roadmap.

**Status**: Planning Phase
**Last Updated**: 2025-10-28

---

## Table of Contents

1. [Category Organization by Type](#category-organization-by-type)
2. [Smart Keyspace Pattern Optimization](#smart-keyspace-pattern-optimization)

---

## Category Organization by Type

**Priority**: Medium
**Estimated Effort**: 2-3 hours
**Target Version**: v2.7.0-beta
**Status**: Planned

### Overview

Split category buttons into two separate sections for better visual organization
and easier category discovery:

- **Data Type Categories**: Commands that operate on specific data structures
- **ACL/Operational Categories**: Command characteristics and operational
  permissions

### Problem Statement

Currently, all 29 categories are displayed in a single flat list, making it
difficult for users to:

- Quickly find specific category types
- Understand the difference between data structure categories and operational
  categories
- Navigate the category list efficiently

### Proposed Solution

Organize categories into two visually distinct sections with headers:

#### Data Type Categories (16 categories)

Commands that operate on specific Redis data structures:

- `bitmap` - Bitmap operations (BITCOUNT, BITPOS, etc.)
- `bloom` - Bloom filter operations (BF.ADD, BF.EXISTS, etc.)
- `cms` - Count-Min Sketch operations (CMS.INCRBY, CMS.QUERY, etc.)
- `cuckoo` - Cuckoo filter operations (CF.ADD, CF.EXISTS, etc.)
- `geo` - Geospatial operations (GEOADD, GEORADIUS, etc.)
- `hash` - Hash operations (HSET, HGET, HDEL, etc.)
- `hyperloglog` - HyperLogLog operations (PFADD, PFCOUNT, etc.)
- `json` - JSON operations (JSON.SET, JSON.GET, etc.)
- `list` - List operations (LPUSH, RPUSH, LRANGE, etc.)
- `pubsub` - Pub/Sub operations (PUBLISH, SUBSCRIBE, etc.)
- `set` - Set operations (SADD, SMEMBERS, SINTER, etc.)
- `sortedset` - Sorted set operations (ZADD, ZRANGE, ZRANK, etc.)
- `stream` - Stream operations (XADD, XREAD, XRANGE, etc.)
- `string` - String operations (GET, SET, INCR, etc.)
- `tdigest` - T-Digest operations (TDIGEST.CREATE, TDIGEST.ADD, etc.)
- `timeseries` - Time series operations (TS.CREATE, TS.ADD, etc.)
- `topk` - Top-K operations (TOPK.ADD, TOPK.LIST, etc.)

#### ACL/Operational Categories (13 categories)

Command characteristics and operational permissions:

- `admin` - Administrative commands (CONFIG, SHUTDOWN, REPLICAOF, etc.)
- `blocking` - Commands that may block (BLPOP, BRPOP, BZPOPMIN, etc.)
- `connection` - Connection management (AUTH, SELECT, CLIENT, etc.)
- `dangerous` - Potentially dangerous commands (FLUSHDB, FLUSHALL, KEYS, etc.)
- `fast` - O(1) or O(log N) commands
- `keyspace` - Commands that interact with keyspace (DEL, EXISTS, EXPIRE, etc.)
- `read` - Read-only commands
- `scripting` - Scripting commands (EVAL, EVALSHA, SCRIPT, etc.)
- `search` - Search operations (FT.SEARCH, FT.AGGREGATE, etc.)
- `slow` - Commands with O(N) or worse complexity
- `transaction` - Transaction commands (MULTI, EXEC, WATCH, DISCARD)
- `write` - Write commands that modify data

### Implementation Details

#### 1. Frontend JavaScript Changes (1-1.5 hours)

**File**: `frontend/static/js/components/interactive-acl-builder.js`

**Changes**:

1. Add category classification constants at the top of the file:

```javascript
// Category classification for visual organization
const DATA_TYPE_CATEGORIES = new Set([
    'bitmap', 'bloom', 'cms', 'cuckoo', 'geo', 'hash',
    'hyperloglog', 'json', 'list', 'pubsub', 'set',
    'sortedset', 'stream', 'string', 'tdigest', 'timeseries', 'topk'
]);

const ACL_CATEGORIES = new Set([
    'admin', 'blocking', 'connection', 'dangerous', 'fast',
    'keyspace', 'read', 'scripting', 'search', 'slow',
    'transaction', 'write'
]);

/**
 * Classify a category as data type or ACL/operational
 * @param {string} category - Category name without @ prefix
 * @returns {'data-type'|'acl'} Category type
 */
function classifyCategory(category) {
    if (DATA_TYPE_CATEGORIES.has(category)) {
        return 'data-type';
    } else if (ACL_CATEGORIES.has(category)) {
        return 'acl';
    }
    // Default to ACL if unknown (future-proofing)
    return 'acl';
}
```

2. Modify `renderCategoryButtons()` function (around line 1342):

```javascript
async renderCategoryButtons() {
    // ... existing logic to determine granted/blocked/available categories ...

    // Split categories by type
    const dataTypeGranted = [];
    const aclGranted = [];
    const dataTypeBlocked = [];
    const aclBlocked = [];
    const dataTypeAvailable = [];
    const aclAvailable = [];

    // Classify granted categories
    for (const category of grantedCategories) {
        const type = classifyCategory(category);
        if (type === 'data-type') {
            dataTypeGranted.push(category);
        } else {
            aclGranted.push(category);
        }
    }

    // Classify blocked categories
    for (const category of blockedCategories) {
        const type = classifyCategory(category);
        if (type === 'data-type') {
            dataTypeBlocked.push(category);
        } else {
            aclBlocked.push(category);
        }
    }

    // Classify available categories
    for (const category of availableCategories) {
        const type = classifyCategory(category);
        if (type === 'data-type') {
            dataTypeAvailable.push(category);
        } else {
            aclAvailable.push(category);
        }
    }

    // Render sections for granted panel
    await this.renderCategorySection(
        this.elements.grantedCategoriesButtons,
        'Data Types',
        dataTypeGranted,
        'granted'
    );
    await this.renderCategorySection(
        this.elements.grantedCategoriesButtons,
        'ACL/Operational',
        aclGranted,
        'granted'
    );

    // Render sections for blocked panel
    await this.renderCategorySection(
        this.elements.blockedCategoriesButtons,
        'Data Types',
        dataTypeBlocked,
        'blocked'
    );
    await this.renderCategorySection(
        this.elements.blockedCategoriesButtons,
        'ACL/Operational',
        aclBlocked,
        'blocked'
    );

    // ... similar for available categories ...
}

/**
 * Render a category section with header and buttons
 * @param {HTMLElement} container - Container element
 * @param {string} sectionTitle - Section header title
 * @param {Array<string>} categories - Categories to render
 * @param {string} state - Category state (granted/blocked/available)
 */
async renderCategorySection(container, sectionTitle, categories, state) {
    if (categories.length === 0) {
        return; // Don't render empty sections
    }

    // Create section container
    const section = document.createElement('div');
    section.className = 'category-section';

    // Create section header
    const header = document.createElement('h4');
    header.className = 'category-section-header';
    const emoji = sectionTitle === 'Data Types' ? '📦' : '⚙️';
    header.textContent = `${emoji} ${sectionTitle}`;
    section.appendChild(header);

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'category-buttons-container';

    // Render category buttons
    for (const category of categories.sort()) {
        const button = await this.createCategoryButton(category, state);
        buttonsContainer.appendChild(button);
    }

    section.appendChild(buttonsContainer);
    container.appendChild(section);
}
```

**Key Points**:

- Maintain all existing button creation logic (partial states, tooltips, click
  handlers)
- Only add visual organization - no functional changes
- Empty sections are not rendered (e.g., if no data type categories are granted)
- Preserve existing animations and transitions

#### 2. CSS Styling (0.5-1 hour)

**File**: `frontend/static/css/components.css`

**Changes**:

```css
/* Category section organization */
.category-section {
    margin-bottom: 16px;
}

.category-section:last-child {
    margin-bottom: 0;
}

.category-section-header {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-color);
    padding: 8px 12px;
    margin: 0 0 8px 0;
    border-bottom: 1px solid var(--border-color);
    background: var(--section-header-bg);
    border-radius: 4px 4px 0 0;
}

/* Dark mode adjustments */
[data-theme="dark"] .category-section-header {
    background: var(--panel-bg-darker);
    border-bottom-color: var(--border-color-dark);
}

/* Light mode adjustments */
[data-theme="light"] .category-section-header {
    background: var(--panel-bg-lighter);
}

/* Buttons container within section */
.category-section .category-buttons-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 12px 8px 12px;
}
```

**Key Points**:

- Theme-aware styling for light/dark modes
- Consistent spacing and visual hierarchy
- Smooth transitions maintained
- Mobile-responsive design preserved

#### 3. Testing (0.5 hours)

**Test Cases**:

1. **Basic Rendering**:
   - Empty ACL rule → Both sections appear in available panel
   - Grant data type category → Appears in "Data Types" section of granted panel
   - Grant ACL category → Appears in "ACL/Operational" section of granted panel

2. **State Transitions**:
   - Click data type category → Moves between sections correctly
   - Click ACL category → Moves between sections correctly
   - Partial categories → Display correctly in appropriate section

3. **Edge Cases**:
   - `@all` category → Appears in ACL/Operational section
   - Mixed grants → Both sections render in granted panel
   - Only data types granted → ACL section not rendered (no empty sections)

4. **Visual Polish**:
   - Animations work smoothly
   - Theme switching works correctly
   - Tooltips display properly
   - Button interactions unchanged

5. **Responsive Design**:
   - Mobile view → Sections stack properly
   - Tablet view → Sections render correctly
   - Desktop view → Full layout works as expected

### Benefits

1. **Improved UX**: Easier to find specific category types
2. **Better Visual Organization**: Clear separation of data structures vs
   operations
3. **Reduced Cognitive Load**: Users understand category purposes faster
4. **Professional Appearance**: More polished, enterprise-grade UI
5. **Scalability**: Easy to add new categories to appropriate sections

### Risks and Mitigations

**Risk**: Users may be confused by the new organization initially
**Mitigation**: Clear section headers with emojis, maintain existing button
styles

**Risk**: Breaking existing functionality with refactoring
**Mitigation**: Comprehensive testing, preserve all existing logic

**Risk**: Performance impact from additional DOM elements
**Mitigation**: Minimal - only adds 2-4 section headers per panel

### Future Enhancements

- Collapsible sections (show/hide each section)
- User preference to disable organization (single flat list)
- Custom category groupings via settings

---

## Smart Keyspace Pattern Optimization

**Priority**: Medium-High
**Estimated Effort**: 4-6 hours
**Target Version**: v2.7.0-beta
**Status**: Planned

### Overview

Detect and suggest optimizations for redundant keyspace patterns in ACL rules,
similar to the existing command/category optimization feature.

### Problem Statement

Users often create ACL rules with redundant keyspace patterns that can be
simplified:

- `~* ~abc:*` → `~*` (universal pattern makes all others redundant)
- `~user:* ~user:123:*` → `~user:*` (broader pattern covers specific pattern)
- `~session:[a-z]* ~session:[a-c]*` → `~session:[a-z]*` (superset pattern)

Redundant patterns:

- Make ACL rules longer and harder to read
- Impact performance (more patterns to match)
- Cause confusion about actual permissions
- Are easy to create accidentally

### Proposed Solution

Implement a keyspace pattern analysis system that:

1. Detects redundant patterns in ACL rules
2. Suggests optimized versions
3. Shows estimated savings (number of patterns eliminated)
4. Integrates with existing optimization UI

### Implementation Details

#### 1. Backend Pattern Analysis (2-3 hours)

**File**: `backend/helpers/pattern_optimizer.py` (new file)

**Core Algorithm**:

```python
"""
Keyspace pattern optimization logic for Redis ACL rules.
"""

import re
from typing import List, Dict, Set, Tuple


class PatternOptimizer:
    """Analyzes and optimizes Redis keyspace patterns."""

    # Redis glob pattern special characters
    GLOB_CHARS = {'*', '?', '[', ']', '\\'}

    @staticmethod
    def is_universal_pattern(pattern: str) -> bool:
        """Check if pattern matches all keys."""
        return pattern == '*'

    @staticmethod
    def glob_to_regex(pattern: str) -> str:
        """
        Convert Redis glob pattern to Python regex.

        Redis glob patterns support:
        - * matches any sequence of characters
        - ? matches any single character
        - [abc] matches any character in the set
        - [a-z] matches any character in the range
        - [^abc] matches any character NOT in the set
        - \* matches literal asterisk (escaped)

        Returns regex pattern string.
        """
        regex = ''
        i = 0
        while i < len(pattern):
            char = pattern[i]

            if char == '\\' and i + 1 < len(pattern):
                # Escaped character - match literally
                next_char = pattern[i + 1]
                regex += re.escape(next_char)
                i += 2
            elif char == '*':
                # Match any sequence
                regex += '.*'
                i += 1
            elif char == '?':
                # Match single character
                regex += '.'
                i += 1
            elif char == '[':
                # Character class - find matching ]
                end = pattern.find(']', i + 1)
                if end == -1:
                    # Invalid pattern - treat [ as literal
                    regex += re.escape(char)
                    i += 1
                else:
                    # Include the character class as-is
                    char_class = pattern[i:end + 1]
                    regex += char_class
                    i = end + 1
            else:
                # Regular character - escape for regex
                regex += re.escape(char)
                i += 1

        return f'^{regex}$'

    @staticmethod
    def pattern_makes_redundant(
        broader: str,
        specific: str,
        sample_size: int = 1000
    ) -> bool:
        """
        Check if broader pattern makes specific pattern redundant.

        Uses heuristic approach:
        1. Universal pattern (*) makes everything redundant
        2. If broader is prefix of specific, broader likely covers it
        3. Generate sample keys matching specific pattern and test against
           broader pattern

        Args:
            broader: Potentially broader pattern
            specific: Potentially redundant pattern
            sample_size: Number of sample keys to test

        Returns:
            True if broader makes specific redundant
        """
        # Universal pattern makes everything redundant
        if PatternOptimizer.is_universal_pattern(broader):
            return True

        # If patterns are identical, neither makes the other redundant
        if broader == specific:
            return False

        # Convert to regex
        try:
            broader_regex = re.compile(
                PatternOptimizer.glob_to_regex(broader)
            )
            specific_regex = re.compile(
                PatternOptimizer.glob_to_regex(specific)
            )
        except re.error:
            # Invalid regex - can't determine redundancy
            return False

        # Heuristic 1: Prefix matching (most common case)
        # Example: abc* makes abc:123* redundant
        if '*' in broader and '*' in specific:
            broader_prefix = broader.split('*')[0]
            specific_prefix = specific.split('*')[0]
            if specific_prefix.startswith(broader_prefix):
                # Broader prefix likely covers specific
                return True

        # Heuristic 2: Character class containment
        # Example: [a-z]* makes [a-c]* redundant
        # This requires analyzing character classes - complex, skip for MVP

        # Heuristic 3: Sample-based testing
        # Generate keys that match specific pattern and test against broader
        sample_keys = PatternOptimizer._generate_sample_keys(specific, sample_size)
        matches = sum(1 for key in sample_keys if broader_regex.match(key))

        # If broader matches 95%+ of specific's keys, consider it redundant
        threshold = 0.95
        return (matches / len(sample_keys)) >= threshold

    @staticmethod
    def _generate_sample_keys(pattern: str, count: int) -> List[str]:
        """
        Generate sample keys that match the given pattern.

        Simplified implementation for common cases.
        """
        keys = []

        if pattern == '*':
            # Generate random keys
            import random
            import string
            for _ in range(count):
                length = random.randint(1, 20)
                key = ''.join(
                    random.choices(string.ascii_letters + string.digits + ':-_', k=length)
                )
                keys.append(key)
        elif '*' in pattern and pattern.count('*') == 1:
            # Simple wildcard pattern
            parts = pattern.split('*')
            prefix = parts[0]
            suffix = parts[1] if len(parts) > 1 else ''

            import random
            import string
            for _ in range(count):
                middle_length = random.randint(0, 10)
                middle = ''.join(
                    random.choices(string.ascii_letters + string.digits, k=middle_length)
                )
                keys.append(f"{prefix}{middle}{suffix}")
        else:
            # Complex pattern - generate variations
            # For MVP, return the pattern itself as a sample
            keys = [pattern]

        return keys

    @staticmethod
    def optimize_patterns(patterns: List[str]) -> Dict:
        """
        Optimize a list of keyspace patterns.

        Args:
            patterns: List of keyspace patterns (without ~ prefix)

        Returns:
            Dictionary with optimization results:
            {
                'original': [...],
                'optimized': [...],
                'redundancies': [
                    {
                        'pattern': 'abc:123:*',
                        'made_redundant_by': 'abc:*'
                    },
                    ...
                ],
                'savings': 2  # number of patterns eliminated
            }
        """
        if not patterns:
            return {
                'original': [],
                'optimized': [],
                'redundancies': [],
                'savings': 0
            }

        # Check for universal pattern
        if '*' in patterns:
            return {
                'original': patterns,
                'optimized': ['*'],
                'redundancies': [
                    {
                        'pattern': p,
                        'made_redundant_by': '*'
                    }
                    for p in patterns if p != '*'
                ],
                'savings': len(patterns) - 1
            }

        redundancies = []
        redundant_patterns = set()

        # Check each pattern against all others
        for i, pattern1 in enumerate(patterns):
            if pattern1 in redundant_patterns:
                continue

            for j, pattern2 in enumerate(patterns):
                if i == j or pattern2 in redundant_patterns:
                    continue

                # Check if pattern1 makes pattern2 redundant
                if PatternOptimizer.pattern_makes_redundant(pattern1, pattern2):
                    redundancies.append({
                        'pattern': pattern2,
                        'made_redundant_by': pattern1
                    })
                    redundant_patterns.add(pattern2)

        # Build optimized list
        optimized = [p for p in patterns if p not in redundant_patterns]

        return {
            'original': patterns,
            'optimized': optimized,
            'redundancies': redundancies,
            'savings': len(patterns) - len(optimized)
        }
```

**File**: `backend/app.py` (add new endpoint)

```python
@app.route('/api/optimize-keyspace', methods=['POST'])
def optimize_keyspace():
    """
    Optimize keyspace patterns for redundancy.

    Request body:
    {
        "patterns": ["*", "abc:*", "user:*"]
    }

    Response:
    {
        "original": ["*", "abc:*", "user:*"],
        "optimized": ["*"],
        "redundancies": [
            {"pattern": "abc:*", "made_redundant_by": "*"},
            {"pattern": "user:*", "made_redundant_by": "*"}
        ],
        "savings": 2
    }
    """
    try:
        data = request.get_json()

        if not data or 'patterns' not in data:
            return jsonify({
                'error': 'Missing required field: patterns'
            }), 400

        patterns = data['patterns']

        if not isinstance(patterns, list):
            return jsonify({
                'error': 'patterns must be an array'
            }), 400

        # Remove empty patterns
        patterns = [p.strip() for p in patterns if p and p.strip()]

        # Optimize patterns
        from helpers.pattern_optimizer import PatternOptimizer
        result = PatternOptimizer.optimize_patterns(patterns)

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error optimizing keyspace patterns: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500
```

#### 2. Frontend Integration (1.5-2 hours)

**File**: `frontend/static/js/components/interactive-acl-builder.js`

**Changes**:

1. Add keyspace pattern extraction function:

```javascript
/**
 * Extract keyspace patterns from ACL rule
 * @param {string} aclRule - ACL rule string
 * @returns {Array<string>} Array of keyspace patterns (without ~ prefix)
 */
extractKeypacePatterns(aclRule) {
    const patterns = [];
    const tokens = aclRule.split(/\s+/);

    for (const token of tokens) {
        if (token.startsWith('~') && token.length > 1) {
            // Remove ~ prefix and add to patterns
            patterns.push(token.substring(1));
        }
    }

    return patterns;
}
```

2. Add keyspace optimization function:

```javascript
/**
 * Analyze keyspace patterns for optimization opportunities
 */
async analyzeKeypacePatterns() {
    const aclRule = this.elements.aclRuleInput.value.trim();
    const patterns = this.extractKeypacePatterns(aclRule);

    if (patterns.length === 0) {
        // No patterns to optimize
        this.hideKeypaceOptimization();
        return;
    }

    try {
        const response = await fetch('/api/optimize-keyspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patterns })
        });

        if (!response.ok) {
            throw new Error('Failed to optimize keyspace patterns');
        }

        const result = await response.json();

        if (result.savings > 0) {
            this.showKeypaceOptimization(result);
        } else {
            this.hideKeypaceOptimization();
        }
    } catch (error) {
        console.error('Keyspace optimization error:', error);
        this.hideKeypaceOptimization();
    }
}

/**
 * Display keyspace optimization suggestions
 */
showKeypaceOptimization(result) {
    const container = document.getElementById('keyspace-optimization-container');
    if (!container) return;

    let html = `
        <div class="optimization-header">
            <strong>🔑 Keyspace Pattern Optimization</strong>
            <span class="optimization-savings">Save ${result.savings} pattern${result.savings !== 1 ? 's' : ''}</span>
        </div>
        <div class="optimization-body">
            <div class="optimization-section">
                <strong>Current:</strong>
                <div class="pattern-list">
    `;

    // Show original patterns with redundancies marked
    for (const pattern of result.original) {
        const redundancy = result.redundancies.find(r => r.pattern === pattern);
        if (redundancy) {
            html += `
                <span class="pattern redundant" title="Made redundant by ~${redundancy.made_redundant_by}">
                    ~${pattern}
                </span>
            `;
        } else {
            html += `<span class="pattern">~${pattern}</span>`;
        }
    }

    html += `
                </div>
            </div>
            <div class="optimization-section">
                <strong>Optimized:</strong>
                <div class="pattern-list">
    `;

    // Show optimized patterns
    for (const pattern of result.optimized) {
        html += `<span class="pattern optimized">~${pattern}</span>`;
    }

    html += `
                </div>
            </div>
            <button class="apply-optimization-btn" onclick="interactiveACLBuilder.applyKeypaceOptimization()">
                Apply Optimization
            </button>
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';

    // Store optimization result
    this.currentKeypaceOptimization = result;
}

/**
 * Apply keyspace pattern optimization to ACL rule
 */
applyKeypaceOptimization() {
    if (!this.currentKeypaceOptimization) return;

    const aclRule = this.elements.aclRuleInput.value.trim();
    const optimized = this.currentKeypaceOptimization.optimized;

    // Replace all keyspace patterns with optimized versions
    let newRule = aclRule;

    // Remove all existing keyspace patterns
    newRule = newRule.replace(/~[^\s]+/g, '').trim();

    // Add optimized patterns
    const patternString = optimized.map(p => `~${p}`).join(' ');
    newRule = `${newRule} ${patternString}`.trim();

    // Update ACL rule input
    this.elements.aclRuleInput.value = newRule;

    // Re-parse rule
    this.parseACLRule();

    // Hide optimization suggestion
    this.hideKeypaceOptimization();

    // Show success message
    this.showNotification(
        'Keyspace patterns optimized successfully!',
        'success'
    );
}
```

3. Integrate into existing rule parsing flow:

```javascript
async parseACLRule() {
    // ... existing parsing logic ...

    // After parsing, analyze keyspace patterns
    await this.analyzeKeypacePatterns();
}
```

#### 3. CSS Styling (0.5 hours)

**File**: `frontend/static/css/components.css`

```css
/* Keyspace optimization container */
#keyspace-optimization-container {
    margin: 16px 0;
    padding: 16px;
    background: var(--optimization-bg);
    border: 1px solid var(--optimization-border);
    border-radius: 8px;
    display: none;
}

#keyspace-optimization-container .optimization-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

#keyspace-optimization-container .optimization-savings {
    background: var(--success-bg);
    color: var(--success-color);
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
}

#keyspace-optimization-container .pattern-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

#keyspace-optimization-container .pattern {
    padding: 6px 12px;
    background: var(--pattern-bg);
    border: 1px solid var(--pattern-border);
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
}

#keyspace-optimization-container .pattern.redundant {
    text-decoration: line-through;
    opacity: 0.6;
    background: var(--redundant-bg);
}

#keyspace-optimization-container .pattern.optimized {
    background: var(--success-bg-light);
    border-color: var(--success-color);
    font-weight: 600;
}

#keyspace-optimization-container .apply-optimization-btn {
    margin-top: 12px;
    padding: 8px 16px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
}

#keyspace-optimization-container .apply-optimization-btn:hover {
    background: var(--primary-color-hover);
}
```

#### 4. HTML Structure (0.5 hours)

**File**: `frontend/templates/index.html`

Add optimization container in the center panel:

```html
<!-- Add after existing optimization sections -->
<div id="keyspace-optimization-container"></div>
```

#### 5. Testing (1 hour)

**Test Cases**:

1. **Universal Pattern Detection**:
   - Input: `~* ~abc:*` → Output: `~*` (saves 1 pattern)
   - Input: `~user:* ~cache:* ~*` → Output: `~*` (saves 2 patterns)

2. **Prefix Redundancy**:
   - Input: `~user:* ~user:123:*` → Output: `~user:*` (saves 1 pattern)
   - Input: `~session:* ~session:active:*` → Output: `~session:*` (saves 1
     pattern)

3. **Character Class Containment** (heuristic):
   - Input: `~key:[a-z]* ~key:[a-c]*` → Output: `~key:[a-z]*` (saves 1 pattern)

4. **No Optimization Needed**:
   - Input: `~user:* ~cache:*` → No optimization (disjoint patterns)
   - Input: `~*` → No optimization (already optimal)

5. **Edge Cases**:
   - Empty patterns → No optimization shown
   - Invalid patterns → Gracefully handled
   - Single pattern → No optimization needed

6. **UI Integration**:
   - Optimization appears smoothly
   - Apply button works correctly
   - Success notification displays
   - Rule updates correctly

### Benefits

1. **Cleaner ACL Rules**: Eliminate redundant patterns automatically
2. **Better Performance**: Fewer patterns = faster Redis pattern matching
3. **Improved Understanding**: Users see which patterns are redundant and why
4. **Consistency**: Matches existing optimization UI for commands/categories
5. **Educational**: Helps users learn about pattern hierarchies

### Risks and Mitigations

**Risk**: False positives in redundancy detection
**Mitigation**: Use conservative heuristics, extensive testing with edge cases

**Risk**: Performance impact from pattern analysis
**Mitigation**: Debounce analysis calls, optimize algorithm, use sampling

**Risk**: Complex patterns may not be analyzed correctly
**Mitigation**: Document limitations, handle errors gracefully, start with
common patterns

### Future Enhancements

- More sophisticated pattern containment analysis
- Support for complex character class comparisons
- Pattern performance impact estimates
- Pattern security analysis (overly permissive patterns)
- Regex pattern support (if Redis adds it)

### Known Limitations

1. **Character Class Complexity**: Full character class containment analysis is
   complex (e.g., `[a-z0-9]` vs `[a-f]`). MVP uses heuristics.

2. **Pattern Complexity**: Very complex patterns may not be fully analyzed. Focus
   on common cases (prefix matching, universal pattern).

3. **Sample-Based Testing**: Uses sampling for some cases, may not catch all
   redundancies.

4. **Performance**: Pattern analysis can be expensive for many patterns. Use
   debouncing and caching.

---

## Implementation Priority

Recommended implementation order:

1. **Category Organization by Type** (2-3 hours)
   - Lower complexity
   - Immediate visual improvement
   - No breaking changes
   - Good for user feedback before tackling pattern optimization

2. **Smart Keyspace Pattern Optimization** (4-6 hours)
   - More complex implementation
   - Requires backend algorithm work
   - Higher value but needs more testing
   - Benefits from user feedback on category organization first

**Total Estimated Time**: 6-9 hours for both features

---

## Notes

- Both features are non-breaking changes
- All existing functionality is preserved
- Comprehensive testing required before release
- Consider user feedback during beta testing
- Document features in README and wiki after implementation

---

**Document Version**: 1.0
**Authors**: Marko Trapani, Claude Code
**Last Review**: 2025-10-28
