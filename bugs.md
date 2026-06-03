# uomap — Bugs & TODO

## Bugs (fix first)

### 1. French filter still broken
- Clicking French with no search query now loads 60 courses (fixed the empty-courses case)
- But the client-side detection (`/^F\d/i` on section code) may miss French sections in some data
- Also: bilingual courses (have both A and F groups) get excluded from the English filter (`!hasFr` removes them)
- Need to verify filter actually shows correct results end-to-end in the browser
- Fix English filter to only exclude courses that have NO English sections (not just "has a French section too")

### 2. RMP data — most profs missing ratings
- `professors_rmp_data.json` has ~1500 entries but most have `has_rmp_data: false`
- Root causes:
  - RMP scraper (`run.js`) is still running / may not have completed for all 1078 names
  - Some professors are not on RMP at all (new hires, sessionals, TAs listed as instructors)
  - Name matching is case/format sensitive — "Smith, John" vs "John Smith" may not match
  - After scraper finishes: need to run `pdcsv.py` → `main.py` → regenerate `professors_rmp_data.json`
- Fix: run the full pipeline after scraper completes, then reload the API cache

### 3. Advanced filter — needs work
- Subject code search works but SUBJECTS array is hardcoded (only 18 codes, missing many like ITI, PHO, CVG, etc.)
- Should auto-generate SUBJECTS list from the actual course data rather than hardcoding
- Year filter works but "4th year+" logic (`parseInt(num[0]) >= 4`) needs testing on grad-level courses (5xxx, 6xxx)
- Language filter: see bug #1 above
- Filters should persist when switching terms (currently reset on term change)
- "Clear all" button only clears lang/year/subject but doesn't reset the query input

---

## UI — Mobile (implement after bugs)

- Current: left panel (course search) + right panel (grid) side-by-side, fixed widths
- Mobile target: split screen — left half = course search/add panel, right half = weekly calendar grid
- No bottom tab bar (user preference: side-by-side, not tabbed)
- On small screens (<768px): stack vertically with a toggle between search and calendar views, or use a drawer
- Grid hour height needs to adapt to available height on mobile
- Course blocks text becomes unreadable at small column widths — need min width or truncation

---

## Calendar block UI (fix after mobile)

### Visual fixes
- Blocks are too plain — course code + time is bare minimum, needs better layout
- Show group letter (A, B, F...) on block so user knows which section they added
- LAB / TUT / DGD blocks should look visually distinct from LEC blocks (not just smaller text)
- Very short blocks (30-min labs) clip the text — need smarter truncation or icon-only mode below a height threshold
- Block color contrast: light tint bg + colored text works but the tint (`color + '1a'`) is too faint in dark mode

### Hover animation
- Add a smooth hover state on calendar blocks: slight lift (`translateY(-1px)`) + subtle box-shadow on hover
- Transition should be fast (~100ms ease-out) so it feels snappy, not laggy
- On hover, show a small tooltip or popover with: course title, full time range, section code, professor name
- Click still removes — keep the remove behavior, but maybe require a long-press or a dedicated X button instead of the whole block being a remove target (easy to accidentally remove)

---

## Polish (do after mobile)

- Lab/TUT blocks: when selected, show a visual indicator in the "added" chips at top of search panel
- Conflict detection: currently only checks lecture time at add-step — should warn when a selected lab conflicts with another course's lecture
- Empty state when all filters yield no results: show which filter is causing it
- Term switching: clear added sections with a confirmation prompt, or warn user
- RMP stars link: opens search URL — would be better with direct profile link (need to store RMP ID in scraper output)
- Performance: `all_courses_fall_2026.json` is large — consider paginating the API or adding more aggressive caching

---

## Scraper pipeline (run when ready)

1. Wait for `run.js` to finish (1078 professors)
2. Run `pdcsv.py` to process raw CSV output
3. Run `main.py` to merge into `professors_rmp_data.json`
4. Restart Next.js dev server to clear module-level cache in `/api/rmp/route.ts`
5. Check coverage: how many of the 1503 professors now have ratings
