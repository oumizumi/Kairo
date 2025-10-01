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

[Features](#-features) • [Quick Start](#-quick-start) • [Tech Stack](#-tech-stack) • [Deployment](#-deployment)

</div>

---

## ✨ Features

### 🤖 **AI-Powered Schedule Generation**
Automatically generate optimized course schedules based on your preferences, constraints, and course availability.

### 📚 **Comprehensive Course Information**
Access detailed information about courses, professors, and curriculum requirements in real-time.

### 💬 **Natural Language Queries**
Ask questions in plain English and get instant, accurate answers about your academic planning.

### 🎯 **Smart Recommendations**
Get personalized suggestions for courses and professors based on reviews, ratings, and your academic goals.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **PostgreSQL** (for production)
- **Redis** (for caching and task queues)
- **OpenAI API Key**

### Local Development

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/oumizumi/kairo_clean.git
cd kairo_clean
```

#### 2️⃣ Backend Setup

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

#### 3️⃣ Frontend Setup

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

## 🏗️ Tech Stack

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

### AI & Data
- **AI Model**: OpenAI GPT-4
- **Data Scraping**: Node.js with Playwright
- **Course Data**: Real-time scraping from university catalogs

### Infrastructure
- **Web Server**: Gunicorn with gthread workers
- **Connection Pooling**: PgBouncer support
- **Monitoring**: Health checks at `/healthz` and `/readyz`
- **Load Testing**: k6

---

## 📁 Project Structure

```
kairo_clean/
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
├── scrapers/             # Course data scrapers
│   ├── src/              # TypeScript scraper code
│   ├── data/             # Generated course JSON (source of truth)
│   └── render.yaml       # Render deployment config
│
├── scripts/              # Deployment & utility scripts
│   ├── backend/          # Backend deployment helpers
│   ├── scrapers/         # Scraper deployment scripts
│   └── database/         # Database utilities
│
├── k6/                   # Load testing scripts
├── rmp_scraper/          # RateMyProfessors data scraper
└── docker-compose.yml    # Local Docker setup
```

---

## 🌐 Deployment

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

## 🔧 Advanced Configuration

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

## 🛠️ Development Scripts

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

## 📊 Performance & Scaling

### Current Production Setup

- **API Base**: `https://kairo-production-6c0a.up.railway.app`
- **Connection Pooling**: PgBouncer enabled
- **Caching**: Redis with conditional GET middleware
- **Rate Limiting**: Circuit breaker for AI endpoints
- **Workers**: Gunicorn gthread workers + Celery for async tasks

### Health Monitoring

- **Liveness**: `GET /healthz`
- **Readiness**: `GET /readyz`

---

## 🤝 Contributing

This is a private project. If you have access and want to contribute:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📝 License

Private project - All rights reserved.

---

## 🆘 Support

For issues or questions, please contact the development team.

---

<div align="center">

**Made with ❤️ for university students**

</div>
