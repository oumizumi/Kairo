# Next Steps — uomap Schedule Builder

---

## 1. Course Search Panel UI Revamp + RMP Integration

### Goal
Completely revamp the left panel (course search results, section groups, term selector) to be more polished and information-rich. Add Rate My Professors (RMP) data inline so students can make informed decisions without leaving the page.

### What to build
- **Term selector**: revisit the Summer/Fall/Winter segmented control — better spacing, cleaner active state, possibly show course count per term
- **Course row**: redesign the expanded section group cards — more breathing room, better hierarchy
- **RMP ratings**: show professor rating (score out of 5, difficulty, would-take-again %) inline next to instructor name in each section group
  - Pull from `frontend/public/professors_enhanced.json` (already scraped)
  - Show a colored dot or small badge (green/yellow/red) based on rating threshold
  - Tooltip or inline expand for full RMP details (rating, difficulty, # ratings)
- **Section status badges**: Open/Closed/Waitlist badges should be more prominent and color-coded
- **Course description**: optionally show a short excerpt of the course description on hover or expand
- **Units**: show credit units clearly per course

### Data available
- RMP data: `frontend/public/professors_enhanced.json`
- Course descriptions: `services/course_scraper/data/all_courses_complete.json`

---

## 2. Calendar Blocks — Visibility & Polish

### Goal
Make sure every added course is clearly and beautifully visible on the weekly grid. Currently blocks render but need polish for legibility and detail at all sizes.

### What to build
- **Block content**: at normal sizes show course code + time range; at larger hourHeight also show professor last name and section type (LEC/LAB/TUT)
- **Block hover state**: on hover, expand or highlight the block with a tooltip showing full details (course title, instructor, room if available, time, status)
- **Conflict indicator**: if two blocks visually overlap (shouldn't happen due to conflict detection but edge cases exist), show a red border or warning
- **Today highlight**: subtle column tint for today's date column (light garnet wash or gray)
- **Current time indicator**: a thin red horizontal line showing the current time of day, only visible on today's column
- **LAB/TUT blocks**: currently lighter variant — make sure they're clearly distinguished but still cohesive with their parent lecture color
- **Block click**: clicking a block should show a small popover/tooltip with course details + a "Remove" button, instead of removing immediately on click (current behavior is too easy to accidentally trigger)

---

## 3. Saturday Classes — Animated Column Reveal

### Goal
The current grid only shows Mon–Fri. Some uOttawa courses have Saturday sections. When a user adds a course that includes a Saturday session, the grid should dynamically and smoothly reveal a Saturday column.

### Behavior
- By default: grid shows Mon–Fri only (5 columns)
- When user adds a section that has a `Sa` day block: Saturday column animates in from the right
- When user removes all Saturday sections: Saturday column animates out
- The reveal should feel intentional and satisfying — not jarring

### Animation ideas (to discuss)
- Slide in from right with a subtle fade
- Column width animates from 0 to flex-1 using CSS transition on `width` or `max-width`
- Possibly a small label "Sat added" toast or the day header pulses briefly on reveal

### Implementation notes
- `DAYS` array in `WeeklyGrid.tsx` is currently hardcoded as `['Mon','Tue','Wed','Thu','Fri']`
- Will need to become dynamic based on whether any added section has a `Sa` block
- `DAY_ABBR` already maps `Sa` → needs to map to a display name
- The vertical line overlay and sticky header both need to handle a 6th column gracefully
- Discuss: should Sunday ever be shown? (probably not for uOttawa)

---

## Order of implementation
1. Calendar blocks polish (most impactful visually, unblocks everything else)
2. Course panel revamp + RMP (adds real value for decision-making)
3. Saturday column reveal (fun, discuss details before building)
