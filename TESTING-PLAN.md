# Interactive ACL Builder - Test Plan

## Test Status: In Progress (v1.25.9-beta)

### ✅ Completed Tests (v1.23.2 - v1.25.9)

#### Implicitly Partial Categories (v1.24.0)

- [x] `+@all -@admin` shows partial categories in BOTH columns with hollow yellow styling
- [x] Categories like `@connection`, `@dangerous`, `@search`, `@slow` appear correctly
- [x] Hollow yellow/orange styling is consistent across granted and blocked columns
- [x] Clicking partial categories from either column works correctly

#### Auto-Optimization (v1.24.0)

- [x] `+@all -@admin +@connection` → clicking `@admin` → auto-optimizes to `+@all`
- [x] Backend detects when all commands are granted and suggests `+@all`
- [x] Auto-optimization triggers on button-built rule changes
- [x] Success notification shows correct savings count

#### Redundancy Detection (v1.24.0 - v1.25.0)

- [x] `+@all +@connection +@admin` shows grouped redundancy warning
- [x] Single red box with comma-separated list of redundant terms
- [x] No duplicate explanation boxes
- [x] Only shows best optimization suggestion (not intermediate ones)
- [x] Simplified one-line redundancy messages with quoted tokens

#### Version Switching (v1.24.0)

- [x] Optimization suggestions persist and update when switching Redis versions
- [x] Implicitly partial categories detected correctly in both Redis 7 and 8

#### @all Category Button States (v1.25.0 - v1.25.1)

- [x] Empty rule: `@all` shows as available (solid blue) in blocked column
- [x] Explicit grant `+@all`: Shows as solid blue in granted column
- [x] Explicit block `-@all`: Shows as solid red in blocked column
- [x] Partial grant `+@all -@admin`: Shows as solid blue with ⚠ in granted column
- [x] Partial grant `+@all -@admin`: Shows as hollow yellow with ⚠ in blocked column
- [x] Clicking `@all` in blocked with `-@all +@connection` auto-optimizes to `+@all`
- [x] Clicking `@all` with empty rule produces `+@all`
- [x] Removing `-@all` optimizes away redundant exclusions
- [x] `+@connection +@all` shows dual explanations correctly (redundant + optimization)

#### Button Ordering (v1.25.0 - v1.25.1)

- [x] Granted column: `@all` first, then explicit grants, then implicit full, then implicit partial
- [x] Explicit categories prioritized correctly with `+@connection +@all` rule
- [x] Implicit partial categories appear after implicit fully granted categories
- [x] Alphabetical sorting within same priority level

#### Optimization Box Persistence (v1.25.1)

- [x] Optimization suggestions persist while typing in textarea
- [x] Suggestions remain visible when temporarily deleting all text
- [x] Only hide on: submit new rule, click X button, or explicit clear operation
- [x] Backend optimization error fixed (undefined `warnings` variable)
- [x] "Saves X terms" displays correctly after fix

#### Category Ordering & Optimization (v1.25.2)

- [x] Explicit full grants appear before explicit partial grants in granted column
- [x] Blocked column ordering: explicit full → explicit partial → implicit full → implicit partial
- [x] `+@admin -acl|deluser +@read`: @read (full) appears before @admin (partial)
- [x] Empty rule optimization: rules that grant 0 commands suggest empty rule (not partial)
- [x] `-@admin +acl|deluser -@dangerous`: correctly suggests empty rule optimization
- [x] Clean single warning for empty rules (no duplicate redundancy messages)

#### API Response Accuracy (v1.25.2)

- [x] @all doesn't appear in granted column when no commands actually granted
- [x] `detectPartialCategory(@all)` checks API response instead of state
- [x] Individual Commands count uses API `blocked_commands` for accuracy
- [x] Rule `-@admin +acl|deluser -@dangerous` shows correct count (446/446, not 310/311)

#### Dual-Column Explicit Partial Blocks (v1.25.3)

- [x] `+@keyspace -@read +bitcount`: @read shows in both columns
- [x] @read appears in granted column as implicitly partially granted (hollow green ⚠)
- [x] @read appears in blocked column as explicitly partially blocked (hollow red/yellow ⚠)
- [x] Blocked column ordering: explicit full → implicit full → explicit partial → implicit partial
- [x] Fixed rendering type check to handle `'explicit-partial'` type correctly
- [x] Fixed implicit partial styling: now shows hollow yellow ⚠ instead of solid red
- [x] Fixed @all priority assignment: always priority 1 even when implicit-partial
- [x] Updated blockType check in acl-ui-renderer.js to match 'implicit-partial' correctly

#### Regular Category Button States (v1.25.3)

- [x] Explicit grant `+@read`: Solid green in granted column
- [x] Explicit partial `+@read -get`: Solid yellow ⚠ in granted column (explicitly partial)
- [x] Implicit grant (via `+@all`): Slightly opaque green in granted column
- [x] Implicit partial (via `+@all -@admin`): Hollow yellow ⚠ in both columns
- [x] Explicit block `-@dangerous`: Solid red in blocked column
- [x] Partial block `+@all -@admin +acl|deluser`: Solid yellow ⚠ in blocked column (explicitly partial)
- [x] Available (not granted): Solid red in blocked column

#### Cross-Column Interactions (v1.25.3)

- [x] Clicking granted category moves to blocked: `+@read` → click @read → empty rule with @read in blocked
- [x] Clicking blocked category moves to granted: `-@dangerous` → click @dangerous → granted
- [x] Clicking partial category in granted removes partial grants: `+@read -get` → click @read → empty rule
- [x] Clicking partial category in blocked grants full category: `+@all -@admin +acl|deluser` → click @admin → auto-optimizes to `+@all`
- [x] Button state reflects committed ACL rule, not uncommitted textarea changes

#### Individual Command Button Testing (v1.25.3)

- [x] Granted commands show green solid: `+get` shows solid green
- [x] Blocked commands show red with correct type:
  - Explicit block `-get`: bright/highlighted red
  - Category block `-@string`: darkened/muted red
  - Implicit block `+set`: darkened/muted red (get not granted)
- [x] Clicking command toggles correctly:
  - `+get` → click get → empty rule (moved to blocked)
  - `-get` → click get → `+get` (moved to granted)
- [x] Command buttons position correctly in their respective columns
- [x] Commands blocked by category have different styling than explicit blocks:
  - `-@string -get`: get is bright red (explicit), others darkened (category)
- [x] **FIXED**: Command sort order - explicit commands before implicit (priority-based sorting)
- [x] **FIXED**: Rule preservation on refresh - `-get` no longer cleared to empty rule
- [x] **FIXED**: Empty ACL detection now checks for blocked categories/commands too

#### Search & Filter Enhancements (v1.25.3)

- [x] Fuzzy search relevance scoring - exact matches first, then by match quality
- [x] Search results restore original order when cleared
- [x] "Showing X of Y" count appears BEFORE buttons, not after
- [x] Empty command-buttons containers hidden to prevent visual gaps
- [x] No-commands message shows on own line with proper block display

#### Rule Optimization System (v1.25.4-v1.25.5-beta)

**Optimization Display & Deduplication:**
- [x] Backend optimization suggestion displays with "Saves X terms"
- [x] Frontend warnings preserved when backend has suggestions (no duplicates)
- [x] Single warning + single suggestion format (no redundant explanations)
- [x] Example: `+pfadd +pfcount +pfmerge` shows:
  - Warning: "Individual commands cover entire @hyperloglog category (3 commands)"
  - Suggestion: "Simplified rule: +@hyperloglog"
  - Savings: "Saves 2 terms"

**Key Pattern Preservation (v1.25.5-beta):**
- [x] Key patterns preserved in optimization suggestions: `+pfadd +pfcount +pfmerge ~key*` → `+@hyperloglog ~key*`
- [x] No duplicate suggestions when key patterns present (fixed comparison logic)
- [x] Backend includes key patterns, frontend detects with startsWith check
- [x] Single clean suggestion with key pattern and "Saves X terms"

**Auto-Optimization Triggers (v1.25.5-beta):**
- [x] Button clicks trigger auto-optimization: Clicking commands → auto-applies `+@hyperloglog`
- [x] Manual text edits show suggestions only (no auto-apply)
- [x] Auto-optimization works correctly for button-built rules
- [x] Manual entry shows optimization suggestion without auto-applying

**Version Switching with Unsaved Text:**
- [x] Typing text without submitting + switching versions preserves textarea content
- [x] No optimization suggestions appear for unsaved text
- [x] Submit Changes button visibility prevents redundancy analysis
- [x] Interactive builder refresh skipped when unsaved changes exist

**Edge Cases:**
- [x] Empty rule optimization: `+get -get` → suggests empty rule
- [x] Category with exclusions: `+bitcount +bitfield +bitpos +getbit +setbit` → `+@bitmap -bitfield_ro -bitop` (Saves 2 terms)
- [x] Invalid syntax: Shows error, no optimization suggestions
- [x] Already optimal: `+@read` → no optimization suggestions

**Version-Specific Optimization:**
- [x] Redis 7 @hash (25 commands): `+hdel +hexists ... +hvals` → `+@hash` (Saves 24 terms)
- [x] Redis 8 @hash (28 commands): Same 25 commands → `+@hash -hgetdel -hgetex -hsetex` (Saves 21 terms)
- [x] Optimization updates correctly when switching versions
- [x] Version-aware suggestions based on category differences

**Visual Consistency:**
- [x] Light mode: Warnings (red), suggestions (blue), savings text all readable
- [x] Dark mode: Warnings (red), suggestions (blue), savings text all readable
- [x] Theme switching preserves optimization box styling
- [x] Clickable simplified rule with proper hover effects

---

## 🔄 Pending Tests (Future Work)

### Optimization & Redundancy Testing

#### Auto-Optimization Triggers

- [x] ~~Button clicks trigger auto-optimization (grantCategory, blockCategory, etc.)~~ ✅ Completed in v1.25.5-beta
- [x] ~~Manual text edits do NOT trigger auto-optimization (only suggestions)~~ ✅ Completed in v1.25.5-beta
- [x] ~~Auto-optimization notification shows correct before/after counts~~ ✅ Completed in v1.25.5-beta (e.g., "Auto-optimized: replaced 3 commands with +@hyperloglog")
- [x] ~~Optimization preserves key patterns (`~`, `%R~`, `%W~`, `%RW~`)~~ ✅ Completed in v1.25.5-beta

#### Redundancy Detection Patterns

- [x] ~~Redundant inclusions: `+@all +@read +@write` (should group)~~ ✅ Completed in v1.25.5-beta (groups as "Redundant inclusions: +@read, +@write")
- [x] ~~Redundant exclusions: `+@all -@string -get -set -append` (should group)~~ ✅ Completed in v1.25.5-beta (groups as "Redundant exclusions: -get, -set, -append")
- [x] ~~Inefficient ordering: `+@all -get -@string`~~ ✅ Completed in v1.25.5-beta (detects preceding exclusions made redundant)
- [x] ~~Cancelled `@all`: Block all categories after `+@all`~~ ✅ Completed in v1.25.6-beta (detects no commands granted, suggests empty rule)
- [x] ~~All categories granted: All 21 categories → suggest `+@all`~~ ✅ Completed in v1.25.6-beta (truncated list after 3 examples, clean message)
- [x] ~~Category completion: `+pfadd +pfcount +pfmerge` → suggest `+@hyperloglog`~~ ✅ Completed in v1.25.5-beta
- [x] ~~Null categories: `+@hyperloglog -pfadd -pfcount -pfmerge`~~ ✅ Completed in v1.25.6-beta (detects no commands granted, suggests empty rule)

#### Optimization Edge Cases (v1.25.7)

- [x] Selector rules skip optimization (context isolation) - `+@read (~user:*)` shows no optimization
- [x] Multiple optimization strategies ranked correctly - `+pfadd +pfcount +pfmerge` → `+@hyperloglog`, `+discard +exec +multi +unwatch +watch` → `+@transaction`
- [x] Category completion detected for small categories (hyperloglog: 3 commands, transaction: 5 commands)

#### All-Categories Pattern Detection (v1.25.7)

- [x] Backend detects when all commands are covered (not just all categories present)
- [x] 20/21 categories covering all 311 commands suggests `+@all`
- [x] Proper warning message: "Categories cover all 311 commands" (not "redundant inclusions")
- [x] Works for both exact category match (21/21) and command coverage (20/21)
- [x] No misleading "Redundant inclusions" when it's actually an all-categories pattern

#### Null Category Optimization Clearing (v1.25.7)

- [x] `+@hyperloglog -pfadd -pfcount -pfmerge` (grants 0 commands) clears rule when clicking @hyperloglog button
- [x] Optimization suggestion automatically clears when rule becomes empty
- [x] No persistent optimization box after clearing null category rule
- [x] analyzeRedundancy() called after updateRuleText() in smoothRender flow

#### UI Layout Fixes (v1.25.7)

- [x] "No categories available" text appears on its own line (not inline with @all button)
- [x] @all button appears below message text in blocked column
- [x] @all button appears below message text in granted column
- [x] `width: 100%` forces message to take full flex container width

#### Command Count Initialization (v1.25.8)

- [x] Empty rule on page load shows correct blocked count (311/311 for Redis 7, 446/446 for Redis 8)
- [x] No longer shows (0/311) on initial page load
- [x] `blockedCount = totalCommands` when rule is empty or no API response

#### Version Switching with Unsaved Changes (v1.25.8)

- [x] Typing "+ft.search" in Redis 7 → switch to Redis 8 → submit shows correct counts (1/446)
- [x] `loadAllData()` always called during version switch, even with unsaved changes
- [x] Command counts update correctly when switching versions with unsaved text
- [x] No more wrong denominators like (445/311)

#### Redis 8 → Redis 7 Downgrade with Module Commands (v1.25.9)

- [x] Enter `+ft.search +json.get +@search` in Redis 8 and submit
- [x] Switch to Redis 7 → confirmation dialog appears correctly
- [x] Click OK → rule is cleaned (module commands and categories removed)
- [x] Interactive ACL Builder internal state properly synced via `syncFromRuleText()`
- [x] Textarea remains empty after version switch completes
- [x] No re-addition of cleaned Redis 8 content
- [x] Notification shows: "Removed X Redis 8-specific items from ACL rule"

### Edge Cases & Error Handling (v1.25.7)

- [x] Invalid category names show proper error (`+@fakecategory +@read`)
- [x] Invalid command names show proper error (`+fakecommand +get +set`)
- [x] Malformed ACL syntax shows proper error (`@read @write`)
- [x] Empty rule behavior (blocks all commands by default)
- [x] Very long rules (21 categories) perform acceptably - no performance issues
- [x] All-categories rule suggests `+@all` without performance degradation

### Light/Dark Mode Testing (v1.25.6)

- [x] All button states visible in light mode
- [x] All button states visible in dark mode
- [x] Hollow styling distinguishable in both themes
- [x] Warning icons (⚠) visible in both themes
- [x] Optimization/redundancy boxes styled correctly in both themes

### Mobile/Tablet Testing

- [ ] Buttons render correctly on smaller screens
- [ ] Touch interactions work properly
- [ ] Tooltips work on touch devices
- [ ] Panel reordering works on touch devices
- [ ] Resize handles work on touch devices

---

## Testing Methodology

### Manual Testing Process

1. **Setup**: Start with clean state (clear localStorage, refresh page)
2. **Execute**: Perform the specific test action
3. **Verify**: Check expected behavior in UI, console, and network tab
4. **Document**: Record any issues or unexpected behavior

### Test Priority Levels

- **P0 (Critical)**: Core functionality - must work for release
- **P1 (High)**: Important features - should work for release
- **P2 (Medium)**: Nice-to-have - can defer if needed
- **P3 (Low)**: Edge cases - test if time permits

### Bug Reporting Format

When issues are found:

```markdown
**Issue**: Brief description
**Steps**: 1. Action 1, 2. Action 2, ...
**Expected**: What should happen
**Actual**: What actually happens
**Priority**: P0/P1/P2/P3
**Version**: Redis 7/8, Browser, OS
```

---

## Known Issues & Limitations

### Current Limitations

- Pub/sub channel patterns validated but not tested (app can't test pub/sub)
- Selector rules cannot be optimized (by design - context isolation)
- Very complex rules (50+ terms) may have performance impact

### Future Enhancements

- Automated test suite with Playwright/Cypress
- Performance benchmarks for large rules
- Accessibility testing with screen readers
- Load testing with concurrent users

---

## Version History

- **v1.25.7-beta**: All-categories pattern detection improvements, null category optimization clearing, UI layout fixes for @all button positioning
- **v1.25.6-beta**: Truncated all-categories message, cleaner optimization warnings
- **v1.25.5-beta**: Fixed duplicate optimization suggestions with key patterns
- **v1.25.4-beta**: Version switching preservation, backend optimization display coordination
- **v1.24.0-beta**: Fixed implicitly partial categories, auto-optimization, grouped redundancy warnings
- **v1.23.2-beta**: Interactive hover feedback and animation fixes
- **v1.23.0-beta**: Testing section UI polish
- **v1.22.0-v1.22.3**: Interactive ACL Builder refactoring
