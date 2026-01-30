#!/bin/bash

# Kairo Scraper Build Script for Render
echo "🚀 Building Kairo Scraper..."

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium

# Install Playwright system dependencies
echo "🔧 Installing Playwright system dependencies..."
npx playwright install-deps chromium

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

echo "✅ Build completed successfully!" 