# Production Hardening & Scaling

## Environment Variables
- DATABASE_URL (required)
- DATABASE_URL_REPLICA (optional)
- USE_PGBOUNCER (0/1)
- DJANGO_SECRET_KEY
- DJANGO_DEBUG (False in prod)
- DJANGO_ALLOWED_HOSTS
- REDIS_CACHE_URL
- REDIS_BROKER_URL
- REQUESTS_DEFAULT_CONNECT_TIMEOUT (default 2)
- REQUESTS_DEFAULT_READ_TIMEOUT (default 25)
- WEB_CONCURRENCY, WEB_THREADS

## Database
- SQLite fallback removed; Postgres required.
- PgBouncer-friendly settings via USE_PGBOUNCER.
- Optional read replica; GETs routed via DB router.

## Cache
- Redis configured as default cache. TTL default 90s.

## Health Endpoints
- /healthz -> 200 if app up
- /readyz -> 200 if DB reachable, else 503

## Run Locally
```bash
export DATABASE_URL=postgres://...
export REDIS_CACHE_URL=redis://...
export REDIS_BROKER_URL=redis://...
export DJANGO_SECRET_KEY=dev-secret
export DJANGO_DEBUG=True

pip install -r requirements.txt
python manage.py migrate
gunicorn kairo.wsgi:application -c ../../gunicorn.conf.py
```

## Celery (once added)
```bash
celery -A kairo worker --concurrency=${CELERY_CONCURRENCY:-16} -Ofair
```

## Rollback
- Revert to previous commit.
- Ensure DATABASE_URL is valid; without it, app will error at startup.

## Feature flags and RuntimeConfig
- DB-overrides-env key-value store via `RuntimeConfig` (Django Admin).
- Keys (env fallback):
  - `SCHEDULE_FEATURE_ENABLED` (0/1)
  - `SCHEDULE_COMING_SOON_MSG`
  - `INTENT_SCHEDULE_KW`
  - `AI_DAILY_LIMIT_ENABLED` (0/1)
  - `AI_DAILY_LIMIT_PER_USER` (int)
  - `AI_LIMIT_BLOCK_MSG`
  - `AI_FAST_MODEL`, `AI_FAST_MAX_TOKENS`, `AI_FAST_TIMEOUT_S`
  - `AI_ENABLE_RESPONSE_CACHE` (0/1), `AI_RESPONSE_CACHE_TTL_S`

## New endpoints
- POST `/api/ai/router` → schedule coming-soon (when disabled) or fast Q&A response; optional background upgrade via Celery task.

## Tests
- `backend/api/tests/test_ai_router.py` covers disabled schedule, daily limit, and fast path.
