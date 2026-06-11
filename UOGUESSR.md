# uoguessr — uOttawa GeoGuessr spec

Campus photo-guessing game. A photo of a spot on campus is shown, the player drops
a pin on a campus map, and scores points based on how close they were. Lives inside
uomap as its own route — shared navbar, theme, and design system.

## Decisions made

- **Same project, not a separate one.** New route `/guess`, card on the home page
  next to Schedule and Opportunities. Shared branding drives traffic between features.
- **Flat photos for the MVP, 360 later.** Static images make shooting trivial
  (one campus walk = a full photo set). The data model supports panoramas from day
  one so popular spots can be upgraded without a rewrite.
- **Self-taken photos only.** Screenshotting Google Street View is not allowed by
  its ToS. Our own photos are free, legal, and can cover indoor spots Street View
  doesn't have (tunnels, CRX/STEM hallways, FSS basement).
- **MapLibre GL + OpenFreeMap vector tiles** for the guess map. Free, no API key,
  no billing — GPU-rendered vector tiles, so text stays sharp and zoom is smooth
  (originally Leaflet + raster tiles; swapped for the nicer look and feel).
  Pannellum (or Photo Sphere Viewer) when 360 photos arrive.

## Photo setdfdffsfsfd

| Stage | Count | Notes |
|---|---|---|
| Ship MVP | 20 | 4 unique games before repeats |
| Comfortable | 30–40 | random draws feel fresh |
| Daily challenge mode | 60+ | one photo per day, 60 = two months |

Don't block launch on volume — ship at 20, add 5–10 per week.

### Shooting guidelines

- Difficulty mix: roughly 1/3 easy (Tabaret, Morisset entrance), 1/3 medium
  (walkways, building sides), 1/3 evil (tunnels, near-identical hallways).
- Landscape orientation, consistent height.
- No readable building-name signs unless the spot is meant to be easy.
- No faces (privacy).
- Phone GPS metadata records coordinates automatically — note them right after
  each shot instead of placing pins from memory later.
- Compress to WebP ~150–200KB before committing (30 photos ≈ under 10MB in repo).

## Data model

```typescript
// frontend/src/data/guess_locations.json (or .ts)
interface GuessLocation {
  id: string            // "tabaret-front"
  image: string         // "/guess/tabaret-front.webp" (public folder)
  lat: number
  lng: number
  type: 'photo' | 'pano'   // MVP is all 'photo'; 'pano' renders in Pannellum
  difficulty?: 'easy' | 'medium' | 'hard'   // optional, for balanced round draws
  indoor?: boolean
}
```

Images live in `frontend/public/guess/`.

## Game mechanics

- **5 rounds per game.** Each round draws a random unused location
  (optionally balanced: not all 5 from the same difficulty).
- Player sees the photo, drops a pin on the campus map, hits Guess.
- Reveal screen: line drawn from guess to actual spot, distance shown, points awarded.
- After round 5: total score + per-round recap, Play Again button.

### Gameplay feel

- **Pan/zoom on the photo.** Pinch-zoom and drag on the image — hunting details
  (signs, brick patterns, posters) is the core skill loop. Plain CSS transform
  zoom is fine for MVP; no library needed.
- **Timed mode is a real setting, not a future idea.** Pick at game start:
  30s / 60s / no limit per round. Timer runs out → current pin position is
  auto-submitted (no pin = 0 points). Time pressure is what makes duels exciting.
- **Reveal polish.** Animate the map flying from the guess pin to the actual spot,
  draw the line progressively, count the points up instead of snapping to the
  final number. The reveal moment is the dopamine — spend effort here.

### Scoring

Exponential decay on distance, 1000 points max per round (5000 per game):

```
score = round(1000 * exp(-distance_m / 150))
```

- 0 m → 1000 pts
- 50 m → ~717 pts
- 150 m → ~368 pts
- 400 m → ~70 pts
- capped at 0 beyond the map

Tune the 150 m constant after playtesting — campus is small, so it should feel
punishing past a couple hundred meters.

### Map bounds

Lock the map to the campus area so pins can't go to Gatineau:

- Center: ~45.4231, -75.6831 (Tabaret)
- Bounds: roughly 45.4170–45.4290, -75.6920–75.6740 (covers main campus + Lees a stretch)
- Min zoom 15, max zoom 19.

## Party system

Multiplayer on the same 5 photos each game. Host picks a mode when creating the room.

### 1v1 — duels with health bars

Two players, head-to-head, GeoGuessr Duels style. Both start at **5000 HP**. Each
round both drop a pin; the round loser takes damage equal to the score gap
(e.g. 850 vs 620 → loser loses 230 HP). First player to hit 0 HP loses — no fixed
round count, games end in sudden death. Way more tense than summing 5 rounds.

### Duos (2v2)

Duos vs duos — two teams of two. Teammates see the same photo and each pin
independently (no shared cursor). Per round, a team's score is the **sum** of both
players' points. After 5 rounds, the team with the higher combined total wins.

### Free-for-all (up to 5)

2–5 players in one room, everyone competing individually on the same 5 photos.
Same rules as 1v1, just scaled up — highest individual total after 5 rounds wins.
Good for friend groups who don't want teams.

| Mode | Players | Win condition |
|---|---|---|
| 1v1 | 2 | Reduce opponent to 0 HP (5000 HP, damage = score gap) |
| Duos | 4 (2 teams of 2) | Higher team score (sum of both teammates) |
| Free-for-all | 2–5 | Higher individual score |

Invite via shareable room link or code. Room waits until the lobby is full (or host
starts early once at least 2 are in), then
everyone plays the same round in sync (all guess → reveal together → next round).
Needs real-time sync — ship after MVP once a backend (Supabase or similar) is in place.

## Leaderboards

Monthly rankings to give regular players something to chase. Resets on the 1st of
each month (Eastern time). Needs Supabase (auth + scores table) — ship alongside
party mode, not in solo MVP.

### What gets ranked

- **Solo** — best single 5-round game score posted that month (one entry per player:
  only your highest run counts).
- **Daily challenge** — when daily mode ships, sum of daily challenge scores that
  month (or best single day — pick one at implementation time; sum rewards consistency).
- **Party wins** — optional later tab: most 1v1 / FFA wins, or duo team wins.

Show top 10 per category. Player sees their rank even if outside the top 10.

### UX

- `/guess/leaderboard` or a Leaderboard tab on the guess page.
- Month selector to browse current + past months (archived boards stay viewable).
- Display name on sign-in (uOttawa email optional later for verified badge).

Submitting a score requires a lightweight account (Supabase auth). Anonymous/local
solo play stays available without logging in; leaderboard opt-in only.

## Route & components

```
frontend/src/app/guess/page.tsx     - game page (state machine: playing -> reveal -> done)
frontend/public/guess/*.webp        - photos
frontend/src/data/guess_locations.* - location list
```

Keep it one file until there's a real reason to split (per repo conventions).
MapLibre must be dynamically imported (`next/dynamic`, `ssr: false`) — it touches
`window` at import time.

## Future ideas (post-MVP)

- **Daily challenge** — same 5 photos for everyone each day, shareable score
  (Wordle-style emoji-free result grid).
- **360 panoramas** — upgrade popular spots; `type: 'pano'` + Pannellum viewer.
- **Monthly leaderboards** — see Leaderboards section; solo best-run first, daily +
  party tabs when those modes exist.
- **Seasonal themes (coming soon)** — Fall, Winter, and Summer photo sets of the
  same campus. Same locations shot in different seasons (snowed-in Tabaret vs fall
  leaves), selectable as a theme when starting a game. Add an optional
  `season?: 'fall' | 'winter' | 'summer'` field to `GuessLocation`; untagged photos
  stay in the default pool.

## Build order (MVP)

1. Location data file + 2–3 placeholder photos to develop against
2. `/guess` page: photo panel + Leaflet map panel, pin drop, Guess button
3. Scoring + reveal (distance line, points)
4. 5-round loop + end screen
5. Home page card + navbar entry
6. Swap in the real photo set
