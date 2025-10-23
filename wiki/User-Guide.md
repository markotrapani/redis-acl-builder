# User Guide

Comprehensive guide to using Redis ACL Builder features.

---

## Table of Contents

- [ACL Rule Syntax](#acl-rule-syntax)
- [Interactive Builder](#interactive-builder)
- [Command Testing](#command-testing)
- [Keyspace Testing](#keyspace-testing)
- [Optimization Engine](#optimization-engine)
- [Advanced Features](#advanced-features)

---

## ACL Rule Syntax

### User Control

- `on` - Enable user
- `off` - Disable user
- `reset` - Reset user to default state

### Password Management

- `>password` - Add password
- `<password` - Remove password
- `nopass` - Allow passwordless authentication

### Command Permissions

#### Category-Based

- `+@category` - Grant all commands in category
- `-@category` - Deny all commands in category
- `+@all` - Grant all commands
- `-@all` - Deny all commands

**Common Categories:**

| Category | Description | Example Commands |
|----------|-------------|------------------|
| `@read` | Read operations | GET, MGET, HGETALL, LRANGE |
| `@write` | Write operations | SET, DEL, HSET, LPUSH |
| `@admin` | Administrative | CONFIG, CLIENT, SHUTDOWN |
| `@dangerous` | Dangerous ops | FLUSHDB, FLUSHALL, KEYS |
| `@fast` | Fast commands | GET, SET, INCR, DECR |
| `@slow` | Slow commands | KEYS, SORT, MIGRATE |
| `@string` | String operations | GET, SET, APPEND, STRLEN |
| `@hash` | Hash operations | HSET, HGET, HDEL, HGETALL |
| `@list` | List operations | LPUSH, RPOP, LRANGE |
| `@set` | Set operations | SADD, SREM, SMEMBERS |
| `@sortedset` | Sorted set ops | ZADD, ZREM, ZRANGE |
| `@geo` | Geospatial | GEOADD, GEORADIUS |
| `@hyperloglog` | HyperLogLog | PFADD, PFCOUNT, PFMERGE |

#### Command-Specific

- `+command` - Grant specific command (e.g., `+get`)
- `-command` - Deny specific command (e.g., `-flushdb`)

### Key Patterns

Basic pattern matching:

- `~pattern` - Allow keys matching glob pattern
- `~*` - Allow all keys
- `~user:*` - Allow keys starting with "user:"
- `~cache:*` - Allow keys starting with "cache:"

Advanced key permissions (Redis 7.0+):

- `%R~pattern` - Read-only access to pattern
- `%W~pattern` - Write-only access to pattern  
- `%RW~pattern` - Read-write access (alias for `~pattern`)

**Glob Pattern Syntax:**

| Pattern | Meaning | Example | Matches |
|---------|---------|---------|---------|
| `*` | Any characters | `user:*` | user:123, user:abc |
| `?` | Single character | `user:?` | user:a, user:1 |
| `[abc]` | Any of a, b, c | `key:[abc]` | key:a, key:b, key:c |
| `[a-z]` | Range | `key:[a-z]` | key:a, key:m, key:z |
| `[^abc]` | Not a, b, c | `key:[^abc]` | key:d, key:e, key:1 |

### Channel Patterns

For Pub/Sub permissions:

- `&channel` - Allow publishing to channel
- `&pattern*` - Allow pattern-based channels

### Rule Selectors (Redis 7.0+)

Multiple permission sets in one user:

```acl
(+@read ~cache:*) (+@write ~data:*)
```

This allows:

- Read operations on cache keys OR
- Write operations on data keys

Selectors use **OR logic** - command is granted if ANY selector permits it.

---

## Interactive Builder

### Three-Column Layout

**Left Column - ACL Rule Configuration:**

- Text editor for manual rule entry
- Quick examples dropdown with presets
- Submit Changes button (appears when manually editing)
- Real-time validation with error messages

**Center Column - Blocked Commands:**

- Categories and commands currently blocked
- Click to grant (moves to Granted column)
- Collapsible category sections
- Search/filter functionality

**Right Column - Granted Commands:**

- Categories and commands currently allowed
- Click to revoke (moves to Blocked column)
- Shows explicit and implicit grants
- Partial category indicators (⚠️)

### Using the Interactive Builder

#### Method 1: Click to Build

1. Find a category/command in Blocked Commands
2. Click it to grant access
3. Rule updates automatically
4. No Submit button needed

#### Method 2: Manual Editing

1. Type your ACL rule in the text area
2. Submit Changes button appears
3. Click Submit or press Enter
4. Columns update to show results

### Category States

**Fully Granted (✅):**

- All commands in category are allowed
- Shows in Granted Commands column
- Green indicator

**Fully Blocked (❌):**

- All commands in category are denied
- Shows in Blocked Commands column
- Red indicator

**Partially Granted (⚠️):**

- Some commands allowed, some blocked
- Shows in BOTH columns with yellow indicator
- Click in Blocked to grant remaining
- Click in Granted to revoke all

### Search and Filter

Each column has independent search:

**Toggle Search Mode:**

- 🔍 Fuzzy Search - Finds partial matches
- 🎯 Exact Search - Exact matches only

**Search Examples:**

- "hash" - Finds all hash-related commands
- "get" - Finds GET, GETSET, HGET, etc.
- "zadd" - Finds exact ZADD command

**Clear Search:**

- Click X button or clear input
- Restores full command list

---

## Command Testing

### Command Tester Interface

Located in bottom panel - tests if specific commands are allowed.

**How to Use:**

1. Enter command name (e.g., `GET`, `SET`, `HGETALL`)
2. Click "Check Command" or press Enter
3. View result:
   - ✅ **Allowed** - Command is granted
   - ❌ **Denied** - Command is blocked
4. See detailed reason (which rule granted/denied)

**Redis Subcommands:**

Use pipe character for subcommands:

- `CLIENT|LIST` - CLIENT LIST command
- `CONFIG|GET` - CONFIG GET command
- `CLUSTER|INFO` - CLUSTER INFO command

**Test Results Show:**

- Grant/deny status
- Matching rule that caused the decision
- Which categories the command belongs to
- Detailed explanation

---

## Keyspace Testing

### Keyspace Tester Interface

Tests if key names match allowed patterns.

**How to Use:**

1. Enter key name (e.g., `user:123`, `cache:abc`)
2. Click "Check Key Name"
3. View result:
   - ✅ **Allowed** - Key matches allowed pattern
   - ❌ **Denied** - Key doesn't match any pattern

**Pattern Matching:**

Tests against all key patterns in your ACL rule:

```acl
+@read ~user:* ~cache:*
```

- `user:123` → ✅ Matches `~user:*`
- `cache:data` → ✅ Matches `~cache:*`
- `admin:settings` → ❌ No match

**Glob Patterns Supported:**

- `*` - Wildcard (any characters)
- `?` - Single character
- `[abc]` - Character set
- `[a-z]` - Character range
- `[^abc]` - Negation

---

## Optimization Engine

### Automatic Optimization

For button-built rules, Redis ACL Builder automatically suggests
optimizations.

**Detection:**

- Monitors granted commands
- Checks if all commands in a category are granted
- Suggests using `+@category` instead

**Example:**

```text
Before: +pfadd +pfcount +pfmerge
After:  +@hyperloglog (saves 2 terms!)
```

**When Shown:**

- Auto-applied for button-built rules
- Shown as suggestions for manually-typed rules
- Dismissible with X button

### Optimization Strategies

**1. Pure Category:**

- All commands granted → `+@category`

**2. Category with Exclusions:**

- Most commands granted → `+@category -cmd1 -cmd2`

**3. Individual Commands:**

- Few commands → Keep as individual grants

**4. Multi-Category Cover:**

- Commands span multiple categories → Best combination

### Manual Optimization

**Apply Suggestion:**

1. See optimization notification
2. Review suggested rule
3. Click "Apply" or edit manually
4. Optimized rule replaces current

**Dismiss Suggestion:**

- Click X button
- Suggestion removed (won't show again for this rule)

---

## Advanced Features

### Panel Resizing

**Resize Three-Column Container:**

1. Hover over corners (cursor changes)
2. Drag to resize width/height
3. Dimensions saved automatically
4. Restored on reload

**Edge Resizing:**

- Drag left/right edges for width
- Drag top/bottom edges for height
- Corner indicators show resize zones

### Panel Reordering

**Drag to Reorder:**

1. Click drag handle (⋮⋮) on panel header
2. Drag panel up/down
3. Drop in new position
4. Order saved automatically

**Applies to:**

- Three-column panels
- Testing sections (Command/Keyspace/Integrated Testers)

### Testing Section Modes

**Integrated Mode:**

- Single tester with command + key fields
- Tests both command AND key access
- Compact, space-efficient

**Split Mode:**

- Separate Command and Keyspace testers
- Test each independently
- More detailed results

**Toggle Modes:**

- Click link/unlink button
- Mode preference saved
- Survives page reloads

### Theme Switching

**Light/Dark Mode:**

- Click ☀️/🌙 button (top right)
- Theme applied instantly
- Saved to localStorage
- System preference detection

**Theme Features:**

- Full color scheme change
- Optimized contrast for readability
- Smooth transitions
- Persistent across sessions

### Redis Version Switching

**Toggle Redis 7 / Redis 8:**

- Click version buttons at top
- Command set updates immediately
- ACL rule re-evaluated
- Results refresh

**Differences:**

- **Redis 7:** 379 commands, 21 categories
- **Redis 8:** 488 commands, 29 categories (includes modules)

**Modules in Redis 8:**

- RediSearch (38 commands)
- RedisJSON (25 commands)
- TimeSeries (17 commands)
- Bloom Filters (11 commands)
- And more...

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Submit ACL rule changes |
| `Escape` | Clear search / dismiss popups |

---

## Tips and Best Practices

### 1. Start with Presets

Use Quick Examples as starting points, then customize.

### 2. Test Thoroughly

Always test both allowed and blocked commands before deploying to production.

### 3. Use Categories

Prefer `+@category` over individual commands for maintainability.

### 4. Block Dangerous Commands

Always include `-@dangerous` for application users.

### 5. Principle of Least Privilege

Grant only the minimum permissions needed.

### 6. Key Pattern Safety

Be specific with key patterns - avoid `~*` in production unless necessary.

### 7. Redis Enterprise Compatibility

Remember that Redis Enterprise blocks certain OSS commands (CLUSTER, MODULE,
etc.)

### 8. Version Testing

Test your ACL rules on both Redis 7 and Redis 8 if you use both.

---

## Next Steps

- [API Reference](./API-Reference) - Use the REST API
- [Development](./Development) - Contribute to the project
- [Troubleshooting](./Troubleshooting) - Common issues
- [FAQ](./FAQ) - Frequently asked questions

---

**Need help?** Visit [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)!
