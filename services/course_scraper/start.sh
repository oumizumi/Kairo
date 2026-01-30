#!/bin/bash

# Kairo Scraper Start Script for Render
echo "🚀 Starting Kairo Scraper..."

# Set the port (Render will provide this)
export PORT=${PORT:-10000}

echo "📡 Starting server on port $PORT"

# Start the Node.js application
npm start 