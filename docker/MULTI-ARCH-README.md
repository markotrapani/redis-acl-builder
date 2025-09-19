# Multi-Architecture Docker Builds

Redis ACL Builder supports multi-architecture Docker builds for **linux/amd64** (Intel/AMD) and **linux/arm64** (Apple Silicon/ARM) platforms.

## Quick Start

### Option 1: Local Single-Architecture Build
```bash
cd docker
./deploy-beta.sh
```
This builds and runs for your current architecture only.

### Option 2: Multi-Architecture Build ✅ VERIFIED WORKING
```bash
cd docker
./build-multi-arch.sh
```
This builds for both AMD64 and ARM64 architectures using Docker Buildx.

### Option 3: Test Multi-Architecture Compatibility
```bash
cd docker
./test-multi-arch.sh
```
This comprehensively tests both architectures independently to verify compatibility.

## Multi-Architecture Build Details

### Supported Platforms
- **linux/amd64** - Intel and AMD 64-bit processors
- **linux/arm64** - ARM 64-bit processors (Apple Silicon M1/M2, ARM servers)

### Requirements
- Docker with Buildx support (Docker Desktop or Docker Engine 19.03+)
- For multi-arch builds: `docker buildx` command available

### Build Process

The multi-arch build script (`build-multi-arch.sh`) performs:

1. **Verification**: Checks Docker and Buildx availability
2. **Builder Setup**: Creates a dedicated multi-platform builder instance
3. **Local Build**: Builds and loads image for your current architecture
4. **Multi-Arch Build**: Builds for all supported architectures (amd64 + arm64)

### Image Details

- **Base Image**: `python:3.13-slim` (latest stable Python with performance improvements)
- **Final Size**: ~276MB (optimized multi-stage build)
- **Architectures**: Automatically detects and builds for both platforms
- **Port**: 7380
- **User**: Non-root user for security

## Usage Examples

### Run Local Build
```bash
# After running build-multi-arch.sh
docker run -d -p 7380:7380 --name redis-acl-builder redis-acl-builder:v1.14.0-beta
```

### Push to Registry (Multi-Arch)
```bash
# Build and push to Docker Hub (requires login)
docker buildx build \
  --platform=linux/amd64,linux/arm64 \
  --tag YOUR_USERNAME/redis-acl-builder:v1.14.0-beta \
  --push \
  -f Dockerfile ..

# Pull and run on any supported architecture
docker run -d -p 7380:7380 YOUR_USERNAME/redis-acl-builder:v1.14.0-beta
```

### Inspect Multi-Arch Manifest
```bash
# View architecture details of a multi-arch image
docker buildx imagetools inspect redis-acl-builder:v1.14.0-beta-multiarch
```

## Cross-Platform Compatibility

### Python Dependencies
All Python packages in `requirements-prod.txt` are compatible with both architectures:
- Pure Python packages work on all platforms
- Compiled extensions (if any) have wheels available for both amd64 and arm64

### Base Image Strategy
- Uses official Python slim images which provide multi-arch support
- Minimal base image reduces architecture-specific dependencies
- Multi-stage build ensures consistency across platforms

## Development Workflow

### Local Development
1. Develop on any platform (Intel Mac, Apple Silicon, Linux, Windows)
2. Test with single-arch build: `./deploy-beta.sh`
3. Build multi-arch for distribution: `./build-multi-arch.sh`

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build multi-arch
  run: |
    docker buildx build \
      --platform=linux/amd64,linux/arm64 \
      --tag redis-acl-builder:latest \
      -f docker/Dockerfile .
```

## Troubleshooting

### Docker Buildx Not Available
```bash
# Update Docker to latest version
# Docker Desktop: Update through the app
# Docker Engine: Install latest version

# Verify Buildx
docker buildx version
```

### Platform-Specific Issues
```bash
# Force build for specific platform
docker buildx build --platform=linux/amd64 -t redis-acl-builder:amd64 -f Dockerfile ..
docker buildx build --platform=linux/arm64 -t redis-acl-builder:arm64 -f Dockerfile ..
```

### Builder Issues
```bash
# Remove and recreate builder
docker buildx rm redis-acl-multiarch
./build-multi-arch.sh
```

## Performance Notes

- **ARM64 (Apple Silicon)**: Excellent performance with native builds
- **AMD64**: Standard performance on Intel/AMD systems
- **Cross-compilation**: ARM64 builds on AMD64 systems use emulation (slower but functional)
- **Build Time**: Multi-arch builds take ~2x time due to building both architectures

## Distribution

The multi-architecture approach enables:
- ✅ Native performance on Apple Silicon Macs
- ✅ Standard performance on Intel/AMD systems
- ✅ ARM server compatibility (AWS Graviton, etc.)
- ✅ Single `docker pull` command works on any platform
- ✅ No architecture-specific installation instructions needed