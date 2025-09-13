FROM python:3.11-slim

WORKDIR /app

# Keep builds non-interactive and smaller
ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1

# No heavy system packages needed (using psycopg2-binary). If you need build tools, add minimal deps:
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
#     && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

# Copy only what we need for backend image to reduce build context
COPY backend ./backend
COPY scrapers ./scrapers
# Ensure by-term course data is available to the backend in production
COPY frontend/public/api/data/all_courses_by_term.json ./backend/api/data/all_courses_by_term.json
# Copy runtime scripts into image root for compatibility
COPY scripts/backend/railway_start.sh ./railway_start.sh
# Note: railway_db_fix.sh is optional and not needed for production deployment

# Set working directory to backend
WORKDIR /app/backend

# Create staticfiles directory
RUN mkdir -p staticfiles

# Make startup script executable
RUN chmod +x /app/railway_start.sh || true

# Collect static files (with error handling)
RUN python -m pip show Django >/dev/null 2>&1 && python manage.py collectstatic --noinput || true

# Expose port
EXPOSE 8000

# Use the improved startup script (absolute path because WORKDIR is /app/backend)
CMD ["/app/railway_start.sh"]