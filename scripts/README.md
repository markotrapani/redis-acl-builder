# Docker Maintenance Scripts

This directory contains utility scripts for managing the Redis ACL Builder Docker repository.

## docker-tag-maintenance.sh

A comprehensive script for managing Docker Hub repository tags via API.

### Prerequisites

1. **Docker Hub Personal Access Token** with delete permissions
2. **Required tools**: `curl`, `jq`
3. **Environment variable**: `DOCKERHUB_TOKEN`

### Setup

```bash
# Set your Docker Hub token (use your existing GitHub secret value)
export DOCKERHUB_TOKEN="dckr_pat_xxxxx"

# Or source from a secure file
echo "dckr_pat_xxxxx" > ~/.dockerhub_token
chmod 600 ~/.dockerhub_token
export DOCKERHUB_TOKEN=$(cat ~/.dockerhub_token)
```

### Usage Examples

#### List Operations

```bash
# List all tags
./scripts/docker-tag-maintenance.sh list

# List all beta tags
./scripts/docker-tag-maintenance.sh list-pattern ".*-beta$"

# List all tags starting with 'v'
./scripts/docker-tag-maintenance.sh list-pattern "^v"

# List old version patterns
./scripts/docker-tag-maintenance.sh list-pattern "^v1\.(0|1|2|3|4|5|6)\."
```

#### Delete Operations (Interactive)

```bash
# Dry run: show what would be deleted (safe)
./scripts/docker-tag-maintenance.sh delete-pattern-dry "^v"

# Delete all v-prefixed tags (with confirmation prompt)
./scripts/docker-tag-maintenance.sh delete-pattern "^v"

# Delete specific tags
./scripts/docker-tag-maintenance.sh delete v1.0.0-beta old-experimental

# Delete old versions (interactive)
./scripts/docker-tag-maintenance.sh delete-pattern "^v1\.(0|1|2|3|4|5)\."
```

#### Common Maintenance Tasks

```bash
# Clean up old v-prefixed tags (like we just did)
./scripts/docker-tag-maintenance.sh delete-pattern "^v"

# Remove experimental tags
./scripts/docker-tag-maintenance.sh delete-pattern ".*-experimental$"

# Clean up old beta versions (keep recent ones)
./scripts/docker-tag-maintenance.sh list-pattern "^1\.(0|1|2|3|4|5)\..*-beta$"
./scripts/docker-tag-maintenance.sh delete-pattern "^1\.(0|1|2|3|4|5)\..*-beta$"
```

### GitHub Actions Integration

Add to your CI/CD workflow:

```yaml
name: Clean up old Docker tags

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2 AM
  workflow_dispatch:  # Manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install jq
        run: sudo apt-get update && sudo apt-get install -y jq

      - name: Clean up old tags
        env:
          DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
        run: |
          # Example: Clean up tags older than v1.10
          ./scripts/docker-tag-maintenance.sh delete-pattern "^v1\.[0-9]\..*-beta$"

          # Or clean up experimental tags
          ./scripts/docker-tag-maintenance.sh delete-pattern ".*-experimental$"
```

### Security Best Practices

1. **Token Storage**: Never commit tokens to the repository
2. **GitHub Secrets**: Use `DOCKERHUB_TOKEN` secret in GitHub Actions
3. **Local Development**: Store token in secure file with 600 permissions
4. **Token Scope**: Use tokens with minimal required permissions (delete tags only)

### Regex Patterns Reference

| Pattern | Description | Example Matches |
|---------|-------------|-----------------|
| `^v` | Starts with 'v' | `v1.0.0`, `v2.1.0-beta` |
| `.*-beta$` | Ends with '-beta' | `1.15.0-beta`, `latest-beta` |
| `^v1\.(0|1|2|3|4|5)\.` | Old v1.0-v1.5 versions | `v1.0.0`, `v1.5.2-beta` |
| `.*-experimental$` | Experimental tags | `feature-experimental` |
| `^temp-` | Temporary tags | `temp-fix`, `temp-test` |
| `^pr-[0-9]+$` | PR-based tags | `pr-123`, `pr-456` |

### Error Handling

The script includes comprehensive error handling:

- **Authentication errors**: Clear messages about token issues
- **API errors**: HTTP status codes and response details
- **Network errors**: Curl failure handling
- **Missing dependencies**: Checks for required tools

### Safety Features

- **Interactive confirmation**: Prompts before destructive operations
- **Dry run mode**: Test deletions without actually deleting
- **Detailed logging**: Color-coded output for different message types
- **Rollback information**: Lists what was deleted for potential rollback

### Troubleshooting

#### Common Issues

1. **Authentication failure**:
   ```
   [ERROR] Failed to get bearer token
   ```
   - Check that `DOCKERHUB_TOKEN` is set correctly
   - Verify token has required permissions

2. **Missing dependencies**:
   ```bash
   # Install jq on macOS
   brew install jq

   # Install jq on Ubuntu
   sudo apt-get install jq
   ```

3. **Network issues**:
   - Check internet connectivity
   - Verify Docker Hub API is accessible

#### Debug Mode

For debugging, you can modify the script to show curl responses:

```bash
# Add -v flag to curl commands for verbose output
curl -v -s -X DELETE ...
```