#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# No data copying. Services read from scrapers/data or frontend/public.

# Migrate the database
echo "Running database migrations..."
python manage.py migrate

echo "Backend build complete!" 