# 🚀 Data Deployment Guide

## 📋 Overview

This guide explains how to deploy scraped data to production safely and manually.

## 🔧 New Workflow (Recommended)

### 1. **Development Scraping** (Safe - No Auto-Deploy)
```bash
cd scrapers
npm run scrape:all-terms
```
- ✅ Scrapes data and saves to `scrapers/data/`
- ✅ Updates local UoSchedRoll database
- ❌ Does NOT automatically push to production
- ❌ Does NOT update frontend/backend directories

### 2. **Manual Production Deployment** (When Ready)
```bash
cd scrapers
npm run deploy:data
```
- ✅ Copies data from `scrapers/data/` to `backend/api/data/` and `frontend/public/`
- ✅ Safe and controlled
- ✅ Shows deployment summary

### 3. **Commit and Push** (Triggers Production)
```bash
git add .
git commit -m "Update production data with latest courses"
git push
```
- ✅ Vercel auto-deploys frontend
- ✅ Railway auto-deploys backend

## ⚡ Advanced: Auto-Deploy Mode

If you want the old behavior (automatic production sync):

```bash
cd scrapers
SYNC_TO_PRODUCTION=true npm run scrape:all-terms
```

## 📁 File Locations

| Location | Purpose |
|----------|---------|
| `scrapers/data/` | Source data (scraped results) |
| `backend/api/data/` | Backend production data |
| `frontend/public/` | Frontend production data |

## 🛠️ Commands Reference

| Command | Description |
|---------|-------------|
| `npm run scrape:all-terms` | Scrape all terms (local only) |
| `npm run deploy:data` | Deploy scraped data to production directories |
| `npm run deploy:data --help` | Show deployment help |
| `SYNC_TO_PRODUCTION=true npm run scrape:all-terms` | Scrape with auto-deploy |

## 🔒 Safety Features

- **Auto-deploy disabled** by default in `render.yaml`
- **Environment variable control** prevents accidental production updates
- **Manual deployment script** gives you full control
- **Clear logging** shows exactly what's happening

## 🚨 Troubleshooting

### "No scraped data found"
```bash
cd scrapers
npm run scrape:all-terms  # Run scraper first
```

### "Deployment failed"
- Check file permissions
- Ensure directories exist
- Check available disk space

### "Want to revert to old behavior"
Set `autoDeploy: true` in `scrapers/render.yaml` and use `SYNC_TO_PRODUCTION=true`

## 📈 Benefits

✅ **No accidental production updates**  
✅ **Full control over when data goes live**  
✅ **Clear separation between dev and prod**  
✅ **Easy to revert if needed**  
✅ **Better debugging and testing**
