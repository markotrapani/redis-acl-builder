# Comprehensive Test Coverage Plan - Redis ACL Builder v2.5.0+

**Generated:** 2025-10-22
**Current Coverage:** 54% (1353 statements, 621 missed)
**Current Tests:** 86 tests
**Target Coverage:** 85%+ (industry standard for production code)

---

## Executive Summary

Our test suite has **critical gaps** that affect all three deployment modes:

- **Local Web App** (Flask dev server on port 5001)
- **Docker Web App** (Production deployment on port 7380)
- **Electron Desktop App** (Native desktop with bundled backend on port 7381)

**Key Finding:** We're missing **28 critical tests** including:

- **10 selector tests** (Redis 7.0+ feature - claimed support but 0% test
  coverage!)
- **7 API endpoint tests** (affects all deployment modes)
- **8 advanced parser tests** (impact summary, workflows, validation)
- **3 core ACL tests** (basic functionality)

---

## Deployment Modes & Shared Backend

### Code Sharing Architecture

All three deployment modes share the **SAME backend code**:

```text
backend/
├── app.py                    # Flask API (used by ALL modes)
├── helpers/
│   ├── acl_parser.py        # ACL parsing engine (used by ALL modes)
│   ├── data_loader.py       # Command database (used by ALL modes)
│   └── version_checker.py   # Docker update checking (web only)
└── models/
    └── api_models.py        # Pydantic request/response (used by ALL modes)
```

**This means:** Backend test coverage directly affects **all deployment modes
equally**.

### Frontend Differences

Each mode uses the **SAME frontend code** but with different contexts:

| Component | Local Web | Docker Web | Electron Desktop |
|-----------|-----------|------------|------------------|
| HTML Templates | ✅ Same | ✅ Same | ✅ Same |
| JavaScript Modules | ✅ Same | ✅ Same | ✅ Same |
| CSS Styles | ✅ Same | ✅ Same | ✅ Same |
| Backend Port | 5001 | 7380 | 7381 |
| Auto-Update | ❌ No | ❌ No | ✅ Yes (v2.2.6+) |
| Update Check API | ❌ Hidden | ✅ Visible | ❌ N/A |

**This means:** Frontend test coverage (E2E tests) affects **all deployment
modes**.

### Current Test Coverage by Layer

| Layer | Coverage | Impacts |
|-------|----------|---------|
| **Backend API** | 59% | 🔴 ALL modes (web, docker, electron) |
| **ACL Parser** | 48% | 🔴 ALL modes (core functionality) |
| **Data Loader** | 100% | ✅ ALL modes |
| **API Models** | 92% | ✅ ALL modes |
| **Version Checker** | 0% | ⚠️ Docker web only |
| **Frontend E2E** | 100% (28/28 Playwright tests) | ✅ ALL modes |

---

## Critical Coverage Gaps

### 1. Redis 7.0+ Selectors (HIGHEST PRIORITY)

**Impact:** ALL deployment modes
**Current Coverage:** 0%
**Risk Level:** 🔴 CRITICAL

**What are selectors?**
Redis 7.0+ allows multiple ACL rule sets in a single user definition:

```text
user alice on +@all ~* (+@read ~cache:*) (+@write ~logs:*)
              ↑ root rule  ↑ selector 1    ↑ selector 2
```

This enables **fine-grained key access control** - different permissions for
different key patterns.

**Missing Tests (10 total):**

1. **test_selector_basic_parsing** - Parse selector syntax from ACL rules
   - Difficulty: Medium
   - Expected fix time: 30 min
   - Coverage impact: +2%

2. **test_selector_command_access_root** - Command granted by root rule
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

3. **test_selector_command_access_selector** - Command granted by selector
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

4. **test_selector_key_isolation_root** - Root command accesses root key (✅)
   - Difficulty: Medium
   - Expected fix time: 20 min
   - Coverage impact: +1.5%

5. **test_selector_key_isolation_selector** - Selector command accesses selector
   key (✅)
   - Difficulty: Medium
   - Expected fix time: 20 min
   - Coverage impact: +1.5%

6. **test_selector_key_isolation_mismatch_root_cmd_selector_key** - Root command
   CANNOT access selector key (❌)
   - Difficulty: Medium
   - Expected fix time: 20 min
   - Coverage impact: +1.5%

7. **test_selector_key_isolation_mismatch_selector_cmd_root_key** - Selector
   command CANNOT access root key (❌)
   - Difficulty: Medium
   - Expected fix time: 20 min
   - Coverage impact: +1.5%

8. **test_selector_multiple_selectors** - Multiple selectors in single rule
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

9. **test_selector_validation_balanced_parens** - Syntax validation (unmatched
   parens)
   - Difficulty: Easy
   - Expected fix time: 10 min
   - Coverage impact: +0.5%

10. **test_selector_validation_nested** - Nested selectors not allowed
    - Difficulty: Easy
    - Expected fix time: 10 min
    - Coverage impact: +0.5%

11. **test_selector_validation_empty** - Empty selector () not allowed
    - Difficulty: Easy
    - Expected fix time: 10 min
    - Coverage impact: +0.5%

12. **test_selector_validation_invalid_category** - Invalid category in selector
    - Difficulty: Easy
    - Expected fix time: 10 min
    - Coverage impact: +0.5%

13. **test_selector_with_advanced_key_permissions** - %R~, %W~, %RW~ in
selectors
    - Difficulty: Medium
    - Expected fix time: 20 min
    - Coverage impact: +1%

**Total Estimated Impact:**

- **Time:** ~3.5 hours
- **Coverage Gain:** ~13-15%
- **New Tests:** 10
- **Priority:** 🔴 **CRITICAL** (claimed feature with 0% coverage!)

---

### 2. API Endpoint Tests

**Impact:** ALL deployment modes
**Current Coverage:** 59% of app.py
**Risk Level:** 🟡 HIGH

**Missing Tests (7 total):**

1. **test_test_command_api** - POST /api/test-command endpoint
   - Tests: Command permission checking API
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1.5%

2. **test_validate_rule_api** - POST /api/validate-rule endpoint
   - Tests: ACL syntax validation API
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

3. **test_command_info_api** - POST /api/command-info endpoint
   - Tests: Command category information API
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

4. **test_search_commands_api** - POST /api/search-commands endpoint
   - Tests: Command search with patterns
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

5. **test_error_handling** - API error response formats
   - Tests: Proper error messages, status codes
   - Difficulty: Easy
   - Expected fix time: 20 min
   - Coverage impact: +1.5%

6. **test_redis_version_differences** - Version-specific behavior
   - Tests: Redis 7 vs 8 command differences
   - Difficulty: Easy (already have similar tests)
   - Expected fix time: 10 min
   - Coverage impact: +0.5%

7. **test_analyze_redundancy_api** - POST /api/analyze-redundancy endpoint
   - Tests: ACL rule optimization suggestions
   - Difficulty: Medium
   - Expected fix time: 20 min
   - Coverage impact: +2%

**Total Estimated Impact:**

- **Time:** ~2 hours
- **Coverage Gain:** ~8-9%
- **New Tests:** 7
- **Priority:** 🟡 HIGH (affects user-facing API)

---

### 3. Advanced Parser Features

**Impact:** ALL deployment modes
**Current Coverage:** 48% of acl_parser.py
**Risk Level:** 🟡 MEDIUM-HIGH

**Missing Tests (8 total):**

1. **test_basic_category_rules** - Basic @category allow/deny
   - Tests: +@read, -@write, etc.
   - Difficulty: Easy (we have similar tests in pytest file)
   - Expected fix time: 15 min
   - Coverage impact: +1%

2. **test_rule_validation** - Comprehensive syntax validation
   - Tests: Invalid categories, malformed rules
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

3. **test_search_commands** - Command search with wildcards
   - Tests: Pattern matching (h*,*get, etc.)
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

4. **test_impact_summary** - Rule impact analysis
   - Tests: get_rule_impact_summary() method
   - Difficulty: Medium
   - Expected fix time: 25 min
   - Coverage impact: +2%

5. **test_category_info** - Category command counts
   - Tests: get_category_info() method
   - Difficulty: Easy (we have similar API test)
   - Expected fix time: 10 min
   - Coverage impact: +0.5%

6. **test_complete_workflow** - End-to-end user workflow
   - Tests: Parse → Evaluate → Test → Optimize
   - Difficulty: Medium
   - Expected fix time: 30 min
   - Coverage impact: +2%

7. **test_complex_rule_scenarios** - Real-world complex rules
   - Tests: Multi-category, exclusions, overrides
   - Difficulty: Medium
   - Expected fix time: 25 min
   - Coverage impact: +1.5%

8. **test_refactored_error_handling** - Error message quality
   - Tests: Clear, actionable error messages
   - Difficulty: Easy
   - Expected fix time: 15 min
   - Coverage impact: +1%

**Total Estimated Impact:**

- **Time:** ~2.5 hours
- **Coverage Gain:** ~10%
- **New Tests:** 8
- **Priority:** 🟡 MEDIUM-HIGH (improves core functionality coverage)

---

### 4. Version Checker Module (Docker Web Only)

**Impact:** Docker web app only
**Current Coverage:** 0% (53 statements untested)
**Risk Level:** 🟢 LOW (feature is hidden by default)

**Context:**

- Used by `/api/check-updates` endpoint
- Checks Docker Hub for newer image versions
- Button is `style="display: none;"` by default
- Only relevant for Docker deployments
- Electron app has its own auto-update system (v2.2.6+)

**Missing Tests (estimated 8-10):**

1. **test_check_updates_success** - Normal update check flow
2. **test_check_updates_no_update_available** - Already on latest
3. **test_check_updates_network_timeout** - Docker Hub timeout
4. **test_check_updates_network_error** - Connection error
5. **test_check_updates_api_error** - Docker Hub API 4xx/5xx
6. **test_check_updates_invalid_current_version** - Bad version format
7. **test_check_updates_no_valid_tags** - No semantic versions found
8. **test_check_updates_version_comparison** - Proper semver logic

**Challenges:**

- Requires **mocking** `requests` library
- Requires **mocking** Docker Hub API responses
- Needs mock for `packaging.version.parse()`
- Low ROI since feature is hidden and Docker-specific

**Total Estimated Impact:**

- **Time:** ~3 hours (mocking complexity)
- **Coverage Gain:** ~4%
- **New Tests:** 8-10
- **Priority:** 🟢 LOW (Docker-only, hidden feature)

---

### 5. UI/Integration Tests (Already Covered)

**Impact:** ALL deployment modes
**Current Coverage:** 100% (28/28 Playwright E2E tests passing)
**Risk Level:** ✅ EXCELLENT

**What's tested:**

- Page load and layout (5 tests)
- ACL rule editing and validation (5 tests)
- Interactive builder click-to-grant/revoke (4 tests)
- Command permission testing (3 tests)
- Keyspace pattern testing (2 tests)
- Saved rules management (2 tests)
- Redis version switching (3 tests)
- Theme switching (2 tests)
- Complete user workflows (2 tests)

**Missing from v1.25.0-beta (3 tests):**

1. **test_search_limit_configuration** - Search result limits
   - Priority: 🟢 LOW (configuration detail)

2. **test_copy_clear_buttons_presence_and_positioning** - Button HTML
   - Priority: 🟢 LOW (visual regression)

3. **test_version_toggle_design_consistency** - Toggle styling
   - Priority: 🟢 LOW (visual regression)

**Recommendation:** Keep current E2E tests as-is. These missing tests are
low-value HTML assertions that are better validated through visual testing or
user acceptance testing.

---

## Recommended Test Restoration Priority

### Phase 1: Critical Backend Coverage (Priority 1)

**Goal:** Fix claimed features with 0% coverage
**Target Coverage:** 54% → 70%
**Estimated Time:** 3.5 hours

1. ✅ Restore all 10 selector tests
2. ✅ Verify selector functionality works across all deployment modes

**Deliverable:** Selector feature fully tested and verified

---

### Phase 2: API Endpoint Coverage (Priority 2)

**Goal:** Ensure all user-facing APIs are tested
**Target Coverage:** 70% → 78%
**Estimated Time:** 2 hours

1. ✅ Restore 7 API endpoint tests
2. ✅ Update for Pydantic models and current response formats
3. ✅ Verify API behavior consistent across deployment modes

**Deliverable:** All API endpoints have test coverage

---

### Phase 3: Advanced Parser Coverage (Priority 3)

**Goal:** Comprehensive parser functionality coverage
**Target Coverage:** 78% → 88%
**Estimated Time:** 2.5 hours

1. ✅ Restore 8 advanced parser tests
2. ✅ Update for current ACL parser API
3. ✅ Add real-world complex rule scenarios

**Deliverable:** Parser core functionality fully tested

---

### Phase 4: Version Checker (Optional - Priority 4)

**Goal:** Docker-specific feature coverage
**Target Coverage:** 88% → 92%
**Estimated Time:** 3 hours

**Recommendation:** DEFER to future release

- Low user impact (hidden feature, Docker-only)
- High implementation cost (extensive mocking required)
- Better ROI focusing on user-facing features
- Can be added in v2.6.0 or later

---

## Coverage Targets by Phase

| Phase | Tests Added | Est. Coverage | Status |
|-------|-------------|---------------|--------|
| **Current** | 86 | 54% | ✅ Complete |
| **Phase 1** | +10 (selectors) | ~70% | 🔴 Critical |
| **Phase 2** | +7 (APIs) | ~78% | 🟡 High Priority |
| **Phase 3** | +8 (parser) | ~88% | 🟡 Medium Priority |
| **Phase 4** | +8-10 (version) | ~92% | 🟢 Optional/Future |

**Recommended v2.5.0 Target:** Phases 1-3 = **88% coverage, 111 tests**

---

## Test Count Summary

### Original (v1.25.0-beta)

- **Total:** 90 test methods
- test_app.py: 48 tests
- Others: 42 tests

### Current (v2.5.0-beta)

- **Total:** 86 test methods
- test_app.py: 20 tests (❌ missing 28)
- test_acl_parser_pytest.py: 27 tests (✅ +10 OSS-specific)
- test_advanced_features.py: 38 tests (✅ +30 Redis 8 modules/OSS)
- Others: 11 tests

### Recommended (v2.5.0 Complete)

- **Total:** 111 test methods (+25 from current)
- test_app.py: 45 tests (restored selectors + APIs + advanced)
- Others: 66 tests (current)

---

## Deployment Mode Test Matrix

| Test Category | Local Web | Docker Web | Electron | Coverage |
|---------------|-----------|------------|----------|----------|
| **Backend API** | ✅ | ✅ | ✅ | 59% → 78% |
| **ACL Parser** | ✅ | ✅ | ✅ | 48% → 88% |
| **Selectors** | ❌ | ❌ | ❌ | **0% → 15%** |
| **Data Loader** | ✅ | ✅ | ✅ | 100% ✅ |
| **API Models** | ✅ | ✅ | ✅ | 92% ✅ |
| **Version Checker** | N/A | ❌ | N/A | 0% (defer) |
| **Frontend E2E** | ✅ | ✅ | ✅ | 100% ✅ |

**Legend:**

- ✅ Tested and working
- ❌ Not tested (critical gap)
- N/A Not applicable to deployment mode

---

## Recommendations for v2.5.0-beta

### MUST DO (Blocks Release)

1. ✅ **Restore selector tests** (Priority 1)
   - This is a **claimed feature** with 0% test coverage
   - Affects ALL deployment modes
   - High risk if not tested

### SHOULD DO (Quality Assurance)

1. ✅ **Restore API endpoint tests** (Priority 2)
   - User-facing functionality
   - Affects ALL deployment modes
   - Professional quality standard

1. ✅ **Restore advanced parser tests** (Priority 3)
   - Core functionality coverage
   - Affects ALL deployment modes
   - Reaches 88% coverage target

### COULD DEFER (Future Release)

1. ⏭️ **Version checker tests** (Priority 4)
   - Docker-only, hidden feature
   - Significant mocking overhead
   - Can ship without (current 0% coverage)

---

## Next Steps

1. **Review this plan** - Confirm priorities and scope
2. **Approve Phase 1** - Restore selector tests (3.5 hours)
3. **Approve Phase 2** - Restore API tests (2 hours)
4. **Approve Phase 3** - Restore parser tests (2.5 hours)
5. **Run full test suite** - Verify all ~111 tests pass
6. **Generate coverage report** - Confirm ~88% coverage achieved
7. **Update documentation** - CLAUDE.md, README.md with new test stats
8. **Commit and release** - v2.5.0-beta with comprehensive test coverage

**Total Estimated Time:** ~8 hours for Phases 1-3
**Expected Outcome:** 111 tests, 88% coverage, production-ready quality

---

## Questions to Answer

1. **Scope:** Do we proceed with Phases 1-3 for v2.5.0-beta? (Recommended: YES)
2. **Version Checker:** Defer to v2.6.0? (Recommended: YES - low ROI)
3. **Timeline:** Acceptable to spend ~8 hours on test restoration? (One full
   work day)
4. **Quality Bar:** Is 88% coverage acceptable for v2.5.0 release? (Industry
   standard: 80-90%)

**My Recommendation:** Proceed with Phases 1-3, skip Phase 4 for now. This gives
us production-quality coverage (88%) with comprehensive testing of all
user-facing features across all deployment modes.
