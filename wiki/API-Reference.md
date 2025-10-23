# API Reference

Complete REST API documentation for programmatic access to Redis ACL Builder.

---

## Base URL

- **Development:** `http://localhost:7380`
- **Docker:** `http://localhost:7380` (or your custom port)
- **Production:** Your deployment URL

---

## Content Type

All requests and responses use:

```http
Content-Type: application/json
```

---

## Endpoints

### POST /api/parse

Parse an ACL rule and return granted/blocked commands.

**Request:**

```json
{
  "rule": "+@read -@dangerous ~user:*",
  "version": "redis7"
}
```

**Parameters:**

- `rule` (string, required) - ACL rule to parse
- `version` (string, required) - Redis version (`"redis7"` or `"redis8"`)

**Response:**

```json
{
  "granted_commands": ["get", "mget", "getrange", ...],
  "blocked_commands": ["set", "del", ...],
  "granted_categories": ["@read"],
  "blocked_categories": ["@write", "@dangerous"],
  "key_patterns": ["~user:*"],
  "is_valid": true
}
```

---

### POST /api/test-command

Test if a specific command is allowed by an ACL rule.

**Request:**

```json
{
  "rule": "+@read",
  "command": "GET",
  "version": "redis7"
}
```

**Response:**

```json
{
  "is_granted": true,
  "reason": "Command allowed by @read category",
  "matching_rule": "+@read",
  "categories": ["@read", "@fast", "@string"]
}
```

---

### POST /api/test-command-key

Test if a command + key combination is allowed.

**Request:**

```json
{
  "rule": "+@read ~user:*",
  "command": "GET",
  "key": "user:123",
  "version": "redis7"
}
```

**Response:**

```json
{
  "command_allowed": true,
  "key_allowed": true,
  "overall_allowed": true,
  "reason": "Command and key both allowed"
}
```

---

### POST /api/validate-rule

Validate ACL rule syntax.

**Request:**

```json
{
  "rule": "+@read +invalid_category",
  "version": "redis7"
}
```

**Response:**

```json
{
  "is_valid": false,
  "errors": ["Invalid category: @invalid_category"],
  "warnings": []
}
```

---

### POST /api/command-info

Get information about a specific command.

**Request:**

```json
{
  "command": "GET",
  "version": "redis7"
}
```

**Response:**

```json
{
  "command": "get",
  "categories": ["@read", "@fast", "@string"],
  "exists": true
}
```

---

### GET /api/categories

Get all available categories for a Redis version.

**Request:**

```http
GET /api/categories?version=redis7
```

**Response:**

```json
{
  "categories": [
    "@read",
    "@write",
    "@admin",
    "@dangerous",
    ...
  ],
  "version": "redis7"
}
```

---

### POST /api/search-commands

Search commands by pattern.

**Request:**

```json
{
  "pattern": "get",
  "version": "redis7",
  "search_type": "fuzzy"
}
```

**Response:**

```json
{
  "matches": [
    {"command": "get", "score": 100},
    {"command": "getset", "score": 75},
    {"command": "hget", "score": 50}
  ]
}
```

---

### POST /api/optimize-rule

Get optimization suggestions for an ACL rule.

**Request:**

```json
{
  "rule": "+pfadd +pfcount +pfmerge",
  "version": "redis7"
}
```

**Response:**

```json
{
  "optimized_rule": "+@hyperloglog",
  "savings": 2,
  "explanation": "All commands in @hyperloglog category are granted"
}
```

---

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "version": "2.6.0-beta"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error |

---

## Example Usage

### Python

```python
import requests

# Parse an ACL rule
response = requests.post(
    'http://localhost:7380/api/parse',
    json={
        'rule': '+@read -@dangerous',
        'version': 'redis7'
    }
)

data = response.json()
print(f"Granted commands: {data['granted_commands']}")
```

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:7380/api/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    rule: '+@read -@dangerous',
    version: 'redis7'
  })
});

const data = await response.json();
console.log('Granted commands:', data.granted_commands);
```

### cURL

```bash
curl -X POST http://localhost:7380/api/parse \
  -H "Content-Type: application/json" \
  -d '{"rule": "+@read -@dangerous", "version": "redis7"}'
```

---

## Rate Limiting

No rate limiting is implemented for self-hosted deployments. Implement your own
rate limiting if deploying publicly.

---

## Next Steps

- [User Guide](./User-Guide) - Learn about the UI
- [Development](./Development) - Contribute to the project
- [Troubleshooting](./Troubleshooting) - Common issues

---

**Need help?** Visit [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions)!
