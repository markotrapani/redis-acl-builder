# Interactive ACL Builder - Test Plan

## Test Status: In Progress (v1.25.1-beta)

### ✅ Completed Tests (v1.23.2 - v1.25.1)

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

---

## 🔄 Pending Tests (Future Work)

### Button Interaction Testing

#### Regular Category Button States

- [ ] Explicit grant `+@read`: Solid green in granted column
- [ ] Explicit partial `+@read -get`: Hollow yellow ⚠ in granted column
- [ ] Implicit grant (via `+@all`): Solid green in granted column
- [ ] Implicit partial (via `+@all -@admin`): Hollow yellow ⚠ in both columns
- [ ] Explicit block `-@dangerous`: Solid red in blocked column
- [ ] Partial block `+@all -@admin +acldeluser`: Hollow red ⚠ in blocked column
- [ ] Available (not granted): Solid red in blocked column

#### Cross-Column Interactions

- [ ] Clicking granted category moves to blocked (and vice versa)
- [ ] Clicking partial category in granted removes partial grants
- [ ] Clicking partial category in blocked grants full category
- [ ] Button state reflects committed ACL rule, not uncommitted textarea changes

### Individual Command Button Testing

- [ ] Granted commands show green solid
- [ ] Blocked commands show red with correct type (explicit/category/implicit)
- [ ] Clicking command toggles correctly
- [ ] Command buttons position correctly in their respective columns
- [ ] Commands blocked by category have different styling than explicit blocks

### Optimization & Redundancy Testing

#### Auto-Optimization Triggers

- [ ] Button clicks trigger auto-optimization (grantCategory, blockCategory, etc.)
- [ ] Manual text edits do NOT trigger auto-optimization (only suggestions)
- [ ] Auto-optimization notification shows correct before/after counts
- [ ] Optimization preserves key patterns (`~`, `%R~`, `%W~`, `%RW~`)

#### Redundancy Detection Patterns

- [ ] Redundant inclusions: `+@all +@read +@write` (should group)
- [ ] Redundant exclusions: `-@read -@write` (when neither granted)
- [ ] Cancelled `@all`: `+@all` then all categories blocked
- [ ] All categories granted: `+@read +@write ...` → suggest `+@all`
- [ ] Category completion: `+get +set +append ...` → suggest `+@string`
- [ ] Null categories: `+@read` then all read commands excluded

#### Optimization Edge Cases

- [ ] Empty rule optimization (grants no commands)
- [ ] Key patterns preserved during optimization
- [ ] Selector rules skip optimization (context isolation)
- [ ] Multiple optimization strategies ranked correctly

### Redis 7 vs Redis 8 Differences

- [ ] Command counts differ correctly (311 vs 446)
- [ ] Category counts differ correctly (21 vs 29)
- [ ] Module commands only appear in Redis 8 (`ft.*`, `json.*`, etc.)
- [ ] Optimization suggestions differ based on available commands
- [ ] Category overlap percentages differ between versions

### Edge Cases & Error Handling

- [ ] Invalid category names show proper error
- [ ] Invalid command names show proper error
- [ ] Malformed ACL syntax shows proper error with truncated tokens
- [ ] Empty rule behavior (blocks all commands by default)
- [ ] Very long rules (100+ terms) perform acceptably
- [ ] Rapid button clicking doesn't cause race conditions

### Light/Dark Mode Testing

- [ ] All button states visible in light mode
- [ ] All button states visible in dark mode
- [ ] Hollow styling distinguishable in both themes
- [ ] Warning icons (⚠) visible in both themes
- [ ] Optimization/redundancy boxes styled correctly in both themes

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

- **v1.24.0-beta**: Fixed implicitly partial categories, auto-optimization, grouped redundancy warnings
- **v1.23.2-beta**: Interactive hover feedback and animation fixes
- **v1.23.0-beta**: Testing section UI polish
- **v1.22.0-v1.22.3**: Interactive ACL Builder refactoring
