# Environment Variables Template

Copy this file to `.env` in the backend directory and fill in your values.

## Required Variables

### Django Backend
```bash
DJANGO_SECRET_KEY=your-secret-key-here-change-in-production
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

### Database
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
# Optional: Read replica for scaling
DATABASE_URL_REPLICA=postgresql://user:password@replica-host:port/dbname
USE_PGBOUNCER=0
USE_SQLITE_DEV=0
```

### CORS Configuration
```bash
DJANGO_CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
DJANGO_CORS_ALLOW_ALL_ORIGINS=False
DJANGO_CORS_ALLOW_CREDENTIALS=True
```

### Security Settings (Production)
```bash
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=True
DJANGO_SECURE_CONTENT_TYPE_NOSNIFF=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
```

### OpenAI API
```bash
OPENAI_API_KEY=
```

### Celery (Optional)
```bash
CELERY_CONCURRENCY=16
```

### Frontend
```bash
NEXT_PUBLIC_API_URL=https://your-backend-api.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
FRONTEND_ORIGIN=https://yourdomain.com
```

## Development Setup

For local development:
```bash
DJANGO_DEBUG=True
USE_SQLITE_DEV=1
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Production Checklist

- [ ] Set strong SECRET_KEY (use `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`)
- [ ] Set DEBUG=False
- [ ] Configure DATABASE_URL with PostgreSQL
- [ ] Set all SECURE_* flags to True
- [ ] Configure ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS
- [ ] Set OPENAI_API_KEY
- [ ] Verify all domains are correct
