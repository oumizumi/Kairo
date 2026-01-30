#!/bin/bash

# Quick Backend-Only Startup Script
# Use this when you only need to test the backend API

set -e

echo "🔧 Starting Backend Only..."

# Check if we're in the right directory
if [ ! -f "backend/manage.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

cd backend

# Create and activate virtual environment
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# Install requirements
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Set environment variables for local development
export DJANGO_DEBUG=True
export DJANGO_SECRET_KEY="local-dev-secret-key"
export DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
export DJANGO_CORS_ALLOWED_ORIGINS="http://localhost:3000"
export USE_SQLITE_DEV=1
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"

# Run migrations
echo "🗄️  Running migrations..."
python manage.py migrate

# Start server
echo "🚀 Starting backend server at http://localhost:8000"
echo "📝 Press Ctrl+C to stop"
python manage.py runserver 0.0.0.0:8000