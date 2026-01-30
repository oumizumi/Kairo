#!/bin/bash

# Railway startup script with better error handling
set -e

echo "🚀 Starting Railway deployment..."
echo "Time: $(date)"
echo "Python version: $(python --version)"

# Wait for database to be ready with retry logic
echo "Waiting for database connection..."
max_attempts=15
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts: Testing database connection..."
    
    # Test database connection with timeout
    timeout 30 python manage.py check --database default 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "Database connection successful!"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "Failed to connect to database after $max_attempts attempts."
        echo "Attempting to continue with fallback configuration..."
        break
    fi
    
    echo "Database not ready yet, waiting 5 seconds..."
    sleep 5
    attempt=$((attempt + 1))
done

# Run auto-fix script to handle all common issues
echo "Running auto-fix script..."
python auto_fix_railway.py || {
    echo "⚠️ Auto-fix had issues, but continuing with startup..."
    
    # Fallback to manual migration
    echo "Attempting manual migration as fallback..."
    timeout 120 python manage.py migrate --noinput || {
        echo "⚠️ Manual migration also failed"
    }
}

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput || true

# Start the server
echo "Starting Gunicorn server..."
exec gunicorn kairo.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --preload 