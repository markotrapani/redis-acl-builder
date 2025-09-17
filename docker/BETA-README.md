# Redis Enterprise ACL Builder - Beta Release v1.7.0

🎉 **Welcome to the Redis Enterprise ACL Builder Beta!**

This is a comprehensive web application for building, testing, and validating Redis Access Control List (ACL) rules with real-time command and keyspace analysis.

## 🚀 Quick Start with Docker

### Prerequisites
- Docker installed on your system
- Port 8000 available

### Running the Beta Version

```bash
# Build the Docker image (Docker images not included in repo due to size limits)
docker build -t redis-acl-builder:v1.7.0-beta -f Dockerfile ..

# Run the beta image
docker run -d -p 8000:8000 --name redis-acl-builder redis-acl-builder:v1.7.0-beta

# Access the application
open http://localhost:8000
```

### Alternative: Manual Build

```bash
# Clone or extract the source code
cd redis-acl-builder

# Build the image (from project root)
docker build -t redis-acl-builder:v1.7.0-beta -f docker/Dockerfile .

# Or build from docker folder
cd docker
docker build -t redis-acl-builder:v1.7.0-beta -f Dockerfile ..

# Run the container
docker run -d -p 8000:8000 --name redis-acl-builder redis-acl-builder:v1.7.0-beta
```

## ✨ Key Features

### 🔥 **NEW in v1.7.0 - Production Polish**
- **Enhanced Error Handling**: Improved error messages with token truncation for better readability
- **Theme Flash Prevention**: Eliminated light mode flash on page load
- **Smart Button States**: Intelligent disable/enable states for all action buttons
- **Test Input Cleanup**: Removed unnecessary localStorage persistence for temporary inputs
- **Robust ACL Restoration**: Fixed edge cases when reloading with invalid ACL rules
- **Production Ready**: Removed debug logging and optimized for production deployment

### 🎯 **Dual Testing Interface**
- **🧪 Command Tester**: Real-time command validation with comprehensive error reporting
- **🔑 Keyspace Tester**: Advanced key pattern testing with full glob support (*, ?, [abc], [a-z], [^abc])
- **Auto-Dismissible Results**: 5-second auto-dismiss with manual close buttons and smooth animations

### 🏗️ **Interactive Three-Column Layout**
- **Left Panel**: Blocked commands (click to grant access)
- **Center Panel**: ACL rule configuration with quick examples and manual editing
- **Right Panel**: Granted commands (click to revoke access)

### 🌓 **Modern UI Features**
- Light/Dark mode toggle with system preference detection
- Responsive design optimized for all screen sizes
- Smooth animations and professional interactions
- Real-time validation with pop-up notifications

### ⚡ **Redis Support**
- **Full Redis 7 Support**: 311 commands across 21 categories
- **Complete Redis 8 Support**: 446 commands across 29 categories including all module commands
- **Module Commands**: RediSearch, RedisJSON, TimeSeries, Bloom filters, and more

## 🔧 Usage Guide

### Basic Workflow
1. **Start with Quick Examples**: Use the pre-built ACL rule examples in the center panel
2. **Interactive Building**: Click commands in the left/right panels to grant/revoke access
3. **Manual Editing**: Type ACL rules directly in the text area
4. **Real-time Testing**: Test specific commands and key patterns using the dual testing interface
5. **Validation**: Get instant feedback on rule syntax and optimization suggestions

### API Endpoints
The application exposes a REST API for programmatic access:

- `POST /api/parse` - Parse ACL rules and get command permissions
- `POST /api/test-command` - Test specific command access
- `POST /api/validate-rule` - Validate ACL syntax
- `GET /api/categories` - List available categories

### Example API Usage
```bash
# Parse an ACL rule
curl -X POST -H "Content-Type: application/json" \
  -d '{"rule":"+@read ~*","version":"redis7"}' \
  http://localhost:8000/api/parse

# Test a command
curl -X POST -H "Content-Type: application/json" \
  -d '{"rule":"+@read ~*","command":"GET","version":"redis7"}' \
  http://localhost:8000/api/test-command
```

## 🐛 Beta Testing Guidelines

### What to Test
1. **Core Functionality**:
   - Build ACL rules using the interactive interface
   - Test command permissions with various rule combinations
   - Validate keyspace patterns with different glob expressions

2. **UI/UX**:
   - Theme switching (light/dark mode)
   - Responsive behavior on different screen sizes
   - Button states and interactive feedback

3. **Edge Cases**:
   - Invalid ACL rule syntax
   - Long command names and complex patterns
   - Redis 8 module command compatibility
   - Browser refresh behavior with existing rules

### Reporting Issues
Please test thoroughly and report any issues you encounter:

1. **Bug Reports**: Include browser type, steps to reproduce, and expected vs actual behavior
2. **Feature Requests**: Describe the use case and how it would improve your workflow
3. **Performance Issues**: Note any slow responses or UI lag
4. **Docker Issues**: Include your Docker version and environment details

### Known Limitations
- **Pub/Sub Channels**: `&` channel patterns are not yet supported
- **Export Functionality**: Configuration file export is planned for future release
- **Rule History**: ACL rule history tracking is in development

## 📊 Technical Details

### Architecture
- **Backend**: Flask 3.0 with comprehensive API endpoints
- **Frontend**: Modular ES6 JavaScript with 8 focused modules
- **Database**: In-memory Redis command database with 100% test coverage
- **Deployment**: Production-ready with Gunicorn and health checks

### Performance
- **Test Coverage**: 82% overall (95-100% on core logic)
- **Response Time**: Sub-100ms for most operations
- **Memory Usage**: ~50MB per worker process
- **Scalability**: Multi-worker Docker deployment ready

### Security
- **Input Validation**: Comprehensive XSS and injection protection
- **Error Handling**: Sanitized error messages without information disclosure
- **Container Security**: Non-root user execution in Docker

## 🎯 Roadmap

### Planned Features
1. **Export Functionality**: Generate production-ready ACL configuration files
2. **Advanced Analytics**: Usage patterns and security recommendations
3. **Pub/Sub Support**: Full `&` channel pattern support
4. **Rule History**: Persistent ACL rule management
5. **Keyboard Shortcuts**: Power user workflow enhancements

## 📞 Support

This is a beta release for testing and feedback. The application is production-ready and has been thoroughly tested, but we appreciate your feedback to make it even better.

### Container Management
```bash
# View container logs
docker logs redis-acl-builder

# Stop the application
docker stop redis-acl-builder

# Restart the application
docker restart redis-acl-builder

# Remove container and start fresh
docker stop redis-acl-builder && docker rm redis-acl-builder
docker run -d -p 8000:8000 --name redis-acl-builder redis-acl-builder:v1.7.0-beta
```

---

**Thank you for participating in the Redis ACL Builder beta!** 🙏

Your feedback is invaluable in making this tool the best Redis ACL management solution available.