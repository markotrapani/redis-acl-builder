# Getting Started with Redis ACL Builder

This guide will help you create your first ACL rule and understand the basics
of using Redis ACL Builder.

---

## 📋 Prerequisites

Before you begin, make sure you have:

- ✅ Installed Redis ACL Builder ([Installation Guide](./Installation))
- ✅ Basic understanding of Redis (optional but helpful)
- ✅ Familiarity with access control concepts (optional)

---

## 🚀 Your First ACL Rule in 5 Minutes

### Step 1: Launch the Application

**Desktop App:**

- macOS: Open from Applications folder
- Windows: Launch from Start Menu
- Linux: Run `redis-acl-builder` or click desktop icon

**Docker/Web:**

- Navigate to `http://localhost:7380` in your browser

### Step 2: Understanding the Interface

The application has a **three-column layout**:

1. **Left Column - ACL Rule Configuration (📝)**
   - Text editor for manual ACL rule entry
   - Quick examples dropdown
   - Submit Changes button (appears when editing)

2. **Center Column - Blocked Commands (❌)**
   - Shows commands that are currently blocked
   - Click any category/command to grant it
   - Collapsible sections for categories

3. **Right Column - Granted Commands (✅)**
   - Shows commands that are currently allowed
   - Click any category/command to revoke it
   - Organized by categories and individual commands

**Top Section - Testing Interface:**

- **Command Tester** - Test specific Redis commands
- **Keyspace Tester** - Test key pattern access
- **Integrated Tester** - Combined command + key testing

### Step 3: Create a Read-Only User ACL

Let's create a simple read-only user that can only execute read commands.

1. **Select Redis Version:**
   - Click the "Redis Version" buttons at the top
   - Choose **Redis 7** for this tutorial

2. **Use a Quick Example:**
   - Click the "ACL Rule Presets" dropdown
   - Select "Read-Only"

3. **The rule appears in the text area:**

   ```acl
   +@read ~*
   ```

4. **Understanding the rule:**
   - `+@read` - Grant all commands in the @read category
   - `~*` - Allow access to all keys (pattern: *)

5. **View the results:**
   - **Blocked Commands** column shows all non-read commands (SET, DEL, etc.)
   - **Granted Commands** column shows all read commands (GET, MGET, etc.)

### Step 4: Test Your First Command

Now let's test if specific commands are allowed:

1. **Navigate to Command Tester** (bottom section)

2. **Test a read command:**
   - Enter `GET` in the command input
   - Click "Check Command"
   - Result: ✅ **Allowed** - "Command allowed by @read category"

3. **Test a write command:**
   - Enter `SET` in the command input
   - Click "Check Command"
   - Result: ❌ **Denied** - "Command not explicitly granted"

**Congratulations!** You've created and tested your first ACL rule! 🎉

---

## 🎯 Interactive Building

The real power of Redis ACL Builder is the **interactive three-column
interface**.

### Example: Creating a Custom Rule

Let's create a rule for an application user with specific permissions:

1. **Start with an empty rule** (clear the text area)

2. **Grant the @read category:**
   - Find `@read` in the Blocked Commands column
   - Click on it
   - It moves to the Granted Commands column
   - ACL rule updates to: `+@read`

3. **Grant the @write category:**
   - Find `@write` in the Blocked Commands column
   - Click on it
   - ACL rule updates to: `+@read +@write`

4. **Remove dangerous commands:**
   - Find `@dangerous` in the Granted Commands column (it's partially granted)
   - Click on it to add `-@dangerous`
   - ACL rule updates to: `+@read +@write -@dangerous`

5. **Your final rule:**

   ```acl
   +@read +@write -@dangerous ~*
   ```

   This rule:
   - ✅ Allows all read operations
   - ✅ Allows all write operations
   - ❌ Blocks dangerous commands (FLUSHDB, FLUSHALL, SHUTDOWN, etc.)
   - ✅ Grants access to all keys

---

## 📝 Understanding ACL Syntax

### Basic Syntax Elements

#### Command Permissions

| Syntax | Meaning | Example |
|--------|---------|---------|
| `+command` | Grant specific command | `+get` |
| `-command` | Deny specific command | `-flushdb` |
| `+@category` | Grant all commands in category | `+@read` |
| `-@category` | Deny all commands in category | `-@dangerous` |
| `+@all` | Grant all commands | `+@all` |

#### Key Patterns

| Syntax | Meaning | Example |
|--------|---------|---------|
| `~pattern` | Allow keys matching pattern | `~user:*` |
| `~*` | Allow all keys | `~*` |
| `%R~pattern` | Read-only access to pattern | `%R~cache:*` |
| `%W~pattern` | Write-only access to pattern | `%W~logs:*` |
| `%RW~pattern` | Read-write access (alias for `~`) | `%RW~data:*` |

#### Common Categories

| Category | Description | Example Commands |
|----------|-------------|------------------|
| `@read` | All read commands | GET, MGET, HGETALL |
| `@write` | All write commands | SET, DEL, HSET |
| `@admin` | Administrative commands | CONFIG, CLIENT, SHUTDOWN |
| `@dangerous` | Dangerous commands | FLUSHDB, FLUSHALL, KEYS |
| `@fast` | Fast commands | GET, SET, INCR |
| `@slow` | Slow commands | KEYS, SORT, MIGRATE |

---

## 🧪 Testing Commands and Keys

### Command Testing

Use the **Command Tester** to verify individual command access:

1. **Enter a command** (e.g., `GET`, `SET`, `HGETALL`)
2. **Click "Check Command"**
3. **View the result:**
   - ✅ Allowed - Command is granted by your ACL
   - ❌ Denied - Command is blocked by your ACL

**Example:**

```text
ACL Rule: +@read -@dangerous ~*
Test: GET → ✅ Allowed (granted by @read)
Test: SET → ❌ Denied (not in @read, not explicitly granted)
Test: KEYS → ❌ Denied (blocked by -@dangerous)
```

### Keyspace Testing

Use the **Keyspace Tester** to test key pattern access:

1. **Enter a key pattern** (e.g., `user:123`, `cache:*`)
2. **Click "Check Key Name"**
3. **View if the key matches allowed patterns**

**Example:**

```text
ACL Rule: +@read ~user:* ~cache:*
Test: user:123 → ✅ Allowed (matches ~user:*)
Test: cache:abc → ✅ Allowed (matches ~cache:*)
Test: admin:data → ❌ Denied (doesn't match any allowed pattern)
```

### Integrated Testing

The **Integrated Tester** combines both:

1. **Enter command** (e.g., `GET`)
2. **Enter key** (e.g., `user:123`)
3. **Click "Test Command + Key"**
4. **View if both command AND key are allowed**

---

## 🎨 Customizing Your Workspace

### Redis Version Switching

Toggle between **Redis 7** and **Redis 8**:

- Redis 7: 379 commands across 21 categories
- Redis 8: 488 commands across 29 categories (includes modules)

Click the version buttons at the top to switch.

### Theme Toggle

Switch between **Light** and **Dark** modes:

- Click the ☀️/🌙 button in the top right
- Your preference is saved automatically

### Panel Resizing

Customize the three-column layout:

1. **Hover over corners** of the three-column panel container
2. **Drag corners** to resize width and height
3. **Your sizes are saved** automatically

---

## 💡 Quick Examples

The app includes several preset ACL rules you can use as starting points:

### Full Access

```acl
+@all ~*
```

Grants access to all commands and keys.

### Read-Only

```acl
+@read ~*
```

Only read operations, no modifications.

### Read-Write (No Dangerous)

```acl
+@read +@write -@dangerous ~*
```

Read and write, but blocks dangerous operations like FLUSHDB.

### Advanced Example

```acl
+@all -@app:* %R~analytics:* (+@write ~logs:*)
```

Complex rule with selectors and key patterns.

---

## 🔍 Search and Filter

Each column has a **search bar** to filter commands:

1. **Toggle search mode:**
   - 🔍 Fuzzy search (finds partial matches)
   - 🎯 Exact search (finds exact matches only)

2. **Enter search term** (e.g., "get", "hash", "set")

3. **View filtered results**

4. **Clear search** to restore full list

---

## 📊 Optimization

Redis ACL Builder includes an **optimization engine**:

**Automatic optimization** for button-built rules:

- Detects when all commands in a category are granted
- Suggests using `+@category` instead of individual commands
- Shows "Saves X terms" for shorter rules

**Example:**

```text
Before: +pfadd +pfcount +pfmerge
After:  +@hyperloglog (saves 2 terms!)
```

---

## 🎓 Next Steps

Now that you've created your first ACL rule:

1. **[User Guide](./User-Guide)** - Learn about advanced features
2. **[API Reference](./API-Reference)** - Use the REST API programmatically
3. **[Troubleshooting](./Troubleshooting)** - Common issues and solutions
4. **[FAQ](./FAQ)** - Frequently asked questions

---

## 💬 Need Help?

- **[FAQ](./FAQ)** - Quick answers to common questions
- **[Troubleshooting](./Troubleshooting)** - Solutions to common issues
- **[GitHub
  Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)**
  - Ask questions
- **[Issue
  Tracker](https://github.com/markotrapani/redis-acl-builder/issues)** -
  Report bugs

---

**Happy ACL building!** 🚀
