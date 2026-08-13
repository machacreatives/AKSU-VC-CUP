# AKSU Score

A Sofascore-style live score site for the Akwa Ibom State University inter-departmental football league. Next.js 14 (App Router) + TypeScript + Tailwind, backed by Postgres (Neon on Vercel).

Frontend and backend are one Next.js project — there is no separate API service.

## Run it

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

Open http://localhost:3000.

`POSTGRES_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` all have to be set — see `.env.example`. Without a database connection every page renders a "Database not ready" notice explaining what is missing.

On a brand-new database, sign in at `/admin/login` and press **Initialise database** to create the tables.

## How data flows

Postgres → `lib/db/queries.ts` → server components → UI.

- `lib/types.ts` — the shared contracts, and the source of truth for the data shape
- `lib/db/schema.ts` — the table definitions (a TS module rather than a `.sql` file so it is always bundled)
- `lib/db/queries.ts` — every read and write; reads call `noStore()` because Next.js otherwise caches the driver's HTTP queries and serves stale scores
- `lib/data-context.tsx` — hands departments and players to client components so they can resolve ids

The public pages (`app/page.tsx`, `app/match/[id]/page.tsx`) are server components that call `lib/db/queries.ts` directly rather than round-tripping through the app's own HTTP API. They are `dynamic = "force-dynamic"` and refresh themselves every 20s so live scores update on their own.

## API routes

Public, read-only:

- `GET /api/matches`, `GET /api/matches/[id]`
- `GET /api/departments`, `GET /api/players`, `GET /api/standings`

Admin-only, gated by the session cookie in `middleware.ts`:

- `POST /api/admin/login` / `POST /api/admin/logout`
- `POST|DELETE /api/admin/matches`, `POST|DELETE /api/admin/matches/[id]/events`
- `POST|DELETE /api/admin/departments`, `POST|DELETE /api/admin/players`
- `POST /api/admin/init-db` — creates tables if missing, safe to re-run

Adding a goal or card event also moves the matching player's counters, so the Top Scorers and Cards leaderboards stay in step with the timeline.

## Admin

- `/admin/login` — username + password, signed session cookie (HMAC-SHA256 via Web Crypto, so it works in the Edge middleware runtime)
- `/admin` — match list with inline status / minute / score editing, plus database setup
- `/admin/matches/[id]` — add and remove match events

## What's built

- **Home** (`app/page.tsx`) — tabs: Matches (live / upcoming / full-time), Table, Knockout, Top Scorers, Top Assists, Best Rated, Cards.
- **Match detail** (`app/match/[id]/page.tsx`) — scoreline header, formation pitch, stats, event timeline.
- **Department tables** — points, form, W/D/L, GD, split by campus and group. Computed from full-time results rather than stored.
- **Player leaderboards** — goals, assists, rating, cards.

## Design system

Dark scoreboard theme, tokens in `tailwind.config.ts`:
- `base` / `surface` / `surface2` / `surface3` — background layers
- `win` (green) — live state and wins, `loss` (red) — red cards and losses, `gold` — yellow cards
- `accent` (orange) — AKSU crest brand colour, active tab, links
- Type is Barlow Condensed via `font-sans` / `font-score` (D-DIN has no free licence)

## Not built yet

- Admin UI for creating departments, players and fixtures (the API routes exist, but there are no forms yet — new records have to be POSTed directly)
- Team/player detail pages
- Search, and fixtures filtered by department
