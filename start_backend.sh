#!/bin/bash

# Script to start the backend with SQLite

cd backend

echo "Setting up backend with SQLite..."

# Make sure USE_SQLITE_DEV is set
export USE_SQLITE_DEV=1

# Install dependencies if needed
echo "Installing dependencies..."
pip3 install -r requirements.txt

# Run migrations
echo "Running migrations..."
python3 manage.py migrate

# Start the server
echo "Starting Django server..."
python3 manage.py runserver
