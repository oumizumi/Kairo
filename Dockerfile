FROM python:3.11-slim

WORKDIR /app

# Keep builds non-interactive and smaller
ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1

# No heavy system packages needed (using psycopg2-binary). If you need build tools, add minimal deps:
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
#     && rm -rf /var/lib/apt/lists/*

# Copy backend first so requirements.txt is in context
COPY backend ./backend

# Install Python dependencies
RUN pip install -r ./backend/requirements.txt
# Create railway startup script directly in the image
RUN echo '#!/bin/bash' > /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo '# Railway startup script with better error handling' >> /app/railway_start.sh && \
    echo 'set -e' >> /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo 'echo "🚀 Starting Railway deployment..."' >> /app/railway_start.sh && \
    echo 'echo "Time: $(date)"' >> /app/railway_start.sh && \
    echo 'echo "Python version: $(python --version)"' >> /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo '# Wait for database to be ready with retry logic' >> /app/railway_start.sh && \
    echo 'echo "Waiting for database connection..."' >> /app/railway_start.sh && \
    echo 'max_attempts=15' >> /app/railway_start.sh && \
    echo 'attempt=1' >> /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo 'while [ $attempt -le $max_attempts ]; do' >> /app/railway_start.sh && \
    echo '    echo "Attempt $attempt/$max_attempts: Testing database connection..."' >> /app/railway_start.sh && \
    echo '    ' >> /app/railway_start.sh && \
    echo '    # Test database connection with timeout' >> /app/railway_start.sh && \
    echo '    timeout 30 python manage.py check --database default 2>/dev/null' >> /app/railway_start.sh && \
    echo '    if [ $? -eq 0 ]; then' >> /app/railway_start.sh && \
    echo '        echo "Database connection successful!"' >> /app/railway_start.sh && \
    echo '        break' >> /app/railway_start.sh && \
    echo '    fi' >> /app/railway_start.sh && \
    echo '    ' >> /app/railway_start.sh && \
    echo '    if [ $attempt -eq $max_attempts ]; then' >> /app/railway_start.sh && \
    echo '        echo "Failed to connect to database after $max_attempts attempts."' >> /app/railway_start.sh && \
    echo '        echo "Attempting to continue with fallback configuration..."' >> /app/railway_start.sh && \
    echo '        break' >> /app/railway_start.sh && \
    echo '    fi' >> /app/railway_start.sh && \
    echo '    ' >> /app/railway_start.sh && \
    echo '    echo "Database not ready yet, waiting 5 seconds..."' >> /app/railway_start.sh && \
    echo '    sleep 5' >> /app/railway_start.sh && \
    echo '    attempt=$((attempt + 1))' >> /app/railway_start.sh && \
    echo 'done' >> /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo '# Run auto-fix script to handle all common issues' >> /app/railway_start.sh && \
    echo 'echo "Running auto-fix script..."' >> /app/railway_start.sh && \
    echo 'python auto_fix_railway.py || {' >> /app/railway_start.sh && \
    echo '    echo "⚠️ Auto-fix had issues, but continuing with startup..."' >> /app/railway_start.sh && \
    echo '    ' >> /app/railway_start.sh && \
    echo '    # Fallback to manual migration' >> /app/railway_start.sh && \
    echo '    echo "Attempting manual migration as fallback..."' >> /app/railway_start.sh && \
    echo '    timeout 120 python manage.py migrate --noinput || {' >> /app/railway_start.sh && \
    echo '        echo "⚠️ Manual migration also failed"' >> /app/railway_start.sh && \
    echo '    }' >> /app/railway_start.sh && \
    echo '}' >> /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo '# Collect static files' >> /app/railway_start.sh && \
    echo 'echo "Collecting static files..."' >> /app/railway_start.sh && \
    echo 'python manage.py collectstatic --noinput || true' >> /app/railway_start.sh && \
    echo '' >> /app/railway_start.sh && \
    echo '# Start the server' >> /app/railway_start.sh && \
    echo 'echo "Starting Gunicorn server..."' >> /app/railway_start.sh && \
    echo 'exec gunicorn kairo.wsgi:application \' >> /app/railway_start.sh && \
    echo '    --bind 0.0.0.0:${PORT:-8000} \' >> /app/railway_start.sh && \
    echo '    --workers 2 \' >> /app/railway_start.sh && \
    echo '    --timeout 120 \' >> /app/railway_start.sh && \
    echo '    --access-logfile - \' >> /app/railway_start.sh && \
    echo '    --error-logfile - \' >> /app/railway_start.sh && \
    echo '    --preload' >> /app/railway_start.sh

# Set working directory to backend
WORKDIR /app/backend

# Create staticfiles directory
RUN mkdir -p staticfiles

# Make startup script executable
RUN chmod +x /app/railway_start.sh

# Collect static files (with error handling)
RUN python -m pip show Django >/dev/null 2>&1 && python manage.py collectstatic --noinput || true

# Expose port
EXPOSE 8000

# Use the improved startup script (absolute path because WORKDIR is /app/backend)
CMD ["/app/railway_start.sh"]