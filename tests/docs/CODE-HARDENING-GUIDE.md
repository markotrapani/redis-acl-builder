# Redis ACL Builder - Code Hardening Guide (innerHTML → Safe DOM Methods)

**Priority**: P2 (Post-GA v1.1)
**Security Impact**: LOW (defense-in-depth improvement)
**Effort**: ~2-3 hours
**Status**: IN PROGRESS (DOMUtils created, partial migration done)

---

## Overview

This guide documents the systematic replacement of `innerHTML` with safe DOM methods to prevent potential XSS vulnerabilities. While the current codebase is **already protected** by backend validation, this hardening provides **defense-in-depth** security.

### Current Risk Assessment: ✅ LOW

- ✅ Backend never includes raw user input in API responses
- ✅ All user inputs validated by Pydantic before processing
- ✅ XSS attempts properly rejected at API layer
- ⚠️ Frontend uses `innerHTML` with backend-provided text (35 locations)

**Why harden anyway?**
1. **Defense-in-depth** - Multiple layers of security
2. **Future-proofing** - Prevents accidental introduction of vulnerabilities
3. **Best practice** - Aligns with OWASP security guidelines
4. **Code quality** - More explicit about what's safe vs unsafe

---

## ✅ Completed Work

### 1. Created DOMUtils Module
**File**: `static/js/core/dom-utils.js`

**Functions**:
- `createTextWithBreaks(text)` - Safe alternative to `innerHTML` for text with `\n`
- `createSpan(text, className)` - Create span with textContent
- `createClickableRule(rule, onClick)` - Safe clickable rule element
- `createSimplifiedRuleSuggestion()` - Build suggestion elements safely
- `createWarning(message)` - Safe warning message
- `clearElement(element)` - Safe element clearing
- `createTooltipContent()` - Structured tooltip creation
- `createCategoryButtonContent()` - Category button with icons

### 2. Migrated rule-manager.js Warnings
**Status**: ✅ COMPLETE

**Changes**:
- Line 358: `warningDiv.innerHTML = warning...` → `warningDiv.appendChild(DOMUtils.createTextWithBreaks(warning))`
- Added DOMUtils import

**Files Modified**:
- `static/js/managers/rule-manager.js` (1 of 35 innerHTML usages fixed)

---

## 📋 Remaining innerHTML Usages (34 locations)

### Category 1: Safe Clearing Operations (11 locations) - ✅ SAFE
These set `innerHTML = ''` to clear content. Low priority but can be replaced for consistency.

```javascript
// Current
element.innerHTML = '';

// Recommended (for consistency)
DOMUtils.clearElement(element);  // or element.textContent = '';
```

**Locations**:
1. `rule-manager.js:69` - Clear command results
2. `rule-manager.js:301` - Clear warnings list
3. `rule-manager.js:302` - Clear suggestions list
4. `integrated-tester.js:154` - Clear integrated result
5. `integrated-tester.js:302` - Clear after dismiss
6. `interactive-acl-builder.js:425` - Clear warnings list
7. `interactive-acl-builder.js:426` - Clear suggestions list
8. `interactive-acl-builder.js:1421` - Clear granted categories
9. `interactive-acl-builder.js:1651` - Clear blocked categories
10. `interactive-acl-builder.js:2036` - Clear granted commands
11. `interactive-acl-builder.js:2098` - Clear blocked commands
12. `saved-rules.js:205` - Clear saved rules content

**Priority**: 🟡 **P3 - Optional** (already safe, cosmetic improvement)

---

### Category 2: Hardcoded HTML Structures (18 locations) - ⚠️ MEDIUM PRIORITY
These use innerHTML with hardcoded HTML (no user input). Safe currently but should be migrated.

#### 2a. Warning/Suggestion Messages (8 locations)
**Priority**: 🟠 **P2 - Recommended**

```javascript
// BEFORE (rule-manager.js:379)
suggestionDiv.innerHTML = `${formattedFirstPart}Simplified rule: <span class="simplified-rule">${actualRule}</span>${additionalText ? '<br>' + additionalText : ''}`;

// AFTER
const fragment = DOMUtils.createSimplifiedRuleSuggestion(
    formattedFirstPart,
    actualRule,
    additionalText,
    () => { /* click handler */ }
);
suggestionDiv.appendChild(fragment);
```

**Locations**:
1. `rule-manager.js:379` - Simplified rule suggestion
2. `interactive-acl-builder.js:464` - Redundant exclusion warning
3. `interactive-acl-builder.js:476` - Simplified rule suggestion
4. `interactive-acl-builder.js:539` - Category fully granted warning
5. `interactive-acl-builder.js:551` - Simplified rule suggestion
6. `interactive-acl-builder.js:626` - Category cancelled out warning
7. `interactive-acl-builder.js:638` - Simplified rule suggestion
8. `rule-manager.js:448` - No ACL rule message

#### 2b. Category Buttons with Icons (1 location)
**Priority**: 🟠 **P2 - Recommended**

```javascript
// BEFORE (acl-ui-renderer.js:595)
button.innerHTML = `@${category}<span class="warning-icon">⚠</span>`;

// AFTER
button.appendChild(DOMUtils.createCategoryButtonContent(category, true));
```

**Location**: `acl-ui-renderer.js:595`

#### 2c. Tooltip Content (3 locations)
**Priority**: 🟡 **P2 - Optional** (tooltips are generated from safe data)

**Locations**:
1. `acl-ui-renderer.js:309` - Tooltip content
2. `acl-ui-renderer.js:400` - Expanded category tooltip
3. `acl-ui-renderer.js:403` - Expanded commands tooltip

#### 2d. Close Buttons & Results (3 locations)
**Priority**: 🟡 **P3 - Optional** (single character/symbol)

```javascript
// BEFORE (utils.js:99)
closeBtn.innerHTML = '×';

// AFTER
closeBtn.textContent = '×';
```

**Locations**:
1. `utils.js:99` - Close button symbol
2. `saved-rules.js:224` - Delete button symbol
3. `utils.js:56` - Message formatting

#### 2e. Test Results Display (3 locations)
**Priority**: 🟠 **P2 - Recommended**

**Locations**:
1. `integrated-tester.js:261` - Test result HTML
2. `utils.js:547` - Test result container
3. `rule-manager.js:450` - Results summary
4. `rule-manager.js:498` - Command results HTML

---

### Category 3: Summary Display (1 location) - 🟠 MEDIUM PRIORITY

**Location**: `rule-manager.js:450, 498`
- Summary statistics (granted/blocked count)
- Command list display

---

## 🎯 Migration Strategy

### Phase 1: Critical Paths (P1) - ✅ STARTED
1. ✅ Create DOMUtils module
2. ✅ Migrate warnings in rule-manager.js (DONE)
3. ⏳ Migrate suggestions in rule-manager.js (NEXT)
4. ⏳ Migrate warnings/suggestions in interactive-acl-builder.js

### Phase 2: High-Value Improvements (P2)
1. Category buttons with icons
2. Simplified rule suggestions (all remaining)
3. Test results display
4. Results summary display

### Phase 3: Cosmetic Improvements (P3)
1. Replace all `innerHTML = ''` with `textContent = ''`
2. Replace symbol-only innerHTML (×, ✕)
3. Tooltip content (optional - already safe)

---

## 📝 Step-by-Step Migration Template

### For Each innerHTML Usage:

1. **Identify the pattern**:
   - Is it clearing content? → Use `textContent = ''`
   - Is it a hardcoded symbol? → Use `textContent = 'symbol'`
   - Does it have structure (spans, br)? → Use DOMUtils methods

2. **Choose DOMUtils method**:
   - Simple text with line breaks → `createTextWithBreaks()`
   - Clickable rule → `createClickableRule()`
   - Full suggestion → `createSimplifiedRuleSuggestion()`
   - Warning → `createWarning()`

3. **Test the change**:
   - Load page, trigger the code path
   - Verify display looks identical
   - Check click handlers still work

4. **Example Migration**:

```javascript
// BEFORE
suggestionDiv.innerHTML = `Simplified rule: <span class="simplified-rule">${rule}</span>`;
const ruleSpan = suggestionDiv.querySelector('.simplified-rule');
ruleSpan.onclick = () => { /* handler */ };

// AFTER
suggestionDiv.appendChild(
    DOMUtils.createSimplifiedRuleSuggestion(
        '',  // no before text
        rule,
        '',  // no after text
        () => { /* handler */ }
    )
);
```

---

## 🧪 Testing Checklist

After migrating each file:

- [ ] Warnings display correctly
- [ ] Suggestions display correctly
- [ ] Line breaks render properly
- [ ] Clickable rules work
- [ ] Tooltips appear correctly
- [ ] Category buttons show warning icons
- [ ] Test results display properly
- [ ] No console errors
- [ ] Visual appearance unchanged

---

## 📊 Progress Tracking

| File | Total innerHTML | Fixed | Remaining | Status |
|------|----------------|-------|-----------|--------|
| rule-manager.js | 7 | 1 | 6 | 🟡 In Progress |
| interactive-acl-builder.js | 13 | 0 | 13 | ⏳ Pending |
| acl-ui-renderer.js | 4 | 0 | 4 | ⏳ Pending |
| integrated-tester.js | 3 | 0 | 3 | ⏳ Pending |
| saved-rules.js | 2 | 0 | 2 | ⏳ Pending |
| utils.js | 6 | 0 | 6 | ⏳ Pending |
| **TOTAL** | **35** | **1** | **34** | **3% Complete** |

---

## 🔄 Next Steps

### Immediate (Complete for v1.1):
1. Finish migrating `rule-manager.js` suggestions (line 379)
2. Migrate `interactive-acl-builder.js` warnings/suggestions (8 locations)
3. Migrate `acl-ui-renderer.js` category button (line 595)
4. Test all changes thoroughly
5. Update this guide with progress

### Post-v1.1 (Optional):
1. Migrate remaining safe innerHTML usages for consistency
2. Consider adding ESLint rule to prevent new innerHTML usage
3. Add security section to CONTRIBUTING.md

---

## 🛡️ Security Best Practices

### DO:
- ✅ Use `textContent` for plain text
- ✅ Use DOM methods (`createElement`, `appendChild`) for structure
- ✅ Use DOMUtils helper functions
- ✅ Escape user input if absolutely needed (DOMPurify library)

### DON'T:
- ❌ Use `innerHTML` with any external data
- ❌ Use template literals with user input for innerHTML
- ❌ Concatenate strings into innerHTML
- ❌ Trust data from API without validation (even though backend validates)

---

## 📚 References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN: Element.innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)
- [MDN: Node.textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)
- [DOMPurify Library](https://github.com/cure53/DOMPurify) (if complex HTML needed)

---

## 📝 Changelog

- **2025-10-08**: Created DOMUtils module, migrated first innerHTML usage (rule-manager.js:358)
- **Future**: Complete remaining 34 innerHTML migrations

---

**Maintainer Note**: This is a **low-priority, defense-in-depth improvement**. The current code is already secure due to backend validation. Complete this hardening for v1.1 or v1.2 when time permits.
