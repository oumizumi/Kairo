#!/bin/bash

# Deploy UoSched Scraper to Render
echo "🚀 Deploying UoSched Scraper to Render..."

# Check if we're in the right directory
if [ ! -f "render.yaml" ]; then
    echo "❌ Error: render.yaml not found. Please run this script from the scrapers directory."
    exit 1
fi

# Ensure we have the latest changes
echo "📝 Checking git status..."
git status

# Build locally to check for errors
echo "🔨 Building locally to check for errors..."
npm install
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

echo "✅ Build successful!"

# Remind user about Render dashboard
echo "
🎯 Next steps:
1. Go to https://dashboard.render.com
2. Click 'New +' -> 'Blueprint'
3. Connect your GitHub repository
4. Select this directory (scrapers/) as the root
5. Click 'Apply'

📋 Service will be available at:
   https://uosched-scrapers.onrender.com

🔍 Test endpoint:
   https://uosched-scrapers.onrender.com/api/scrape?subject=CSI&term=2025%20Fall%20Term

🚀 Deployment ready!
" 