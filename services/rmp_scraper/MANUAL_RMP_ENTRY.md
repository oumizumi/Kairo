# Manual RMP Entry Guide

This guide explains how to manually add RateMyProfessor (RMP) data for professors who don't have automated data.

## Quick Start

1. **Edit the CSV file** with RMP data:
   ```
   frontend/public/unmatched_professors_manual_entry.csv
   ```

2. **Run the deployment script**:
   ```bash
   cd rmp_scraper
   python3 apply_manual_rmp_entries.py
   ```

3. **Done!** Changes are automatically deployed to production (both frontend and backend).

## CSV Format

The CSV file has the following columns:

| Column | Required | Example | Description |
|--------|----------|---------|-------------|
| `name` | ✅ Yes | `John Smith` | Professor's full name (must match database) |
| `department` | ⚠️ Optional | `Computer Science` | Department name |
| `rmp_id` | ✅ Yes | `1234567` | RateMyProfessor ID |
| `rmp_rating` | ✅ Yes | `4.2` | Overall rating (0-5) |
| `rmp_difficulty` | ⚠️ Optional | `3.1` | Difficulty rating (0-5) |
| `rmp_would_take_again` | ⚠️ Optional | `75` | Percentage (0-100) |
| `rmp_department` | ⚠️ Optional | `Computer Science` | RMP department name |
| `notes` | ⚠️ Optional | `Added manually on 2025-01-09` | Your notes |

### Example CSV Entry

```csv
name,department,rmp_id,rmp_rating,rmp_difficulty,rmp_would_take_again,rmp_department,notes
John Smith,Computer Science,1234567,4.2,3.1,75,Computer Science,Added manually from RMP search
Jane Doe,Mathematics,7654321,3.8,3.5,65,Mathematics,Verified with current data
```

## How to Find RMP Data

1. Go to [RateMyProfessors.com](https://www.ratemyprofessors.com/)
2. Search for "University of Ottawa" or professor name
3. Find the professor's profile
4. Extract the data:
   - **RMP ID**: Look in the URL (e.g., `/professor/1234567`)
   - **Rating**: Overall Quality rating
   - **Difficulty**: Level of Difficulty rating
   - **Would Take Again**: Percentage shown on profile

## Workflow

### Step 1: Edit the CSV

Open `frontend/public/unmatched_professors_manual_entry.csv` and fill in RMP data:

```csv
name,department,rmp_id,rmp_rating,rmp_difficulty,rmp_would_take_again,rmp_department,notes
Abdelhamid Benhmade,Engineering,2345678,3.9,3.2,72,Engineering,Added 2025-01-09
Abdou Thiaw,Law,3456789,4.1,2.8,80,Law,Verified RMP profile
```

**Important**: Leave rows empty if you don't have RMP data yet!

### Step 2: Run the Deployment Script

```bash
cd rmp_scraper
python3 apply_manual_rmp_entries.py
```

The script will:
1. ✅ Read your CSV entries
2. ✅ Match professors by name
3. ✅ Update `professors_enhanced.json`
4. ✅ Create backups (timestamped)
5. ✅ Deploy to **frontend** (`frontend/public/`)
6. ✅ Deploy to **backend** (`backend/api/data/`)
7. ✅ Bust the cache for immediate updates
8. ✅ Generate a report

### Step 3: Verify the Changes

The script will output a report like:

```
📊 Update Report:
   • Manual entries applied: 2
   • Total professors with RMP: 715
   • Manual RMP entries: 2
   • Coverage: 51.3%
   • Report saved to: frontend/public/manual_rmp_update_report.json
```

## Production Deployment

The script automatically deploys to **production**:

- ✅ **Frontend**: `frontend/public/professors_enhanced.json`
  - Used by the React app
  - Served to users immediately
  
- ✅ **Backend**: `backend/api/data/professors_enhanced.json`
  - Used by Django API
  - Served via `/api/professors/rmp/` endpoint

- ✅ **Cache Busting**: `frontend/public/cache-bust.json`
  - Forces frontend to reload new data
  - No need to clear browser cache

## Safety Features

### Automatic Backups

Every time you run the script, it creates timestamped backups:

```
frontend/public/professors_enhanced_backup_20250109_143022.json
backend/api/data/professors_enhanced_backup_20250109_143022.json
```

### Validation

The script validates:
- ✅ Professor names must exist in the database
- ✅ RMP ID and rating are required
- ✅ Ratings must be valid numbers
- ⚠️ Warns if professor not found

### Manual Entry Tracking

Professors updated manually are flagged:

```json
{
  "name": "John Smith",
  "rmp_rating": "4.2",
  "has_rmp_data": true,
  "manual_entry": true,
  "manual_entry_date": "2025-01-09T14:30:22.123456"
}
```

## Tips & Best Practices

### 1. Batch Updates

You can add multiple entries to the CSV at once:

```csv
name,department,rmp_id,rmp_rating,rmp_difficulty,rmp_would_take_again,rmp_department,notes
Prof A,Dept1,111,4.0,3.0,70,Dept1,Batch update
Prof B,Dept2,222,3.5,3.5,65,Dept2,Batch update
Prof C,Dept3,333,4.5,2.5,85,Dept3,Batch update
```

Then run the script once to update all at the same time.

### 2. Name Matching

The script tries to match names fuzzy-ly:
- ✅ `John Smith` matches `John A. Smith`
- ✅ `Jane Doe` matches `Jane Marie Doe`
- ❌ `J. Smith` might not match `John Smith`

**Best practice**: Use the full name as it appears in the database.

### 3. Incremental Updates

You can run the script multiple times:
- New entries are added
- Existing manual entries are updated
- Nothing breaks!

### 4. Verification

After running, check the generated report:

```bash
cat ../frontend/public/manual_rmp_update_report.json
```

## Troubleshooting

### "Professor not found in database"

**Problem**: Name doesn't match exactly.

**Solution**:
1. Check the exact spelling in `frontend/public/professors_enhanced.json`
2. Look for middle initials or different formatting
3. Try the full name as shown in the database

### "No manual entries found in CSV"

**Problem**: All rows are empty or missing required fields.

**Solution**:
1. Make sure `rmp_id` and `rmp_rating` columns are filled
2. Don't leave required fields blank
3. Check CSV formatting (commas, no extra spaces)

### "Cannot proceed without professors_enhanced.json"

**Problem**: Main data file is missing.

**Solution**:
1. Make sure you're in the `rmp_scraper/` directory
2. Check that `../frontend/public/professors_enhanced.json` exists
3. Run the main RMP scraper first if needed

## Advanced: Manual Entry Tracking

### View All Manual Entries

```bash
cd frontend/public
cat professors_enhanced.json | jq '[.[] | select(.manual_entry == true) | {name, rmp_rating, manual_entry_date}]'
```

### Count Manual Entries

```bash
cat professors_enhanced.json | jq '[.[] | select(.manual_entry == true)] | length'
```

### Find Recently Added

```bash
cat manual_rmp_update_report.json | jq .
```

## Integration with Existing Pipeline

This manual entry system integrates with your existing RMP scraper:

```
┌─────────────────┐
│  RMP Scraper    │  ← Automated scraping
│  (main.py)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Manual Entry   │  ← Fill missing data
│  (CSV + Script) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Production     │  ← Both frontend & backend
│  Deployment     │
└─────────────────┘
```

## Questions?

If you need help:
1. Check the console output for specific error messages
2. Look at the generated report: `frontend/public/manual_rmp_update_report.json`
3. Check backups if something goes wrong
4. The script is safe to run multiple times!

---

**Remember**: This script is production-ready! When you save the CSV and run the script, changes go live immediately to both frontend and backend. 🚀


