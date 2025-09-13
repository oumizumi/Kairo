#!/usr/bin/env bash
echo "Starting Django application..."
echo "Current directory: $(pwd)"

export DJANGO_SETTINGS_MODULE=kairo.settings

# Check if backend directory exists
if [ -d "backend" ]; then
    echo "Found backend directory, changing to it..."
    cd backend
    echo "Now in: $(pwd)"
else
    echo "ERROR: backend directory not found!"
    exit 1
fi

echo "Starting gunicorn server..."
exec gunicorn kairo.wsgi:application --bind 0.0.0.0:$PORT 