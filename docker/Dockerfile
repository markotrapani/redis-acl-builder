# Redis ACL Builder - Optimized Multi-stage Docker Build
# Target size: ~150-200MB (vs current 1.23GB)

# Build stage - includes build tools and dependencies
FROM python:3.12-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set up build environment
WORKDIR /build
COPY requirements-prod.txt .

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-prod.txt

# Production stage - minimal runtime image
FROM python:3.12-slim as production

# Install only runtime dependencies (curl for health checks)
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV FLASK_DEBUG=False
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy only necessary application files (production optimized)
COPY app.py .
COPY helpers/ helpers/
COPY templates/ templates/
COPY static/ static/

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash --uid 1000 app && \
    chown -R app:app /app
USER app

# Expose port
EXPOSE 7380

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7380/api/categories || exit 1

# Start command using gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:7380", "--workers", "4", "--timeout", "120", "--max-requests", "1000", "--max-requests-jitter", "100", "app:app"]
