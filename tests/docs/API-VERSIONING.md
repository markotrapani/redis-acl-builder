# Redis ACL Builder - API Versioning Strategy

**Current Stable Version**: v1

**Last Updated**: 2025-10-08

**Status**: Production Ready (GA)

---

## Overview

Redis ACL Builder provides a stable, production-ready REST API for parsing,
validating, and testing Redis ACL rules. This document outlines our versioning
strategy, stability guarantees, and deprecation policy.

---

## Current Version: v1 (Stable)

### Endpoint Prefix

- **Current endpoints**: `/api/*` (implies v1)
- **Future versions**: `/api/v2/*`, `/api/v3/*`, etc.
- **Version-agnostic**: `/health` (no versioning, always stable)

### Stability Guarantee

All v1 endpoints maintain **strict backward compatibility**:

- ✅ **Additive changes only** - New optional fields, new endpoints
- ❌ **No breaking changes** - No field removals, renames, or structure changes
- ✅ **Response format stability** - JSON structure remains consistent
- ✅ **Request validation stability** - Required fields never change

---

## Version Support Policy

### Support Lifecycle

- **Current version (v1)**: ✅ Fully supported, production-ready
- **Previous versions**: N/A (v1 is first stable GA release)
- **Future versions**: Will coexist with v1 for minimum 12 months

### Deprecation Policy

1. **Announcement**: Minimum 6 months notice before deprecation
2. **Warning headers**: Deprecated endpoints return `X-API-Deprecated: true` header
3. **Migration guide**: Detailed guide for moving to new version
4. **Overlap period**: Old and new versions coexist for minimum 12 months
5. **Removal**: Only after deprecation period + migration support

### Deprecation Timeline Example

```text
v2 Released (Jan 2026)
    ↓
v1 Deprecation Announced (Jan 2026)
    ↓
6-month notice period
    ↓
v1 Deprecated but functional (Jul 2026)
    ↓
12-month overlap period
    ↓
v1 Removal (Jul 2027)
```

---

## Semantic Versioning for API Responses

### Non-Breaking Changes (Patch/Minor)

These changes **do NOT require** a new API version:

✅ **Adding new optional request fields**

```json
// Before
{"rule": "+@read", "version": "redis8"}

// After (backward compatible)
{"rule": "+@read", "version": "redis8", "optimize": true}  // New optional field
```

✅ **Adding new response fields**

```json
// Before
{"granted_commands": [...], "blocked_commands": [...]}

// After (backward compatible)
{"granted_commands": [...], "blocked_commands": [...], "optimization_hint": "..."}
```

✅ **Adding new endpoints**

- `/api/export-rule` (new endpoint, doesn't affect existing endpoints)

✅ **Expanding enums/allowed values**

- Adding "redis9" to version field (doesn't break "redis7" or "redis8")

### Breaking Changes (Major)

These changes **DO require** a new API version (v2):

❌ **Removing or renaming fields**

```json
// v1
{"granted_commands": [...]}

// v2 - BREAKING (field renamed)
{"allowed_commands": [...]}
```

❌ **Changing response structure**

```json
// v1
{"granted_commands": ["get", "set"]}

// v2 - BREAKING (structure changed)
{"commands": {"granted": ["get", "set"], "blocked": [...]}}
```

❌ **Removing or renaming required request fields**

```json
// v1
POST /api/parse
{"rule": "+@read"}

// v2 - BREAKING (field renamed)
POST /api/v2/parse
{"acl_rule": "+@read"}
```

❌ **Changing HTTP status codes**

- v1 returns 400 for validation errors
- v2 returns 422 - BREAKING change

❌ **Removing endpoints**

- Requires deprecation process and minimum 18-month notice

---

## Current API Endpoints (v1 - Stable)

All endpoints under `/api/*` are **stable and production-ready**:

### Core ACL Parsing

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/parse` | POST | ✅ Stable | Parse ACL & return permissions |
| `/api/validate-rule` | POST | ✅ Stable | Validate ACL syntax only |
| `/api/optimize-rule` | POST | ✅ Stable | Suggest optimized ACL rules |
| `/api/analyze-redundancy` | POST | ✅ Stable | Detect redundant ACL patterns |

### Command Testing

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/test-command` | POST | ✅ Stable | Test if command allowed |
| `/api/test-command-key` | POST | ✅ Stable | Test command + key access |

### Command Information

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/command-info` | POST | ✅ Stable | Get command categories |
| `/api/categories` | GET | ✅ Stable | List Redis categories |
| `/api/search-commands` | POST | ✅ Stable | Search commands by pattern |

### Health & Monitoring

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/health` | GET | ✅ Stable | Health check (version-agnostic) |

---

## Request/Response Contracts

### Standard Request Model

All POST endpoints follow Pydantic validation:

```json
{
  "rule": "string (required)",
  "version": "redis7 | redis8 (default: redis8)",
  // Endpoint-specific fields...
}
```

### Standard Response Model (Success)

```json
{
  "success": true,
  "version": "redis8",
  // Endpoint-specific data...
}
```

### Standard Error Response

```json
{
  "error": true,
  "message": "Human-readable error message",
  "status_code": 400
}
```

### HTTP Status Codes

- **200 OK**: Successful request
- **400 Bad Request**: Validation error, malformed JSON, invalid ACL syntax
- **404 Not Found**: Endpoint doesn't exist
- **500 Internal Server Error**: Server-side error (bug)

---

## Version Migration Guide

### When v2 is Released (Future)

#### Strategy 1: Dual Support (Recommended)

Run both v1 and v2 endpoints simultaneously:

```python
# v1 endpoints (backward compatible)
@app.route('/api/parse', methods=['POST'])
def api_parse_v1():
    # Original implementation
    pass

# v2 endpoints (new features)
@app.route('/api/v2/parse', methods=['POST'])
def api_parse_v2():
    # New implementation
    pass
```

#### Strategy 2: Version Header

Alternative: Use `X-API-Version` header instead of URL prefix:

```bash
# v1
curl -H "X-API-Version: 1" POST /api/parse

# v2
curl -H "X-API-Version: 2" POST /api/parse
```

---

## API Stability Examples

### ✅ Example 1: Adding Optimization Hint (Non-Breaking)

**v1.25.0** - Original response:

```json
{
  "granted_commands": ["get", "set", "append"],
  "blocked_commands": [...],
  "success": true
}
```

**v1.26.0** - Added optimization hint (backward compatible):

```json
{
  "granted_commands": ["get", "set", "append"],
  "blocked_commands": [...],
  "success": true,
  "optimization_hint": "+@string would be shorter"  // NEW FIELD
}
```

✅ **Impact**: Existing integrations continue to work. New integrations can
use the hint.

---

### ❌ Example 2: Restructuring Response (Breaking - Requires v2)

**v1** - Current structure:

```json
{
  "granted_commands": ["get", "set"],
  "blocked_commands": ["del", "flushdb"]
}
```

**v2** - Hypothetical restructure (would be BREAKING):

```json
{
  "permissions": {
    "allowed": ["get", "set"],
    "denied": ["del", "flushdb"]
  }
}
```

❌ **Impact**: Existing integrations break. Requires new API version.

---

## Breaking Change Checklist

Before making any API change, check:

- [ ] Does this remove or rename a response field? → **Breaking**
- [ ] Does this change the response structure? → **Breaking**
- [ ] Does this remove or rename a required request field? → **Breaking**
- [ ] Does this change HTTP status codes? → **Breaking**
- [ ] Does this remove an endpoint? → **Breaking**
- [ ] Does this add a new optional field? → **Non-breaking**
- [ ] Does this add a new endpoint? → **Non-breaking**
- [ ] Does this improve error messages? → **Non-breaking**

---

## Integration Best Practices

### For API Consumers

1. **Pin to specific version** (when available):

   ```python
   API_BASE = "https://acl-builder.example.com/api/v1"
   ```

2. **Ignore unknown fields** (forward compatibility):

   ```python
   response = requests.post(f"{API_BASE}/parse", json=payload).json()
   granted_commands = response.get("granted_commands", [])
   # Ignore new fields you don't recognize
   ```

3. **Check success/error flags**:

   ```python
   if response.get("error"):
       handle_error(response["message"])
   ```

4. **Handle HTTP errors gracefully**:

   ```python
   try:
       response.raise_for_status()
   except requests.HTTPError as e:
       # Handle 400, 500, etc.
   ```

5. **Monitor deprecation headers**:

   ```python
   if "X-API-Deprecated" in response.headers:
       logger.warning("API endpoint is deprecated, migrate soon!")
   ```

---

## Future Version Planning (Hypothetical)

### Potential v2 Changes (Not Committed)

These are **examples only** of what might warrant v2:

- **Restructured responses**: Nested permission objects
- **Selector-aware parsing**: Breaking change to command permission logic
- **Multi-ACL support**: Parse multiple ACL rules simultaneously
- **Redis 9 support**: If Redis 9 has breaking ACL changes

**Note**: v2 is not currently planned. v1 is stable and sufficient for all
current use cases.

---

## Questions & Support

### How do I know which version I'm using?

All responses include `"version": "redis8"` field. For API version, check the
URL prefix:

- `/api/*` → v1 (current stable)
- `/api/v2/*` → v2 (when released)

### What if I find a bug in the API?

- **Bug fixes are non-breaking** and released immediately
- File issue at: <https://github.com/anthropics/redis-acl-builder/issues>
- Security issues: Email maintainer directly

### Can I request a new endpoint?

Yes! Feature requests are welcome. New endpoints are **non-breaking** and can
be added to v1.

### How long will v1 be supported?

**Minimum 12 months** after v2 is released (if v2 ever happens). Currently,
v1 is the only version and indefinitely supported.

---

## Version History

| Version | Release Date | Status | Notes |
|---------|--------------|--------|-------|
| v1.0 | 2025-10-08 | ✅ **Current** | Initial GA, 10 endpoints |
| v0.x | 2024-2025 | 🏁 Beta | Pre-release versions |

---

## Changelog Policy

All API changes are documented in:

- **CHANGELOG.md** - High-level feature changes
- **API-VERSIONING.md** (this file) - API-specific changes
- **GitHub Releases** - Tagged releases with migration notes

### Changelog Categories

- **Added**: New endpoints, new fields (non-breaking)
- **Changed**: Behavior changes, performance improvements
- **Deprecated**: Endpoints/fields scheduled for removal
- **Removed**: Endpoints/fields removed (only in new major version)
- **Fixed**: Bug fixes (non-breaking)
- **Security**: Security patches (non-breaking)

---

## Contact

- **Maintainer**: <marko.trapani@redis.com>
- **Issues**: <https://github.com/anthropics/redis-acl-builder/issues>
- **Documentation**: <https://github.com/anthropics/redis-acl-builder/blob/main/README.md>

---

**Last Updated**: 2025-10-08

**Next Review**: 2026-01-01 (Quarterly review cycle)
