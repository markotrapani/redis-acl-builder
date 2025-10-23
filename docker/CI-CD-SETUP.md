# CI/CD Pipeline Setup Guide

## Overview

This guide explains how to set up automated Docker image building and publishing
using GitHub Actions for the Redis ACL Builder project.

## Prerequisites

- GitHub repository with admin access
- Docker Hub account
- Docker Hub Personal Access Token

## 1. Docker Hub Setup

### Create Docker Hub Personal Access Token

1. Log in to [Docker Hub](<https://hub.docker.com/>)
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Name: `github-actions-redis-acl-builder`
5. Permissions: **Read, Write, Delete**
6. Copy the generated token (save it securely)

### Verify Repository

Ensure your Docker Hub repository exists:

- Repository: `markotrapani608/redis-acl-builder`
- Visibility: Public (recommended for open source)

## 2. GitHub Secrets Configuration

Go to your GitHub repository → **Settings** → **Secrets and variables** →
**Actions**

### Required Secrets

Add these repository secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `DOCKERHUB_USERNAME` | `markotrapani608` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | `your_token` | Token from Docker Hub |

### Setting Up Secrets

1. Click **New repository secret**
2. Enter secret name and value
3. Click **Add secret**
4. Repeat for both secrets

## 3. Workflow Features

Our CI/CD pipeline (`/.github/workflows/docker-publish.yml`) includes:

### Multi-Architecture Support

- **AMD64**: Standard x86_64 architecture
- **ARM64**: Apple Silicon, ARM servers, IoT devices
- Uses QEMU emulation for cross-compilation

### Smart Tagging Strategy

- **`latest`**: Always points to main branch
- **`beta`**: Beta releases from main branch
- **Version tags**: `v1.15.0`, `v1.15`, `v1` (from git tags)
- **Branch tags**: Development branches

### Automated Features

- ✅ **Docker layer caching** - Faster builds
- ✅ **Security scanning** - Docker Scout CVE analysis
- ✅ **README sync** - Auto-update Docker Hub description
- ✅ **Metadata labels** - OCI-compliant image labels
- ✅ **Pull request testing** - Build without pushing

### Performance Optimizations

- GitHub Actions cache for Docker layers
- Parallel multi-arch builds
- Efficient layer ordering in Dockerfile

## 4. Triggering Builds

### Automatic Triggers

- **Push to `main`**: Creates `latest` and `beta` tags
- **Git tags** (e.g., `v1.15.0`): Creates version-specific tags
- **Pull requests**: Build-only (no push) for testing

### Manual Triggers

From GitHub repository:

1. Go to **Actions** tab
2. Select **Build and Publish Docker Images**
3. Click **Run workflow**
4. Choose branch/tag to build

## 5. Release Process

### Standard Release

```bash
# Create and push version tag
git tag v1.16.0-beta
git push origin v1.16.0-beta
```

### Beta Release

```bash
# Push to main branch (auto-tags as beta)
git push origin main
```

## 6. Monitoring

### GitHub Actions

- View build logs: **Actions** → **Build and Publish Docker Images**
- Monitor success/failure rates
- Check build times and cache efficiency

### Docker Hub

- View image tags:
  <https://hub.docker.com/r/markotrapani608/redis-acl-builder/tags>
- Monitor download statistics
- Check security scan results

## 7. Troubleshooting

### Common Issues

**Build fails with authentication error:**

- Verify Docker Hub credentials in GitHub secrets
- Check token permissions (Read, Write, Delete)
- Ensure token hasn't expired

**Multi-arch build fails:**

- Check QEMU setup in workflow logs
- Verify Dockerfile ARM64 compatibility
- Review platform-specific dependencies

**Image push fails:**

- Confirm repository exists on Docker Hub
- Check repository visibility settings
- Verify image name matches exactly

### Debug Steps

1. Check GitHub Actions logs for detailed error messages
2. Test Docker build locally with same parameters
3. Verify all secrets are correctly configured
4. Review workflow file syntax

## 8. Security Considerations

### Best Practices

- ✅ Use Personal Access Tokens (not passwords)
- ✅ Limit token permissions to minimum required
- ✅ Regularly rotate access tokens
- ✅ Monitor security scan results
- ✅ Keep base images updated

### Vulnerability Management

- Docker Scout automatically scans for CVEs
- Pipeline fails on critical/high severity issues
- Regular dependency updates recommended
- Security patches should be released promptly

## 9. Cost Optimization

### Resource Efficiency

- Docker layer caching reduces build times
- Multi-arch builds run in parallel
- GitHub Actions provides 2,000 free minutes/month
- Docker Hub allows unlimited public repositories

### Monitoring Usage

- Track GitHub Actions minutes in repository settings
- Monitor Docker Hub rate limits for pulls
- Consider GitHub Actions runners for heavy usage

## 10. Future Enhancements

### Planned Improvements

- [ ] Automated changelog generation
- [ ] Integration testing before push
- [ ] Notification system for build failures
- [ ] Performance benchmarking in CI
- [ ] Staging environment deployment

### Advanced Features

- [ ] Multi-stage deployment (staging → production)
- [ ] Canary releases with traffic splitting
- [ ] Integration with monitoring systems
- [ ] Automated security patching
- [ ] Custom build matrix for different configurations

## Support

For issues with CI/CD setup:

1. Check this documentation
2. Review GitHub Actions logs
3. Check Docker Hub repository settings
4. Create GitHub issue with logs and error details
