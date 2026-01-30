#!/bin/bash

# Railway Database Fix Script
# Run this on Railway to diagnose and fix database issues

echo "🚀 KAIRO RAILWAY DATABASE FIX"
echo "=============================="

# Check if we're in Railway environment
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found. Are you running this on Railway?"
    exit 1
fi

echo "✅ DATABASE_URL found"

# Check Python and Django
echo "🐍 Checking Python environment..."
python --version
pip list | grep -E "(Django|psycopg2)"

# Run database diagnostic
echo ""
echo "🔍 Running database diagnostic..."
python fix_railway_db.py

# Test login API
echo ""
echo "🧪 Testing login API..."
python test_login_api.py

# Show recent logs (if available)
echo ""
echo "📋 Recent application activity:"
echo "Check Railway dashboard for detailed logs"

echo ""
echo "✅ Railway database fix script completed!"
echo ""
echo "💡 Next steps if login still fails:"
echo "1. Check Railway dashboard logs for errors"
echo "2. Verify frontend is using correct Railway URL"
echo "3. Test login with the created test user:"
echo "   Email: test@kairo.app"
echo "   Password: testpass123"
echo "4. Check CORS settings in Railway environment variables"