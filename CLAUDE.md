# uomap — Claude Context

## What is uomap
Student tool for the University of Ottawa. Two core features:
1. **Schedule builder** — search uOttawa courses and build a conflict-free weekly timetable
2. **Student opportunities** — TA postings, scholarships, and academic opportunities

## Tech stack
- **Frontend:** Next.js 15, TypeScript, Tailwind CSS v3 (no raw CSS ever — Tailwind only)
- **Scrapers:** Node.js + TypeScript + Puppeteer (course data), Python (RMP, scholarships, TA jobs)
- **No backend yet** — data served via Next.js API routes reading local JSON files

## Project structure
```
uomap/
  frontend/                        - Next.js app (port 3000/3002)
    src/
      app/
        page.tsx                   - Home page (two cards: schedule + opportunities)
        layout.tsx                 - Root layout with next-themes provider
        globals.css                - @tailwind directives only, no custom CSS
        schedule/
          page.tsx                 - Schedule builder (TODO)
        opportunities/
          page.tsx                 - Opportunities page (TODO)
        api/
          courses/
            route.ts               - Course search API (TODO)
      components/
        ThemeToggle.tsx            - Light/dark toggle using next-themes useTheme()
        Providers.tsx              - ThemeProvider wrapper (next-themes)
    tailwind.config.ts             - darkMode: 'class', custom garnet/polar/charcoal colors
    package.json
  services/
    course_scraper/                - Puppeteer scraper for uOttawa course catalogue
      src/
        scrape_uottawa_courses.ts  - Core scraper logic
        index.ts                   - Express API wrapper
      data/
        all_courses_fall_2025.json      - 251KB, grouped by course + section groups
        all_courses_spring_summer_2025.json - 817KB
        all_courses_winter_2026.json    - empty (not scraped yet)
        all_courses_complete.json       - 5.5MB, includes descriptions + prerequisites
    rmp_scraper/                   - Rate My Professors scraper
    scholarship_scraper/           - Scholarship listings
    ta_scraper/                    - TA job postings
  .env                             - Supabase credentials + Django keys
```

## Design system
**Colors (always use hex values directly — not Tailwind color names):**
- Primary backgrounds: `#ffffff` (light) / `#111111` (dark)
- Card backgrounds: `#f5f5f5` (light) / `#1a1a1a` (dark)
- Garnet accent: `#8f001a` — used for buttons, borders, links, icons ONLY (secondary color)
- Body text: `#111111` (light) / `#f0f0f0` (dark)
- Muted text: `#666` (light) / `#888` (dark)
- Navbar + Footer: always `#111111` regardless of theme

**Typography:** Inter (loaded via next/font/google). Sans-serif only everywhere.

**Dark mode:** next-themes with `attribute="class"`. Toggle in ThemeToggle.tsx. Always test both modes.

**Rules:**
- No raw CSS anywhere — Tailwind classes only. Dynamic values (computed positions, colors from data) may use inline `style={{}}` props.
- No emojis in code or UI
- Minimal comments — only where logic is non-obvious
- Keep components in the same file until there's a real reason to split

## Course data schema
Served from `services/course_scraper/data/`. Loaded by Next.js API routes at runtime.

```typescript
// Grouped format (all_courses_fall_2025.json)
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
      units?: string            // "3" (only in complete.json)
      description?: string      // (only in complete.json)
    }
  ]
}

// SectionInfo
{
  section: string               // "A00-LEC", "A01-LAB"
  days: string[]                // ["Mo", "Tu"] — Mo Tu We Th Fr
  time: string                  // "Tu 11:30 - 12:50, Fr 13:00 - 14:20" (24h)
  instructor: string            // "John Smith" or "Staff"
  status: "Open"|"Closed"|"Waitlist"|"Unknown"
  meetingStartDate: string      // "2025-09-03"
  meetingEndDate: string        // "2025-12-02"
}
```

**Time string format:** `"<days> <HH:MM> - <HH:MM>"` entries comma-separated.
- Single day same time: `"Mo 10:00 - 11:20"`
- Different days different times: `"Tu 11:30 - 12:50, Fr 13:00 - 14:20"`
- Multiple days same time: `"MoWeFr 09:00 - 09:50"` (days run together)

## Schedule builder — spec
**Route:** `/schedule`

**Layout:**
- Left panel (~360px wide): term selector + search input + scrollable course results
- Right panel (flex-1): weekly grid Mon–Fri 8am–10pm with absolutely-positioned course blocks
- Mobile: full-screen single panel, bottom tab bar to switch Search / Schedule

**Grid:**
- Hours 8am–10pm (14 rows), each hour = 60px
- 5 day columns (Mon–Fri)
- Course blocks: `top = (startHour - 8) * 60`, `height = (endHour - startHour) * 60`
- 8 course colors cycling: `['#8f001a','#1d4ed8','#15803d','#b45309','#7c3aed','#be185d','#0369a1','#065f46']`
- Conflict detection: warn if two added sections overlap on the same day

**UX flow:**
1. User types course code or name (min 2 chars, 300ms debounce)
2. Results fetched from `/api/courses?term=fall2025&q=<query>` (max 25 results)
3. Click a course row → expands showing section groups (A, B, C...)
4. Each group shows: lecture time + instructor + Open/Closed/Waitlist badge
5. Click Add → section added to grid; button becomes Remove
6. Conflict → red warning badge on the conflicting block

**API route:** `GET /api/courses?term=fall2025|summer2025&q=<string>`
- Reads the appropriate JSON file from `../../services/course_scraper/data/` relative to `process.cwd()` (which is `frontend/`)
- Filters courseCode + courseTitle case-insensitively
- Returns `{ courses: Course[] }` max 25

## Opportunities page — spec (future)
**Route:** `/opportunities`
Three tabs: **TA Jobs** | **Scholarships** | **Other**
Data from respective scrapers in `services/`. Same minimal layout principles.

## What's done
- Home page (`/`) with two cards linking to schedule + opportunities
- Dark/light mode toggle (next-themes)
- Custom SVG icons for both cards
- GitHub link in footer

## Conventions
- Term keys: `fall2025`, `summer2025` (winter2026 is empty — hide it)
- Available terms in UI: "Fall 2025" and "Summer 2025" only
- All pages share the same minimal top bar (uomap logo + ThemeToggle)
- Footer: disclaimer + GitHub icon only
- Garnet `#8f001a` is NEVER used as a large background — only as accent
