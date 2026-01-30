<div align="center">

<!-- Kairo Logo -->
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100">
  <g transform="translate(50,50)">
    <rect x="-22" y="-30" width="6" height="60" fill="#111" rx="3" />
    <polygon points="-16,-4 20,-24 24,-21 -12,-1" fill="#111" />
    <polygon points="-16,4 20,24 24,21 -12,1" fill="#111" />
    <circle cx="-16" cy="0" r="3.2" fill="#111" />
  </g>
</svg>

# Kairo

**Your Private, AI-Powered University Assistant**

Stay organized, optimize your schedule, and get instant answers about courses and professors.

[![Tech Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Django-REST-green?logo=django)](https://www.djangoproject.com/)
[![AI](https://img.shields.io/badge/OpenAI-GPT--4-blue?logo=openai)](https://openai.com/)

[Features](#features) | [Quick Start](#quick-start) | [Tech Stack](#tech-stack) | [CI/CD](#cicd) | [Deployment](#deployment)

</div>

---

## Features

### AI-Powered Schedule Generation
Automatically generate optimized course schedules based on your preferences, constraints, and course availability.

### Comprehensive Course Information
Access detailed information about courses, professors, and curriculum requirements in real-time.

### Natural Language Queries
Ask questions in plain English and get instant, accurate answers about your academic planning.

### Smart Recommendations
Get personalized suggestions for courses and professors based on reviews, ratings, and your academic goals.

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **PostgreSQL** (for production)
- **Redis** (for caching and task queues)
- **OpenAI API Key**

### Local Development

#### 1. Clone the Repository

```bash
git clone https://github.com/oumizumi/kairo_clean.git
cd kairo_clean
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp env.example .env
# Edit .env with your settings

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp env.example .env.local
# Edit .env.local with your backend URL

# Start development server
npm run dev
```

Your app should now be running at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Deployment**: Vercel

### Backend
- **Framework**: Django 4.x + Django REST Framework
- **Database**: PostgreSQL (with optional read replica support)
- **Cache**: Redis
- **Task Queue**: Celery with Redis broker
- **API**: RESTful API with rate limiting
- **Deployment**: Railway / Render
- **Language**: Python

### AI and Data
- **AI Model**: OpenAI GPT-4
- **Data Scraping**: Node.js with Playwright
- **Course Data**: Real-time scraping from university catalogs

### Infrastructure
- **Web Server**: Gunicorn with gthread workers
- **Connection Pooling**: PgBouncer support
- **Monitoring**: Health checks at `/healthz` and `/readyz`
- **Load Testing**: k6

---

## Project Structure

```
kairo/
├── backend/              # Django REST API
│   ├── api/              # API endpoints, models, services
│   ├── kairo/            # Django settings & configuration
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/             # Next.js React application
│   ├── src/
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── services/     # API services
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Utility functions
│   ├── public/           # Static assets & course data
│   └── package.json
│
├── services/             # Data scrapers
│   ├── course_scraper/   # Course catalogue scraper
│   └── rmp_scraper/      # RateMyProfessors scraper
│
├── infrastructure/       # Docker and deployment configs
│   ├── docker/           # Dockerfiles
│   └── scripts/          # Deployment scripts
│
├── .github/workflows/    # CI/CD pipelines
│   ├── frontend.yml      # Frontend CI
│   ├── backend.yml       # Backend CI
│   └── services.yml      # Services CI
│
└── k6/                   # Load testing scripts
```

---

## CI/CD

This project uses GitHub Actions for continuous integration. Workflows run automatically on pull requests and pushes to the `main` branch.

### Workflows

| Workflow | Trigger | Checks |
|----------|---------|--------|
| **Frontend CI** | Changes in `frontend/` | Lint (ESLint), Build (Next.js) |
| **Backend CI** | Changes in `backend/` | Lint (flake8), Django system check |
| **Services CI** | Changes in `services/` | TypeScript compilation |

### Status

Workflows use path filtering to only run when relevant files change. Each workflow:

- Caches dependencies for faster runs
- Runs on `ubuntu-latest`
- Uses Node.js 20 (frontend/services) or Python 3.11 (backend)

### Running Checks Locally

```bash
# Frontend
cd frontend && npm run lint && npm run build

# Backend
cd backend && pip install flake8 && flake8 . && python manage.py check

# Services
cd services/course_scraper && npm run build
```

---

## Deployment

### Production Environment Variables

#### Backend Environment Variables

```bash
# Required
DATABASE_URL=postgres://user:pass@host:5432/db
REDIS_CACHE_URL=redis://host:6379/1
REDIS_BROKER_URL=redis://host:6379/2
DJANGO_SECRET_KEY=your-secret-key
DJANGO_ALLOWED_HOSTS=your-domain.com
DJANGO_CORS_ALLOWED_ORIGINS=https://your-frontend.com
OPENAI_API_KEY=sk-...

# Optional
DATABASE_URL_REPLICA=postgres://replica-host:5432/db
USE_PGBOUNCER=1
WEB_CONCURRENCY=4
WEB_THREADS=2
CELERY_CONCURRENCY=16
REQUESTS_DEFAULT_CONNECT_TIMEOUT=10
REQUESTS_DEFAULT_READ_TIMEOUT=30
```

#### Frontend Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Deploy to Vercel (Frontend)

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

### Deploy to Railway (Backend)

1. **Connect your GitHub repository** to Railway
2. **Set environment variables** in Railway dashboard
3. **Deploy** automatically on push to main branch

Railway will use:
- `Dockerfile` for building the container
- `scripts/backend/railway_start.sh` as entrypoint
- `gunicorn.conf.py` for Gunicorn configuration

### Deploy Scrapers to Render

```bash
cd scrapers

# Deploy using Render blueprint
render blueprint deploy

# Or use the helper script
../scripts/scrapers/deploy-scraper.sh
```

---

## Advanced Configuration

### Docker Setup

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Running Celery Workers

```bash
cd backend
celery -A kairo worker --concurrency=${CELERY_CONCURRENCY:-16} -Ofair
```

### Database Configuration

#### With Read Replica

```bash
# Configure in settings
DATABASE_URL_REPLICA=postgres://replica:5432/db

# Enable router in settings.py
DATABASE_ROUTERS = ['kairo.db_router.ReadReplicaRouter']
```

#### With PgBouncer

```bash
# Disable connection pooling when using PgBouncer
USE_PGBOUNCER=1
```

### Load Testing

```bash
# Test cached reads
k6 run -e BASE_URL=http://localhost:8000 k6/k6_cached_reads.js

# Test AI enqueue endpoint
k6 run -e BASE_URL=http://localhost:8000 k6/k6_ai_enqueue.js
```

---

## Development Scripts

### Backend Scripts

```bash
# Production startup (used in containers)
./scripts/backend/railway_start.sh

# Database utilities
./scripts/backend/railway_db_fix.sh

# Build and collect static files
./scripts/backend/build.sh
```

### Data Management

```bash
# Sync scraped data to frontend
node scripts/update_kairoll_data.js
```

---

## Performance and Scaling

### Current Production Setup

- **API Base**: `https://kairo-production-6c0a.up.railway.app`
- **Connection Pooling**: PgBouncer enabled
- **Caching**: Redis with conditional GET middleware
- **Rate Limiting**: Circuit breaker for AI endpoints
- **Workers**: Gunicorn gthread workers + Celery for async tasks

### System Capacity

Current configuration supports:

| Workload Type | Concurrent Users | Notes |
|--------------|------------------|-------|
| AI workloads (write-heavy) | ~400 | Tested with p95 < 800ms |
| Cached reads | ~2,000 | Heavily cached API responses |
| Synchronous HTTP | ~16-50 | Depends on request duration |

**Configuration:**
- Gunicorn workers: 4 (`WEB_CONCURRENCY`)
- Threads per worker: 4 (`WEB_THREADS`)
- Celery concurrency: 16 (`CELERY_CONCURRENCY`)
- Total HTTP capacity: **16 concurrent requests** (4 x 4)

### Capacity Constraints

System throughput is limited by:

1. **Database Connections**
   - Default pool: ~100 connections per worker (no explicit cap)
   - Risk of saturation under high concurrency if not tuned

2. **Redis Connections**
   - Used for caching and Celery task queues
   - Pool exhaustion under load spikes may increase latency

3. **Request Patterns**
   - Write-heavy operations (AI inference + DB writes) stress CPU and DB
   - Read-heavy operations benefit significantly from Redis caching

4. **Resource Allocation**
   - Memory and CPU limits on hosting platform directly affect throughput
   - Monitor resource utilization during peak load

### Scaling Guidelines

To increase capacity safely:

#### Application Layer
```bash
# Increase web server concurrency
WEB_CONCURRENCY=8        # Double the workers
WEB_THREADS=4            # Keep thread count moderate

# Increase task worker concurrency
CELERY_CONCURRENCY=32    # Scale background tasks
```

#### Database Layer
- Scale PostgreSQL connection pool proportionally to workers
- Consider adding a read replica (`DATABASE_URL_REPLICA`)
- Ensure PgBouncer is configured if using connection pooling

#### Cache Layer
- Increase Redis connection pool to match increased concurrency
- Monitor Redis memory usage and eviction rates
- Consider Redis cluster for horizontal scaling

#### Monitoring Checklist
- Track p95/p99 response times for AI vs cached endpoints
- Monitor DB/Redis connection pool utilization
- Watch for connection exhaustion errors in logs
- Track memory and CPU usage under load
- Run load tests before and after scaling changes

### Health Monitoring

- **Liveness**: `GET /healthz`
- **Readiness**: `GET /readyz`

---

## Contributing

This is a private project. If you have access and want to contribute:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## License

Private project - All rights reserved.

---

## Support

For issues or questions, please contact the development team.

---

<div align="center">

**Made for university students**

</div>
