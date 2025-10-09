# Redis ACL Builder - Simplified Single-stage Docker Build
# Target size: ~45-60MB (pure Python dependencies, no compilation needed)
# Using Python 3.13 Alpine - Latest stable version with Alpine optimizations
# Security: OpenSSL CVE-2025-9230 patched in v1.18.0-beta (2025-01-02)

FROM python:3.13-alpine

# Upgrade all packages to latest versions (fixes CVE-2025-9230: OpenSSL HIGH)
# This addresses CVE-2025-9230 (HIGH) by upgrading openssl to >=3.5.4-r0
RUN apk upgrade --no-cache

# Install runtime dependencies (curl for health checks)
RUN apk add --no-cache curl

# Install Python dependencies (production + build tools)
# Build tools needed for minification during image build
COPY requirements-prod.txt requirements-test.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-prod.txt && \
    pip install --no-cache-dir csscompressor rjsmin

# Set working directory
WORKDIR /app

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV FLASK_DEBUG=False
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy only necessary application files (production optimized)
COPY app.py build_minified.py ./
COPY helpers/ helpers/
COPY models/ models/
COPY templates/ templates/
COPY static/ static/

# Build minified assets for production
RUN python build_minified.py

# Create non-root user for security (Alpine Linux syntax)
RUN adduser -D -s /bin/sh -u 1000 app && \
    chown -R app:app /app
USER app

# Expose port
EXPOSE 7380

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7380/api/categories || exit 1

# Start command using gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:7380", "--workers", "4", "--timeout", "120", "--max-requests", "1000", "--max-requests-jitter", "100", "app:app"]
