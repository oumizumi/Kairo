#!/bin/bash

# Backend Status Check Script
echo "🔍 Kairo Backend Status Check"
echo "============================="

# Check if backend is running
if curl -s http://localhost:8000/healthz/ >/dev/null 2>&1; then
    echo "✅ Backend is running at http://localhost:8000"
    
    # Test health endpoints
    echo ""
    echo "🏥 Health Checks:"
    echo "  - Basic health: $(curl -s http://localhost:8000/healthz/ | jq -r '.ok // "❌"')"
    echo "  - Database: $(curl -s http://localhost:8000/readyz/ | jq -r '.db // "❌"')"
    
    # Test API endpoints
    echo ""
    echo "🔌 API Endpoints:"
    echo "  - API Health: $(curl -s http://localhost:8000/api/health/ | jq -r '.status // "❌"')"
    echo "  - Guest Login: $(curl -s -X POST http://localhost:8000/api/auth/guest-login/ -H "Content-Type: application/json" | jq -r '.user.username // "❌"')"
    
    echo ""
    echo "🌐 Available URLs:"
    echo "  - Main API: http://localhost:8000/api/"
    echo "  - Admin Panel: http://localhost:8000/admin/ (admin/admin123)"
    echo "  - Health Check: http://localhost:8000/healthz/"
    echo "  - Database Check: http://localhost:8000/readyz/"
    
else
    echo "❌ Backend is not running"
    echo "💡 Run './start_backend_only.sh' to start it"
fi