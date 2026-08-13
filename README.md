# AKSU Score

A Sofascore-style live score site for the Akwa Ibom State University inter-departmental football league. Next.js 14 (App Router) + TypeScript + Tailwind. Frontend-first: all data currently comes from `lib/mock-data.ts`, shaped exactly like a real API response so swapping in a backend later is a data-layer change, not a rewrite.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What's built (v1)

- **Home** (`app/page.tsx`) — tab bar: Matches (live / upcoming / full-time), Table, Top Scorers, Top Assists, Best Rated, Cards.
- **Match detail** (`app/match/[id]/page.tsx`) — scoreline header, tactical formation pitch (SVG), event timeline (goals, cards).
- **Department table** — points, form, W/D/L, GD, top-4 qualification line.
- **Player leaderboards** — goals, assists, rating (color-coded pill), yellow/red cards.

## Where the backend plugs in

Everything in `lib/mock-data.ts` (`departments`, `players`, `matches`, `standings`) is the exact shape your API should return — see `lib/types.ts` for the contracts. When the backend is ready:

1. Replace the imports in `app/page.tsx` / `app/match/[id]/page.tsx` with `fetch()` calls to your API (or a small `lib/api.ts` wrapper).
2. Keep the types in `lib/types.ts` as the source of truth — update them first if the backend model changes, TypeScript will flag every place that breaks.
3. For live matches, the `minute`/`status` fields are already designed for polling or a websocket push — no component changes needed, just update state on an interval.

## Design system

Dark scoreboard theme, tokens in `tailwind.config.ts`:
- `base` / `surface` / `surface2` — background layers
- `live` (green) — live match state, `loss` (red) — red cards/losses, `gold` — yellow cards/top rating
- `accent` (blue) — AKSU brand, active tab, qualification line
- Score digits use `font-score` (Space Grotesk, tabular numerals) — everything else uses Inter.

## Not built yet (say the word and we do these next)

- Backend/API + database
- Auth (admin panel to enter live scores)
- Team/player detail pages
- Search
- Fixtures by department filter
