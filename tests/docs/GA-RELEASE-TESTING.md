# Redis ACL Builder - GA Release Testing Plan

**Version**: v2.0.x (Target GA Release - Web + Electron Desktop)
**Current Status**: Pre-GA Testing Phase
**Test Completion**: 0% (0/200+ test cases)
**Architecture**: Dual deployment (Docker web app + Electron desktop app)

---

## 📋 Testing Overview

This document outlines comprehensive testing requirements for promoting Redis
ACL Builder from beta to General Availability (GA). All tests must pass before
GA release.

### Testing Categories

1. [Backend & API Testing](#1-backend--api-testing) - 15 tests
2. [Browser Compatibility](#2-browser-compatibility) - 12 tests
3. [Responsive Design & Mobile/Tablet](#3-responsive-design--mobiletablet) - 20
   tests
4. [Accessibility (A11y)](#4-accessibility-a11y-testing) - 18 tests
5. [Security Testing](#5-security-testing) - 12 tests
6. [Performance & Optimization](#6-performance--optimization) - 15 tests
7. [Data Persistence & State](#7-data-persistence--state-management) - 15 tests
8. [Edge Cases & Errors](#8-edge-cases--error-scenarios) - 18 tests
9. [Docker & Deployment](#9-docker--deployment) - 16 tests
10. [Electron Desktop App](#10-electron-desktop-app-testing) - 20 tests
    **[NEW]**
11. [Documentation & UX](#11-documentation--user-experience) - 12 tests
12. [Automated Testing](#12-automated-testing-coverage) - 10 tests
13. [Production Readiness](#13-production-readiness) - 12 tests

**Total Test Cases**: 200+

---

## 1. Backend & API Testing

**Priority**: P0 (Critical)
**Objective**: Ensure backend stability, performance, and correctness under
production loads.

### API Endpoint Testing (P0)

- [ ] **Test 1.1**: `/api/parse` - Parse complex ACL rules (20+ terms)
  - Input: `+@all -@admin -@dangerous +acl|list +config|get ~user:* %R~cache:* &channel:*`
  - Expected: Correct granted/blocked/partial category analysis
  - Acceptance: Response time <100ms, correct category classification

- [ ] **Test 1.2**: `/api/test-command` - Test command permissions with
  selectors
  - Input: `+@read (~user:*) +@write (~admin:*)` with command `GET user:123`
  - Expected: Allowed due to selector #1
  - Acceptance: Correct selector context in response

- [ ] **Test 1.3**: `/api/validate-rule` - Validate invalid syntax
  - Input: `@read @write +get -set` (missing +/- prefix)
  - Expected: Clear error message with token position
  - Acceptance: Error message includes "Invalid token '@read' at position 1"

- [ ] **Test 1.4**: `/api/command-info` - Command category lookup
  - Input: `GET`, `FT.SEARCH`, `JSON.GET`
  - Expected: Returns all categories for each command
  - Acceptance: Correct category lists for Redis 7 and Redis 8

- [ ] **Test 1.5**: `/api/categories` - List categories for both versions
  - Expected: Redis 7 returns 21 categories, Redis 8 returns 29 categories
  - Acceptance: Correct category counts, no duplicates

- [ ] **Test 1.6**: `/api/search-commands` - Fuzzy search with patterns
  - Input: `"get"` (should match GET, GETEX, GETDEL, HGET, etc.)
  - Expected: Ranked results with relevance scores
  - Acceptance: All matching commands returned, sorted by relevance

- [ ] **Test 1.7**: `/api/optimize-rule` - Optimization suggestions
  - Input: `+pfadd +pfcount +pfmerge`
  - Expected: Suggests `+@hyperloglog`, savings=2 terms
  - Acceptance: Correct optimization with key pattern preservation

### Concurrent Load Testing (P0)

- [ ] **Test 1.8**: Concurrent `/api/parse` requests (100 simultaneous)
  - Tool: Apache Bench or Locust
  - Expected: No 500 errors, average response time <200ms
  - Acceptance: 99% success rate, no memory leaks

- [ ] **Test 1.9**: Mixed API endpoint load (500 requests/second for 60s)
  - Endpoints: All 10 API endpoints with realistic payloads
  - Expected: Server remains stable, no crashes
  - Acceptance: CPU <80%, memory stable, response times consistent

### Pydantic Validation (P1)

- [ ] **Test 1.10**: Malformed JSON payloads
  - Input: `{"acl_rule": "invalid`, missing closing brace}
  - Expected: 400 Bad Request with clear error
  - Acceptance: Error message indicates JSON parsing failure

- [ ] **Test 1.11**: Missing required fields
  - Input: `{}` (no acl_rule field)
  - Expected: 400 with Pydantic validation error
  - Acceptance: Error lists missing required field

- [ ] **Test 1.12**: Type mismatches
  - Input: `{"acl_rule": 123}` (integer instead of string)
  - Expected: 400 with type error
  - Acceptance: Clear type mismatch message

### Performance Benchmarks (P1)

- [ ] **Test 1.13**: Parse complex rule with all 21 categories (Redis 7)
  - Input: `+@slow +@fast +@dangerous +@admin +@write +@read +@keyspace +@string
    +@hash +@list +@set +@sortedset +@stream +@hyperloglog +@geo +@bitmap
    +@pubsub +@transaction +@scripting +@connection +@blocking`
  - Expected: Response time <150ms
  - Acceptance: Correct analysis, no performance degradation

- [ ] **Test 1.14**: Memory profiling with large rules (500+ characters)
  - Input: Very long rule with 100+ individual commands
  - Expected: Memory usage <50MB per request
  - Acceptance: No memory leaks after 1000 requests

- [ ] **Test 1.15**: Redis 7 ↔ 8 version switching stress test
  - Action: Toggle version 100 times rapidly with complex rule loaded
  - Expected: No crashes, state remains consistent
  - Acceptance: UI updates correctly every time, no errors

---

## 2. Browser Compatibility

**Priority**: P0 (Critical)
**Objective**: Ensure cross-browser functionality and visual consistency.

### Desktop Browsers (P0)

- [ ] **Test 2.1**: Chrome/Chromium (Latest, v130+)
  - Test: Full application flow (load → edit rule → test commands → save →
    version switch)
  - Expected: All features work perfectly
  - Acceptance: No console errors, visual consistency

- [ ] **Test 2.2**: Chrome/Chromium (v128, v129)
  - Test: Same as 2.1
  - Expected: Backward compatibility maintained
  - Acceptance: All features functional

- [ ] **Test 2.3**: Firefox (Latest, v120+)
  - Test: Full application flow + drag-drop panel reordering
  - Expected: All features work, CSS Grid/Flexbox compatible
  - Acceptance: No Firefox-specific bugs

- [ ] **Test 2.4**: Firefox (v118, v119)
  - Test: Same as 2.3
  - Expected: Backward compatibility
  - Acceptance: All features functional

- [ ] **Test 2.5**: Safari (macOS Latest, v17+)
  - Test: Full application flow + resizable containers
  - Expected: Webkit compatibility, no rendering issues
  - Acceptance: Resize handles work, tooltips display correctly

- [ ] **Test 2.6**: Safari (macOS v16, v15)
  - Test: Same as 2.5
  - Expected: Backward compatibility
  - Acceptance: Graceful degradation if needed

- [ ] **Test 2.7**: Microsoft Edge (Latest, v120+)
  - Test: Full application flow
  - Expected: Chromium-based Edge fully compatible
  - Acceptance: All features work identically to Chrome

### Mobile Browsers (P1)

- [ ] **Test 2.8**: Mobile Safari (iOS 17+, iPhone 14/15)
  - Test: Touch interactions, responsive layout, virtual keyboard
  - Expected: Mobile-optimized experience
  - Acceptance: Buttons tappable (44px min), no layout breaks

- [ ] **Test 2.9**: Mobile Safari (iOS 15, iOS 16)
  - Test: Same as 2.8
  - Expected: Backward compatibility
  - Acceptance: Core features work, graceful degradation

- [ ] **Test 2.10**: Chrome Mobile (Android 13+, Pixel/Samsung)
  - Test: Touch interactions, responsive layout
  - Expected: Android-optimized experience
  - Acceptance: All touch gestures work

- [ ] **Test 2.11**: Chrome Mobile (Android 11, Android 12)
  - Test: Same as 2.10
  - Expected: Backward compatibility
  - Acceptance: Core features functional

### Browser Feature Detection (P2)

- [ ] **Test 2.12**: JavaScript disabled scenario
  - Expected: Graceful message: "This application requires JavaScript"
  - Acceptance: User-friendly error page, no broken UI

---

## 3. Responsive Design & Mobile/Tablet

**Priority**: P0 (Critical)
**Objective**: Perfect responsive experience across all device sizes.

### Tablet Portrait (768px - 1024px) (P0)

- [ ] **Test 3.1**: Three-column layout rendering
  - Devices: iPad (768px), iPad Pro 11" (834px)
  - Expected: Columns stack or adjust gracefully
  - Acceptance: No horizontal scrolling, all content accessible

- [ ] **Test 3.2**: Category/command buttons clickable
  - Expected: Buttons minimum 44px tap target
  - Acceptance: Easy tapping, no mis-taps

- [ ] **Test 3.3**: Tooltips positioned correctly
  - Expected: Tooltips don't overflow screen edges
  - Acceptance: Multi-column tooltips adjust to viewport

- [ ] **Test 3.4**: Search bars aligned and functional
  - Expected: Search input full width, fuzzy/exact toggles accessible
  - Acceptance: Virtual keyboard doesn't hide inputs

- [ ] **Test 3.5**: Form fields full-size
  - Expected: Textarea, input fields use available space
  - Acceptance: Easy text entry, no zooming required

### Tablet Landscape (1024px - 1200px) (P0)

- [ ] **Test 3.6**: Three-column layout optimal
  - Devices: iPad Landscape (1024px), iPad Pro 12.9" (1366px)
  - Expected: Three columns visible side-by-side
  - Acceptance: Columns balanced, no crowding

- [ ] **Test 3.7**: Panel resizing works
  - Expected: Resize handles functional with touch
  - Acceptance: Smooth resize, no jumpy behavior

- [ ] **Test 3.8**: Drag-drop panel reordering
  - Expected: Touch-based drag works
  - Acceptance: Visual feedback, smooth animations

### Mobile Portrait (320px - 480px) (P0)

- [ ] **Test 3.9**: Single-column stacked layout
  - Devices: iPhone SE (320px), iPhone 14 (390px), iPhone 15 Pro Max (430px)
  - Expected: All panels stack vertically
  - Acceptance: No horizontal scroll, readable text (16px min)

- [ ] **Test 3.10**: Form buttons below inputs
  - Expected: Test buttons appear below textarea
  - Acceptance: Easy thumb reach, proper spacing

- [ ] **Test 3.11**: Collapsible sections functional
  - Expected: Expand/collapse works with tap
  - Acceptance: Smooth animations, clear +/- indicators

- [ ] **Test 3.12**: Testing panels usable
  - Expected: Command Tester and Keyspace Tester full width
  - Acceptance: Input fields large enough, results readable

### Mobile Landscape (480px - 768px) (P1)

- [ ] **Test 3.13**: Two-column or scrollable layout
  - Devices: iPhone 14 Landscape (852px)
  - Expected: Efficient use of horizontal space
  - Acceptance: No excessive whitespace

- [ ] **Test 3.14**: Horizontal scrolling if needed
  - Expected: Smooth horizontal pan for wide content
  - Acceptance: Clear scroll indicators

### Touch Interactions (P0)

- [ ] **Test 3.15**: Tap precision on all buttons
  - Expected: 44x44px minimum touch targets
  - Acceptance: No accidental adjacent button taps

- [ ] **Test 3.16**: Swipe gestures (if implemented)
  - Expected: Swipe to dismiss panels or scroll
  - Acceptance: Natural mobile UX patterns

- [ ] **Test 3.17**: Pinch-zoom handling
  - Expected: Pinch-zoom disabled (viewport meta tag)
  - Acceptance: No accidental zoom, or intentional zoom works well

- [ ] **Test 3.18**: Virtual keyboard behavior
  - Expected: Inputs scroll into view when keyboard opens
  - Acceptance: Submit buttons remain accessible

### Touch-Based Drag-Drop (P1)

- [ ] **Test 3.19**: Panel reordering with touch
  - Expected: Long-press to drag, smooth reordering
  - Acceptance: Visual feedback, works on mobile/tablet

- [ ] **Test 3.20**: Resizable containers with touch
  - Expected: Touch drag on resize handles
  - Acceptance: Smooth resize, no conflicts with scroll

---

## 4. Accessibility (A11y) Testing

**Priority**: P0 (Critical)
**Objective**: WCAG 2.1 AA compliance for inclusive user experience.

### Screen Reader Compatibility (P0)

- [ ] **Test 4.1**: NVDA (Windows, latest version)
  - Test: Navigate entire app with screen reader
  - Expected: All content announced, logical reading order
  - Acceptance: Can complete ACL rule creation without mouse

- [ ] **Test 4.2**: JAWS (Windows, v2023+)
  - Test: Same as 4.1
  - Expected: Full compatibility with JAWS
  - Acceptance: All interactive elements accessible

- [ ] **Test 4.3**: VoiceOver (macOS/iOS)
  - Test: Navigate with VoiceOver rotor
  - Expected: Headings, buttons, forms properly labeled
  - Acceptance: Can use app eyes-free on macOS/iOS

### Keyboard Navigation (P0)

- [ ] **Test 4.4**: Tab order logical and complete
  - Test: Tab through all interactive elements
  - Expected: Logical flow (top→bottom, left→right)
  - Acceptance: No trapped focus, all elements reachable

- [ ] **Test 4.5**: Shift+Tab reverse navigation
  - Expected: Reverse tab order works
  - Acceptance: Can navigate backward smoothly

- [ ] **Test 4.6**: Arrow keys for button groups
  - Expected: Arrow keys navigate within button groups
  - Acceptance: Intuitive navigation for category buttons

- [ ] **Test 4.7**: Enter key activates buttons/submits
  - Expected: Enter submits ACL rule, activates focused button
  - Acceptance: Consistent with web standards

- [ ] **Test 4.8**: Escape key dismisses modals/tooltips
  - Expected: Escape closes optimization suggestions, tooltips
  - Acceptance: Standard modal behavior

### Focus Management (P0)

- [ ] **Test 4.9**: Visible focus indicators
  - Expected: Clear outline/ring on focused elements
  - Acceptance: 3:1 contrast ratio for focus indicator

- [ ] **Test 4.10**: Focus doesn't get lost
  - Expected: After modal close, focus returns to trigger
  - Acceptance: No focus jumps to top of page

- [ ] **Test 4.11**: Skip to main content link
  - Expected: First tab shows "Skip to main content"
  - Acceptance: Skips header, goes directly to ACL editor

### ARIA & Semantic HTML (P1)

- [ ] **Test 4.12**: ARIA labels on all buttons
  - Expected: `aria-label` or visible text on all buttons
  - Acceptance: Screen reader announces button purpose

- [ ] **Test 4.13**: Semantic HTML elements
  - Expected: `<button>`, `<nav>`, `<main>`, `<section>` used correctly
  - Acceptance: HTML5 validator passes

- [ ] **Test 4.14**: Dynamic content announcements
  - Expected: `aria-live` regions for test results, notifications
  - Acceptance: Screen reader announces updates

### Color & Contrast (P0)

- [ ] **Test 4.15**: Color contrast ratios (WCAG AA)
  - Tool: Chrome DevTools Accessibility Panel
  - Expected: All text 4.5:1 ratio, large text 3:1 ratio
  - Acceptance: No contrast failures

- [ ] **Test 4.16**: Information not conveyed by color alone
  - Expected: Icons, patterns supplement color (e.g., ⚠️ for partial)
  - Acceptance: Color-blind users can distinguish states

### Text Scaling (P1)

- [ ] **Test 4.17**: 200% browser zoom
  - Expected: Layout remains usable, no overlapping text
  - Acceptance: Can complete tasks at 200% zoom

- [ ] **Test 4.18**: High contrast mode (Windows)
  - Expected: App remains usable in high contrast mode
  - Acceptance: All interactive elements visible

---

## 5. Security Testing

**Priority**: P0 (Critical)
**Objective**: Protect against common web vulnerabilities.

### XSS (Cross-Site Scripting) (P0)

- [ ] **Test 5.1**: Malicious ACL rule input
  - Input: `+<script>alert('XSS')</script> +@read`
  - Expected: Script tags escaped, displayed as text
  - Acceptance: No JavaScript execution

- [ ] **Test 5.2**: HTML injection in error messages
  - Input: `+@<img src=x onerror=alert('XSS')>`
  - Expected: HTML entities escaped
  - Acceptance: No rendered HTML tags

- [ ] **Test 5.3**: Command injection in test fields
  - Input: `GET <svg/onload=alert('XSS')>`
  - Expected: Input sanitized
  - Acceptance: No script execution

### CSRF (Cross-Site Request Forgery) (P1)

- [ ] **Test 5.4**: CSRF token validation
  - Test: POST request from different origin
  - Expected: 403 Forbidden without valid CSRF token
  - Acceptance: CSRF protection enabled (if using sessions)

- [ ] **Test 5.5**: SameSite cookie attribute
  - Expected: Cookies have `SameSite=Lax` or `Strict`
  - Acceptance: CSRF risk mitigated

### Input Validation (P0)

- [ ] **Test 5.6**: SQL injection attempts (if using database)
  - Input: `'; DROP TABLE users; --`
  - Expected: Input treated as literal string
  - Acceptance: No database manipulation

- [ ] **Test 5.7**: Command injection in system calls
  - Input: `; rm -rf /` in any input field
  - Expected: No system command execution
  - Acceptance: All inputs sanitized

- [ ] **Test 5.8**: Path traversal attempts
  - Input: `../../etc/passwd` (if file operations exist)
  - Expected: Blocked or sanitized
  - Acceptance: No unauthorized file access

### Docker Security (P1)

- [ ] **Test 5.9**: Docker image vulnerability scan
  - Tool: `docker scout cves`
  - Expected: 0 Critical, 0 High vulnerabilities
  - Acceptance: Document remaining MEDIUM/LOW CVEs with mitigation

- [ ] **Test 5.10**: Non-root user in container
  - Expected: Container runs as non-root user
  - Acceptance: `USER` directive in Dockerfile

- [ ] **Test 5.11**: Minimal base image
  - Expected: Alpine-based image, minimal attack surface
  - Acceptance: Image size <150MB

### API Security (P1)

- [ ] **Test 5.12**: Rate limiting on API endpoints
  - Test: 1000 requests/second from single IP
  - Expected: 429 Too Many Requests after threshold
  - Acceptance: Rate limiting protects against DoS

---

## 6. Performance & Optimization

**Priority**: P0 (Critical)
**Objective**: Fast, responsive user experience.

### Lighthouse Scores (P0)

- [ ] **Test 6.1**: Performance score ≥90
  - Tool: Chrome Lighthouse (Desktop)
  - Expected: Performance 90+, no blocking resources
  - Acceptance: Green score, no major issues

- [ ] **Test 6.2**: Accessibility score ≥95
  - Expected: Accessibility 95+
  - Acceptance: Address all critical a11y issues

- [ ] **Test 6.3**: Best Practices score ≥95
  - Expected: HTTPS, no console errors, modern APIs
  - Acceptance: Green score

- [ ] **Test 6.4**: SEO score ≥90
  - Expected: Meta tags, semantic HTML, mobile-friendly
  - Acceptance: Green score

### Page Load Performance (P0)

- [ ] **Test 6.5**: Page load time on Fast 4G (<3s)
  - Tool: Chrome DevTools Network throttling
  - Expected: Full page load <3 seconds
  - Acceptance: Time to Interactive <3s

- [ ] **Test 6.6**: Page load time on Slow 3G (<5s)
  - Expected: Full page load <5 seconds
  - Acceptance: Critical content visible <2s

- [ ] **Test 6.7**: Time to Interactive (TTI) <5s
  - Tool: Lighthouse TTI metric
  - Expected: TTI <5 seconds
  - Acceptance: App interactive quickly

### Bundle Size Optimization (P1)

- [ ] **Test 6.8**: JavaScript bundle size
  - Tool: Webpack Bundle Analyzer or browser DevTools
  - Expected: Total JS <200KB gzipped
  - Acceptance: No duplicate libraries, tree-shaking applied

- [ ] **Test 6.9**: CSS bundle size
  - Expected: Total CSS <50KB gzipped
  - Acceptance: Unused CSS removed, minified

- [ ] **Test 6.10**: Image optimization
  - Expected: All images optimized, modern formats (WebP)
  - Acceptance: Images <100KB each

### Lazy Loading (P2)

- [ ] **Test 6.11**: Lazy load non-critical resources
  - Expected: Below-fold content loads after initial render
  - Acceptance: Faster First Contentful Paint

- [ ] **Test 6.12**: Code splitting for modules
  - Expected: Dynamic imports for large modules
  - Acceptance: Smaller initial bundle

### Database Performance (P1)

- [ ] **Test 6.13**: Redis command database load time
  - Expected: Command data loads <100ms
  - Acceptance: No blocking during page load

- [ ] **Test 6.14**: Category lookup optimization
  - Expected: O(1) command → categories lookup
  - Acceptance: Fast category display

### Runtime Performance (P0)

- [ ] **Test 6.15**: UI responsiveness during heavy operations
  - Test: Parse 100+ term rule, render 1000+ buttons
  - Expected: No UI freezing, <16ms frame time
  - Acceptance: Smooth animations, no jank

---

## 7. Data Persistence & State Management

**Priority**: P0 (Critical)
**Objective**: Reliable data storage and state synchronization.

### localStorage (P0)

- [ ] **Test 7.1**: Save ACL rule to history
  - Action: Submit 5 different ACL rules
  - Expected: All saved to localStorage, displayed in "Saved Rules"
  - Acceptance: Rules persist after refresh

- [ ] **Test 7.2**: Load saved rule from history
  - Action: Click on saved rule
  - Expected: Rule loaded into editor and parsed
  - Acceptance: UI updates correctly

- [ ] **Test 7.3**: localStorage quota handling
  - Action: Save 1000+ rules to exceed quota
  - Expected: Graceful error message or auto-cleanup old rules
  - Acceptance: App doesn't crash

- [ ] **Test 7.4**: Theme preference persistence
  - Action: Toggle to dark mode, refresh page
  - Expected: Dark mode persists
  - Acceptance: Theme preference in localStorage

- [ ] **Test 7.5**: Panel layout persistence
  - Action: Reorder panels, resize containers, refresh
  - Expected: Layout persists
  - Acceptance: Positions restored correctly

### State Synchronization (P0)

- [ ] **Test 7.6**: Textarea ↔ Interactive builder sync
  - Action: Type `+@read` in textarea, submit
  - Expected: Interactive builder updates (green @read button)
  - Acceptance: Bidirectional sync works

- [ ] **Test 7.7**: Version switching state update
  - Action: Load Redis 7 rule, switch to Redis 8
  - Expected: Command counts update, module commands visible
  - Acceptance: State fully synchronized

- [ ] **Test 7.8**: Submit Changes button visibility
  - Action: Edit textarea, check button appears
  - Expected: Button visible when uncommitted changes
  - Acceptance: Button hidden when in sync

### Browser Data Clearing (P1)

- [ ] **Test 7.9**: Clear localStorage recovery
  - Action: Clear browser data, reload app
  - Expected: App loads with default state, no errors
  - Acceptance: Graceful recovery

- [ ] **Test 7.10**: Corrupted localStorage handling
  - Action: Manually corrupt localStorage JSON
  - Expected: App detects corruption, resets to default
  - Acceptance: No runtime errors

### Rule History Management (P1)

- [ ] **Test 7.11**: Rule history limit (1000+ rules)
  - Action: Save 1500 rules
  - Expected: Oldest rules auto-deleted, limit enforced
  - Acceptance: Performance remains good

- [ ] **Test 7.12**: Duplicate rule detection
  - Action: Save same rule multiple times
  - Expected: Duplicates prevented or timestamped
  - Acceptance: Clean history list

### Export/Import (P2 - Future Feature?)

- [ ] **Test 7.13**: Export saved rules to JSON
  - Expected: Download JSON file with all saved rules
  - Acceptance: Valid JSON, all data included

- [ ] **Test 7.14**: Import rules from JSON
  - Expected: Upload JSON, rules loaded into history
  - Acceptance: Validation for file format

### Multi-Tab State (P2)

- [ ] **Test 7.15**: Multiple tabs state conflicts
  - Action: Open app in 2 tabs, edit different rules
  - Expected: localStorage updates, potential conflict warning
  - Acceptance: No data loss, predictable behavior

---

## 8. Edge Cases & Error Scenarios

**Priority**: P0 (Critical)
**Objective**: Robust error handling for unexpected inputs.

### Extreme Input Lengths (P0)

- [ ] **Test 8.1**: Very long ACL rule (500+ characters)
  - Input: `+@read +@write +@admin ... (repeated 100 times)`
  - Expected: App remains responsive, parsing completes
  - Acceptance: No UI freezing, error if too long

- [ ] **Test 8.2**: Extremely long command name (1000+ chars)
  - Input: `+verylongcommandname...` (1000 chars)
  - Expected: Graceful error: "Command name too long"
  - Acceptance: No crash, clear error message

- [ ] **Test 8.3**: Long key pattern (500+ chars)
  - Input: `~user:session:token:...` (500 chars)
  - Expected: Pattern accepted or limited
  - Acceptance: No performance degradation

### Unicode & Special Characters (P0)

- [ ] **Test 8.4**: Unicode in ACL rules
  - Input: `+😀 +@读 +命令`
  - Expected: Invalid token error or unicode support
  - Acceptance: Predictable behavior, no crash

- [ ] **Test 8.5**: Special characters in patterns
  - Input: `~key\n\r\t\0` (newlines, tabs, null bytes)
  - Expected: Characters escaped or rejected
  - Acceptance: No injection vulnerabilities

- [ ] **Test 8.6**: Emoji in command tester
  - Input: `GET 🔑`
  - Expected: Treated as invalid key name
  - Acceptance: Clear error message

### Network Failures (P0)

- [ ] **Test 8.7**: Offline mode behavior
  - Action: Disconnect network, try to parse ACL
  - Expected: Error message: "Network unavailable"
  - Acceptance: App remains usable, cached data accessible

- [ ] **Test 8.8**: API timeout handling
  - Action: Simulate slow API (5s+ response)
  - Expected: Timeout error after threshold (10s?)
  - Acceptance: Loading state, timeout message

- [ ] **Test 8.9**: Online → Offline transition
  - Action: Start online, disconnect during API call
  - Expected: Graceful failure, retry option
  - Acceptance: No infinite loading spinners

### Browser Behavior (P1)

- [ ] **Test 8.10**: Back/Forward button navigation
  - Action: Edit rule, navigate away, click Back
  - Expected: State restored or lost (depending on design)
  - Acceptance: Predictable behavior, no corruption

- [ ] **Test 8.11**: Browser autofill interference
  - Expected: Autofill doesn't trigger unwanted validations
  - Acceptance: User can use autofill normally

- [ ] **Test 8.12**: Browser print functionality
  - Action: Ctrl+P to print page
  - Expected: Print-friendly layout (no panels, clean rule)
  - Acceptance: Readable printout

### Rapid User Actions (P0)

- [ ] **Test 8.13**: Rapid version switching (spam click)
  - Action: Click Redis 7/8 toggle 20 times rapidly
  - Expected: State stabilizes, no race conditions
  - Acceptance: No crashes, final state consistent

- [ ] **Test 8.14**: Rapid button clicking
  - Action: Click grant/block buttons 50 times/second
  - Expected: Debounced updates, no double-processing
  - Acceptance: Final state reflects user intent

- [ ] **Test 8.15**: Concurrent rule submissions
  - Action: Submit rule while previous submission pending
  - Expected: Second submission queued or blocked
  - Acceptance: No conflicting updates

### Copy/Paste Malformed Text (P1)

- [ ] **Test 8.16**: Paste rich text (HTML) into textarea
  - Action: Copy HTML from webpage, paste into ACL editor
  - Expected: HTML stripped, plain text pasted
  - Acceptance: No formatting artifacts

- [ ] **Test 8.17**: Paste very large clipboard (10MB+)
  - Expected: Browser handles or clips large pastes
  - Acceptance: App doesn't freeze

### Null/Undefined Handling (P0)

- [ ] **Test 8.18**: Empty API responses
  - Scenario: Backend returns `{}` instead of expected structure
  - Expected: Graceful error handling, no null pointer exceptions
  - Acceptance: App displays error, doesn't crash

---

## 9. Docker & Deployment

**Priority**: P0 (Critical)
**Objective**: Reliable containerized deployment across architectures.

### Multi-Architecture Builds (P0)

- [ ] **Test 9.1**: AMD64 image build and run
  - Platform: linux/amd64
  - Expected: Image builds successfully, app starts
  - Acceptance: Health check passes, accessible on port 7380

- [ ] **Test 9.2**: ARM64 image build and run
  - Platform: linux/arm64 (Apple Silicon, Raspberry Pi)
  - Expected: Image builds, app runs natively
  - Acceptance: Performance comparable to AMD64

- [ ] **Test 9.3**: Image size optimization
  - Expected: Final image <150MB
  - Acceptance: Alpine base, multi-stage build

### Docker Health Checks (P0)

- [ ] **Test 9.4**: Health endpoint responds
  - Test: `curl http://localhost:7380/health`
  - Expected: 200 OK with `{"status": "healthy"}`
  - Acceptance: Health check defined in Dockerfile

- [ ] **Test 9.5**: Container restart on failure
  - Action: Kill app process inside container
  - Expected: Container restarts automatically (--restart unless-stopped)
  - Acceptance: App recovers without manual intervention

### Environment Configuration (P1)

- [ ] **Test 9.6**: PORT environment variable
  - Test: `docker run -e PORT=8080 -p 8080:8080 ...`
  - Expected: App binds to port 8080
  - Acceptance: Configurable port

- [ ] **Test 9.7**: REDIS_VERSION environment variable
  - Test: `docker run -e REDIS_VERSION=8 ...`
  - Expected: Default to Redis 8 on startup
  - Acceptance: Version preference configurable

- [ ] **Test 9.8**: DEBUG mode toggle
  - Test: `docker run -e DEBUG=true ...`
  - Expected: Verbose logging enabled
  - Acceptance: Debug logs visible in `docker logs`

### Volume Mounts (P2)

- [ ] **Test 9.9**: Persist saved rules with volume
  - Test: `docker run -v acl-data:/data ...`
  - Expected: Saved rules persist across container restarts
  - Acceptance: Data survives container removal

### Docker Compose (P1)

- [ ] **Test 9.10**: Docker Compose up
  - Command: `docker-compose up -d`
  - Expected: Container starts, accessible immediately
  - Acceptance: Single command deployment

- [ ] **Test 9.11**: Docker Compose down (cleanup)
  - Command: `docker-compose down`
  - Expected: Container stopped and removed cleanly
  - Acceptance: No orphaned containers

### Port Mapping (P1)

- [ ] **Test 9.12**: Custom port binding
  - Test: `-p 9000:7380`
  - Expected: App accessible on host port 9000
  - Acceptance: Flexible port mapping

- [ ] **Test 9.13**: Port conflict handling
  - Test: Start two containers on same port
  - Expected: Second container fails with clear error
  - Acceptance: Error message indicates port conflict

### Resource Limits (P1)

- [ ] **Test 9.14**: CPU limit (--cpus=1)
  - Expected: Container respects CPU limit
  - Acceptance: App remains responsive under limit

- [ ] **Test 9.15**: Memory limit (--memory=512m)
  - Expected: Container stays under memory limit
  - Acceptance: No OOM kills under normal load

### CI/CD Pipeline (P0)

- [ ] **Test 9.16**: GitHub Actions build workflow
  - Trigger: Push git tag `v2.0.x` (without `-desktop` or `-docs` suffix)
  - Expected: Multi-arch build, push to Docker Hub, CVE scan
  - Acceptance: Automated build succeeds, images published

---

## 10. Electron Desktop App Testing

**Priority**: P0 (Critical)
**Objective**: Ensure Electron desktop app stability, performance, and platform
compatibility.

### macOS Desktop App (P0)

- [ ] **Test 10.1**: macOS DMG installer (Intel x64)
  - Platform: macOS 12+ (Monterey, Ventura, Sonoma)
  - Expected: DMG opens, app installs via drag-drop, launches successfully
  - Acceptance: App icon in Applications, opens without Gatekeeper issues

- [ ] **Test 10.2**: macOS DMG installer (Apple Silicon arm64)
  - Platform: macOS 12+ on M1/M2/M3 Macs
  - Expected: Native arm64 performance, no Rosetta translation
  - Acceptance: Fast launch, native architecture confirmed

- [ ] **Test 10.3**: Code signing verification
  - Test: `codesign -dv --verbose=4 /Applications/Redis\ ACL\ Builder.app`
  - Expected: Valid signature, no warnings
  - Acceptance: App not flagged as "damaged" or "untrusted"

- [ ] **Test 10.4**: Notarization status (if implemented)
  - Test: `spctl -a -vv /Applications/Redis\ ACL\ Builder.app`
  - Expected: Notarized by Apple, passes Gatekeeper
  - Acceptance: No security warnings on first launch

- [ ] **Test 10.5**: App bundle structure
  - Test: Verify icns icon, Info.plist metadata, entitlements
  - Expected: Proper macOS app bundle structure
  - Acceptance: App displays correctly in Finder, Dock, Launchpad

### Windows Desktop App (P1 - Future)

- [ ] **Test 10.6**: Windows installer (.exe)
  - Platform: Windows 10/11 (x64)
  - Expected: NSIS/Squirrel installer, Start Menu shortcut
  - Acceptance: Clean install, uninstall, no registry issues

- [ ] **Test 10.7**: Windows portable (.zip)
  - Expected: Extract and run without installation
  - Acceptance: Fully portable, no admin rights required

- [ ] **Test 10.8**: Windows certificate signing (if implemented)
  - Expected: Signed binary, no SmartScreen warnings
  - Acceptance: Users trust the installer

### Linux Desktop App (P1 - Future)

- [ ] **Test 10.9**: Linux AppImage (x64)
  - Platform: Ubuntu 20.04+, Fedora 38+
  - Expected: Single-file executable, no dependencies
  - Acceptance: Runs on major distributions

- [ ] **Test 10.10**: Linux Snap package (if implemented)
  - Expected: Snap install, sandboxed execution
  - Acceptance: Works on Ubuntu, other Snap-supported distros

- [ ] **Test 10.11**: Linux .deb package (Debian/Ubuntu)
  - Expected: apt installable package
  - Acceptance: Integrates with system package manager

### Electron App Functionality (P0)

- [ ] **Test 10.12**: Menu bar functionality
  - Test: File, Edit, View, Window, Help menus
  - Expected: All menu items work, keyboard shortcuts functional
  - Acceptance: macOS menu bar integration correct

- [ ] **Test 10.13**: Window state persistence
  - Action: Resize window, move position, close, reopen
  - Expected: Window remembers size and position
  - Acceptance: State persists across launches

- [ ] **Test 10.14**: Dark mode system integration
  - Action: Toggle macOS dark mode
  - Expected: App theme follows system preference
  - Acceptance: Seamless theme switching

- [ ] **Test 10.15**: Fullscreen mode
  - Test: View → Enter Full Screen (macOS native fullscreen)
  - Expected: Smooth fullscreen transition
  - Acceptance: Exit fullscreen works correctly

- [ ] **Test 10.16**: App updates (if auto-update implemented)
  - Expected: Check for updates, download, install seamlessly
  - Acceptance: No data loss during updates

### Electron Performance (P0)

- [ ] **Test 10.17**: Cold start time
  - Expected: App launches in <3 seconds on modern hardware
  - Acceptance: Reasonable startup time, no splash screen needed

- [ ] **Test 10.18**: Memory usage
  - Test: Monitor memory while running for 1 hour
  - Expected: Stable memory usage <200MB
  - Acceptance: No memory leaks, efficient resource use

- [ ] **Test 10.19**: CPU usage (idle)
  - Expected: <5% CPU when idle
  - Acceptance: App doesn't drain battery on laptops

- [ ] **Test 10.20**: App bundle size
  - Expected: Final .app or .dmg <150MB
  - Acceptance: Reasonable download size for users

---

## 11. Documentation & User Experience

**Priority**: P1 (Important)
**Objective**: Clear, accurate, helpful documentation.

### Documentation Accuracy (P1)

- [ ] **Test 11.1**: README.md quick start works
  - Test: Follow exact commands in README
  - Expected: App runs successfully within 5 minutes
  - Acceptance: No missing steps, no errors

- [ ] **Test 11.2**: Docker Hub description matches features
  - Expected: Description reflects current v2.0.x features
  - Acceptance: No outdated information

- [ ] **Test 11.3**: CLAUDE.md reflects current architecture
  - Expected: File structure, command counts, versions accurate
  - Acceptance: Developers can understand codebase

### Error Messages (P0)

- [ ] **Test 11.4**: Error messages are actionable
  - Test: Trigger 10 different error scenarios
  - Expected: Each error explains what went wrong + how to fix
  - Acceptance: Users can self-recover from errors

- [ ] **Test 11.5**: Error message consistency
  - Expected: All errors follow same format, tone
  - Acceptance: Professional, helpful, concise

### Tooltips & Help Text (P1)

- [ ] **Test 11.6**: Tooltip accuracy
  - Test: Hover over 20+ category buttons
  - Expected: Tooltips show correct command lists
  - Acceptance: No outdated or missing commands

- [ ] **Test 11.7**: Tooltip responsiveness
  - Expected: Tooltips appear within 500ms of hover
  - Acceptance: Smooth, no lag

- [ ] **Test 11.8**: Info page content accuracy
  - Expected: Info page reflects all current features
  - Acceptance: No placeholder text, complete information

### First-Time User Experience (P0)

- [ ] **Test 11.9**: New user onboarding
  - Test: Give app to someone unfamiliar, observe
  - Expected: User can create first ACL rule within 5 minutes
  - Acceptance: Intuitive UI, self-explanatory

- [ ] **Test 11.10**: Quick start examples work
  - Test: Click all preset examples
  - Expected: Each example loads and explains use case
  - Acceptance: Examples are pedagogically valuable

### Visual Consistency (P1)

- [ ] **Test 11.11**: Color scheme consistency
  - Expected: Same colors used for same states throughout
  - Acceptance: Brand colors consistent, no random variations

- [ ] **Test 11.12**: Typography consistency
  - Expected: Font families, sizes, weights consistent
  - Acceptance: Professional, readable hierarchy

---

## 12. Automated Testing Coverage

**Priority**: P0 (Critical)
**Objective**: Comprehensive automated test suite for CI/CD.

### Backend Test Coverage (P0)

- [ ] **Test 12.1**: Increase backend coverage 85% → 95%+
  - Focus: Edge cases in acl_parser.py, error paths
  - Expected: 95%+ line coverage, 90%+ branch coverage
  - Acceptance: Coverage report shows improvement

- [ ] **Test 12.2**: API endpoint integration tests
  - Expected: All 10 endpoints have integration tests
  - Acceptance: Tests cover success + error cases

### Frontend E2E Tests (P1)

- [ ] **Test 12.3**: Playwright/Cypress setup
  - Tool: Playwright (recommended for modern apps)
  - Expected: E2E framework installed, basic test passing
  - Acceptance: Can run `npm test` for E2E tests

- [ ] **Test 12.4**: Critical user flows covered
  - Tests: Load app → edit rule → submit → test command → save
  - Expected: E2E tests pass consistently
  - Acceptance: 10+ E2E test scenarios

- [ ] **Test 12.5**: Visual regression testing
  - Tool: Percy, Chromatic, or Playwright screenshots
  - Expected: Visual diffs caught automatically
  - Acceptance: Screenshots compared on each PR

### Unit Tests (P1)

- [ ] **Test 12.6**: JavaScript module unit tests
  - Framework: Jest or Vitest
  - Expected: 80%+ coverage for JS modules
  - Acceptance: All core functions have unit tests

- [ ] **Test 12.7**: CSS regression tests
  - Tool: BackstopJS or visual regression
  - Expected: UI changes flagged for review
  - Acceptance: Prevents accidental style breaks

### CI/CD Integration (P0)

- [ ] **Test 12.8**: Tests run on every PR
  - Expected: GitHub Actions runs full test suite
  - Acceptance: PRs blocked if tests fail

- [ ] **Test 12.9**: Coverage reports in PRs
  - Tool: Codecov or Coveralls
  - Expected: Coverage diff shown in PR comments
  - Acceptance: Declining coverage flagged

### Performance Benchmarks (P2)

- [ ] **Test 12.10**: Automated Lighthouse CI
  - Tool: Lighthouse CI
  - Expected: Performance regression detection
  - Acceptance: PRs flagged if Lighthouse score drops >5 points

---

## 13. Production Readiness

**Priority**: P0 (Critical)
**Objective**: Production-grade configuration and operational excellence.

### Gunicorn Configuration (P0)

- [ ] **Test 13.1**: Worker count optimization
  - Test: Load test with 1, 2, 4, 8 workers
  - Expected: Optimal worker count determined (likely 4)
  - Acceptance: Documented in deployment guide

- [ ] **Test 13.2**: Worker timeout tuning
  - Expected: Timeout set to 30s for slow requests
  - Acceptance: No premature worker kills

- [ ] **Test 13.3**: Worker restart on failure
  - Action: Crash a worker (raise exception)
  - Expected: Gunicorn restarts worker automatically
  - Acceptance: Other workers unaffected, no downtime

### Logging & Monitoring (P1)

- [ ] **Test 13.4**: Production logging configuration
  - Expected: INFO level logs in production, DEBUG disabled
  - Acceptance: No sensitive data in logs

- [ ] **Test 13.5**: Log rotation (if persistent logs)
  - Expected: Logs rotated daily, compressed, limited retention
  - Acceptance: Disk space managed

- [ ] **Test 13.6**: Health check endpoint
  - Endpoint: `GET /health`
  - Expected: Returns 200 OK with app version, uptime
  - Acceptance: Can be used by load balancers

### HTTPS/TLS Support (P1)

- [ ] **Test 13.7**: HTTPS documentation
  - Expected: Guide for using Nginx/Traefik reverse proxy
  - Acceptance: Users can deploy with TLS easily

- [ ] **Test 13.8**: HSTS header recommendation
  - Expected: Security headers documented
  - Acceptance: Best practices included

### Reverse Proxy Setup (P1)

- [ ] **Test 13.9**: Nginx reverse proxy guide
  - Expected: Sample nginx.conf provided
  - Acceptance: Copy-paste config works

- [ ] **Test 13.10**: Traefik reverse proxy guide
  - Expected: Docker Compose with Traefik + app
  - Acceptance: Automatic HTTPS with Let's Encrypt

### Monitoring & Observability (P2)

- [ ] **Test 13.11**: Prometheus metrics endpoint
  - Endpoint: `GET /metrics`
  - Expected: Prometheus-compatible metrics (requests, latency, errors)
  - Acceptance: Can be scraped by Prometheus

- [ ] **Test 13.12**: Grafana dashboard template
  - Expected: Pre-built dashboard JSON
  - Acceptance: Instant visualization of app metrics

---

## Testing Methodology

### Test Execution Priority

1. **Phase 1 - Core Functionality** (P0 tests)
   - Backend API (1.1-1.7)
   - Browser compatibility (2.1-2.7)
   - Responsive mobile (3.9-3.12, 3.15-3.18)
   - Security (5.1-5.3, 5.6-5.7)
   - Performance (6.1-6.7, 6.15)
   - Persistence (7.1-7.8)
   - Docker deployment (9.1-9.5, 9.16)

2. **Phase 2 - Advanced Features** (P1 tests)
   - Load testing (1.8-1.9)
   - Tablet responsive (3.1-3.8)
   - Accessibility (4.1-4.11, 4.15-4.16)
   - Network failures (8.7-8.9)
   - Documentation (10.1-10.12)

3. **Phase 3 - Polish** (P2 tests)
   - Edge cases (8.10-8.18)
   - Export/import (7.13-7.14)
   - Monitoring (12.11-12.12)

### Bug Severity Levels

- **P0 (Blocker)**: Prevents core functionality, must fix before GA
- **P1 (Critical)**: Major feature broken, fix before GA if possible
- **P2 (Major)**: Workaround exists, fix in patch release
- **P3 (Minor)**: Cosmetic issue, can defer to future release

### Testing Tools

- **Backend**: pytest, coverage.py, Locust (load testing)
- **Frontend**: Playwright (E2E), Lighthouse CI, WAVE (accessibility)
- **Security**: Docker Scout, OWASP ZAP, Snyk
- **Performance**: Chrome DevTools, WebPageTest
- **CI/CD**: GitHub Actions, Codecov

---

## Acceptance Criteria for GA Release

### Must-Have (Blockers)

- [ ] **Zero P0 bugs** from this test plan
- [ ] **Backend test coverage ≥95%**
- [ ] **All critical browsers tested** (Chrome, Firefox, Safari, Edge latest)
- [ ] **Mobile responsive verified** (iPhone, iPad tested)
- [ ] **Accessibility WCAG 2.1 AA** (Lighthouse score ≥95)
- [ ] **Security vulnerabilities addressed** (0 Critical, 0 High CVEs)
- [ ] **Performance targets met** (Lighthouse ≥90, page load <3s)
- [ ] **Docker deployment working** (multi-arch builds, health checks)
- [ ] **Electron desktop app working** (macOS DMG installer, code signed)
- [ ] **Documentation complete** (README, Docker Hub, API docs, Electron build
docs)

### Nice-to-Have (Can defer)

- [ ] P1 bugs triaged and documented
- [ ] Frontend E2E test suite (10+ tests)
- [ ] Visual regression testing setup
- [ ] Monitoring/observability (Prometheus, Grafana)

---

## Version History

- **v2.0.x** (Planned GA Release) - Web + Electron desktop app, comprehensive
testing
- **v2.0.1-alpha** - Smart version tag strategy, Electron DMG installer
- **v2.0.0-alpha** - Complete Electron desktop app implementation
- **v1.27.0-beta** - Monorepo restructure for web + desktop support

---

## Contributing to Testing

To add new test cases:

1. Identify the category (Backend, Security, etc.)
2. Assign priority (P0/P1/P2)
3. Write clear test description with expected outcome
4. Add acceptance criteria (objective pass/fail)
5. Update test completion percentage

Format:

```markdown
- [ ] **Test X.Y**: Brief description
  - Input/Action: What to do
  - Expected: What should happen
  - Acceptance: How to verify success
```
