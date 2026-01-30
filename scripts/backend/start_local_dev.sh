#!/bin/bash

# Local Development Startup Script for Kairo
# This script starts the backend and frontend for local development

set -e

echo "🚀 Starting Kairo Local Development Environment"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "backend/manage.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    echo "🔄 Killing processes on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
kill_port 8000  # Backend
kill_port 3000  # Frontend

# Set up Python virtual environment for backend
echo "🐍 Setting up Python environment..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install requirements
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Set environment variables for local development
export DJANGO_DEBUG=True
export DJANGO_SECRET_KEY="local-dev-secret-key-not-for-production"
export DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
export DJANGO_CORS_ALLOWED_ORIGINS="http://localhost:3000"
export USE_SQLITE_DEV=1  # Use SQLite for local development
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"

echo "🗄️  Setting up database..."
# Run migrations
python manage.py migrate

# Create superuser if it doesn't exist (optional)
echo "👤 Creating superuser (if needed)..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
" 2>/dev/null || echo "Superuser setup skipped"

# Start backend server in background
echo "🚀 Starting Django backend server on http://localhost:8000..."
python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! curl -s http://localhost:8000/healthz/ >/dev/null 2>&1; then
    echo "❌ Backend failed to start properly"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Backend is running at http://localhost:8000"

# Move to frontend directory
cd ../frontend

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Start frontend server in background
echo "🚀 Starting Next.js frontend server on http://localhost:3000..."
npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

echo ""
echo "🎉 Local development environment is ready!"
echo "=============================================="
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "👤 Django Admin: http://localhost:8000/admin (admin/admin123)"
echo ""
echo "📝 To stop the servers, press Ctrl+C or run:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "💡 Backend logs will appear below..."
echo "=============================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Wait for processes (this keeps the script running)
wait