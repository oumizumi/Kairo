# Kairo - AI University Assistant

A private, AI-powered assistant to help you stay organized and ahead at university.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- OpenAI API key

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/oumizumi/Kairo.git
   cd Kairo
   ```

2. **Set up the backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp env.example .env
   # Edit .env with your configuration
   python manage.py migrate
   python manage.py runserver
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   npm install
   cp env.example .env.local
   # Edit .env.local with your backend URL
   npm run dev
   ```

## 🌐 Vercel Deployment

### Deploy Backend (Django API)

1. **Create a new Vercel project for the backend**
   ```bash
   cd backend
   vercel
   ```

2. **Set environment variables in Vercel dashboard:**
   - `DJANGO_SECRET_KEY`: Generate a secure secret key
   - `DJANGO_DEBUG`: `False`
   - `DJANGO_ALLOWED_HOSTS`: Your Vercel domain
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DJANGO_CORS_ALLOWED_ORIGINS`: Your frontend domain
   - Other variables from `env.example`

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Deploy Frontend (Next.js)

1. **Create a new Vercel project for the frontend**
   ```bash
   cd frontend
   vercel
   ```

2. **Set environment variables in Vercel dashboard:**
   - `NEXT_PUBLIC_API_URL`: Your backend Vercel URL

3. **Deploy**
   ```bash
   vercel --prod
   ```

## 📁 Project Structure

```
Kairo/
├── backend/                 # Django REST API
│   ├── api/                 # API endpoints & services
│   ├── kairo/               # Django settings
│   ├── manage.py            # Django management
│   └── requirements.txt
├── frontend/                # Next.js React app
│   ├── src/                 # Source code
│   ├── public/              # Static assets (course data JSON, curriculums)
│   └── package.json
├── scrapers/                # Course data scrapers (Node/Playwright)
│   ├── data/                # Generated JSON data (source of truth)
│   └── render.yaml          # Render blueprint for scrapers
└── scripts/                 # Scripts and developer utilities
    ├── backend/             # Backend-related scripts
    │   ├── railway_start.sh
    │   ├── railway_db_fix.sh
    │   ├── build.sh
    │   └── deploy-render.(sh|ps1)
    ├── scrapers/            # Scraper deployment helpers
    │   └── deploy-scraper.sh
    ├── dev/                 # Ad-hoc local test scripts
    │   ├── test_export.py
    │   ├── test_export_full.py
    │   └── test_railway_login.sh
    └── update_kairoll_data.js  # Manually sync scrapers → frontend/public
```

## 🔧 Environment Variables

### Backend (.env)
See `backend/env.example` for all required variables.

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.vercel.app
```

## 🎯 Features

- **Auto-generate course schedules** - AI-powered schedule optimization
- **Course and professor info** - Instant access to detailed information
- **Natural language queries** - Ask anything about your courses

## 🛠️ Tech Stack

- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Backend: Django, Django REST Framework, PostgreSQL
- AI: OpenAI GPT-4
- Deployment: Vercel (frontend), Railway/Render (backend/scrapers)

## 📦 Docker & Deployment

- Backend image builds from the root `Dockerfile`.
  - Copies `backend/` and `scrapers/` into the image and uses `scripts/backend/railway_start.sh` as the entrypoint.
- Scrapers have a separate `scrapers/Dockerfile` and Render blueprint at `scrapers/render.yaml`.

### Production Hardening and Scaling
- Postgres required via `DATABASE_URL` (SQLite fallback removed)
- Optional read replica via `DATABASE_URL_REPLICA` and router `kairo.db_router.ReadReplicaRouter`
- PgBouncer support via `USE_PGBOUNCER=1` (sets `CONN_MAX_AGE=0`)
- Redis cache configured (`REDIS_CACHE_URL`), Conditional GET middleware enabled
- Health endpoints at `/healthz` and `/readyz`
- Gunicorn gthread workers via `gunicorn.conf.py`
- Celery workers for AI tasks (`REDIS_BROKER_URL`)
- Rate limiting and circuit breaker added for AI enqueue path

Environment variables (required): `DATABASE_URL`, `REDIS_CACHE_URL`, `REDIS_BROKER_URL`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`.
Optional: `USE_PGBOUNCER`, `DATABASE_URL_REPLICA`, `WEB_CONCURRENCY`, `WEB_THREADS`, `REQUESTS_DEFAULT_CONNECT_TIMEOUT`, `REQUESTS_DEFAULT_READ_TIMEOUT`.

Local run example:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgres://user:pass@localhost:5432/db
export REDIS_CACHE_URL=redis://localhost:6379/1
export REDIS_BROKER_URL=redis://localhost:6379/2
export DJANGO_SECRET_KEY=dev
python manage.py migrate
gunicorn kairo.wsgi:application -c ../gunicorn.conf.py
```

Celery worker:
```bash
cd backend
celery -A kairo worker --concurrency=${CELERY_CONCURRENCY:-16} -Ofair
```

### k6 load tests
```bash
k6 run -e BASE_URL=http://localhost:8000 k6/k6_cached_reads.js
k6 run -e BASE_URL=http://localhost:8000 k6/k6_ai_enqueue.js
```

### Scripts
- `scripts/backend/railway_start.sh`: Production startup (gunicorn) used in containers/Railway.
- `scripts/backend/railway_db_fix.sh`: Utility to reconcile DB on Railway.
- `scripts/backend/build.sh`: Backend build steps (collectstatic, migrate). Copying data to `backend/api/data` was removed; services read from `scrapers/data` or `frontend/public`.
- `scripts/backend/deploy-render.(sh|ps1)`: Render prep helpers (kept for reference).
- `scripts/update_kairoll_data.js`: Manually sync latest scraped JSON from `scrapers/data` to `frontend/public`.
- `scripts/dev/*`: Local-only sample/test scripts.

### YAML/Configs
- `scrapers/render.yaml`: Render blueprint for scrapers service.
- `vercel.json`: Routes Next.js frontend in `frontend/` (root-level, used by Vercel).

## 📝 License

Private project - All rights reserved.

---

Note: Production API base currently used: `https://kairo-production-6c0a.up.railway.app`. Ensure `NEXT_PUBLIC_API_URL` matches this in Vercel env.