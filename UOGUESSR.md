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
- **Leaflet + OpenStreetMap** for the guess map. Free, no API key, no billing.
  Pannellum (or Photo Sphere Viewer) when 360 photos arrive.

## Photo set

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

Lock the Leaflet map to the campus area so pins can't go to Gatineau:

- Center: ~45.4231, -75.6831 (Tabaret)
- Bounds: roughly 45.4170–45.4290, -75.6920–75.6740 (covers main campus + Lees a stretch)
- Min zoom 15, max zoom 19.

## Route & components

```
frontend/src/app/guess/page.tsx     - game page (state machine: playing -> reveal -> done)
frontend/public/guess/*.webp        - photos
frontend/src/data/guess_locations.* - location list
```

Keep it one file until there's a real reason to split (per repo conventions).
Leaflet must be dynamically imported (`next/dynamic`, `ssr: false`) — it touches
`window` at import time.

## Future ideas (post-MVP)

- **Daily challenge** — same 5 photos for everyone each day, shareable score
  (Wordle-style emoji-free result grid).
- **360 panoramas** — upgrade popular spots; `type: 'pano'` + Pannellum viewer.
- **Leaderboard** — needs a backend or Supabase; skip until there's traffic.
- **Timed mode** — 30 seconds per round.

## Build order (MVP)

1. Location data file + 2–3 placeholder photos to develop against
2. `/guess` page: photo panel + Leaflet map panel, pin drop, Guess button
3. Scoring + reveal (distance line, points)
4. 5-round loop + end screen
5. Home page card + navbar entry
6. Swap in the real photo set
