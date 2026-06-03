# uomap

Student tool for the University of Ottawa. Two features:

- **Schedule builder** — search every uOttawa course and section, detect conflicts, build a conflict-free weekly timetable
- **Student opportunities** — live-updated TA postings, scholarships, and academic opportunities

> Independent project. Not affiliated with the University of Ottawa.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v3 |
| Themes | next-themes (dark/light) |
| Data | Static JSON files served via Next.js API routes |
| Scrapers | Node.js + TypeScript + Puppeteer (courses), Python (RMP, scholarships, TA jobs) |
| CI | GitHub Actions |
| Hosting | Vercel |

No backend server. All data is pre-scraped and served as JSON at build/request time.

---

## Project structure

```
uomap/
  frontend/                        Next.js app (port 3000)
    src/
      app/
        page.tsx                   Home page
        schedule/page.tsx          Schedule builder
        opportunities/page.tsx     Opportunities (TODO)
        api/courses/route.ts       GET /api/courses?term=&q=
      components/
        schedule/                  WeeklyGrid, SchedulePanel
        ThemeToggle.tsx
        Providers.tsx
      types/course.ts              Course, SectionInfo, SectionGroup, AddedSection

  services/
    course_scraper/                Puppeteer scraper for uOttawa course catalogue
      src/
        scrape_uottawa_courses.ts  Core scraper
        index.ts                   Express API wrapper
      data/
        all_courses_fall_2025.json
        all_courses_spring_summer_2025.json
        all_courses_fall_2026.json
        all_courses_spring_summer_2026.json
    rmp_scraper/                   Rate My Professors data
    scholarship_scraper/           Scholarship listings
    ta_scraper/                    TA job postings

  .github/workflows/
    frontend.yml                   Lint + type check + build on PR
    scraper.yml                    Type check scraper on PR
```

---

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:3000`.

### Course scraper

```bash
cd services/course_scraper
npm install
npm run scrape
```

Outputs JSON to `services/course_scraper/data/`. The frontend API route reads from there.

---

## Course data schema

```typescript
{
  courses: [
    {
      courseCode: string        // "CSI 2110"
      courseTitle: string       // "Data Structures"
      subjectCode: string       // "CSI"
      term: string              // "2025 Fall Term"
      sectionGroups: {
        [groupId: string]: {    // "A", "B", "C" ...
          groupId: string
          lecture: SectionInfo
          labs: SectionInfo[]
          tutorials: SectionInfo[]
        }
      }
    }
  ]
}

// SectionInfo
{
  section: string               // "A00-LEC"
  days: string[]                // ["Mo", "Tu"]
  time: string                  // "Tu 11:30 - 12:50, Fr 13:00 - 14:20"
  instructor: string            // "John Smith" or "Staff"
  status: "Open" | "Closed" | "Waitlist" | "Unknown"
  meetingStartDate: string      // "2025-09-03"
  meetingEndDate: string        // "2025-12-02"
}
```

---

## API

### `GET /api/courses`

| Param | Values | Description |
|---|---|---|
| `term` | `fall2025`, `summer2025`, `fall2026`, `summer2026` | Term to search |
| `q` | string (min 2 chars) | Course code or title query |

Returns `{ courses: Course[] }`, max 25 results.

---

## CI

Two workflows run on pull requests:

- **Frontend CI** — `tsc --noEmit`, `next lint`, `next build`. Posts a pass/fail comment via `uomap-bot`.
- **Scraper CI** — `tsc --noEmit` on the course scraper.

Both are path-filtered and only run when relevant files change.

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Push and open a PR against `main`
4. CI runs automatically

---

## License

MIT
