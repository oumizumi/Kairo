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